import * as THREE from 'three';

export interface FlightStats {
  speedKmh: number;
  altitudeMeters: number;
  throttlePct: number;
  vSpeedMs: number;
  invertPitch: boolean;
  mouseControl: boolean;
}

export class FlightSimulator {
  public isActive: boolean = false;
  public planeMesh: THREE.Group;
  public propeller!: THREE.Mesh;
  public propBlurDisc!: THREE.Mesh;
  public rudderMesh!: THREE.Mesh;
  public elevatorMesh!: THREE.Mesh;
  public scarfMesh!: THREE.Mesh;
  public beaconLight!: THREE.PointLight;
  public landingLight!: THREE.SpotLight;

  // Wingtip vapor trails
  private trailGeometryLeft!: THREE.BufferGeometry;
  private trailGeometryRight!: THREE.BufferGeometry;
  private trailLineLeft!: THREE.Line;
  private trailLineRight!: THREE.Line;
  private readonly maxTrailPoints: number = 36;
  private trailPointsLeft: THREE.Vector3[] = [];
  private trailPointsRight: THREE.Vector3[] = [];

  // Flight Physics State
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public speed: number = 44; // m/s (~158 km/h)
  public throttle: number = 0.65;
  public pitch: number = 0;
  public roll: number = 0;
  public yaw: number = 0;
  public vSpeed: number = 0;

  // Control Settings
  public invertPitch: boolean = false;
  public mouseControl: boolean = false;
  private mousePos = { x: 0, y: 0 }; // Normalized -1..1 from screen center
  private isMouseDown: boolean = false;
  private keyState: { [key: string]: boolean } = {};

  constructor(scene: THREE.Scene) {
    this.planeMesh = new THREE.Group();
    this.planeMesh.name = 'flight-airplane';
    this.planeMesh.visible = false;
    scene.add(this.planeMesh);

    // Initial position over the Neva River between Spit of Vasilyevsky and Winter Palace
    this.position = new THREE.Vector3(80, 85, -140);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = -Math.PI * 0.72;

    // Load persisted settings
    try {
      this.invertPitch = localStorage.getItem('spb_flight_invert') === 'true';
      this.mouseControl = localStorage.getItem('spb_flight_mouse') === 'true';
    } catch {
      // ignore
    }

    this.buildAirplaneModel();
    this.buildVaporTrails(scene);
    this.setupEventListeners();
  }

