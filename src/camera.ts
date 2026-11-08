import * as THREE from 'three';
import { FlightSimulator } from './flight';

export interface CinematicWaypoint {
  name: string;
  sub: string;
  x: number;
  z: number;
  zoom: number;
  duration: number; // in seconds
}

export const CINEMATIC_TOUR: CinematicWaypoint[] = [
  {
    name: 'Дворцовая площадь',
    sub: 'Александровская колонна и Зимний дворец',
    x: 0,
    z: 75,
    zoom: 175,
    duration: 12
  },
  {
    name: 'Главное Адмиралтейство',
    sub: 'Золоченый шпиль и Александровский сад',
    x: -330,
    z: 260,
    zoom: 160,
    duration: 12
  },
  {
    name: 'Стрелка Васильевского острова',
    sub: 'Ростральные колонны, Здание Биржи и Нева',
    x: -450,
    z: -300,
    zoom: 180,
    duration: 14
  },
  {
    name: 'Дворцовый мост и Зимний дворец',
    sub: 'Панорама Невы и скоростные «Метеоры»',
    x: -160,
    z: -120,
    zoom: 170,
    duration: 13
  },
  {
    name: 'Исаакиевский собор',
    sub: 'Исаакиевская площадь и Медный всадник',
    x: -480,
    z: 620,
    zoom: 160,
    duration: 13
  },
  {
    name: 'Спас на Крови',
    sub: 'Канал Грибоедова и Михайловский сад',
    x: 790,
    z: -25,
    zoom: 155,
    duration: 13
  },
  {
    name: 'Аничков мост и река Фонтанка',
    sub: 'Невский проспект и речные трамвайчики',
    x: 1605,
    z: 730,
    zoom: 165,
    duration: 14
  },
  {
    name: 'Площадь Восстания',
    sub: 'Московский вокзал и Лиговский проспект',
    x: 2320,
    z: 880,
    zoom: 190,
    duration: 13
  }
];

export class CameraController {
  public camera: THREE.OrthographicCamera;
  public target: THREE.Vector3;
  public currentTarget: THREE.Vector3;
  
  // Zoom settings: 35 (close-up street/facade view) to 850 (wide aerial panorama)
  public zoomLevel: number = 280;
  public targetZoomLevel: number = 280;
  public minZoom: number = 35;
  public maxZoom: number = 850;

  // Flight camera & zoom settings
  public flightZoomLevel: number = 42;
  public targetFlightZoomLevel: number = 42;
  public minFlightZoom: number = 18;
  public maxFlightZoom: number = 160;
  public flightCameraMode: 'chase' | 'wide' | 'cockpit' = 'chase';
  private wasInFlight: boolean = false;
  public flightSimRef?: FlightSimulator;

  // Rotation settings: 45°, 135°, 225°, 315°
  public yawIndex: number = 0;
  public targetYaw: number = Math.PI / 4;
  public currentYaw: number = Math.PI / 4;
  
  public isDragging: boolean = false;
  private lastMousePos = { x: 0, y: 0 };
  private aspect: number = 1;

  // Cinematic drone mode
  public isCinematic: boolean = false;
  private cinematicIndex: number = 0;
  private cinematicTimeInWaypoint: number = 0;
  public onCinematicTitleChange?: (name: string, sub: string) => void;

  constructor(width: number, height: number) {
    this.aspect = width / height;
    this.target = new THREE.Vector3(0, 0, 75); // Centered between Hermitage & Palace Square
    this.currentTarget = new THREE.Vector3(0, 0, 75);

    this.camera = new THREE.OrthographicCamera(
      -this.zoomLevel * this.aspect,
      this.zoomLevel * this.aspect,
      this.zoomLevel,
      -this.zoomLevel,
      -8000,
      18000
    );

    this.updateCameraTransform();
    this.setupEventListeners();
  }

