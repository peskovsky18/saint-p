import * as THREE from 'three';
import { PALETTE } from './palette';

export class LandmarksSystem {
  public group: THREE.Group;
  private streetLampsMat!: THREE.MeshBasicMaterial;
  private beaconMat!: THREE.MeshBasicMaterial;
  public floodlightMat!: THREE.MeshBasicMaterial;
  public rostralFlameMat!: THREE.MeshBasicMaterial;
  private totalTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'landmark-spires-and-monuments';
    scene.add(this.group);

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
   * Зимний дворец (Winter Palace) Balustrade Statues & Grand Church Dome
   */
  private buildWinterPalaceDetails() {
    const wpGroup = new THREE.Group();
    wpGroup.name = 'winter-palace-details';

    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: 0xf5f3ee, flatShading: true });
    const statueMat = new THREE.MeshLambertMaterial({ color: 0x4a4f48, flatShading: true });

    // 1. Grand Church of the Winter Palace Dome (Большая церковь Зимнего дворца)
    // Eastern wing facing Palace Square: x=145, z=-85, y=24
    const churchBase = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.0, 7, 8), trimMat);
    churchBase.position.set(145, 27.5, -85);
    churchBase.castShadow = true;
    wpGroup.add(churchBase);

    const churchDome = new THREE.Mesh(new THREE.SphereGeometry(5.0, 12, 10), goldMat);
    churchDome.scale.set(1.0, 1.35, 1.0);
    churchDome.position.set(145, 34.0, -85);
    churchDome.castShadow = true;
    wpGroup.add(churchDome);

    const churchCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 1.8), goldMat);
    churchCross.position.set(145, 41.0, -85);
    wpGroup.add(churchCross);

    // 2. Balustrade Mini-Statues & Urns along the Hermitage roofline facing Palace Square
    for (let x = -40; x <= 160; x += 12) {
      const statue = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), statueMat);
      statue.position.set(x, 24.8, -48);
      statue.castShadow = true;
      wpGroup.add(statue);
    }
    // Along Palace Embankment roofline
    for (let x = -50; x <= 180; x += 14) {
      const statue = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.8), statueMat);
      statue.position.set(x, 24.8, -108);
      statue.castShadow = true;
      wpGroup.add(statue);
    }

    this.group.add(wpGroup);
  }

  /**
   * Шпиль Адмиралтейства (Admiralty Golden Spire & Ship)
   * Exact GPS: 59.937500 N, 30.308611 E -> World: x=-331.72, z=259.60
   */
  private buildAdmiraltySpire() {
    const spireGroup = new THREE.Group();
    spireGroup.name = 'admiralty-spire';
    spireGroup.position.set(-331.72, 18.0, 259.60);

    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });

    // Tower Base
    const towerBase = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 22), trimMat);
    towerBase.position.y = 7;
    towerBase.castShadow = true;
    spireGroup.add(towerBase);

    // Ionic colonnade tier with 28 classical statues
    const colonnade = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 12, 16), trimMat);
    colonnade.position.y = 20;
    colonnade.castShadow = true;
    spireGroup.add(colonnade);

    // Golden Spire (72.5m)
    const spireGeo = new THREE.ConeGeometry(3.0, 36, 12);
    const spire = new THREE.Mesh(spireGeo, goldMat);
    spire.position.y = 44;
    spire.castShadow = true;
    spireGroup.add(spire);

    // Architectural Floodlight Glow on Spire
    const spireGlow = new THREE.Mesh(new THREE.ConeGeometry(3.2, 36.5, 12), this.floodlightMat);
    spireGlow.position.y = 44;
    spireGroup.add(spireGlow);

    // Golden Ship weathervane (Кораблик)
    const ship = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.0, 0.4), goldMat);
    ship.position.y = 63;
    spireGroup.add(ship);

    const shipGlow = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 0.6), this.floodlightMat);
    shipGlow.position.y = 63;
    spireGroup.add(shipGlow);

    this.group.add(spireGroup);
  }

  /**
   * Купол Исаакиевского собора (St. Isaac's Golden Dome & Porticoes)
   * Exact GPS: 59.934083 N, 30.306122 E -> World: x=-470.51, z=639.98
   */
  private buildStIsaacsDome() {
    const isaacGroup = new THREE.Group();
    isaacGroup.name = 'st-isaacs-dome';
    isaacGroup.position.set(-470.51, 28.0, 639.98);

    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9e9aa0, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: 0x7a3a30, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });

    // Monumental Drum with 24 Monolithic Granite Columns
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(19, 21, 16, 24), stoneMat);
    drum.position.y = 8;
    drum.castShadow = true;
    isaacGroup.add(drum);

    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 14, 8), graniteMat);
      col.position.set(Math.cos(ang) * 20.5, 8, Math.sin(ang) * 20.5);
      col.castShadow = true;
      isaacGroup.add(col);
    }

    // Colossal Golden Central Dome (101.5m total height)
    const domeGeo = new THREE.SphereGeometry(17.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, goldMat);
    dome.position.y = 16;
    dome.scale.set(1.0, 1.25, 1.0);
    dome.castShadow = true;
    isaacGroup.add(dome);

    // Architectural Floodlight Glow on Main Dome
    const domeGlow = new THREE.Mesh(new THREE.SphereGeometry(17.8, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), this.floodlightMat);
    domeGlow.position.y = 16;
    domeGlow.scale.set(1.0, 1.25, 1.0);
    isaacGroup.add(domeGlow);

    // 4 Corner Belfries with Golden Domes
    const belfryOffset = 26;
    for (const bx of [-belfryOffset, belfryOffset]) {
      for (const bz of [-belfryOffset, belfryOffset]) {
        const belfry = new THREE.Mesh(new THREE.BoxGeometry(9, 14, 9), stoneMat);
        belfry.position.set(bx, 7, bz);
        belfry.castShadow = true;
        isaacGroup.add(belfry);

        const bDome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
        bDome.position.set(bx, 14, bz);
        bDome.scale.set(1.0, 1.2, 1.0);
        bDome.castShadow = true;
        isaacGroup.add(bDome);
      }
    }

    // Gilded Lantern & Cross
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 9, 12), goldMat);
    lantern.position.y = 47;
    lantern.castShadow = true;
    isaacGroup.add(lantern);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6.5, 3.2), goldMat);
    cross.position.y = 56;
    isaacGroup.add(cross);

    this.group.add(isaacGroup);
  }

  /**
   * Шпиль Петропавловского собора (Peter & Paul Golden Needle Spire)
   * Exact GPS: 59.950200 N, 30.316670 E -> World: x=117.66, z=-1154.16
   */
  private buildPeterAndPaulSpire() {
    const ppGroup = new THREE.Group();
    ppGroup.name = 'peter-and-paul-spire';
    ppGroup.position.set(117.66, 18.0, -1154.16);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldSpire, flatShading: true });

    // Bell Tower Tier
    const tower = new THREE.Mesh(new THREE.BoxGeometry(16, 42, 16), stoneMat);
    tower.position.y = 21;
    tower.castShadow = true;
    ppGroup.add(tower);

    // 122.5m Golden Needle Spire
    const spireGeo = new THREE.ConeGeometry(3.8, 65, 12);
    const spire = new THREE.Mesh(spireGeo, goldMat);
    spire.position.y = 74;
    spire.castShadow = true;
    ppGroup.add(spire);

    // Architectural Floodlight Glow on Spire
    const needleGlow = new THREE.Mesh(new THREE.ConeGeometry(4.0, 65.5, 12), this.floodlightMat);
    needleGlow.position.y = 74;
    ppGroup.add(needleGlow);

    // Angel with Cross on Top
    const angel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 1.2), goldMat);
    angel.position.y = 107;
    ppGroup.add(angel);

    this.group.add(ppGroup);
  }

  /**
   * Ростральные колонны (Rostral Columns on Vasilyevsky Spit)
   * North: GPS 59.944200 N, 30.307500 E -> World: x=-393.67, z=-486.24
   * South: GPS 59.943300 N, 30.305600 E -> World: x=-499.62, z=-386.06
   */
  private buildRostralColumns() {
    const rostralMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbTerracotta, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x22272e, flatShading: true });

    const positions = [
      { x: -393.67, z: -486.24, name: 'north-rostral' },
      { x: -499.62, z: -386.06, name: 'south-rostral' }
    ];

    for (const p of positions) {
      const colGroup = new THREE.Group();
      colGroup.name = p.name;
      colGroup.position.set(p.x, 0.5, p.z);

      // Red terracotta column (32m high)
      const column = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 30, 12), rostralMat);
      column.position.y = 15;
      column.castShadow = true;
      colGroup.add(column);

      // Ship prows (Ростры)
      for (let y = 8; y <= 22; y += 4) {
        const rostrum = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.8, 1.3), bronzeMat);
        rostrum.position.y = y;
        colGroup.add(rostrum);
      }

      // Brazier on top
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 1.6, 3.2, 8), bronzeMat);
      brazier.position.y = 31.5;
      colGroup.add(brazier);

      // Flaming torch for festivals and White Nights
      const flame = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5.0, 8), this.rostralFlameMat);
      flame.position.y = 35.5;
      colGroup.add(flame);

      this.group.add(colGroup);
    }
  }

  /**
   * Арка Главного штаба и Колесница Славы (Triumphal Arch & Chariot of Glory)
   * Spans Bolshaya Morskaya Street onto Palace Square
   * Exact GPS: 59.937748 N, 30.316498 E -> World: x=108.06, z=231.99
   */
  private buildGeneralStaffChariot() {
    const archGroup = new THREE.Group();
    archGroup.name = 'general-staff-arch';
    archGroup.position.set(108.06, 0.0, 231.99);

    const ochreMat = new THREE.MeshLambertMaterial({ color: PALETTE.empireYellow, flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ color: 0x3d433e, flatShading: true });

    // 1. Double Triumphal Arch Structure (bridges the two curved wings)
    // Left arch pier
    const pierL = new THREE.Mesh(new THREE.BoxGeometry(7, 24, 18), ochreMat);
    pierL.position.set(-13, 12, 0);
    pierL.castShadow = true;
    archGroup.add(pierL);

    // Right arch pier
    const pierR = new THREE.Mesh(new THREE.BoxGeometry(7, 24, 18), ochreMat);
    pierR.position.set(13, 12, 0);
    pierR.castShadow = true;
    archGroup.add(pierR);

    // Arch vaulting span over Bolshaya Morskaya Street
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(33, 8, 18), ochreMat);
    archTop.position.set(0, 24, 0);
    archTop.castShadow = true;
    archGroup.add(archTop);

    // Classical frieze and white relief statues
    const frieze = new THREE.Mesh(new THREE.BoxGeometry(31, 2.5, 18.4), trimMat);
    frieze.position.set(0, 27.5, 0);
    archGroup.add(frieze);

    // 2. Colossal Bronze Chariot of Glory (Колесница Славы)
    // 6 rearing horses led by Roman warriors, winged Nike holding laurel wreath
    const chariotBase = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 9), bronzeMat);
    chariotBase.position.set(0, 29.5, 0);
    chariotBase.castShadow = true;
    archGroup.add(chariotBase);

    // Winged Nike
    const nike = new THREE.Mesh(new THREE.BoxGeometry(3.0, 7.5, 2.5), bronzeMat);
    nike.position.set(0, 34.0, 1.5);
    nike.castShadow = true;
    archGroup.add(nike);

    // Laurel wreath
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 6, 12), bronzeMat);
    wreath.position.set(0, 38.0, 2.2);
    archGroup.add(wreath);

    // 6 Horses
    for (let h = -2.5; h <= 2.5; h += 1.0) {
      const horse = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.2, 5.0), bronzeMat);
      horse.position.set(h * 3.0, 32.2, -1.8);
      horse.castShadow = true;
      archGroup.add(horse);
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
   * Спас на Крови (Храм Воскресения Христова)
   * Exact GPS: 59.9401 N, 30.3289 E -> World: x=797.9, z=-28.3
   * 81m Central Tented Tower & 5 Enamel Onion Domes
   */
  private buildSpasNaKroviDomes() {
    const spasGroup = new THREE.Group();
    spasGroup.name = 'spas-na-krovi-ensemble';
    spasGroup.position.set(797.9, 26.0, -28.3);

    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    
    // Colorful enamel materials for onion domes
    const domeMatChevron = new THREE.MeshLambertMaterial({ color: 0x3d8c52, flatShading: true });

    // Central Octagonal Tented Roof (Шатер, 81m)
    const tentBase = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 10, 8), stoneMat);
    tentBase.position.y = 5;
    tentBase.castShadow = true;
    spasGroup.add(tentBase);

    // Tented spire with glazed tile patterns
    const tentSpire = new THREE.Mesh(new THREE.ConeGeometry(9.5, 30, 8), domeMatChevron);
    tentSpire.position.y = 25;
    tentSpire.castShadow = true;
    spasGroup.add(tentSpire);

    // Central Golden Lantern & Onion Dome
    const centLantern = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 8, 8), stoneMat);
    centLantern.position.y = 44;
    spasGroup.add(centLantern);

    const centDome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 10), goldMat);
    centDome.scale.set(1.0, 1.4, 1.0);
    centDome.position.y = 50;
    centDome.castShadow = true;
    spasGroup.add(centDome);

    const centCross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.0, 2.5), goldMat);
    centCross.position.y = 56;
    spasGroup.add(centCross);

    // 4 Corner Enamelled Onion Domes
    const domeDist = 18;
    const cornerDomes = [
      { x: -domeDist, z: -domeDist, color: 0x3ab8b8 }, // Turquoise
      { x: domeDist, z: -domeDist, color: 0x2b5496 },  // Cobalt Blue
      { x: -domeDist, z: domeDist, color: 0xb53e2d },  // Ruby Red
      { x: domeDist, z: domeDist, color: 0xe5a823 }   // Amber Gold
    ];

    for (const cd of cornerDomes) {
      const cMat = new THREE.MeshLambertMaterial({ color: cd.color, flatShading: true });
      const bTower = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.5, 14, 8), stoneMat);
      bTower.position.set(cd.x, 7, cd.z);
      bTower.castShadow = true;
      spasGroup.add(bTower);

      const oDome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 12, 10), cMat);
      oDome.scale.set(1.0, 1.35, 1.0);
      oDome.position.set(cd.x, 16, cd.z);
      oDome.castShadow = true;
      spasGroup.add(oDome);

      const cCross = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.0, 2.0), goldMat);
      cCross.position.set(cd.x, 21, cd.z);
      spasGroup.add(cCross);
    }

    this.group.add(spasGroup);
  }

  /**
   * Здание Биржи (Stock Exchange Doric Temple on Spit of Vasilyevsky Island)
   * Exact GPS: 59.9438 N, 30.3040 E -> World: x=-520, z=-440
   */
  private buildStockExchangeColonnade() {
    const bGroup = new THREE.Group();
    bGroup.name = 'stock-exchange-temple';
    bGroup.position.set(-520, 0.5, -440);

    const whiteMat = new THREE.MeshLambertMaterial({ color: PALETTE.spbWhiteStone, flatShading: true });
    const graniteMat = new THREE.MeshLambertMaterial({ color: PALETTE.graniteEmbankment, flatShading: true });

    // Massive Granite Stylobate Base (Стилобат)
    const base = new THREE.Mesh(new THREE.BoxGeometry(72, 4, 102), graniteMat);
    base.position.y = 2;
    base.castShadow = true;
    bGroup.add(base);

    // 44 Doric Columns surrounding the temple
    const colGeo = new THREE.CylinderGeometry(1.2, 1.4, 16, 8);
    // North and South Colonnades (10 columns each)
    for (let x = -30; x <= 30; x += 6.6) {
      const colN = new THREE.Mesh(colGeo, whiteMat);
      colN.position.set(x, 12, -45);
      colN.castShadow = true;
      bGroup.add(colN);

      const colS = new THREE.Mesh(colGeo, whiteMat);
      colS.position.set(x, 12, 45);
      colS.castShadow = true;
      bGroup.add(colS);
    }
    // East and West Colonnades (14 columns each)
    for (let z = -38; z <= 38; z += 6.3) {
      const colW = new THREE.Mesh(colGeo, whiteMat);
      colW.position.set(-30, 12, z);
      colW.castShadow = true;
      bGroup.add(colW);

      const colE = new THREE.Mesh(colGeo, whiteMat);
      colE.position.set(30, 12, z);
      colE.castShadow = true;
      bGroup.add(colE);
    }

    // Triangular Pediment with Neptune Group
    const pediment = new THREE.Mesh(new THREE.ConeGeometry(38, 10, 4), whiteMat);
    pediment.rotation.y = Math.PI / 4;
    pediment.position.set(0, 24, 46);
    pediment.castShadow = true;
    bGroup.add(pediment);

    this.group.add(bGroup);
  }

  /**
   * Казанский собор (Kazan Cathedral Colonnade & Dome)
   * Exact GPS: 59.9344 N, 30.3245 E -> World: x=565.6, z=597.2
   */
  private buildKazanCathedralColonnade() {
    const kazanGroup = new THREE.Group();
    kazanGroup.name = 'kazan-cathedral-ensemble';
    kazanGroup.position.set(565.6, 26.0, 597.2);

    const stoneMat = new THREE.MeshLambertMaterial({ color: PALETTE.empireStone, flatShading: true });
    const greenMat = new THREE.MeshLambertMaterial({ color: 0x4a7c5c, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: PALETTE.goldDome, flatShading: true });

    // Drum
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 12, 24), stoneMat);
    drum.position.y = 6;
    drum.castShadow = true;
    kazanGroup.add(drum);

    // Green Malachite Central Dome (71.6m)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), greenMat);
    dome.position.y = 12;
    dome.scale.set(1.0, 1.35, 1.0);
    dome.castShadow = true;
    kazanGroup.add(dome);

    // Gilded Lantern & Cross
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 8, 12), goldMat);
    lantern.position.y = 31;
    kazanGroup.add(lantern);

    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6.0, 3.0), goldMat);
    cross.position.y = 38;
    cross.castShadow = true;
    kazanGroup.add(cross);

    // Grand Semi-Circular Colonnade (96 Pudozh Stone Columns)
    const colRadius = 55;
    const numCols = 32;
    const colGeo = new THREE.CylinderGeometry(0.95, 1.1, 14, 8);

    for (let row = 0; row < 3; row++) {
      const r = colRadius + row * 4.2;
      for (let i = 0; i <= numCols; i++) {
        const ang = -Math.PI * 0.8 + (i / numCols) * (Math.PI * 0.6);
        const cx = Math.cos(ang) * r;
        const cz = Math.sin(ang) * r;

        const col = new THREE.Mesh(colGeo, stoneMat);
        col.position.set(cx, -17, cz);
        col.castShadow = true;
        kazanGroup.add(col);
      }
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

  public update(deltaTime: number, nightFactor: number) {
    this.totalTime += deltaTime;

    // Pulse red aviation warning beacons (1.2 Hz flash)
    const flash = Math.sin(this.totalTime * 4.5) > 0.2 ? 1.0 : 0.15;
    this.beaconMat.opacity = flash;

    // Turn on warm amber street lamps at dusk / night
    const lampGlow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.12) * 2.8));
    this.streetLampsMat.opacity = lampGlow;

    // Floodlights on iconic spires and domes (Admiralty, St. Isaac's, Peter & Paul)
    const floodlightGlow = Math.min(1.0, Math.max(0.0, (nightFactor - 0.15) * 2.4));
    this.floodlightMat.opacity = floodlightGlow * 0.75;

    // Flaming torches on Rostral columns with organic flame flicker
    if (nightFactor > 0.2) {
      const flicker = 0.75 + Math.sin(this.totalTime * 14.0) * 0.25;
      this.rostralFlameMat.opacity = Math.min(1.0, (nightFactor - 0.2) * 2.5) * flicker;
    } else {
      this.rostralFlameMat.opacity = 0.0;
    }
  }
}