  /**
   * Builds an iconic, large, highly-detailed 1930s Leningrad Aeroclub biplane model.
   * Proportions: Wingspan ~26m, Length ~17.5m, Height ~6.2m.
   */
  private buildAirplaneModel() {
    // Vintage High-Contrast Aviation Palette
    const crimsonMat = new THREE.MeshLambertMaterial({ color: 0xba2624, flatShading: true });
    const creamMat = new THREE.MeshLambertMaterial({ color: 0xfcf5e3, flatShading: true });
    const darkMetalMat = new THREE.MeshLambertMaterial({ color: 0x33373d, flatShading: true });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0x9fa8b5, flatShading: true });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7a431d, flatShading: true });
    const yellowMat = new THREE.MeshLambertMaterial({ color: 0xf0b824, flatShading: true });
    const rubberMat = new THREE.MeshLambertMaterial({ color: 0x1b1d20, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({
      color: 0x243e5c,
      transparent: true,
      opacity: 0.72,
      flatShading: true
    });

    // 1. Main Fuselage Body (streamlined fuselage)
    const fuseBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.7, 12.0), crimsonMat);
    fuseBody.position.set(0, 0.4, -0.5);
    fuseBody.castShadow = true;
    this.planeMesh.add(fuseBody);

    // Cream mid-stripe along fuselage
    const stripeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 11.6), creamMat);
    stripeLeft.position.set(-1.62, 0.4, -0.5);
    this.planeMesh.add(stripeLeft);

    const stripeRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 11.6), creamMat);
    stripeRight.position.set(1.62, 0.4, -0.5);
    this.planeMesh.add(stripeRight);

    // Tapered tail boom
    const tailBoom = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 8.5), crimsonMat);
    tailBoom.position.set(0, 0.7, 7.8);
    tailBoom.castShadow = true;
    this.planeMesh.add(tailBoom);

    // Nose Cowling & Engine Firewall
    const noseCowl = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.65, 3.2), darkMetalMat);
    noseCowl.position.set(0, 0.4, -7.5);
    noseCowl.castShadow = true;
    this.planeMesh.add(noseCowl);

    // Radial 9-Cylinder Engine Ring
    const engineRing = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.65, 1.4, 16), darkMetalMat);
    engineRing.rotation.x = Math.PI / 2;
    engineRing.position.set(0, 0.4, -9.2);
    this.planeMesh.add(engineRing);

    // 9 Radial Chrome Cylinders around engine axis
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const cyl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.55), chromeMat);
      cyl.position.set(
        Math.sin(angle) * 1.25,
        0.4 + Math.cos(angle) * 1.25,
        -9.1
      );
      cyl.rotation.z = -angle;
      this.planeMesh.add(cyl);
    }

    // Twin Exhaust Collector Pipes
    for (const sx of [-1.55, 1.55]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.5, 8), darkMetalMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(sx, -0.4, -7.0);
      this.planeMesh.add(exhaust);
    }

    // 2. Wings (Classic Biplane staggered dual wings)
    // Upper Main Wing: 26.0m span, 3.8m chord
    const topWing = new THREE.Mesh(new THREE.BoxGeometry(26.0, 0.38, 3.8), creamMat);
    topWing.position.set(0, 2.9, -2.2);
    topWing.castShadow = true;
    this.planeMesh.add(topWing);

    // Red racing identification wingtips on upper wing
    for (const sx of [-11.5, 11.5]) {
      const tip = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.40, 3.82), crimsonMat);
      tip.position.set(sx, 2.9, -2.2);
      this.planeMesh.add(tip);
    }

    // Upper wing center pilot cutout
    const cutout = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 1.4), darkMetalMat);
    cutout.position.set(0, 2.9, -0.6);
    this.planeMesh.add(cutout);

    // Lower Main Wing: 21.0m span, 3.2m chord
    const botWing = new THREE.Mesh(new THREE.BoxGeometry(21.0, 0.34, 3.2), creamMat);
    botWing.position.set(0, -0.8, -1.8);
    botWing.castShadow = true;
    this.planeMesh.add(botWing);

    // Interplane Wing Struts (стойки крыльев N-образной формы)
    for (const sx of [-8.5, 8.5]) {
      // Front vertical strut
      const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.7, 8), darkMetalMat);
      s1.position.set(sx, 1.05, -2.9);
      this.planeMesh.add(s1);

      // Rear vertical strut
      const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.7, 8), darkMetalMat);
      s2.position.set(sx, 1.05, -1.3);
      this.planeMesh.add(s2);

      // Diagonal brace
      const diag = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.0, 8), chromeMat);
      diag.position.set(sx, 1.05, -2.1);
      diag.rotation.x = Math.atan2(1.6, 3.7);
      this.planeMesh.add(diag);
    }

    // Cabane Struts (стойки над фюзеляжем)
    for (const sx of [-1.2, 1.2]) {
      const cs = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 8), darkMetalMat);
      cs.position.set(sx, 2.0, -2.0);
      this.planeMesh.add(cs);
    }

    // 3. Cockpit, Windscreen & Animated Aviator
    const cockpitHole = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 2.6), darkMetalMat);
    cockpitHole.position.set(0, 1.7, 0.2);
    this.planeMesh.add(cockpitHole);

    // Padded Leather Coaming around cockpit
    const coaming = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 2.8), woodMat);
    coaming.position.set(0, 1.8, 0.2);
    this.planeMesh.add(coaming);

    // Windscreen
    const windscreen = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.12), glassMat);
    windscreen.position.set(0, 2.15, -1.1);
    windscreen.rotation.x = -0.25;
    this.planeMesh.add(windscreen);

    // Pilot character
    const pilotTorso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.9), new THREE.MeshLambertMaterial({ color: 0x583921 }));
    pilotTorso.position.set(0, 1.6, 0.2);
    this.planeMesh.add(pilotTorso);

    const pilotHead = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), new THREE.MeshLambertMaterial({ color: 0x3d2311 }));
    pilotHead.position.set(0, 2.45, 0.2);
    this.planeMesh.add(pilotHead);

    // Aviator Goggles
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.22, 0.28), yellowMat);
    goggles.position.set(0, 2.5, -0.15);
    this.planeMesh.add(goggles);

    // Flowing White Silk Scarf
    this.scarfMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.15, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xf5f5f5, flatShading: true })
    );
    this.scarfMesh.position.set(0.45, 2.3, 0.85);
    this.planeMesh.add(this.scarfMesh);

    // 4. Tail Empennage (киль, стабилизатор, рули)
    // Vertical Tail Fin
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.2, 3.6), crimsonMat);
    fin.position.set(0, 2.7, 10.5);
    fin.castShadow = true;
    this.planeMesh.add(fin);

    // Animated Rudder (руль направления)
    this.rudderMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.0, 2.0), creamMat);
    this.rudderMesh.position.set(0, 2.7, 12.8);
    this.planeMesh.add(this.rudderMesh);

    // Horizontal Stabilizer
    const stab = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.32, 2.8), creamMat);
    stab.position.set(0, 1.0, 10.5);
    stab.castShadow = true;
    this.planeMesh.add(stab);

    // Animated Elevators (рули высоты)
    this.elevatorMesh = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.26, 1.6), crimsonMat);
    this.elevatorMesh.position.set(0, 1.0, 12.4);
    this.planeMesh.add(this.elevatorMesh);

    // 5. Landing Gear (мощное классическое шасси)
    for (const sx of [-1.8, 1.8]) {
      // Main V-Strut
      const lgStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 8), darkMetalMat);
      lgStrut.position.set(sx, -1.1, -4.2);
      lgStrut.rotation.z = sx > 0 ? -0.18 : 0.18;
      this.planeMesh.add(lgStrut);

      // Large Balloon Wheel
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.65, 16), rubberMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 1.35, -2.2, -4.2);
      wheel.castShadow = true;
      this.planeMesh.add(wheel);

      // Hubcap
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.68, 12), creamMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(sx * 1.35, -2.2, -4.2);
      this.planeMesh.add(hub);
    }

    // Rear Tail Wheel / Skid
    const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 10), rubberMat);
    tailWheel.rotation.z = Math.PI / 2;
    tailWheel.position.set(0, -0.3, 11.2);
    this.planeMesh.add(tailWheel);

    // 6. Propeller & Spinner Assembly
    // Spinner Cone
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 16), chromeMat);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.set(0, 0.4, -10.8);
    this.planeMesh.add(spinner);

    // Propeller Blades (2 large sculpted wooden blades with yellow safety tips)
    const propGroup = new THREE.Group();
    propGroup.position.set(0, 0.4, -10.4);

    const bladeGeo = new THREE.BoxGeometry(6.6, 0.58, 0.14);
    const bladeMesh = new THREE.Mesh(bladeGeo, woodMat);
    bladeMesh.castShadow = true;
    propGroup.add(bladeMesh);

    // Yellow blade tips
    for (const sx of [-3.0, 3.0]) {
      const tipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.16), yellowMat);
      tipMesh.position.set(sx, 0, 0);
      propGroup.add(tipMesh);
    }

    this.propeller = propGroup as unknown as THREE.Mesh;
    this.planeMesh.add(propGroup);

    // Propeller High-Speed Motion Blur Disc
    const blurGeo = new THREE.RingGeometry(0.6, 3.3, 24);
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });
    this.propBlurDisc = new THREE.Mesh(blurGeo, blurMat);
    this.propBlurDisc.position.set(0, 0.4, -10.5);
    this.planeMesh.add(this.propBlurDisc);

    // 7. Navigation Lights & Night Illumination
    // Port Wingtip (Red)
    const portLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff1111 })
    );
    portLight.position.set(-13.0, 2.9, -2.2);
    this.planeMesh.add(portLight);

    // Starboard Wingtip (Green)
    const starLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshLambertMaterial({ color: 0x22ff44, emissive: 0x11ff22 })
    );
    starLight.position.set(13.0, 2.9, -2.2);
    this.planeMesh.add(starLight);

    // Tail Fin Strobe Beacon
    const beaconMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.45, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    beaconMesh.position.set(0, 4.9, 10.2);
    this.planeMesh.add(beaconMesh);

    this.beaconLight = new THREE.PointLight(0xffffff, 2.0, 40);
    this.beaconLight.position.set(0, 5.0, 10.2);
    this.planeMesh.add(this.beaconLight);

    // Forward Landing Spotlight
    this.landingLight = new THREE.SpotLight(0xfffae0, 2.5, 180, Math.PI / 6, 0.4);
    this.landingLight.position.set(0, -0.2, -8.0);
    this.landingLight.target.position.set(0, -25.0, -120.0);
    this.planeMesh.add(this.landingLight);
    this.planeMesh.add(this.landingLight.target);
  }

  /**
   * Initializes dynamic aerodynamic vapor ribbon trails streaming behind the biplane wingtips.
   */
  private buildVaporTrails(scene: THREE.Scene) {
    const leftPositions = new Float32Array(this.maxTrailPoints * 3);
    const rightPositions = new Float32Array(this.maxTrailPoints * 3);

    this.trailGeometryLeft = new THREE.BufferGeometry();
    this.trailGeometryLeft.setAttribute('position', new THREE.BufferAttribute(leftPositions, 3));

    this.trailGeometryRight = new THREE.BufferGeometry();
    this.trailGeometryRight.setAttribute('position', new THREE.BufferAttribute(rightPositions, 3));

    const trailMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      linewidth: 2
    });

    this.trailLineLeft = new THREE.Line(this.trailGeometryLeft, trailMaterial);
    this.trailLineRight = new THREE.Line(this.trailGeometryRight, trailMaterial);
    this.trailLineLeft.frustumCulled = false;
    this.trailLineRight.frustumCulled = false;
    this.trailLineLeft.visible = false;
    this.trailLineRight.visible = false;

    scene.add(this.trailLineLeft);
    scene.add(this.trailLineRight);
  }

  private setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      this.keyState[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keyState[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      if ((e.target as HTMLElement).closest('.w-flight-hud, button, input')) return;
      this.isMouseDown = true;
      this.updateMousePos(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;
      this.updateMousePos(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
  }

  private updateMousePos(clientX: number, clientY: number) {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.mousePos.x = Math.max(-1, Math.min(1, (clientX - cx) / (cx * 0.75)));
    this.mousePos.y = Math.max(-1, Math.min(1, (clientY - cy) / (cy * 0.75)));
  }

  public activate() {
    this.isActive = true;
    this.planeMesh.visible = true;
    this.trailLineLeft.visible = true;
    this.trailLineRight.visible = true;

    // Reset over Neva River heading towards Spit of Vasilyevsky Island
    this.position.set(60, 85, -120);
    this.yaw = -Math.PI * 0.75;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 44;
    this.throttle = 0.65;
    this.vSpeed = 0;

    // Clear trails
    this.trailPointsLeft = [];
    this.trailPointsRight = [];
  }

  public deactivate() {
    this.isActive = false;
    this.planeMesh.visible = false;
    this.trailLineLeft.visible = false;
    this.trailLineRight.visible = false;
  }

  public toggleInvertPitch(): boolean {
    this.invertPitch = !this.invertPitch;
    try {
      localStorage.setItem('spb_flight_invert', String(this.invertPitch));
    } catch {
      // ignore
    }
    return this.invertPitch;
  }

  public toggleMouseControl(): boolean {
    this.mouseControl = !this.mouseControl;
    try {
      localStorage.setItem('spb_flight_mouse', String(this.mouseControl));
    } catch {
      // ignore
    }
    return this.mouseControl;
  }

  public getForwardDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    dir.applyQuaternion(quat);
    return dir;
  }

  public update(deltaTime: number) {
    if (!this.isActive) return;

    // 1. Process Inputs: Pitch, Roll, Rudder, Throttle
    let targetPitch = 0;
    let targetRoll = 0;
    let rudderInput = 0;

    // Keyboard Pitch
    // Natural Mode (!invertPitch): W / ArrowUp = Climb (+pitch), S / ArrowDown = Dive (-pitch)
    // Aviation Mode (invertPitch): W / ArrowUp = Dive (-pitch), S / ArrowDown = Climb (+pitch)
    const keyUp = this.keyState['KeyW'] || this.keyState['ArrowUp'] || this.keyState['Numpad8'];
    const keyDown = this.keyState['KeyS'] || this.keyState['ArrowDown'] || this.keyState['Numpad2'];

    if (keyUp) targetPitch = this.invertPitch ? -0.58 : 0.58;
    if (keyDown) targetPitch = this.invertPitch ? 0.58 : -0.58;

    // Keyboard Roll & Turn (A / D, Left / Right)
    const keyLeft = this.keyState['KeyA'] || this.keyState['ArrowLeft'] || this.keyState['Numpad4'];
    const keyRight = this.keyState['KeyD'] || this.keyState['ArrowRight'] || this.keyState['Numpad6'];

    if (keyLeft) {
      targetRoll = 0.78;  // Bank left
      rudderInput = -1.2;
    }
    if (keyRight) {
      targetRoll = -0.78; // Bank right
      rudderInput = 1.2;
    }

    // Optional Mouse Steering
    if (this.mouseControl || this.isMouseDown) {
      // Dead-zone 8% in center
      const deadZone = 0.08;
      const mx = Math.abs(this.mousePos.x) > deadZone ? (this.mousePos.x - Math.sign(this.mousePos.x) * deadZone) / (1 - deadZone) : 0;
      const my = Math.abs(this.mousePos.y) > deadZone ? (this.mousePos.y - Math.sign(this.mousePos.y) * deadZone) / (1 - deadZone) : 0;

      const mousePitchInput = this.invertPitch ? my * 0.65 : -my * 0.65;
      if (Math.abs(mousePitchInput) > Math.abs(targetPitch)) {
        targetPitch = mousePitchInput;
      }

      const mouseRollInput = -mx * 0.85;
      if (Math.abs(mouseRollInput) > Math.abs(targetRoll)) {
        targetRoll = mouseRollInput;
        rudderInput = mx * 1.4;
      }
    }

    // Throttle / Boost / Airbrake
    // Boost: Space, Shift, E
    const keyBoost = this.keyState['Space'] || this.keyState['ShiftLeft'] || this.keyState['KeyE'];
    // Airbrake: Control, Q, Alt
    const keyBrake = this.keyState['ControlLeft'] || this.keyState['KeyQ'] || this.keyState['AltLeft'];

    if (keyBoost) {
      this.throttle = Math.min(1.0, this.throttle + deltaTime * 0.5);
    } else if (keyBrake) {
      this.throttle = Math.max(0.25, this.throttle - deltaTime * 0.5);
    } else {
      // Gentle drift towards cruise throttle 0.65
      this.throttle += (0.65 - this.throttle) * deltaTime * 0.6;
    }

    // 2. Physics & Control Smoothing
    // Pitch smoothing with self-leveling
    this.pitch += (targetPitch - this.pitch) * deltaTime * 3.8;

    // Roll smoothing with self-leveling
    this.roll += (targetRoll - this.roll) * deltaTime * 4.4;

    // Coordinated turning: Banking induces yaw turn + direct rudder assist
    const turnRate = (-this.roll * 1.85) + (rudderInput * 0.95);
    this.yaw += turnRate * deltaTime;

    // Speed physics (range: 22 m/s (~80 km/h) to 70 m/s (~252 km/h))
    const targetSpeed = 22 + this.throttle * 48;
    this.speed += (targetSpeed - this.speed) * deltaTime * 2.2;

    // Forward direction & velocity vector
    const dir = this.getForwardDirection();
    this.velocity.copy(dir).multiplyScalar(this.speed * deltaTime);

    const prevY = this.position.y;
    this.position.add(this.velocity);
    this.vSpeed = (this.position.y - prevY) / deltaTime;

    // 3. Altitude Floor / Ceiling with Soft Aerodynamic Cushion
    // River / canal water surface is at y=0. City roofs average 24-32m.
    const isOverNevaOrWater = Math.abs(this.position.z) < 220 && this.position.x > -600 && this.position.x < 500;
    const minSafeAltitude = isOverNevaOrWater ? 14.0 : 32.0;

    if (this.position.y < minSafeAltitude) {
      // Soft aerodynamic ground effect cushion
      this.position.y += (minSafeAltitude - this.position.y) * deltaTime * 6.0;
      this.pitch = Math.max(0.08, this.pitch);
    }
    if (this.position.y > 450.0) {
      this.position.y = 450.0;
      this.pitch = Math.min(0, this.pitch);
    }

    // 4. Update 3D Mesh & Animations
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ'));
    this.planeMesh.position.copy(this.position);
    this.planeMesh.quaternion.copy(quat);

    // Propeller spin & motion blur visibility
    this.propeller.rotation.z += deltaTime * (32 + this.throttle * 80);
    this.propBlurDisc.visible = this.throttle > 0.45;

    // Animated Rudder & Elevator deflection
    this.rudderMesh.rotation.y = -this.roll * 0.45 + (rudderInput * 0.35);
    this.elevatorMesh.rotation.x = this.pitch * 0.55;

    // Animated Silk Aviator Scarf flutter
    this.scarfMesh.rotation.x = Math.sin(Date.now() * 0.016) * 0.22 - (this.speed / 50) * 0.25;

    // Flashing Strobe Beacon on tail fin (100ms flash every 900ms)
    const isFlash = (Date.now() % 900) < 110;
    this.beaconLight.intensity = isFlash ? 2.8 : 0.0;

    // 5. Update Wingtip Vapor Ribbon Trails
    this.updateVaporTrails();
  }

  /**
   * Updates aerodynamic wingtip ribbon trails in world coordinates
   */
  private updateVaporTrails() {
    this.planeMesh.updateMatrixWorld(true);

    const leftTipLocal = new THREE.Vector3(-12.8, 2.9, -2.2);
    const rightTipLocal = new THREE.Vector3(12.8, 2.9, -2.2);

    const leftWorld = leftTipLocal.applyMatrix4(this.planeMesh.matrixWorld);
    const rightWorld = rightTipLocal.applyMatrix4(this.planeMesh.matrixWorld);

    this.trailPointsLeft.unshift(leftWorld.clone());
    this.trailPointsRight.unshift(rightWorld.clone());

    if (this.trailPointsLeft.length > this.maxTrailPoints) {
      this.trailPointsLeft.pop();
      this.trailPointsRight.pop();
    }

    const posLeft = this.trailGeometryLeft.attributes.position.array as Float32Array;
    const posRight = this.trailGeometryRight.attributes.position.array as Float32Array;

    for (let i = 0; i < this.maxTrailPoints; i++) {
      const pL = this.trailPointsLeft[i] || (this.trailPointsLeft.length > 0 ? this.trailPointsLeft[this.trailPointsLeft.length - 1] : leftWorld);
      const pR = this.trailPointsRight[i] || (this.trailPointsRight.length > 0 ? this.trailPointsRight[this.trailPointsRight.length - 1] : rightWorld);

      posLeft[i * 3] = pL.x;
      posLeft[i * 3 + 1] = pL.y;
      posLeft[i * 3 + 2] = pL.z;

      posRight[i * 3] = pR.x;
      posRight[i * 3 + 1] = pR.y;
      posRight[i * 3 + 2] = pR.z;
    }

    this.trailGeometryLeft.attributes.position.needsUpdate = true;
    this.trailGeometryRight.attributes.position.needsUpdate = true;
  }

  public getFlightStats(): FlightStats {
    return {
      speedKmh: Math.round(this.speed * 3.6),
      altitudeMeters: Math.round(this.position.y),
      throttlePct: Math.round(this.throttle * 100),
      vSpeedMs: Math.round(this.vSpeed * 10) / 10,
      invertPitch: this.invertPitch,
      mouseControl: this.mouseControl
    };
  }
}
