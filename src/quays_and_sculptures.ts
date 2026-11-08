import * as THREE from 'three';
import { PALETTE } from './palette';

/**
 * Historical Granite Embankments, Quays, Sentinel Lions, Egyptian Sphinxes and Sculptures
 * Handcrafted with authentic Petersburg architectural proportions and materials.
 */
export class QuaysAndSculpturesSystem {
  public group: THREE.Group;
  private streetLampsMat: THREE.MeshBasicMaterial;
  private waterFoamMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'quays-and-sculptures';
    scene.add(this.group);

    this.streetLampsMat = new THREE.MeshBasicMaterial({
      color: 0xffd060,
      transparent: true,
      opacity: 0.0
    });

    this.waterFoamMat = new THREE.MeshBasicMaterial({
      color: PALETTE.waterFoam,
      transparent: true,
      opacity: 0.65
    });

    this.createSphinxesQuay();
    this.createPalaceLionsPier();
    this.createAdmiraltySenatePier();
    this.createSpitGraniteRamp();
    this.createAnichkovHorses();
  }

  /**
   * 1. ПРИСТАНЬ СО СФИНКСАМИ НА УНИВЕРСИТЕТСКОЙ НАБЕРЕЖНОЙ
   * Opposite Academy of Arts on Vasilyevsky Island (Konstantin Thon, 1832-1834).
   * Two authentic Egyptian sphinxes of Amenhotep III (XIV century BC) from Aswan syenite,
   * two bronze winged gryphons, granite benches, and grand curved descent stairs to the Neva.
   */
  private createSphinxesQuay() {
    const quay = new THREE.Group();
    quay.name = 'sphinxes-quay';
    quay.position.set(-1350, 0, 325);
    // Align with the embankment facing the Bolshaya Neva river (water at z > 325)
    quay.rotation.y = -2.60;

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const greyGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });
    const syeniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.sphinxSyenite, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: PALETTE.bronzeStatue, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: PALETTE.castIronBlack, flatShading: true });

    // A. Main Granite Pier Platform projecting into the Neva
    const mainPlat = new THREE.Mesh(new THREE.BoxGeometry(32, 2.8, 14), pinkGraniteMat);
    mainPlat.position.set(0, 1.4, -4);
    mainPlat.castShadow = true;
    mainPlat.receiveShadow = true;
    quay.add(mainPlat);

    // B. Grand Semicircular / Curved Granite Steps descending directly into Neva water
    const stepCount = 5;
    for (let s = 0; s < stepCount; s++) {
      const w = 24 - s * 2.2;
      const d = 2.2;
      const h = 0.45;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), greyGraniteMat);
      step.position.set(0, 0.25 + (stepCount - 1 - s) * 0.35, -11 - s * 1.8);
      step.receiveShadow = true;
      quay.add(step);
    }

    // Water foam apron lap around the lowest submerged steps
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(25, 3.5), this.waterFoamMat);
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(0, 0.15, -19.5);
    quay.add(foam);

    // C. Massive Granite Side Parapets with Classical Curved Benches
    for (const side of [-1, 1]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 13), pinkGraniteMat);
      parapet.position.set(side * 15.2, 2.7, -4.5);
      parapet.castShadow = true;
      quay.add(parapet);

      // Classical granite bench with high contoured back
      const benchBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 7.5), pinkGraniteMat);
      benchBase.position.set(side * 13.5, 2.35, -4.5);
      quay.add(benchBase);

      const benchBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 7.5), pinkGraniteMat);
      benchBack.position.set(side * 14.5, 3.2, -4.5);
      quay.add(benchBack);

      // Mooring bollard (чугунный кнехт) on corner
      const bollardBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.8, 8), ironMat);
      bollardBase.position.set(side * 14.8, 3.4, -10.5);
      quay.add(bollardBase);
      const bollardTop = new THREE.Mesh(new THREE.SphereGeometry(0.58, 8, 8), ironMat);
      bollardTop.position.set(side * 14.8, 3.8, -10.5);
      quay.add(bollardTop);
    }

    // D. Two Egyptian Sphinxes of Amenhotep III (XIV Century BC)
    // Left & Right Pedestals
    for (const side of [-1, 1]) {
      const sphinxGroup = new THREE.Group();
      sphinxGroup.position.set(side * 11.5, 2.8, -2.5);
      // Face towards each other across the pier, angled slightly towards Neva
      sphinxGroup.rotation.y = side === 1 ? -Math.PI * 0.45 : Math.PI * 0.45;

      // 1. Granite Pedestal with molded cornice and Hieroglyphic frieze
      const pedBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 7.2), pinkGraniteMat);
      pedBase.position.set(0, 0.25, 0);
      pedBase.castShadow = true;
      sphinxGroup.add(pedBase);

      const pedShaft = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.2, 6.6), pinkGraniteMat);
      pedShaft.position.set(0, 1.6, 0);
      pedShaft.castShadow = true;
      sphinxGroup.add(pedShaft);

      // Molded cornice band
      const pedCap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.35, 6.9), pinkGraniteMat);
      pedCap.position.set(0, 2.85, 0);
      sphinxGroup.add(pedCap);

      // 2. Egyptian Sphinx Sculpture (Aswan Syenite)
      // Plinth
      const sphPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 6.2), syeniteMat);
      sphPlinth.position.set(0, 3.25, 0);
      sphinxGroup.add(sphPlinth);

      // Lion Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.6, 4.6), syeniteMat);
      body.position.set(0, 4.25, -0.4);
      body.castShadow = true;
      sphinxGroup.add(body);

      // Recumbent Lion Hindquarters (rounded)
      const hind = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), syeniteMat);
      hind.scale.set(0.95, 0.8, 1.1);
      hind.position.set(0, 4.15, 1.5);
      sphinxGroup.add(hind);

      // Tail curled along right flank
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.8, 6), syeniteMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.set(1.15, 3.65, 0.8);
      sphinxGroup.add(tail);

      // Forepaws stretched forward
      for (const pawSide of [-0.65, 0.65]) {
        const paw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.8), syeniteMat);
        paw.position.set(pawSide, 3.75, -2.4);
        paw.castShadow = true;
        sphinxGroup.add(paw);
      }

      // Pharaoh Amenhotep III Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 1.3), syeniteMat);
      head.position.set(0, 5.5, -1.8);
      head.castShadow = true;
      sphinxGroup.add(head);

      // Royal Nemes Headdress (Klaft) falling over shoulders
      const nemesTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.6), syeniteMat);
      nemesTop.position.set(0, 6.4, -1.8);
      sphinxGroup.add(nemesTop);

      const nemesWingL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 1.2), syeniteMat);
      nemesWingL.position.set(-0.95, 5.2, -1.8);
      sphinxGroup.add(nemesWingL);

      const nemesWingR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 1.2), syeniteMat);
      nemesWingR.position.set(0.95, 5.2, -1.8);
      sphinxGroup.add(nemesWingR);

      // Gold Royal Band & Uraeus (sacred cobra on forehead)
      const goldBand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.5), goldMat);
      goldBand.position.set(0, 6.15, -1.8);
      sphinxGroup.add(goldBand);

      const uraeus = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.45, 6), goldMat);
      uraeus.position.set(0, 6.45, -2.55);
      uraeus.rotation.x = -0.3;
      sphinxGroup.add(uraeus);

      // Ceremonial Pharaoh Beard
      const beard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.35), syeniteMat);
      beard.position.set(0, 4.45, -2.45);
      sphinxGroup.add(beard);

      quay.add(sphinxGroup);
    }

    // E. Bronze Winged Gryphons with Lanterns at the Lower Pier Edge
    for (const side of [-1, 1]) {
      const gryphonGroup = new THREE.Group();
      gryphonGroup.position.set(side * 8.5, 1.2, -12.5);
      gryphonGroup.rotation.y = side === 1 ? -Math.PI * 0.2 : Math.PI * 0.2;

      // Granite Plinth
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.8), pinkGraniteMat);
      base.position.set(0, 0.35, 0);
      gryphonGroup.add(base);

      // Bronze Gryphon Body
      const gBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 1.8), bronzeMat);
      gBody.position.set(0, 1.15, 0);
      gBody.castShadow = true;
      gryphonGroup.add(gBody);

      // Eagle Head
      const gHead = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 6), bronzeMat);
      gHead.rotation.x = Math.PI / 2;
      gHead.position.set(0, 1.85, -0.9);
      gryphonGroup.add(gHead);

      // Majestic Upcurving Wings
      for (const wSide of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.0), bronzeMat);
        wing.position.set(wSide * 0.65, 2.2, 0.2);
        wing.rotation.z = wSide * 0.35;
        wing.rotation.x = -0.25;
        wing.castShadow = true;
        gryphonGroup.add(wing);
      }

      // Classical Iron Lantern Post
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 6), ironMat);
      post.position.set(0, 2.6, 0.8);
      gryphonGroup.add(post);

      const lanternGlass = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), this.streetLampsMat);
      lanternGlass.position.set(0, 4.2, 0.8);
      gryphonGroup.add(lanternGlass);

      quay.add(gryphonGroup);
    }

    this.group.add(quay);
  }

  /**
   * 2. ДВОРЦОВАЯ ПРИСТАНЬ СО СТОРОЖЕВЫМИ МЕДНЫМИ ЛЬВАМИ
   * Southern abutment of Palace Bridge on Palace / Admiralty Embankment (Prokofiev & Charlemagne, 1832).
   * Two iconic guardian copper lions with paws resting on polished bronze spheres.
   */
  private createPalaceLionsPier() {
    const pier = new THREE.Group();
    pier.name = 'palace-lions-pier';
    pier.position.set(-288, 0, -20);
    // Orient towards Bolshaya Neva and Palace Bridge approach
    pier.rotation.y = 0.65;

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const greyGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });
    const lionBronzeMat = new THREE.MeshLambertMaterial({ color: PALETTE.copperPatina, flatShading: true });
    const ballMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: PALETTE.castIronBlack, flatShading: true });

    // A. Broad Granite Wharf Steps into the Neva
    const wharfBase = new THREE.Mesh(new THREE.BoxGeometry(26, 2.4, 12), pinkGraniteMat);
    wharfBase.position.set(0, 1.2, -3);
    wharfBase.castShadow = true;
    wharfBase.receiveShadow = true;
    pier.add(wharfBase);

    // Granite steps down to water level
    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 2.0), greyGraniteMat);
      step.position.set(0, 0.2 + (3 - s) * 0.35, -9 - s * 1.8);
      step.receiveShadow = true;
      pier.add(step);
    }

    // B. Cast Iron Pedestals & Copper Sentinel Lions
    for (const side of [-1, 1]) {
      const lionGroup = new THREE.Group();
      lionGroup.position.set(side * 8.8, 2.4, -1.8);
      // Lions face slightly towards each other and out towards the bridge & river
      lionGroup.rotation.y = side === 1 ? -Math.PI * 0.35 : Math.PI * 0.35;

      // 1. Cast-iron molded Pedestal
      const pedBottom = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 4.4), ironMat);
      pedBottom.position.set(0, 0.2, 0);
      lionGroup.add(pedBottom);

      const pedShaft = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.8), ironMat);
      pedShaft.position.set(0, 1.05, 0);
      lionGroup.add(pedShaft);

      const pedCornice = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 4.1), ironMat);
      pedCornice.position.set(0, 1.95, 0);
      lionGroup.add(pedCornice);

      // 2. Copper Sentinel Lion (Лев с лапой на шаре)
      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 2.8), lionBronzeMat);
      torso.position.set(0, 2.85, 0.1);
      torso.castShadow = true;
      lionGroup.add(torso);

      // Rump / Hind legs
      const hind = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), lionBronzeMat);
      hind.position.set(0, 2.75, 1.3);
      lionGroup.add(hind);

      // Muscular maned chest & neck
      const chest = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.3), lionBronzeMat);
      chest.position.set(0, 3.4, -0.9);
      lionGroup.add(chest);

      // Lion Head with wild sculpted mane
      const mane = new THREE.Mesh(new THREE.SphereGeometry(1.15, 8, 8), lionBronzeMat);
      mane.position.set(0, 4.0, -1.4);
      mane.castShadow = true;
      lionGroup.add(mane);

      // Fierce snout and jaw
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.9), lionBronzeMat);
      snout.position.set(0, 3.9, -2.2);
      lionGroup.add(snout);

      // Left foreleg planted firmly on pedestal
      const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.3, 6), lionBronzeMat);
      leftLeg.position.set(-0.55, 2.65, -1.0);
      lionGroup.add(leftLeg);

      // Right foreleg raised, resting upon the golden-bronze sphere
      const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.0, 6), lionBronzeMat);
      rightLeg.rotation.x = -0.35;
      rightLeg.position.set(0.55, 3.0, -1.0);
      lionGroup.add(rightLeg);

      // Iconic Polished Sentinel Sphere (Шар под лапой льва)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 12), ballMat);
      ball.position.set(0.55, 2.5, -1.45);
      ball.castShadow = true;
      lionGroup.add(ball);

      // Mooring Bollards beside each lion
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.9, 8), ironMat);
      bollard.position.set(side * 2.2, 0.45, -2.6);
      lionGroup.add(bollard);

      pier.add(lionGroup);
    }

    this.group.add(pier);
  }

  /**
   * 3. СПУСК СО ЛЬВАМИ У АДМИРАЛТЕЙСТВА И СЕНАТСКОЙ ПЛОЩАДИ
   * Admiralty Embankment beside Senate Square / Bronze Horseman.
   */
  private createAdmiraltySenatePier() {
    const pier = new THREE.Group();
    pier.name = 'admiralty-senate-pier';
    pier.position.set(-530, 0, 120);
    pier.rotation.y = 0.48;

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const greyGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });
    const lionBronzeMat = new THREE.MeshLambertMaterial({ color: PALETTE.copperPatina, flatShading: true });
    const ballMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: PALETTE.castIronBlack, flatShading: true });

    // Granite Embankment Pier
    const base = new THREE.Mesh(new THREE.BoxGeometry(22, 2.2, 10), pinkGraniteMat);
    base.position.set(0, 1.1, -2);
    base.receiveShadow = true;
    pier.add(base);

    // Granite Steps to Neva
    for (let s = 0; s < 4; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 1.8), greyGraniteMat);
      step.position.set(0, 0.2 + (3 - s) * 0.3, -7 - s * 1.6);
      step.receiveShadow = true;
      pier.add(step);
    }

    // Pair of Sentinel Lions on square granite pedestals
    for (const side of [-1, 1]) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 3.4), pinkGraniteMat);
      ped.position.set(side * 7.5, 2.0, -0.8);
      ped.castShadow = true;
      pier.add(ped);

      // Lion
      const lion = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.4), lionBronzeMat);
      lion.position.set(side * 7.5, 3.4, -0.8);
      lion.castShadow = true;
      pier.add(lion);

      const mane = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 8), lionBronzeMat);
      mane.position.set(side * 7.5, 4.1, -1.7);
      pier.add(mane);

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 8), ballMat);
      ball.position.set(side * 7.5 + (side * 0.35), 3.3, -1.9);
      pier.add(ball);
    }

    this.group.add(pier);
  }

  /**
   * 4. МОНУМЕНТАЛЬНЫЙ ПОЛУКРУГЛЫЙ ПАНДУС СТРЕЛКИ ВАСИЛЬЕВСКОГО ОСТРОВА
   * Tip of Vasilyevsky Island between Rostral Columns (Thomas de Thomon, 1805-1810).
   * Semicircular granite ramp, colossal polished granite balls on pedestals,
   * and bronze lion mascarons with mooring rings.
   */
  private createSpitGraniteRamp() {
    const ramp = new THREE.Group();
    ramp.name = 'spit-granite-ramp';
    ramp.position.set(-392, 0, -446);
    ramp.rotation.y = -0.15;

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const greyGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: PALETTE.bronzeStatue, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: PALETTE.castIronBlack, flatShading: true });

    // Semicircular tiered granite ramp descending directly into the split of the Neva
    const radii = [32, 26, 20, 14];
    for (let r = 0; r < radii.length; r++) {
      const radius = radii[r];
      const tierH = 0.55;
      const tierY = 0.3 + (radii.length - 1 - r) * 0.45;
      const geom = new THREE.CylinderGeometry(radius, radius + 2.0, tierH, 24, 1, false, 0, Math.PI);
      const tier = new THREE.Mesh(geom, pinkGraniteMat);
      tier.position.set(0, tierY, -2);
      tier.rotation.y = Math.PI / 2;
      tier.receiveShadow = true;
      ramp.add(tier);
    }

    // Colossal Polished Granite Spheres on Pedestals (Знаменитые гранитные шары на Стрелке)
    for (const side of [-1, 1]) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.2, 3.6), pinkGraniteMat);
      ped.position.set(side * 28, 2.2, 4);
      ped.castShadow = true;
      ramp.add(ped);

      // Monumental Granite Sphere (diameter 2.8m)
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 14), pinkGraniteMat);
      ball.position.set(side * 28, 4.6, 4);
      ball.castShadow = true;
      ramp.add(ball);

      // Bronze Lion Mascarons with mooring iron rings in wall
      const mascaron = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 8), bronzeMat);
      mascaron.rotation.x = Math.PI / 2;
      mascaron.position.set(side * 18, 1.4, -14);
      ramp.add(mascaron);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 8, 16), ironMat);
      ring.position.set(side * 18, 0.9, -14.2);
      ramp.add(ring);
    }

    this.group.add(ramp);
  }

  /**
   * 5. АНИЧКОВ МОСТ: СКУЛЬПТУРНЫЙ АНСАМБЛЬ «УКРОТИТЕЛИ КОНЕЙ» П. КЛОДТА
   * Nevsky Prospekt crossing Fontanka River (Peter Klodt, 1841-1850).
   * 4 monumental bronze equestrian sculptures on 4 pink granite piers.
   */
  private createAnichkovHorses() {
    const ensemble = new THREE.Group();
    ensemble.name = 'anichkov-horses';
    ensemble.position.set(1605, 0, 730);

    const pinkGraniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: PALETTE.bronzeStatue, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: PALETTE.castIronBlack, flatShading: true });

    // The 4 corners of Anichkov Bridge along Nevsky Prospekt and Fontanka embankments
    const offsets = [
      { x: -16.5, z: -12.5, rotY: 0.15, phase: 1 },  // NW: Youth holds rearing horse
      { x: -16.5, z: 12.5,  rotY: 0.85, phase: 2 },  // SW: Youth fallen, horse rears violently
      { x: 16.5,  z: 12.5,  rotY: -0.85, phase: 3 }, // SE: Youth on one knee, taming with reins
      { x: 16.5,  z: -12.5, rotY: -0.15, phase: 4 }  // NE: Subdued horse led triumphantly
    ];

    for (const corner of offsets) {
      const cornerGroup = new THREE.Group();
      cornerGroup.position.set(corner.x, 0, corner.z);
      cornerGroup.rotation.y = corner.rotY;

      // 1. High Pink Granite Pier Pedestal (Выборгский гранит-рапакиви)
      const pedBase = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, 5.8), pinkGraniteMat);
      pedBase.position.set(0, 0.3, 0);
      cornerGroup.add(pedBase);

      const pedShaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.8, 5.2), pinkGraniteMat);
      pedShaft.position.set(0, 2.4, 0);
      pedShaft.castShadow = true;
      cornerGroup.add(pedShaft);

      const pedCornice = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.45, 5.5), pinkGraniteMat);
      pedCornice.position.set(0, 4.45, 0);
      cornerGroup.add(pedCornice);

      // Bronze plinth
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 4.8), bronzeMat);
      plinth.position.set(0, 4.8, 0);
      cornerGroup.add(plinth);

      // 2. Klodt Equestrian Sculptural Group (Бронзовая группа «Укротитель коня»)
      const horseGroup = new THREE.Group();
      horseGroup.position.set(0, 4.95, 0);

      // Stallion Torso (powerful muscular body)
      const horseBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 3.4), bronzeMat);
      // Rearing angle depends on phase
      const rearAngle = corner.phase === 2 ? -0.45 : (corner.phase === 1 ? -0.32 : -0.18);
      horseBody.rotation.x = rearAngle;
      horseBody.position.set(0.3, 2.4, 0.1);
      horseBody.castShadow = true;
      horseGroup.add(horseBody);

      // Arching Muscular Neck
      const neck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 1.4), bronzeMat);
      neck.rotation.x = rearAngle - 0.35;
      neck.position.set(0.3, 3.8, -1.3);
      horseGroup.add(neck);

      // Head with flared nostrils and flowing mane
      const horseHead = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.2, 1.5), bronzeMat);
      horseHead.position.set(0.3, 4.7, -2.1);
      horseHead.castShadow = true;
      horseGroup.add(horseHead);

      // Flowing Mane
      const mane = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.8), bronzeMat);
      mane.position.set(0.3, 4.1, -1.1);
      horseGroup.add(mane);

      // Rearing front legs pawing the air
      for (const legSide of [-0.4, 0.4]) {
        const foreLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.8, 6), bronzeMat);
        foreLeg.rotation.x = rearAngle + 0.6;
        foreLeg.position.set(0.3 + legSide, 2.9, -1.5);
        foreLeg.castShadow = true;
        horseGroup.add(foreLeg);
      }

      // Hind legs braced on pedestal
      for (const hSide of [-0.45, 0.45]) {
        const hindLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.2, 6), bronzeMat);
        hindLeg.position.set(0.3 + hSide, 1.1, 1.1);
        hindLeg.castShadow = true;
        horseGroup.add(hindLeg);
      }

      // Athletic Youth (Укротитель коня)
      const youth = new THREE.Group();
      if (corner.phase === 2) {
        // Fallen youth on granite, one hand struggling with the reins
        youth.position.set(-1.1, 0.8, -0.6);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.6), bronzeMat);
        torso.rotation.x = 0.5;
        youth.add(torso);
      } else if (corner.phase === 3) {
        // Youth on one knee
        youth.position.set(-1.0, 1.2, -0.8);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 1.0), bronzeMat);
        youth.add(torso);
      } else {
        // Standing muscular youth holding the bridle firmly
        youth.position.set(-1.1, 1.8, -0.8);
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.9), bronzeMat);
        torso.castShadow = true;
        youth.add(torso);
      }

      // Youth Head
      const youthHead = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), bronzeMat);
      youthHead.position.set(0, 1.2, 0);
      youth.add(youthHead);

      horseGroup.add(youth);
      cornerGroup.add(horseGroup);
      ensemble.add(cornerGroup);
    }

    // Karl Friedrich Schinkel's delicate cast-iron bridge grilles with sea horses and nereids
    for (const gSide of [-1, 1]) {
      const grille = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 0.25), ironMat);
      grille.position.set(0, 2.8, gSide * 12.5);
      grille.castShadow = true;
      ensemble.add(grille);
    }

    this.group.add(ensemble);
  }

  public update(deltaTime: number, nightFactor: number) {
    // Night illumination on sculpture lanterns
    const glow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.15) * 2.8));
    this.streetLampsMat.opacity = glow;
  }
}
