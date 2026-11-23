import * as THREE from 'three';
import { mergeStaticMeshes } from './merge';
import { PALETTE } from './palette';

export interface Vehicle {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  t: number;
  speed: number;
}

export interface Tram {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  t: number;
  speed: number;
  isStopped: boolean;
}

export interface Boat {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  t: number;
  speed: number;
  isMeteor: boolean;
  wake?: THREE.Group;
}

export interface Pedestrian {
  mesh: THREE.Group;
  path: THREE.Vector3[];
  t: number;
  speed: number;
  baseY: number;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
}

/**
 * Calculates a lateral lane offset perpendicular to the road centerline
 * in the direction of travel (Right-Hand Traffic rule for Saint Petersburg).
 */
function offsetPath(centerline: THREE.Vector3[], offsetRightMeters: number): THREE.Vector3[] {
  const result: THREE.Vector3[] = [];
  for (let i = 0; i < centerline.length; i++) {
    const p = centerline[i];
    let dx = 0;
    let dz = 0;
    if (i === 0) {
      dx = centerline[1].x - p.x;
      dz = centerline[1].z - p.z;
    } else if (i === centerline.length - 1) {
      dx = p.x - centerline[i - 1].x;
      dz = p.z - centerline[i - 1].z;
    } else {
      dx = centerline[i + 1].x - centerline[i - 1].x;
      dz = centerline[i + 1].z - centerline[i - 1].z;
    }
    const len = Math.hypot(dx, dz) || 1;
    // In Three.js: +X is East, +Z is South, -Z is North, -X is West.
    // Right normal to (dx, dz) is (-dz / len, dx / len)
    const nx = -dz / len;
    const nz = dx / len;
    result.push(
      new THREE.Vector3(
        p.x + nx * offsetRightMeters,
        p.y,
        p.z + nz * offsetRightMeters
      )
    );
  }
  return result;
}

/**
 * Two-lane loop along a street or river centreline: out on the right-hand side, back on
 * the other, with small U-turns at both ends. Points are [x, z] world metres.
 */
function laneLoop(centre: [number, number][], y: number, laneOffset: number): THREE.Vector3[] {
  const line = centre.map(([x, z]) => new THREE.Vector3(x, y, z));
  const out = offsetPath(line, laneOffset);
  const back = offsetPath([...line].reverse(), laneOffset);
  const loop = [...out, line[line.length - 1].clone(), ...back, line[0].clone()];
  // Even spacing: the path parameter advances per point, so equal steps keep the speed constant
  const step = 12;
  const even: THREE.Vector3[] = [loop[0].clone()];
  let carry = 0;
  for (let i = 1; i < loop.length; i++) {
    const a = loop[i - 1], b = loop[i];
    const len = a.distanceTo(b);
    let d = step - carry;
    while (d <= len) {
      even.push(a.clone().lerp(b, d / len));
      d += step;
    }
    carry = len - (d - step);
  }
  return even;
}

export class TransitSystem {
  public group: THREE.Group;
  public trams: Tram[] = [];
  public boats: Boat[] = [];
  public movingCars: Vehicle[] = [];
  public parkedCarsGroup: THREE.Group;
  public pedestrians: Pedestrian[] = [];
  public streetlampsMesh: THREE.Mesh | null = null;
  public streetlampsLanternMesh: THREE.Mesh | null = null;
  public streetlampGroundGlowMesh: THREE.Mesh | null = null;
  private streetlampLanternMat: THREE.MeshBasicMaterial;
  private streetlampGroundGlowMat: THREE.MeshBasicMaterial;
  private carHeadlightMat: THREE.MeshBasicMaterial;
  private animTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'transit-and-vehicles';
    scene.add(this.group);

