import * as THREE from 'three';

/**
 * Pixel-art post-processing pipeline (Warsaw-izo style).
 *
 * 1. The scene is rendered into a low-resolution target (CSS size / pixelSize)
 *    together with a depth texture.
 * 2. A full-screen pass adds depth-based ambient occlusion, draws dark outlines
 *    where depth jumps (depth Laplacian, so flat slanted surfaces never produce
 *    lines), grades the colour and snaps it to a limited palette with a light
 *    ordered dither.
 * 3. The canvas drawing buffer has the same low resolution and is stretched by
 *    the browser with `image-rendering: pixelated`, giving crisp square pixels.
 */
export class PixelArtPipeline {
  /** Size of one art pixel in CSS pixels (1 = native, 2 = Warsaw-izo default). */
  public pixelSize = 2;
  public outlines = true;
  public palette = true;
  public ambientOcclusion = true;

  public width = 1;
  public height = 1;

  private renderer: THREE.WebGLRenderer;
  private target: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private material: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true
    });
    this.target.depthTexture = new THREE.DepthTexture(1, 1);
    this.target.depthTexture.type = THREE.UnsignedIntType;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        resolution: { value: new THREE.Vector2(1, 1) },
        cameraNear: { value: 1 },
        cameraFar: { value: 1000 },
        pixelWorld: { value: 1 },
        outlineEnabled: { value: 1 },
        aoEnabled: { value: 1 },
        aoStrength: { value: 0.42 },
        outlineStrength: { value: 0.5 },
        paletteEnabled: { value: 1 },
        paletteLevels: { value: 20 },
        saturation: { value: 0.92 },
        contrast: { value: 1.04 }
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor;
        uniform sampler2D tDepth;
        uniform vec2 resolution;
        uniform float cameraNear;
        uniform float cameraFar;
        uniform float pixelWorld;
        uniform float outlineEnabled;
        uniform float aoEnabled;
        uniform float aoStrength;
        uniform float outlineStrength;
        uniform float paletteEnabled;
        uniform float paletteLevels;
        uniform float saturation;
        uniform float contrast;
        varying vec2 vUv;

        // Orthographic camera: depth is linear between near and far.
        float viewDist(vec2 uv) {
          float d = texture2D(tDepth, uv).x;
          return cameraNear + d * (cameraFar - cameraNear);
        }

        float bayer4(vec2 p) {
          vec2 q = mod(floor(p), 4.0);
          int i = int(q.x + q.y * 4.0);
          float m[16];
          m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
          m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
          m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
          m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
          for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0 - 0.46875; }
          return 0.0;
        }

        void main() {
          vec2 texel = 1.0 / resolution;
          vec3 col = texture2D(tColor, vUv).rgb;

          float c = viewDist(vUv);
          float l = viewDist(vUv - vec2(texel.x, 0.0));
          float r = viewDist(vUv + vec2(texel.x, 0.0));
          float u = viewDist(vUv + vec2(0.0, texel.y));
          float b = viewDist(vUv - vec2(0.0, texel.y));

          // Ambient occlusion from depth: estimate the local plane from the
          // smaller one-sided derivatives, then count samples that rise above
          // that plane (towards the camera). Flat ground and walls stay clean,
          // wall bases, courtyards and street canyons darken softly.
          if (aoEnabled > 0.5 && c < cameraFar - 1.0) {
            vec2 grad = vec2(
              abs(r - c) < abs(c - l) ? r - c : c - l,
              abs(u - c) < abs(c - b) ? u - c : c - b
            );
            float eps = max(0.25, pixelWorld * 0.35);
            float range = pixelWorld * 14.0;
            float occ = 0.0;
            for (int i = 0; i < 8; i++) {
              float a = float(i) * 0.7853982 + 0.3926991;
              vec2 dir = vec2(cos(a), sin(a));
              for (int j = 1; j <= 2; j++) {
                vec2 off = dir * (float(j) * 2.5);
                float s = viewDist(vUv + off * texel);
                float rise = (c + dot(grad, off)) - s;
                occ += smoothstep(eps, eps * 4.0, rise) * (1.0 - smoothstep(range * 0.5, range, rise));
              }
            }
            occ /= 16.0;
            col *= 1.0 - aoStrength * occ;
          }

          if (outlineEnabled > 0.5) {
            // Positive when this pixel is nearer than its neighbours: the
            // silhouette of the foreground object. Planes cancel out exactly.
            float lap = (l + r + u + b) - 4.0 * c;
            float threshold = max(1.2, pixelWorld * 2.2);
            float edge = smoothstep(threshold, threshold * 1.8, lap);
            col *= mix(1.0, outlineStrength, edge);
          }

          vec4 outCol = linearToOutputTexel(vec4(col, 1.0));
          vec3 s = outCol.rgb;

          // Gentle grade: slightly muted, a touch more contrast.
          float luma = dot(s, vec3(0.299, 0.587, 0.114));
          s = mix(vec3(luma), s, saturation);
          s = (s - 0.5) * contrast + 0.5;

          if (paletteEnabled > 0.5) {
            float dither = bayer4(gl_FragCoord.xy) * 0.6;
            s = floor(s * paletteLevels + 0.5 + dither) / paletteLevels;
          }

          gl_FragColor = vec4(clamp(s, 0.0, 1.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  /** Resize for a viewport of the given CSS size. */
  public setSize(cssWidth: number, cssHeight: number) {
    this.width = Math.max(1, Math.floor(cssWidth / this.pixelSize));
    this.height = Math.max(1, Math.floor(cssHeight / this.pixelSize));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(this.width, this.height, false);
    this.target.setSize(this.width, this.height);
    this.material.uniforms.resolution.value.set(this.width, this.height);
  }

  public render(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    const u = this.material.uniforms;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.pixelWorld.value = (camera.top - camera.bottom) / camera.zoom / this.height;
    u.outlineEnabled.value = this.outlines ? 1 : 0;
    u.aoEnabled.value = this.ambientOcclusion ? 1 : 0;
    u.paletteEnabled.value = this.palette ? 1 : 0;

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
