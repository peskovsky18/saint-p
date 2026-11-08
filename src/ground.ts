import * as THREE from 'three';
import earcut from 'earcut';
import { latLonToMeters } from './geo';
import { PALETTE } from './palette';

export interface OSMRoad {
  id: number;
  name: string;
  type: string;
  lanes: number;
  oneway: boolean;
  coords: [number, number][]; // [lon, lat]
}

export interface OSMPark {
  id: number;
  name: string;
  kind: string;
  polygon: [number, number][]; // [lon, lat]
}

export class GroundSystem {
  public group: THREE.Group;
  public baseMesh: THREE.Mesh | null = null;
  public parkMesh: THREE.Mesh | null = null;
  public gravelPathsMesh: THREE.Mesh | null = null;
  public roadMesh: THREE.Mesh | null = null;
  public bikeLaneMesh: THREE.Mesh | null = null;
  public markingsMesh: THREE.Mesh | null = null;
  public curbsMesh: THREE.Mesh | null = null;
  public palaceSquareMesh: THREE.Mesh | null = null;

  private sidewalkTex!: THREE.CanvasTexture;
  private grassTex!: THREE.CanvasTexture;
  private asphaltTex!: THREE.CanvasTexture;
  private bikeLaneTex!: THREE.CanvasTexture;
  private cobblestoneTex!: THREE.CanvasTexture;
  private gravelTex!: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'vector-pixel-ground';
    scene.add(this.group);

