import * as THREE from 'three';
import { latLonToMeters } from './geo';

export interface OSMTrack {
  id: number;
  name: string;
  service: string;
  bridge: boolean;
  coords: [number, number][]; // [lon, lat]
}

export interface OSMPlatform {
  id: number;
  name: string;
  coords: [number, number][]; // [lon, lat]
}

export interface RailwayData {
  tracks: OSMTrack[];
  platforms: OSMPlatform[];
}

export class RailwaySystem {
  public group: THREE.Group;
  public ballastMesh: THREE.Mesh | null = null;
  public railsMesh: THREE.Mesh | null = null;
  public platformsMesh: THREE.Mesh | null = null;
  public detailsMesh: THREE.Mesh | null = null;
  public trainsGroup: THREE.Group;

  private ballastTex!: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'railway-network';
    scene.add(this.group);

    this.trainsGroup = new THREE.Group();
    this.trainsGroup.name = 'station-trains';
    this.group.add(this.trainsGroup);

    this.createBallastTexture();
    this.loadRailways();
  }

  /**
   * Procedural Ballast & Sleeper Texture (64x64 repeating)
   * High-definition crushed granite stone with creosoted wooden ties and steel plates
   */
  private createBallastTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // 1. Crushed granite ballast gravel base
    ctx.fillStyle = '#3c3732';
    ctx.fillRect(0, 0, 64, 64);

    const ballastGrains = ['#48413a', '#2e2a25', '#524a41', '#342f2a', '#403a33'];
    for (let x = 0; x < 64; x += 2) {
      for (let y = 0; y < 64; y += 2) {
        if (Math.random() > 0.45) {
          ctx.fillStyle = ballastGrains[Math.floor(Math.random() * ballastGrains.length)];
          ctx.fillRect(x, y, 2, 2);
        }
      }
    }

    // 2. Crosswise wooden ties (шпалы) every 16 pixels
    for (let y = 3; y < 64; y += 16) {
      // Tie shadow
      ctx.fillStyle = '#1c1815';
      ctx.fillRect(4, y - 1, 56, 1);

      // Tie wood body
      ctx.fillStyle = '#29241f';
      ctx.fillRect(4, y, 56, 8);

      // Wood grain highlight
      ctx.fillStyle = '#3a342c';
      ctx.fillRect(5, y + 1, 54, 3);

      // Steel tie plates (подкладки под рельсы 1520 мм)
      ctx.fillStyle = '#151311';
      ctx.fillRect(16, y, 6, 8);
      ctx.fillRect(42, y, 6, 8);

      // Fastener spikes (костыли)
      ctx.fillStyle = '#656059';
      ctx.fillRect(17, y + 2, 2, 2);
      ctx.fillRect(19, y + 4, 2, 2);
      ctx.fillRect(43, y + 2, 2, 2);
      ctx.fillRect(45, y + 4, 2, 2);
    }

    this.ballastTex = new THREE.CanvasTexture(canvas);
    this.ballastTex.wrapS = THREE.RepeatWrapping;
    this.ballastTex.wrapT = THREE.RepeatWrapping;
    this.ballastTex.magFilter = THREE.NearestFilter;
    this.ballastTex.minFilter = THREE.NearestFilter;
  }

  private async loadRailways() {
    try {
      const res = await fetch('./data/spb_railways.json');
      const data: RailwayData = await res.json();

      const ballastPositions: number[] = [];
      const ballastNormals: number[] = [];
      const ballastUvs: number[] = [];

      const railsPositions: number[] = [];
      const railsNormals: number[] = [];
      const railsColors: number[] = [];

      const platformPositions: number[] = [];
      const platformNormals: number[] = [];
      const platformColors: number[] = [];

      const detailPositions: number[] = [];
      const detailNormals: number[] = [];
      const detailColors: number[] = [];

      // Steel rail metallic colors
      const steelCol = new THREE.Color(0xdce2e8); // Shining rail top
      const steelSideCol = new THREE.Color(0x8a929b); // Rail web/flange

      // 1. Process All Railway Tracks
      for (const track of data.tracks) {
        if (!track.coords || track.coords.length < 2) continue;

        const pts = track.coords.map(([lon, lat]) => latLonToMeters(lat, lon));
        if (pts.length < 2) continue;

        let accumulatedDist = 0;

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];

          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.2) continue;

          // Unit tangent and normal
          const tx = dx / len;
          const tz = dz / len;
          const nx = -tz;
          const nz = tx;

          const v0 = accumulatedDist / 2.8;
          const v1 = (accumulatedDist + len) / 2.8;
          accumulatedDist += len;

          // A. Ballast Bed Flat Top (Width 3.6m, y = 0.16)
          const halfW = 1.8;
          const b1lX = p1.x - nx * halfW;
          const b1lZ = p1.z - nz * halfW;
          const b1rX = p1.x + nx * halfW;
          const b1rZ = p1.z + nz * halfW;

          const b2lX = p2.x - nx * halfW;
          const b2lZ = p2.z - nz * halfW;
          const b2rX = p2.x + nx * halfW;
          const b2rZ = p2.z + nz * halfW;

          const byTop = 0.16;

          ballastPositions.push(
            b1lX, byTop, b1lZ,
            b1rX, byTop, b1rZ,
            b2rX, byTop, b2rZ,
            b1lX, byTop, b1lZ,
            b2rX, byTop, b2rZ,
            b2lX, byTop, b2lZ
          );
          ballastNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          ballastUvs.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);

          // Ballast Sloped Shoulders (dropping to y = 0.0 at width 4.8m)
          const shoulderW = 2.4;
          const s1lX = p1.x - nx * shoulderW;
          const s1lZ = p1.z - nz * shoulderW;
          const s1rX = p1.x + nx * shoulderW;
          const s1rZ = p1.z + nz * shoulderW;
          const s2lX = p2.x - nx * shoulderW;
          const s2lZ = p2.z - nz * shoulderW;
          const s2rX = p2.x + nx * shoulderW;
          const s2rZ = p2.z + nz * shoulderW;

          // Left slope
          ballastPositions.push(
            s1lX, 0.0, s1lZ,
            b1lX, byTop, b1lZ,
            b2lX, byTop, b2lZ,
            s1lX, 0.0, s1lZ,
            b2lX, byTop, b2lZ,
            s2lX, 0.0, s2lZ
          );
          ballastNormals.push(-nx, 0.4, -nz, -nx, 0.4, -nz, -nx, 0.4, -nz, -nx, 0.4, -nz, -nx, 0.4, -nz, -nx, 0.4, -nz);
          ballastUvs.push(0, v0, 0.2, v0, 0.2, v1, 0, v0, 0.2, v1, 0, v1);

          // Right slope
          ballastPositions.push(
            b1rX, byTop, b1rZ,
            s1rX, 0.0, s1rZ,
            s2rX, 0.0, s2rZ,
            b1rX, byTop, b1rZ,
            s2rX, 0.0, s2rZ,
            b2rX, byTop, b2rZ
          );
          ballastNormals.push(nx, 0.4, nz, nx, 0.4, nz, nx, 0.4, nz, nx, 0.4, nz, nx, 0.4, nz, nx, 0.4, nz);
          ballastUvs.push(0.8, v0, 1.0, v0, 1.0, v1, 0.8, v0, 1.0, v1, 0.8, v1);

          // B. Dual 3D Shining Steel Rails (Standard 1520 mm Russian Broad Gauge: +/- 0.76m)
          const railGauge = 0.76;
          const railHalfW = 0.06; // Rail head width 0.12m
          const railY0 = 0.18;
          const railY1 = 0.32; // Rail height 0.14m

          for (const side of [-1, 1]) {
            const rOffset = side * railGauge;

            const r1X = p1.x + nx * rOffset;
            const r1Z = p1.z + nz * rOffset;
            const r2X = p2.x + nx * rOffset;
            const r2Z = p2.z + nz * rOffset;

            const r1aX = r1X - nx * railHalfW;
            const r1aZ = r1Z - nz * railHalfW;
            const r1bX = r1X + nx * railHalfW;
            const r1bZ = r1Z + nz * railHalfW;

            const r2aX = r2X - nx * railHalfW;
            const r2aZ = r2Z - nz * railHalfW;
            const r2bX = r2X + nx * railHalfW;
            const r2bZ = r2Z + nz * railHalfW;

            // Rail Top Face (gleaming silver metallic)
            railsPositions.push(
              r1aX, railY1, r1aZ,
              r1bX, railY1, r1bZ,
              r2bX, railY1, r2bZ,
              r1aX, railY1, r1aZ,
              r2bX, railY1, r2bZ,
              r2aX, railY1, r2aZ
            );
            railsNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
            for (let k = 0; k < 6; k++) {
              railsColors.push(steelCol.r, steelCol.g, steelCol.b);
            }

            // Rail Left Side
            railsPositions.push(
              r1aX, railY0, r1aZ,
              r1aX, railY1, r1aZ,
              r2aX, railY1, r2aZ,
              r1aX, railY0, r1aZ,
              r2aX, railY1, r2aZ,
              r2aX, railY0, r2aZ
            );
            railsNormals.push(-nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz);
            for (let k = 0; k < 6; k++) {
              railsColors.push(steelSideCol.r, steelSideCol.g, steelSideCol.b);
            }

            // Rail Right Side
            railsPositions.push(
              r1bX, railY1, r1bZ,
              r1bX, railY0, r1bZ,
              r2bX, railY0, r2bZ,
              r1bX, railY1, r1bZ,
              r2bX, railY0, r2bZ,
              r2bX, railY1, r2bZ
            );
            railsNormals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
            for (let k = 0; k < 6; k++) {
              railsColors.push(steelSideCol.r, steelSideCol.g, steelSideCol.b);
            }
          }
        }
      }

      // 2. Build Passenger Platforms at Moscow Station & Terminal Lines
      const platCol = new THREE.Color(0x94a3b8); // Concrete surface
      const yellowEdgeCol = new THREE.Color(0xf59e0b); // Warning tactile stripe
      const platWallCol = new THREE.Color(0x64748b); // Platform retaining wall

      for (const plat of data.platforms) {
        if (!plat.coords || plat.coords.length < 2) continue;

        const pts = plat.coords.map(([lon, lat]) => latLonToMeters(lat, lon));
        if (pts.length < 2) continue;

        const platHalfW = 2.8; // Platform width ~5.6m
        const platY = 1.15; // High platform standard

        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];

          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.2) continue;

          const nx = -dz / len;
          const nz = dx / len;

          const p1lX = p1.x - nx * platHalfW;
          const p1lZ = p1.z - nz * platHalfW;
          const p1rX = p1.x + nx * platHalfW;
          const p1rZ = p1.z + nz * platHalfW;

          const p2lX = p2.x - nx * platHalfW;
          const p2lZ = p2.z - nz * platHalfW;
          const p2rX = p2.x + nx * platHalfW;
          const p2rZ = p2.z + nz * platHalfW;

          // Platform Top Deck
          platformPositions.push(
            p1lX, platY, p1lZ,
            p1rX, platY, p1rZ,
            p2rX, platY, p2rZ,
            p1lX, platY, p1lZ,
            p2rX, platY, p2rZ,
            p2lX, platY, p2lZ
          );
          platformNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
          for (let k = 0; k < 6; k++) {
            platformColors.push(platCol.r, platCol.g, platCol.b);
          }

          // Yellow Safety Warning Edge Stripes (0.35m on both platform edges)
          const edgeW = 0.35;
          for (const s of [-1, 1]) {
            const inSign = s === -1 ? 1 : -1;
            const ex1 = (s === -1 ? p1lX : p1rX);
            const ez1 = (s === -1 ? p1lZ : p1rZ);
            const ex2 = (s === -1 ? p2lX : p2rX);
            const ez2 = (s === -1 ? p2lZ : p2rZ);

            const inX1 = ex1 + nx * inSign * edgeW;
            const inZ1 = ez1 + nz * inSign * edgeW;
            const inX2 = ex2 + nx * inSign * edgeW;
            const inZ2 = ez2 + nz * inSign * edgeW;

            platformPositions.push(
              ex1, platY + 0.01, ez1,
              inX1, platY + 0.01, inZ1,
              inX2, platY + 0.01, inZ2,
              ex1, platY + 0.01, ez1,
              inX2, platY + 0.01, inZ2,
              ex2, platY + 0.01, ez2
            );
            platformNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
            for (let k = 0; k < 6; k++) {
              platformColors.push(yellowEdgeCol.r, yellowEdgeCol.g, yellowEdgeCol.b);
            }
          }

          // Platform Vertical Concrete Retaining Walls (dropping to ground y = 0.0)
          // Left Wall
          platformPositions.push(
            p1lX, 0.0, p1lZ,
            p1lX, platY, p1lZ,
            p2lX, platY, p2lZ,
            p1lX, 0.0, p1lZ,
            p2lX, platY, p2lZ,
            p2lX, 0.0, p2lZ
          );
          platformNormals.push(-nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz);
          for (let k = 0; k < 6; k++) {
            platformColors.push(platWallCol.r, platWallCol.g, platWallCol.b);
          }

          // Right Wall
          platformPositions.push(
            p1rX, platY, p1rZ,
            p1rX, 0.0, p1rZ,
            p2rX, 0.0, p2rZ,
            p1rX, platY, p1rZ,
            p2rX, 0.0, p2rZ,
            p2rX, platY, p2rZ
          );
          platformNormals.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
          for (let k = 0; k < 6; k++) {
            platformColors.push(platWallCol.r, platWallCol.g, platWallCol.b);
          }
        }
      }

      // 3. Build Buffer Stops (Тупиковые упоры) at Moscow Station Terminal Tracks
      const bufferCoords = [
        { x: 2675.2, z: 1242.8 },
        { x: 2700.3, z: 1313.2 },
        { x: 2705.3, z: 1312.4 },
        { x: 2715.8, z: 1310.6 },
        { x: 2719.9, z: 1309.9 },
        { x: 2727.2, z: 1288.8 }
      ];

      for (const buf of bufferCoords) {
        // Concrete buffer block
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          buf.x, 0.75, buf.z,
          2.8, 1.2, 1.8,
          new THREE.Color(0x475569)
        );
        // Red buffer beam
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          buf.x, 0.95, buf.z + 0.9,
          2.6, 0.5, 0.35,
          new THREE.Color(0xdc2626) // Traffic red
        );
        // Twin circular rubber buffers
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          buf.x - 0.75, 0.95, buf.z + 1.1,
          0.35, 0.35, 0.25,
          new THREE.Color(0x18181b)
        );
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          buf.x + 0.75, 0.95, buf.z + 1.1,
          0.35, 0.35, 0.25,
          new THREE.Color(0x18181b)
        );
      }

      // 4. Overhead Catenary Gantries (Опоры контактной сети)
      for (let z = 1350; z <= 2200; z += 55) {
        const xCenter = 2710 + (z - 1350) * 0.16;
        const spanW = 38.0;

        // Left lattice mast
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          xCenter - spanW / 2, 4.8, z,
          0.6, 9.6, 0.6,
          new THREE.Color(0x334155) // Dark steel
        );
        // Right lattice mast
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          xCenter + spanW / 2, 4.8, z,
          0.6, 9.6, 0.6,
          new THREE.Color(0x334155)
        );
        // Horizontal catenary bridge truss
        this.appendBox(
          detailPositions, detailNormals, detailColors,
          xCenter, 9.2, z,
          spanW + 1.2, 0.7, 0.7,
          new THREE.Color(0x475569)
        );
      }

      // Create Ballast Mesh
      const ballastGeo = new THREE.BufferGeometry();
      ballastGeo.setAttribute('position', new THREE.Float32BufferAttribute(ballastPositions, 3));
      ballastGeo.setAttribute('normal', new THREE.Float32BufferAttribute(ballastNormals, 3));
      ballastGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ballastUvs, 2));

      const ballastMat = new THREE.MeshLambertMaterial({
        map: this.ballastTex,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.ballastMesh = new THREE.Mesh(ballastGeo, ballastMat);
      this.ballastMesh.renderOrder = 4;
      this.ballastMesh.receiveShadow = true;
      this.ballastMesh.frustumCulled = false;
      this.group.add(this.ballastMesh);

      // Create Rails Mesh
      const railsGeo = new THREE.BufferGeometry();
      railsGeo.setAttribute('position', new THREE.Float32BufferAttribute(railsPositions, 3));
      railsGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railsNormals, 3));
      railsGeo.setAttribute('color', new THREE.Float32BufferAttribute(railsColors, 3));

      const railsMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.railsMesh = new THREE.Mesh(railsGeo, railsMat);
      this.railsMesh.renderOrder = 6;
      this.railsMesh.receiveShadow = true;
      this.railsMesh.castShadow = true;
      this.railsMesh.frustumCulled = false;
      this.group.add(this.railsMesh);

      // Create Platforms Mesh
      const platGeo = new THREE.BufferGeometry();
      platGeo.setAttribute('position', new THREE.Float32BufferAttribute(platformPositions, 3));
      platGeo.setAttribute('normal', new THREE.Float32BufferAttribute(platformNormals, 3));
      platGeo.setAttribute('color', new THREE.Float32BufferAttribute(platformColors, 3));

      const platMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true
      });
      this.platformsMesh = new THREE.Mesh(platGeo, platMat);
      this.platformsMesh.renderOrder = 5;
      this.platformsMesh.receiveShadow = true;
      this.platformsMesh.castShadow = true;
      this.platformsMesh.frustumCulled = false;
      this.group.add(this.platformsMesh);

      // Create Details Mesh (buffer stops & catenary)
      const detailGeo = new THREE.BufferGeometry();
      detailGeo.setAttribute('position', new THREE.Float32BufferAttribute(detailPositions, 3));
      detailGeo.setAttribute('normal', new THREE.Float32BufferAttribute(detailNormals, 3));
      detailGeo.setAttribute('color', new THREE.Float32BufferAttribute(detailColors, 3));

      const detailMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true
      });
      this.detailsMesh = new THREE.Mesh(detailGeo, detailMat);
      this.detailsMesh.renderOrder = 7;
      this.detailsMesh.castShadow = true;
      this.detailsMesh.receiveShadow = true;
      this.detailsMesh.frustumCulled = false;
      this.group.add(this.detailsMesh);

      // 5. Spawn Detailed Iconic Trains at Moscow Station
      this.spawnStationTrains();

      console.log(`Rendered ${data.tracks.length} real railway tracks, ${data.platforms.length} platforms, buffer stops, catenary gantries, and high-speed trains at Moscow Station.`);
    } catch (err) {
      console.warn('Railway load error:', err);
    }
  }

  /**
   * Spawns detailed 3D pixel-art trains at Moscow Railway Station:
   * 1. High-Speed Train «Сапсан» (Siemens Velaro RUS) on Platform 1
   * 2. Iconic Premier Express «Красная стрела» (The Red Arrow) on Platform 2
   * 3. Regional Aerodynamic Express «Ласточка» (Desiro RUS) on Platform 3
   */
  private spawnStationTrains() {
    // A. High-Speed Train «Сапсан» (Track 595587538 alongside Platform 1)
    const sapsan = this.createSapsanTrain();
    sapsan.position.set(2684, 0.32, 1310);
    sapsan.rotation.y = -Math.atan2(145.7, 25.7) + Math.PI / 2; // Aligned with track slope
    this.trainsGroup.add(sapsan);

    // B. Iconic Express «Красная стрела» (Track 32748908 alongside Platform 2)
    const redArrow = this.createRedArrowTrain();
    redArrow.position.set(2706, 0.32, 1370);
    redArrow.rotation.y = -Math.atan2(73.3, 13.2) + Math.PI / 2;
    this.trainsGroup.add(redArrow);

    // C. Regional Express «Ласточка» (Track 405701440 alongside Platform 3)
    const lastochka = this.createLastochkaTrain();
    lastochka.position.set(2716, 0.32, 1420);
    lastochka.rotation.y = -Math.atan2(73.3, 13.3) + Math.PI / 2;
    this.trainsGroup.add(lastochka);
  }

  /**
   * High-Speed Train «Сапсан» (Siemens Velaro RUS):
   * Aerodynamic streamlined nose cone, crisp white body, navy blue and red speed stripe
   */
  private createSapsanTrain(): THREE.Group {
    const train = new THREE.Group();
    train.name = 'train-sapsan';

    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xf8fafc, flatShading: true });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, flatShading: true }); // Navy speed band
    const redMat = new THREE.MeshLambertMaterial({ color: 0xe11d48, flatShading: true }); // Crimson accent line
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x0f172a, flatShading: true });
    const greyMat = new THREE.MeshLambertMaterial({ color: 0x475569, flatShading: true });

    const carLen = 22.0;
    const carW = 3.2;
    const carH = 3.4;

    for (let c = 0; c < 4; c++) {
      const car = new THREE.Group();
      car.position.z = c * (carLen + 0.6);

      // Chassis & Bogies
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(carW - 0.2, 0.6, carLen), greyMat);
      chassis.position.y = 0.5;
      car.add(chassis);

      // Main White Car Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(carW, carH - 1.0, carLen), whiteMat);
      body.position.y = 1.9;
      body.castShadow = true;
      car.add(body);

      // Navy Blue Window Band
      const band = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.05, 0.9, carLen - 1.0), blueMat);
      band.position.y = 2.2;
      car.add(band);

      // Windows
      const win = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.1, 0.7, carLen - 2.0), glassMat);
      win.position.y = 2.2;
      car.add(win);

      // Red Speed Stripe
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(carW + 0.06, 0.12, carLen), redMat);
      stripe.position.y = 1.6;
      car.add(stripe);

      // Roof & AC Pods
      const roof = new THREE.Mesh(new THREE.BoxGeometry(carW - 0.4, 0.4, carLen), whiteMat);
      roof.position.y = 3.5;
      car.add(roof);

      const acPod = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 4.5), greyMat);
      acPod.position.set(0, 3.8, 0);
      car.add(acPod);

      // Head Aerodynamic Nose Cone on First Car
      if (c === 0) {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.5, 4), whiteMat);
        nose.rotation.x = Math.PI / 2;
        nose.rotation.y = Math.PI / 4;
        nose.position.set(0, 1.8, -carLen / 2 - 2.0);
        nose.scale.set(1.0, 0.9, 1.0);
        nose.castShadow = true;
        car.add(nose);

        // Windshield
        const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.2), glassMat);
        windshield.rotation.x = Math.PI / 5;
        windshield.position.set(0, 2.4, -carLen / 2 - 1.4);
        car.add(windshield);

        // Headlights
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
        for (const lx of [-0.9, 0.9]) {
          const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.2), lightMat);
          light.position.set(lx, 1.4, -carLen / 2 - 3.8);
          car.add(light);
        }
      }

      // Roof Pantograph on Car 2
      if (c === 1) {
        const pantoMat = new THREE.MeshLambertMaterial({ color: 0xef4444, flatShading: true }); // Red pantograph
        const panto = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 2.2), pantoMat);
        panto.position.set(0, 4.3, 3.0);
        car.add(panto);
      }

      train.add(car);
    }

    return train;
  }

  /**
   * Iconic Premier Express «Красная стрела» (The Red Arrow - Train No. 001):
   * Electric Locomotive + Deep ruby crimson passenger cars with golden trim
   */
  private createRedArrowTrain(): THREE.Group {
    const train = new THREE.Group();
    train.name = 'train-red-arrow';

    const redMat = new THREE.MeshLambertMaterial({ color: 0x7f1d1d, flatShading: true }); // Deep Imperial Ruby Red
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b, flatShading: true }); // Golden Trim
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x1e293b, flatShading: true });
    const greyMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });

    // 1. Electric Locomotive (ChS200 / EP2K) at the front
    const loco = new THREE.Group();
    const locoBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 18.0), redMat);
    locoBody.position.y = 2.1;
    locoBody.castShadow = true;
    loco.add(locoBody);

    const locoGoldStripe = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.22, 18.0), goldMat);
    locoGoldStripe.position.y = 2.6;
    loco.add(locoGoldStripe);

    const locoCabGlass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.4), glassMat);
    locoCabGlass.position.set(0, 2.8, -8.4);
    loco.add(locoCabGlass);

    // Locomotive Dual Pantographs
    for (const pz of [-4.5, 4.5]) {
      const panto = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 2.4), redMat);
      panto.position.set(0, 4.4, pz);
      loco.add(panto);
    }
    train.add(loco);

    // 2. Three Ruby-Crimson Passenger Sleeper Cars
    const carLen = 23.0;
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Group();
      car.position.z = 10.0 + c * (carLen + 0.8) + carLen / 2;

      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, carLen), redMat);
      body.position.y = 2.1;
      body.castShadow = true;
      car.add(body);

      // Gold Roofline & Belt Stripes
      const stripeTop = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.18, carLen), goldMat);
      stripeTop.position.y = 3.4;
      car.add(stripeTop);

      const stripeMid = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.18, carLen), goldMat);
      stripeMid.position.y = 1.6;
      car.add(stripeMid);

      // Windows
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.8, carLen - 2.5), glassMat);
      win.position.y = 2.5;
      car.add(win);

      // Rounded grey roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.4, carLen), greyMat);
      roof.position.y = 3.8;
      car.add(roof);

      train.add(car);
    }

    return train;
  }

  /**
   * Regional Express «Ласточка» (Desiro RUS):
   * Streamlined silver-grey and scarlet red passenger train
   */
  private createLastochkaTrain(): THREE.Group {
    const train = new THREE.Group();
    train.name = 'train-lastochka';

    const greyMat = new THREE.MeshLambertMaterial({ color: 0xcfd8dc, flatShading: true });
    const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2430, flatShading: true });

    const carLen = 22.0;
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Group();
      car.position.z = c * (carLen + 0.6);

      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, carLen), greyMat);
      body.position.y = 2.0;
      body.castShadow = true;
      car.add(body);

      // Red lower skirt
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.7, carLen), redMat);
      skirt.position.y = 0.8;
      car.add(skirt);

      // Windows
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.85, carLen - 2.0), glassMat);
      win.position.y = 2.3;
      car.add(win);

      // Streamlined Front Nose on Lead Car
      if (c === 0) {
        const nose = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.6, 3.5), redMat);
        nose.position.set(0, 1.8, -carLen / 2 - 1.2);
        car.add(nose);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), glassMat);
        windshield.rotation.x = Math.PI / 6;
        windshield.position.set(0, 2.4, -carLen / 2 - 1.5);
        car.add(windshield);
      }

      train.add(car);
    }

    return train;
  }

  private appendBox(
    pos: number[],
    norm: number[],
    col: number[],
    cx: number, cy: number, cz: number,
    w: number, h: number, d: number,
    color: THREE.Color
  ) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;

    const x0 = cx - hw, x1 = cx + hw;
    const y0 = cy - hh, y1 = cy + hh;
    const z0 = cz - hd, z1 = cz + hd;

    const addQuad = (
      p1x: number, p1y: number, p1z: number,
      p2x: number, p2y: number, p2z: number,
      p3x: number, p3y: number, p3z: number,
      p4x: number, p4y: number, p4z: number,
      nx: number, ny: number, nz: number
    ) => {
      pos.push(
        p1x, p1y, p1z, p2x, p2y, p2z, p3x, p3y, p3z,
        p1x, p1y, p1z, p3x, p3y, p3z, p4x, p4y, p4z
      );
      norm.push(
        nx, ny, nz, nx, ny, nz, nx, ny, nz,
        nx, ny, nz, nx, ny, nz, nx, ny, nz
      );
      for (let k = 0; k < 6; k++) {
        col.push(color.r, color.g, color.b);
      }
    };

    // Top (+Y)
    addQuad(x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1, 0, 1, 0);
    // Front (+Z)
    addQuad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, 0, 0, 1);
    // Back (-Z)
    addQuad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, 0, 0, -1);
    // Left (-X)
    addQuad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, -1, 0, 0);
    // Right (+X)
    addQuad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, 1, 0, 0);
  }
}
