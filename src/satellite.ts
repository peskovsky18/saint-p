import * as THREE from 'three';
import { latLonToMeters } from './geo';

export interface SatelliteMeta {
  zoom: number;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  bounds: {
    north: number;
    south: number;
    west: number;
    east: number;
  };
}

export class SatelliteGround {
  public mesh: THREE.Mesh | null = null;
  public group: THREE.Group;
  public texture: THREE.CanvasTexture | null = null;
  public bounds: { nw: { x: number; z: number }; se: { x: number; z: number } } | null = null;
  public onLoadedCallbacks: ((tex: THREE.CanvasTexture, bounds: { nw: { x: number; z: number }; se: { x: number; z: number } }) => void)[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'satellite-ground';
    scene.add(this.group);

    this.loadSatelliteOrthophoto();
  }

  public onReady(cb: (tex: THREE.CanvasTexture, bounds: { nw: { x: number; z: number }; se: { x: number; z: number } }) => void) {
    if (this.texture && this.bounds) {
      cb(this.texture, this.bounds);
    } else {
      this.onLoadedCallbacks.push(cb);
    }
  }

  private async loadSatelliteOrthophoto() {
    try {
      const res = await fetch('./data/satellite/meta.json');
      const meta: SatelliteMeta = await res.json();

      const tilesX = meta.x_max - meta.x_min + 1;
      const tilesY = meta.y_max - meta.y_min + 1;
      const tileSize = 256;

      const canvas = document.createElement('canvas');
      canvas.width = tilesX * tileSize;
      canvas.height = tilesY * tileSize;
      const ctx = canvas.getContext('2d')!;

      // Fill with base St. Petersburg palette color while loading
      ctx.fillStyle = '#4a535c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Metric coordinates of the bounding box
      const nw = latLonToMeters(meta.bounds.north, meta.bounds.west);
      const se = latLonToMeters(meta.bounds.south, meta.bounds.east);

      const widthMeters = se.x - nw.x;
      const depthMeters = se.z - nw.z;
      const centerX = (nw.x + se.x) / 2;
      const centerZ = (nw.z + se.z) / 2;

      // Create texture
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.LinearMipMapLinearFilter;
      texture.generateMipmaps = true;

      this.texture = texture;
      this.bounds = { nw, se };

      // Plane geometry matching the exact geographic bounds
      const geo = new THREE.PlaneGeometry(widthMeters, depthMeters);
      geo.rotateX(-Math.PI / 2);

      const mat = new THREE.MeshLambertMaterial({
        map: texture,
        flatShading: true
      });

      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.position.set(centerX, 0.05, centerZ);
      this.mesh.receiveShadow = true;
      this.group.add(this.mesh);

      // Load all 49 tiles in parallel and draw to canvas
      const tilePromises: Promise<void>[] = [];

      for (let x = meta.x_min; x <= meta.x_max; x++) {
        for (let y = meta.y_min; y <= meta.y_max; y++) {
          const col = x - meta.x_min;
          const row = y - meta.y_min;
          const tileUrl = `./data/satellite/${meta.zoom}_${x}_${y}.jpg`;

          const p = new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              ctx.drawImage(img, col * tileSize, row * tileSize, tileSize, tileSize);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = tileUrl;
          });

          tilePromises.push(p);
        }
      }

      await Promise.all(tilePromises);
      texture.needsUpdate = true;

      for (const cb of this.onLoadedCallbacks) {
        cb(this.texture, this.bounds!);
      }
      this.onLoadedCallbacks = [];
      console.log('Real Satellite Orthophoto Ground Map loaded successfully.');
    } catch (e) {
      console.warn('Satellite ground load warning:', e);
    }
  }
}