    this.createPixelTextures();
    this.buildBaseGround();
    this.buildPalaceSquareCobblestones();
    this.loadParksAndGreenery();
    this.loadRoadNetwork();
  }

  private createPixelTextures() {
    // 1. High-Density Mini-Pixel Sidewalk Granite Flagstones (128x128)
    // Authentic St. Petersburg imperial granite paving slabs
    const swCanvas = document.createElement('canvas');
    swCanvas.width = 128;
    swCanvas.height = 128;
    const swCtx = swCanvas.getContext('2d')!;

    swCtx.fillStyle = '#b8b2a8';
    swCtx.fillRect(0, 0, 128, 128);

    const slabColors = ['#c5c0b6', '#b5afa5', '#cec9c0', '#a8a298', '#bcb7ad'];
    const slabW = 16;
    const slabH = 8;
    for (let y = 0; y < 128; y += slabH) {
      const rowOffset = (y / slabH) % 2 === 0 ? 0 : 8;
      for (let x = -rowOffset; x < 128; x += slabW) {
        swCtx.fillStyle = slabColors[Math.floor(Math.random() * slabColors.length)];
        swCtx.fillRect(x + 1, y + 1, slabW - 1, slabH - 1);
        // Mortar joint
        swCtx.fillStyle = '#7c766e';
        swCtx.fillRect(x, y, slabW, 1);
        swCtx.fillRect(x, y, 1, slabH);
      }
    }
    // Subtle granite crystalline mineral flecks
    for (let i = 0; i < 180; i++) {
      const fx = Math.floor(Math.random() * 128);
      const fy = Math.floor(Math.random() * 128);
      swCtx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#635e57';
      swCtx.fillRect(fx, fy, 1, 1);
    }
    // Cast-iron storm drain grates (ливневые решётки)
    swCtx.fillStyle = '#3a3835';
    swCtx.fillRect(28, 28, 8, 8);
    swCtx.fillStyle = '#222120';
    swCtx.fillRect(30, 29, 4, 6);

    this.sidewalkTex = new THREE.CanvasTexture(swCanvas);
    this.sidewalkTex.wrapS = THREE.RepeatWrapping;
    this.sidewalkTex.wrapT = THREE.RepeatWrapping;
    this.sidewalkTex.repeat.set(18000 / 3.0, 18000 / 3.0);
    this.sidewalkTex.magFilter = THREE.NearestFilter;
    this.sidewalkTex.minFilter = THREE.NearestFilter;

    // 2. Pixel Grass Texture (64x64 mini-pixel flecks - vibrant sunny European park lawn)
    const gCanvas = document.createElement('canvas');
    gCanvas.width = 64;
    gCanvas.height = 64;
    const gCtx = gCanvas.getContext('2d')!;
    gCtx.fillStyle = '#5c963e'; // Vibrant fresh green matching Warsaw-Izo
    gCtx.fillRect(0, 0, 64, 64);

    const grassColors = ['#528836', '#69a747', '#487a2f', '#75b550', '#5e9940'];
    for (let x = 0; x < 64; x += 2) {
      for (let y = 0; y < 64; y += 2) {
        if (Math.random() > 0.55) {
          gCtx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
          gCtx.fillRect(x, y, 2, 2);
        }
      }
    }
    this.grassTex = new THREE.CanvasTexture(gCanvas);
    this.grassTex.wrapS = THREE.RepeatWrapping;
    this.grassTex.wrapT = THREE.RepeatWrapping;
    this.grassTex.magFilter = THREE.NearestFilter;
    this.grassTex.minFilter = THREE.NearestFilter;

    // 3. Pixel Gravel / Park Promenade Texture (64x64 sandy beige gravel)
    const grCanvas = document.createElement('canvas');
    grCanvas.width = 64;
    grCanvas.height = 64;
    const grCtx = grCanvas.getContext('2d')!;
    grCtx.fillStyle = '#dcd2b8'; // Sand gravel paths in imperial gardens
    grCtx.fillRect(0, 0, 64, 64);

    const gravelColors = ['#d2c6aa', '#e4dbc5', '#c8bca0', '#eee5cf'];
    for (let x = 0; x < 64; x += 2) {
      for (let y = 0; y < 64; y += 2) {
        if (Math.random() > 0.6) {
          grCtx.fillStyle = gravelColors[Math.floor(Math.random() * gravelColors.length)];
          grCtx.fillRect(x, y, 2, 2);
        }
      }
    }
    this.gravelTex = new THREE.CanvasTexture(grCanvas);
    this.gravelTex.wrapS = THREE.RepeatWrapping;
    this.gravelTex.wrapT = THREE.RepeatWrapping;
    this.gravelTex.magFilter = THREE.NearestFilter;
    this.gravelTex.minFilter = THREE.NearestFilter;

    // 4. Pixel Asphalt Texture (64x64 fine grain dark grey)
    const aCanvas = document.createElement('canvas');
    aCanvas.width = 64;
    aCanvas.height = 64;
    const aCtx = aCanvas.getContext('2d')!;
    aCtx.fillStyle = '#363a40';
    aCtx.fillRect(0, 0, 64, 64);

    const asphaltGrains = ['#303339', '#3d4249', '#2c2f34', '#424850'];
    for (let x = 0; x < 64; x += 2) {
      for (let y = 0; y < 64; y += 2) {
        if (Math.random() > 0.65) {
          aCtx.fillStyle = asphaltGrains[Math.floor(Math.random() * asphaltGrains.length)];
          aCtx.fillRect(x, y, 2, 2);
        }
      }
    }
    this.asphaltTex = new THREE.CanvasTexture(aCanvas);
    this.asphaltTex.wrapS = THREE.RepeatWrapping;
    this.asphaltTex.wrapT = THREE.RepeatWrapping;
    this.asphaltTex.magFilter = THREE.NearestFilter;
    this.asphaltTex.minFilter = THREE.NearestFilter;

    // 5. Red Bicycle Asphalt Texture (64x64 red asphalt matching Warsaw-Izo bike paths)
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 64;
    bCanvas.height = 64;
    const bCtx = bCanvas.getContext('2d')!;
    bCtx.fillStyle = '#943834';
    bCtx.fillRect(0, 0, 64, 64);
    const redGrains = ['#88322e', '#9f3f3b', '#7c2c28', '#aa4440'];
    for (let x = 0; x < 64; x += 2) {
      for (let y = 0; y < 64; y += 2) {
        if (Math.random() > 0.6) {
          bCtx.fillStyle = redGrains[Math.floor(Math.random() * redGrains.length)];
          bCtx.fillRect(x, y, 2, 2);
        }
      }
    }
    this.bikeLaneTex = new THREE.CanvasTexture(bCanvas);
    this.bikeLaneTex.wrapS = THREE.RepeatWrapping;
    this.bikeLaneTex.wrapT = THREE.RepeatWrapping;
    this.bikeLaneTex.magFilter = THREE.NearestFilter;
    this.bikeLaneTex.minFilter = THREE.NearestFilter;

    // 6. Palace Square Cobblestone Granite Fan Texture (256x256 Rapakivi Fan Arcs)
    const cCanvas = document.createElement('canvas');
    cCanvas.width = 256;
    cCanvas.height = 256;
    const cCtx = cCanvas.getContext('2d')!;
    cCtx.fillStyle = '#5c6068';
    cCtx.fillRect(0, 0, 256, 256);

    const stoneTones = [
      '#7c433c', // Red Finnish Rapakivi granite
      '#8c4d44',
      '#666a74', // Grey granite
      '#787d88',
      '#525660',
      '#444850'  // Dark basalt setts
    ];

    // Draw concentric cobblestone fan arches
    const pSize = 4;
    for (let y = 0; y < 256; y += pSize) {
      for (let x = 0; x < 256; x += pSize) {
        const fanAngle = Math.atan2((y % 64) - 32, (x % 64) - 32);
        const fanDist = Math.hypot((y % 64) - 32, (x % 64) - 32);
        const idx = Math.floor(Math.abs(Math.sin(fanDist * 0.4 + fanAngle * 3.0) * stoneTones.length)) % stoneTones.length;

        cCtx.fillStyle = stoneTones[idx];
        cCtx.fillRect(x + 1, y + 1, pSize - 1, pSize - 1);
        cCtx.fillStyle = '#3a3d44';
        cCtx.fillRect(x, y, pSize, 1);
        cCtx.fillRect(x, y, 1, pSize);
      }
    }
    this.cobblestoneTex = new THREE.CanvasTexture(cCanvas);
    this.cobblestoneTex.wrapS = THREE.RepeatWrapping;
    this.cobblestoneTex.wrapT = THREE.RepeatWrapping;
    this.cobblestoneTex.magFilter = THREE.NearestFilter;
    this.cobblestoneTex.minFilter = THREE.NearestFilter;
  }

  private buildBaseGround() {
    // Large static 32,000m Urban sidewalk/pavement base plane centered over Central District
    const size = 32000;
    const geo = new THREE.PlaneGeometry(size, size);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshLambertMaterial({
      map: this.sidewalkTex,
      side: THREE.DoubleSide,
      flatShading: true
    });

    this.baseMesh = new THREE.Mesh(geo, mat);
    this.baseMesh.position.set(1800, 0.0, 1000);
    this.baseMesh.renderOrder = 0;
    this.baseMesh.receiveShadow = true;
    this.baseMesh.frustumCulled = false;
    this.group.add(this.baseMesh);
  }

  /**
   * Called every animation frame
   */
  public update(_cameraTarget: THREE.Vector3) {
    // Base mesh is 32km wide and covers the entire city stably without UV swimming
  }

  /**
   * Paved granite cobblestones across Palace Square around Alexander Column
   */
  private buildPalaceSquareCobblestones() {
    const geo = new THREE.CylinderGeometry(155, 155, 0.04, 32);
    const mat = new THREE.MeshLambertMaterial({
      map: this.cobblestoneTex,
      side: THREE.DoubleSide,
      flatShading: true
    });
    this.palaceSquareMesh = new THREE.Mesh(geo, mat);
    this.palaceSquareMesh.position.set(67.86, 0.20, 87.72);
    this.palaceSquareMesh.renderOrder = 4;
    this.palaceSquareMesh.receiveShadow = true;
    this.palaceSquareMesh.frustumCulled = false;
    this.group.add(this.palaceSquareMesh);
  }

  /**
   * Loads and renders 3,542 real parks, gardens, and courtyards from OpenStreetMap
   */
  private async loadParksAndGreenery() {
    try {
      const res = await fetch('./data/spb_parks.json');
      const parks: OSMPark[] = await res.json();

      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];

      // Park walking promenades buffers (Summer Garden allées, Alexander Garden paths)
      const pathPositions: number[] = [];
      const pathNormals: number[] = [];
      const pathUvs: number[] = [];

      for (const park of parks) {
        if (!park.polygon || park.polygon.length < 3) continue;

        const pts = park.polygon.map(([lon, lat]) => latLonToMeters(lat, lon));
        if (pts.length < 3) continue;

        const flatCoords: number[] = [];
        for (const p of pts) {
          flatCoords.push(p.x, p.z);
        }

        const indices = earcut(flatCoords);
        for (let i = 0; i < indices.length; i += 3) {
          const p0 = pts[indices[i]];
          const p1 = pts[indices[i + 1]];
          const p2 = pts[indices[i + 2]];

          // Layer 2: Park Lawns at y = 0.14
          positions.push(
            p0.x, 0.14, p0.z,
            p1.x, 0.14, p1.z,
            p2.x, 0.14, p2.z
          );
          normals.push(
            0, 1, 0,
            0, 1, 0,
            0, 1, 0
          );
          uvs.push(
            p0.x / 8.0, p0.z / 8.0,
            p1.x / 8.0, p1.z / 8.0,
            p2.x / 8.0, p2.z / 8.0
          );
        }
      }

      // 1. Add Alexander Garden Sandy Promenade Paths (running parallel to Admiralty)
      const alexPaths = [
        { x1: -520, z1: 220, x2: -150, z2: 220, w: 4.5 },
        { x1: -450, z1: 180, x2: -200, z2: 180, w: 3.5 },
        { x1: -330, z1: 150, x2: -330, z2: 260, w: 4.0 } // Central axis to Admiralty tower
      ];
      // 2. Add Summer Garden Formal French Allées
      const summerPaths = [
        { x1: 660, z1: -180, x2: 870, z2: -180, w: 4.0 },
        { x1: 660, z1: -50, x2: 870, z2: -50, w: 5.0 }, // Main central allée with fountains
        { x1: 660, z1: 80, x2: 870, z2: 80, w: 4.0 },
        { x1: 720, z1: -210, x2: 720, z2: 110, w: 4.0 },
        { x1: 810, z1: -210, x2: 810, z2: 110, w: 4.0 }
      ];
      // 3. Add Field of Mars diagonal promenade walks
      const marsPaths = [
        { x1: 430, z1: 30, x2: 600, z2: 230, w: 4.5 },
        { x1: 430, z1: 230, x2: 600, z2: 30, w: 4.5 }
      ];

      const allPromenades = [...alexPaths, ...summerPaths, ...marsPaths];
      for (const p of allPromenades) {
        const dx = p.x2 - p.x1;
        const dz = p.z2 - p.z1;
        const len = Math.hypot(dx, dz);
        const nx = (-dz / len) * (p.w / 2);
        const nz = (dx / len) * (p.w / 2);

        // Layer 3: Sandy Promenades at y = 0.18
        pathPositions.push(
          p.x1 + nx, 0.18, p.z1 + nz,
          p.x1 - nx, 0.18, p.z1 - nz,
          p.x2 - nx, 0.18, p.z2 - nz,
          p.x1 + nx, 0.18, p.z1 + nz,
          p.x2 - nx, 0.18, p.z2 - nz,
          p.x2 + nx, 0.18, p.z2 + nz
        );
        pathNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        pathUvs.push(0, 0, 1, 0, 1, len / 6.0, 0, 0, 1, len / 6.0, 0, len / 6.0);
      }

      // Park Grass Mesh
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

      const mat = new THREE.MeshLambertMaterial({
        map: this.grassTex,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        flatShading: true
      });

      this.parkMesh = new THREE.Mesh(geo, mat);
      this.parkMesh.renderOrder = 2;
      this.parkMesh.receiveShadow = true;
      this.parkMesh.frustumCulled = false;
      this.group.add(this.parkMesh);

      // Gravel Paths Mesh
      const pathGeo = new THREE.BufferGeometry();
      pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pathPositions, 3));
      pathGeo.setAttribute('normal', new THREE.Float32BufferAttribute(pathNormals, 3));
      pathGeo.setAttribute('uv', new THREE.Float32BufferAttribute(pathUvs, 2));

      const pathMat = new THREE.MeshLambertMaterial({
        map: this.gravelTex,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.gravelPathsMesh = new THREE.Mesh(pathGeo, pathMat);
      this.gravelPathsMesh.renderOrder = 3;
      this.gravelPathsMesh.receiveShadow = true;
      this.gravelPathsMesh.frustumCulled = false;
      this.group.add(this.gravelPathsMesh);

      console.log(`Rendered ${parks.length} real parks & gardens with sandy promenades.`);
    } catch (e) {
      console.warn('Failed to load parks:', e);
    }
  }

  /**
   * Loads and extrudes 5,302 real roads, avenues, lane stripes, red bike lanes, and curbstones
   */
  private async loadRoadNetwork() {
    try {
      const res = await fetch('./data/spb_roads.json');
      const roads: OSMRoad[] = await res.json();

      const roadPositions: number[] = [];
      const roadNormals: number[] = [];
      const roadUvs: number[] = [];

      const bikePositions: number[] = [];
      const bikeNormals: number[] = [];
      const bikeUvs: number[] = [];

      const markPositions: number[] = [];
      const markNormals: number[] = [];

      const curbPositions: number[] = [];
      const curbNormals: number[] = [];

      for (const r of roads) {
        if (!r.coords || r.coords.length < 2) continue;

        const rName = (r.name || '').toLowerCase();
        // Skip flat ground roads over the Neva River where 3D architectural bridges exist
        if (
          rName.includes('дворцовый мост') ||
          rName.includes('троицкий мост') ||
          rName.includes('благовещенский мост') ||
          rName.includes('биржевой мост')
        ) {
          continue;
        }

        const pts = r.coords.map(([lon, lat]) => latLonToMeters(lat, lon));
        if (pts.length < 2) continue;

        // Road half-width based on classification
        let halfWidth = 5.0;
        const isPrimary = r.type === 'primary';
        if (isPrimary) halfWidth = 9.5; // Nevsky Prospect ~19m wide
        else if (r.type === 'secondary') halfWidth = 7.0;
        else if (r.type === 'tertiary') halfWidth = 5.5;
        else if (r.type === 'residential') halfWidth = 4.0;
        else if (r.type === 'pedestrian') halfWidth = 6.0;
        else halfWidth = 3.5;

        // Build continuous extruded road ribbon
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];

          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.5) continue;

          // Normalized perpendicular normal in XZ
          const nx = -dz / len;
          const nz = dx / len;

          // Left and right road boundary points
          const l1x = p1.x + nx * halfWidth;
          const l1z = p1.z + nz * halfWidth;
          const r1x = p1.x - nx * halfWidth;
          const r1z = p1.z - nz * halfWidth;

          const l2x = p2.x + nx * halfWidth;
          const l2z = p2.z + nz * halfWidth;
          const r2x = p2.x - nx * halfWidth;
          const r2z = p2.z - nz * halfWidth;

          // Layer 5: Road surface quad at y = 0.24
          roadPositions.push(
            l1x, 0.24, l1z,
            r1x, 0.24, r1z,
            r2x, 0.24, r2z,
            l1x, 0.24, l1z,
            r2x, 0.24, r2z,
            l2x, 0.24, l2z
          );
          roadNormals.push(
            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0
          );
          roadUvs.push(
            0, 0, 1, 0, 1, len / 8.0,
            0, 0, 1, len / 8.0, 0, len / 8.0
          );

          // Layer 6: Red Bicycle Lane (Warsaw-Izo signature) along primary avenues (Nevsky, Dvortsovaya Emb.)
          if (isPrimary && len > 4) {
            const bikeW = 1.6;
            // Left bike lane
            const bl1x = l1x - nx * bikeW;
            const bl1z = l1z - nz * bikeW;
            const bl2x = l2x - nx * bikeW;
            const bl2z = l2z - nz * bikeW;

            bikePositions.push(
              l1x, 0.25, l1z,
              bl1x, 0.25, bl1z,
              bl2x, 0.25, bl2z,
              l1x, 0.25, l1z,
              bl2x, 0.25, bl2z,
              l2x, 0.25, l2z
            );
            bikeNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
            bikeUvs.push(0, 0, 1, 0, 1, len / 4.0, 0, 0, 1, len / 4.0, 0, len / 4.0);

            // White separator line between bike path and traffic lane
            const lineW = 0.14;
            markPositions.push(
              bl1x, 0.29, bl1z,
              bl1x - nx * lineW, 0.29, bl1z - nz * lineW,
              bl2x - nx * lineW, 0.29, bl2z - nz * lineW,
              bl1x, 0.29, bl1z,
              bl2x - nx * lineW, 0.29, bl2z - nz * lineW,
              bl2x, 0.29, bl2z
            );
            markNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          }

          // Layer 8: Curbstones bordering each side of the road (width 0.45m, height 0.38m)
          const curbW = 0.45;
          const curbY = 0.38;
          // Left curb
          curbPositions.push(
            l1x, curbY, l1z,
            l1x + nx * curbW, curbY, l1z + nz * curbW,
            l2x + nx * curbW, curbY, l2z + nz * curbW,
            l1x, curbY, l1z,
            l2x + nx * curbW, curbY, l2z + nz * curbW,
            l2x, curbY, l2z
          );
          curbNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

          // Right curb
          curbPositions.push(
            r1x - nx * curbW, curbY, r1z - nz * curbW,
            r1x, curbY, r1z,
            r2x, curbY, r2z,
            r1x - nx * curbW, curbY, r1z - nz * curbW,
            r2x, curbY, r2z,
            r2x - nx * curbW, curbY, r2z - nz * curbW
          );
          curbNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

          // White center lane marking (dashed line every 6 meters on major roads)
          if ((r.type === 'primary' || r.type === 'secondary') && len > 5) {
            const markW = 0.22;
            const dashCount = Math.floor(len / 6.0);
            for (let d = 0; d < dashCount; d++) {
              const t1 = (d * 6.0 + 1.0) / len;
              const t2 = Math.min(1.0, (d * 6.0 + 4.5) / len);

              const mx1 = p1.x + dx * t1;
              const mz1 = p1.z + dz * t1;
              const mx2 = p1.x + dx * t2;
              const mz2 = p1.z + dz * t2;

              markPositions.push(
                mx1 + nx * markW, 0.29, mz1 + nz * markW,
                mx1 - nx * markW, 0.29, mz1 - nz * markW,
                mx2 - nx * markW, 0.29, mz2 - nz * markW,
                mx1 + nx * markW, 0.29, mz1 + nz * markW,
                mx2 - nx * markW, 0.29, mz2 - nz * markW,
                mx2 + nx * markW, 0.29, mz2 + nz * markW
              );
              markNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
            }
          }
        }
      }

      // Zebra Pedestrian Crossings (Пешеходные переходы) matching Warsaw-Izo
      const crosswalks = [
        { cx: -45, cz: 40, angle: 0.35, width: 14, stripes: 9 },  // Dvortsovy Proyezd -> Palace Sq
        { cx: -60, cz: -55, angle: 0.1, width: 16, stripes: 10 }, // Palace Embankment near Hermitage
        { cx: -140, cz: 190, angle: 0.8, width: 18, stripes: 11 }, // Nevsky & Admiralteysky start
        { cx: -180, cz: 245, angle: 0.6, width: 16, stripes: 10 }, // Gorokhovaya & Admiralteysky
        { cx: 210, cz: 410, angle: 0.75, width: 18, stripes: 11 }, // Nevsky near Moika (Stroganov)
        { cx: -320, cz: 210, angle: 0.2, width: 15, stripes: 9 }   // Decembrists Sq near Admiralty
      ];

      for (const cw of crosswalks) {
        const stripeW = 0.55;
        const stripeLen = 4.2;
        const step = cw.width / cw.stripes;
        const cosA = Math.cos(cw.angle);
        const sinA = Math.sin(cw.angle);
        const perpX = -sinA;
        const perpZ = cosA;

        for (let s = 0; s < cw.stripes; s++) {
          const offset = (s - cw.stripes / 2) * step;
          const sx = cw.cx + perpX * offset;
          const sz = cw.cz + perpZ * offset;

          const p1x = sx - cosA * (stripeLen / 2) - perpX * (stripeW / 2);
          const p1z = sz - sinA * (stripeLen / 2) - perpZ * (stripeW / 2);
          const p2x = sx - cosA * (stripeLen / 2) + perpX * (stripeW / 2);
          const p2z = sz - sinA * (stripeLen / 2) + perpZ * (stripeW / 2);
          const p3x = sx + cosA * (stripeLen / 2) + perpX * (stripeW / 2);
          const p3z = sz + sinA * (stripeLen / 2) + perpZ * (stripeW / 2);
          const p4x = sx + cosA * (stripeLen / 2) - perpX * (stripeW / 2);
          const p4z = sz + sinA * (stripeLen / 2) - perpZ * (stripeW / 2);

          // Layer 7: Zebra markings at y = 0.29
          markPositions.push(
            p1x, 0.29, p1z,  p2x, 0.29, p2z,  p3x, 0.29, p3z,
            p1x, 0.29, p1z,  p3x, 0.29, p3z,  p4x, 0.29, p4z
          );
          markNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
      }

      // Painted Directional White Turn Arrows before major intersections
      const arrows = [
        { ax: -42, az: 65, dir: 'straight', angle: 0.35 },
        { ax: -48, az: 62, dir: 'right', angle: 0.35 },
        { ax: -130, az: 205, dir: 'straight', angle: 0.8 },
        { ax: -136, az: 200, dir: 'left', angle: 0.8 },
        { ax: 195, az: 425, dir: 'straight', angle: 0.75 }
      ];

      for (const arr of arrows) {
        const cosA = Math.cos(arr.angle);
        const sinA = Math.sin(arr.angle);
        const perpX = -sinA;
        const perpZ = cosA;

        // Shaft of arrow (2.5m x 0.35m)
        const sLen = 2.4;
        const sW = 0.35;
        const p1x = arr.ax - cosA * (sLen / 2) - perpX * (sW / 2);
        const p1z = arr.az - sinA * (sLen / 2) - perpZ * (sW / 2);
        const p2x = arr.ax - cosA * (sLen / 2) + perpX * (sW / 2);
        const p2z = arr.az - sinA * (sLen / 2) + perpZ * (sW / 2);
        const p3x = arr.ax + cosA * (sLen / 2) + perpX * (sW / 2);
        const p3z = arr.az + sinA * (sLen / 2) + perpZ * (sW / 2);
        const p4x = arr.ax + cosA * (sLen / 2) - perpX * (sW / 2);
        const p4z = arr.az + sinA * (sLen / 2) - perpZ * (sW / 2);

        markPositions.push(
          p1x, 0.29, p1z, p2x, 0.29, p2z, p3x, 0.29, p3z,
          p1x, 0.29, p1z, p3x, 0.29, p3z, p4x, 0.29, p4z
        );
        markNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

        // Arrowhead triangle
        const headTipX = arr.ax + cosA * (sLen / 2 + 1.2);
        const headTipZ = arr.az + sinA * (sLen / 2 + 1.2);
        const headL_X = arr.ax + cosA * (sLen / 2) + perpX * 0.9;
        const headL_Z = arr.az + sinA * (sLen / 2) + perpZ * 0.9;
        const headR_X = arr.ax + cosA * (sLen / 2) - perpX * 0.9;
        const headR_Z = arr.az + sinA * (sLen / 2) - perpZ * 0.9;

        markPositions.push(
          headL_X, 0.29, headL_Z,
          headTipX, 0.29, headTipZ,
          headR_X, 0.29, headR_Z
        );
        markNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      }

      // 1. Road Surface Mesh
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
      roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));

      const roadMat = new THREE.MeshLambertMaterial({
        map: this.asphaltTex,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
      this.roadMesh.renderOrder = 5;
      this.roadMesh.receiveShadow = true;
      this.roadMesh.frustumCulled = false;
      this.group.add(this.roadMesh);

      // 2. Red Bicycle Lanes Mesh
      if (bikePositions.length > 0) {
        const bikeGeo = new THREE.BufferGeometry();
        bikeGeo.setAttribute('position', new THREE.Float32BufferAttribute(bikePositions, 3));
        bikeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(bikeNormals, 3));
        bikeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(bikeUvs, 2));

        const bikeMat = new THREE.MeshLambertMaterial({
          map: this.bikeLaneTex,
          side: THREE.DoubleSide,
          flatShading: true
        });
        this.bikeLaneMesh = new THREE.Mesh(bikeGeo, bikeMat);
        this.bikeLaneMesh.renderOrder = 6;
        this.bikeLaneMesh.receiveShadow = true;
        this.bikeLaneMesh.frustumCulled = false;
        this.group.add(this.bikeLaneMesh);
      }

      // 3. Road Markings Mesh (Crisp White Painted Lines, Zebras & Arrows)
      const markGeo = new THREE.BufferGeometry();
      markGeo.setAttribute('position', new THREE.Float32BufferAttribute(markPositions, 3));
      markGeo.setAttribute('normal', new THREE.Float32BufferAttribute(markNormals, 3));
      const markMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.markingsMesh = new THREE.Mesh(markGeo, markMat);
      this.markingsMesh.renderOrder = 7;
      this.markingsMesh.frustumCulled = false;
      this.group.add(this.markingsMesh);

      // 4. Curbstones Mesh (Light Granite Curbs)
      const curbGeo = new THREE.BufferGeometry();
      curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbPositions, 3));
      curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
      const curbMat = new THREE.MeshLambertMaterial({
        color: 0x8a929e,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.curbsMesh = new THREE.Mesh(curbGeo, curbMat);
      this.curbsMesh.renderOrder = 8;
      this.curbsMesh.receiveShadow = true;
      this.curbsMesh.frustumCulled = false;
      this.group.add(this.curbsMesh);

      console.log(`Rendered ${roads.length} real streets with asphalt, red bike lanes, markings, and granite curbs.`);
    } catch (e) {
      console.warn('Failed to load roads:', e);
    }
  }
}
