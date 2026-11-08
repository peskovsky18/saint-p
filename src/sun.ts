import * as THREE from 'three';
import * as SunCalc from 'suncalc';
import { SPB_ORIGIN } from './geo';

export interface SunState {
  elevation: number; // in radians
  azimuth: number;   // in radians
  isNight: boolean;
  isWhiteNight: boolean;
  nightFactor: number; // 0.0 (day) to 1.0 (deep night)
  ambientColor: THREE.Color;
  sunColor: THREE.Color;
  skyColor: THREE.Color;
}

export class SunSystem {
  public dirLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;
  public date: Date;
  public manualTime: number | null = 13.75; // Default to bright warm sunny afternoon (13:45)
  public forceWhiteNight: boolean = false;

  constructor(scene: THREE.Scene) {
    this.date = new Date();

    // Directional Sun Light - Radiant warm sunlight
    this.dirLight = new THREE.DirectionalLight(0xfff6dc, 2.75);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 3000;
    
    // Orthographic shadow volume covering the central area tightly for maximum pixel sharpness
    const shadowSize = 750;
    this.dirLight.shadow.camera.left = -shadowSize;
    this.dirLight.shadow.camera.right = shadowSize;
    this.dirLight.shadow.camera.top = shadowSize;
    this.dirLight.shadow.camera.bottom = -shadowSize;
    this.dirLight.shadow.bias = -0.0002;
    this.dirLight.shadow.normalBias = 0.02;

    // Ambient Lighting - Radiant European sunny day lighting
    this.ambientLight = new THREE.AmbientLight(0x8eb4da, 0.70);
    this.hemiLight = new THREE.HemisphereLight(0xb8d9fc, 0x586470, 0.48);

    scene.add(this.dirLight);
    scene.add(this.dirLight.target);
    scene.add(this.ambientLight);
    scene.add(this.hemiLight);

    this.update();
  }

  public setTime(hours: number) {
    this.manualTime = hours;
    this.update();
  }

  public setRealtime() {
    this.manualTime = null;
    this.update();
  }

  public getEffectiveDate(): Date {
    const d = new Date(this.date);
    if (this.manualTime !== null) {
      const h = Math.floor(this.manualTime);
      const m = Math.floor((this.manualTime - h) * 60);
      d.setHours(h, m, 0, 0);
    }
    if (this.forceWhiteNight) {
      // Set to June 21 (Summer Solstice / peak of White Nights in St. Petersburg)
      d.setMonth(5); // June
      d.setDate(21);
    }
    return d;
  }

  public update(cameraTarget?: THREE.Vector3): SunState {
    const currentDate = this.getEffectiveDate();
    const sunPos = SunCalc.getPosition(currentDate, SPB_ORIGIN.lat, SPB_ORIGIN.lon);

    // SunCalc returns altitude and azimuth in radians
    const elevation = sunPos.altitude;
    const elevationDeg = (elevation * 180) / Math.PI;
    const azimuth = sunPos.azimuth;

    // White nights occur in St. Petersburg between May 25 and July 16
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const isSeasonWhiteNight = (month === 4 && day >= 25) || month === 5 || (month === 6 && day <= 16);
    const isWhiteNight = this.forceWhiteNight || isSeasonWhiteNight;

    // Calculate night factor (0 = bright day, 1 = dark night)
    let nightFactor = 0;
    if (elevationDeg < 0) {
      // Below horizon
      const degBelow = -elevationDeg;
      if (isWhiteNight) {
        // Never gets pitch black during white nights in SPb (max dip ~5-6 degrees)
        nightFactor = Math.min(0.55, degBelow / 6.0 * 0.55);
      } else {
        nightFactor = Math.min(1.0, degBelow / 12.0);
      }
    } else if (elevationDeg < 8.0) {
      // Golden hour / twilight transition
      nightFactor = (8.0 - elevationDeg) / 8.0 * 0.25;
    }

    const isNight = nightFactor > 0.4;

    // Optimal isometric sun elevation (38° to 52°) produces crisp 45° shadows matching Warsaw-Izo
    const renderElevation = elevationDeg > 0 ? Math.max(0.68, elevation) : Math.max(0.12, elevation);

    // Sun 3D directional coordinates relative to target
    // Three.js: +X is East, -Z is North, +Z is South, -X is West
    const dist = 700;
    const horizDist = dist * Math.cos(renderElevation);
    const sunY = Math.max(45, dist * Math.sin(renderElevation));
    const sunX = -horizDist * Math.sin(azimuth);
    const sunZ = horizDist * Math.cos(azimuth);

    if (cameraTarget) {
      this.dirLight.target.position.set(cameraTarget.x, 0, cameraTarget.z);
      this.dirLight.position.set(cameraTarget.x + sunX, sunY, cameraTarget.z + sunZ);
    } else {
      this.dirLight.position.set(sunX, sunY, sunZ);
    }

    // Compute Sky, Sun, and Ambient Colors
    const skyColor = new THREE.Color();
    const sunColor = new THREE.Color();
    const ambColor = new THREE.Color();

    if (nightFactor < 0.1) {
      // Bright Daytime - Radiant warm sunlight over Saint Petersburg
      skyColor.setHex(0x6aaef5); // Radiant Baltic summer blue sky
      sunColor.setHex(0xfff6dc); // Warm brilliant golden sunshine
      ambColor.setHex(0x8eb4da); // Sky ambient fill
      this.dirLight.intensity = 2.75;
      this.ambientLight.intensity = 0.70;
      this.hemiLight.intensity = 0.48;
    } else if (nightFactor < 0.4) {
      // Golden Hour / Sunset over the Gulf of Finland
      const t = (nightFactor - 0.1) / 0.3;
      skyColor.lerpColors(new THREE.Color(0xa3c5e8), new THREE.Color(0xf5986c), t);
      sunColor.lerpColors(new THREE.Color(0xfffae8), new THREE.Color(0xff8833), t);
      ambColor.lerpColors(new THREE.Color(0x768fa8), new THREE.Color(0x8a6272), t);
      this.dirLight.intensity = 1.8 - t * 0.7;
      this.ambientLight.intensity = 0.48;
    } else if (isWhiteNight) {
      // St. Petersburg White Night! Magical lilac, indigo and soft golden glow
      skyColor.setHex(0x383963);
      sunColor.setHex(0x7a6b99);
      ambColor.setHex(0x4a4768);
      this.dirLight.intensity = 0.6;
      this.ambientLight.intensity = 0.65;
    } else {
      // Deep Winter / Regular Night
      skyColor.setHex(0x0e1320);
      sunColor.setHex(0x283b63); // Moonlight
      ambColor.setHex(0x192133);
      this.dirLight.intensity = 0.25;
      this.ambientLight.intensity = 0.35;
    }

    this.dirLight.color.copy(sunColor);
    this.ambientLight.color.copy(ambColor);

    return {
      elevation,
      azimuth,
      isNight,
      isWhiteNight,
      nightFactor,
      ambientColor: ambColor,
      sunColor,
      skyColor
    };
  }
}
