import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PALETTE } from './palette';

function createPedimentGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const hw = width / 2;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false
  });
  geom.center();
  return geom;
}

class CannonAudioSynth {
  private ctx: AudioContext | null = null;

  public playBoom() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const now = this.ctx.currentTime;

      // 1. High-pressure initial muzzle crack (white noise transient)
      const bufLen = Math.floor(this.ctx.sampleRate * 0.35);
      const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(650, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(90, now + 0.3);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.95, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseSrc.start(now);

      // 2. Heavy sub-bass boom (115 Hz drop down to 28 Hz)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.9);

      oscGain.gain.setValueAtTime(1.0, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);

      // 3. Reverberant low-frequency Neva river echo
      const echoOsc = this.ctx.createOscillator();
      const echoGain = this.ctx.createGain();
      echoOsc.type = 'triangle';
      echoOsc.frequency.setValueAtTime(48, now + 0.12);
      echoOsc.frequency.exponentialRampToValueAtTime(18, now + 2.2);

      echoGain.gain.setValueAtTime(0.0, now);
      echoGain.gain.setValueAtTime(0.35, now + 0.12);
      echoGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

      echoOsc.connect(echoGain);
      echoGain.connect(this.ctx.destination);
      echoOsc.start(now + 0.12);
      echoOsc.stop(now + 2.4);
    } catch {
      // Audio autoplay policy or unsupported
    }
  }
}

export class LandmarksSystem {
  public group: THREE.Group;
  private streetLampsMat!: THREE.MeshBasicMaterial;
  private beaconMat!: THREE.MeshBasicMaterial;
  public floodlightMat!: THREE.MeshBasicMaterial;
  public rostralFlameMat!: THREE.MeshBasicMaterial;
  private totalTime: number = 0;

  // Cannon shot FX & audio
  private cannonAudio: CannonAudioSynth = new CannonAudioSynth();
  private cannonFlashMesh!: THREE.Mesh;
  private cannonFlashLight!: THREE.PointLight;
  private cannonSmokeGroup!: THREE.Group;
  private cannonShockwave!: THREE.Mesh;
  private cannonSmokeMeshes: { mesh: THREE.Mesh; baseVel: THREE.Vector3; seed: number }[] = [];
  public cannonShotTimer: number = -1;
  public hasFiredAtNoon: boolean = false;

  private gltfLoader: GLTFLoader = new GLTFLoader();
  public voxelLandmarksGroup: THREE.Group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'landmark-spires-and-monuments';
    scene.add(this.group);

    this.voxelLandmarksGroup.name = 'blender-voxel-landmarks';
    this.group.add(this.voxelLandmarksGroup);

