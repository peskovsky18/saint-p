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

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'bridges';
    scene.add(this.group);

    this.createPalaceBridge();
    this.createTrinityBridge();
    this.createAnnunciationBridge();
    this.createExchangeBridge();
  }

  /**
   * Дворцовый мост (Palace Bridge)
   * Connects Palace Embankment (near Hermitage) to Spit of Vasilyevsky Island
   */
  private createPalaceBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'palace-bridge';

    // Palace Bridge real GPS coordinates
    const bridgeStartX = -60;
    const bridgeStartZ = -75;
    const bridgeEndX = -310;
    const bridgeEndZ = -252;

    const angle = Math.atan2(bridgeEndZ - bridgeStartZ, bridgeEndX - bridgeStartX);
    const length = Math.hypot(bridgeEndX - bridgeStartX, bridgeEndZ - bridgeStartZ);
    const width = 28;
    const height = 4.5;

    bridgeGroup.position.set((bridgeStartX + bridgeEndX) / 2, 4.5, (bridgeStartZ + bridgeEndZ) / 2);
    bridgeGroup.rotation.y = -angle;

    // Fixed approach spans (granite piers + cast iron arches)
    const pierGeo = new THREE.BoxGeometry(10, 8, width + 4);
    const pierMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x48525e, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt, flatShading: true });
    const railingMat = new THREE.MeshLambertMaterial({ color: 0x222730, flatShading: true });

    // Left fixed section
    const leftFixed = new THREE.Mesh(new THREE.BoxGeometry(length * 0.35, height, width), spanMat);
    leftFixed.position.x = -length * 0.32;
    leftFixed.castShadow = true;
    leftFixed.receiveShadow = true;
    bridgeGroup.add(leftFixed);

    // Right fixed section
    const rightFixed = new THREE.Mesh(new THREE.BoxGeometry(length * 0.35, height, width), spanMat);
    rightFixed.position.x = length * 0.32;
    rightFixed.castShadow = true;
    rightFixed.receiveShadow = true;
    bridgeGroup.add(rightFixed);

    // Piers in the water
    for (const px of [-length * 0.35, -length * 0.16, length * 0.16, length * 0.35]) {
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(px, -2, 0);
      pier.castShadow = true;
      pier.receiveShadow = true;
      bridgeGroup.add(pier);
    }

    // Road surface and tram tracks on fixed spans
    const roadGeo = new THREE.BoxGeometry(length * 0.35, 0.4, width - 4);
    const roadL = new THREE.Mesh(roadGeo, roadMat);
    roadL.position.set(-length * 0.32, height / 2 + 0.2, 0);
    roadL.receiveShadow = true;
    bridgeGroup.add(roadL);

    const roadR = new THREE.Mesh(roadGeo, roadMat);
    roadR.position.set(length * 0.32, height / 2 + 0.2, 0);
    roadR.receiveShadow = true;
    bridgeGroup.add(roadR);

    // --- DRAW SPANS (Крылья разводного моста) ---
    // Central span is split into two lifting wings
    const wingLength = length * 0.15;
    const wingThickness = 2.2;

    // Wing Left (Hermitage side)
    const pivotL = new THREE.Object3D();
    pivotL.position.set(-wingLength, 0, 0);
    bridgeGroup.add(pivotL);

    const wingMeshL = new THREE.Group();
    const wingBaseL = new THREE.Mesh(new THREE.BoxGeometry(wingLength, wingThickness, width), spanMat);
    wingBaseL.position.set(wingLength / 2, 0, 0);
    wingBaseL.castShadow = true;
    wingBaseL.receiveShadow = true;
    wingMeshL.add(wingBaseL);

    // Wing road surface
    const wingRoadL = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.3, width - 4), roadMat);
    wingRoadL.position.set(wingLength / 2, wingThickness / 2 + 0.15, 0);
    wingMeshL.add(wingRoadL);

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
    pivotR.position.set(wingLength, 0, 0);
    bridgeGroup.add(pivotR);

    const wingMeshR = new THREE.Group();
    const wingBaseR = new THREE.Mesh(new THREE.BoxGeometry(wingLength, wingThickness, width), spanMat);
    wingBaseR.position.set(-wingLength / 2, 0, 0);
    wingBaseR.castShadow = true;
    wingBaseR.receiveShadow = true;
    wingMeshR.add(wingBaseR);

    const wingRoadR = new THREE.Mesh(new THREE.BoxGeometry(wingLength, 0.3, width - 4), roadMat);
    wingRoadR.position.set(-wingLength / 2, wingThickness / 2 + 0.15, 0);
    wingMeshR.add(wingRoadR);

    pivotR.add(wingMeshR);
    this.palaceBridgeWings.push({
      mesh: wingMeshR,
      pivot: pivotR,
      openAngle: (65 * Math.PI) / 180,
      axis: 'z',
      direction: -1
    });

    this.group.add(bridgeGroup);
  }

  /**
   * Троицкий мост (Trinity Bridge)
   * Connects Field of Mars with Petrograd Side (Troitskaya Square)
   */
  private createTrinityBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'trinity-bridge';

    // Trinity Bridge real GPS coordinates
    const startX = 970;
    const startZ = -820;
    const endX = 550;
    const endZ = -1300;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 24;

    bridgeGroup.position.set((startX + endX) / 2, 5.0, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x54626e, flatShading: true });
    const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt, flatShading: true });

    // Main arched body
    const body = new THREE.Mesh(new THREE.BoxGeometry(length * 0.8, 3.5, width), spanMat);
    body.position.x = -length * 0.1;
    body.castShadow = true;
    bridgeGroup.add(body);

    const road = new THREE.Mesh(new THREE.BoxGeometry(length * 0.8, 0.3, width - 4), roadMat);
    road.position.set(-length * 0.1, 2.0, 0);
    bridgeGroup.add(road);

    // Trinity draw span (single wing lifting upward on Left Bank side)
    const drawLen = length * 0.2;
    const pivot = new THREE.Object3D();
    pivot.position.set(length * 0.3, 0, 0);
    bridgeGroup.add(pivot);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(drawLen, 2.5, width), spanMat);
    wing.position.set(drawLen / 2, 0, 0);
    wing.castShadow = true;
    pivot.add(wing);

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
   */
  private createAnnunciationBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'annunciation-bridge';

    const startX = -820;
    const startZ = 160;
    const endX = -940;
    const endZ = -140;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 26;

    bridgeGroup.position.set((startX + endX) / 2, 4.5, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x414b54, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 3.8, width), spanMat);
    body.castShadow = true;
    bridgeGroup.add(body);

    this.group.add(bridgeGroup);
  }

  /**
   * Биржевой мост (Exchange Bridge)
   * Connects Spit of Vasilyevsky Island with Petrograd Side across Little Neva
   */
  private createExchangeBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.name = 'exchange-bridge';

    const startX = -320;
    const startZ = -440;
    const endX = -300;
    const endZ = -680;

    const angle = Math.atan2(endZ - startZ, endX - startX);
    const length = Math.hypot(endX - startX, endZ - startZ);
    const width = 22;

    bridgeGroup.position.set((startX + endX) / 2, 4.5, (startZ + endZ) / 2);
    bridgeGroup.rotation.y = -angle;

    const spanMat = new THREE.MeshLambertMaterial({ color: 0x4a555e, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 3.5, width), spanMat);
    body.castShadow = true;
    bridgeGroup.add(body);

    this.group.add(bridgeGroup);
  }

  public setDraw(open: boolean) {
    this.areOpen = open;
    this.targetProgress = open ? 1.0 : 0.0;
  }

  public toggleDraw() {
    this.setDraw(!this.areOpen);
  }

  public toggleBridge() {
    this.toggleDraw();
  }

  public update(deltaTime: number, hourOfDay?: number) {
    // If hourOfDay is supplied, check official Saint Petersburg bridge schedule (01:10 to 04:55)
    if (hourOfDay !== undefined) {
      const isScheduleOpen = hourOfDay >= 1.15 && hourOfDay <= 4.9;
      if (isScheduleOpen !== this.areOpen) {
        this.setDraw(isScheduleOpen);
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

      // Apply rotation to Palace Bridge wings
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
}
