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

export const LANDMARK_DEFS: Record<string, { file: string; uScale: number; vScale: number; color: number }> = {
  hermitage: { file: 'textures/landmarks/hermitage.jpg', uScale: 96.0, vScale: 23.5, color: PALETTE.hermitageGreen },
  general_staff: { file: 'textures/landmarks/general_staff.jpg', uScale: 15.0, vScale: 24.0, color: PALETTE.empireYellow },
  admiralty: { file: 'textures/landmarks/admiralty.jpg', uScale: 20.0, vScale: 18.0, color: PALETTE.empireYellow },
  isaac: { file: 'textures/landmarks/isaac.jpg', uScale: 28.0, vScale: 28.0, color: PALETTE.isaacGranite },
  spas: { file: 'textures/landmarks/spas.jpg', uScale: 16.0, vScale: 26.0, color: PALETTE.spbBrick },
  exchange: { file: 'textures/landmarks/exchange.jpg', uScale: 26.0, vScale: 20.0, color: PALETTE.spbWhiteStone },
  peter_paul: { file: 'textures/landmarks/peter_paul.jpg', uScale: 16.0, vScale: 22.0, color: PALETTE.spbWhiteStone },
  kazan: { file: 'textures/landmarks/kazan.jpg', uScale: 16.0, vScale: 26.0, color: PALETTE.empireStone }
};

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
   * Loads real photo textures for iconic St. Petersburg landmarks with crisp filtering
   */
  private initLandmarkMaterials() {
    const texLoader = new THREE.TextureLoader();

    const baseUrl = (import.meta as any).env?.BASE_URL || './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    for (const [key, def] of Object.entries(LANDMARK_DEFS)) {
      const texPath = `${cleanBase}${def.file}`;
      const tex = texLoader.load(
        texPath,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          t.magFilter = THREE.LinearFilter;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          t.generateMipmaps = true;
          t.needsUpdate = true;
        },
        undefined,
        (err) => {
          console.warn(`Landmark texture ${key} load warning at ${texPath}:`, err);
        }
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;

      // Color 0xffffff ensures real photographic landmark textures render in full vibrancy without muddy tinting!
      this.landmarkMaterials[key] = new THREE.MeshLambertMaterial({
        color: 0xffffff,
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
    ctx.fillStyle = '#f4efe6';
    ctx.fillRect(0, 0, fw, fh);

    // Micro-grain stucco noise for realistic plaster depth
    for (let y = 0; y < fh; y += 4) {
      for (let x = 0; x < fw; x += 4) {
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        const frac = n - Math.floor(n);
        if (frac > 0.65) {
          ctx.fillStyle = frac > 0.82 ? '#ffffff' : '#e6dfd3';
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Ground floor classical granite rustication (глубокая рустовка цокольного этажа)
    ctx.fillStyle = '#ded7cc';
    ctx.fillRect(0, fh * 0.73, fw, fh * 0.27);
    
    // Rustication horizontal grooves with cast shadow
    for (let y = fh * 0.73; y < fh; y += 14) {
      ctx.fillStyle = '#9c8c7c';
      ctx.fillRect(0, y, fw, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, y + 2, fw, 1);
    }
    // Staggered vertical joints between rusticated granite blocks
    for (let row = 0; row < 10; row++) {
      const y = fh * 0.73 + row * 14;
      const offset = (row % 2) * 32;
      for (let x = offset; x < fw; x += 64) {
        ctx.fillStyle = '#9c8c7c';
        ctx.fillRect(x, y, 2, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 2, y, 1, 14);
      }
    }

    // Floor dividing stone cornices with shadow lips (междуэтажные тяги и карнизы)
    // Belt course between 1st & 2nd floor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, fh * 0.71, fw, 7);
    ctx.fillStyle = '#b09e8c';
    ctx.fillRect(0, fh * 0.71 + 7, fw, 3);
    ctx.fillStyle = '#786858';
    ctx.fillRect(0, fh * 0.71 + 10, fw, 1.5);

    // Intermediate cornice between 2nd & 3rd floor
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, fh * 0.38, fw, 6);
    ctx.fillStyle = '#b09e8c';
    ctx.fillRect(0, fh * 0.38 + 6, fw, 2);

    // Roofline entablature with classical dentils and modillions (венчающий карниз с дентикулами)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, fw, 14);
    ctx.fillStyle = '#b8a694';
    ctx.fillRect(0, 14, fw, 3);
    ctx.fillStyle = '#8c7a68';
    ctx.fillRect(0, 17, fw, 1.5);

    for (let x = 4; x < fw; x += 12) {
      // White dentil block
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, 18, 6, 5);
      // Dentil drop shadow
      ctx.fillStyle = '#7a6a5c';
      ctx.fillRect(x, 23, 6, 2);
      ctx.fillRect(x + 6, 18, 1.5, 7);
    }

    // Windows: 4 bays per repeating horizontal unit
    const bays = [fw * 0.125, fw * 0.375, fw * 0.625, fw * 0.875];
    const floorsY = [fh * 0.19, fh * 0.53, fh * 0.84];
    const winW = 28;
    const winH = 40;

    for (const bx of bays) {
      for (let fi = 0; fi < floorsY.length; fi++) {
        const by = floorsY[fi];
        const wx = bx - winW / 2;
        const wy = by - winH / 2;

        // White stone architrave molding surround (наличник)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 4, wy - 5, winW + 8, winH + 10);
        ctx.fillStyle = '#b4a290';
        ctx.fillRect(wx - 4, wy + winH + 5, winW + 8, 2);

        // Classical pediments (сандрики) above upper-floor windows
        if (fi === 0) {
          // Alternating triangular and segmental pediments (чередующиеся треугольные и лучковые сандрики)
          const isTriangular = (Math.round(bx) % 2 === 0);
          if (isTriangular) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(wx - 5, wy - 5);
            ctx.lineTo(bx, wy - 15);
            ctx.lineTo(wx + winW + 5, wy - 5);
            ctx.closePath();
            ctx.fill();
            // Pediment drop shadow
            ctx.fillStyle = '#8a7868';
            ctx.fillRect(wx - 5, wy - 5, winW + 10, 2);
          } else {
            // Segmental curved pediment
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bx, wy - 5, (winW + 10) / 2, Math.PI, 0, false);
            ctx.fill();
            ctx.fillStyle = '#8a7868';
            ctx.fillRect(wx - 5, wy - 5, winW + 10, 2);
          }
        }

        // Window frame surround
        ctx.fillStyle = '#1c2633';
        ctx.fillRect(wx, wy, winW, winH);

        // 6-pane classical glazing (шестистворчатый переплёт со шпросами)
        const paneW = (winW - 6) / 2;
        const paneH = (winH - 8) / 3;
        for (let px = 0; px < 2; px++) {
          for (let py = 0; py < 3; py++) {
            const pxPos = wx + 2 + px * (paneW + 2);
            const pyPos = wy + 2 + py * (paneH + 2);

            // Deep reflective glass
            ctx.fillStyle = '#141e2a';
            ctx.fillRect(pxPos, pyPos, paneW, paneH);

            // Sky reflection shine gradient
            ctx.fillStyle = '#2c4258';
            ctx.fillRect(pxPos, pyPos, paneW * 0.75, 1.5);
            ctx.fillStyle = '#3c5874';
            ctx.fillRect(pxPos, pyPos, 1.5, paneH * 0.6);
          }
        }

        // Stone window sill with decorative support brackets (подоконник с консолями)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 5, wy + winH, winW + 10, 3.5);
        ctx.fillStyle = '#948270';
        ctx.fillRect(wx - 5, wy + winH + 3.5, winW + 10, 1.5);
        // Console brackets
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(wx - 2, wy + winH + 3.5, 4, 4);
        ctx.fillRect(wx + winW - 2, wy + winH + 3.5, 4, 4);
        ctx.fillStyle = '#7a6a58';
        ctx.fillRect(wx - 2, wy + winH + 7.5, 4, 1.5);
        ctx.fillRect(wx + winW - 2, wy + winH + 7.5, 4, 1.5);

        // Wrought-iron balcony on piano nobile (2nd floor, fi === 1)
        if (fi === 1) {
          // Cantilevered stone balcony slab
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(wx - 6, wy + winH - 2, winW + 12, 4);
          ctx.fillStyle = '#8a7868';
          ctx.fillRect(wx - 6, wy + winH + 2, winW + 12, 2);

          // Wrought-iron openwork railing (ажурная чугунная решетка)
          ctx.fillStyle = '#181c22';
          ctx.fillRect(wx - 5, wy + winH - 12, winW + 10, 11);
          // Balusters
          for (let x = wx - 4; x <= wx + winW + 4; x += 3) {
            ctx.fillStyle = '#101216';
            ctx.fillRect(x, wy + winH - 12, 1.2, 11);
            // Gilded rosette accents
            if (x % 6 === 0) {
              ctx.fillStyle = '#d4af37';
              ctx.fillRect(x - 0.5, wy + winH - 7, 2, 2);
            }
          }
          // Polished brass/handrail highlight
          ctx.fillStyle = '#687280';
          ctx.fillRect(wx - 5, wy + winH - 12, winW + 10, 1.5);
        }
      }
    }

    this.facadeTex = new THREE.CanvasTexture(diffCanvas);
    this.facadeTex.wrapS = THREE.RepeatWrapping;
    this.facadeTex.wrapT = THREE.RepeatWrapping;
    this.facadeTex.magFilter = THREE.NearestFilter;
    this.facadeTex.minFilter = THREE.NearestFilter;

    // 2. High-Resolution Folded Tin / Zinc Roof Texture (фальцевая кровля Петербурга, 256x256)
    const rw = 256;
    const rh = 256;
    const roofCanvas = document.createElement('canvas');
    roofCanvas.width = rw;
    roofCanvas.height = rh;
    const rCtx = roofCanvas.getContext('2d')!;

    // Clean neutral base for vertex color tinting
    rCtx.fillStyle = '#f2f5f8';
    rCtx.fillRect(0, 0, rw, rh);

    // Galvanized zinc spangle crystallization micro-noise
    for (let py = 0; py < rh; py += 4) {
      for (let px = 0; px < rw; px += 4) {
        const seed = Math.sin(px * 37.1 + py * 89.3);
        if (seed > 0.3) {
          rCtx.fillStyle = seed > 0.7 ? '#ffffff' : '#e2e7ec';
          rCtx.fillRect(px, py, 4, 4);
        }
      }
    }

    // Double standing seams (двойные стоячие фальцы) every 16 pixels with 3D profile
    for (let x = 0; x < rw; x += 16) {
      // Ambient shadow groove on left
      rCtx.fillStyle = '#647280';
      rCtx.fillRect(x, 0, 1, rh);
      // Sunlit highlighted fold crest
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(x + 1, 0, 1, rh);
      // Secondary fold bevel
      rCtx.fillStyle = '#94a4b4';
      rCtx.fillRect(x + 2, 0, 1, rh);
    }

    // Horizontal sheet cross-joints (лежачие фальцы картин) every 48 pixels
    for (let y = 0; y < rh; y += 48) {
      rCtx.fillStyle = '#5c6a78';
      rCtx.fillRect(0, y, rw, 1);
      rCtx.fillStyle = '#ffffff';
      rCtx.fillRect(0, y + 1, rw, 1.5);
      rCtx.fillStyle = '#8a9aac';
      rCtx.fillRect(0, y + 2.5, rw, 1);
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

    const warmWindowColors = ['#ffeaa4', '#ffd270', '#ffa944', '#fff2c0', '#ffbe6c'];
    for (let bi = 0; bi < bays.length; bi++) {
      const bx = bays[bi];
      for (let fi = 0; fi < floorsY.length; fi++) {
        const seed = Math.sin(bi * 93.1 + fi * 41.7) * 0.5 + 0.5;
        // ~50% of windows illuminated at night
        if (seed > 0.3) {
          const by = floorsY[fi];
          const wx = bx - winW / 2;
          const wy = by - winH / 2;
          const col = warmWindowColors[Math.floor(seed * 11) % warmWindowColors.length];
          eCtx.fillStyle = col;
          eCtx.fillRect(wx + 2, wy + 2, winW - 4, winH - 4);

          // Dark interior crossbar silhouettes (шпросы)
          eCtx.fillStyle = 'rgba(15, 18, 24, 0.55)';
          eCtx.fillRect(wx + 2, wy + winH / 2, winW - 4, 2);
          eCtx.fillRect(wx + winW / 2, wy + 2, 2, winH - 4);

          // Subtle curtain silhouettes (силуэты штор)
          if (seed > 0.6) {
            eCtx.fillStyle = 'rgba(40, 25, 15, 0.45)';
            eCtx.fillRect(wx + 2, wy + 2, 5, winH - 4);
            eCtx.fillRect(wx + winW - 7, wy + 2, 5, winH - 4);
          }
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
    const n = (b.name || '').toLowerCase().trim();
    const id = b.id;

    if (id === 69424000 || id === 270634000 || id === 1067948000 || id === 1202918000 || n === 'зимний дворец') {
      return 'hermitage';
    }
    if (id === 1453436000 || n === 'главный штаб') {
      return 'general_staff';
    }
    if (id === 2612859000 || n === 'адмиралтейство') {
      return 'admiralty';
    }
    if (id === 3229838000 || n === 'исаакиевский собор') {
      return 'isaac';
    }
    if (id === 28966446 || n === 'собор воскресения христова на крови') {
      return 'spas';
    }
    if (id === 3084726000 || n === 'санкт-петербургская биржа') {
      return 'exchange';
    }
    if (id === 2594681000 || n === 'петропавловский собор') {
      return 'peter_paul';
    }
    if (id === 11763697000 || n === 'казанский собор') {
      return 'kazan';
    }
    if (id === 28808840 || n.includes('троицкий собор')) {
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

        // Skip standalone monuments that are procedurally modeled in LandmarksSystem:
        // Alexander Column, Rostral Columns, Bronze Horseman, and Admiralty Arch subpart
        let cx = 0, cz = 0;
        for (const p of pts) { cx += p.x; cz += p.z; }
        cx /= pts.length; cz /= pts.length;

        if (
          Math.hypot(cx - 67.86, cz - 87.72) < 25 ||         // Alexander Column (removes id: 2000648000 and 37 subparts)
          Math.hypot(cx - (-426.4), cz - (-363.8)) < 30 ||  // South Rostral Column (removes id: 3084697000)
          Math.hypot(cx - (-530.6), cz - (-538.2)) < 30 ||  // North Rostral Column (removes id: 19710429000)
          Math.hypot(cx - (-626.8), cz - 264.4) < 25 ||     // Bronze Horseman
          b.id === 3229958000 ||                            // Главная арка адмиралтейства (modeled in 3D in landmarks)
          (b.name && b.name.toLowerCase().includes('ростраль')) // Any Rostral column marker
        ) {
          continue;
        }

        // Skip un-named OSM micro-subparts (columns, steps) that overlap major landmarks
        if (!b.name || b.name.trim() === '') {
          // Proximity to major landmarks: Stock Exchange (558 micro-parts), Isaac (14), Peter Paul (31), Admiralty (20), Winter Palace (7), Kazan (3)
          if (
            Math.hypot(cx - (-554.6), cz - (-407.8)) < 65 || // Stock Exchange
            Math.hypot(cx - (-472.3), cz - 641.1) < 55 ||   // St. Isaac Cathedral
            Math.hypot(cx - 108.5, cz - (-1155.0)) < 40 ||  // Peter & Paul Cathedral
            Math.hypot(cx - (-370.6), cz - 208.8) < 160 ||  // Admiralty
            Math.hypot(cx - (-22.7), cz - (-57.7)) < 130 || // Winter Palace
            Math.hypot(cx - 567.8, cz - 600.8) < 70 ||      // Kazan Cathedral (removes parasitic rooftop boxes)
            Math.hypot(cx - 800.2, cz - (-24.7)) < 40       // Spas na Krovi
          ) {
            continue;
          }
        }

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
        const lmDef = lmType ? LANDMARK_DEFS[lmType] : null;
        const uScale = lmDef ? lmDef.uScale : 4.0;
        const vScale = lmDef ? lmDef.vScale : height;

        // 1. Build Extruded Solid Vertical Walls
        const numPts = pts.length;
        let centroidX = 0;
        let centroidZ = 0;
        let cumDist = 0;

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

          const u1 = cumDist / uScale;
          const u2 = (cumDist + len) / uScale;
          const v1 = 0.0;
          const v2 = height / vScale;

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
            u1, v1, u2, v1, u2, v2,
            u1, v1, u2, v2, u1, v2
          );
          targetBuffer.colors.push(
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b,
            wallCol.r, wallCol.g, wallCol.b
          );
          cumDist += len;

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
        // Historic roofs rise 2.4m to 4.2m above eaves, creating distinct sunlit and shaded facets
        const isResidentialHistoric = !lmType && (b.levels ? b.levels >= 4 : true);
        const pitchHeight = lmType ? 1.8 : (isResidentialHistoric ? Math.max(2.4, Math.min(4.2, 2.0 + (b.levels || 4) * 0.35)) : 2.0);
        const insetDist = Math.max(1.8, Math.min(4.2, minDim * 0.32));

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

        // 4. Procedural 3D Historic St. Petersburg Rooftop & Courtyard Details
        if (!lmType) {
          const bSeed = Math.abs(b.id * 17.3);

          // A. Multi-Edge Rhythmic Dormer Windows (слуховые окна / люкарны)
          if ((b.levels || 4) >= 3) {
            for (let i = 0; i < numPts; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % numPts];
              const r1 = ridgePts[i];
              const r2 = ridgePts[(i + 1) % numPts];

              const dx = p2.x - p1.x;
              const dz = p2.z - p1.z;
              const len = Math.hypot(dx, dz);
              if (len < 9.0) continue;

              const rx = dx / len;
              const rz = dz / len;
              const fx = -rz; // Outward facade normal
              const fz = rx;

              // Space dormers rhythmically every ~8.5m to 10m
              const count = Math.min(4, Math.floor(len / 8.5));
              if (count < 1) continue;

              for (let k = 1; k <= count; k++) {
                const t = k / (count + 1);
                const ex = p1.x + dx * t;
                const ez = p1.z + dz * t;
                const r_midX = r1.x + (r2.x - r1.x) * t;
                const r_midZ = r1.z + (r2.z - r1.z) * t;

                const dormX = ex * 0.52 + r_midX * 0.48;
                const dormZ = ez * 0.52 + r_midZ * 0.48;
                const dormY = height + pitchHeight * 0.42;

                // 1. Dormer body in roof tin color
                this.appendOrientedBox(
                  detailPositions, detailNormals, detailColors,
                  dormX, dormY, dormZ,
                  1.4, 1.3, 1.6,
                  rx, rz, fx, fz,
                  roofCol
                );
                // 2. Gable rooflet / pediment cap (козырёк слухового окна)
                this.appendOrientedBox(
                  detailPositions, detailNormals, detailColors,
                  dormX + fx * 0.08, dormY + 0.72, dormZ + fz * 0.08,
                  1.6, 0.22, 1.8,
                  rx, rz, fx, fz,
                  roofCol
                );
                // 3. Glazed window pane (тёмно-синее остекление)
                this.appendOrientedBox(
                  detailPositions, detailNormals, detailColors,
                  dormX + fx * 0.74, dormY - 0.05, dormZ + fz * 0.74,
                  0.95, 0.85, 0.12,
                  rx, rz, fx, fz,
                  new THREE.Color(0x16202c)
                );
                // 4. White stone sill (белокаменный подоконник)
                this.appendOrientedBox(
                  detailPositions, detailNormals, detailColors,
                  dormX + fx * 0.76, dormY - 0.50, dormZ + fz * 0.76,
                  1.15, 0.12, 0.22,
                  rx, rz, fx, fz,
                  new THREE.Color(0xdad5cb)
                );
              }
            }
          }

          // B. Multi-Flue Brick Chimneys with Cowls (Печные трубы с дымниками)
          const chimneyBrickColors = [
            new THREE.Color(0xa84838), // Fired Red Brick
            new THREE.Color(0x8c382c), // Dark Soot Brick
            new THREE.Color(0xb25642)  // Terracotta
          ];
          const cowlColor = new THREE.Color(0x322822); // Blackened cast iron cowl
          const pipeColor = new THREE.Color(0x6e483a); // Ceramic pipe flue

          const chimneyStep = numPts <= 5 ? 1 : 2;
          let chimneyCount = 0;

          for (let i = 0; i < numPts && chimneyCount < 6; i += chimneyStep) {
            const r1 = ridgePts[i];
            const r2 = ridgePts[(i + 1) % numPts];
            const rdx = r2.x - r1.x;
            const rdz = r2.z - r1.z;
            const rlen = Math.hypot(rdx, rdz);

            const colIdx = (Math.floor(bSeed) + chimneyCount) % chimneyBrickColors.length;
            const brickCol = chimneyBrickColors[colIdx];
            const isDoubleFlue = (chimneyCount % 2 === 0);
            const chW = isDoubleFlue ? 1.5 : 0.9;
            const chD = 0.8;
            const chH = 1.6 + ((chimneyCount * 3) % 4) * 0.2;
            const chY = height + pitchHeight + chH * 0.5;

            // Chimney base stack
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              r1.x, chY, r1.z,
              chW, chH, chD,
              brickCol
            );
            // Overhanging cast-iron cap / cowl (металлический дымник)
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              r1.x, height + pitchHeight + chH + 0.1, r1.z,
              chW + 0.3, 0.16, chD + 0.3,
              cowlColor
            );
            // Smoke flues (гильзы дымоходов)
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              r1.x, height + pitchHeight + chH + 0.26, r1.z,
              chW * 0.6, 0.2, chD * 0.5,
              pipeColor
            );
            chimneyCount++;

            // Intermediate chimney on long ridge lines
            if (rlen > 14.0 && chimneyCount < 6) {
              const midRx = (r1.x + r2.x) * 0.5;
              const midRz = (r1.z + r2.z) * 0.5;
              this.appendBox(
                detailPositions, detailNormals, detailColors,
                midRx, chY, midRz,
                1.1, chH * 0.95, 0.8,
                chimneyBrickColors[(colIdx + 1) % chimneyBrickColors.length]
              );
              this.appendBox(
                detailPositions, detailNormals, detailColors,
                midRx, height + pitchHeight + chH * 0.95 + 0.1, midRz,
                1.4, 0.15, 1.1,
                cowlColor
              );
              chimneyCount++;
            }
          }

          // C. Pass-Through Gate Arches (Проходные арки / подворотни Петербурга)
          if ((b.levels || 4) >= 3) {
            let archPlaced = false;
            for (let i = 0; i < numPts && !archPlaced; i++) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % numPts];
              const dx = p2.x - p1.x;
              const dz = p2.z - p1.z;
              const len = Math.hypot(dx, dz);
              if (len < 18.0) continue;

              const rx = dx / len;
              const rz = dz / len;
              const fx = -rz; // Outward facade normal
              const fz = rx;

              const midX = (p1.x + p2.x) * 0.5;
              const midZ = (p1.z + p2.z) * 0.5;

              // 1. Dark Shadowed Passage Tunnel Interior (подворотня во двор)
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX, 2.1, midZ,
                3.4, 4.2, 1.8,
                rx, rz, fx, fz,
                new THREE.Color(0x121519)
              );

              // 2. Neoclassical White Stone Portal Frame / Arch Top (белокаменная арка)
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX + fx * 0.08, 4.35, midZ + fz * 0.08,
                3.8, 0.52, 0.35,
                rx, rz, fx, fz,
                new THREE.Color(0xd5cec2)
              );

              // 3. Prominent Arch Keystone (замковый камень)
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX + fx * 0.14, 4.45, midZ + fz * 0.14,
                0.65, 0.72, 0.45,
                rx, rz, fx, fz,
                new THREE.Color(0xeee9de)
              );

              // 4. Rusticated Side Pilasters (рустованные пилоны)
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX - rx * 1.8 + fx * 0.08, 2.1, midZ - rz * 1.8 + fz * 0.08,
                0.4, 4.2, 0.35,
                rx, rz, fx, fz,
                new THREE.Color(0xc9c2b6)
              );
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX + rx * 1.8 + fx * 0.08, 2.1, midZ + rz * 1.8 + fz * 0.08,
                0.4, 4.2, 0.35,
                rx, rz, fx, fz,
                new THREE.Color(0xc9c2b6)
              );

              // 5. Wrought Iron Gate Openwork (кованая чугунная решётка)
              this.appendOrientedBox(
                detailPositions, detailNormals, detailColors,
                midX + fx * 0.04, 1.8, midZ + fz * 0.04,
                3.2, 3.6, 0.08,
                rx, rz, fx, fz,
                new THREE.Color(0x24282e)
              );

              archPlaced = true;
            }
          }

          // D. Courtyard-Well Fire Escapes (Пожарные лестницы во дворах-колодцах)
          if (numPts >= 10 && (b.levels || 4) >= 4) {
            for (let i = 1; i < numPts - 1; i += 3) {
              const p1 = pts[i];
              const p2 = pts[(i + 1) % numPts];
              const dx = p2.x - p1.x;
              const dz = p2.z - p1.z;
              const len = Math.hypot(dx, dz);
              if (len < 6.0 || len > 28.0) continue;

              const rx = dx / len;
              const rz = dz / len;
              const fx = -rz; // Outward normal
              const fz = rx;

              const midX = (p1.x + p2.x) * 0.5;
              const midZ = (p1.z + p2.z) * 0.5;

              // Check if normal points towards centroid (inner courtyard wall)
              const dotC = fx * (centroidX - midX) + fz * (centroidZ - midZ);
              if (dotC > 0) {
                const ladderH = height - 2.5;
                const ladderY = 2.5 + ladderH * 0.5;

                // Vertical steel rails
                this.appendOrientedBox(
                  detailPositions, detailNormals, detailColors,
                  midX + fx * 0.35, ladderY, midZ + fz * 0.35,
                  0.75, ladderH, 0.18,
                  rx, rz, fx, fz,
                  new THREE.Color(0x25282d)
                );

                // Balcony platforms every level
                const levels = Math.min(6, b.levels || 4);
                for (let lvl = 1; lvl < levels; lvl++) {
                  const platY = lvl * 3.4;
                  this.appendOrientedBox(
                    detailPositions, detailNormals, detailColors,
                    midX + fx * 0.55, platY, midZ + fz * 0.55,
                    1.3, 0.15, 0.85,
                    rx, rz, fx, fz,
                    new THREE.Color(0x32363d)
                  );
                }
                break; // One fire escape per courtyard building
              }
            }
          }

          // E. Elevator penthouse & ventilation for tall buildings (levels >= 5)
          if (b.levels && b.levels >= 5) {
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              centroidX + 1.2, height + pitchHeight + 1.1, centroidZ - 1.0,
              3.0, 2.2, 2.2,
              new THREE.Color(0xd0c8bc)
            );
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              centroidX + 1.2, height + pitchHeight + 2.2 + 1.5, centroidZ - 1.0,
              0.16, 3.0, 0.16,
              new THREE.Color(0x404852)
            );
          }

          if (b.levels && b.levels >= 4) {
            this.appendBox(
              detailPositions, detailNormals, detailColors,
              centroidX - 1.8, height + pitchHeight + 0.55, centroidZ + 1.0,
              1.5, 1.1, 1.3,
              new THREE.Color(0x949da6)
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

  /**
   * Appends an oriented 3D cuboid aligned to facade normal and eave directions
   */
  private appendOrientedBox(
    pos: number[],
    norm: number[],
    col: number[],
    cx: number, cy: number, cz: number,
    w: number, h: number, d: number,
    rx: number, rz: number, // Right unit vector (along facade/eave)
    fx: number, fz: number, // Forward unit vector (outward normal)
    color: THREE.Color
  ) {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;

    const v = [
      [cx - rx * hw - fx * hd, cy - hh, cz - rz * hw - fz * hd],
      [cx + rx * hw - fx * hd, cy - hh, cz + rz * hw - fz * hd],
      [cx + rx * hw + fx * hd, cy - hh, cz + rz * hw + fz * hd],
      [cx - rx * hw + fx * hd, cy - hh, cz - rz * hw + fz * hd],
      [cx - rx * hw - fx * hd, cy + hh, cz - rz * hw - fz * hd],
      [cx + rx * hw - fx * hd, cy + hh, cz + rz * hw - fz * hd],
      [cx + rx * hw + fx * hd, cy + hh, cz + rz * hw + fz * hd],
      [cx - rx * hw + fx * hd, cy + hh, cz - rz * hw + fz * hd]
    ];

    const faces = [
      // Top (+Y)
      { idx: [4, 5, 6, 4, 6, 7], n: [0, 1, 0] },
      // Bottom (-Y)
      { idx: [0, 2, 1, 0, 3, 2], n: [0, -1, 0] },
      // Forward (+F, front face)
      { idx: [3, 2, 6, 3, 6, 7], n: [fx, 0, fz] },
      // Back (-F, rear face)
      { idx: [1, 0, 4, 1, 4, 5], n: [-fx, 0, -fz] },
      // Right (+R)
      { idx: [2, 1, 5, 2, 5, 6], n: [rx, 0, rz] },
      // Left (-R)
      { idx: [0, 3, 7, 0, 7, 4], n: [-rx, 0, -rz] }
    ];

    for (const f of faces) {
      for (const idx of f.idx) {
        const pt = v[idx];
        pos.push(pt[0], pt[1], pt[2]);
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
