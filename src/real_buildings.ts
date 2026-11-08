import * as THREE from 'three';
import earcut from 'earcut';
import { latLonToMeters } from './geo';
import { PALETTE } from './palette';

export interface OSMBuilding {
  id: number;
  name: string;
  levels: number;
  color: string;
  roof_color: string;
  roof_shape: string;
  polygon: [number, number][]; // [lon, lat]
}

interface WallBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
}

export class RealBuildingsSystem {
  public group: THREE.Group;
  public totalBuildings: number = 0;
  public roofMesh: THREE.Mesh | null = null;
  public wallMesh: THREE.Mesh | null = null;
  public parapetMesh: THREE.Mesh | null = null;
  public rooftopDetailsMesh: THREE.Mesh | null = null;
  public edgesMesh: THREE.LineSegments | null = null;
  public landmarkMeshes: Map<string, THREE.Mesh> = new Map();

  private wallMat!: THREE.MeshLambertMaterial;
  private roofMat!: THREE.MeshLambertMaterial;
  private landmarkMaterials: Record<string, THREE.MeshLambertMaterial> = {};
  private facadeTex!: THREE.CanvasTexture;
  private roofTex!: THREE.CanvasTexture;
  private emissiveTex!: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'real-osm-buildings';
    scene.add(this.group);

