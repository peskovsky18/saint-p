import * as THREE from 'three';
import { PALETTE } from './palette';

export interface BridgeWing {
  mesh: THREE.Object3D;
  pivot: THREE.Object3D;
  openAngle: number;
  axis: 'x' | 'z';
  direction: 1 | -1;
}

export class BridgeSystem {
  public group: THREE.Group;
  public palaceBridgeWings: BridgeWing[] = [];
  public trinityBridgeWings: BridgeWing[] = [];
  public areOpen: boolean = false;
  public openProgress: number = 0; // 0.0 (closed) to 1.0 (fully open)
  private targetProgress: number = 0;
  public illuminationMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'bridges';
    scene.add(this.group);

    this.illuminationMat = new THREE.MeshBasicMaterial({
      color: 0xffe680,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });

    this.createPalaceBridge();
    this.createTrinityBridge();
    this.createAnnunciationBridge();
    this.createExchangeBridge();
    this.createBankBridge();
    this.createAnichkovBridge();
    this.createBlueBridge();
    this.createGreenBridge();
    this.createKazanskyBridge();
  }

  /**
   * Helper: Builds a massive granite pier with V-shaped icebreaker cutwaters (ледорезы-быки)
   */
  private createGranitePier(
    parent: THREE.Object3D,
    x: number, y: number, z: number,
    pierLength: number, pierHeight: number, pierWidth: number,
    graniteColor: number = 0x82443c
  ) {
    const pierMat = new THREE.MeshLambertMaterial({ color: graniteColor, flatShading: true });
    const capMat = new THREE.MeshLambertMaterial({ color: 0x565c66, flatShading: true });

    // Main central pier body
    const bodyGeo = new THREE.BoxGeometry(pierLength, pierHeight, pierWidth);
    const body = new THREE.Mesh(bodyGeo, pierMat);
    body.position.set(x, y, z);
    body.castShadow = true;
    body.receiveShadow = true;
    parent.add(body);

    // Granite coping capstone on top
    const capGeo = new THREE.BoxGeometry(pierLength + 0.8, 0.6, pierWidth + 0.8);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, y + pierHeight / 2 + 0.3, z);
    cap.receiveShadow = true;
    parent.add(cap);

    // V-shaped Icebreaker Cutwaters (ледорезы) on both upstream (+Z) and downstream (-Z) ends
    const cutwaterLen = pierWidth * 0.22;
    const cutwaterShape = new THREE.Shape();
    cutwaterShape.moveTo(-pierLength / 2, 0);
    cutwaterShape.lineTo(pierLength / 2, 0);
    cutwaterShape.lineTo(0, cutwaterLen);
    cutwaterShape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: pierHeight,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.3,
      bevelThickness: 0.3
    };

    const cutwaterGeo = new THREE.ExtrudeGeometry(cutwaterShape, extrudeSettings);
    cutwaterGeo.rotateX(-Math.PI / 2);

    // Upstream cutwater (+Z)
    const cw1 = new THREE.Mesh(cutwaterGeo, pierMat);
    cw1.position.set(x, y - pierHeight / 2, z + pierWidth / 2);
    cw1.castShadow = true;
    cw1.receiveShadow = true;
    parent.add(cw1);

    // Downstream cutwater (-Z)
    const cw2 = new THREE.Mesh(cutwaterGeo, pierMat);
    cw2.rotation.y = Math.PI;
    cw2.position.set(x, y - pierHeight / 2, z - pierWidth / 2);
    cw2.castShadow = true;
    cw2.receiveShadow = true;
    parent.add(cw2);
  }

  /**
   * Helper: Builds arched steel truss side girders with rivets and diagonal lattice struts
   */
  private createArchTrussGirders(
    parent: THREE.Object3D,
    spanLength: number, spanHeight: number, bridgeWidth: number,
    offsetX: number, baseY: number,
    steelColor: number = 0x404a56
  ) {
    const trussMat = new THREE.MeshLambertMaterial({ color: steelColor, flatShading: true });
    const gussetMat = new THREE.MeshLambertMaterial({ color: 0x647282, flatShading: true });

    const numBays = Math.max(4, Math.floor(spanLength / 5.5));
    const bayW = spanLength / numBays;

    for (const side of [-bridgeWidth / 2 + 0.6, bridgeWidth / 2 - 0.6]) {
      // Curved lower arched chord segments & top horizontal chord
      for (let i = 0; i < numBays; i++) {
        const x1 = offsetX - spanLength / 2 + i * bayW;
        const x2 = x1 + bayW;
        const midX = (x1 + x2) / 2;

        // Arch parabola profile
        const normX1 = ((x1 - offsetX) / (spanLength / 2));
        const normX2 = ((x2 - offsetX) / (spanLength / 2));
        const archY1 = baseY + (1.0 - normX1 * normX1) * spanHeight;
        const archY2 = baseY + (1.0 - normX2 * normX2) * spanHeight;
        const midArchY = (archY1 + archY2) / 2;

        // Upper arched girder bar
        const chordLen = Math.hypot(bayW, archY2 - archY1);
        const chordAng = Math.atan2(archY2 - archY1, bayW);
        const chord = new THREE.Mesh(new THREE.BoxGeometry(chordLen, 0.65, 0.5), trussMat);
        chord.position.set(midX, midArchY, side);
        chord.rotation.z = chordAng;
        chord.castShadow = true;
        parent.add(chord);

        // Vertical lattice posts
        const postH = Math.max(1.0, archY1 - baseY);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, postH, 0.45), trussMat);
        post.position.set(x1, baseY + postH / 2, side);
        post.castShadow = true;
        parent.add(post);

        // Diagonal bracing strut
        const diagLen = Math.hypot(bayW, archY2 - baseY);
        const diagAng = Math.atan2(archY2 - baseY, bayW);
        const diag = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.25, 0.3), trussMat);
        diag.position.set(midX, baseY + (archY2 - baseY) / 2, side);
        diag.rotation.z = diagAng;
        diag.castShadow = true;
        parent.add(diag);

        // Riveted gusset plate at vertex
        const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.55), gussetMat);
        gusset.position.set(x1, archY1, side);
        parent.add(gusset);
      }
    }
  }

  /**
   * Helper: Builds cast-iron openwork railings along both sides of a bridge span
   */
  private createRailing(
    parent: THREE.Object3D,
    spanLength: number, bridgeWidth: number,
    offsetX: number, deckY: number,
    railingColor: number = 0x1e2228
  ) {
    const railMat = new THREE.MeshLambertMaterial({ color: railingColor, flatShading: true });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x2e343e, flatShading: true });

    for (const side of [-bridgeWidth / 2 + 0.3, bridgeWidth / 2 - 0.3]) {
      // Top handrail
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(spanLength, 0.16, 0.22), railMat);
      topRail.position.set(offsetX, deckY + 1.25, side);
      parent.add(topRail);

      // Bottom curb rail
      const botRail = new THREE.Mesh(new THREE.BoxGeometry(spanLength, 0.14, 0.2), railMat);
      botRail.position.set(offsetX, deckY + 0.2, side);
      parent.add(botRail);

      // Intermediate balusters every 1.6m
      const numBalusters = Math.floor(spanLength / 1.6);
      for (let i = 0; i <= numBalusters; i++) {
        const bx = offsetX - spanLength / 2 + (i / numBalusters) * spanLength;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.15, 0.18), postMat);
        post.position.set(bx, deckY + 0.7, side);
        parent.add(post);
      }
    }
  }

  /**
   * Helper: Spaced cast-iron lantern torchiere posts with 3 glowing globes
   */
  private createLanterns(
    parent: THREE.Object3D,
    spanLength: number, bridgeWidth: number,
    offsetX: number, deckY: number,
    interval: number = 18.0
  ) {
    const postMat = new THREE.MeshLambertMaterial({ color: 0x22262c, flatShading: true });
    const globeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0 });

    const numLanterns = Math.max(2, Math.floor(spanLength / interval));
    for (let i = 0; i <= numLanterns; i++) {
      const lx = offsetX - spanLength / 2 + (i / numLanterns) * spanLength;
      for (const side of [-bridgeWidth / 2 + 1.1, bridgeWidth / 2 - 1.1]) {
        // Tapered cast iron lamppost
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 3.8, 6), postMat);
        post.position.set(lx, deckY + 1.9, side);
        post.castShadow = true;
        parent.add(post);

        // Cross bracket arms
        const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), postMat);
        bracket.position.set(lx, deckY + 3.6, side);
        parent.add(bracket);

        // 3 Glowing glass globes (center, left, right)
        for (const dx of [-0.6, 0, 0.6]) {
          const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), globeMat);
          globe.position.set(lx + dx, deckY + (dx === 0 ? 3.9 : 3.7), side);
          parent.add(globe);
        }
      }
    }
  }

  /**
   * Дворцовый мост (Palace Bridge)
   * 5 graceful steel truss arch spans, Rapakivi granite cutwaters, cast-iron railings,
   * operator pavilions, double-leaf bascule lifting wings, tram tracks.
   */
  private createPalaceBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'palace-bridge';

    // Palace Bridge real GPS coordinates
    const bridgeStartX = -268;
    const bridgeStartZ = -25;
    const bridgeEndX = -436;
    const bridgeEndZ = -253;

    const angle = Math.atan2(bridgeEndZ - bridgeStartZ, bridgeEndX - bridgeStartX);
    const length = Math.hypot(bridgeEndX - bridgeStartX, bridgeEndZ - bridgeStartZ);
    const width = 28;
    const height = 4.5;

    bridgeGroup.position.set((bridgeStartX + bridgeEndX) / 2, 4.5, (bridgeStartZ + bridgeEndZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x3e4854, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e333a, flatShading: true });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb4aba0, flatShading: true });
    const railTrackMat = new THREE.MeshLambertMaterial({ color: 0x88929e, flatShading: true });
    const pavilionMat = new THREE.MeshLambertMaterial({ color: 0xd2c8b8, flatShading: true });
    const domeMat = new THREE.MeshLambertMaterial({ color: PALETTE.roofCopperGreen, flatShading: true });

    // Approach Spans (Left side: Hermitage; Right side: Spit of VI)
    const fixedSpanLen = length * 0.35;
    const deckY = height / 2 + 0.2;

    for (const [sideSign, offsetX] of [[-1, -length * 0.325], [1, length * 0.325]] as const) {
      // 1. Steel Box Girder Base
      const spanBody = new THREE.Mesh(new THREE.BoxGeometry(fixedSpanLen, height, width), spanMat);
      spanBody.position.set(offsetX, 0, 0);
      spanBody.castShadow = true;
      spanBody.receiveShadow = true;
      bridgeGroup.add(spanBody);

      // 2. Roadway Asphalt Surface
      const road = new THREE.Mesh(new THREE.BoxGeometry(fixedSpanLen, 0.4, width - 6), roadMat);
      road.position.set(offsetX, deckY, 0);
      road.receiveShadow = true;
      bridgeGroup.add(road);

      // 3. Two Tram Tracks embedded down center
      for (const trackZ of [-2.4, -1.0, 1.0, 2.4]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(fixedSpanLen, 0.1, 0.12), railTrackMat);
        rail.position.set(offsetX, deckY + 0.21, trackZ);
        bridgeGroup.add(rail);
      }

      // 4. Granite Pedestrian Sidewalks
      for (const swZ of [-width / 2 + 1.5, width / 2 - 1.5]) {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(fixedSpanLen, 0.55, 3.0), sidewalkMat);
        sw.position.set(offsetX, deckY + 0.15, swZ);
        sw.receiveShadow = true;
        bridgeGroup.add(sw);
      }

      // 5. Arched Steel Truss Side Profiles
      this.createArchTrussGirders(bridgeGroup, fixedSpanLen, 3.8, width, offsetX, deckY, 0x404a56);

      // 6. Cast-iron railings along sidewalks
      this.createRailing(bridgeGroup, fixedSpanLen, width, offsetX, deckY, 0x1c2026);

      // 7. Candelabra Lantern Posts
      this.createLanterns(bridgeGroup, fixedSpanLen, width, offsetX, deckY, 18.0);
    }

    // 5 Granite River Piers with Icebreakers
    const pierPositions = [-length * 0.38, -length * 0.165, length * 0.165, length * 0.38];
    for (const px of pierPositions) {
      this.createGranitePier(bridgeGroup, px, -2.5, 0, 11.5, 9.5, width + 5.0, 0x82443c);
    }

    // Operator Control Pavilions on Central Piers (Будки разводки моста)
    for (const px of [-length * 0.165, length * 0.165]) {
      for (const pz of [-width / 2 - 2.8, width / 2 + 2.8]) {
        // Pavilion stone base
        const pav = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.2, 3.2), pavilionMat);
        pav.position.set(px, deckY + 1.6, pz);
        pav.castShadow = true;
        bridgeGroup.add(pav);

        // Copper dome roof
        const dome = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.6, 6), domeMat);
        dome.position.set(px, deckY + 3.2 + 0.8, pz);
        dome.castShadow = true;
        bridgeGroup.add(dome);

        // Windows
        const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.2), new THREE.MeshBasicMaterial({ color: 0x16202c }));
        win.position.set(px, deckY + 1.8, pz + (pz > 0 ? -1.61 : 1.61));
        bridgeGroup.add(win);
      }
    }

    // --- DRAW SPANS (Разводные крылья Дворцового моста) ---
    const wingLength = length * 0.145;
    const wingThickness = 2.4;

    // Wing Left (Hermitage side)
    const pivotL = new THREE.Object3D();
    pivotL.position.set(-wingLength, deckY - 0.5, 0);
    bridgeGroup.add(pivotL);

    const wingMeshL = new THREE.Group();
    const wingBaseL = new THREE.Mesh(new THREE.BoxGeometry(wingLength, wingThickness, width), spanMat);
    wingBaseL.position.set(wingLength / 2, 0, 0);
    wingBaseL.castShadow = true;
    wingBaseL.receiveShadow = true;
    wingMeshL.add(wingBaseL);

    const wingRoadL = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.4, width - 6), roadMat);
    wingRoadL.position.set(wingLength / 2, wingThickness / 2 + 0.15, 0);
    wingMeshL.add(wingRoadL);

    for (const trackZ of [-2.4, -1.0, 1.0, 2.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.1, 0.12), railTrackMat);
      rail.position.set(wingLength / 2, wingThickness / 2 + 0.36, trackZ);
      wingMeshL.add(rail);
    }

    for (const swZ of [-width / 2 + 1.5, width / 2 - 1.5]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.55, 3.0), sidewalkMat);
      sw.position.set(wingLength / 2, wingThickness / 2 + 0.28, swZ);
      wingMeshL.add(sw);
    }

    this.createArchTrussGirders(wingMeshL, wingLength, 2.6, width, wingLength / 2, wingThickness / 2, 0x404a56);
    this.createRailing(wingMeshL, wingLength, width, wingLength / 2, wingThickness / 2 + 0.2, 0x1c2026);

    pivotL.add(wingMeshL);
    this.palaceBridgeWings.push({
      mesh: wingMeshL,
      pivot: pivotL,
      openAngle: (65 * Math.PI) / 180,
      axis: 'z',
      direction: 1
    });

    // Wing Right (Vasilyevsky Island side)
    const pivotR = new THREE.Object3D();
    pivotR.position.set(wingLength, deckY - 0.5, 0);
    bridgeGroup.add(pivotR);

    const wingMeshR = new THREE.Group();
    const wingBaseR = new THREE.Mesh(new THREE.BoxGeometry(wingLength, wingThickness, width), spanMat);
    wingBaseR.position.set(-wingLength / 2, 0, 0);
    wingBaseR.castShadow = true;
    wingBaseR.receiveShadow = true;
    wingMeshR.add(wingBaseR);

    const wingRoadR = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.4, width - 6), roadMat);
    wingRoadR.position.set(-wingLength / 2, wingThickness / 2 + 0.15, 0);
    wingMeshR.add(wingRoadR);

    for (const trackZ of [-2.4, -1.0, 1.0, 2.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.1, 0.12), railTrackMat);
      rail.position.set(-wingLength / 2, wingThickness / 2 + 0.36, trackZ);
      wingMeshR.add(rail);
    }

    for (const swZ of [-width / 2 + 1.5, width / 2 - 1.5]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.55, 3.0), sidewalkMat);
      sw.position.set(-wingLength / 2, wingThickness / 2 + 0.28, swZ);
      wingMeshR.add(sw);
    }

    this.createArchTrussGirders(wingMeshR, wingLength, 2.6, width, -wingLength / 2, wingThickness / 2, 0x404a56);
    this.createRailing(wingMeshR, wingLength, width, -wingLength / 2, wingThickness / 2 + 0.2, 0x1c2026);

    pivotR.add(wingMeshR);
    this.palaceBridgeWings.push({
      mesh: wingMeshR,
      pivot: pivotR,
      openAngle: (65 * Math.PI) / 180,
      axis: 'z',
      direction: -1
    });

    // Night Illumination LEDs along spans and parapets
    const ledPositions: number[] = [];
    const addBox = (ox: number, oy: number, oz: number, sx: number, sy: number, sz: number) => {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      ledPositions.push(
        ox - hx, oy - hy, oz + hz,  ox + hx, oy - hy, oz + hz,  ox + hx, oy + hy, oz + hz,
        ox - hx, oy - hy, oz + hz,  ox + hx, oy + hy, oz + hz,  ox - hx, oy + hy, oz + hz,
        ox + hx, oy - hy, oz - hz,  ox - hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz - hz,
        ox + hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz - hz,  ox + hx, oy + hy, oz - hz,
        ox - hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz - hz,
        ox - hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz - hz,  ox - hx, oy + hy, oz - hz,
        ox - hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz + hz,
        ox - hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz + hz,  ox - hx, oy - hy, oz + hz,
        ox + hx, oy - hy, oz + hz,  ox + hx, oy - hy, oz - hz,  ox + hx, oy + hy, oz - hz,
        ox + hx, oy - hy, oz + hz,  ox + hx, oy - hy, oz - hz,  ox + hx, oy + hy, oz + hz,
        ox - hx, oy - hy, oz - hz,  ox - hx, oy - hy, oz + hz,  ox - hx, oy + hy, oz + hz,
        ox - hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz + hz,  ox - hx, oy + hy, oz - hz,
      );
    };

    for (let x = -length * 0.48; x <= length * 0.48; x += 3.8) {
      for (const z of [-width / 2 + 0.8, width / 2 - 0.8]) {
        addBox(x, deckY + 1.35, z, 0.4, 0.4, 0.4);
      }
    }
    const ledGeo = new THREE.BufferGeometry();
    ledGeo.setAttribute('position', new THREE.Float32BufferAttribute(ledPositions, 3));
    const ledMesh = new THREE.Mesh(ledGeo, this.illuminationMat);
    bridgeGroup.add(ledMesh);

    this.group.add(bridgeGroup);
  }

  /**
   * Троицкий мост (Trinity Bridge)
   * Connects Field of Mars with Petrograd Side across Neva
   * Art Nouveau cantilevered parabolic arches, Batignolles steel lattice, Art Nouveau lanterns
   */
  private createTrinityBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'trinity-bridge';

    // Real geodetic coordinates
    const startX = 930;
    const startZ = -770;
    const endX = 530;
    const endZ = -1300;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 24;
    const deckY = 3.6;

    bridgeGroup.position.set((startX + endX) / 2, 5.0, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x465260, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e333a, flatShading: true });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb4aba0, flatShading: true });

    // 5 continuous cantilevered parabolic steel truss arches
    const fixedLen = length * 0.78;
    const fixedOffset = -length * 0.11;

    const body = new THREE.Mesh(new THREE.BoxGeometry(fixedLen, 3.8, width), spanMat);
    body.position.set(fixedOffset, 0, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    bridgeGroup.add(body);

    const road = new THREE.Mesh(new THREE.BoxGeometry(fixedLen, 0.4, width - 5), roadMat);
    road.position.set(fixedOffset, deckY, 0);
    bridgeGroup.add(road);

    for (const swZ of [-width / 2 + 1.25, width / 2 - 1.25]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(fixedLen, 0.55, 2.5), sidewalkMat);
      sw.position.set(fixedOffset, deckY + 0.15, swZ);
      bridgeGroup.add(sw);
    }

    // Steel parabolic truss arches along the sides
    this.createArchTrussGirders(bridgeGroup, fixedLen, 4.2, width, fixedOffset, deckY, 0x465260);
    this.createRailing(bridgeGroup, fixedLen, width, fixedOffset, deckY, 0x1c2024);
    this.createLanterns(bridgeGroup, fixedLen, width, fixedOffset, deckY, 22.0);

    // Granite piers with rounded Art Nouveau icebreakers
    for (const px of [fixedOffset - fixedLen * 0.35, fixedOffset, fixedOffset + fixedLen * 0.35]) {
      this.createGranitePier(bridgeGroup, px, -2.5, 0, 10.5, 9.0, width + 4.5, 0x7c423a);
    }

    // Trinity single-leaf draw span (lifting upward on Petrograd side)
    const drawLen = length * 0.22;
    const pivot = new THREE.Object3D();
    pivot.position.set(length * 0.28, deckY - 0.5, 0);
    bridgeGroup.add(pivot);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(drawLen, 2.6, width), spanMat);
    wing.position.set(drawLen / 2, 0, 0);
    wing.castShadow = true;
    pivot.add(wing);

    const wingRoad = new THREE.Mesh(new THREE.BoxGeometry(drawLen, 0.4, width - 5), roadMat);
    wingRoad.position.set(drawLen / 2, 1.45, 0);
    pivot.add(wingRoad);

    this.trinityBridgeWings.push({
      mesh: wing,
      pivot: pivot,
      openAngle: (70 * Math.PI) / 180,
      axis: 'z',
      direction: 1
    });

    this.group.add(bridgeGroup);
  }

  /**
   * Благовещенский мост (Annunciation Bridge)
   * First permanent bridge across Neva (1850), 7 cast-iron arched spans, Bryullov railings
   */
  private createAnnunciationBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'annunciation-bridge';

    // Real geodetic coordinates
    const startX = -875;
    const startZ = 560;
    const endX = -1340;
    const endZ = 226;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 26;
    const deckY = 3.6;

    bridgeGroup.position.set((startX + endX) / 2, 4.5, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x38424d, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e333a, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 3.8, width), spanMat);
    body.castShadow = true;
    body.receiveShadow = true;
    bridgeGroup.add(body);

    const road = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, width - 5), roadMat);
    road.position.set(0, deckY, 0);
    bridgeGroup.add(road);

    this.createArchTrussGirders(bridgeGroup, length, 3.2, width, 0, deckY, 0x38424d);
    this.createRailing(bridgeGroup, length, width, 0, deckY, 0x181c22);
    this.createLanterns(bridgeGroup, length, width, 0, deckY, 20.0);

    for (let px = -length * 0.36; px <= length * 0.36; px += length * 0.24) {
      this.createGranitePier(bridgeGroup, px, -2.5, 0, 11.0, 9.0, width + 4.5, 0x82443c);
    }

    this.group.add(bridgeGroup);
  }

  /**
   * Биржевой мост (Exchange Bridge)
   * Connects Spit of Vasilyevsky Island with Petrograd Side across Little Neva
   */
  private createExchangeBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'exchange-bridge';

    // Real geodetic coordinates
    const startX = -475;
    const startZ = -595;
    const endX = -728;
    const endZ = -1020;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 22;
    const deckY = 3.5;

    bridgeGroup.position.set((startX + endX) / 2, 4.5, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x444e58, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e333a, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 3.6, width), spanMat);
    body.castShadow = true;
    bridgeGroup.add(body);

    const road = new THREE.Mesh(new THREE.BoxGeometry(length, 0.4, width - 4), roadMat);
    road.position.set(0, deckY, 0);
    bridgeGroup.add(road);

    this.createArchTrussGirders(bridgeGroup, length, 3.0, width, 0, deckY, 0x444e58);
    this.createRailing(bridgeGroup, length, width, 0, deckY, 0x1c2024);
    this.createLanterns(bridgeGroup, length, width, 0, deckY, 22.0);

    for (const px of [-length * 0.28, 0, length * 0.28]) {
      this.createGranitePier(bridgeGroup, px, -2.5, 0, 10.0, 8.5, width + 4.0, 0x7c423a);
    }

    this.group.add(bridgeGroup);
  }

  /**
   * Банковский мост (Bank Bridge)
   * World-famous pedestrian suspension bridge across Griboedov Canal
   * 4 colossal golden-winged griffin statues holding heavy iron chains in their jaws!
   */
  private createBankBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'bank-bridge';

    // Real geodetic coordinates spanning Griboedov Canal connecting State University of Economics with Bankovsky Lane
    const bx = 588.0;
    const bz = 800.0;
    const bridgeLen = 19.0;
    const bridgeW = 3.4;
    const deckY = 1.9;

    bridgeGroup.position.set(bx, 0, bz);
    bridgeGroup.rotation.y = 0.05; // Exactly perpendicular across Griboedov Canal waters

    const deckMat = new THREE.MeshLambertMaterial({ color: 0x6e523e, flatShading: true }); // Weathered oak deck
    const griffinMat = new THREE.MeshLambertMaterial({ color: 0x2e3238, flatShading: true }); // Dark patinated bronze
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, flatShading: true }); // Imperial gold leaf
    const chainMat = new THREE.MeshLambertMaterial({ color: 0x1c2026, flatShading: true }); // Wrought iron chains
    const pedestalMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c6, flatShading: true }); // White Pudozh limestone

    // Arched wooden pedestrian deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.35, bridgeW), deckMat);
    deck.position.set(0, deckY, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Decorative openwork palmette railings with gold rosettes
    this.createRailing(bridgeGroup, bridgeLen, bridgeW, 0, deckY, 0x1c2024);

    // 4 Griffin Statues on Pedestals at the 4 corners of the bridge
    const cornerOffsets = [
      [-bridgeLen / 2 + 1.8, -bridgeW / 2 - 1.2, 1],
      [-bridgeLen / 2 + 1.8, bridgeW / 2 + 1.2, -1],
      [bridgeLen / 2 - 1.8, -bridgeW / 2 - 1.2, 1],
      [bridgeLen / 2 - 1.8, bridgeW / 2 + 1.2, -1]
    ];

    for (const [gx, gz, dirZ] of cornerOffsets) {
      // 1. Classical Pedestal
      const ped = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.0), pedestalMat);
      ped.position.set(gx, 1.3, gz);
      ped.castShadow = true;
      bridgeGroup.add(ped);

      // 2. Griffin Body (Seated Lion)
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.1), griffinMat);
      body.position.set(gx, 2.6 + 0.75, gz);
      body.castShadow = true;
      bridgeGroup.add(body);

      // 3. Griffin Eagle Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.9), griffinMat);
      head.position.set(gx, 2.6 + 1.8, gz + dirZ * 0.3);
      head.castShadow = true;
      bridgeGroup.add(head);

      // 4. Curved Golden Wings (Золоченые крылья грифонов)
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.3, 2.4);
      wingShape.lineTo(1.1, 3.2);
      wingShape.lineTo(0.8, 1.6);
      wingShape.lineTo(0, 0);

      const wingExt = new THREE.ExtrudeGeometry(wingShape, { depth: 0.15, bevelEnabled: false });
      const wingMesh = new THREE.Mesh(wingExt, goldMat);
      wingMesh.position.set(gx - 0.4, 2.6 + 1.2, gz);
      wingMesh.rotation.y = dirZ > 0 ? 0.3 : -0.3;
      wingMesh.castShadow = true;
      bridgeGroup.add(wingMesh);

      // 5. Spherical Glass Streetlamp on head
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffea94 }));
      lamp.position.set(gx, 2.6 + 2.5, gz + dirZ * 0.3);
      bridgeGroup.add(lamp);

      // 6. Suspension Chains emerging from Griffin's mouth to center of bridge deck
      const chainStart = new THREE.Vector3(gx, 2.6 + 1.6, gz + dirZ * 0.3);
      const chainEnd = new THREE.Vector3(0, deckY + 0.3, dirZ * (bridgeW / 2 - 0.2));
      const chainDist = chainStart.distanceTo(chainEnd);
      const chainMid = chainStart.clone().add(chainEnd).multiplyScalar(0.5);

      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, chainDist, 6), chainMat);
      chain.position.copy(chainMid);
      chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), chainEnd.clone().sub(chainStart).normalize());
      chain.castShadow = true;
      bridgeGroup.add(chain);
    }

    this.group.add(bridgeGroup);
  }

  /**
   * Аничков мост (Anichkov Bridge)
   * Triple pink granite arches over the Fontanka River with Karl Schinkel's
   * legendary hippocampus and mermaid railings along Nevsky Prospekt.
   */
  private createAnichkovBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'anichkov-bridge-deck';

    // Real geodetic coordinates on Nevsky Prospekt over Fontanka
    const bx = 1605;
    const bz = 730;
    const bridgeLen = 54.0;
    const bridgeW = 27.0;
    const deckY = 3.8;

    bridgeGroup.position.set(bx, 0, bz);
    bridgeGroup.rotation.y = -0.58; // Aligned with Nevsky Prospekt

    const graniteMat = new THREE.MeshLambertMaterial({ color: 0x88463e, flatShading: true }); // Pink Rapakivi granite
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e333a, flatShading: true });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb4aba0, flatShading: true });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x1c2024, flatShading: true });

    // 3 Curved Granite Arches
    for (let i = -1; i <= 1; i++) {
      const archX = i * 16.0;
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.0, bridgeW, 12, 1, false, 0, Math.PI), graniteMat);
      arch.rotation.z = Math.PI;
      arch.rotation.x = Math.PI / 2;
      arch.position.set(archX, deckY - 2.8, 0);
      arch.castShadow = true;
      bridgeGroup.add(arch);
    }

    // Granite Spandrel Walls & Deck Base
    const deckBase = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 3.2, bridgeW), graniteMat);
    deckBase.position.set(0, deckY - 1.4, 0);
    deckBase.castShadow = true;
    deckBase.receiveShadow = true;
    bridgeGroup.add(deckBase);

    // Broad Nevsky Prospekt Roadway
    const road = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.4, bridgeW - 6.0), roadMat);
    road.position.set(0, deckY, 0);
    road.receiveShadow = true;
    bridgeGroup.add(road);

    // Granite Sidewalks
    for (const swZ of [-bridgeW / 2 + 1.5, bridgeW / 2 - 1.5]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.55, 3.0), sidewalkMat);
      sw.position.set(0, deckY + 0.15, swZ);
      sw.receiveShadow = true;
      bridgeGroup.add(sw);
    }

    // Schinkel's Hippocampus & Mermaid Railings
    this.createRailing(bridgeGroup, bridgeLen, bridgeW, 0, deckY, 0x1c2024);

    // Cast-iron Streetlamps
    this.createLanterns(bridgeGroup, bridgeLen, bridgeW, 0, deckY, 18.0);

    this.group.add(bridgeGroup);
  }

  /**
   * Синий мост (Blue Bridge)
   * The widest bridge in Saint Petersburg (97m) across the Moyka at St. Isaac's Square
   */
  private createBlueBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'blue-bridge';

    // Coordinates right between St. Isaac's Cathedral and Mariinsky Palace
    const bx = -450;
    const bz = 440;
    const bridgeLen = 32.0;
    const bridgeW = 88.0; // Exceptionally wide square-bridge!
    const deckY = 3.2;

    bridgeGroup.position.set(bx, 0, bz);
    bridgeGroup.rotation.y = 0.28;

    const blueArchMat = new THREE.MeshLambertMaterial({ color: 0x1d3c6a, flatShading: true }); // Imperial Prussian Blue
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x34383e, flatShading: true });
    const obeliskMat = new THREE.MeshLambertMaterial({ color: 0x22262c, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, flatShading: true });

    // Wide Cast-iron Arch
    const arch = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 2.8, bridgeW), blueArchMat);
    arch.position.set(0, deckY - 1.2, 0);
    arch.castShadow = true;
    arch.receiveShadow = true;
    bridgeGroup.add(arch);

    // Roadway paving seamlessly integrating with St. Isaac's Square
    const road = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.35, bridgeW), roadMat);
    road.position.set(0, deckY, 0);
    road.receiveShadow = true;
    bridgeGroup.add(road);

    // Blue painted cast-iron balustrades on river-facing edges
    this.createRailing(bridgeGroup, bridgeLen, bridgeW, 0, deckY, 0x1d3c6a);

    // Cast-iron Water Level Gauge Obelisk (Водомерный гранитный столб наводнений)
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.65, 4.2, 4), obeliskMat);
    obelisk.position.set(bridgeLen / 2 - 1.5, deckY + 2.1, -bridgeW / 2 + 2.0);
    bridgeGroup.add(obelisk);

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), goldMat);
    globe.position.set(bridgeLen / 2 - 1.5, deckY + 4.4, -bridgeW / 2 + 2.0);
    bridgeGroup.add(globe);

    this.group.add(bridgeGroup);
  }

  /**
   * Зелёный мост (Green Bridge) across Moyka River along Nevsky Prospekt
   * William Hastie cast-iron masterpiece (1806) carrying 6 lanes of Nevsky Prospekt
   */
  private createGreenBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'green-bridge';

    const bx = 280.0;
    const bz = 412.0;
    const bridgeLen = 28.0;
    const bridgeW = 34.0;
    const deckY = 0.35;

    bridgeGroup.position.set(bx, 0, bz);
    bridgeGroup.rotation.y = -0.42; // Perpendicular across Moyka River aligning with Nevsky Prospekt

    const deckMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt, flatShading: true });
    const ironMat = new THREE.MeshLambertMaterial({ color: 0x1e4634, flatShading: true }); // Malachite green cast iron
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xd4af37, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });

    // Granite embankment abutments
    for (const sx of [-bridgeLen / 2 + 2, bridgeLen / 2 - 2]) {
      const abut = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.5, bridgeW + 4), graniteMat);
      abut.position.set(sx, 1.25, 0);
      bridgeGroup.add(abut);
    }

    // Cast-iron arch vault
    const arch = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen - 4, 1.2, bridgeW), ironMat);
    arch.position.set(0, deckY - 0.7, 0);
    bridgeGroup.add(arch);

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.3, bridgeW), deckMat);
    deck.position.set(0, deckY, 0);
    bridgeGroup.add(deck);

    // Green cast-iron railings with gilded rosettes
    for (const sz of [-bridgeW / 2 + 0.35, bridgeW / 2 - 0.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 1.1, 0.35), ironMat);
      rail.position.set(0, deckY + 0.65, sz);
      bridgeGroup.add(rail);

      for (let rx = -bridgeLen / 2 + 2; rx <= bridgeLen / 2 - 2; rx += 4) {
        const rosette = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.45), goldMat);
        rosette.position.set(rx, deckY + 0.65, sz);
        bridgeGroup.add(rosette);
      }
    }

    this.group.add(bridgeGroup);
  }

  /**
   * Казанский мост (Kazansky Bridge) across Griboedov Canal on Nevsky Prospekt
   * Right in front of Kazan Cathedral and Singer House. Spans Griboedov Canal carrying 6 lanes of Nevsky
   */
  private createKazanskyBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'kazansky-bridge';

    const bx = 656.0;
    const bz = 505.0;
    const bridgeLen = 20.0;
    const bridgeW = 34.0; // Carrying Nevsky Prospekt lanes across Griboedov Canal
    const deckY = 0.35; // Flush with asphalt street level

    bridgeGroup.position.set(bx, 0, bz);
    bridgeGroup.rotation.y = -0.17; // Aligned with Griboedov Canal water channel

    const deckMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbGranitePink, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });

    // Granite single vault arch
    const arch = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen - 2, 1.4, bridgeW), stoneMat);
    arch.position.set(0, deckY - 0.8, 0);
    bridgeGroup.add(arch);

    // Deck flush with Nevsky Prospekt
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 0.3, bridgeW), deckMat);
    deck.position.set(0, deckY, 0);
    bridgeGroup.add(deck);

    // Granite parapets
    for (const sz of [-bridgeW / 2 + 0.4, bridgeW / 2 - 0.4]) {
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(bridgeLen, 1.1, 0.6), graniteMat);
      parapet.position.set(0, deckY + 0.65, sz);
      bridgeGroup.add(parapet);
    }

    this.group.add(bridgeGroup);
  }

  public isManualOverride: boolean = false;

  public setDraw(open: boolean, manual: boolean = true) {
    this.areOpen = open;
    this.targetProgress = open ? 1.0 : 0.0;
    if (manual) {
      this.isManualOverride = true;
    }
  }

  public toggleDraw() {
    this.setDraw(!this.areOpen, true);
  }

  public toggleBridge() {
    this.toggleDraw();
  }

  public update(deltaTime: number, hourOfDay?: number, nightFactor?: number) {
    if (nightFactor !== undefined) {
      const glow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.15) * 2.5));
      this.illuminationMat.opacity = glow;
    }

    // If hourOfDay is supplied and not manually overridden, follow official Saint Petersburg bridge schedule (01:10 to 04:55)
    if (hourOfDay !== undefined && !this.isManualOverride) {
      const isScheduleOpen = hourOfDay >= 1.15 && hourOfDay <= 4.9;
      if (isScheduleOpen !== this.areOpen) {
        this.setDraw(isScheduleOpen, false);
      }
    }

    // Smooth animation of drawbridges
    const speed = 0.8; // animation rate
    if (Math.abs(this.openProgress - this.targetProgress) > 0.001) {
      const step = Math.sign(this.targetProgress - this.openProgress) * deltaTime * speed;
      if (Math.abs(step) >= Math.abs(this.targetProgress - this.openProgress)) {
        this.openProgress = this.targetProgress;
      } else {
        this.openProgress += step;
      }
    }

    // Always apply rotation to Palace Bridge wings according to current openProgress
    for (const wing of this.palaceBridgeWings) {
      const curAngle = wing.openAngle * this.openProgress * wing.direction;
      if (wing.axis === 'z') {
        wing.pivot.rotation.z = curAngle;
      } else {
        wing.pivot.rotation.x = curAngle;
      }
    }

    // Apply rotation to Trinity Bridge
    for (const wing of this.trinityBridgeWings) {
      wing.pivot.rotation.z = wing.openAngle * this.openProgress * wing.direction;
    }
  }
}
