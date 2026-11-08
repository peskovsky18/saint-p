import * as THREE from 'three';

export interface FlightControls {
  pitch: number;    // -1 (down) to 1 (up)
  roll: number;     // -1 (left) to 1 (right)
  throttle: number; // 0.0 to 1.0
}

export class FlightSimulator {
  public isActive: boolean = false;
  public planeMesh: THREE.Group;
  public propeller: THREE.Mesh;

  // Flight Physics State
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public rotation: THREE.Euler;
  public speed: number = 45; // m/s (~160 km/h)
  public throttle: number = 0.6;
  public pitch: number = 0;
  public roll: number = 0;
  public yaw: number = 0;

  // Controls input
  public controls: FlightControls = { pitch: 0, roll: 0, throttle: 0.6 };
  private keyState: { [key: string]: boolean } = {};

  constructor(scene: THREE.Scene) {
    this.planeMesh = new THREE.Group();
    this.planeMesh.name = 'flight-airplane';
    this.planeMesh.visible = false;
    scene.add(this.planeMesh);

    // Initial plane position: over the Neva River between Palace Bridge and Peter & Paul
    this.position = new THREE.Vector3(0, 75, -200);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.rotation = new THREE.Euler(0, -Math.PI / 2, 0, 'YXZ');
    this.yaw = -Math.PI / 2;

    this.propeller = this.buildAirplaneModel();
    this.setupKeyListeners();
  }

  private buildAirplaneModel(): THREE.Mesh {
    // Vintage Red & Cream biplane
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd93829, flatShading: true });
    const wingMat = new THREE.MeshLambertMaterial({ color: 0xf5eedc, flatShading: true });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x3d434a, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x223547, flatShading: true });

    // Fuselage
    const fuseGeo = new THREE.BoxGeometry(1.6, 1.4, 9.0);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    fuse.castShadow = true;
    this.planeMesh.add(fuse);

    // Cockpit windscreen
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.4), glassMat);
    glass.position.set(0, 0.9, -0.6);
    this.planeMesh.add(glass);

    // Top Main Wing
    const wingGeo = new THREE.BoxGeometry(12.0, 0.25, 2.2);
    const topWing = new THREE.Mesh(wingGeo, wingMat);
    topWing.position.set(0, 1.4, -0.8);
    topWing.castShadow = true;
    this.planeMesh.add(topWing);

    // Bottom Main Wing
    const botWing = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.25, 2.0), wingMat);
    botWing.position.set(0, -0.5, -0.8);
    botWing.castShadow = true;
    this.planeMesh.add(botWing);

    // Wing Struts (стойки биплана)
    for (const sx of [-4.5, 4.5]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0), metalMat);
      strut.position.set(sx, 0.45, -0.8);
      this.planeMesh.add(strut);
    }

    // Tail Fin (вертикальный киль)
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 1.8), bodyMat);
    fin.position.set(0, 1.0, 4.0);
    this.planeMesh.add(fin);

    // Tail Stabilizer (горизонтальный стабилизатор)
    const stab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 1.4), wingMat);
    stab.position.set(0, 0.3, 4.0);
    this.planeMesh.add(stab);

    // Propeller (вращающийся винт)
    const propGeo = new THREE.BoxGeometry(2.6, 0.2, 0.1);
    const prop = new THREE.Mesh(propGeo, metalMat);
    prop.position.set(0, 0, -4.55);
    this.planeMesh.add(prop);

    return prop;
  }

  private setupKeyListeners() {
    window.addEventListener('keydown', (e) => {
      this.keyState[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
    });
  }

  public activate() {
    this.isActive = true;
    this.planeMesh.visible = true;
    // Reset to fly toward Spit of Vasilyevsky Island
    this.position.set(100, 85, -120);
    this.yaw = -Math.PI * 0.75;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 45;
    this.throttle = 0.65;
  }

  public deactivate() {
    this.isActive = false;
    this.planeMesh.visible = false;
  }

  public update(deltaTime: number) {
    if (!this.isActive) return;

    // Process Keyboard Inputs
    // Pitch (W/S or Up/Down)
    let targetPitch = 0;
    if (this.keyState['KeyW'] || this.keyState['ArrowDown']) targetPitch = -0.55; // Pitch down
    if (this.keyState['KeyS'] || this.keyState['ArrowUp']) targetPitch = 0.55;   // Pitch up

    // Roll / Turn (A/D or Left/Right)
    let targetRoll = 0;
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) targetRoll = 0.65;  // Roll left
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) targetRoll = -0.65; // Roll right

    // Throttle (+ / - or Shift / Space)
    if (this.keyState['ShiftLeft'] || this.keyState['KeyE']) {
      this.throttle = Math.min(1.0, this.throttle + deltaTime * 0.4);
    }
    if (this.keyState['ControlLeft'] || this.keyState['KeyQ']) {
      this.throttle = Math.max(0.2, this.throttle - deltaTime * 0.4);
    }

    // Smooth control inputs
    this.pitch += (targetPitch - this.pitch) * deltaTime * 3.5;
    this.roll += (targetRoll - this.roll) * deltaTime * 4.0;

    // Banking creates yaw (coordinated turn)
    const turnRate = -this.roll * 1.4;
    this.yaw += turnRate * deltaTime;

    // Speed physics
    const targetSpeed = 25 + this.throttle * 40;
    this.speed += (targetSpeed - this.speed) * deltaTime * 1.5;

    // Forward direction vector
    const dir = new THREE.Vector3(0, 0, -1);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    dir.applyQuaternion(quat);

    // Update position
    this.velocity.copy(dir).multiplyScalar(this.speed * deltaTime);
    this.position.add(this.velocity);

    // Altitude floor / ceiling clamp
    if (this.position.y < 8.0) {
      this.position.y = 8.0;
      this.pitch = Math.max(0, this.pitch);
    }
    if (this.position.y > 350.0) {
      this.position.y = 350.0;
      this.pitch = Math.min(0, this.pitch);
    }

    // Apply transformation to 3D mesh
    this.planeMesh.position.copy(this.position);
    this.planeMesh.quaternion.copy(quat);

    // Spin propeller
    this.propeller.rotation.z += deltaTime * (25 + this.throttle * 60);
  }

  public getFlightStats(): { speedKmh: number; altitudeMeters: number; throttlePct: number } {
    return {
      speedKmh: Math.round(this.speed * 3.6),
      altitudeMeters: Math.round(this.position.y),
      throttlePct: Math.round(this.throttle * 100)
    };
  }
}
