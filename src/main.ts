import * as THREE from 'three';
import { CameraController } from './camera';
import { SunSystem } from './sun';
import { WaterSystem } from './water';
import { BridgeSystem } from './bridges';
import { TransitSystem } from './transit';
import { WeatherSystem } from './weather';
import { FlightSimulator } from './flight';
import { LandmarksSystem } from './landmarks';
import { GroundSystem } from './ground';
import { TreeSystem } from './trees';
import { RealBuildingsSystem } from './real_buildings';
import { RailwaySystem } from './railways';
import { UIManager } from './ui';

class SaintPIzoApp {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraCtrl: CameraController;
  public sun: SunSystem;
  public water: WaterSystem;
  public bridges: BridgeSystem;
  public transit: TransitSystem;
  public weather: WeatherSystem;
  public flight: FlightSimulator;
  public landmarks: LandmarksSystem;
  public ground: GroundSystem;
  public trees: TreeSystem;
  public realBuildings: RealBuildingsSystem;
  public railways: RailwaySystem;
  public ui: UIManager;
  private lastTime: number = 0;
  private pixelScale: number = 1; // Fine mini-pixel density for crisp isometric pixel art

  constructor() {
    const container = document.getElementById('canvas-container')!;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.cameraCtrl = new CameraController(window.innerWidth, window.innerHeight);

    // 3. Renderer with Pixel Art Downscaling
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.updateRendererSize();
    container.appendChild(this.renderer.domElement);

    // 4. Systems
    this.sun = new SunSystem(this.scene);
    this.ground = new GroundSystem(this.scene);
    this.railways = new RailwaySystem(this.scene);
    this.trees = new TreeSystem(this.scene);
    this.water = new WaterSystem(this.scene);
    this.realBuildings = new RealBuildingsSystem(this.scene);
    this.bridges = new BridgeSystem(this.scene);
    this.transit = new TransitSystem(this.scene);
    this.weather = new WeatherSystem(this.scene);
    this.flight = new FlightSimulator(this.scene);
    this.landmarks = new LandmarksSystem(this.scene);

    // 5. UI
    this.ui = new UIManager(
      this.sun,
      this.bridges,
      this.water,
      this.weather,
      this.flight,
      this.cameraCtrl,
      this.landmarks
    );

    // 6. Listeners & Loop
    (window as any).app = this;
    window.addEventListener('resize', () => this.onResize());
    (window as any).spbApp = this;
    this.animate(0);
  }

  private updateRendererSize() {
    const w = Math.floor(window.innerWidth / this.pixelScale);
    const h = Math.floor(window.innerHeight / this.pixelScale);
    this.renderer.setSize(w, h, false);
  }

  private onResize() {
    this.updateRendererSize();
    this.cameraCtrl.resize(window.innerWidth, window.innerHeight);
  }

  private animate = (time: number) => {
    requestAnimationFrame(this.animate);

    const deltaTime = Math.min(0.1, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    // 1. Update Sun & Time
    const sunState = this.sun.update(this.cameraCtrl.currentTarget);
    this.scene.background = sunState.skyColor;

    // 2. Update Water, Buildings & Landmarks
    // 3. Update Environment, Water, Windows & Landmarks
    const curHour = this.sun.getEffectiveDate().getHours() + this.sun.getEffectiveDate().getMinutes() / 60;
    this.water.update(deltaTime, sunState.nightFactor);
    this.realBuildings.update(sunState.nightFactor);
    this.landmarks.update(deltaTime, sunState.nightFactor, curHour);

    // 4. Update Bridges (with automatic St. Petersburg bridge schedule)
    this.bridges.update(deltaTime, curHour, sunState.nightFactor);

    // 5. Update Public Transit (Cars, Trams, Meteor, Boats, Streetlamps)
    this.transit.update(deltaTime, this.bridges.areOpen, sunState.nightFactor);

    // 6. Update Flight Simulator Physics
    this.flight.update(deltaTime);

    // 6. Update Camera & Dynamic Ground Tracking
    this.cameraCtrl.update(deltaTime, this.flight);
    this.ground.update(this.cameraCtrl.currentTarget);

    // 7. Update Weather
    this.weather.update(deltaTime, sunState.skyColor, this.cameraCtrl.camera.position);

    // 8. Update UI (3D screen-projected landmark pins and district HUD)
    this.ui.update();

    // 9. Render Frame
    this.renderer.render(this.scene, this.cameraCtrl.camera);
  };
}

// Start application
window.addEventListener('DOMContentLoaded', () => {
  new SaintPIzoApp();
});