    this.createMiniPixelTextures();
    this.initLandmarkMaterials();
    this.loadRealBuildings();
  }

  /**
   * Loads real photo textures for iconic St. Petersburg landmarks with crisp mini-pixel nearest filtering
   */
  private initLandmarkMaterials() {
    const texLoader = new THREE.TextureLoader();

    const landmarkDefs: Record<string, { file: string; uScale: number; vScale: number }> = {
      hermitage: { file: '/textures/landmarks/hermitage.jpg', uScale: 6.0, vScale: 23.5 },
      general_staff: { file: '/textures/landmarks/general_staff.jpg', uScale: 6.5, vScale: 24.0 },
      admiralty: { file: '/textures/landmarks/admiralty.jpg', uScale: 8.5, vScale: 18.0 },
      isaac: { file: '/textures/landmarks/isaac.jpg', uScale: 7.5, vScale: 28.0 },
      spas: { file: '/textures/landmarks/spas.jpg', uScale: 5.5, vScale: 26.0 },
      exchange: { file: '/textures/landmarks/exchange.jpg', uScale: 6.5, vScale: 20.0 },
      peter_paul: { file: '/textures/landmarks/peter_paul.jpg', uScale: 6.5, vScale: 22.0 },
      kazan: { file: '/textures/landmarks/kazan.jpg', uScale: 6.5, vScale: 26.0 }
    };

    for (const [key, def] of Object.entries(landmarkDefs)) {
      const tex = texLoader.load(def.file);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;

      this.landmarkMaterials[key] = new THREE.MeshLambertMaterial({
        map: tex,
        emissiveMap: this.emissiveTex,
        emissive: new THREE.Color(0x000000),
        side: THREE.DoubleSide,
        flatShading: true
      });
    }
  }

  /**
   * Creates high-density mini-pixel facade and tin roof textures with authentic architectural details
   */
  private createMiniPixelTextures() {
    // 1. High-Density Mini-Pixel Facade Texture (512x512)
    const fw = 512;
    const fh = 512;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = fw;
    diffCanvas.height = fh;
    const ctx = diffCanvas.getContext('2d')!;

    // Base plaster tone (neutral warm off-white so vertex colors tint accurately)
    ctx.fillStyle = '#f2ede4';
    ctx.fillRect(0, 0, fw, fh);

    // Ground floor classical granite rustication (рустовка цокольного этажа)
    ctx.fillStyle = '#ded7cc';
    ctx.fillRect(0, fh * 0.74, fw, fh * 0.26);
    ctx.strokeStyle = '#baa894';
    ctx.lineWidth = 2;
    for (let y = fh * 0.74; y < fh; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fw, y);
      ctx.stroke();
    }

    // Floor dividing stone cornices with shadow lips (междуэтажные карнизы)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, fh * 0.38, fw, 5);
    ctx.fillRect(0, fh * 0.72, fw, 7);
    ctx.fillStyle = '#baa894';
    ctx.fillRect(0, fh * 0.38 + 5, fw, 2);
    ctx.fillRect(0, fh * 0.72 + 7, fw, 2);

    // Roofline entablature and dentils (карниз с дентикулами)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, fw, 12);
    ctx.fillStyle = '#b09e8c';
    ctx.fillRect(0, 12, fw, 2);
    for (let x = 4; x < fw; x += 14) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 14, 6, 4);
      ctx.fillStyle = '#9e8c7c';
      ctx.fillRect(x, 18, 6, 1);
    }

    // Windows (4 bays per repeating horizontal unit for fine mini-pixel density)
    const bays = [fw * 0.125, fw * 0.375, fw * 0.625, fw * 0.875];
    const floorsY = [fh * 0.18, fh * 0.52, fh * 0.84];
    const winW = 26;
    const winH = 38;

    for (const bx of bays) {
      for (let fi = 0; fi < floorsY.length; fi++) {
        const by = floorsY[fi];
        const wx = bx - winW / 2;
        const wy = by - winH / 2;

        // White stone architrave molding (наличник)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 3, wy - 4, winW + 6, winH + 8);

        // Classical pediment (сандрик) above upper-floor windows
        if (fi === 0) {
          ctx.beginPath();
          ctx.moveTo(wx - 4, wy - 4);
          ctx.lineTo(bx, wy - 12);
          ctx.lineTo(wx + winW + 4, wy - 4);
          ctx.closePath();
          ctx.fill();
        }

        // Glazing frame
        ctx.fillStyle = '#1c2633';
        ctx.fillRect(wx, wy, winW, winH);

        // Individual window panes with white cross-bars (шпросы)
        const paneW = (winW - 5) / 2;
        const paneH = (winH - 6) / 3;
        for (let px = 0; px < 2; px++) {
          for (let py = 0; py < 3; py++) {
            ctx.fillStyle = '#141e2a'; // deep reflective glass
            ctx.fillRect(wx + 2 + px * (paneW + 2), wy + 2 + py * (paneH + 2), paneW, paneH);
            // Subtle glass shine highlight
            ctx.fillStyle = '#2c3e52';
            ctx.fillRect(wx + 2 + px * (paneW + 2), wy + 2 + py * (paneH + 2), paneW * 0.6, 1);
          }
        }

        // Protruding stone window sill (подоконник)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 4, wy + winH, winW + 8, 3);
        ctx.fillStyle = '#9e8c7c';
        ctx.fillRect(wx - 4, wy + winH + 3, winW + 8, 1);

        // Wrought-iron balcony railings on piano nobile (2nd floor, fi === 1)
        if (fi === 1) {
          ctx.fillStyle = '#22262c';
          ctx.fillRect(wx - 4, wy + winH - 6, winW + 8, 8);
          // Vertical ornamental balusters
          ctx.fillStyle = '#111418';
          for (let bx = wx - 3; bx <= wx + winW + 3; bx += 3) {
            ctx.fillRect(bx, wy + winH - 6, 1, 8);
          }
          ctx.fillStyle = '#555d6b';
          ctx.fillRect(wx - 4, wy + winH - 6, winW + 8, 1); // Cast-iron handrail highlight
        }
      }
    }

    this.facadeTex = new THREE.CanvasTexture(diffCanvas);
    this.facadeTex.wrapS = THREE.RepeatWrapping;
    this.facadeTex.wrapT = THREE.RepeatWrapping;
    this.facadeTex.magFilter = THREE.NearestFilter;
    this.facadeTex.minFilter = THREE.NearestFilter;

    // 2. High-Contrast Procedural Folded Tin Roof Texture (фальцевая кровля Петербурга, 128x128)
    const rw = 128;
    const rh = 128;
    const roofCanvas = document.createElement('canvas');
    roofCanvas.width = rw;
    roofCanvas.height = rh;
    const rCtx = roofCanvas.getContext('2d')!;

    // Clean neutral base for vertex color tinting
    rCtx.fillStyle = '#f0f3f6';
    rCtx.fillRect(0, 0, rw, rh);

    // Subtle metal sheet surface noise
    for (let py = 0; py < rh; py += 4) {
      for (let px = 0; px < rw; px += 4) {
        if ((px + py) % 8 === 0) {
          rCtx.fillStyle = '#e4e9ee';
          rCtx.fillRect(px, py, 4, 4);
        }
      }
    }

    // Standing metal seams (стоячие фальцы) every 16 pixels with crisp light-edge & dark-lip shading
    for (let x = 0; x < rw; x += 16) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(x, 0, 1, rh);
      rCtx.fillStyle = '#94a2b0';
      rCtx.fillRect(x + 1, 0, 1, rh);
      rCtx.fillStyle = '#687786';
      rCtx.fillRect(x + 2, 0, 1, rh);
    }

    // Horizontal sheet cross-joints (лежачие фальцы) every 32 pixels
    for (let y = 0; y < rh; y += 32) {
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(0, y, rw, 1);
      rCtx.fillStyle = '#8291a0';
      rCtx.fillRect(0, y + 1, rw, 1);
    }

    this.roofTex = new THREE.CanvasTexture(roofCanvas);
    this.roofTex.wrapS = THREE.RepeatWrapping;
    this.roofTex.wrapT = THREE.RepeatWrapping;
    this.roofTex.magFilter = THREE.NearestFilter;
    this.roofTex.minFilter = THREE.NearestFilter;

    // 3. Night Window Emissive Glow Map (512x512)
    const emisCanvas = document.createElement('canvas');
    emisCanvas.width = fw;
    emisCanvas.height = fh;
    const eCtx = emisCanvas.getContext('2d')!;

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, fw, fh);

    const warmWindowColors = ['#ffe89c', '#ffd068', '#ffa742', '#fff0b8', '#ffba66'];
    for (let bi = 0; bi < bays.length; bi++) {
      const bx = bays[bi];
      for (let fi = 0; fi < floorsY.length; fi++) {
        const seed = Math.sin(bi * 93.1 + fi * 41.7) * 0.5 + 0.5;
        // ~45% of windows illuminated at night
        if (seed > 0.32) {
          const by = floorsY[fi];
          const wx = bx - winW / 2;
          const wy = by - winH / 2;
          const col = warmWindowColors[Math.floor(seed * 11) % warmWindowColors.length];
          eCtx.fillStyle = col;
          eCtx.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);

          // Dark interior crossbar silhouettes (шпросы)
          eCtx.fillStyle = 'rgba(20, 24, 30, 0.45)';
          eCtx.fillRect(wx + 2, wy + winH / 2, winW - 4, 1.5);
          eCtx.fillRect(wx + winW / 2, wy + 2, 1.5, winH - 4);
        }
      }
    }

    this.emissiveTex = new THREE.CanvasTexture(emisCanvas);
    this.emissiveTex.wrapS = THREE.RepeatWrapping;
    this.emissiveTex.wrapT = THREE.RepeatWrapping;
    this.emissiveTex.magFilter = THREE.NearestFilter;
  }

  private parseColor(colStr: string, defaultHex: number): THREE.Color {
    if (!colStr) return new THREE.Color(defaultHex);
    const s = colStr.toLowerCase().trim();
    if (s === 'rose' || s === 'pink' || s === 'розовый') return new THREE.Color(0xd98d84);
    if (s === 'ochre' || s === 'охра' || s === 'желтый' || s === 'yellow') return new THREE.Color(PALETTE.spbOchre);
    if (s === 'grey' || s === 'gray' || s === 'серый' || s === 'darkgrey' || s === 'lightgrey') return new THREE.Color(0xa0a8b0);
    if (s === 'green' || s === 'зеленый') return new THREE.Color(PALETTE.spbPastelGreen);
    if (s === 'red' || s === 'красный') return new THREE.Color(PALETTE.roofTinRed);
    if (s === 'brown' || s === 'коричневый') return new THREE.Color(0x7a5243);
    if (s.startsWith('#') || THREE.Color.NAMES[s as keyof typeof THREE.Color.NAMES]) {
      return new THREE.Color(s);
    }
    return new THREE.Color(defaultHex);
  }

  /**
   * Computes inward ridge polygon (P_ridge) for 3D pitched & mansard roofs
   */
  private computeRoofRidgePolygon(
    pts: { x: number; z: number }[],
    insetDist: number,
    cx: number,
    cz: number
  ): { x: number; z: number }[] {
    const n = pts.length;
    if (n < 3) return pts;

    // Calculate signed area to determine winding order (CCW vs CW)
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
    }
    const isCCW = area > 0;

    const ridgePts: { x: number; z: number }[] = [];

    for (let i = 0; i < n; i++) {
      const pPrev = pts[(i - 1 + n) % n];
      const pCurr = pts[i];
      const pNext = pts[(i + 1) % n];

      // Edge 1: prev -> curr
      const e1x = pCurr.x - pPrev.x;
      const e1z = pCurr.z - pPrev.z;
      const l1 = Math.hypot(e1x, e1z) || 1.0;
      const n1x = isCCW ? -e1z / l1 : e1z / l1;
      const n1z = isCCW ? e1x / l1 : -e1x / l1;

      // Edge 2: curr -> next
      const e2x = pNext.x - pCurr.x;
      const e2z = pNext.z - pCurr.z;
      const l2 = Math.hypot(e2x, e2z) || 1.0;
      const n2x = isCCW ? -e2z / l2 : e2z / l2;
      const n2z = isCCW ? e2x / l2 : -e2x / l2;

      // Inward bisector normal
      let bx = n1x + n2x;
      let bz = n1z + n2z;
      const bLen = Math.hypot(bx, bz);
      if (bLen < 0.001) {
        bx = n1x;
        bz = n1z;
      } else {
        bx /= bLen;
        bz /= bLen;
      }

      // Miter scale clamped to prevent sharp spikes
      const dot = n1x * bx + n1z * bz;
      const miterScale = Math.min(2.2, 1.0 / Math.max(0.35, dot));

      // Limit inward distance so vertices don't cross centroid
      const distToCenter = Math.hypot(cx - pCurr.x, cz - pCurr.z);
      const actualDist = Math.min(insetDist * miterScale, distToCenter * 0.65);

      ridgePts.push({
        x: pCurr.x + bx * actualDist,
        z: pCurr.z + bz * actualDist
      });
    }

    return ridgePts;
  }

  /**
   * Authentic St. Petersburg Folded Tin / Zinc / Copper Roof Palette (Rich Historical Variety)
   */
  private getRandomRoofColor(id: number): THREE.Color {
    const roofPal = [
      PALETTE.roofZincGrey,    // Steel Zinc Grey (светлая стальная оцинковка) ~ 25%
      PALETTE.roofLightZinc,   // Clean Light Zinc (светло-серебристый) ~ 20%
      PALETTE.roofCopperGreen, // Patinated Malachite Copper (малахитово-зелёный) ~ 18%
      PALETTE.roofSlateGrey,   // Nordic Slate / Dark Zinc (благородный графит) ~ 15%
      PALETTE.roofTinRed,      // Warm Minium Red (кирпично-красный сурик) ~ 15%
      PALETTE.roofWarmSand     // Weathered Ochre Sand Tin (охристая жесть) ~ 7%
    ];
    return new THREE.Color(roofPal[Math.abs(id * 19) % roofPal.length]);
  }

  /**
   * Authentic Imperial Saint Petersburg Facade Palette (Strict Historic Proportions)
   */
  private getRandomWallColor(id: number): THREE.Color {
    const wallPal = [
      PALETTE.spbOchre,        // Classic Petersburg Warm Ochre (~40%)
      PALETTE.spbOchre,
      PALETTE.spbPastelGreen,  // Pastel Celadon Green (~20%)
      PALETTE.spbPastelBlue,   // Smolny & Vorontsov Sky Blue (~15%)
      PALETTE.spbTerracotta,   // Classic Imperial Terracotta (~15%)
      PALETTE.empireYellow,    // Carlo Rossi Empire Ochre
      PALETTE.spbWhiteStone    // Neoclassical White Stone plaster (~10%)
    ];
    return new THREE.Color(wallPal[Math.abs(id) % wallPal.length]);
  }

  private getLandmarkType(b: OSMBuilding): string | null {
    const n = (b.name || '').toLowerCase();
    const id = b.id;

    if (n.includes('зимний дворец') || n.includes('эрмитаж') || id === 69424 || id === 270634 || id === 1067948 || id === 1202918) {
      return 'hermitage';
    }
    if (n.includes('главный штаб') || n.includes('арка главного штаба') || id === 1453436 || id === 309796655 || id === 100016301) {
      return 'general_staff';
    }
    if (n.includes('адмиралтейство') || id === 2612859) {
      return 'admiralty';
    }
    if (n.includes('исаакиевский') || id === 3229838) {
      return 'isaac';
    }
    if (n.includes('кров') || n.includes('воскресения христова') || id === 28966446) {
      return 'spas';
    }
    if (n.includes('биржа') || id === 3084726 || id === 19826133) {
      return 'exchange';
    }
    if (n.includes('петропавл') || id === 227969) {
      return 'peter_paul';
    }
    if (n.includes('казанск') || id === 11763697) {
      return 'kazan';
    }
    if (n.includes('троицкий собор') || id === 28808840) {
      return 'lavra';
    }
    return null;
  }

  private async loadRealBuildings() {
    try {
      const res = await fetch('./data/spb_buildings.json');
      const buildings: OSMBuilding[] = await res.json();
      this.totalBuildings = buildings.length;

      // Standard residential walls
      const standardWalls: WallBuffers = {
        positions: [],
        normals: [],
        uvs: [],
        colors: []
      };

      // Dedicated buffers for each landmark
      const landmarkBuffers: Record<string, WallBuffers> = {
        hermitage: { positions: [], normals: [], uvs: [], colors: [] },
        general_staff: { positions: [], normals: [], uvs: [], colors: [] },
        admiralty: { positions: [], normals: [], uvs: [], colors: [] },
        isaac: { positions: [], normals: [], uvs: [], colors: [] },
        spas: { positions: [], normals: [], uvs: [], colors: [] },
        exchange: { positions: [], normals: [], uvs: [], colors: [] },
        peter_paul: { positions: [], normals: [], uvs: [], colors: [] },
        kazan: { positions: [], normals: [], uvs: [], colors: [] }
      };

      const roofPositions: number[] = [];
      const roofNormals: number[] = [];
      const roofUvs: number[] = [];
      const roofColors: number[] = [];

      const parapetPositions: number[] = [];
      const parapetNormals: number[] = [];
      const parapetColors: number[] = [];

      const detailPositions: number[] = [];
      const detailNormals: number[] = [];
      const detailColors: number[] = [];

      const edgePositions: number[] = [];

      for (const b of buildings) {
        if (!b.polygon || b.polygon.length < 3) continue;

        const pts = b.polygon.map(([lon, lat]) => latLonToMeters(lat, lon));
        if (
          pts.length > 3 &&
          Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z) < 0.2
        ) {
          pts.pop();
        }

        if (pts.length < 3) continue;

        const lmType = this.getLandmarkType(b);

        // Strict historical heights
        let height = b.levels ? b.levels * 3.4 : 16.0;
        if (lmType === 'hermitage') {
          height = 23.5;
        } else if (lmType === 'general_staff') {
          height = 24.0;
        } else if (lmType === 'admiralty') {
          height = 18.0;
        } else if (lmType === 'isaac') {
          height = 28.0;
        } else if (lmType === 'spas') {
          height = 26.0;
        } else if (lmType === 'exchange') {
          height = 20.0;
        } else if (lmType === 'peter_paul') {
          height = 22.0;
        } else if (lmType === 'kazan') {
          height = 26.0;
        } else if (lmType === 'lavra') {
          height = 18.0;
        }
        height = Math.max(7.0, Math.min(height, 35.0));

        // Facade color
        let wallCol: THREE.Color;
        if (lmType === 'hermitage') {
          wallCol = new THREE.Color(PALETTE.hermitageGreen);
        } else if (lmType === 'general_staff' || lmType === 'admiralty') {
          wallCol = new THREE.Color(PALETTE.empireYellow);
        } else if (lmType === 'exchange') {
          wallCol = new THREE.Color(PALETTE.spbWhiteStone);
        } else if (lmType === 'spas') {
          wallCol = new THREE.Color(PALETTE.spbBrick);
        } else if (lmType === 'kazan') {
          wallCol = new THREE.Color(PALETTE.empireStone);
        } else if (lmType === 'lavra') {
          wallCol = new THREE.Color(PALETTE.spbOchre);
        } else if (b.color) {
          wallCol = this.parseColor(b.color, PALETTE.spbOchre);
        } else {
          wallCol = this.getRandomWallColor(b.id);
        }

        // Roof color
        let roofCol: THREE.Color;
        if (lmType === 'hermitage') {
          roofCol = new THREE.Color(PALETTE.roofCopperGreen);
        } else if (lmType === 'general_staff' || lmType === 'admiralty' || lmType === 'exchange' || lmType === 'kazan' || lmType === 'lavra') {
          roofCol = new THREE.Color(PALETTE.roofZincGrey);
        } else if (b.roof_color && b.roof_color !== 'black' && b.roof_color !== '#000000') {
          roofCol = this.parseColor(b.roof_color, PALETTE.roofTinRed);
        } else {
          roofCol = this.getRandomRoofColor(b.id);
        }

        const targetBuffer = lmType && landmarkBuffers[lmType] ? landmarkBuffers[lmType] : standardWalls;
        const uScale = lmType ? 6.0 : 4.0;
        const vScale = height;

        // 1. Build Extruded Solid Vertical Walls
        const numPts = pts.length;
        let centroidX = 0;
        let centroidZ = 0;

        for (let i = 0; i < numPts; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % numPts];

          centroidX += p1.x;
          centroidZ += p1.z;

          const dx = p2.x - p1.x;
          const dz = p2.z - p1.z;
          const len = Math.hypot(dx, dz);
          if (len < 0.2) continue;

          const nx = -dz / len;
          const nz = dx / len;

          const uSpan = len / uScale;
          const vSpan = height / vScale;

          // Wall Quad
          targetBuffer.positions.push(
            p1.x, 0, p1.z,
            p2.x, 0, p2.z,
            p2.x, height, p2.z,
            p1.x, 0, p1.z,
            p2.x, height, p2.z,
            p1.x, height, p1.z
          );
          targetBuffer.normals.push(
            nx, 0, nz, nx, 0, nz, nx, 0, nz,
            nx, 0, nz, nx, 0, nz, nx, 0, nz
          );
          targetBuffer.uvs.push(
            0, 0, uSpan, 0, uSpan, vSpan,
            0, 0, uSpan, vSpan, 0, vSpan
          );
          targetBuffer.colors.push(
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b
          );

          // 2. Build Roof Parapet Lip (0.55m high, 0.45m wide border)
          // Creates distinct 3D isometric roof borders matching Warsaw-Izo
          const parapetH = 0.55;
          const parapetW = 0.45;
          const p1InX = p1.x - nx * parapetW;
          const p1InZ = p1.z - nz * parapetW;
          const p2InX = p2.x - nx * parapetW;
          const p2InZ = p2.z - nz * parapetW;

          // Top coping of parapet
          parapetPositions.push(
            p1.x, height + parapetH, p1.z,
            p2.x, height + parapetH, p2.z,
            p2InX, height + parapetH, p2InZ,
            p1.x, height + parapetH, p1.z,
            p2InX, height + parapetH, p2InZ,
            p1InX, height + parapetH, p1InZ
          );
          parapetNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

          // Inner vertical lip of parapet
          parapetPositions.push(
            p1InX, height, p1InZ,
            p2InX, height, p2InZ,
            p2InX, height + parapetH, p2InZ,
            p1InX, height, p1InZ,
            p2InX, height + parapetH, p2InZ,
            p1InX, height + parapetH, p1InZ
          );
          parapetNormals.push(-nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz, -nx, 0, -nz);

          for (let k = 0; k < 12; k++) {
            parapetColors.push(wallCol.r * 0.9, wallCol.g * 0.9, wallCol.b * 0.9);
          }

          // Roofline edge line
          edgePositions.push(
            p1.x, height + parapetH, p1.z,
            p2.x, height + parapetH, p2.z
          );
        }

        centroidX /= numPts;
        centroidZ /= numPts;

        // Bounding box dimensions of the building footprint
        let minX = pts[0].x, maxX = pts[0].x, minZ = pts[0].z, maxZ = pts[0].z;
        for (let i = 1; i < numPts; i++) {
          const p = pts[i];
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const bWidth = maxX - minX;
        const bDepth = maxZ - minZ;
        const minDim = Math.min(bWidth, bDepth);

        // 3. Build 3D Volumetric Pitched & Mansard Roof (Скатно-вальмовая кровля Петербурга)
        // Historic roofs rise 1.8m to 3.2m above eaves, creating distinct sunlit and shaded facets
        const pitchHeight = lmType ? 1.8 : Math.max(1.8, Math.min(3.2, 1.5 + (b.levels || 4) * 0.25));
        const insetDist = Math.max(1.5, Math.min(3.2, minDim * 0.28));

        const ridgePts = this.computeRoofRidgePolygon(pts, insetDist, centroidX, centroidZ);

        // A. Sloped Roof Facets (Скаты вальмовой / мансардной крыши)
        for (let i = 0; i < numPts; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % numPts];
          const r1 = ridgePts[i];
          const r2 = ridgePts[(i + 1) % numPts];

          const v0x = p1.x, v0y = height, v0z = p1.z;
          const v1x = p2.x, v1y = height, v1z = p2.z;
          const v2x = r2.x, v2y = height + pitchHeight, v2z = r2.z;
          const v3x = r1.x, v3y = height + pitchHeight, v3z = r1.z;

          // Normal of Triangle 1 (v0, v1, v2)
          const d1x = v1x - v0x, d1y = v1y - v0y, d1z = v1z - v0z;
          const d2x = v2x - v0x, d2y = v2y - v0y, d2z = v2z - v0z;
          let nx = d1y * d2z - d1z * d2y;
          let ny = d1z * d2x - d1x * d2z;
          let nz = d1x * d2y - d1y * d2x;
          const nLen = Math.hypot(nx, ny, nz) || 1.0;
          nx /= nLen; ny /= nLen; nz /= nLen;

          // Triangle 1: (v0, v1, v2)
          roofPositions.push(v0x, v0y, v0z, v1x, v1y, v1z, v2x, v2y, v2z);
          roofNormals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
          roofColors.push(
            roofCol.r, roofCol.g, roofCol.b,
            roofCol.r, roofCol.g, roofCol.b,
            roofCol.r, roofCol.g, roofCol.b
          );
          roofUvs.push(v0x / 4.0, v0z / 4.0, v1x / 4.0, v1z / 4.0, v2x / 4.0, v2z / 4.0);

          // Triangle 2: (v0, v2, v3)
          roofPositions.push(v0x, v0y, v0z, v2x, v2y, v2z, v3x, v3y, v3z);
          roofNormals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
          roofColors.push(
            roofCol.r, roofCol.g, roofCol.b,
            roofCol.r, roofCol.g, roofCol.b,
            roofCol.r, roofCol.g, roofCol.b
          );
          roofUvs.push(v0x / 4.0, v0z / 4.0, v2x / 4.0, v2z / 4.0, v3x / 4.0, v3z / 4.0);

          // Hip and ridge edge seam line
          edgePositions.push(v0x, v0y, v0z, v3x, v3y, v3z);
          edgePositions.push(v3x, v3y, v3z, v2x, v2y, v2z);
        }

        // B. Elevated Flat Ridge Deck / Mansard Platform
        const flatRidgeCoords: number[] = [];
        for (const r of ridgePts) {
          flatRidgeCoords.push(r.x, r.z);
        }
        const ridgeIndices = earcut(flatRidgeCoords);
        for (let i = 0; i < ridgeIndices.length; i += 3) {
          const r0 = ridgePts[ridgeIndices[i]];
          const r1 = ridgePts[ridgeIndices[i + 1]];
          const r2 = ridgePts[ridgeIndices[i + 2]];

          roofPositions.push(
            r0.x, height + pitchHeight, r0.z,
            r1.x, height + pitchHeight, r1.z,
            r2.x, height + pitchHeight, r2.z
          );
          roofNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
          roofColors.push(
            roofCol.r * 1.04, roofCol.g * 1.04, roofCol.b * 1.04,
            roofCol.r * 1.04, roofCol.g * 1.04, roofCol.b * 1.04,
            roofCol.r * 1.04, roofCol.g * 1.04, roofCol.b * 1.04
          );
          roofUvs.push(
            r0.x / 4.0, r0.z / 4.0,
            r1.x / 4.0, r1.z / 4.0,
            r2.x / 4.0, r2.z / 4.0
          );
        }

        // 4. Procedural 3D Rooftop Superstructures (Warsaw-Izo Style)
        // Historic chimneys, elevator penthouses, air vents
        if (!lmType) {
          const bSeed = Math.abs(b.id * 13.7);
          const numChimneys = 1 + (Math.floor(bSeed) % 3);

          // Chimneys (печные трубы) on top of the volumetric roof
          for (let c = 0; c < numChimneys; c++) {
            const angle = (bSeed + c * 2.1) % (Math.PI * 2);
            const dist = Math.min(insetDist * 0.8, 2.0 + (c * 2.5));
            const cx = centroidX + Math.cos(angle) * dist;
            const cz = centroidZ + Math.sin(angle) * dist;

            // Red brick chimney stack
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              cx, height + pitchHeight + 0.9, cz,
              0.8, 1.8, 0.8,
              new THREE.Color(0xa84838) // St. Petersburg red brick chimney
            );
            // Terracotta chimney cowl / cap (дымник)
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              cx, height + pitchHeight + 1.85, cz,
              1.0, 0.15, 1.0,
              new THREE.Color(0x5a3428)
            );
          }

          // Elevator penthouse / roof access hut (лифтовая будка)
          if (b.levels && b.levels >= 4) {
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              centroidX + 1.5, height + pitchHeight + 1.1, centroidZ - 1.0,
              3.2, 2.2, 2.4,
              new THREE.Color(0xd0c8bc)
            );

            // Steel communication antenna mast on top of penthouse
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              centroidX + 1.5, height + pitchHeight + 2.2 + 1.6, centroidZ - 1.0,
              0.16, 3.2, 0.16,
              new THREE.Color(0x404852)
            );
          }

          // Metal ventilation unit (вентиляционный короб)
          this.appendBox(
            detailPositions, detailNormals, detailColors,
            centroidX - 2.0, height + pitchHeight + 0.55, centroidZ + 1.2,
            1.6, 1.1, 1.4,
            new THREE.Color(0x949da6)
          );

          // Dormer Mansard Windows (слуховые окна Петербурга) on the roof slope
          if (b.levels && b.levels >= 3 && numPts >= 4) {
            const p1 = pts[0];
            const p2 = pts[1];
            const r1 = ridgePts[0];
            const r2 = ridgePts[1];
            const dormX = (p1.x + p2.x + r1.x + r2.x) * 0.25;
            const dormZ = (p1.z + p2.z + r1.z + r2.z) * 0.25;
            const dormY = height + pitchHeight * 0.45;

            this.appendBox(
              detailPositions, detailNormals, detailColors,
              dormX, dormY, dormZ,
              1.5, 1.3, 1.6,
              roofCol
            );
            // Dormer glass pane
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              dormX, dormY, dormZ + 0.75,
              1.1, 0.9, 0.15,
              new THREE.Color(0x1a2430)
            );
          }
        }
      }

      // 1. Standard Residential Walls Mesh
      const standardWallGeo = new THREE.BufferGeometry();
      standardWallGeo.setAttribute('position', new THREE.Float32BufferAttribute(standardWalls.positions, 3));
      standardWallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(standardWalls.normals, 3));
      standardWallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(standardWalls.uvs, 2));
      standardWallGeo.setAttribute('color', new THREE.Float32BufferAttribute(standardWalls.colors, 3));

      this.wallMat = new THREE.MeshLambertMaterial({
        map: this.facadeTex,
        emissiveMap: this.emissiveTex,
        emissive: new THREE.Color(0x000000),
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true
      });

      this.wallMesh = new THREE.Mesh(standardWallGeo, this.wallMat);
      this.wallMesh.castShadow = true;
      this.wallMesh.receiveShadow = true;
      this.wallMesh.frustumCulled = false;
      this.group.add(this.wallMesh);

      // 2. Landmark Meshes with Real Photo Textures
      for (const [lmKey, buf] of Object.entries(landmarkBuffers)) {
        if (buf.positions.length === 0) continue;

        const lmGeo = new THREE.BufferGeometry();
        lmGeo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
        lmGeo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
        lmGeo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));

        const mat = this.landmarkMaterials[lmKey];
        const mesh = new THREE.Mesh(lmGeo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.name = `landmark-${lmKey}`;
        this.landmarkMeshes.set(lmKey, mesh);
        this.group.add(mesh);
      }

      // 3. Triangulated Roofs Mesh
      const roofGeo = new THREE.BufferGeometry();
      roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
      roofGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roofNormals, 3));
      roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roofUvs, 2));
      roofGeo.setAttribute('color', new THREE.Float32BufferAttribute(roofColors, 3));

      this.roofMat = new THREE.MeshLambertMaterial({
        map: this.roofTex,
        vertexColors: true,
        side: THREE.DoubleSide,
        flatShading: true
      });

      this.roofMesh = new THREE.Mesh(roofGeo, this.roofMat);
      this.roofMesh.castShadow = true;
      this.roofMesh.receiveShadow = true;
      this.roofMesh.frustumCulled = false;
      this.group.add(this.roofMesh);

      // 4. Roof Parapets Mesh (raised borders around roofs)
      const parapetGeo = new THREE.BufferGeometry();
      parapetGeo.setAttribute('position', new THREE.Float32BufferAttribute(parapetPositions, 3));
      parapetGeo.setAttribute('normal', new THREE.Float32BufferAttribute(parapetNormals, 3));
      parapetGeo.setAttribute('color', new THREE.Float32BufferAttribute(parapetColors, 3));

      const parapetMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true
      });
      this.parapetMesh = new THREE.Mesh(parapetGeo, parapetMat);
      this.parapetMesh.castShadow = true;
      this.parapetMesh.receiveShadow = true;
      this.parapetMesh.frustumCulled = false;
      this.group.add(this.parapetMesh);

      // 5. 3D Rooftop Details Mesh (chimneys, elevator penthouses, vents)
      const detailGeo = new THREE.BufferGeometry();
      detailGeo.setAttribute('position', new THREE.Float32BufferAttribute(detailPositions, 3));
      detailGeo.setAttribute('normal', new THREE.Float32BufferAttribute(detailNormals, 3));
      detailGeo.setAttribute('color', new THREE.Float32BufferAttribute(detailColors, 3));

      const detailMat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true
      });
      this.rooftopDetailsMesh = new THREE.Mesh(detailGeo, detailMat);
      this.rooftopDetailsMesh.castShadow = true;
      this.rooftopDetailsMesh.receiveShadow = true;
      this.rooftopDetailsMesh.frustumCulled = false;
      this.group.add(this.rooftopDetailsMesh);

      // 6. Roofline Edges
      const edgeGeo = new THREE.BufferGeometry();
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x424a54,
        linewidth: 1,
        transparent: true,
        opacity: 0.35
      });
      this.edgesMesh = new THREE.LineSegments(edgeGeo, edgeMat);
      this.edgesMesh.frustumCulled = false;
      this.group.add(this.edgesMesh);

      console.log(`Rendered ${this.totalBuildings} real buildings with raised parapets, chimneys, and ${this.landmarkMeshes.size} real textured landmarks.`);
    } catch (err) {
      console.warn('Real buildings load warning:', err);
    }
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

    const faces = [
      // Top (+Y)
      { v: [cx - hw, cy + hh, cz - hd, cx + hw, cy + hh, cz - hd, cx + hw, cy + hh, cz + hd, cx - hw, cy + hh, cz - hd, cx + hw, cy + hh, cz + hd, cx - hw, cy + hh, cz + hd], n: [0, 1, 0] },
      // North (+Z)
      { v: [cx - hw, cy - hh, cz + hd, cx + hw, cy - hh, cz + hd, cx + hw, cy + hh, cz + hd, cx - hw, cy - hh, cz + hd, cx + hw, cy + hh, cz + hd, cx - hw, cy + hh, cz + hd], n: [0, 0, 1] },
      // South (-Z)
      { v: [cx + hw, cy - hh, cz - hd, cx - hw, cy - hh, cz - hd, cx - hw, cy + hh, cz - hd, cx + hw, cy - hh, cz - hd, cx - hw, cy + hh, cz - hd, cx + hw, cy + hh, cz - hd], n: [0, 0, -1] },
      // East (+X)
      { v: [cx + hw, cy - hh, cz + hd, cx + hw, cy - hh, cz - hd, cx + hw, cy + hh, cz - hd, cx + hw, cy - hh, cz + hd, cx + hw, cy + hh, cz - hd, cx + hw, cy + hh, cz + hd], n: [1, 0, 0] },
      // West (-X)
      { v: [cx - hw, cy - hh, cz - hd, cx - hw, cy - hh, cz + hd, cx - hw, cy + hh, cz + hd, cx - hw, cy - hh, cz - hd, cx - hw, cy + hh, cz + hd, cx - hw, cy + hh, cz - hd], n: [-1, 0, 0] }
    ];

    for (const f of faces) {
      for (let i = 0; i < 18; i += 3) {
        pos.push(f.v[i], f.v[i + 1], f.v[i + 2]);
        norm.push(f.n[0], f.n[1], f.n[2]);
        col.push(color.r, color.g, color.b);
      }
    }
  }

  public update(nightFactor: number) {
    const glow = Math.max(0, nightFactor - 0.15) * 1.2;
    const r = glow * 1.0;
    const g = glow * 0.85;
    const b = glow * 0.45;

    if (this.wallMat) {
      this.wallMat.emissive.setRGB(r, g, b);
    }
    for (const mat of Object.values(this.landmarkMaterials)) {
      mat.emissive.setRGB(r, g, b);
    }
  }
}
