import * as THREE from 'three';
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

export class TransitSystem {
  public group: THREE.Group;
  public trams: Tram[] = [];
  public boats: Boat[] = [];
  public movingCars: Vehicle[] = [];
  public parkedCarsGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'transit-and-vehicles';
    scene.add(this.group);

    this.parkedCarsGroup = new THREE.Group();
    this.parkedCarsGroup.name = 'parked-cars';
    this.group.add(this.parkedCarsGroup);

    this.spawnTrams();
    this.spawnBoats();
    this.spawnParkedCars();
    this.spawnMovingCars();
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

    return car;
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

    return bus;
  }

  /**
   * Spawns dozens of parked cars in parking lots and curbside bays (Warsaw-Izo style)
   */
  /**
   * Spawns dozens of parked cars in parking lots and curbside bays with painted white stall markings (Warsaw-Izo style)
   */
  private spawnParkedCars() {
    const carColors = [
      0xf0f3f6, // Crisp White
      0x1c1e22, // Black metallic
      0x8b939e, // Silver / Grey
      0xb82626, // Red
      0x1e3a66, // Dark Navy
      0xc49b45, // Ochre / Gold
      0x2e6644  // British Racing Green
    ];

    const stallPositions: number[] = [];
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false });

    // Helper to add a white stall marking line
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
      car.rotation.y = Math.PI / 2; // Parked perpendicular to curb
      this.parkedCarsGroup.add(car);

      // White stall lines between cars
      addStallLine(px - 2.5, pz - 2.4, px - 2.5, pz + 2.4);
      if (i === 21) addStallLine(px + 2.5, pz - 2.4, px + 2.5, pz + 2.4);
    }

    // Parking Lot 2: St. Isaac's Square Parking (Исаакиевская площадь)
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

    // Parking Lot 3: Spit of Vasilyevsky Island (Биржевая площадь)
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
      car.rotation.y = 0; // Parked parallel to street
      this.parkedCarsGroup.add(car);
    }

    // Create painted parking stall markings mesh
    if (stallPositions.length > 0) {
      const stallGeo = new THREE.BufferGeometry();
      stallGeo.setAttribute('position', new THREE.Float32BufferAttribute(stallPositions, 3));
      const stallMesh = new THREE.Mesh(stallGeo, lineMat);
      stallMesh.renderOrder = 7;
      this.parkedCarsGroup.add(stallMesh);
    }
  }

  /**
   * Spawns moving vehicular traffic along major avenues, bridges, and boulevards.
   * All paths follow real OSM street centerlines with lateral lane offsets
   * in the direction of travel (Right-Hand Traffic rule), ensuring vehicles
   * drive strictly on asphalt lanes with authentic forward orientation.
   */
  private spawnMovingCars() {
    const carColors = [
      0xf0f3f6, // White metallic
      0x1c1e22, // Black metallic
      0x8b939e, // Grey silver
      0xb82626, // Classic Red
      0x1e3a66, // Deep Blue
      0xe8a923, // St. P Yellow Taxi
      0x35654d  // Malachite Green
    ];

    // Helper to spawn moving vehicles on a path
    const addCarsOnPath = (path: THREE.Vector3[], count: number, speed: number, offsetTime = 0) => {
      for (let i = 0; i < count; i++) {
        const color = carColors[(i + this.movingCars.length) % carColors.length];
        const car = this.createCarModel(color);
        this.group.add(car);
        this.movingCars.push({
          mesh: car,
          path,
          t: (i / count + offsetTime) % 1.0,
          speed
        });
      }
    };

    // 1. Nevsky Prospekt Continuous Two-Way Loop (Admiralty <-> Vosstaniya Square / Moscow Station)
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

    const nevskyEast = offsetPath(nevskyCenterline, 4.0);
    const nevskyWest = offsetPath([...nevskyCenterline].reverse(), 4.0);

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
    addCarsOnPath(nevskyLoop, 12, 0.024, 0.0);

    // 2. Palace Embankment & Bridge Circuit (Winter Palace <-> Trinity Bridge <-> Spit of Vasilyevsky Island)
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
      // Turn around near Summer Garden / Trinity Bridge approach
      new THREE.Vector3(820, 0.24, -690),
      new THREE.Vector3(790, 0.24, -675),
      new THREE.Vector3(590, 0.24, -580),
      new THREE.Vector3(340, 0.24, -430),
      new THREE.Vector3(80, 0.24, -270),
      new THREE.Vector3(-15, 0.24, -200),
      new THREE.Vector3(-180, 0.24, -65),
      new THREE.Vector3(-250, 0.24, -25)
    ];
    addCarsOnPath(palaceCircuit, 6, 0.028, 0.0);

    // 3. Dvortsovy Proyezd (Connecting Palace Bridge to Nevsky Prospekt)
    const dvortsovyCenterline: THREE.Vector3[] = [
      new THREE.Vector3(-265, 0.24, -33),
      new THREE.Vector3(-256, 0.24, -21),
      new THREE.Vector3(-209, 0.24, 40),
      new THREE.Vector3(-169, 0.24, 92),
      new THREE.Vector3(-136, 0.24, 135),
      new THREE.Vector3(-113, 0.24, 272)
    ];
    const dvortsovySouth = offsetPath(dvortsovyCenterline, 2.5);
    const dvortsovyNorth = offsetPath([...dvortsovyCenterline].reverse(), 2.5);
    addCarsOnPath(dvortsovySouth, 3, 0.032, 0.0);
    addCarsOnPath(dvortsovyNorth, 3, 0.032, 0.3);

    // 4. Palace Bridge (Дворцовый мост crossing the Neva)
    const palaceBridgeCenterline: THREE.Vector3[] = [
      new THREE.Vector3(-265, 4.6, -33),
      new THREE.Vector3(-280, 4.6, -53),
      new THREE.Vector3(-350, 4.8, -140),
      new THREE.Vector3(-431, 4.6, -257),
      new THREE.Vector3(-441, 4.6, -270)
    ];
    const bridgeNorth = offsetPath(palaceBridgeCenterline, 2.2);
    const bridgeSouth = offsetPath([...palaceBridgeCenterline].reverse(), 2.2);
    addCarsOnPath(bridgeNorth, 2, 0.030, 0.0);
    addCarsOnPath(bridgeSouth, 2, 0.030, 0.5);

    // 5. Admiralteysky Prospekt (Admiralty <-> St. Isaac's <-> Senate Square)
    const admiralteyskyCenterline: THREE.Vector3[] = [
      new THREE.Vector3(-578, 0.24, 618),
      new THREE.Vector3(-505, 0.24, 560),
      new THREE.Vector3(-439, 0.24, 509),
      new THREE.Vector3(-353, 0.24, 442),
      new THREE.Vector3(-247, 0.24, 375),
      new THREE.Vector3(-172, 0.24, 317),
      new THREE.Vector3(-113, 0.24, 272)
    ];
    const admiralteyskyEast = offsetPath(admiralteyskyCenterline, 2.5);
    const admiralteyskyWest = offsetPath([...admiralteyskyCenterline].reverse(), 2.5);
    addCarsOnPath(admiralteyskyEast, 3, 0.028, 0.0);
    addCarsOnPath(admiralteyskyWest, 3, 0.028, 0.4);

    // 6. Sadovaya Street Loop (Field of Mars <-> Gostiny Dvor <-> Sennaya Square)
    const sadovayaCenterline: THREE.Vector3[] = [
      new THREE.Vector3(420, 0.24, 40),
      new THREE.Vector3(450, 0.24, 180),
      new THREE.Vector3(490, 0.24, 340),
      new THREE.Vector3(520, 0.24, 460),
      new THREE.Vector3(460, 0.24, 700),
      new THREE.Vector3(310, 0.24, 960)
    ];
    const sadovayaSouth = offsetPath(sadovayaCenterline, 2.4);
    const sadovayaNorth = offsetPath([...sadovayaCenterline].reverse(), 2.4);
    const sadovayaLoop: THREE.Vector3[] = [
      ...sadovayaSouth,
      new THREE.Vector3(290, 0.24, 980),
      new THREE.Vector3(300, 0.24, 990),
      new THREE.Vector3(320, 0.24, 975),
      ...sadovayaNorth,
      new THREE.Vector3(435, 0.24, 30),
      new THREE.Vector3(420, 0.24, 20),
      new THREE.Vector3(405, 0.24, 35)
    ];
    addCarsOnPath(sadovayaLoop, 6, 0.026, 0.0);

    // 7. Liteyny Prospekt Loop (Liteyny Bridge <-> Nevsky <-> Five Corners)
    const liteynyCenterline: THREE.Vector3[] = [
      new THREE.Vector3(1250, 0.24, -500),
      new THREE.Vector3(1150, 0.24, -200),
      new THREE.Vector3(1100, 0.24, 150),
      new THREE.Vector3(1050, 0.24, 588),
      new THREE.Vector3(1000, 0.24, 900),
      new THREE.Vector3(950, 0.24, 1250)
    ];
    const liteynySouth = offsetPath(liteynyCenterline, 2.8);
    const liteynyNorth = offsetPath([...liteynyCenterline].reverse(), 2.8);
    const liteynyLoop: THREE.Vector3[] = [
      ...liteynySouth,
      new THREE.Vector3(935, 0.24, 1265),
      new THREE.Vector3(945, 0.24, 1275),
      new THREE.Vector3(965, 0.24, 1260),
      ...liteynyNorth,
      new THREE.Vector3(1265, 0.24, -515),
      new THREE.Vector3(1255, 0.24, -525),
      new THREE.Vector3(1235, 0.24, -510)
    ];
    addCarsOnPath(liteynyLoop, 6, 0.028, 0.0);

    // 8. St. Petersburg Azure Blue Buses in Dedicated Bus Lanes
    const bus1 = this.createBusModel();
    this.group.add(bus1);
    this.movingCars.push({ mesh: bus1, path: nevskyLoop, t: 0.15, speed: 0.020 });
    const bus2 = this.createBusModel();
    this.group.add(bus2);
    this.movingCars.push({ mesh: bus2, path: nevskyLoop, t: 0.65, speed: 0.020 });

    const dvortsovyBus = this.createBusModel();
    this.group.add(dvortsovyBus);
    this.movingCars.push({ mesh: dvortsovyBus, path: palaceCircuit, t: 0.35, speed: 0.022 });
  }

  /**
   * Spawns iconic St. Petersburg tram (LM-68M style red & white wagon)
   */
  private createTramModel(): THREE.Group {
    const tram = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: PALETTE.tramRed, flatShading: true });
    const topMat = new THREE.MeshLambertMaterial({ color: PALETTE.tramWhite, flatShading: true });
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x223344, flatShading: true });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x333740, flatShading: true });

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

    return tram;
  }

  private createMeteorModel(): THREE.Group {
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

    return meteor;
  }

  private createTouristBoatModel(): THREE.Group {
    const boat = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x223048, flatShading: true });
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xded5be, flatShading: true });
    const awningMat = new THREE.MeshLambertMaterial({ color: 0x3d70b8, flatShading: true });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 1.4, 3.6), hullMat);
    hull.position.y = 0.6;
    hull.castShadow = true;
    boat.add(hull);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(11, 0.2, 3.2), deckMat);
    deck.position.y = 1.35;
    boat.add(deck);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 3.2), awningMat);
    roof.position.set(-1, 2.5, 0);
    boat.add(roof);

    return boat;
  }

  private spawnTrams() {
    // Historic Route 3 Tram Centerline across Trinity Bridge, Field of Mars, Sadovaya to Sennaya
    const tram3Centerline: THREE.Vector3[] = [
      new THREE.Vector3(340, 5.0, -750),  // Trinity Bridge north ramp
      new THREE.Vector3(360, 5.0, -560),  // Trinity Bridge center span
      new THREE.Vector3(410, 5.0, -80),   // Trinity Bridge south ramp
      new THREE.Vector3(425, 0.24, 40),   // Field of Mars / Swan Canal
      new THREE.Vector3(440, 0.24, 180),  // Mikhailovsky Castle
      new THREE.Vector3(485, 0.24, 340),  // Sadovaya street north
      new THREE.Vector3(510, 0.24, 460),  // Gostiny Dvor tram stop
      new THREE.Vector3(460, 0.24, 700),  // Apraksin Dvor
      new THREE.Vector3(310, 0.24, 960)   // Sennaya Square
    ];

    const route3Forward = offsetPath(tram3Centerline, 1.4);
    const route3Backward = offsetPath([...tram3Centerline].reverse(), 1.4);

    const route3Loop: THREE.Vector3[] = [
      ...route3Forward,
      new THREE.Vector3(290, 0.24, 975),
      new THREE.Vector3(310, 0.24, 990),
      new THREE.Vector3(330, 0.24, 975),
      ...route3Backward,
      new THREE.Vector3(325, 5.0, -765),
      new THREE.Vector3(345, 5.0, -775),
      new THREE.Vector3(365, 5.0, -760)
    ];

    const tram1 = this.createTramModel();
    this.group.add(tram1);
    this.trams.push({
      mesh: tram1,
      path: route3Loop,
      t: 0.15,
      speed: 0.022,
      isStopped: false
    });

    const tram2 = this.createTramModel();
    this.group.add(tram2);
    this.trams.push({
      mesh: tram2,
      path: route3Loop,
      t: 0.65,
      speed: 0.022,
      isStopped: false
    });
  }

  private spawnBoats() {
    const nevaFastPath: THREE.Vector3[] = [
      new THREE.Vector3(600, 0.4, -200),
      new THREE.Vector3(200, 0.4, -220),
      new THREE.Vector3(-100, 0.4, -240),
      new THREE.Vector3(-220, 0.4, -210),
      new THREE.Vector3(-500, 0.4, -120),
      new THREE.Vector3(-900, 0.4, 0),
      new THREE.Vector3(-1400, 0.4, 100),
      // Return fairway on northern side
      new THREE.Vector3(-1400, 0.4, 40),
      new THREE.Vector3(-900, 0.4, -60),
      new THREE.Vector3(-500, 0.4, -180),
      new THREE.Vector3(-100, 0.4, -300),
      new THREE.Vector3(200, 0.4, -280),
      new THREE.Vector3(600, 0.4, -260)
    ];

    const meteor = this.createMeteorModel();
    this.group.add(meteor);
    this.boats.push({
      mesh: meteor,
      path: nevaFastPath,
      t: 0.2,
      speed: 0.05,
      isMeteor: true
    });

    const touristPath: THREE.Vector3[] = [
      new THREE.Vector3(-400, 0.3, -80),
      new THREE.Vector3(-180, 0.3, -160),
      new THREE.Vector3(100, 0.3, -180),
      new THREE.Vector3(300, 0.3, -150),
      new THREE.Vector3(350, 0.3, -300),
      new THREE.Vector3(0, 0.3, -340),
      new THREE.Vector3(-300, 0.3, -320)
    ];

    const touristBoat = this.createTouristBoatModel();
    this.group.add(touristBoat);
    this.boats.push({
      mesh: touristBoat,
      path: touristPath,
      t: 0.7,
      speed: 0.02,
      isMeteor: false
    });
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

  public update(deltaTime: number, bridgesOpen: boolean) {
    // 1. Update Trams with smooth orientation along track
    for (const tram of this.trams) {
      if (tram.isStopped) continue;
      tram.t = (tram.t + deltaTime * tram.speed * 0.15) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(tram.path, tram.t);
      tram.mesh.position.copy(pos);
      if (tangent.lengthSq() > 0.001) {
        // Model front is +X. In Three.js: yaw = atan2(-tangent.z, tangent.x)
        const yaw = Math.atan2(-tangent.z, tangent.x);
        tram.mesh.rotation.y = yaw;
      }
    }

    // 2. Update Moving Cars & Buses strictly inside road lanes
    for (const car of this.movingCars) {
      car.t = (car.t + deltaTime * car.speed * 0.25) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(car.path, car.t);
      car.mesh.position.copy(pos);
      if (tangent.lengthSq() > 0.001) {
        // Model front is +X. In Three.js: yaw = atan2(-tangent.z, tangent.x)
        const yaw = Math.atan2(-tangent.z, tangent.x);
        car.mesh.rotation.y = yaw;
      }
    }

    // 3. Update Boats on Neva River
    for (const boat of this.boats) {
      boat.t = (boat.t + deltaTime * boat.speed * 0.1) % 1.0;
      const { pos, tangent } = this.interpolateCatmullRom(boat.path, boat.t);
      boat.mesh.position.copy(pos);

      if (boat.isMeteor) {
        boat.mesh.position.y = 0.8 + Math.sin(boat.t * 80) * 0.05;
      } else {
        boat.mesh.rotation.z = Math.sin(boat.t * 40) * 0.04;
      }

      if (tangent.lengthSq() > 0.001) {
        const yaw = Math.atan2(-tangent.z, tangent.x);
        boat.mesh.rotation.y = yaw;
      }
    }
  }
}
