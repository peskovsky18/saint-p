import * as THREE from 'three';
import earcut from 'earcut';
import { latLonToMeters } from './geo';
import { PALETTE } from './palette';

export interface OSMWater {
  id: number;
  name: string;
  polygon: [number, number][]; // [lon, lat]
}

export class WaterSystem {
  public group: THREE.Group;
  public riverMesh: THREE.Mesh | null = null;
  public quayMesh: THREE.Mesh | null = null;
  public material: THREE.ShaderMaterial;
  public waterLevelCm: number = 0;
  private timeUniform: { value: number };
  private levelUniform: { value: number };
  private nightUniform: { value: number };

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'real-water-system';
    scene.add(this.group);

    this.timeUniform = { value: 0 };
    this.levelUniform = { value: 0.0 };
    this.nightUniform = { value: 0.0 };

    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: this.timeUniform,
        uLevel: this.levelUniform,
        uNight: this.nightUniform,
        // Warsaw-Izo Baltic / Vistula pixel-art river palette
        uDeepColor: { value: new THREE.Color(0x184a75) },   // Deep shipping channel
        uDayColor: { value: new THREE.Color(0x236599) },    // Main flowing river body
        uLightColor: { value: new THREE.Color(0x357eb7) },  // Sunlit wave facets
        uFoamColor: { value: new THREE.Color(0x6eb7e8) },   // Soft glistening wave crests
        uSparkleColor: { value: new THREE.Color(0xbde8ff) },// Rare specular sun glints
        uNightColor: { value: new THREE.Color(0x0a1626) }   // Deep midnight Baltic blue
      },
      vertexShader: `
        uniform float uTime;
        uniform float uLevel;
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vec3 pos = position;

          // Water surface base elevation at y = 0.05m
          float floodOffset = (uLevel / 100.0) * 0.35;
          pos.y = 0.05 + floodOffset;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uNight;
        uniform vec3 uDayColor;
        uniform vec3 uDeepColor;
        uniform vec3 uLightColor;
        uniform vec3 uFoamColor;
        uniform vec3 uSparkleColor;
        uniform vec3 uNightColor;

        varying vec2 vUv;
        varying vec3 vWorldPos;

        // 4x4 Ordered Bayer Matrix for Authentic Retro Pixel Art Dithering
        float bayer4(vec2 coord) {
          vec2 b = mod(floor(coord), 4.0);
          int x = int(b.x);
          int y = int(b.y);
          if (y == 0) {
            if (x == 0) return 0.0 / 16.0;
            if (x == 1) return 8.0 / 16.0;
            if (x == 2) return 2.0 / 16.0;
            return 10.0 / 16.0;
          } else if (y == 1) {
            if (x == 0) return 12.0 / 16.0;
            if (x == 1) return 4.0 / 16.0;
            if (x == 2) return 14.0 / 16.0;
            return 6.0 / 16.0;
          } else if (y == 2) {
            if (x == 0) return 3.0 / 16.0;
            if (x == 1) return 11.0 / 16.0;
            if (x == 2) return 1.0 / 16.0;
            return 9.0 / 16.0;
          } else {
            if (x == 0) return 15.0 / 16.0;
            if (x == 1) return 7.0 / 16.0;
            if (x == 2) return 13.0 / 16.0;
            return 5.0 / 16.0;
          }
        }

        void main() {
          // Discrete pixel grid coordinates (1.5m per pixel for crisp isometric pixel art)
          const float pixelSize = 1.5;
          vec2 p = floor(vWorldPos.xz / pixelSize) * pixelSize;
          vec2 pixelCoord = floor(vWorldPos.xz / pixelSize);

          // Discrete 8 FPS frame stepping for retro pixel art water flow
          float t = floor(uTime * 7.5) / 7.5;

          // Flow direction: Neva river flowing West into the Gulf of Finland
          vec2 flow1 = vec2(-1.2, 0.12) * t * 1.1;
          vec2 flow2 = vec2(-0.6, -0.28) * t * 0.8;

          // Octave 1: Major river current wave fronts
          vec2 p1 = (p + flow1) * 0.06;
          float w1 = sin(p1.x * 2.4 + cos(p1.y * 1.8 + p1.x * 0.3));

          // Octave 2: Secondary cross-currents and surface ripples
          vec2 p2 = (p + flow2) * 0.14;
          float w2 = cos(p2.y * 2.2 + sin(p2.x * 1.6 - t * 0.5));

          // Combined wave height field
          float wave = w1 * 0.65 + w2 * 0.35;

          // Apply 4x4 Bayer dither threshold to eliminate harsh banding
          float dither = (bayer4(pixelCoord) - 0.5) * 0.14;
          float ditheredWave = wave + dither;

          // Authentic 5-step pixel-art palette
          vec3 water;
          if (ditheredWave < -0.22) {
            water = uDeepColor;   // Deep navigation channel
          } else if (ditheredWave < 0.28) {
            water = uDayColor;    // Flowing Neva river
          } else if (ditheredWave < 0.68) {
            water = uLightColor;  // Sunlit wave facets
          } else if (ditheredWave < 0.88) {
            water = uFoamColor;   // Crisp white-cyan wave crests
          } else {
            water = uSparkleColor;// Specular sun glints
          }

          // Twilight / White Nights smooth illumination transition
          vec3 nightWater = mix(uNightColor, vec3(0.08, 0.18, 0.30), clamp(wave * 0.5 + 0.5, 0.0, 1.0));
          water = mix(water, nightWater, uNight * 0.90);

          gl_FragColor = vec4(water, 0.98);
        }
      `,
      transparent: true,
      depthWrite: true
    });

    this.buildWaterSystem();
  }

  private async buildWaterSystem() {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    const quayPositions: number[] = [];
    const quayNormals: number[] = [];

    try {
      const res = await fetch('./data/spb_water.json');
      const waterways: OSMWater[] = await res.json();

      // Convert all polygons to local meters
      interface MeterWater {
        id: number;
        name: string;
        pts: { x: number; z: number }[];
      }

      const meterWaters: MeterWater[] = [];
      for (const w of waterways) {
        if (!w.polygon || w.polygon.length < 3) continue;

        const rawPts = w.polygon.map(([lon, lat]) => latLonToMeters(lat, lon));
        const pts: { x: number; z: number }[] = [];
        for (const p of rawPts) {
          if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.z - pts[pts.length - 1].z) > 0.15) {
            pts.push(p);
          }
        }
        if (pts.length < 3) continue;
        meterWaters.push({ id: w.id, name: w.name, pts });
      }

      // Collect all segments and midpoints to identify shared border edges between adjacent relations
      // (e.g. between Great Neva and Neva at Palace Bridge)
      const edgeMidpoints: { x: number; z: number; waterId: number }[] = [];
      for (const mw of meterWaters) {
        const pts = mw.pts;
        const n = pts.length;
        for (let i = 0; i < n - 1; i++) {
          edgeMidpoints.push({
            x: (pts[i].x + pts[i + 1].x) * 0.5,
            z: (pts[i].z + pts[i + 1].z) * 0.5,
            waterId: mw.id
          });
        }
      }

      const isSharedBorderEdge = (midX: number, midZ: number, myId: number): boolean => {
        for (const em of edgeMidpoints) {
          if (em.waterId !== myId) {
            const d = Math.hypot(em.x - midX, em.z - midZ);
            if (d < 4.5) return true; // Shared border inside the river
          }
        }
        return false;
      };

      // 1. Triangulate each real OSM water body
      for (const mw of meterWaters) {
        const pts = mw.pts;
        const flatCoords: number[] = [];
        for (const p of pts) {
          flatCoords.push(p.x, p.z);
        }

        const indices = earcut(flatCoords);
        for (let i = 0; i < indices.length; i += 3) {
          const p0 = pts[indices[i]];
          const p1 = pts[indices[i + 1]];
          const p2 = pts[indices[i + 2]];

          positions.push(
            p0.x, 0.05, p0.z,
            p1.x, 0.05, p1.z,
            p2.x, 0.05, p2.z
          );
          normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
          uvs.push(
            p0.x / 24.0, p0.z / 24.0,
            p1.x / 24.0, p1.z / 24.0,
            p2.x / 24.0, p2.z / 24.0
          );
        }

        // 2. Granite Quays along shorelines (Palace, Admiralty, Universitetskaya, Moika, Fontanka, Griboedov)
        const numPts = pts.length;
        const quayWidth = 1.6;
        const quayTopY = 0.48;
        const quayBottomY = -0.6;

        for (let i = 0; i < numPts - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];

          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.5) continue;

          // Skip shared borders between adjacent water relations so no wall cuts across the river!
          const midX = (p1.x + p2.x) * 0.5;
          const midZ = (p1.z + p2.z) * 0.5;
          if (isSharedBorderEdge(midX, midZ, mw.id)) {
            continue;
          }

          const nx = -dz / len;
          const nz = dx / len;

          const l1x = p1.x;
          const l1z = p1.z;
          const r1x = p1.x + nx * quayWidth;
          const r1z = p1.z + nz * quayWidth;

          const l2x = p2.x;
          const l2z = p2.z;
          const r2x = p2.x + nx * quayWidth;
          const r2z = p2.z + nz * quayWidth;

          // Top horizontal granite coping surface
          quayPositions.push(
            l1x, quayTopY, l1z,
            r1x, quayTopY, r1z,
            r2x, quayTopY, r2z,
            l1x, quayTopY, l1z,
            r2x, quayTopY, r2z,
            l2x, quayTopY, l2z
          );
          quayNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

          // Vertical retaining wall dropping into the water
          quayPositions.push(
            l1x, quayBottomY, l1z,
            l1x, quayTopY, l1z,
            l2x, quayTopY, l2z,
            l1x, quayBottomY, l1z,
            l2x, quayTopY, l2z,
            l2x, quayBottomY, l2z
          );
          quayNormals.push(-nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz);
        }
      }

      console.log(`Successfully loaded ${meterWaters.length} real OSM water bodies with ${positions.length / 9} triangles.`);
    } catch (e) {
      console.warn('Failed to load real water data:', e);
    }

    // 1. Water Surface Mesh
    const riverGeo = new THREE.BufferGeometry();
    riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    riverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    this.riverMesh = new THREE.Mesh(riverGeo, this.material);
    this.riverMesh.renderOrder = 1;
    this.riverMesh.receiveShadow = true;
    this.riverMesh.frustumCulled = false;
    this.group.add(this.riverMesh);

    // 2. Granite Embankments Mesh
    const quayGeo = new THREE.BufferGeometry();
    quayGeo.setAttribute('position', new THREE.Float32BufferAttribute(quayPositions, 3));
    quayGeo.setAttribute('normal', new THREE.Float32BufferAttribute(quayNormals, 3));

    const quayMat = new THREE.MeshLambertMaterial({
      color: PALETTE.graniteEmbankment, // Baltic pinkish-grey Karelian granite
      side: THREE.DoubleSide,
      flatShading: true
    });
    this.quayMesh = new THREE.Mesh(quayGeo, quayMat);
    this.quayMesh.renderOrder = 8;
    this.quayMesh.receiveShadow = true;
    this.quayMesh.frustumCulled = false;
    this.group.add(this.quayMesh);
  }

  public setWaterLevel(levelCm: number) {
    this.waterLevelCm = levelCm;
    this.levelUniform.value = levelCm;
  }

  public cycleFlood() {
    if (this.waterLevelCm === 0) {
      this.setWaterLevel(60);
    } else if (this.waterLevelCm === 60) {
      this.setWaterLevel(160);
    } else {
      this.setWaterLevel(0);
    }
  }

  public update(deltaTime: number, nightFactor: number) {
    this.timeUniform.value += deltaTime;
    this.nightUniform.value = nightFactor;
  }
}