    this.streetLampsMat = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.0
    });

    this.beaconMat = new THREE.MeshBasicMaterial({
      color: 0xff1e1e,
      transparent: true,
      opacity: 1.0
    });

    this.floodlightMat = new THREE.MeshBasicMaterial({
      color: 0xffdf78,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.rostralFlameMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.buildAlexanderColumn();
    this.buildWinterPalaceDetails();
    this.buildAdmiraltySpire();
    this.buildStIsaacsDome();
    this.buildPeterAndPaulSpire();
    this.buildPeterAndPaulBastions();
    this.buildNewHollandIsland();
    this.buildRostralColumns();
    this.buildGeneralStaffChariot();
    this.buildBronzeHorseman();
    this.buildSpasNaKroviDomes();
    this.buildStockExchangeColonnade();
    this.buildKazanCathedralColonnade();
    this.buildKunstkameraTower();
    this.buildStreetLamps();
    this.buildAviationBeacons();
    this.buildSmolnyCathedral();
    this.buildTauridePalace();
    this.buildMoscowStation();
    this.buildLavra();

    this.loadVoxelLandmarkModels();
  }

  /**
   * Loads high-fidelity voxel 3D models of St. Petersburg landmarks crafted in Blender via MCP
   */
  private loadVoxelLandmarkModels() {
    const baseUrl = (import.meta as any).env?.BASE_URL || './';
    const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';

    const models = [
      {
        file: 'models/winter_palace.glb',
        pos: new THREE.Vector3(-22.7, 0.0, -57.7),
        rotY: 0,
        scale: 1.0,
        name: 'blender-winter-palace',
        procName: ''
      },
      {
        file: 'models/st_isaacs.glb',
        pos: new THREE.Vector3(-474.05, 0.0, 644.49),
        rotY: 0, // Perfectly straight axis-aligned with St. Isaac's Square, Senate Square & street grid
        scale: 1.0,
        name: 'blender-st-isaacs',
        procName: 'st-isaacs-dome'
      },
      {
        file: 'models/admiralty.glb',
        pos: new THREE.Vector3(-370.6, 0.5, 208.8),
        rotY: 0,
        scale: 1.0,
        name: 'blender-admiralty',
        procName: 'admiralty-spire'
      },
      {
        file: 'models/spas_na_krovi.glb',
        pos: new THREE.Vector3(800.2, 0.0, -24.7),
        rotY: 0, // Aligned with Griboedov Canal (West bell tower facing canal embankment)
        scale: 1.0, // Authentic 1:1 metric architectural scale
        name: 'blender-spas-na-krovi',
        procName: 'spas-na-krovi-ensemble'
      },
      {
        file: 'models/kazan_cathedral.glb',
        pos: new THREE.Vector3(567.8, 0.0, 600.8),
        rotY: -0.24, // Semicircular 96-column colonnade opening directly towards Nevsky Prospekt & Kazan Square
        scale: 1.0,
        name: 'blender-kazan-cathedral',
        procName: 'kazan-cathedral-ensemble'
      },
      {
        file: 'models/smolny_cathedral.glb',
        pos: new THREE.Vector3(4475.0, 0.0, -1007.0),
        rotY: 0,
        scale: 1.0,
        name: 'blender-smolny-cathedral',
        procName: 'smolny-cathedral'
      },
      {
        file: 'models/stock_exchange.glb',
        pos: new THREE.Vector3(-554.6, 0.0, -407.8),
        rotY: Math.PI / 2 + 0.537,
        scale: 1.0,
        name: 'blender-stock-exchange',
        procName: 'stock-exchange-temple'
      },
      {
        file: 'models/peter_paul.glb',
        pos: new THREE.Vector3(108.5, 0.0, -1155.0),
        rotY: -Math.PI / 2,
        scale: 1.0,
        name: 'blender-peter-paul',
        procName: 'peter-and-paul-spire'
      }
    ];

    for (const m of models) {
      const modelUrl = `${cleanBase}${m.file}`;
      this.gltfLoader.load(
        modelUrl,
        (gltf) => {
          const root = gltf.scene;
          root.name = m.name;
          root.position.copy(m.pos);
          root.rotation.y = m.rotY;
          root.scale.setScalar(m.scale);

          root.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const mat of mats) {
                  if ('flatShading' in mat) {
                    (mat as any).flatShading = true;
                    mat.needsUpdate = true;
                  }
                }
              }
            }
          });

          // Smoothly retire procedural placeholder when high-fidelity Blender voxel model is active
          // Note: Keep winter-palace-details visible so its 5-cupola Grand Church and 176 balustrade statues crown the roofline
          if (m.procName && m.procName !== 'winter-palace-details') {
            const proc = this.group.getObjectByName(m.procName);
            if (proc) {
              proc.visible = false;
            }
          }

          this.voxelLandmarksGroup.add(root);
          console.log(`Successfully loaded Blender voxel model: ${m.file}`);
        },
        undefined,
        (err) => {
          console.warn(`Voxel model ${m.file} load note (using procedural fallback):`, err);
        }
      );
    }
  }

  /**
   * Александровская колонна (Alexander Column)
   * Exact GPS: 59.939044 N, 30.315777 E -> World: x=67.86, z=87.72
   */
  private buildAlexanderColumn() {
    const colGroup = new THREE.Group();
    colGroup.name = 'alexander-column';
    colGroup.position.set(67.86, 0.5, 87.72);

    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x3d352b, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: 0x8a3e35, flatShading: true });
    const angelMat = new THREE.MeshLambertMaterial({ color: 0x2b3833, flatShading: true });

    // Pedestal
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 14), bronzeMat);
    base1.position.y = 1.25;
    colGroup.add(base1);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 10), bronzeMat);
    base2.position.y = 4.75;
    base2.castShadow = true;
    colGroup.add(base2);

    // Monolithic Granite Shaft (47.5m total height)
    const shaftGeo = new THREE.CylinderGeometry(2.1, 2.4, 26, 16);
    const shaft = new THREE.Mesh(shaftGeo, graniteMat);
    shaft.position.y = 20;
    shaft.castShadow = true;
    colGroup.add(shaft);

    // Bronze Capital
    const cap = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 5.5), bronzeMat);
    cap.position.y = 34;
    colGroup.add(cap);

    // Angel with Cross on Top
    const angel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4.8, 1.8), angelMat);
    angel.position.y = 37.5;
    angel.castShadow = true;
    colGroup.add(angel);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.8, 2.0), bronzeMat);
    cross.position.set(0.6, 38.5, 0);
    colGroup.add(cross);

    this.group.add(colGroup);
  }

  /**
   * Зимний дворец (Winter Palace) Authentic 3D Architectural Ensemble
   * 176 roofline balustrade statues and classical urns,
   * and Jordan entrance colonnade facing the Neva.
   */
  private buildWinterPalaceDetails() {
    const wpGroup = new THREE.Group();
    wpGroup.name = 'winter-palace-details';

    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const statueMat = new THREE.MeshLambertMaterial({ color: 0x4a4f48, flatShading: true });

    // 1. 176 Authentic Roofline Balustrade Statues & Classical Decorative Urns
    // Placed along all four outer parapets of the Winter Palace
    const balustradeLines: { start: [number, number]; end: [number, number]; count: number }[] = [
      { start: [-170, 48], end: [85, 48], count: 42 },    // South / Palace Square facade
      { start: [-175, -198], end: [85, -198], count: 44 }, // North / Palace Embankment (Neva)
      { start: [-175, -190], end: [-175, 45], count: 38 }, // West / Admiralty flank
      { start: [88, -190], end: [88, 45], count: 38 }      // East / Small Hermitage flank
    ];

    for (const line of balustradeLines) {
      const [x1, z1] = line.start;
      const [x2, z2] = line.end;
      for (let i = 0; i <= line.count; i++) {
        const t = i / line.count;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;

        const isStatue = i % 2 === 0;
        if (isStatue) {
          // Classical allegorical warrior / goddess statue on stone plinth
          const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), trimMat);
          plinth.position.set(x, 24.3, z);
          wpGroup.add(plinth);

          const figure = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.4, 0.65), statueMat);
          figure.position.set(x, 25.8, z);
          figure.castShadow = true;
          wpGroup.add(figure);
        } else {
          // Classical Rococo urn / vase with finial
          const urnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.35, 1.4, 8), trimMat);
          urnBase.position.set(x, 24.7, z);
          wpGroup.add(urnBase);

          const urnFinial = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), goldMat);
          urnFinial.position.set(x, 25.8, z);
          wpGroup.add(urnFinial);
        }
      }
    }

    // 2. Jordan Entrance Colonnade (Иорданский подъезд со стороны Невы)
    const jordanGroup = new THREE.Group();
    jordanGroup.position.set(75, 0, -199.5);
    for (let cx = -6; cx <= 6; cx += 3) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 8.5, 10), trimMat);
      col.position.set(cx, 4.25, 0);
      col.castShadow = true;
      jordanGroup.add(col);
    }
    const jordanBalcony = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 4.0), trimMat);
    jordanBalcony.position.set(0, 9.0, 0);
    jordanGroup.add(jordanBalcony);
    wpGroup.add(jordanGroup);

    this.group.add(wpGroup);
  }

  /**
   * Шпиль Адмиралтейства (Admiralty Golden Spire, Marine Nymphs & Flanking Pavilions)
   * Exact GPS: 59.937500 N, 30.308611 E -> World: x=-331.72, z=259.60
   * 72.5m Golden Spire, the Golden Ship weathervane (Кораблик),
   * peristyle of 28 statues, stepped clock pyramid, and East & West river pavilions.
   */
  private buildAdmiraltySpire() {
    const spireGroup = new THREE.Group();
    spireGroup.name = 'admiralty-spire';
    spireGroup.position.set(-330.32, 0.5, 264.66);
    spireGroup.rotation.y = -0.616;

    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });
    const ochreMat = new THREE.MeshLambertMaterial({ color: PALETTE.empireYellow, flatShading: true });
    const statueMat = new THREE.MeshLambertMaterial({ color: 0x4a4f48, flatShading: true });
    const clockMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    // 1. Monumental Cubic Base (Andrean Zakharov's Russian Empire masterpiece)
    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 24), ochreMat);
    towerBase.position.y = 9.0;
    towerBase.castShadow = true;
    spireGroup.add(towerBase);

    // Central Triumphal Arch portal on main facade facing south
    const archPortal = new THREE.Mesh(new THREE.BoxGeometry(9.0, 11.0, 2.5), trimMat);
    archPortal.position.set(0, 5.5, 12.0);
    spireGroup.add(archPortal);

    // Sculptural Groups of Marine Nymphs supporting Celestial Spheres (by Feodosy Shchedrin)
    for (const nx of [-5.8, 5.8]) {
      const nymphPedestal = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 1.8), trimMat);
      nymphPedestal.position.set(nx, 1.25, 12.2);
      spireGroup.add(nymphPedestal);

      const nymphs = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 1.4), statueMat);
      nymphs.position.set(nx, 4.1, 12.2);
      nymphs.castShadow = true;
      spireGroup.add(nymphs);

      const globe = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), goldMat);
      globe.position.set(nx, 6.2, 12.2);
      spireGroup.add(globe);
    }

    // High relief frieze on attic: "Establishment of the Russian Fleet"
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(20, 2.2, 0.4), trimMat);
    frieze.position.set(0, 16.0, 12.1);
    spireGroup.add(frieze);

    // Four corner classical warrior statues on attic parapet (Achilles, Ajax, Pyrrhus, Alexander)
    for (const sx of [-10, 10]) {
      for (const sz of [-10, 10]) {
        const warrior = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.8, 1.0), statueMat);
        warrior.position.set(sx, 19.4, sz);
        warrior.castShadow = true;
        spireGroup.add(warrior);
      }
    }

    // 2. Ionic Colonnade Peristyle with 28 Classical Statues
    const colonnadeDrum = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 12, 24), trimMat);
    colonnadeDrum.position.y = 24.0;
    colonnadeDrum.castShadow = true;
    spireGroup.add(colonnadeDrum);

    // 28 Classical Statues representing the seasons, elements, winds, and arts
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2;
      const statue = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.2, 0.65), statueMat);
      statue.position.set(Math.cos(ang) * 9.8, 30.2, Math.sin(ang) * 9.8);
      statue.castShadow = true;
      spireGroup.add(statue);
    }

    // 3. Stepped Attic Pyramid with 4 Clocks
    const stepPyramid1 = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 14), trimMat);
    stepPyramid1.position.y = 31.5;
    spireGroup.add(stepPyramid1);

    const stepPyramid2 = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 11), goldMat);
    stepPyramid2.position.y = 34.25;
    spireGroup.add(stepPyramid2);

    // Clock faces on all four sides
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 16), clockMat);
      clock.rotation.x = Math.PI / 2;
      clock.rotation.z = r;
      clock.position.set(Math.sin(r) * 5.6, 34.25, Math.cos(r) * 5.6);
      spireGroup.add(clock);
    }

    // 4. Soaring Golden Needle Spire (72.5m)
    const spireGeo = new THREE.ConeGeometry(2.8, 38, 16);
    const spire = new THREE.Mesh(spireGeo, goldMat);
    spire.position.y = 54.5;
    spire.castShadow = true;
    spireGroup.add(spire);

    // Architectural Floodlight Glow on Spire
    const spireGlow = new THREE.Mesh(new THREE.ConeGeometry(3.0, 38.5, 16), this.floodlightMat);
    spireGlow.position.y = 54.5;
    spireGroup.add(spireGlow);

    // Crowning Golden Sphere & Crown
    const crowningBall = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), goldMat);
    crowningBall.position.y = 73.8;
    spireGroup.add(crowningBall);

    // Golden Ship Weathervane (Кораблик Адмиралтейства — 3-masted frigate)
    const shipHull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 0.6), goldMat);
    shipHull.position.y = 75.5;
    spireGroup.add(shipHull);

    for (const mx of [-0.9, 0, 0.9]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), goldMat);
      mast.position.set(mx, 76.8, 0);
      spireGroup.add(mast);

      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.1), goldMat);
      sail.position.set(mx, 76.8, 0);
      spireGroup.add(sail);
    }

    const shipGlow = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.8, 1.0), this.floodlightMat);
    shipGlow.position.y = 76.0;
    spireGroup.add(shipGlow);

    this.group.add(spireGroup);

    // 5. East and West River Pavilions with Doric Porticoes & Slender Gilded Spires
    const riverPavilions = [
      { x: -198.4, z: 144.1, rot: -0.616, name: 'east-admiralty-pavilion' },  // Facing Palace Square / Palace Bridge
      { x: -551.7, z: 273.2, rot: -0.616, name: 'west-admiralty-pavilion' }   // Facing Senate Square / Bronze Horseman
    ];

    for (const rp of riverPavilions) {
      const pavGroup = new THREE.Group();
      pavGroup.name = rp.name;
      pavGroup.position.set(rp.x, 0.5, rp.z);
      pavGroup.rotation.y = rp.rot;

      const pavBody = new THREE.Mesh(new THREE.BoxGeometry(14, 18, 14), ochreMat);
      pavBody.position.y = 9.0;
      pavGroup.add(pavBody);

      // 6-column Doric Portico
      for (let cx = -4.5; cx <= 4.5; cx += 1.8) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 14, 8), trimMat);
        col.position.set(cx, 7.0, 7.5);
        pavGroup.add(col);
      }

      const ped = new THREE.Mesh(createPedimentGeometry(14, 4.0, 2.5), trimMat);
      ped.position.set(0, 16.0, 7.5);
      pavGroup.add(ped);

      // Pavilion gilded needle spire
      const pavSpire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 18, 8), goldMat);
      pavSpire.position.y = 27.0;
      pavSpire.castShadow = true;
      pavGroup.add(pavSpire);

      this.group.add(pavGroup);
    }
  }

  /**
   * Купол Исаакиевского собора (St. Isaac's Cathedral Authentic 3D Architectural Reconstruction)
   * Exact GPS: 59.934083 N, 30.306122 E -> World: x=-472.3, z=641.1
   * 4 Grand Octastyle Porticoes with 48 monolithic Rapakivi granite columns (17m tall),
   * Rotunda colonnade with 24 columns, tourist balustrade viewing platform (смотровая площадка),
   * 24 bronze angel statues on drum attic, 101.5m ribbed golden dome, and 4 corner campaniles.
   */
  private buildStIsaacsDome() {
    const isaacGroup = new THREE.Group();
    isaacGroup.name = 'st-isaacs-dome';
    isaacGroup.position.set(-472.3, 28.0, 641.1);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.isaacGranite, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x38352f, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });

    // 1. Four Grand Porticoes with Monolithic Rapakivi Granite Columns (17m tall)
    // South Portico (facing St. Isaac's Square, z = +34)
    // North Portico (facing Senate Square and Bronze Horseman, z = -34)
    // East Portico (facing Nevsky Prospekt, x = +34)
    // West Portico (facing Decembrists Square, x = -34)
    const porticoConfigs = [
      { x: 0, z: 34, rot: 0, isOctastyle: true },           // South
      { x: 0, z: -34, rot: Math.PI, isOctastyle: true },     // North
      { x: 34, z: 0, rot: Math.PI / 2, isOctastyle: false }, // East
      { x: -34, z: 0, rot: -Math.PI / 2, isOctastyle: false } // West
    ];

    for (const p of porticoConfigs) {
      const portGroup = new THREE.Group();
      portGroup.position.set(p.x, -28.0, p.z);
      portGroup.rotation.y = p.rot;

      // Granite stylobate steps
      const stylobate = new THREE.Mesh(new THREE.BoxGeometry(p.isOctastyle ? 42 : 28, 2.5, 14), graniteMat);
      stylobate.position.set(0, 1.25, 0);
      stylobate.receiveShadow = true;
      portGroup.add(stylobate);

      // 16 or 8 monolithic columns (front rank + inner rank)
      const numFrontCols = p.isOctastyle ? 8 : 6;
      const colSpacing = (p.isOctastyle ? 36 : 22) / (numFrontCols - 1);

      for (let row = 0; row < 2; row++) {
        const rowZ = 4.5 - row * 4.2;
        for (let c = 0; c < numFrontCols; c++) {
          const cx = -((numFrontCols - 1) * colSpacing) / 2 + c * colSpacing;

          // Column shaft: 17m height, Rapakivi red-brown granite
          const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 17.0, 12), graniteMat);
          colShaft.position.set(cx, 11.0, rowZ);
          colShaft.castShadow = true;
          portGroup.add(colShaft);

          // Bronze Corinthian Capital & Base
          const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 2.3), bronzeMat);
          cap.position.set(cx, 19.8, rowZ);
          portGroup.add(cap);

          const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 2.4), bronzeMat);
          base.position.set(cx, 2.9, rowZ);
          portGroup.add(base);
        }
      }

      // Monumental Triangular Pediment with Bronze High-Relief
      const entablature = new THREE.Mesh(new THREE.BoxGeometry(p.isOctastyle ? 44 : 30, 2.8, 14), stoneMat);
      entablature.position.set(0, 21.9, 0);
      portGroup.add(entablature);

      const pedGeo = createPedimentGeometry(p.isOctastyle ? 42 : 28, 7.5, 3.2);
      const pediment = new THREE.Mesh(pedGeo, stoneMat);
      pediment.position.set(0, 23.3 + 3.75, 4.5);
      pediment.castShadow = true;
      portGroup.add(pediment);

      // Bronze High-Relief in Tympanum
      const tympanumRelief = new THREE.Mesh(new THREE.BoxGeometry(p.isOctastyle ? 18 : 12, 3.5, 0.5), bronzeMat);
      tympanumRelief.position.set(0, 25.5, 6.2);
      portGroup.add(tympanumRelief);

      // Statues of the Holy Apostles at the pediment corners
      for (const ax of [-18, 0, 18]) {
        const apostle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), bronzeMat);
        apostle.position.set(ax * (p.isOctastyle ? 1.0 : 0.65), 30.5, 5.0);
        apostle.castShadow = true;
        portGroup.add(apostle);
      }

      isaacGroup.add(portGroup);
    }

    // 2. Monumental Rotunda Colonnade (смотровая площадка)
    // Drum with 12 arched windows
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(19.5, 21.5, 16, 24), stoneMat);
    drum.position.y = 8;
    drum.castShadow = true;
    isaacGroup.add(drum);

    // 24 Monolithic Rapakivi Granite Columns around the drum
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const colX = Math.cos(ang) * 20.8;
      const colZ = Math.sin(ang) * 20.8;

      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.98, 14.5, 10), graniteMat);
      col.position.set(colX, 8, colZ);
      col.castShadow = true;
      isaacGroup.add(col);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.0, 2.1), bronzeMat);
      cap.position.set(colX, 15.6, colZ);
      isaacGroup.add(cap);
    }

    // Tourist Balustrade Viewing Platform (Смотровая площадка колоннады)
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(22.2, 22.2, 1.4, 32), stoneMat);
    platform.position.y = 16.5;
    isaacGroup.add(platform);

    const balustradeRailing = new THREE.Mesh(new THREE.CylinderGeometry(22.0, 22.0, 1.1, 32, 1, true), bronzeMat);
    balustradeRailing.position.y = 17.5;
    isaacGroup.add(balustradeRailing);

    // Upper Attic Drum with 24 Bronze Angel Statues
    const atticDrum = new THREE.Mesh(new THREE.CylinderGeometry(18.2, 18.8, 6.0, 24), stoneMat);
    atticDrum.position.y = 19.5;
    isaacGroup.add(atticDrum);

    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const angel = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.8, 1.0), bronzeMat);
      angel.position.set(Math.cos(ang) * 19.2, 21.0, Math.sin(ang) * 19.2);
      angel.castShadow = true;
      isaacGroup.add(angel);
    }

    // 3. Colossal Ribbed Golden Dome (101.5m total height)
    const domeGeo = new THREE.SphereGeometry(17.8, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, goldMat);
    dome.position.y = 22.5;
    dome.scale.set(1.0, 1.25, 1.0);
    dome.castShadow = true;
    isaacGroup.add(dome);

    // 12 Ribs of the Golden Dome
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.75, 18.0, 0.75), goldMat);
      rib.position.set(Math.cos(ang) * 12.0, 31.0, Math.sin(ang) * 12.0);
      rib.rotation.z = Math.cos(ang) * 0.45;
      rib.rotation.x = -Math.sin(ang) * 0.45;
      isaacGroup.add(rib);
    }

    // Architectural Floodlight Glow on Main Dome
    const domeGlow = new THREE.Mesh(new THREE.SphereGeometry(18.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.floodlightMat);
    domeGlow.position.y = 22.5;
    domeGlow.scale.set(1.0, 1.25, 1.0);
    isaacGroup.add(domeGlow);

    // Gilded Upper Light Lantern & Colonnade
    const lanternDrum = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 8.5, 16), stoneMat);
    lanternDrum.position.y = 48.0;
    lanternDrum.castShadow = true;
    isaacGroup.add(lanternDrum);

    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const lCol = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 7.5, 8), graniteMat);
      lCol.position.set(Math.cos(ang) * 4.8, 48.0, Math.sin(ang) * 4.8);
      isaacGroup.add(lCol);
    }

    const lanternCupola = new THREE.Mesh(new THREE.SphereGeometry(4.2, 16, 12), goldMat);
    lanternCupola.position.y = 53.0;
    lanternCupola.scale.set(1.0, 1.35, 1.0);
    lanternCupola.castShadow = true;
    isaacGroup.add(lanternCupola);

    // Crowning Gilded Orthodox Cross (6.5m)
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.5, 3.2), goldMat);
    cross.position.y = 60.5;
    isaacGroup.add(cross);

    // 4. Four Corner Campaniles (Bell Towers)
    const belfryOffset = 26;
    for (const bx of [-belfryOffset, belfryOffset]) {
      for (const bz of [-belfryOffset, belfryOffset]) {
        const bGroup = new THREE.Group();
        bGroup.position.set(bx, 0, bz);

        // Square stone base
        const bBase = new THREE.Mesh(new THREE.BoxGeometry(10, 14, 10), stoneMat);
        bBase.position.y = 7;
        bBase.castShadow = true;
        bGroup.add(bBase);

        // Open belfry tier with Rapakivi granite columns
        for (const cx of [-4, 4]) {
          for (const cz of [-4, 4]) {
            const bCol = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 9.0, 8), graniteMat);
            bCol.position.set(cx, 16.5, cz);
            bGroup.add(bCol);
          }
        }

        // Bronze bells visible inside belfry
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.0, 3.2, 10), bronzeMat);
        bell.position.y = 16.5;
        bGroup.add(bell);

        // Gilded dome with cross
        const bDome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
        bDome.position.y = 21.0;
        bDome.scale.set(1.0, 1.25, 1.0);
        bDome.castShadow = true;
        bGroup.add(bDome);

        const bCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.5, 1.8), goldMat);
        bCross.position.y = 28.0;
        bGroup.add(bCross);

        isaacGroup.add(bGroup);
      }
    }

    this.group.add(isaacGroup);
  }

  /**
   * Шпиль Петропавловского собора (Peter & Paul Cathedral Petrine Baroque Ensemble)
   * Exact GPS: 59.950200 N, 30.316670 E -> World: x=108.5, z=-1155.0
   * 122.5m Golden Needle Spire by Domenico Trezzini, flying Angel with cross (Парящий ангел),
   * 3-tier Petrine Baroque bell tower with carillon clock, and hall church with cupolas.
   */
  private buildPeterAndPaulSpire() {
    const ppGroup = new THREE.Group();
    ppGroup.name = 'peter-and-paul-spire';
    ppGroup.position.set(108.5, 18.0, -1155.0);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const ochreMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbOchre, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });
    const clockMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    // 1. Petrine Baroque Bell Tower (3 Tiers)
    // Tier 1: Monumental square base with white stone pilasters
    const tier1 = new THREE.Mesh(new THREE.BoxGeometry(17, 18, 17), ochreMat);
    tier1.position.y = 9;
    tier1.castShadow = true;
    ppGroup.add(tier1);

    // Decorative white corner pilasters and western portal pediment
    const portal = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 1.2), stoneMat);
    portal.position.set(-8.6, 4.5, 0);
    ppGroup.add(portal);

    // Baroque volutes (волюты) connecting Tier 1 to Tier 2
    for (const vz of [-7.5, 7.5]) {
      const volute = new THREE.Mesh(new THREE.BoxGeometry(4.5, 8.0, 1.5), stoneMat);
      volute.position.set(0, 18.0, vz);
      ppGroup.add(volute);
    }

    // Tier 2: Carillon Clock Tier with gilded dials on all 4 faces
    const tier2 = new THREE.Mesh(new THREE.BoxGeometry(13.5, 15, 13.5), ochreMat);
    tier2.position.y = 25.5;
    tier2.castShadow = true;
    ppGroup.add(tier2);

    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16), clockMat);
      clock.rotation.x = Math.PI / 2;
      clock.rotation.z = r;
      clock.position.set(Math.sin(r) * 6.9, 26.5, Math.cos(r) * 6.9);
      ppGroup.add(clock);
    }

    // Tier 3: Octagonal Belfry with open sound apertures
    const tier3 = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.5, 12, 8), stoneMat);
    tier3.position.y = 39.0;
    tier3.castShadow = true;
    ppGroup.add(tier3);

    // Gilded baroque roof transition
    const roofTransition = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 6.2, 5.0, 8), goldMat);
    roofTransition.position.y = 47.5;
    roofTransition.castShadow = true;
    ppGroup.add(roofTransition);

    // 2. 122.5m Golden Needle Spire (40m towering gilded needle)
    const spireGeo = new THREE.ConeGeometry(3.2, 58, 16);
    const spire = new THREE.Mesh(spireGeo, goldMat);
    spire.position.y = 76.5;
    spire.castShadow = true;
    ppGroup.add(spire);

    // Architectural Floodlight Glow on Spire
    const needleGlow = new THREE.Mesh(new THREE.ConeGeometry(3.4, 58.5, 16), this.floodlightMat);
    needleGlow.position.y = 76.5;
    ppGroup.add(needleGlow);

    // Golden Sphere atop spire
    const goldSphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), goldMat);
    goldSphere.position.y = 105.8;
    ppGroup.add(goldSphere);

    // Flying Angel with Cross (Парящий ангел с крестом, 3.2m tall)
    const angelBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), goldMat);
    angelBody.position.set(0, 107.5, 0.5);
    angelBody.rotation.x = 0.25;
    angelBody.castShadow = true;
    ppGroup.add(angelBody);

    // Angel Wings
    const wings = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 0.25), goldMat);
    wings.position.set(0, 108.2, 0.2);
    ppGroup.add(wings);

    // Gilded Cross held in Angel's hand
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 1.8), goldMat);
    cross.position.set(0.6, 108.5, 0.8);
    ppGroup.add(cross);

    // 3. Hall Church Body (extended eastward behind the bell tower)
    const hallBody = new THREE.Mesh(new THREE.BoxGeometry(45, 16, 26), ochreMat);
    hallBody.position.set(30, 8, 0);
    hallBody.castShadow = true;
    ppGroup.add(hallBody);

    const hallRoof = new THREE.Mesh(new THREE.ConeGeometry(18, 7, 4), new THREE.MeshLambertMaterial({ color: PALETTE.roofCopperGreen, flatShading: true }));
    hallRoof.scale.set(46 / 18, 1.0, 28 / 18);
    hallRoof.rotation.y = Math.PI / 4;
    hallRoof.position.set(30, 19.5, 0);
    ppGroup.add(hallRoof);

    // Eastern cupola over cathedral body
    const eastCupola = new THREE.Mesh(new THREE.SphereGeometry(3.0, 10, 8), goldMat);
    eastCupola.scale.set(1.0, 1.3, 1.0);
    eastCupola.position.set(44, 25.0, 0);
    ppGroup.add(eastCupola);

    this.group.add(ppGroup);
  }

  /**
   * Бастионы Петропавловской крепости и орудия Полуденного выстрела
   * Нарышкин бастион, Флагшточная башня с флагом, Невская куртина, Невские ворота,
   * Комендантская пристань и сигнальные пушки Д-30.
   */
  private buildPeterAndPaulBastions() {
    const ppFortress = new THREE.Group();
    ppFortress.name = 'peter-and-paul-bastions';

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const grayGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteGray, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x2b3036, flatShading: true });
    const roofCopperMat = new THREE.MeshLambertMaterial({ color: 0x4f8268, flatShading: true });

    // 1. Нарышкин бастион (Naryshkin Bastion)
    // Шестиугольный гранитный бастион, выступающий в акваторию Невы
    const naryshkinBase = new THREE.Mesh(new THREE.CylinderGeometry(36, 42, 13.5, 6), pinkGraniteMat);
    naryshkinBase.position.set(160, 6.75, -985);
    naryshkinBase.rotation.y = Math.PI / 6;
    naryshkinBase.castShadow = true;
    naryshkinBase.receiveShadow = true;
    ppFortress.add(naryshkinBase);

    // Гранитный парапет по периметру площадки
    const parapet = new THREE.Mesh(new THREE.CylinderGeometry(36.5, 36.5, 1.4, 6, 1, true), grayGraniteMat);
    parapet.position.set(160, 14.2, -985);
    parapet.rotation.y = Math.PI / 6;
    ppFortress.add(parapet);

    // 2. Флагшточная башня Нарышкина бастиона (Flagstaff Tower)
    const flagTower = new THREE.Group();
    flagTower.position.set(171, 13.5, -957);

    // Восьмигранный каменный павильон
    const towerBody = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 7.5, 8), stoneMat);
    towerBody.position.y = 3.75;
    towerBody.castShadow = true;
    flagTower.add(towerBody);

    // Смотровые окна-арки
    for (let i = 0; i < 4; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.4), metalMat);
      const ang = (i / 4) * Math.PI * 2;
      win.position.set(Math.sin(ang) * 3.7, 4.2, Math.cos(ang) * 3.7);
      win.rotation.y = ang;
      flagTower.add(win);
    }

    // Восьмигранный медный шатер
    const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 4.2, 8), roofCopperMat);
    towerRoof.position.y = 9.6;
    towerRoof.castShadow = true;
    flagTower.add(towerRoof);

    // Флагшток и императорский гюйс
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 11.0, 8), stoneMat);
    pole.position.y = 15.0;
    flagTower.add(pole);

    const flagGeo = new THREE.PlaneGeometry(3.2, 2.0);
    const flagMat = new THREE.MeshLambertMaterial({
      color: 0x2b5299,
      side: THREE.DoubleSide
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(1.7, 18.5, 0);
    flagTower.add(flag);

    ppFortress.add(flagTower);

    // 3. Сигнальные гаубицы Д-30 на Нарышкином бастионе (Noon Signal Cannons)
    const gunPositions = [
      { x: 165, y: 13.5, z: -963 },
      { x: 174, y: 13.5, z: -966 }
    ];

    for (const gp of gunPositions) {
      const gunGroup = new THREE.Group();
      gunGroup.position.set(gp.x, gp.y, gp.z);

      const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 2.8), metalMat);
      carriage.position.y = 0.55;
      gunGroup.add(carriage);

      for (const wx of [-0.85, 0.85]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.35, 12), metalMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.65, 0.2);
        gunGroup.add(wheel);
      }

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 4.2, 10), metalMat);
      barrel.rotation.x = Math.PI / 2 - 0.12;
      barrel.position.set(0, 1.25, 1.2);
      barrel.castShadow = true;
      gunGroup.add(barrel);

      ppFortress.add(gunGroup);
    }

    // 4. Визуальные эффекты пушечного выстрела (Flash, Smoke, Shockwave)
    this.cannonFlashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.0 })
    );
    this.cannonFlashMesh.position.set(165, 15.2, -960);
    ppFortress.add(this.cannonFlashMesh);

    this.cannonFlashLight = new THREE.PointLight(0xffcc44, 0.0, 140);
    this.cannonFlashLight.position.set(165, 15.5, -960);
    ppFortress.add(this.cannonFlashLight);

    this.cannonSmokeGroup = new THREE.Group();
    this.cannonSmokeGroup.position.set(165, 15.5, -960);

    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0xf5f5f5,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.cannonSmokeMeshes = [];
    for (let i = 0; i < 9; i++) {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), smokeMat.clone());
      this.cannonSmokeGroup.add(sm);
      this.cannonSmokeMeshes.push({
        mesh: sm,
        baseVel: new THREE.Vector3(
          (Math.random() - 0.3) * 6.5,
          3.5 + Math.random() * 5.5,
          (Math.random() - 0.6) * 6.5
        ),
        seed: Math.random() * Math.PI * 2
      });
    }
    ppFortress.add(this.cannonSmokeGroup);

    const shockwaveGeo = new THREE.RingGeometry(0.5, 2.5, 32);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    this.cannonShockwave = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    this.cannonShockwave.rotation.x = -Math.PI / 2;
    this.cannonShockwave.position.set(165, 0.2, -960);
    ppFortress.add(this.cannonShockwave);

    // 5. Невская куртина и Невские ворота (Nevsky Curtain & Gate)
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(110, 13.0, 16.0), pinkGraniteMat);
    curtain.position.set(65, 6.5, -1015);
    curtain.rotation.y = 0.22;
    curtain.castShadow = true;
    curtain.receiveShadow = true;
    ppFortress.add(curtain);

    const gateGroup = new THREE.Group();
    gateGroup.position.set(72, 0, -1005);
    gateGroup.rotation.y = 0.22;

    const gatePortico = new THREE.Mesh(new THREE.BoxGeometry(14, 14.5, 3.5), grayGraniteMat);
    gatePortico.position.set(0, 7.25, 0);
    gateGroup.add(gatePortico);

    for (const cx of [-4.5, -1.5, 1.5, 4.5]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 11.5, 12), grayGraniteMat);
      col.position.set(cx, 5.75, 2.0);
      col.castShadow = true;
      gateGroup.add(col);
    }

    const pediment = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3.5, 4), grayGraniteMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.position.set(0, 13.5, 1.0);
    gateGroup.add(pediment);

    ppFortress.add(gateGroup);

    // 6. Комендантская пристань со ступенями в Неву (Commandant's Pier)
    const pier = new THREE.Mesh(new THREE.BoxGeometry(22, 1.8, 18), grayGraniteMat);
    pier.position.set(72, 0.9, -990);
    pier.rotation.y = 0.22;
    pier.castShadow = true;
    ppFortress.add(pier);

    for (let step = 0; step < 4; step++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(18, 0.45, 1.6), pinkGraniteMat);
      st.position.set(72, 0.45 - step * 0.4, -980 + step * 1.5);
      st.rotation.y = 0.22;
      ppFortress.add(st);
    }

    // 7. Государев бастион (Gosudarev Bastion)
    const gosuBase = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 13.5, 6), pinkGraniteMat);
    gosuBase.position.set(-35, 6.75, -1035);
    gosuBase.rotation.y = -Math.PI / 8;
    gosuBase.castShadow = true;
    gosuBase.receiveShadow = true;
    ppFortress.add(gosuBase);

    // 8. Трубецкой бастион (Trubetskoy Bastion)
    const trubBase = new THREE.Mesh(new THREE.CylinderGeometry(32, 38, 13.5, 6), pinkGraniteMat);
    trubBase.position.set(275, 6.75, -995);
    trubBase.rotation.y = Math.PI / 5;
    trubBase.castShadow = true;
    trubBase.receiveShadow = true;
    ppFortress.add(trubBase);

    this.group.add(ppFortress);
  }

  /**
   * Архитектурный ансамбль острова Новая Голландия
   * Монументальная Арка Валлен-Деламота над каналом, кольцевой замок «Бутылка»,
   * корпуса кирпичных лесных складов, внутренний ковш и парк.
   */
  private buildNewHollandIsland() {
    const nhGroup = new THREE.Group();
    nhGroup.name = 'new-holland-ensemble';

    const brickMat = new THREE.MeshLambertMaterial({ color: 0x9b382d, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const roofZincMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofDarkZinc, flatShading: true });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x6e4e37, flatShading: true });
    const lawnMat = new THREE.MeshLambertMaterial({ color: 0x4f8f3c, flatShading: true });

    // 1. Монументальная Арка Новой Голландии (Vallin de la Mothe Arch)
    // Координаты: x = -1333.7, z = 1277.1
    const archGroup = new THREE.Group();
    archGroup.position.set(-1333.7, 0, 1277.1);

    const leftPylon = new THREE.Mesh(new THREE.BoxGeometry(8.5, 23.0, 7.5), brickMat);
    leftPylon.position.set(-9.5, 11.5, 0);
    leftPylon.castShadow = true;
    leftPylon.receiveShadow = true;
    archGroup.add(leftPylon);

    const rightPylon = new THREE.Mesh(new THREE.BoxGeometry(8.5, 23.0, 7.5), brickMat);
    rightPylon.position.set(9.5, 11.5, 0);
    rightPylon.castShadow = true;
    rightPylon.receiveShadow = true;
    archGroup.add(rightPylon);

    // Колоннада из тосканских гранитных колонн
    for (const cx of [-13.2, -6.0, 6.0, 13.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 18.5, 12), stoneMat);
      col.position.set(cx, 9.25, 4.0);
      col.castShadow = true;
      archGroup.add(col);

      const colRear = col.clone();
      colRear.position.z = -4.0;
      archGroup.add(colRear);
    }

    // Полуциркульный арочный свод
    const archVault = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 7.6, 16, 1, false, 0, Math.PI), stoneMat);
    archVault.rotation.z = Math.PI / 2;
    archVault.rotation.x = Math.PI / 2;
    archVault.position.set(0, 16.5, 0);
    archVault.castShadow = true;
    archGroup.add(archVault);

    // Кирпичный аттик и карниз
    const attic = new THREE.Mesh(new THREE.BoxGeometry(27.8, 5.5, 7.8), brickMat);
    attic.position.set(0, 20.25, 0);
    attic.castShadow = true;
    archGroup.add(attic);

    const cornice = new THREE.Mesh(new THREE.BoxGeometry(28.6, 1.2, 8.4), stoneMat);
    cornice.position.set(0, 23.4, 0);
    archGroup.add(cornice);

    nhGroup.add(archGroup);

    // 2. Кольцевой замок «Бутылка» (The Bottle Building)
    const bottleGroup = new THREE.Group();
    bottleGroup.position.set(-1395, 0, 1235);

    const bottleWall = new THREE.Mesh(
      new THREE.CylinderGeometry(26, 26, 15.5, 32, 1, false, 0.15, Math.PI * 2 - 0.3),
      brickMat
    );
    bottleWall.position.y = 7.75;
    bottleWall.castShadow = true;
    bottleWall.receiveShadow = true;
    bottleGroup.add(bottleWall);

    const innerCourtyard = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 14, 15.6, 24, 1, true),
      brickMat
    );
    innerCourtyard.position.y = 7.75;
    bottleGroup.add(innerCourtyard);

    const bottleRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(24, 27, 4.5, 32, 1, false, 0.15, Math.PI * 2 - 0.3),
      roofZincMat
    );
    bottleRoof.position.y = 17.5;
    bottleRoof.castShadow = true;
    bottleGroup.add(bottleRoof);

    const bGate = new THREE.Mesh(new THREE.BoxGeometry(4.5, 6.0, 14.0), stoneMat);
    bGate.position.set(0, 3.0, 20.0);
    bottleGroup.add(bGate);

    nhGroup.add(bottleGroup);

    // 3. Кирпичные лесные склады (Historic Timber Storehouses)
    const storehouseWing1 = new THREE.Mesh(new THREE.BoxGeometry(110, 14.5, 18), brickMat);
    storehouseWing1.position.set(-1430, 7.25, 1145);
    storehouseWing1.rotation.y = 0.45;
    storehouseWing1.castShadow = true;
    storehouseWing1.receiveShadow = true;
    nhGroup.add(storehouseWing1);

    const roofWing1 = new THREE.Mesh(new THREE.ConeGeometry(14, 5.5, 4), roofZincMat);
    roofWing1.scale.set(112 / 14, 1.0, 20 / 14);
    roofWing1.rotation.y = 0.45 + Math.PI / 4;
    roofWing1.position.set(-1430, 16.5, 1145);
    roofWing1.castShadow = true;
    nhGroup.add(roofWing1);

    const storehouseWing2 = new THREE.Mesh(new THREE.BoxGeometry(95, 14.5, 18), brickMat);
    storehouseWing2.position.set(-1270, 7.25, 1205);
    storehouseWing2.rotation.y = -0.35;
    storehouseWing2.castShadow = true;
    storehouseWing2.receiveShadow = true;
    nhGroup.add(storehouseWing2);

    const roofWing2 = new THREE.Mesh(new THREE.ConeGeometry(14, 5.5, 4), roofZincMat);
    roofWing2.scale.set(97 / 14, 1.0, 20 / 14);
    roofWing2.rotation.y = -0.35 + Math.PI / 4;
    roofWing2.position.set(-1270, 16.5, 1205);
    roofWing2.castShadow = true;
    nhGroup.add(roofWing2);

    // 4. Внутренний ковш и набережные Новой Голландии (Inner Basin & Boardwalk)
    for (const side of [-1, 1]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.45, 65), woodMat);
      pier.position.set(-1334 + side * 28, 0.4, 1160);
      nhGroup.add(pier);
    }
    const pierNorth = new THREE.Mesh(new THREE.BoxGeometry(58, 0.45, 5.0), woodMat);
    pierNorth.position.set(-1334, 0.4, 1128);
    nhGroup.add(pierNorth);

    const parkLawn = new THREE.Mesh(new THREE.BoxGeometry(45, 0.35, 40), lawnMat);
    parkLawn.position.set(-1334, 0.25, 1200);
    nhGroup.add(parkLawn);

    // Историческое здание Кузни (The Smithy)
    const forge = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 12), brickMat);
    forge.position.set(-1305, 3.25, 1120);
    forge.castShadow = true;
    nhGroup.add(forge);

    const forgeRoof = new THREE.Mesh(new THREE.ConeGeometry(10, 3.5, 4), roofZincMat);
    forgeRoof.scale.set(18 / 10, 1.0, 14 / 10);
    forgeRoof.rotation.y = Math.PI / 4;
    forgeRoof.position.set(-1305, 7.8, 1120);
    nhGroup.add(forgeRoof);

    this.group.add(nhGroup);
  }

  public fireNoonCannon(): boolean {
    this.cannonShotTimer = 0.0;
    this.cannonAudio.playBoom();

    if (this.cannonFlashMesh) {
      (this.cannonFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
      this.cannonFlashLight.intensity = 5.0;
    }

    for (const sm of this.cannonSmokeMeshes) {
      sm.mesh.position.set(0, 0, 0);
      sm.mesh.scale.set(0.5, 0.5, 0.5);
      (sm.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    }

    if (this.cannonShockwave) {
      this.cannonShockwave.scale.set(1.0, 1.0, 1.0);
      (this.cannonShockwave.material as THREE.MeshBasicMaterial).opacity = 0.85;
    }

    return true;
  }

  /**
   * Ростральные колонны (Rostral Columns on the Spit of Vasilyevsky Island)
   * North: GPS 59.944200 N, 30.307500 E -> World: x=-393.67, z=-486.24
   * South: GPS 59.943300 N, 30.305600 E -> World: x=-499.62, z=-386.06
   * 32m red terracotta columns, 4 tiers of bronze warship rostra,
   * colossal seated granite river statues (Volga, Dnieper, Neva, Volkhov), and gas brazier flames.
   */
  private buildRostralColumns() {
    const rostralMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbTerracotta, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const statueMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteGray, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x24282e, flatShading: true });

    const positions = [
      { x: -530.6, z: -538.2, name: 'north-rostral', rivers: ['Volga', 'Dnieper'] },
      { x: -426.4, z: -363.8, name: 'south-rostral', rivers: ['Neva', 'Volkhov'] }
    ];

    for (const p of positions) {
      const colGroup = new THREE.Group();
      colGroup.name = p.name;
      colGroup.position.set(p.x, 0.5, p.z);

      // 1. Granite Pedestal & Steps
      const baseSteps = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 14), graniteMat);
      baseSteps.position.y = 0.9;
      baseSteps.receiveShadow = true;
      colGroup.add(baseSteps);

      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.5, 9.5), graniteMat);
      pedestal.position.y = 4.05;
      pedestal.castShadow = true;
      colGroup.add(pedestal);

      // Colossal Seated River God Statues at base (Скульптуры рек: Волга, Днепр, Нева, Волхов)
      for (const side of [-1, 1]) {
        const riverStatue = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.0), statueMat);
        riverStatue.position.set(side * 4.6, 3.8, 0);
        riverStatue.castShadow = true;
        colGroup.add(riverStatue);

        // Water urn / oar attribute
        const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 2.0, 8), bronzeMat);
        urn.rotation.z = Math.PI / 4;
        urn.position.set(side * 5.2, 2.6, 0.8);
        colGroup.add(urn);
      }

      // 2. Red Terracotta Doric Column Shaft (32m high)
      const column = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 26, 16), rostralMat);
      column.position.y = 19.3;
      column.castShadow = true;
      colGroup.add(column);

      // 3. Bronze Ship Prows (Ростры вражеских кораблей) in 4 alternating tiers
      const tiersY = [9.5, 13.8, 18.0, 22.2];
      for (let t = 0; t < tiersY.length; t++) {
        const y = tiersY[t];
        const isOdd = t % 2 === 1;

        const rostrumL = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5.5, 6), bronzeMat);
        rostrumL.rotation.z = isOdd ? Math.PI / 2 : 0;
        rostrumL.rotation.x = isOdd ? 0 : Math.PI / 2;
        rostrumL.position.set(isOdd ? -4.2 : 0, y, isOdd ? 0 : 4.2);
        rostrumL.castShadow = true;
        colGroup.add(rostrumL);

        const rostrumR = new THREE.ConeGeometry(1.2, 5.5, 6);
        const rMesh = new THREE.Mesh(rostrumR, bronzeMat);
        rMesh.rotation.z = isOdd ? -Math.PI / 2 : 0;
        rMesh.rotation.x = isOdd ? 0 : -Math.PI / 2;
        rMesh.position.set(isOdd ? 4.2 : 0, y, isOdd ? 0 : -4.2);
        rMesh.castShadow = true;
        colGroup.add(rMesh);
      }

      // 4. Doric Capital & Cast-Iron Gas Brazier Tripod
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 2.8, 2.2, 16), graniteMat);
      cap.position.y = 32.8;
      colGroup.add(cap);

      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.8, 2.8, 12), bronzeMat);
      brazier.position.y = 35.0;
      colGroup.add(brazier);

      // Flaming Torch for White Nights and holidays
      const flame = new THREE.Mesh(new THREE.ConeGeometry(2.5, 6.2, 10), this.rostralFlameMat);
      flame.position.y = 39.5;
      colGroup.add(flame);

      this.group.add(colGroup);
    }
  }

  /**
   * Арка Главного штаба и Колесница Славы (Carlo Rossi Triumphal Arch & Chariot of Glory)
   * Exact GPS: 59.937748 N, 30.316498 E -> World: x=108.06, z=231.99
   * Double Triumphal Arch spanning Bolshaya Morskaya Street onto Palace Square,
   * coffered vault, paired Corinthian columns, statues in wall niches, military trophy friezes,
   * and the colossal 6-horse Chariot of Glory with Winged Victory (Ника) and Roman warriors.
   */
  private buildGeneralStaffChariot() {
    const archGroup = new THREE.Group();
    archGroup.name = 'general-staff-arch';
    archGroup.position.set(108.06, 0.0, 231.99);

    const ochreMat = new THREE.MeshLambertMaterial({ color: PALETTE.empireYellow, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x363c37, flatShading: true });

    // 1. Carlo Rossi Double Triumphal Arch Structure
    // Left and Right Monumental Pylons
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(8, 24, 20), ochreMat);
      pylon.position.set(side * 14.5, 12, 0);
      pylon.castShadow = true;
      archGroup.add(pylon);

      // Paired White Corinthian Columns on outer facade
      for (const cx of [-2.5, 2.5]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 21, 12), trimMat);
        col.position.set(side * 14.5 + cx, 10.5, 10.4);
        col.castShadow = true;
        archGroup.add(col);

        const colRear = col.clone();
        colRear.position.z = -10.4;
        archGroup.add(colRear);
      }

      // Wall Niches with Classical Roman Warrior Statues holding shields
      const niche = new THREE.Mesh(new THREE.BoxGeometry(2.4, 6.5, 1.2), trimMat);
      niche.position.set(side * 14.5, 8.0, 10.2);
      archGroup.add(niche);

      const warrior = new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.0, 0.9), bronzeMat);
      warrior.position.set(side * 14.5, 7.8, 10.5);
      warrior.castShadow = true;
      archGroup.add(warrior);
    }

    // Arch Barrel Vaulting Span across Bolshaya Morskaya Street
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(37, 8, 20), ochreMat);
    archTop.position.set(0, 24, 0);
    archTop.castShadow = true;
    archGroup.add(archTop);

    // Coffered semi-circular arch ceiling underside
    const vaultCeiling = new THREE.Mesh(
      new THREE.CylinderGeometry(10.5, 10.5, 20, 24, 1, true, 0, Math.PI),
      trimMat
    );
    vaultCeiling.rotation.z = Math.PI / 2;
    vaultCeiling.rotation.x = Math.PI / 2;
    vaultCeiling.position.set(0, 16.5, 0);
    archGroup.add(vaultCeiling);

    // High Classical Attic with Military Trophy Frieze (crossing standards, armor, Roman eagles)
    const atticFrieze = new THREE.Mesh(new THREE.BoxGeometry(36, 4.5, 20.4), trimMat);
    atticFrieze.position.set(0, 28.25, 0);
    atticFrieze.castShadow = true;
    archGroup.add(atticFrieze);

    // Relief panels of Winged Glories (летящие гении Славы с венками)
    for (const gx of [-7.0, 7.0]) {
      const glory = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 0.4), bronzeMat);
      glory.position.set(gx, 28.25, 10.3);
      archGroup.add(glory);
    }

    // 2. Colossal Bronze Chariot of Glory (Колесница Славы)
    // Sculptural Base on top of attic
    const chariotPedestal = new THREE.Mesh(new THREE.BoxGeometry(22, 1.4, 12), bronzeMat);
    chariotPedestal.position.set(0, 31.0, 0);
    chariotPedestal.castShadow = true;
    archGroup.add(chariotPedestal);

    // Antique Roman Two-Wheeled Chariot
    const chariotBody = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 4.0), bronzeMat);
    chariotBody.position.set(0, 33.2, 3.5);
    chariotBody.castShadow = true;
    archGroup.add(chariotBody);

    for (const wx of [-2.4, 2.4]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16), bronzeMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 33.0, 3.5);
      archGroup.add(wheel);
    }

    // Winged Goddess of Victory (Ника — 9.94m total height ensemble)
    const nike = new THREE.Mesh(new THREE.BoxGeometry(2.4, 7.5, 1.8), bronzeMat);
    nike.position.set(0, 37.0, 3.2);
    nike.castShadow = true;
    archGroup.add(nike);

    // Soaring Wings of Victory (wingspan 5.5m)
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.0, 0.4), bronzeMat);
      wing.position.set(side * 2.2, 39.5, 4.0);
      wing.rotation.z = side * 0.35;
      wing.rotation.y = side * 0.2;
      archGroup.add(wing);
    }

    // Extended Laurel Wreath in right hand
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 8, 16), bronzeMat);
    wreath.position.set(1.8, 39.8, 2.0);
    wreath.rotation.y = Math.PI / 4;
    archGroup.add(wreath);

    // Imperial Labarum / Standard with Cross in left hand
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8.5, 8), bronzeMat);
    staff.position.set(-1.8, 39.0, 2.5);
    archGroup.add(staff);

    const standardCross = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.0), bronzeMat);
    standardCross.position.set(-1.8, 43.5, 2.5);
    archGroup.add(standardCross);

    // 6 Rearing Bronze Steeds in Dynamic Fan Array
    // Inner pair: forward thrust; Middle pair: rearing high; Outer pair: head turning outwards
    const horseOffsets = [
      { x: -5.0, z: -1.0, rotY: -0.25, rotX: 0.3 },
      { x: -3.0, z: -2.2, rotY: -0.12, rotX: 0.4 },
      { x: -1.0, z: -2.8, rotY: -0.04, rotX: 0.45 },
      { x: 1.0, z: -2.8, rotY: 0.04, rotX: 0.45 },
      { x: 3.0, z: -2.2, rotY: 0.12, rotX: 0.4 },
      { x: 5.0, z: -1.0, rotY: 0.25, rotX: 0.3 }
    ];

    for (const ho of horseOffsets) {
      const hGroup = new THREE.Group();
      hGroup.position.set(ho.x, 32.5, ho.z);
      hGroup.rotation.y = ho.rotY;
      hGroup.rotation.x = ho.rotX;

      // Horse Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 4.2), bronzeMat);
      torso.position.y = 2.2;
      torso.castShadow = true;
      hGroup.add(torso);

      // Arched Neck & Head
      const neck = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.4, 1.8), bronzeMat);
      neck.position.set(0, 3.8, -1.6);
      neck.rotation.x = -0.4;
      neck.castShadow = true;
      hGroup.add(neck);

      // Raised Forelegs
      for (const lx of [-0.45, 0.45]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.4, 6), bronzeMat);
        leg.position.set(lx, 2.2, -2.6);
        leg.rotation.x = 0.6;
        hGroup.add(leg);
      }

      archGroup.add(hGroup);
    }

    // Two Roman Warriors / Legionnaires restraining the steeds at flanks
    for (const side of [-1, 1]) {
      const warrior = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.8, 1.2), bronzeMat);
      warrior.position.set(side * 7.8, 34.0, -1.2);
      warrior.castShadow = true;
      archGroup.add(warrior);

      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.2, 6), bronzeMat);
      spear.position.set(side * 8.4, 35.0, -1.0);
      archGroup.add(spear);
    }

    this.group.add(archGroup);
  }

  /**
   * Медный всадник (The Bronze Horseman on Senate Square)
   * Exact GPS: 59.936389 N, 30.302222 E -> World: x=-693.0, z=383.0
   */
  private buildBronzeHorseman() {
    const monumentGroup = new THREE.Group();
    monumentGroup.name = 'bronze-horseman';
    monumentGroup.position.set(-693.0, 0.05, 383.0);

    const thunderStoneMat = new THREE.MeshLambertMaterial({ color: 0x766c64, flatShading: true }); // Reddish-grey granite
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x2e3532, flatShading: true });

    // 1. The Thunder Stone Pedestal (Гром-камень, 1250 tons monolithic wave-shaped rock)
    const rock = new THREE.Mesh(new THREE.BoxGeometry(11, 4.5, 16), thunderStoneMat);
    rock.position.y = 2.25;
    rock.rotation.y = 0.2;
    rock.castShadow = true;
    monumentGroup.add(rock);

    // 2. Equestrian Statue of Peter the Great
    const horse = new THREE.Mesh(new THREE.BoxGeometry(3.5, 5.5, 6.5), bronzeMat);
    horse.position.set(0, 6.8, 1.0);
    horse.rotation.y = 0.2;
    horse.castShadow = true;
    monumentGroup.add(horse);

    // Emperor Peter I with extended right hand pointing to the Neva
    const peter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.0, 2.0), bronzeMat);
    peter.position.set(0, 10.5, 0.5);
    monumentGroup.add(peter);

    // Trampled Serpent of Treason (Змея под копытами)
    const serpent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 8.0), bronzeMat);
    serpent.position.set(0, 4.8, 1.0);
    monumentGroup.add(serpent);

    this.group.add(monumentGroup);
  }

  /**
   * Спас на Крови (Храм Воскресения Христова — Cathedral of the Resurrection of Christ)
   * Exact GPS: 59.9401 N, 30.3289 E -> World: x=800.2, z=-24.7
   * 81m Central Tented Spire (Шатер) with tiers of kokoshniks,
   * 4 Authentic Jeweled Enamel Onion Domes (green/yellow chevron, blue/white spiral,
   * blue/gold diamond diaper, gold/green fluted), western belfry with 8m golden onion cupola,
   * and eastern altar apses with golden domes.
   */
  private buildSpasNaKroviDomes() {
    const spasGroup = new THREE.Group();
    spasGroup.name = 'spas-na-krovi-ensemble';
    spasGroup.position.set(800.2, 26.0, -24.7);

    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const brickMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbBrick, flatShading: true });

    // Distinct Enamel Materials matching the 4 famous real cupolas
    const matChevronGreen = new THREE.MeshLambertMaterial({ color: 0x2e8b57, flatShading: true }); // Northwest
    const matChevronYellow = new THREE.MeshLambertMaterial({ color: 0xe5a823, flatShading: true });
    const matSpiralBlue = new THREE.MeshLambertMaterial({ color: 0x1f4788, flatShading: true });    // Northeast
    const matSpiralWhite = new THREE.MeshLambertMaterial({ color: 0xf2f5f8, flatShading: true });
    const matDiaperBlue = new THREE.MeshLambertMaterial({ color: 0x233f7c, flatShading: true });     // Southwest
    const matFlutedGreen = new THREE.MeshLambertMaterial({ color: 0x256544, flatShading: true });    // Southeast

    // 1. Central 81m Octagonal Tented Spire (Центральный шатер)
    const tentDrum = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 12.5, 12, 8), stoneMat);
    tentDrum.position.y = 6;
    tentDrum.castShadow = true;
    spasGroup.add(tentDrum);

    // Kokoshnik tiers at base of tent
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const kMesh = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.8, 3), goldMat);
      kMesh.position.set(Math.cos(ang) * 11.2, 12.0, Math.sin(ang) * 11.2);
      kMesh.rotation.y = ang + Math.PI / 2;
      spasGroup.add(kMesh);
    }

    // Tented Spire with glazed tile pattern (32m high octagonal pyramid)
    const tentSpire = new THREE.Mesh(new THREE.ConeGeometry(9.8, 32, 8), matChevronGreen);
    tentSpire.position.y = 28;
    tentSpire.castShadow = true;
    spasGroup.add(tentSpire);

    // Gilded kokoshnik belt halfway up the tent
    const midBelt = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 6.2, 2.5, 8), goldMat);
    midBelt.position.y = 35;
    spasGroup.add(midBelt);

    // Central Light Lantern & Golden Onion Cupola
    const centLantern = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 8, 8), stoneMat);
    centLantern.position.y = 48;
    centLantern.castShadow = true;
    spasGroup.add(centLantern);

    const centDome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12), goldMat);
    centDome.scale.set(1.0, 1.45, 1.0);
    centDome.position.y = 54.5;
    centDome.castShadow = true;
    spasGroup.add(centDome);

    const centCross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.2, 2.6), goldMat);
    centCross.position.y = 61.0;
    spasGroup.add(centCross);

    // 2. Four Authentic Asymmetric Jeweled Enamel Onion Domes
    const domeDist = 18.0;

    // Dome 1 (Northwest): Emerald Green and Yellow Chevron Stripes (Зелено-желтый зигзагообразный)
    const nwGroup = new THREE.Group();
    nwGroup.position.set(-domeDist, 0, -domeDist);
    const nwDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 14, 8), brickMat);
    nwDrum.position.y = 7;
    nwGroup.add(nwDrum);

    const nwDome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), matChevronGreen);
    nwDome.scale.set(1.0, 1.4, 1.0);
    nwDome.position.y = 17;
    nwDome.castShadow = true;
    nwGroup.add(nwDome);

    // Chevron accent bands
    for (const cy of [15.5, 18.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.45, 6, 16), matChevronYellow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = cy;
      nwGroup.add(ring);
    }
    const nwCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 2.2), goldMat);
    nwCross.position.y = 23.5;
    nwGroup.add(nwCross);
    spasGroup.add(nwGroup);

    // Dome 2 (Northeast): Cobalt Blue and White Spiraling Twisted Ribs (Сине-белый спиралевидный)
    const neGroup = new THREE.Group();
    neGroup.position.set(domeDist, 0, -domeDist);
    const neDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 14, 8), brickMat);
    neDrum.position.y = 7;
    neGroup.add(neDrum);

    const neDome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), matSpiralBlue);
    neDome.scale.set(1.0, 1.4, 1.0);
    neDome.position.y = 17;
    neDome.castShadow = true;
    neGroup.add(neDome);

    // Spiral white ribs
    for (let r = 0; r < 8; r++) {
      const ang = (r / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.5, 0.5), matSpiralWhite);
      rib.position.set(Math.cos(ang) * 4.2, 17.0, Math.sin(ang) * 4.2);
      rib.rotation.y = ang;
      rib.rotation.z = 0.35;
      neGroup.add(rib);
    }
    const neCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 2.2), goldMat);
    neCross.position.y = 23.5;
    neGroup.add(neCross);
    spasGroup.add(neGroup);

    // Dome 3 (Southwest): Royal Blue with Gilded Diamond Diaper Grid (Синий с золотыми ромбами)
    const swGroup = new THREE.Group();
    swGroup.position.set(-domeDist, 0, domeDist);
    const swDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 14, 8), brickMat);
    swDrum.position.y = 7;
    swGroup.add(swDrum);

    const swDome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), matDiaperBlue);
    swDome.scale.set(1.0, 1.4, 1.0);
    swDome.position.y = 17;
    swDome.castShadow = true;
    swGroup.add(swDome);

    // Gold diamond diaper accents
    for (let d = 0; d < 8; d++) {
      const ang = (d / 8) * Math.PI * 2;
      const diamond = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.4), goldMat);
      diamond.position.set(Math.cos(ang) * 4.9, 17.0, Math.sin(ang) * 4.9);
      diamond.rotation.y = ang;
      diamond.rotation.z = Math.PI / 4;
      swGroup.add(diamond);
    }
    const swCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 2.2), goldMat);
    swCross.position.y = 23.5;
    swGroup.add(swCross);
    spasGroup.add(swGroup);

    // Dome 4 (Southeast): Gilded and Emerald Green Fluted Gadrooned Ridges (Зелено-золотой ребристый)
    const seGroup = new THREE.Group();
    seGroup.position.set(domeDist, 0, domeDist);
    const seDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 14, 8), brickMat);
    seDrum.position.y = 7;
    seGroup.add(seDrum);

    const seDome = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 12), matFlutedGreen);
    seDome.scale.set(1.0, 1.4, 1.0);
    seDome.position.y = 17;
    seDome.castShadow = true;
    seGroup.add(seDome);

    // Gilded fluted ridges
    for (let f = 0; f < 8; f++) {
      const ang = (f / 8) * Math.PI * 2;
      const fluting = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.8, 0.6), goldMat);
      fluting.position.set(Math.cos(ang) * 4.6, 17.0, Math.sin(ang) * 4.6);
      fluting.rotation.y = ang;
      seGroup.add(fluting);
    }
    const seCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 2.2), goldMat);
    seCross.position.y = 23.5;
    seGroup.add(seCross);
    spasGroup.add(seGroup);

    // 3. Western Bell Tower over Griboedov Canal (Колокольня с гигантским золотым куполом)
    const belfryGroup = new THREE.Group();
    belfryGroup.position.set(-28.0, 0, 0);

    const belfryBody = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 16), brickMat);
    belfryBody.position.y = 11;
    belfryBody.castShadow = true;
    belfryGroup.add(belfryBody);

    // Arched belfry sound openings with stone frames
    for (const side of [-1, 1]) {
      const bArch = new THREE.Mesh(new THREE.BoxGeometry(4.5, 8.5, 0.4), stoneMat);
      bArch.position.set(0, 14, side * 8.2);
      belfryGroup.add(bArch);
    }

    // Monumental 8m Gilded Onion Dome over Bell Tower
    const belfryDome = new THREE.Mesh(new THREE.SphereGeometry(7.0, 20, 16), goldMat);
    belfryDome.scale.set(1.0, 1.45, 1.0);
    belfryDome.position.y = 28.5;
    belfryDome.castShadow = true;
    belfryGroup.add(belfryDome);

    const belfryCross = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.5, 2.8), goldMat);
    belfryCross.position.y = 37.0;
    belfryGroup.add(belfryCross);
    spasGroup.add(belfryGroup);

    // 4. Eastern Altar Apses (Апсиды с 3 малыми золотыми куполами)
    const apseGroup = new THREE.Group();
    apseGroup.position.set(24.0, 0, 0);

    for (const az of [-7.0, 0, 7.0]) {
      const apseDrum = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 12, 12), brickMat);
      apseDrum.position.set(0, 6.0, az);
      apseGroup.add(apseDrum);

      const apseDome = new THREE.Mesh(new THREE.SphereGeometry(3.8, 12, 10), goldMat);
      apseDome.scale.set(1.0, 1.35, 1.0);
      apseDome.position.set(0, 14.0, az);
      apseDome.castShadow = true;
      apseGroup.add(apseDome);

      const aCross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.0, 1.5), goldMat);
      aCross.position.set(0, 18.2, az);
      apseGroup.add(aCross);
    }
    spasGroup.add(apseGroup);

    this.group.add(spasGroup);
  }

  /**
   * Здание Биржи (Stock Exchange Doric Peripteral Temple on the Spit of Vasilyevsky Island)
   * Exact GPS: 59.9438 N, 30.3040 E -> World: x=-554.6, z=-407.8
   * Thomas de Thomon Greek Doric temple: 44 monumental white Doric columns,
   * pink Rapakivi granite stylobate platform with curved carriage ramps (пандусы),
   * Eastern pediment sculptural group "Neptune with Two Rivers (Neva and Volkhov)",
   * and Western pediment sculptural group "Navigation and Mercury".
   */
  private buildStockExchangeColonnade() {
    const bGroup = new THREE.Group();
    bGroup.name = 'stock-exchange-temple';
    bGroup.position.set(-554.6, 0.5, -407.8);
    bGroup.rotation.y = Math.PI * 0.5 + (30.8 * Math.PI / 180);

    const whiteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const statueMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteGray, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x24282e, flatShading: true });

    // 1. Monumental Pink Rapakivi Granite Stylobate Base (Стилобат)
    const base = new THREE.Mesh(new THREE.BoxGeometry(78, 4.5, 106), graniteMat);
    base.position.y = 2.25;
    base.castShadow = true;
    base.receiveShadow = true;
    bGroup.add(base);

    // Granite entrance staircases on East and West
    for (const sz of [-56, 56]) {
      const steps = new THREE.Mesh(new THREE.BoxGeometry(45, 1.8, 8.0), graniteMat);
      steps.position.set(0, 0.9, sz);
      bGroup.add(steps);
    }

    // Curved Carriage Ramps (полуциркульные гранитные пандусы)
    for (const side of [-1, 1]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(8.0, 3.2, 45.0), graniteMat);
      ramp.position.set(side * 42.0, 1.6, 0);
      bGroup.add(ramp);
    }

    // 2. Peripteros of 44 Monumental White Doric Columns
    const colGeo = new THREE.CylinderGeometry(1.3, 1.5, 17.5, 12);

    // East and West colonnades (10 columns each facade)
    for (let x = -32; x <= 32; x += 7.1) {
      // East facade (facing Strelka / Neva)
      const colE = new THREE.Mesh(colGeo, whiteMat);
      colE.position.set(x, 13.25, 47.0);
      colE.castShadow = true;
      bGroup.add(colE);

      // West facade (facing Birzhevoy Prospekt)
      const colW = new THREE.Mesh(colGeo, whiteMat);
      colW.position.set(x, 13.25, -47.0);
      colW.castShadow = true;
      bGroup.add(colW);
    }

    // North and South side colonnades (14 columns each facade)
    for (let z = -40; z <= 40; z += 6.6) {
      const colN = new THREE.Mesh(colGeo, whiteMat);
      colN.position.set(-32.0, 13.25, z);
      colN.castShadow = true;
      bGroup.add(colN);

      const colS = new THREE.Mesh(colGeo, whiteMat);
      colS.position.set(32.0, 13.25, z);
      colS.castShadow = true;
      bGroup.add(colS);
    }

    // 3. Classical Entablature with Triglyphs and Metopes
    const entablature = new THREE.Mesh(new THREE.BoxGeometry(74, 3.5, 102), whiteMat);
    entablature.position.y = 23.5;
    entablature.castShadow = true;
    bGroup.add(entablature);

    // 4. East Pediment Sculptural Group: "Neptune with Two Rivers (Neva and Volkhov)"
    // Facing the Spit of Vasilyevsky Island and the Neva River
    // 4. Authentic Classical Greek Gable Roof & Pediments (двускатная кровля и фронтоны)
    // Span 74m width, 8.5m height, 102m length along Z
    const templeRoof = new THREE.Mesh(createPedimentGeometry(74, 8.5, 102), whiteMat);
    templeRoof.position.set(0, 23.5 + 4.25, 0);
    templeRoof.castShadow = true;
    bGroup.add(templeRoof);

    // East Pediment Sculptural Group: "Neptune with Two Rivers (Neva and Volkhov)"
    // Facing the Spit of Vasilyevsky Island and the Rostral Columns
    const neptune = new THREE.Mesh(new THREE.BoxGeometry(2.4, 5.2, 1.2), statueMat);
    neptune.position.set(0, 28.5, 51.5);
    neptune.castShadow = true;
    bGroup.add(neptune);

    const trident = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.5, 6), bronzeMat);
    trident.position.set(1.4, 30.0, 51.7);
    bGroup.add(trident);

    // River Neva (graceful female figure) and River Volkhov (seated elder)
    for (const side of [-1, 1]) {
      const riverFigure = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 1.0), statueMat);
      riverFigure.position.set(side * 6.5, 27.0, 51.2);
      bGroup.add(riverFigure);
    }

    // 5. West Pediment Sculptural Group: "Navigation and Mercury"
    const mercury = new THREE.Mesh(new THREE.BoxGeometry(2.2, 4.8, 1.2), statueMat);
    mercury.position.set(0, 28.5, -51.5);
    mercury.castShadow = true;
    bGroup.add(mercury);

    this.group.add(bGroup);
  }

  /**
   * Казанский собор (Kazan Cathedral Colonnade, Dome & Kutuzov Monument)
   * Exact GPS: 59.9344 N, 30.3245 E -> World: x=567.8, z=600.8
   * Andrey Voronikhin masterpiece: sweeping semicircular colonnade of 96 Corinthian columns
   * embracing Kazan Square facing Nevsky Prospekt, monumental hexastyle portico, portal pavilions,
   * 71.6m ribbed malachite green dome, and bronze monuments to Kutuzov and Barclay de Tolly.
   */
  private buildKazanCathedralColonnade() {
    const kazanGroup = new THREE.Group();
    kazanGroup.name = 'kazan-cathedral-ensemble';
    kazanGroup.position.set(567.8, 26.0, 600.8);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.empireStone, flatShading: true }); // Pudozh limestone
    const greenMat = new THREE.MeshLambertMaterial({ color: 0x38664b, flatShading: true }); // Malachite patina
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x303530, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });

    // 1. Central Monumental Drum with 16 Corinthian Arched Windows
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(15.5, 16.5, 14, 32), stoneMat);
    drum.position.y = 7;
    drum.castShadow = true;
    kazanGroup.add(drum);

    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.5, 0.4), bronzeMat);
      win.position.set(Math.cos(ang) * 16.0, 8.0, Math.sin(ang) * 16.0);
      win.rotation.y = -ang + Math.PI / 2;
      kazanGroup.add(win);
    }

    // 2. Grand Ribbed Malachite Green Central Dome (71.6m high)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(15.8, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), greenMat);
    dome.position.y = 14;
    dome.scale.set(1.0, 1.38, 1.0);
    dome.castShadow = true;
    kazanGroup.add(dome);

    // 16 Gilded Ribs of Kazan Dome
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.5, 16.5, 0.5), goldMat);
      rib.position.set(Math.cos(ang) * 11.0, 22.5, Math.sin(ang) * 11.0);
      rib.rotation.z = Math.cos(ang) * 0.42;
      rib.rotation.x = -Math.sin(ang) * 0.42;
      kazanGroup.add(rib);
    }

    // Gilded Light Lantern & Orthodox Cross
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 12), stoneMat);
    lantern.position.y = 35;
    kazanGroup.add(lantern);

    const lanternDome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10), goldMat);
    lanternDome.position.y = 40.5;
    lanternDome.castShadow = true;
    kazanGroup.add(lanternDome);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.5, 3.2), goldMat);
    cross.position.y = 46.5;
    cross.castShadow = true;
    kazanGroup.add(cross);

    // 3. Central Monumental Hexastyle Corinthian Portico facing Nevsky
    const porticoCenter = new THREE.Vector3(0, -26.0, -22.0);
    const portBase = new THREE.Mesh(new THREE.BoxGeometry(28, 2.5, 12), stoneMat);
    portBase.position.set(porticoCenter.x, porticoCenter.y + 1.25, porticoCenter.z);
    kazanGroup.add(portBase);

    for (let cx = -11; cx <= 11; cx += 4.4) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 16.5, 12), stoneMat);
      col.position.set(porticoCenter.x + cx, porticoCenter.y + 10.5, porticoCenter.z + 4.5);
      col.castShadow = true;
      kazanGroup.add(col);
    }

    const portPediment = new THREE.Mesh(createPedimentGeometry(28, 6.5, 3.2), stoneMat);
    portPediment.position.set(porticoCenter.x, porticoCenter.y + 18.0 + 3.25, porticoCenter.z + 4.5);
    portPediment.castShadow = true;
    kazanGroup.add(portPediment);

    // Bronze All-Seeing Eye in Glory in Tympanum
    const eyeRelief = new THREE.Mesh(new THREE.BoxGeometry(5.0, 2.5, 0.4), goldMat);
    eyeRelief.position.set(porticoCenter.x, porticoCenter.y + 20.0, porticoCenter.z + 6.2);
    kazanGroup.add(eyeRelief);

    // 4. Bronze Monuments to 1812 War Commanders on Kazan Square
    // Monument to Mikhail Illarionovich Kutuzov (x = -25, z = -65)
    // Monument to Barclay de Tolly (x = 25, z = -65)
    const commanders = [
      { x: -26.0, z: -68.0, name: 'kutuzov' },
      { x: 26.0, z: -68.0, name: 'barclay' }
    ];

    for (const cmd of commanders) {
      const cmdPedestal = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.5, 2.4), graniteMat);
      cmdPedestal.position.set(cmd.x, -23.75, cmd.z);
      cmdPedestal.castShadow = true;
      kazanGroup.add(cmdPedestal);

      const cmdStatue = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.8, 1.2), bronzeMat);
      cmdStatue.position.set(cmd.x, -19.6, cmd.z);
      cmdStatue.castShadow = true;
      kazanGroup.add(cmdStatue);
    }

    this.group.add(kazanGroup);
  }

  /**
   * Кунсткамера (Kunstkamera Petrine Baroque Clock Tower)
   * Exact GPS: 59.9414 N, 30.3045 E -> World: x=-563.2, z=-178.1
   */
  private buildKunstkameraTower() {
    const kunstGroup = new THREE.Group();
    kunstGroup.name = 'kunstkamera-astronomical-tower';
    kunstGroup.position.set(-563.2, 16.0, -178.1);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbPastelBlue, flatShading: true });
    const whiteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });

    // Tier 1: Octagonal clock tower base
    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 12, 8), stoneMat);
    tier1.position.y = 6;
    tier1.castShadow = true;
    kunstGroup.add(tier1);

    // Tier 2: Open belvedere with white pilasters
    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.5, 10, 8), whiteMat);
    tier2.position.y = 17;
    tier2.castShadow = true;
    kunstGroup.add(tier2);

    // Tier 3: Baroque dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(6.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), stoneMat);
    dome.position.y = 22;
    dome.castShadow = true;
    kunstGroup.add(dome);

    // Tier 4: Astronomical Lantern
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 6, 8), whiteMat);
    lantern.position.y = 30;
    kunstGroup.add(lantern);

    // Armillary Sphere (Армиллярная сфера)
    const sphereGroup = new THREE.Group();
    sphereGroup.position.y = 36;

    const ringGeo = new THREE.TorusGeometry(3.2, 0.28, 8, 24);
    const ring1 = new THREE.Mesh(ringGeo, goldMat);
    sphereGroup.add(ring1);

    const ring2 = new THREE.Mesh(ringGeo, goldMat);
    ring2.rotation.x = Math.PI / 2;
    sphereGroup.add(ring2);

    const ring3 = new THREE.Mesh(ringGeo, goldMat);
    ring3.rotation.y = Math.PI / 4;
    sphereGroup.add(ring3);

    const centralStar = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), goldMat);
    sphereGroup.add(centralStar);

    kunstGroup.add(sphereGroup);
    this.group.add(kunstGroup);
  }

  /**
   * Cast-iron Saint Petersburg street lamps (петербургские фонари)
   */
  private buildStreetLamps() {
    const lampGroup = new THREE.Group();
    lampGroup.name = 'spb-street-lamps';

    const postMat = new THREE.MeshLambertMaterial({ color: 0x1f2328, flatShading: true });
    const postGeo = new THREE.CylinderGeometry(0.12, 0.16, 4.2, 6);
    const headGeo = new THREE.BoxGeometry(0.5, 0.6, 0.5);
    const bulbGeo = new THREE.BoxGeometry(0.32, 0.38, 0.32);

    const lampPositions: [number, number][] = [];

    // Along Palace Embankment (Дворцовая набережная)
    for (let x = -150; x <= 450; x += 30) {
      lampPositions.push([x, -85]);
    }

    // Around Palace Square perimeter
    for (let x = -20; x <= 150; x += 25) {
      lampPositions.push([x, 35]);
      lampPositions.push([x, 130]);
    }

    // Along Alexander Garden promenades
    for (let z = 100; z <= 350; z += 35) {
      lampPositions.push([-120, z]);
      lampPositions.push([-220, z]);
      lampPositions.push([-310, z]);
    }

    for (const [lx, lz] of lampPositions) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, 0, lz);

      // Post
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 2.1;
      post.castShadow = true;
      lamp.add(post);

      // Lantern head
      const head = new THREE.Mesh(headGeo, postMat);
      head.position.y = 4.3;
      lamp.add(head);

      // Glowing light bulb
      const bulb = new THREE.Mesh(bulbGeo, this.streetLampsMat);
      bulb.position.y = 4.25;
      lamp.add(bulb);

      lampGroup.add(lamp);
    }

    this.group.add(lampGroup);
  }

  /**
   * Pulsing Red Aviation Warning Beacons (на шпилях Петропавловского собора и Адмиралтейства)
   */
  private buildAviationBeacons() {
    const beaconGroup = new THREE.Group();
    beaconGroup.name = 'aviation-beacons';

    const beaconGeo = new THREE.SphereGeometry(0.65, 8, 8);

    // 1. Peter & Paul Cathedral Spire Tip (122.5m)
    const ppBeacon = new THREE.Mesh(beaconGeo, this.beaconMat);
    ppBeacon.position.set(115.4, 123.0, -1157.7);
    beaconGroup.add(ppBeacon);

    // 2. Admiralty Spire Needle (72.5m)
    const admBeacon = new THREE.Mesh(beaconGeo, this.beaconMat);
    admBeacon.position.set(-331.7, 72.8, 259.6);
    beaconGroup.add(admBeacon);

    this.group.add(beaconGroup);
  }

  /**
   * Смольный Воскресенский собор (Smolny Cathedral by F.B. Rastrelli)
   * Position: x = 4475, z = -1007. Height: 93.7m.
   */
  private buildSmolnyCathedral() {
    const smolny = new THREE.Group();
    smolny.name = 'smolny-cathedral';
    smolny.position.set(4475, 0, -1007);

    const blueMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbPastelBlue, flatShading: true });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });

    // Lower Cathedral Mass (3 tiers of baroque pilasters)
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(48, 14, 48), blueMat);
    base1.position.y = 7;
    base1.castShadow = true;
    base1.receiveShadow = true;
    smolny.add(base1);

    const base2 = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 40), whiteMat);
    base2.position.y = 22;
    base2.castShadow = true;
    smolny.add(base2);

    const base3 = new THREE.Mesh(new THREE.BoxGeometry(32, 18, 32), blueMat);
    base3.position.y = 39;
    base3.castShadow = true;
    smolny.add(base3);

    // Central Grand Dome Drum (Octagonal)
    const drumGeo = new THREE.CylinderGeometry(11, 12, 18, 8);
    const drum = new THREE.Mesh(drumGeo, whiteMat);
    drum.position.y = 57;
    drum.castShadow = true;
    smolny.add(drum);

    // Central Golden Dome
    const domeGeo = new THREE.SphereGeometry(11.5, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const dome = new THREE.Mesh(domeGeo, goldMat);
    dome.position.y = 66;
    dome.castShadow = true;
    smolny.add(dome);

    // Central Lantern & Cross (reaching 93.7m)
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.8, 12, 8), whiteMat);
    lantern.position.y = 78;
    smolny.add(lantern);

    const cupola = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), goldMat);
    cupola.position.y = 86;
    smolny.add(cupola);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.5, 3.6), goldMat);
    cross.position.set(0, 91, 0);
    smolny.add(cross);

    // 4 Corner Satellite Baroque Bell Towers
    const towerOffsets = [
      { x: -18, z: -18 },
      { x: 18, z: -18 },
      { x: -18, z: 18 },
      { x: 18, z: 18 }
    ];

    for (const off of towerOffsets) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(10, 36, 10), blueMat);
      tower.position.set(off.x, 32, off.z);
      tower.castShadow = true;
      smolny.add(tower);

      const tDrum = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.8, 14, 8), whiteMat);
      tDrum.position.set(off.x, 57, off.z);
      smolny.add(tDrum);

      const tDome = new THREE.Mesh(new THREE.SphereGeometry(5.0, 8, 8), goldMat);
      tDome.position.set(off.x, 66, off.z);
      tDome.castShadow = true;
      smolny.add(tDome);

      const tCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.5, 2.2), goldMat);
      tCross.position.set(off.x, 70, off.z);
      smolny.add(tCross);
    }

    this.group.add(smolny);
  }

  /**
   * Таврический дворец (Tauride Palace by Ivan Starov)
   * Position: x = 3430, z = -877.
   */
  private buildTauridePalace() {
    const palace = new THREE.Group();
    palace.name = 'tauride-palace';
    palace.position.set(3430, 0, -877);

    const ochreMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbOchre, flatShading: true });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofCopperGreen, flatShading: true });

    // Central Neoclassical Corps
    const corps = new THREE.Mesh(new THREE.BoxGeometry(52, 14, 26), ochreMat);
    corps.position.y = 7;
    corps.castShadow = true;
    corps.receiveShadow = true;
    palace.add(corps);

    // 6-Column Doric Portico (facing South / Garden)
    const portico = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 6), whiteMat);
    portico.position.set(0, 7, 14);
    portico.castShadow = true;
    palace.add(portico);

    const pediment = new THREE.Mesh(new THREE.ConeGeometry(16, 5, 4), whiteMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.position.set(0, 16.5, 14);
    palace.add(pediment);

    // Central Low Classical Ribbed Dome
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 6, 16), whiteMat);
    drum.position.y = 17;
    palace.add(drum);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(11.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), roofMat);
    dome.position.y = 20;
    dome.castShadow = true;
    palace.add(dome);

    // Side Galleries & Wings
    for (const s of [-1, 1]) {
      const gallery = new THREE.Mesh(new THREE.BoxGeometry(45, 9, 14), ochreMat);
      gallery.position.set(s * 48.5, 4.5, 0);
      gallery.castShadow = true;
      palace.add(gallery);

      const wing = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 45), ochreMat);
      wing.position.set(s * 75, 6, 12);
      wing.castShadow = true;
      palace.add(wing);
    }

    this.group.add(palace);
  }

  /**
   * Московский вокзал (Moscow Railway Station by Konstantin Thon)
   * Position: x = 2613, z = 1078.
   */
  private buildMoscowStation() {
    const station = new THREE.Group();
    station.name = 'moscow-railway-station';
    station.position.set(2613, 0, 1078);

    const facadeMat = new THREE.MeshLambertMaterial({ color: 0xdecbb5, flatShading: true }); // Warm Renaissance Limestone
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const clockMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofTinRed, flatShading: true });

    // Main 2-story Renaissance facade block
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(68, 16, 28), facadeMat);
    mainBody.position.y = 8;
    mainBody.castShadow = true;
    mainBody.receiveShadow = true;
    station.add(mainBody);

    // Italianate Double-tier Clock Tower
    const towerLower = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), facadeMat);
    towerLower.position.set(0, 23, 0);
    towerLower.castShadow = true;
    station.add(towerLower);

    const towerUpper = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), whiteMat);
    towerUpper.position.set(0, 35, 0);
    towerUpper.castShadow = true;
    station.add(towerUpper);

    // Clock faces on 4 sides
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const clock = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 12), clockMat);
      clock.rotation.x = Math.PI / 2;
      clock.rotation.z = r;
      clock.position.set(Math.sin(r) * 5.2, 35, Math.cos(r) * 5.2);
      station.add(clock);
    }

    // Pyramid Spire
    const spire = new THREE.Mesh(new THREE.ConeGeometry(5.5, 12, 4), roofMat);
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 46;
    spire.castShadow = true;
    station.add(spire);

    this.group.add(station);
  }

  /**
   * Свято-Троицкий собор Александро-Невской лавры (Ivan Starov, 1776—1790)
   * Position: x = 4135, z = 2083 (Center of Holy Trinity Cathedral in Lavra monastery court)
   * Real orientation: Longitudinal axis East-West (-X is West/monastery court, +X is East/Altar)
   */
  private buildLavra() {
    const lavra = new THREE.Group();
    lavra.name = 'alexander-nevsky-lavra';
    lavra.position.set(4135, 0, 2083);

    const wallMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbOchre, flatShading: true });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const domeMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });

    // 1. Western Hexastyle Doric Portico (facing West towards monastery square)
    const portico = new THREE.Mesh(new THREE.BoxGeometry(7, 18, 26), whiteMat);
    portico.position.set(-42, 9, 0);
    portico.castShadow = true;
    portico.receiveShadow = true;
    lavra.add(portico);

    const pediment = new THREE.Mesh(new THREE.ConeGeometry(15, 6, 4), whiteMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.rotation.z = Math.PI / 2;
    pediment.position.set(-45.5, 20, 0);
    pediment.scale.set(0.6, 1.0, 1.2);
    pediment.castShadow = true;
    lavra.add(pediment);

    // 2. Central Monumental Rotunda Drum (16 classical pilasters & arched windows)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 12, 24), whiteMat);
    drum.position.set(3, 24, 0);
    drum.castShadow = true;
    drum.receiveShadow = true;
    lavra.add(drum);

    // Grand Gilded Dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(11.8, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), domeMat);
    dome.position.set(3, 30, 0);
    dome.castShadow = true;
    lavra.add(dome);

    // Classical Light Lantern
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 7, 12), whiteMat);
    lantern.position.set(3, 42.5, 0);
    lantern.castShadow = true;
    lavra.add(lantern);

    // Golden Cupola & Orthodox Cross (reaching 51.7m)
    const cupola = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), domeMat);
    cupola.position.set(3, 47, 0);
    cupola.castShadow = true;
    lavra.add(cupola);

    const crossVert = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.5, 0.35), domeMat);
    crossVert.position.set(3, 51.5, 0);
    lavra.add(crossVert);
    const crossHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 2.2), domeMat);
    crossHoriz.position.set(3, 52.2, 0);
    lavra.add(crossHoriz);

    // 3. Two Twin Western Belltowers (50m high with soaring golden spires)
    // Symmetrically placed on northwest and southwest corners of the western facade
    for (const sz of [-1, 1]) {
      const bTower = new THREE.Mesh(new THREE.BoxGeometry(9, 16, 9), wallMat);
      bTower.position.set(-33, 26, sz * 20);
      bTower.castShadow = true;
      lavra.add(bTower);

      // Open columnar belfry tier
      const bBelfry = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 10, 12), whiteMat);
      bBelfry.position.set(-33, 39, sz * 20);
      bBelfry.castShadow = true;
      lavra.add(bBelfry);

      // Golden Spire
      const bSpire = new THREE.Mesh(new THREE.ConeGeometry(4.2, 15, 12), domeMat);
      bSpire.position.set(-33, 50, sz * 20);
      bSpire.castShadow = true;
      lavra.add(bSpire);
    }

    // 4. Eastern Altar Apse (facing East)
    const apse = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 18, 16, 1, false, -Math.PI / 2, Math.PI), wallMat);
    apse.position.set(33, 9, 0);
    apse.castShadow = true;
    apse.receiveShadow = true;
    lavra.add(apse);

    this.group.add(lavra);
  }

  public update(deltaTime: number, nightFactor: number, curHour?: number) {
    this.totalTime += deltaTime;

    // 1. Handle Cannon Shot Animation (Flash, Smoke, Shockwave)
    if (this.cannonShotTimer >= 0) {
      this.cannonShotTimer += deltaTime;

      // Muzzle Flash (0.14s)
      if (this.cannonShotTimer < 0.14) {
        const flashAlpha = 1.0 - (this.cannonShotTimer / 0.14);
        (this.cannonFlashMesh.material as THREE.MeshBasicMaterial).opacity = flashAlpha;
        this.cannonFlashLight.intensity = 6.0 * flashAlpha;
      } else {
        (this.cannonFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;
        this.cannonFlashLight.intensity = 0.0;
      }

      // Volumetric Expanding Smoke Clouds (3.6s)
      if (this.cannonShotTimer < 3.6) {
        const t = this.cannonShotTimer / 3.6;
        const fade = Math.max(0.0, 1.0 - t * t);

        for (let i = 0; i < this.cannonSmokeMeshes.length; i++) {
          const item = this.cannonSmokeMeshes[i];
          // Drift and billow upward and across the Neva with the breeze
          item.mesh.position.x = item.baseVel.x * this.cannonShotTimer;
          item.mesh.position.y = item.baseVel.y * this.cannonShotTimer;
          item.mesh.position.z = item.baseVel.z * this.cannonShotTimer;

          // Expand volumetric radius
          const scale = 1.0 + t * 9.5;
          item.mesh.scale.set(scale, scale, scale);

          (item.mesh.material as THREE.MeshBasicMaterial).opacity = fade * 0.72;
        }
      } else {
        for (const item of this.cannonSmokeMeshes) {
          (item.mesh.material as THREE.MeshBasicMaterial).opacity = 0.0;
        }
      }

      // Shockwave on Neva water surface (2.0s)
      if (this.cannonShockwave && this.cannonShotTimer < 2.0) {
        const st = this.cannonShotTimer / 2.0;
        const swScale = 1.0 + st * 18.0;
        this.cannonShockwave.scale.set(swScale, swScale, swScale);
        (this.cannonShockwave.material as THREE.MeshBasicMaterial).opacity = (1.0 - st) * 0.85;
      } else if (this.cannonShockwave) {
        (this.cannonShockwave.material as THREE.MeshBasicMaterial).opacity = 0.0;
      }

      if (this.cannonShotTimer >= 3.8) {
        this.cannonShotTimer = -1;
      }
    }

    // 2. Automatic daily Noon Cannon Shot (12:00)
    if (curHour !== undefined) {
      const isNearNoon = Math.abs(curHour - 12.0) < 0.04; // between 11:58 and 12:02
      if (isNearNoon && !this.hasFiredAtNoon) {
        this.hasFiredAtNoon = true;
        this.fireNoonCannon();
      } else if (Math.abs(curHour - 12.0) > 0.4) {
        this.hasFiredAtNoon = false;
      }
    }

    // 3. Pulse red aviation warning beacons (1.2 Hz flash)
    const flash = Math.sin(this.totalTime * 4.5) > 0.2 ? 1.0 : 0.15;
    this.beaconMat.opacity = flash;

    // 4. Turn on warm amber street lamps at dusk / night
    const lampGlow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.12) * 2.8));
    this.streetLampsMat.opacity = lampGlow;

    // 5. Floodlights on iconic spires and domes (Admiralty, St. Isaac's, Peter & Paul)
    const floodlightGlow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.15) * 2.4));
    this.floodlightMat.opacity = floodlightGlow * 0.75;

    // 6. Flaming torches on Rostral columns with organic flame flicker
    if (nightFactor > 0.2) {
      const flicker = 0.75 + Math.sin(this.totalTime * 14.0) * 0.25;
      this.rostralFlameMat.opacity = Math.min(1.0, (nightFactor - 0.2) * 2.5) * flicker;
    } else {
      this.rostralFlameMat.opacity = 0.0;
    }
  }
}
