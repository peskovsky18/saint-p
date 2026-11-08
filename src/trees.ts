import * as THREE from 'three';
import { latLonToMeters } from './geo';

export interface OSMTree {
  id: number;
  lat: number;
  lon: number;
  x?: number;
  z?: number;
  type?: number;
  scale?: number;
}

export class TreeSystem {
  public group: THREE.Group;
  public trunkMesh: THREE.InstancedMesh | null = null;
  public canopyMesh: THREE.InstancedMesh | null = null;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'real-pixel-trees';
    scene.add(this.group);

    this.loadTrees();
  }

  private async loadTrees() {
    try {
      const res = await fetch('./data/spb_trees.json');
      const realTrees: OSMTree[] = await res.json();

      const treePositions: { x: number; z: number; scale: number; type: number }[] = [];
      const treeGrid = new Map<string, { x: number; z: number }>();

      // Safe spatial placement helper: ensures strictly aligned placement and zero crowding
      const addTree = (x: number, z: number, scale: number, type: number): boolean => {
        if (this.isInWater(x, z) || this.isInsidePalaceSquare(x, z) || this.isInsideBuilding(x, z)) {
          return false;
        }

        // Prevent crowding (< 6.5m apart)
        const cellX = Math.floor(x / 6.8);
        const cellZ = Math.floor(z / 6.8);
        const key = `${cellX},${cellZ}`;
        if (treeGrid.has(key)) return false;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const nKey = `${cellX + dx},${cellZ + dz}`;
            const existing = treeGrid.get(nKey);
            if (existing && Math.hypot(existing.x - x, existing.z - z) < 6.5) {
              return false;
            }
          }
        }

        const item = { x, z, scale, type };
        treePositions.push(item);
        treeGrid.set(key, { x, z });
        return true;
      };

      // =========================================================================
      // 1. HISTORIC IMPERIAL ALLÉES (Идеально ровные регулярные аллеи Петербурга)
      // =========================================================================

      // A. Alexander Garden (Александровский сад перед фасадом Адмиралтейства)
      // 3 parallel, mathematically straight allées running parallel to the Admiralty facade:
      // Row 1 (Northern allée near Admiralty south facade)
      for (let x = -520; x <= -80; x += 14) {
        addTree(x, 285, 1.0, 0); // Imperial Lindens
      }
      // Row 2 (Central garden promenade)
      for (let x = -520; x <= -80; x += 14) {
        addTree(x, 320, 1.0, 1);
      }
      // Row 3 (Southern allée along Admiralteysky Prospect)
      for (let x = -520; x <= -80; x += 14) {
        addTree(x, 355, 1.0, 2);
      }

      // Senate Square (Сенатская площадь / Медный всадник) western flanking allées
      for (let z = 280; z <= 480; z += 15) {
        addTree(-540, z, 1.0, 1);
        addTree(-510, z, 1.0, 0);
      }

      // Admiralty eastern wing flanking allée along Dvortsovy Proyezd
      for (let z = 40; z <= 270; z += 15) {
        addTree(-75, z, 1.0, 0);
      }

      // Admiralty northern quay garden strip (facing Neva)
      for (let x = -460; x <= -200; x += 16) {
        addTree(x, 85, 1.0, 1);
      }

      // B. Konnogvardeysky Boulevard (Конногвардейский бульвар)
      // Two straight, parallel rows of boulevard trees
      for (let x = -850; x <= -560; x += 15) {
        addTree(x, 375, 1.0, 1);
        addTree(x, 395, 1.0, 1);
      }

      // C. Summer Garden (Летний сад) - formal regular French allées
      for (const x of [940, 1000, 1060, 1120, 1180]) {
        for (let z = -920; z <= -300; z += 16) {
          addTree(x, z, 1.05, 0);
        }
      }

      // D. Field of Mars (Марсово поле) - straight perimeter rows around parade ground
      for (let x = 720; x <= 1040; x += 16) {
        addTree(x, -280, 1.0, 2);
        addTree(x, -720, 1.0, 2);
      }
      for (let z = -720; z <= -280; z += 16) {
        addTree(720, z, 1.0, 2);
        addTree(1040, z, 1.0, 2);
      }

      // E. Mikhailovsky Garden & Square (Михайловский сад)
      for (const x of [740, 790, 840, 890, 940]) {
        for (let z = 140; z <= 260; z += 15) {
          addTree(x, z, 0.98, 1);
        }
      }

      // F. St. Isaac's Square Garden (Исаакиевский сквер)
      for (let x = -510; x <= -430; x += 15) {
        addTree(x, 690, 1.0, 0);
        addTree(x, 750, 1.0, 0);
      }
      for (let z = 690; z <= 750; z += 15) {
        addTree(-510, z, 1.0, 0);
        addTree(-430, z, 1.0, 0);
      }

      // G. Spit of Vasilyevsky Island (Биржевой сквер за зданием Биржи)
      for (const x of [-530, -490, -450, -410]) {
        for (let z = -460; z <= -370; z += 16) {
          addTree(x, z, 1.0, 1);
        }
      }

      // H. Peter & Paul Fortress (Петропавловская крепость на Заячьем острове)
      for (const x of [160, 230, 300, 370]) {
        for (let z = -790; z <= -710; z += 16) {
          addTree(x, z, 1.0, 1);
        }
      }

      // I. Tauride Garden (Таврический сад)
      for (let x = 3250; x <= 3650; x += 22) {
        for (let z = -900; z <= -520; z += 22) {
          const type = (Math.abs(x * 7 + z * 13)) % 5;
          addTree(x, z, 1.05, type);
        }
      }

      // J. Ovsyannikovsky Garden (Овсянниковский сад)
      for (let x = 2500; x <= 2700; x += 18) {
        for (let z = 850; z <= 1000; z += 18) {
          addTree(x, z, 1.0, (x + z) % 5);
        }
      }

      // K. Alexander Nevsky Lavra Gardens & Necropolis (Лаврский сад и Некрополь)
      for (let x = 3980; x <= 4320; x += 18) {
        for (let z = 1940; z <= 2260; z += 18) {
          // Avoid the central Holy Trinity cathedral footprint
          if (x >= 4080 && x <= 4180 && z >= 2040 && z <= 2120) continue;
          addTree(x, z, 1.02, (x * 3 + z) % 5);
        }
      }

      // L. Yusupov Garden (Юсуповский сад)
      for (let x = 120; x <= 380; x += 20) {
        for (let z = 1050; z <= 1260; z += 20) {
          addTree(x, z, 1.0, (x * 11 + z) % 5);
        }
      }

      // =========================================================================
      // 2. CURATED OPENSTREETMAP & DISTRICT-WIDE TREES
      // =========================================================================
      for (const t of realTrees) {
        const x = t.x ?? latLonToMeters(t.lat, t.lon).x;
        const z = t.z ?? latLonToMeters(t.lat, t.lon).z;
        if (Math.hypot(x, z) < 6000) {
          const type = (t.type !== undefined) ? t.type : (Math.abs(t.id) % 6);
          const scale = t.scale ?? (0.95 + (Math.abs(t.id * 17) % 15) / 100);
          addTree(x, z, scale, type);
        }
      }

      const totalCount = treePositions.length;

      // =========================================================================
      // 3. TREE GEOMETRY: STEPPED VOXEL PIXEL ART CANOPY (Warsaw-Izo Style)
      // =========================================================================
      // Perfectly axis-aligned rectangular boxes: 100% straight vertical trunks
      // and stepped cubic foliage tiers matching Warsaw-Izo isometric rendering

      // Trunk Geometry (Vertical wooden trunk, width 0.7m, depth 0.7m, height 3.4m)
      const trunkGeo = new THREE.BoxGeometry(0.7, 3.4, 0.7);
      trunkGeo.translate(0, 1.7, 0);

      const trunkMat = new THREE.MeshLambertMaterial({
        color: 0x463324,
        flatShading: true
      });

      this.trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, totalCount);
      this.trunkMesh.castShadow = true;
      this.trunkMesh.receiveShadow = true;
      this.trunkMesh.frustumCulled = false;

      // Stepped Voxel Canopy Geometry (Warsaw-Izo Style)
      // Tier 1 (Base):   3.6m x 1.8m x 3.6m (y: 2.7 to 4.5m)
      // Tier 2 (Mid):    4.6m x 2.0m x 4.6m (y: 4.5 to 6.5m)
      // Tier 3 (Upper):  3.4m x 1.8m x 3.4m (y: 6.5 to 8.3m)
      // Tier 4 (Crown):  2.0m x 1.2m x 2.0m (y: 8.3 to 9.5m)
      const t1 = new THREE.BoxGeometry(3.6, 1.8, 3.6);
      t1.translate(0, 3.6, 0);
      const t2 = new THREE.BoxGeometry(4.6, 2.0, 4.6);
      t2.translate(0, 5.5, 0);
      const t3 = new THREE.BoxGeometry(3.4, 1.8, 3.4);
      t3.translate(0, 7.4, 0);
      const t4 = new THREE.BoxGeometry(2.0, 1.2, 2.0);
      t4.translate(0, 8.9, 0);

      const mergedCanopy = this.mergeGeometries([t1, t2, t3, t4]);

      const canopyMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        flatShading: true
      });

      this.canopyMesh = new THREE.InstancedMesh(mergedCanopy, canopyMat, totalCount);
      this.canopyMesh.castShadow = true;
      this.canopyMesh.receiveShadow = true;
      this.canopyMesh.frustumCulled = false;

      const dummy = new THREE.Object3D();
      const colors = [
        new THREE.Color(0x4ca134), // Fresh Imperial Linden - vibrant rich green
        new THREE.Color(0x68b842), // St. Petersburg Birch - bright sunny lime
        new THREE.Color(0x3d7e28), // Imperial Oak / Elm - deep noble forest green
        new THREE.Color(0x56993a), // Central Park Poplar - warm balanced green
        new THREE.Color(0x2d6224), // Northern Conifer - deep evergreen
        new THREE.Color(0xcfa230)  // Golden Maple - warm amber accent
      ];

      for (let i = 0; i < totalCount; i++) {
        const t = treePositions[i];
        // Stand strictly upright at lawn elevation y = 0.14
        dummy.position.set(t.x, 0.14, t.z);
        dummy.scale.set(t.scale, t.scale, t.scale);
        // rotation.set(0, 0, 0) guarantees 100% uniform edge alignment with the 45° isometric camera
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();

        this.trunkMesh.setMatrixAt(i, dummy.matrix);
        this.canopyMesh.setMatrixAt(i, dummy.matrix);

        // Assign foliage color based on tree species
        const col = colors[t.type % colors.length];
        this.canopyMesh.setColorAt(i, col);
      }

      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.canopyMesh.instanceMatrix.needsUpdate = true;
      if (this.canopyMesh.instanceColor) this.canopyMesh.instanceColor.needsUpdate = true;

      this.group.add(this.trunkMesh);
      this.group.add(this.canopyMesh);

      console.log(`Rendered ${totalCount} perfectly straight, aligned 3D pixel trees.`);
    } catch (e) {
      console.warn('Failed to load trees:', e);
    }
  }

  /**
   * Filters out tree points that would fall into the Neva River or Saint Petersburg canals
   */
  private isInWater(x: number, z: number): boolean {
    // 1. Central Neva River channel (between Admiralty/Hermitage embankment and Petrogradskaya Side)
    if (x >= -400 && x <= 200 && z >= -650 && z <= -85) {
      return true;
    }
    // 2. West Neva towards Gulf
    if (x < -400 && x > -1600 && z >= -450 && z <= 120) {
      // Exclude Spit of Vasilyevsky Island (dry land wedge behind Stock Exchange)
      if (x >= -580 && x <= -350 && z >= -470 && z <= -340) {
        return false;
      }
      return true;
    }
    // 3. East Neva towards Liteyny Bridge
    if (x > 200 && x < 2200 && z >= -1050 && z <= -750) {
      return true;
    }
    // 4. Malaya Neva between Vasilyevsky Island and Petrogradskaya Side
    if (x >= -1200 && x <= -130 && z >= -1100 && z <= -460) {
      return true;
    }
    // 5. Moyka River strip
    if (x >= -100 && x <= 450 && z >= 260 && z <= 390) {
      if (Math.abs(z - (330 - (x - 100) * 0.25)) < 14) return true;
    }
    // 6. Fontanka River strip
    if (x >= 600 && x <= 1200 && z >= 150 && z <= 700) {
      if (Math.abs(z - (400 + (x - 800) * 0.6)) < 18) return true;
    }
    // 7. Winter Canal (Зимняя канавка)
    if (x >= 240 && x <= 280 && z >= -125 && z <= 120) {
      return true;
    }
    return false;
  }

  /**
   * Excludes trees inside Palace Square cobblestones
   */
  private isInsidePalaceSquare(x: number, z: number): boolean {
    return Math.hypot(x - 67.86, z - 87.72) < 88.0;
  }

  /**
   * Excludes trees inside major landmark buildings
   */
  private isInsideBuilding(x: number, z: number): boolean {
    // Admiralty building footprint (actual building, preserving Alexander Garden)
    if (x >= -490 && x <= -170 && z >= 60 && z <= 155) return true;
    // Winter Palace / Hermitage footprint
    if (x >= -120 && x <= 140 && z >= -125 && z <= 25) return true;
    // General Staff curved building
    if (
      x >= -60 && x <= 220 && z >= 100 && z <= 260 &&
      Math.hypot(x - 67.86, z - 87.72) > 88 && Math.hypot(x - 67.86, z - 87.72) < 220
    ) {
      return true;
    }
    return false;
  }

  private mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const posList: number[] = [];
    const normList: number[] = [];

    for (const g of geos) {
      const pos = g.getAttribute('position');
      const norm = g.getAttribute('normal');
      const index = g.getIndex();

      if (index) {
        for (let i = 0; i < index.count; i++) {
          const idx = index.getX(i);
          posList.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
          normList.push(norm.getX(idx), norm.getY(idx), norm.getZ(idx));
        }
      } else {
        for (let i = 0; i < pos.count; i++) {
          posList.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          normList.push(norm.getX(i), norm.getY(i), norm.getZ(i));
        }
      }
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(posList, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normList, 3));
    return merged;
  }
}