    this.streetlampLanternMat = new THREE.MeshBasicMaterial({ color: 0xfffae2 });
    this.streetlampGroundGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd77,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.carHeadlightMat = new THREE.MeshBasicMaterial({
      color: 0xfffae0,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.parkedCarsGroup = new THREE.Group();
    this.parkedCarsGroup.name = 'parked-cars';
    this.group.add(this.parkedCarsGroup);

    this.spawnTrams();
    this.spawnBoats();
    this.spawnParkedCars();
    this.spawnMovingCars();
    this.spawnPedestrians();
    this.spawnStreetlamps();

    // Vehicles only move as a whole: bake each one into a few meshes. Walking
    // legs and pulsing boat wakes stay separate because they animate on their own.
    const keep = new Set<THREE.Object3D>();
    for (const p of this.pedestrians) keep.add(p.legL).add(p.legR);
    for (const b of this.boats) if (b.wake) keep.add(b.wake);
    for (const child of [...this.group.children]) mergeStaticMeshes(child, keep);
  }

  /**
   * Creates detailed 3D pixel passenger car (Sedan/Hatchback)
   */
  public createCarModel(colorHex: number): THREE.Group {
    const car = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x182433, flatShading: true });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222428, flatShading: true });
    const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const lightRearMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });

    // Lower body (chassis)
    const lower = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.7, 1.85), bodyMat);
    lower.position.y = 0.55;
    lower.castShadow = true;
    lower.receiveShadow = true;
    car.add(lower);

    // Upper cabin & windows
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.65, 1.65), glassMat);
    cabin.position.set(-0.2, 1.15, 0);
    cabin.castShadow = true;
    car.add(cabin);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.15, 1.7), bodyMat);
    roof.position.set(-0.2, 1.5, 0);
    car.add(roof);

    // 4 Wheels
    for (const wx of [-1.3, 1.3]) {
      for (const wz of [-0.95, 0.95]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 8), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.36, wz);
        car.add(wheel);
      }
    }

    // Headlights (Front: +X)
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.35), lightFrontMat);
    hl1.position.set(2.18, 0.65, 0.65);
    car.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.35), lightFrontMat);
    hl2.position.set(2.18, 0.65, -0.65);
    car.add(hl2);

    // Taillights (Rear: -X)
    const rl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.35), lightRearMat);
    rl1.position.set(-2.18, 0.65, 0.65);
    car.add(rl1);
    const rl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.35), lightRearMat);
    rl2.position.set(-2.18, 0.65, -0.65);
    car.add(rl2);

    // Forward headlight illumination beam on asphalt (+X)
    const beamGeo = new THREE.BufferGeometry();
    const bPos = [
      2.2, -0.29, -0.85,
      12.0, -0.29, -3.2,
      12.0, -0.29, 3.2,
      2.2, -0.29, -0.85,
      12.0, -0.29, 3.2,
      2.2, -0.29, 0.85
    ];
    beamGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
    const beamMesh = new THREE.Mesh(beamGeo, this.carHeadlightMat);
    beamMesh.renderOrder = 8;
    car.add(beamMesh);

    return car;
  }

  /**
   * Spawns classic St. Petersburg Yellow Taxi with rooftop light & checkers
   */
  public createTaxiModel(): THREE.Group {
    const taxi = this.createCarModel(0xf5b823); // St. Petersburg Taxi Yellow
    // Add rooftop taxi sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0xffdf66 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.35), signMat);
    sign.position.set(-0.2, 1.68, 0);
    taxi.add(sign);

    // Black checker stripe decal on the doors
    const checkerMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const side of [-0.94, 0.94]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.02), checkerMat);
      stripe.position.set(-0.2, 0.82, side);
      taxi.add(stripe);
    }
    return taxi;
  }

  /**
   * Spawns City Delivery Van (Gazelle / Sprinter style box van)
   */
  public createVanModel(colorHex: number): THREE.Group {
    const van = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x141f2b, flatShading: true });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222428, flatShading: true });
    const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const lightRearMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });

    // Front cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 2.05), bodyMat);
    cab.position.set(1.5, 1.15, 0);
    cab.castShadow = true;
    van.add(cab);

    // Windshield
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.65, 1.95), glassMat);
    win.position.set(1.6, 1.45, 0);
    van.add(win);

    // Rear cargo box
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.0, 2.1), bodyMat);
    cargo.position.set(-1.1, 1.45, 0);
    cargo.castShadow = true;
    van.add(cargo);

    // Wheels
    for (const wx of [-1.8, 1.4]) {
      for (const wz of [-1.05, 1.05]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 8), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.42, wz);
        van.add(wheel);
      }
    }

    // Lights
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.35), lightFrontMat);
    hl1.position.set(2.47, 0.85, 0.75);
    van.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.35), lightFrontMat);
    hl2.position.set(2.47, 0.85, -0.75);
    van.add(hl2);

    const rl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.25), lightRearMat);
    rl1.position.set(-2.87, 0.85, 0.85);
    van.add(rl1);
    const rl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.25), lightRearMat);
    rl2.position.set(-2.87, 0.85, -0.85);
    van.add(rl2);

    // Forward headlight illumination beam on asphalt (+X)
    const vanBeamGeo = new THREE.BufferGeometry();
    const vbPos = [
      2.5, -0.32, -1.0,
      13.0, -0.32, -3.5,
      13.0, -0.32, 3.5,
      2.5, -0.32, -1.0,
      13.0, -0.32, 3.5,
      2.5, -0.32, 1.0
    ];
    vanBeamGeo.setAttribute('position', new THREE.Float32BufferAttribute(vbPos, 3));
    const vanBeamMesh = new THREE.Mesh(vanBeamGeo, this.carHeadlightMat);
    vanBeamMesh.renderOrder = 8;
    van.add(vanBeamMesh);

    return van;
  }

  /**
   * Spawns iconic St. Petersburg City Bus (Azure Blue Volgabus)
   */
  public createBusModel(): THREE.Group {
    const bus = new THREE.Group();

    const blueMat = new THREE.MeshLambertMaterial({ color: 0x1f66a8, flatShading: true }); // SPb Azure Blue
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x141f2b, flatShading: true });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222428, flatShading: true });

    // Lower bus body
    const lower = new THREE.Mesh(new THREE.BoxGeometry(11.5, 1.2, 2.5), blueMat);
    lower.position.y = 0.9;
    lower.castShadow = true;
    bus.add(lower);

    // Window belt
    const windows = new THREE.Mesh(new THREE.BoxGeometry(11.3, 1.1, 2.45), glassMat);
    windows.position.y = 2.0;
    bus.add(windows);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.3, 2.5), blueMat);
    roof.position.y = 2.65;
    bus.add(roof);

    // Wheels
    for (const bx of [-3.5, 3.5]) {
      for (const bz of [-1.25, 1.25]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 8), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(bx, 0.48, bz);
        bus.add(wheel);
      }
    }

    // Bus Headlights (+X front) & Taillights (-X rear)
    const lightFrontMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const lightRearMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
    const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.45), lightFrontMat);
    hl1.position.set(5.76, 1.0, 0.85);
    bus.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.45), lightFrontMat);
    hl2.position.set(5.76, 1.0, -0.85);
    bus.add(hl2);

    const rl1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.45), lightRearMat);
    rl1.position.set(-5.76, 1.0, 0.85);
    bus.add(rl1);
    const rl2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.45), lightRearMat);
    rl2.position.set(-5.76, 1.0, -0.85);
    bus.add(rl2);

    // Forward bus headlight illumination beam on asphalt (+X)
    const busBeamGeo = new THREE.BufferGeometry();
    const bbPos = [
      5.8, -0.62, -1.2,
      18.0, -0.62, -4.5,
      18.0, -0.62, 4.5,
      5.8, -0.62, -1.2,
      18.0, -0.62, 4.5,
      5.8, -0.62, 1.2
    ];
    busBeamGeo.setAttribute('position', new THREE.Float32BufferAttribute(bbPos, 3));
    const busBeamMesh = new THREE.Mesh(busBeamGeo, this.carHeadlightMat);
    busBeamMesh.renderOrder = 8;
    bus.add(busBeamMesh);

    return bus;
  }

  /**
   * Spawns dozens of parked cars in parking lots and curbside bays with painted white stall markings
   */
  private spawnParkedCars() {
    const carColors = [
      0xf0f3f6, 0x1c1e22, 0x8b939e, 0xb82626, 0x1e3a66, 0xc49b45, 0x2e6644
    ];

    const stallPositions: number[] = [];
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false });

    const addStallLine = (x1: number, z1: number, x2: number, z2: number) => {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const nx = (-dz / len) * 0.1;
      const nz = (dx / len) * 0.1;
      stallPositions.push(
        x1 + nx, 0.29, z1 + nz,
        x1 - nx, 0.29, z1 - nz,
        x2 - nx, 0.29, z2 - nz,
        x1 + nx, 0.29, z1 + nz,
        x2 - nx, 0.29, z2 - nz,
        x2 + nx, 0.29, z2 + nz
      );
    };

    // Parking Lot 1: Admiralteysky Prospect / Alexander Garden parking
    for (let i = 0; i < 22; i++) {
      const px = -240 + i * 5.2;
      const pz = 125;
      const color = carColors[i % carColors.length];
      const car = this.createCarModel(color);
      car.position.set(px, 0.24, pz);
      car.rotation.y = Math.PI / 2;
      this.parkedCarsGroup.add(car);

      addStallLine(px - 2.5, pz - 2.4, px - 2.5, pz + 2.4);
      if (i === 21) addStallLine(px + 2.5, pz - 2.4, px + 2.5, pz + 2.4);
    }

    // Parking Lot 2: St. Isaac's Square Parking
    for (let row = 0; row < 2; row++) {
      const rz = 520 + row * 7.5;
      for (let i = 0; i < 18; i++) {
        const px = -540 + i * 5.2;
        const color = carColors[(i + row * 3) % carColors.length];
        const car = this.createCarModel(color);
        car.position.set(px, 0.24, rz);
        car.rotation.y = Math.PI / 2;
        this.parkedCarsGroup.add(car);

        addStallLine(px - 2.5, rz - 2.4, px - 2.5, rz + 2.4);
        if (i === 17) addStallLine(px + 2.5, rz - 2.4, px + 2.5, rz + 2.4);
      }
    }

    // Parking Lot 3: Spit of Vasilyevsky Island
    for (let i = 0; i < 16; i++) {
      const px = -560 + i * 5.5;
      const pz = -345;
      const color = carColors[(i * 2) % carColors.length];
      const car = this.createCarModel(color);
      car.position.set(px, 0.24, pz);
      car.rotation.y = Math.PI * 0.4;
      this.parkedCarsGroup.add(car);
    }

    // Curbside parking along Millionnaya Street
    for (let i = 0; i < 14; i++) {
      const color = carColors[(i * 5) % carColors.length];
      const car = this.createCarModel(color);
      car.position.set(110 + i * 16, 0.24, -35);
      car.rotation.y = 0;
      this.parkedCarsGroup.add(car);
    }

    if (stallPositions.length > 0) {
      const stallGeo = new THREE.BufferGeometry();
      stallGeo.setAttribute('position', new THREE.Float32BufferAttribute(stallPositions, 3));
      const stallMesh = new THREE.Mesh(stallGeo, lineMat);
      stallMesh.renderOrder = 7;
      this.parkedCarsGroup.add(stallMesh);
    }
  }

  /**
   * Spawns dense moving vehicular traffic along major avenues, bridges, and boulevards.
   */
  private spawnMovingCars() {
    const carColors = [
      0xf0f3f6, 0x1c1e22, 0x8b939e, 0xb82626, 0x1e3a66, 0xe8a923, 0x35654d, 0x4a4f56
    ];

    const addVariedVehiclesOnPath = (path: THREE.Vector3[], count: number, baseSpeed: number) => {
      for (let i = 0; i < count; i++) {
        let vehicle: THREE.Group;
        const vType = i % 5;
        if (vType === 0) {
          vehicle = this.createTaxiModel();
        } else if (vType === 1) {
          vehicle = this.createVanModel(i % 2 === 0 ? 0xffffff : 0x223554);
        } else {
          const color = carColors[(i * 3 + this.movingCars.length) % carColors.length];
          vehicle = this.createCarModel(color);
        }
        this.group.add(vehicle);
        this.movingCars.push({
          mesh: vehicle,
          path,
          t: (i / count + (i % 2) * 0.05) % 1.0,
          speed: baseSpeed * (0.9 + (i % 4) * 0.08)
        });
      }
    };

    // 1. Nevsky Prospekt Continuous Two-Way Loop (Admiralty <-> Moscow Station)
    const nevskyCenterline: THREE.Vector3[] = [
      new THREE.Vector3(-128, 0.24, 305),
      new THREE.Vector3(-50, 0.24, 328),
      new THREE.Vector3(40, 0.24, 354),
      new THREE.Vector3(170, 0.24, 385),
      new THREE.Vector3(280, 0.24, 412),
      new THREE.Vector3(385, 0.24, 436),
      new THREE.Vector3(490, 0.24, 461),
      new THREE.Vector3(650, 0.24, 501),
      new THREE.Vector3(850, 0.24, 550),
      new THREE.Vector3(1050, 0.24, 600),
      new THREE.Vector3(1250, 0.24, 650),
      new THREE.Vector3(1470, 0.24, 705),
      new THREE.Vector3(1640, 0.24, 748),
      new THREE.Vector3(1760, 0.24, 778),
      new THREE.Vector3(1920, 0.24, 818)
    ];

    const nevskyEast = offsetPath(nevskyCenterline, 4.2);
    const nevskyWest = offsetPath([...nevskyCenterline].reverse(), 4.2);

    const nevskyLoop: THREE.Vector3[] = [
      ...nevskyEast,
      new THREE.Vector3(1950, 0.24, 824),
      new THREE.Vector3(1960, 0.24, 818),
      new THREE.Vector3(1950, 0.24, 812),
      ...nevskyWest,
      new THREE.Vector3(-148, 0.24, 298),
      new THREE.Vector3(-158, 0.24, 305),
      new THREE.Vector3(-148, 0.24, 312)
    ];
    // 24 vehicles on Nevsky Prospekt!
    addVariedVehiclesOnPath(nevskyLoop, 24, 0.024);

    // 4 Azure Blue Volgabuses on Nevsky
    for (let b = 0; b < 4; b++) {
      const bus = this.createBusModel();
      this.group.add(bus);
      this.movingCars.push({ mesh: bus, path: nevskyLoop, t: (b * 0.25 + 0.1) % 1.0, speed: 0.020 });
    }

    // 2. Palace Embankment Loop (Winter Palace <-> Summer Garden / Trinity Bridge)
    const palaceCircuit: THREE.Vector3[] = [
      new THREE.Vector3(-265, 0.24, -33),
      new THREE.Vector3(-236, 0.24, -46),
      new THREE.Vector3(-197, 0.24, -76),
      new THREE.Vector3(-99, 0.24, -147),
      new THREE.Vector3(-3.6, 0.24, -216),
      new THREE.Vector3(29, 0.24, -241),
      new THREE.Vector3(96, 0.24, -297),
      new THREE.Vector3(356, 0.24, -458),
      new THREE.Vector3(609, 0.24, -606),
      new THREE.Vector3(810, 0.24, -703),
      new THREE.Vector3(820, 0.24, -690),
      new THREE.Vector3(790, 0.24, -675),
      new THREE.Vector3(590, 0.24, -580),
      new THREE.Vector3(340, 0.24, -430),
      new THREE.Vector3(80, 0.24, -270),
      new THREE.Vector3(-15, 0.24, -200),
      new THREE.Vector3(-180, 0.24, -65),
      new THREE.Vector3(-250, 0.24, -25)
    ];
    addVariedVehiclesOnPath(palaceCircuit, 12, 0.028);

    // 3. Palace Bridge & Dvortsovy Proyezd Continuous Two-Way Loop
    // Connects Vasilyevsky Island (Birzhevaya Sq) <-> Palace Bridge <-> Dvortsovy Proyezd <-> Admiralteysky Prospekt turnaround
    const palaceBridgeAndProyezdLoop: THREE.Vector3[] = [
      // Southbound from Spit of Vasilyevsky Island across Palace Bridge to Dvortsovy Proyezd
      new THREE.Vector3(-485, 0.24, -295),
      new THREE.Vector3(-462, 0.24, -287),
      new THREE.Vector3(-446, 3.6, -266),
      new THREE.Vector3(-431, 7.15, -254),
      new THREE.Vector3(-350, 7.15, -137),
      new THREE.Vector3(-280, 7.15, -50),
      new THREE.Vector3(-271, 3.6, -38),
      new THREE.Vector3(-258, 0.24, -21),
      new THREE.Vector3(-207, 0.24, 42),
      new THREE.Vector3(-167, 0.24, 94),
      new THREE.Vector3(-134, 0.24, 137),
      new THREE.Vector3(-111, 0.24, 274),
      // Turnaround loop at Admiralteysky Prospekt intersection (front of General Staff & Alexander Garden)
      new THREE.Vector3(-105, 0.24, 285),
      new THREE.Vector3(-118, 0.24, 292),
      new THREE.Vector3(-130, 0.24, 282),
      // Northbound lane along Dvortsovy Proyezd back towards Palace Bridge
      new THREE.Vector3(-138, 0.24, 133),
      new THREE.Vector3(-171, 0.24, 90),
      new THREE.Vector3(-211, 0.24, 38),
      new THREE.Vector3(-256, 0.24, -24),
      new THREE.Vector3(-268, 3.6, -40),
      // Northbound across Palace Bridge towards Vasilyevsky Island
      new THREE.Vector3(-282, 7.15, -55),
      new THREE.Vector3(-352, 7.15, -142),
      new THREE.Vector3(-433, 7.15, -259),
      new THREE.Vector3(-444, 3.6, -268),
      // Turnaround loop on Birzhevaya Square (Spit of Vasilyevsky Island)
      new THREE.Vector3(-470, 0.24, -310),
      new THREE.Vector3(-490, 0.24, -315)
    ];
    addVariedVehiclesOnPath(palaceBridgeAndProyezdLoop, 14, 0.028);

    // 5. Sadovaya Street (OSM): Mikhailovsky Castle -> Gostiny Dvor -> Sennaya Square
    const sadovayaLoop = laneLoop([[1163, -124], [1188, -51], [1223, 47], [1233, 117], [1216, 243], [1205, 319], [1191, 412], [1171, 495], [1147, 596], [1130, 648], [1108, 670], [1002, 758], [888, 854], [817, 914], [707, 1005], [596, 1098], [534, 1163], [411, 1253], [293, 1353], [239, 1393], [158, 1461]], 0.24, 4.2);
    addVariedVehiclesOnPath(sadovayaLoop, 10, 0.0116);

    // 6. Liteyny Prospekt (OSM): from the Liteyny Bridge approach to Nevsky Prospekt
    const liteynyLoop = laneLoop([[1918, -1032], [1913, -907], [1908, -813], [1904, -677], [1898, -495], [1894, -332], [1887, -197], [1884, -36], [1881, 82], [1876, 171], [1872, 279], [1874, 405], [1868, 497], [1864, 585], [1858, 691], [1861, 793]], 0.24, 4.5);
    addVariedVehiclesOnPath(liteynyLoop, 10, 0.0131);

    // 7. Fontanka embankment: the left-bank road, traced 7 m beyond the OSM water edge
    const fontankaRoadLoop = laneLoop([[1258, -860], [1296, -733], [1316, -635], [1359, -259], [1374, -225], [1592, 110], [1616, 152], [1633, 202], [1680, 435], [1686, 488], [1684, 517], [1647, 717], [1625, 786], [1568, 932], [1542, 973], [1513, 1006], [1414, 1120], [1361, 1170], [218, 2041], [154, 2079], [-354, 2313]], 0.24, 3.0);
    addVariedVehiclesOnPath(fontankaRoadLoop, 12, 0.0056);
  }

  /**
   * Spawns iconic St. Petersburg tram (LM-68M style red & cream wagon)
   */
  private createTramModel(): THREE.Group {
    const tram = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.tramRed, flatShading: true });
    const topMat = new THREE.MeshLambertMaterial({ color: PALETTE.tramWhite, flatShading: true });
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x1b2d3d, flatShading: true });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x333740, flatShading: true });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });

    // Lower red body
    const lower = new THREE.Mesh(new THREE.BoxGeometry(15, 1.6, 2.6), bodyMat);
    lower.position.y = 1.2;
    lower.castShadow = true;
    tram.add(lower);

    // Upper cream/white window belt
    const upper = new THREE.Mesh(new THREE.BoxGeometry(14.8, 1.4, 2.5), topMat);
    upper.position.y = 2.6;
    upper.castShadow = true;
    tram.add(upper);

    // Windows
    for (const side of [-1.3, 1.3]) {
      for (let x = -6; x <= 6; x += 2.2) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.1), windowMat);
        win.position.set(x, 2.6, side);
        tram.add(win);
      }
    }

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 2.6), topMat);
    roof.position.y = 3.4;
    tram.add(roof);

    // Pantograph
    const panto = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 1.4), metalMat);
    panto.position.set(0, 4.2, 0);
    tram.add(panto);

    // Headlight (+X)
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.35), lightMat);
    hl.position.set(7.55, 1.4, 0);
    tram.add(hl);

    return tram;
  }

  /**
   * High-Speed Hydrofoil "Meteor" on Neva
   */
  private createMeteorModel(): { group: THREE.Group; wake: THREE.Group } {
    const meteor = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf5f7fa, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.meteorAqua, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2838, flatShading: true });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 4.2), hullMat);
    hull.position.y = 1.0;
    hull.castShadow = true;
    meteor.add(hull);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.5, 4.3), trimMat);
    stripe.position.y = 0.8;
    meteor.add(stripe);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 3.4), hullMat);
    cabin.position.set(-1, 2.4, 0);
    meteor.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 3.5), glassMat);
    glass.position.set(-0.8, 2.5, 0);
    meteor.add(glass);

    // Water wake
    const wake = this.createBoatWake(16, 5);
    wake.position.set(-9.5, -0.65, 0);
    meteor.add(wake);

    return { group: meteor, wake };
  }

  /**
   * Two-Deck River Cruiser "Moskva" on Central Neva
   */
  private createNevaCruiserModel(): { group: THREE.Group; wake: THREE.Group } {
    const cruiser = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x223550, flatShading: true });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xf5f6fa, flatShading: true });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x14202d, flatShading: true });

    // Lower hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(24, 2.0, 5.5), hullMat);
    hull.position.y = 0.8;
    hull.castShadow = true;
    cruiser.add(hull);

    // Main passenger salon
    const salon = new THREE.Mesh(new THREE.BoxGeometry(18, 1.6, 4.8), deckMat);
    salon.position.set(-1, 2.4, 0);
    cruiser.add(salon);

    // Panoramic windows
    const win = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 4.9), glassMat);
    win.position.set(-1, 2.4, 0);
    cruiser.add(win);

    // Upper viewing deck
    const topDeck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 4.5), deckMat);
    topDeck.position.set(-2, 3.35, 0);
    cruiser.add(topDeck);

    // Pilot cabin
    const pilot = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 3.0), deckMat);
    pilot.position.set(4.5, 3.8, 0);
    cruiser.add(pilot);

    // Wake
    const wake = this.createBoatWake(18, 6);
    wake.position.set(-12.5, -0.5, 0);
    cruiser.add(wake);

    return { group: cruiser, wake };
  }

  /**
   * Single-Deck Tourist Excursion Boat for Fontanka River ("Речной трамвайчик")
   */
  private createFontankaBoatModel(): { group: THREE.Group; wake: THREE.Group } {
    const boat = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x1e3558, flatShading: true });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xded5be, flatShading: true });
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x3d70b8, flatShading: true });
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true });

    // Hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(13.5, 1.3, 3.8), hullMat);
    hull.position.y = 0.55;
    hull.castShadow = true;
    boat.add(hull);

    // Open deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.2, 3.4), deckMat);
    deck.position.y = 1.2;
    boat.add(deck);

    // Passenger benches
    for (let x = -4; x <= 3; x += 1.4) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 2.6), benchMat);
      bench.position.set(x, 1.45, 0);
      boat.add(bench);
    }

    // Fabric sun awning roof
    const awning = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.15, 3.4), awningMat);
    awning.position.set(-0.5, 2.3, 0);
    boat.add(awning);

    // Thin awning posts
    const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const px of [-5, 0, 4]) {
      for (const pz of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 4), postMat);
        post.position.set(px, 1.75, pz);
        boat.add(post);
      }
    }

    // Wake
    const wake = this.createBoatWake(10, 4);
    wake.position.set(-7.0, -0.2, 0);
    boat.add(wake);

    return { group: boat, wake };
  }

  /**
   * Low-Clearance Glass-Roofed Canal Boat for Moyka River
   */
  private createMoykaBoatModel(): { group: THREE.Group; wake: THREE.Group } {
    const boat = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x2b382e, flatShading: true }); // Dark emerald green
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x223644, flatShading: true });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xf0ede6, flatShading: true });

    // Low hull to clear St. Petersburg's historic low bridges
    const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 1.0, 3.2), hullMat);
    hull.position.y = 0.45;
    boat.add(hull);

    // Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.2, 2.9), deckMat);
    deck.position.y = 0.95;
    boat.add(deck);

    // Low arched glass canopy
    const dome = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.7, 2.8), glassMat);
    dome.position.set(-0.5, 1.35, 0);
    boat.add(dome);

    // Wake
    const wake = this.createBoatWake(8, 3.2);
    wake.position.set(-5.8, -0.15, 0);
    boat.add(wake);

    return { group: boat, wake };
  }

  /**
   * Creates animated V-shaped trailing foam wake
   */
  private createBoatWake(length: number, spread: number): THREE.Group {
    const wake = new THREE.Group();
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Left foam trail
    const leftGeo = new THREE.PlaneGeometry(1.2, length);
    leftGeo.rotateX(-Math.PI / 2);
    leftGeo.rotateY(0.18);
    const leftMesh = new THREE.Mesh(leftGeo, foamMat);
    leftMesh.position.set(-length * 0.45, 0.05, spread * 0.35);
    wake.add(leftMesh);

    // Right foam trail
    const rightGeo = new THREE.PlaneGeometry(1.2, length);
    rightGeo.rotateX(-Math.PI / 2);
    rightGeo.rotateY(-0.18);
    const rightMesh = new THREE.Mesh(rightGeo, foamMat);
    rightMesh.position.set(-length * 0.45, 0.05, -spread * 0.35);
    wake.add(rightMesh);

    // Center churning foam patch
    const centerGeo = new THREE.PlaneGeometry(spread * 0.65, length * 0.45);
    centerGeo.rotateX(-Math.PI / 2);
    const centerMesh = new THREE.Mesh(centerGeo, foamMat);
    centerMesh.position.set(-length * 0.2, 0.06, 0);
    wake.add(centerMesh);

    return wake;
  }

  private spawnTrams() {
    // Route 3 tram, as on the OSM streets: Suvorov Square -> along the Field of
    // Mars -> Moyka embankment -> Sadovaya Street past Gostiny Dvor -> Sennaya.
    const route3Loop = laneLoop([[825, -674], [790, -620], [760, -540], [827, -358], [859, -275], [878, -222], [892, -220], [1100, -172], [1151, -170], [1156, -145], [1188, -51], [1223, 47], [1233, 117], [1216, 243], [1205, 319], [1191, 412], [1171, 495], [1147, 596], [1130, 648], [1108, 670], [1002, 758], [888, 854], [817, 914], [707, 1005], [596, 1098], [534, 1163], [411, 1253], [293, 1353], [239, 1393], [158, 1461]], 0.24, 1.4);
    const TRAM_SPEED = 0.0093; // ~8 m/s on this loop

    const tram1 = this.createTramModel();
    this.group.add(tram1);
    this.trams.push({ mesh: tram1, path: route3Loop, t: 0.15, speed: TRAM_SPEED, isStopped: false });

    const tram2 = this.createTramModel();
    this.group.add(tram2);
    this.trams.push({ mesh: tram2, path: route3Loop, t: 0.65, speed: TRAM_SPEED, isStopped: false });

    const tram3 = this.createTramModel();
    this.group.add(tram3);
    this.trams.push({ mesh: tram3, path: route3Loop, t: 0.4, speed: TRAM_SPEED, isStopped: false });

    const tram4 = this.createTramModel();
    this.group.add(tram4);
    this.trams.push({ mesh: tram4, path: route3Loop, t: 0.9, speed: TRAM_SPEED, isStopped: false });
  }

  private spawnBoats() {
    // 1. High-Speed Meteors on Neva
    // Neva fairway: medial line of the OSM water polygon from the Hermitage reach past the Palace and Blagoveshchensky bridges towards the gulf
    const nevaFastPath = laneLoop([[300, -700], [100, -640], [-60, -580], [-200, -470], [-270, -330], [-310, -200], [-387, -132], [-474, -45], [-733, 152], [-1111, 395], [-1363, 545], [-1604, 636], [-1796, 731], [-1955, 797], [-2178, 995], [-2327, 1196], [-2418, 1391]], 0.4, 40);

    const meteor1 = this.createMeteorModel();
    this.group.add(meteor1.group);
    this.boats.push({ mesh: meteor1.group, path: nevaFastPath, t: 0.1, speed: 0.028, isMeteor: true, wake: meteor1.wake });

    const meteor2 = this.createMeteorModel();
    this.group.add(meteor2.group);
    this.boats.push({ mesh: meteor2.group, path: nevaFastPath, t: 0.6, speed: 0.028, isMeteor: true, wake: meteor2.wake });

    // 2. Excursion Ship "Moskva" on Neva
    const cruiser = this.createNevaCruiserModel();
    this.group.add(cruiser.group);
    this.boats.push({ mesh: cruiser.group, path: nevaFastPath, t: 0.35, speed: 0.009, isMeteor: false, wake: cruiser.wake });

    // 3. Fontanka River Excursion Boats (4 boats on Fontanka fairway)
    // Fontanka fairway: medial line of the OSM water polygon, Summer Garden to the Izmailovsky reach
    const fontankaFairway = laneLoop([[1229, -851], [1273, -704], [1287, -629], [1321, -275], [1332, -225], [1583, 164], [1598, 213], [1649, 462], [1652, 488], [1649, 515], [1605, 730], [1558, 859], [1526, 934], [1390, 1095], [1354, 1130], [201, 2010], [155, 2035], [-371, 2277]], 0.35, 5);

    for (let i = 0; i < 4; i++) {
      const fBoat = this.createFontankaBoatModel();
      this.group.add(fBoat.group);
      this.boats.push({
        mesh: fBoat.group,
        path: fontankaFairway,
        t: i * 0.25,
        speed: 0.018,
        isMeteor: false,
        wake: fBoat.wake
      });
    }

    // 4. Moyka Canal Boats (3 boats on Moyka fairway)
    // Moyka fairway: medial line of the OSM water polygon, Field of Mars to New Holland
    const moykaFairway = laneLoop([[1149, -134], [1086, -143], [878, -185], [781, -223], [687, -267], [648, -278], [584, -280], [562, -276], [481, -251], [425, -227], [390, -207], [341, -170], [312, -141], [288, -104], [273, -62], [261, 80], [289, 268], [288, 354], [280, 419], [241, 520], [189, 616], [106, 713], [73, 742], [35, 763], [-288, 895], [-504, 1002], [-544, 1014], [-605, 1025], [-750, 1036], [-793, 1044], [-813, 1052], [-866, 1086], [-899, 1111], [-1077, 1286]], 0.35, 3);

    for (let i = 0; i < 3; i++) {
      const mBoat = this.createMoykaBoatModel();
      this.group.add(mBoat.group);
      this.boats.push({
        mesh: mBoat.group,
        path: moykaFairway,
        t: i * 0.33,
        speed: 0.016,
        isMeteor: false,
        wake: mBoat.wake
      });
    }
  }

  /**
   * Spawns pixel-art pedestrians walking on sidewalks and Palace Square
   */
  public createPedestrianModel(coatColor: number): { group: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh } {
    const group = new THREE.Group();
    const fleshMat = new THREE.MeshLambertMaterial({ color: 0xf2c49b, flatShading: true });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x22262d, flatShading: true });
    const coatMat = new THREE.MeshLambertMaterial({ color: coatColor, flatShading: true });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x3d271d, flatShading: true });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.2);
    legGeo.translate(0, -0.375, 0); // pivot at hip
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(0, 0.75, 0.12);
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0, 0.75, -0.12);
    group.add(legR);

    // Torso / Coat
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.7, 0.42), coatMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), fleshMat);
    head.position.y = 1.62;
    group.add(head);

    // Hair / Cap
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.3), hairMat);
    hair.position.y = 1.76;
    group.add(hair);

    return { group, legL, legR };
  }

  private spawnPedestrians() {
    const coatColors = [
      0x253858, 0xc79d5e, 0x9b2c2c, 0x2d5a3c, 0xd4a373, 0x5a6265, 0xd97736, 0x1e3a5f
    ];

    // Nevsky North Sidewalk Path
    const nevskyNorthSidewalk: THREE.Vector3[] = [
      new THREE.Vector3(-128, 0.30, 296),
      new THREE.Vector3(40, 0.30, 345),
      new THREE.Vector3(280, 0.30, 403),
      new THREE.Vector3(650, 0.30, 492),
      new THREE.Vector3(1050, 0.30, 591),
      new THREE.Vector3(1470, 0.30, 696),
      new THREE.Vector3(1920, 0.30, 809),
      // Loop back on south sidewalk
      new THREE.Vector3(1920, 0.30, 827),
      new THREE.Vector3(1470, 0.30, 714),
      new THREE.Vector3(1050, 0.30, 609),
      new THREE.Vector3(650, 0.30, 510),
      new THREE.Vector3(280, 0.30, 421),
      new THREE.Vector3(40, 0.30, 363),
      new THREE.Vector3(-128, 0.30, 314)
    ];

    // Palace Embankment Promenade Path
    const palacePromenade: THREE.Vector3[] = [
      new THREE.Vector3(-260, 0.30, -38),
      new THREE.Vector3(-190, 0.30, -82),
      new THREE.Vector3(-90, 0.30, -153),
      new THREE.Vector3(35, 0.30, -247),
      new THREE.Vector3(360, 0.30, -464),
      new THREE.Vector3(615, 0.30, -612),
      new THREE.Vector3(815, 0.30, -709),
      // Turnaround
      new THREE.Vector3(810, 0.30, -699),
      new THREE.Vector3(610, 0.30, -602),
      new THREE.Vector3(355, 0.30, -454),
      new THREE.Vector3(30, 0.30, -237),
      new THREE.Vector3(-95, 0.30, -143),
      new THREE.Vector3(-195, 0.30, -72),
      new THREE.Vector3(-265, 0.30, -28)
    ];

    // Palace Square Strollers Circuit
    const palaceSquarePlaza: THREE.Vector3[] = [
      new THREE.Vector3(-60, 0.30, 50),
      new THREE.Vector3(0, 0.30, 30),
      new THREE.Vector3(60, 0.30, 60),
      new THREE.Vector3(80, 0.30, 110),
      new THREE.Vector3(20, 0.30, 130),
      new THREE.Vector3(-50, 0.30, 110),
      new THREE.Vector3(-70, 0.30, 80)
    ];

    // Spawn 24 pedestrians along Nevsky
    for (let i = 0; i < 24; i++) {
      const color = coatColors[i % coatColors.length];
      const model = this.createPedestrianModel(color);
      this.group.add(model.group);
      this.pedestrians.push({
        mesh: model.group,
        path: nevskyNorthSidewalk,
        t: i / 24,
        speed: 0.007 + (i % 3) * 0.002,
        baseY: 0.30,
        legL: model.legL,
        legR: model.legR
      });
    }

    // Spawn 14 pedestrians along Palace Embankment
    for (let i = 0; i < 14; i++) {
      const color = coatColors[(i * 3) % coatColors.length];
      const model = this.createPedestrianModel(color);
      this.group.add(model.group);
      this.pedestrians.push({
        mesh: model.group,
        path: palacePromenade,
        t: i / 14,
        speed: 0.006 + (i % 3) * 0.002,
        baseY: 0.30,
        legL: model.legL,
        legR: model.legR
      });
    }

    // Spawn 10 strolling tourists on Palace Square
    for (let i = 0; i < 10; i++) {
      const color = coatColors[(i * 5) % coatColors.length];
      const model = this.createPedestrianModel(color);
      this.group.add(model.group);
      this.pedestrians.push({
        mesh: model.group,
        path: palaceSquarePlaza,
        t: i / 10,
        speed: 0.005 + (i % 2) * 0.002,
        baseY: 0.30,
        legL: model.legL,
        legR: model.legR
      });
    }
  }

  /**
   * Spawns cast-iron St. Petersburg streetlamps along Nevsky, Palace Embankment, and Palace Square
   */
  private spawnStreetlamps() {
    const lampPositions: { x: number; z: number; yaw: number }[] = [];

    // Nevsky Prospekt streetlamps (both sides every 40m)
    for (let d = 0; d < 2000; d += 40) {
      const frac = d / 2000;
      const x = -128 + frac * (1920 - (-128));
      const z = 305 + frac * (818 - 305);
      // North sidewalk
      lampPositions.push({ x: x - 4.5, z: z - 10.5, yaw: 0 });
      // South sidewalk
      lampPositions.push({ x: x + 4.5, z: z + 10.5, yaw: Math.PI });
    }

    // Palace Embankment streetlamps along granite parapet
    for (let d = 0; d < 1100; d += 35) {
      const frac = d / 1100;
      const x = -265 + frac * (810 - (-265));
      const z = -33 + frac * (-703 - (-33));
      lampPositions.push({ x: x - 2.5, z: z - 3.5, yaw: Math.PI * 0.25 });
    }

    // Palace Square perimeter streetlamps
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI - Math.PI * 0.1;
      const x = 70 + Math.cos(angle) * 95;
      const z = 90 + Math.sin(angle) * 75;
      lampPositions.push({ x, z, yaw: angle });
    }

    // Build merged geometry for all streetlamp iron posts and all lantern heads
    const postPositions: number[] = [];
    const lanternPositions: number[] = [];

    // Helper to add a 3D box to an array
    const addBox = (arr: number[], ox: number, oy: number, oz: number, sx: number, sy: number, sz: number) => {
      const hx = sx / 2, hy = sy / 2, hz = sz / 2;
      const p = [
        // front
        ox - hx, oy - hy, oz + hz,  ox + hx, oy - hy, oz + hz,  ox + hx, oy + hy, oz + hz,
        ox - hx, oy - hy, oz + hz,  ox + hx, oy + hy, oz + hz,  ox - hx, oy + hy, oz + hz,
        // back
        ox + hx, oy - hy, oz - hz,  ox - hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz - hz,
        ox + hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz - hz,  ox + hx, oy + hy, oz - hz,
        // top
        ox - hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz - hz,
        ox - hx, oy + hy, oz + hz,  ox + hx, oy + hy, oz - hz,  ox - hx, oy + hy, oz - hz,
        // bottom
        ox - hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz + hz,
        ox - hx, oy - hy, oz - hz,  ox + hx, oy - hy, oz + hz,  ox - hx, oy - hy, oz + hz,
        // right
        ox + hx, oy - hy, oz + hz,  ox + hx, oy - hy, oz - hz,  ox + hx, oy + hy, oz - hz,
        ox + hx, oy - hy, oz + hz,  ox + hx, oy + hy, oz - hz,  ox + hx, oy + hy, oz + hz,
        // left
        ox - hx, oy - hy, oz - hz,  ox - hx, oy - hy, oz + hz,  ox - hx, oy + hy, oz + hz,
        ox - hx, oy - hy, oz - hz,  ox - hx, oy + hy, oz + hz,  ox - hx, oy + hy, oz - hz,
      ];
      for (let i = 0; i < p.length; i++) arr.push(p[i]);
    };

    for (const lamp of lampPositions) {
      // Granite base
      addBox(postPositions, lamp.x, 0.45, lamp.z, 0.5, 0.4, 0.5);
      // Cast iron fluted pole
      addBox(postPositions, lamp.x, 2.7, lamp.z, 0.22, 4.2, 0.22);
      // Crossbar bracket
      addBox(postPositions, lamp.x, 4.6, lamp.z, 1.4, 0.12, 0.14);
      // Finial spike
      addBox(postPositions, lamp.x, 5.2, lamp.z, 0.12, 0.8, 0.12);

      // 2 Lanterns (Left & Right)
      for (const lx of [-0.65, 0.65]) {
        // Dark bronze lantern cap
        addBox(postPositions, lamp.x + lx, 4.85, lamp.z, 0.42, 0.12, 0.42);
        // Glass lantern head (warm illuminated)
        addBox(lanternPositions, lamp.x + lx, 4.45, lamp.z, 0.36, 0.48, 0.36);
      }
    }

    // Create post mesh
    const postGeo = new THREE.BufferGeometry();
    postGeo.setAttribute('position', new THREE.Float32BufferAttribute(postPositions, 3));
    postGeo.computeVertexNormals();
    const postMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22, flatShading: true });
    this.streetlampsMesh = new THREE.Mesh(postGeo, postMat);
    this.streetlampsMesh.castShadow = true;
    this.streetlampsMesh.receiveShadow = true;
    this.group.add(this.streetlampsMesh);

    // Create lantern mesh
    const lanternGeo = new THREE.BufferGeometry();
    lanternGeo.setAttribute('position', new THREE.Float32BufferAttribute(lanternPositions, 3));
    lanternGeo.computeVertexNormals();
    this.streetlampsLanternMesh = new THREE.Mesh(lanternGeo, this.streetlampLanternMat);
    this.group.add(this.streetlampsLanternMesh);

    // Create ground illuminated glow spots under each streetlamp
    const groundGlowPositions: number[] = [];
    const glowRadius = 3.6;
    for (const lamp of lampPositions) {
      for (let s = 0; s < 8; s++) {
        const a1 = (s / 8) * Math.PI * 2;
        const a2 = ((s + 1) / 8) * Math.PI * 2;
        groundGlowPositions.push(
          lamp.x, 0.28, lamp.z,
          lamp.x + Math.cos(a1) * glowRadius, 0.28, lamp.z + Math.sin(a1) * glowRadius,
          lamp.x + Math.cos(a2) * glowRadius, 0.28, lamp.z + Math.sin(a2) * glowRadius
        );
      }
    }
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(groundGlowPositions, 3));
    this.streetlampGroundGlowMesh = new THREE.Mesh(glowGeo, this.streetlampGroundGlowMat);
    this.streetlampGroundGlowMesh.renderOrder = 8;
    this.group.add(this.streetlampGroundGlowMesh);
  }

  private catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    const t3 = t * t2;
    return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
  }

  private catmullRomDeriv(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const v0 = (p2 - p0) * 0.5;
    const v1 = (p3 - p1) * 0.5;
    const t2 = t * t;
    return 3 * (2 * p1 - 2 * p2 + v0 + v1) * t2 + 2 * (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t + v0;
  }

  private pathLengths = new Map<THREE.Vector3[], number>();

  /** Length of a looped path in metres (cached). */
  private pathLength(path: THREE.Vector3[]): number {
    let len = this.pathLengths.get(path);
    if (len === undefined) {
      len = 0;
      for (let i = 1; i < path.length; i++) len += path[i].distanceTo(path[i - 1]);
      len += path[0].distanceTo(path[path.length - 1]);
      this.pathLengths.set(path, len);
    }
    return len;
  }

  /**
   * Palace Bridge (the only drawbridge on a car route): a car heading along the
   * bridge may not enter the ramps from the street, nor the deck from a ramp,
   * while the leaves are up. Embankment traffic crossing in front is unaffected.
   */
  private blockedByDrawbridge(x0: number, z0: number, x1: number, z1: number): boolean {
    const ax = -276, az = -45, bx = -437, bz = -254;
    const vx = bx - ax, vz = bz - az;
    const L = Math.hypot(vx, vz);
    const mx = x1 - x0, mz = z1 - z0;
    const m = Math.hypot(mx, mz);
    if (m < 1e-6 || Math.abs((mx * vx + mz * vz) / (m * L)) < 0.7) return false;
    const along = (x: number, z: number) => ((x - ax) * vx + (z - az) * vz) / L;
    const off = (x: number, z: number) => Math.abs((x - ax) * vz - (z - az) * vx) / L;
    const inside = (x: number, z: number, ext: number) => {
      const a = along(x, z);
      return a > -ext && a < L + ext && off(x, z) < 16;
    };
    return (!inside(x0, z0, 16) && inside(x1, z1, 16)) || (!inside(x0, z0, 0) && inside(x1, z1, 0));
  }

  private interpolateCatmullRom(path: THREE.Vector3[], t: number): { pos: THREE.Vector3; tangent: THREE.Vector3 } {
    const n = path.length;
    const totalT = (t % 1.0) * (n - 1);
    const i = Math.floor(totalT);
    const frac = totalT - i;

    const p0 = path[Math.max(0, i - 1)];
    const p1 = path[i];
    const p2 = path[Math.min(n - 1, i + 1)];
    const p3 = path[Math.min(n - 1, i + 2)];

    const pos = new THREE.Vector3(
      this.catmullRom(p0.x, p1.x, p2.x, p3.x, frac),
      this.catmullRom(p0.y, p1.y, p2.y, p3.y, frac),
      this.catmullRom(p0.z, p1.z, p2.z, p3.z, frac)
    );

    const tangent = new THREE.Vector3(
      this.catmullRomDeriv(p0.x, p1.x, p2.x, p3.x, frac),
      this.catmullRomDeriv(p0.y, p1.y, p2.y, p3.y, frac),
      this.catmullRomDeriv(p0.z, p1.z, p2.z, p3.z, frac)
    ).normalize();

    return { pos, tangent };
  }

  public update(deltaTime: number, bridgesOpen: boolean, nightFactor?: number) {
    this.animTime += deltaTime;

    // Update Night Illumination (streetlamps glow, car headlights on asphalt)
    if (nightFactor !== undefined) {
      const glow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.15) * 2.5));
      this.streetlampGroundGlowMat.opacity = glow * 0.40;
      this.carHeadlightMat.opacity = glow * 0.45;
      if (glow > 0.05) {
        this.streetlampLanternMat.color.setHex(0xffdf66); // Rich warm amber glow
      } else {
        this.streetlampLanternMat.color.setHex(0xfffae2);
      }
    }

    // 1. Update Trams with smooth orientation along track
    for (const tram of this.trams) {
      if (tram.isStopped) continue;
      tram.t = (tram.t + deltaTime * tram.speed * 0.15) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(tram.path, tram.t);
      tram.mesh.position.copy(pos);
      if (tangent.lengthSq() > 0.001) {
        const yaw = Math.atan2(-tangent.z, tangent.x);
        tram.mesh.rotation.y = yaw;
      }
    }

    // 2. Update Moving Cars, Taxis, Vans & Buses strictly inside road lanes.
    // Cars keep a gap to the car ahead in their lane, and while a bridge is
    // raised they wait at its approach instead of driving onto the open leaves.
    const byPath = new Map<THREE.Vector3[], Vehicle[]>();
    for (const car of this.movingCars) {
      let lane = byPath.get(car.path);
      if (!lane) byPath.set(car.path, (lane = []));
      lane.push(car);
    }
    for (const [path, lane] of byPath) {
      const len = this.pathLength(path);
      lane.sort((a, b) => a.t - b.t);
      for (let i = 0; i < lane.length; i++) {
        const car = lane[i];
        const step = deltaTime * car.speed * 0.25;
        if (lane.length > 1) {
          const ahead = lane[(i + 1) % lane.length];
          const gap = (((ahead.t - car.t) % 1) + 1) % 1;
          if (gap * len < 9 + step * len) continue; // ~4.5 m car + 4.5 m spacing
        }
        const nextT = (car.t + step) % 1.0;
        if (bridgesOpen) {
          const now = car.mesh.position;
          const next = this.interpolateCatmullRom(path, nextT).pos;
          if (this.blockedByDrawbridge(now.x, now.z, next.x, next.z)) continue;
        }
        car.t = nextT;
      }
    }
    for (const car of this.movingCars) {
      const { pos, tangent } = this.interpolateCatmullRom(car.path, car.t);
      car.mesh.position.copy(pos);
      if (tangent.lengthSq() > 0.001) {
        const yaw = Math.atan2(-tangent.z, tangent.x);
        car.mesh.rotation.y = yaw;
      }
    }

    // 3. Update Boats on Neva, Fontanka, and Moyka Rivers
    for (const boat of this.boats) {
      boat.t = (boat.t + deltaTime * boat.speed * 0.1) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(boat.path, boat.t);
      boat.mesh.position.copy(pos);

      if (boat.isMeteor) {
        boat.mesh.position.y = 0.8 + Math.sin(boat.t * 80) * 0.05;
      } else {
        boat.mesh.rotation.z = Math.sin(this.animTime * 3.5 + boat.t * 20) * 0.03;
      }

      if (tangent.lengthSq() > 0.001) {
        const yaw = Math.atan2(-tangent.z, tangent.x);
        boat.mesh.rotation.y = yaw;
      }

      // Pulse boat wake foam
      if (boat.wake) {
        const wakeMat = (boat.wake.children[0] as THREE.Mesh)?.material as THREE.MeshBasicMaterial;
        if (wakeMat) {
          wakeMat.opacity = 0.45 + Math.sin(this.animTime * 8) * 0.15;
        }
      }
    }

    // 4. Update Pedestrians with leg walking cycles and step bobbing
    for (const p of this.pedestrians) {
      p.t = (p.t + deltaTime * p.speed * 0.12) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(p.path, p.t);
      const bobbing = Math.abs(Math.sin(p.t * 360)) * 0.06;
      p.mesh.position.set(pos.x, p.baseY + bobbing, pos.z);

      if (tangent.lengthSq() > 0.001) {
        const yaw = Math.atan2(-tangent.z, tangent.x);
        p.mesh.rotation.y = yaw;
      }

      const legSwing = Math.sin(p.t * 360) * 0.45;
      p.legL.rotation.z = legSwing;
      p.legR.rotation.z = -legSwing;
    }
  }
}