  public resize(width: number, height: number) {
    this.aspect = width / height;
    this.camera.left = -this.zoomLevel * this.aspect;
    this.camera.right = this.zoomLevel * this.aspect;
    this.camera.top = this.zoomLevel;
    this.camera.bottom = -this.zoomLevel;
    this.camera.near = -8000;
    this.camera.far = 18000;
    this.camera.updateProjectionMatrix();
  }

  public rotateLeft() {
    this.yawIndex = (this.yawIndex + 1) % 4;
    this.targetYaw = (Math.PI / 4) + this.yawIndex * (Math.PI / 2);
  }

  public rotateRight() {
    this.yawIndex = (this.yawIndex + 3) % 4;
    this.targetYaw = (Math.PI / 4) + this.yawIndex * (Math.PI / 2);
  }

  public zoomIn(factor: number = 0.75) {
    this.targetZoomLevel = Math.max(this.minZoom, this.targetZoomLevel * factor);
  }

  public zoomOut(factor: number = 1.33) {
    this.targetZoomLevel = Math.min(this.maxZoom, this.targetZoomLevel * factor);
  }

  public setZoom(level: number) {
    this.targetZoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, level));
  }

  public resetZoom() {
    this.targetZoomLevel = 280;
    this.target.set(0, 0, 75);
  }

  /**
   * Smoothly navigates the camera to any coordinates across Saint Petersburg
   */
  public flyTo(targetX: number, targetZ: number, zoomLevel: number = 180) {
    this.target.set(targetX, 0, targetZ);
    this.targetZoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, zoomLevel));
  }

  public getZoomPercent(): number {
    // 280 is baseline 100%
    return Math.round((280 / this.zoomLevel) * 100);
  }

  public cycleFlightCamera(): string {
    if (this.flightCameraMode === 'chase') {
      this.flightCameraMode = 'wide';
      this.targetFlightZoomLevel = 85;
      return 'Панорама';
    } else if (this.flightCameraMode === 'wide') {
      this.flightCameraMode = 'cockpit';
      this.targetFlightZoomLevel = 26;
      return 'Кабина';
    } else {
      this.flightCameraMode = 'chase';
      this.targetFlightZoomLevel = 42;
      return 'Хвост';
    }
  }

  public getFlightCameraModeName(): string {
    if (this.flightCameraMode === 'chase') return 'Хвост';
    if (this.flightCameraMode === 'wide') return 'Панорама';
    return 'Кабина';
  }

  public zoomFlightIn(factor: number = 0.85) {
    this.targetFlightZoomLevel = Math.max(this.minFlightZoom, this.targetFlightZoomLevel * factor);
  }

  public zoomFlightOut(factor: number = 1.18) {
    this.targetFlightZoomLevel = Math.min(this.maxFlightZoom, this.targetFlightZoomLevel * factor);
  }

  public getFlightZoomPercent(): number {
    return Math.round((42 / this.flightZoomLevel) * 100);
  }

  public startCinematic() {
    this.isCinematic = true;
    this.cinematicTimeInWaypoint = 0;
    const curWp = CINEMATIC_TOUR[this.cinematicIndex];
    if (this.onCinematicTitleChange) {
      this.onCinematicTitleChange(curWp.name, curWp.sub);
    }
  }

  public stopCinematic() {
    if (!this.isCinematic) return;
    this.isCinematic = false;
    if (this.onCinematicTitleChange) {
      this.onCinematicTitleChange('', '');
    }
  }

  public toggleCinematic() {
    if (this.isCinematic) {
      this.stopCinematic();
    } else {
      this.startCinematic();
    }
  }

  private setupEventListeners() {
    // Pan drag
    window.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on interactive UI elements or dialogs
      if ((e.target as HTMLElement).closest('.spb-header, .spb-dock, .spb-dialog, .spb-card, .spb-tour-strip, button, input, a')) return;
      if (this.isCinematic) this.stopCinematic();
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      this.lastMousePos = { x: e.clientX, y: e.clientY };

      // Pan along isometric screen projection vectors
      const panSpeed = (this.zoomLevel * 2) / window.innerHeight;
      const forward = new THREE.Vector3(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
      const right = new THREE.Vector3(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));

      this.target.addScaledVector(right, -dx * panSpeed);
      this.target.addScaledVector(forward, dy * panSpeed * 1.25);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Smooth Mouse Wheel Zoom
    window.addEventListener('wheel', (e) => {
      // Allow scrolling inside dialogs or dropdowns without zooming
      if ((e.target as HTMLElement).closest('.spb-dialog-body, .spb-tour-scroll')) return;
      if (this.flightSimRef && this.flightSimRef.isActive) {
        const factor = e.deltaY > 0 ? 1.14 : 0.88;
        this.targetFlightZoomLevel = Math.max(this.minFlightZoom, Math.min(this.maxFlightZoom, this.targetFlightZoomLevel * factor));
        return;
      }
      if (this.isCinematic) this.stopCinematic();
      const factor = e.deltaY > 0 ? 1.12 : 0.89;
      this.targetZoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoomLevel * factor));
    }, { passive: true });

    // Touch support for mobile devices
    let touchStartDist = 0;
    window.addEventListener('touchstart', (e) => {
      if ((e.target as HTMLElement).closest('.spb-header, .spb-dock, .spb-dialog, .spb-card, .spb-tour-strip, button, input, a')) return;
      if (this.isCinematic) this.stopCinematic();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMousePos.x;
        const dy = e.touches[0].clientY - this.lastMousePos.y;
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        const panSpeed = (this.zoomLevel * 2) / window.innerHeight;
        const forward = new THREE.Vector3(-Math.sin(this.currentYaw), 0, -Math.cos(this.currentYaw));
        const right = new THREE.Vector3(Math.cos(this.currentYaw), 0, -Math.sin(this.currentYaw));

        this.target.addScaledVector(right, -dx * panSpeed);
        this.target.addScaledVector(forward, dy * panSpeed * 1.25);
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = touchStartDist / dist;
        if (this.flightSimRef && this.flightSimRef.isActive) {
          this.targetFlightZoomLevel = Math.max(this.minFlightZoom, Math.min(this.maxFlightZoom, this.targetFlightZoomLevel * factor));
        } else {
          this.targetZoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoomLevel * factor));
        }
        touchStartDist = dist;
      }
    });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  private updateCameraTransform() {
    // True isometric pitch angle: arctan(1 / sqrt(2)) ~ 35.264 degrees
    const pitch = Math.atan(1 / Math.SQRT2);
    const dist = 1200;

    const cy = dist * Math.sin(pitch);
    const horiz = dist * Math.cos(pitch);
    const cx = this.currentTarget.x + horiz * Math.sin(this.currentYaw);
    const cz = this.currentTarget.z + horiz * Math.cos(this.currentYaw);

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.currentTarget);
  }

  public update(deltaTime: number, flightSim?: FlightSimulator) {
    this.flightSimRef = flightSim;

    if (flightSim && flightSim.isActive) {
      if (this.isCinematic) this.stopCinematic();
      this.wasInFlight = true;

      // Smooth Flight Zoom
      this.flightZoomLevel += (this.targetFlightZoomLevel - this.flightZoomLevel) * Math.min(1.0, deltaTime * 12.0);
      this.camera.left = -this.flightZoomLevel * this.aspect;
      this.camera.right = this.flightZoomLevel * this.aspect;
      this.camera.top = this.flightZoomLevel;
      this.camera.bottom = -this.flightZoomLevel;
      this.camera.updateProjectionMatrix();

      // Update Camera position according to flightCameraMode
      const planePos = flightSim.position;
      const forwardDir = flightSim.getForwardDirection();

      if (this.flightCameraMode === 'cockpit') {
        // Cockpit / Pilot View directly behind windscreen looking forward
        const camPos = planePos.clone().sub(forwardDir.clone().multiplyScalar(4.5));
        camPos.y += 4.2;
        this.camera.position.copy(camPos);
        this.camera.lookAt(
          planePos.x + forwardDir.x * 60,
          planePos.y + 2.0 + forwardDir.y * 30,
          planePos.z + forwardDir.z * 60
        );
      } else if (this.flightCameraMode === 'wide') {
        // High Wide Panorama (behind and elevated)
        const followDist = this.flightZoomLevel * 2.2;
        const followHeight = this.flightZoomLevel * 1.35;
        const camPos = planePos.clone().sub(forwardDir.clone().multiplyScalar(followDist));
        camPos.y += followHeight;
        this.camera.position.copy(camPos);
        this.camera.lookAt(
          planePos.x + forwardDir.x * 20,
          planePos.y + 4.0,
          planePos.z + forwardDir.z * 20
        );
      } else {
        // Chase view (strictly behind tail & slightly above, tracking forward heading)
        const followDist = this.flightZoomLevel * 1.45;
        const followHeight = this.flightZoomLevel * 0.55;
        const camPos = planePos.clone().sub(forwardDir.clone().multiplyScalar(followDist));
        camPos.y += followHeight;
        this.camera.position.copy(camPos);
        this.camera.lookAt(
          planePos.x + forwardDir.x * 25,
          planePos.y + 3.0 + forwardDir.y * 12,
          planePos.z + forwardDir.z * 25
        );
      }

      this.currentTarget.copy(planePos);
      return;
    }

    if (this.wasInFlight) {
      this.wasInFlight = false;
      this.camera.left = -this.zoomLevel * this.aspect;
      this.camera.right = this.zoomLevel * this.aspect;
      this.camera.top = this.zoomLevel;
      this.camera.bottom = -this.zoomLevel;
      this.camera.updateProjectionMatrix();
      this.updateCameraTransform();
    }

    // Cinematic Drone Mode
    if (this.isCinematic) {
      const curWp = CINEMATIC_TOUR[this.cinematicIndex];
      const nextIdx = (this.cinematicIndex + 1) % CINEMATIC_TOUR.length;
      const nextWp = CINEMATIC_TOUR[nextIdx];

      this.cinematicTimeInWaypoint += deltaTime;
      const progress = Math.min(1.0, this.cinematicTimeInWaypoint / curWp.duration);

      // Smooth hermite ease-in-out
      const ease = progress * progress * (3 - 2 * progress);

      // Interpolate target and zoom
      this.target.x = curWp.x + (nextWp.x - curWp.x) * ease;
      this.target.z = curWp.z + (nextWp.z - curWp.z) * ease;
      this.targetZoomLevel = curWp.zoom + (nextWp.zoom - curWp.zoom) * ease;

      // Subtle slow yaw drift for cinematic depth
      this.targetYaw += deltaTime * 0.012;

      if (progress >= 1.0) {
        this.cinematicIndex = nextIdx;
        this.cinematicTimeInWaypoint = 0;
        if (this.onCinematicTitleChange) {
          this.onCinematicTitleChange(nextWp.name, nextWp.sub);
        }
      }
    }

    // Smooth Target Interpolation
    this.currentTarget.lerp(this.target, Math.min(1.0, deltaTime * (this.isCinematic ? 3.0 : 8.0)));

    // Smooth Zoom Interpolation
    if (Math.abs(this.zoomLevel - this.targetZoomLevel) > 0.1) {
      this.zoomLevel += (this.targetZoomLevel - this.zoomLevel) * Math.min(1.0, deltaTime * 12.0);
      this.resize(window.innerWidth, window.innerHeight);
    }

    // Smooth Rotation Interpolation
    if (Math.abs(this.currentYaw - this.targetYaw) > 0.001) {
      this.currentYaw += (this.targetYaw - this.currentYaw) * deltaTime * 8.0;
    }

    this.updateCameraTransform();
  }
}
