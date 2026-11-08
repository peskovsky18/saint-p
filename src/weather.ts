import * as THREE from 'three';
import { SPB_ORIGIN } from './geo';

export interface WeatherData {
  temperature: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  cloudCover: number;
  weatherCode: number;
  windSpeed: number;
  description: string;
}

export class WeatherSystem {
  public data: WeatherData | null = null;
  public rainParticles: THREE.Points | null = null;
  public snowParticles: THREE.Points | null = null;
  public fog: THREE.FogExp2;
  public isRaining: boolean = false;
  public isSnowing: boolean = false;

  private rainGeo!: THREE.BufferGeometry;
  private snowGeo!: THREE.BufferGeometry;
  private rainCount = 1800;
  private snowCount = 1200;

  constructor(scene: THREE.Scene) {
    this.fog = new THREE.FogExp2(0x8ec2f8, 0.00015);
    scene.fog = this.fog;

    this.initRain(scene);
    this.initSnow(scene);

    // Default to bright, joyful, sunny Saint Petersburg
    this.data = {
      temperature: 22,
      precipitation: 0,
      rain: 0,
      snowfall: 0,
      cloudCover: 0,
      weatherCode: 0,
      windSpeed: 2.5,
      description: 'Ясно, солнечно'
    };
    this.applyWeather(this.data);
  }

  private initRain(scene: THREE.Scene) {
    this.rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.rainCount * 3);

    for (let i = 0; i < this.rainCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 1200;
      positions[i * 3 + 1] = Math.random() * 250;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;
    }

    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x9fbcd4,
      size: 2.2,
      transparent: true,
      opacity: 0.75,
      blending: THREE.NormalBlending
    });

    this.rainParticles = new THREE.Points(this.rainGeo, rainMat);
    this.rainParticles.visible = false;
    scene.add(this.rainParticles);
  }

  private initSnow(scene: THREE.Scene) {
    this.snowGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.snowCount * 3);

    for (let i = 0; i < this.snowCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 1200;
      positions[i * 3 + 1] = Math.random() * 250;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;
    }

    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.2,
      transparent: true,
      opacity: 0.75
    });

    this.snowParticles = new THREE.Points(this.snowGeo, snowMat);
    this.snowParticles.visible = false;
    scene.add(this.snowParticles);
  }

  public async fetchLiveWeather(): Promise<WeatherData | null> {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${SPB_ORIGIN.lat}&longitude=${SPB_ORIGIN.lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m`;
      const res = await fetch(url);
      const json = await res.json();
      const cur = json.current;

      const code = cur.weather_code;
      let desc = 'Ясно';
      if (code >= 1 && code <= 3) desc = 'Переменная облачность';
      else if (code >= 45 && code <= 48) desc = 'Туман над Невой';
      else if (code >= 51 && code <= 67) desc = 'Питерский дождь';
      else if (code >= 71 && code <= 77) desc = 'Снегопад';
      else if (code >= 80 && code <= 82) desc = 'Ливень';
      else if (code >= 95) desc = 'Гроза';

      this.data = {
        temperature: Math.round(cur.temperature_2m * 10) / 10,
        precipitation: cur.precipitation,
        rain: cur.rain,
        snowfall: cur.snowfall,
        cloudCover: cur.cloud_cover,
        weatherCode: cur.weather_code,
        windSpeed: Math.round(cur.wind_speed_10m * 10) / 10,
        description: desc
      };

      this.applyWeather(this.data);
      return this.data;
    } catch (err) {
      console.warn('Weather fetch fallback:', err);
      // Fallback default Saint Petersburg atmospheric overcast
      this.data = {
        temperature: 12,
        precipitation: 0.2,
        rain: 0.2,
        snowfall: 0,
        cloudCover: 75,
        weatherCode: 51,
        windSpeed: 4.5,
        description: 'Легкий дождь, облачно'
      };
      this.applyWeather(this.data);
      return this.data;
    }
  }

  public applyWeather(w: WeatherData) {
    this.isRaining = w.rain > 0.05 || (w.weatherCode >= 51 && w.weatherCode <= 67) || w.weatherCode >= 80;
    this.isSnowing = w.snowfall > 0 || (w.weatherCode >= 71 && w.weatherCode <= 77);

    if (this.rainParticles) this.rainParticles.visible = this.isRaining;
    if (this.snowParticles) this.snowParticles.visible = this.isSnowing;

    // Adjust fog density based on weather
    if (w.weatherCode >= 45 && w.weatherCode <= 48) {
      this.fog.density = 0.0018; // Heavy mist/fog
    } else if (this.isRaining || this.isSnowing) {
      this.fog.density = 0.0007;
    } else {
      this.fog.density = 0.00015;
      this.fog.color.setHex(0x8ec2f8);
    }
  }

  public setManualWeather(type: 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'live') {
    if (type === 'live') {
      this.fetchLiveWeather();
      return;
    }
    if (type === 'clear') {
      this.isRaining = false;
      this.isSnowing = false;
      this.fog.density = 0.00015;
      this.fog.color.setHex(0x8ec2f8);
    } else if (type === 'rain') {
      this.isRaining = true;
      this.isSnowing = false;
      this.fog.density = 0.0007;
    } else if (type === 'snow') {
      this.isRaining = false;
      this.isSnowing = true;
      this.fog.density = 0.0009;
    } else if (type === 'fog') {
      this.isRaining = false;
      this.isSnowing = false;
      this.fog.density = 0.0022;
    } else if (type === 'storm') {
      this.isRaining = true;
      this.isSnowing = false;
      this.fog.density = 0.0012;
    }
    if (this.rainParticles) this.rainParticles.visible = this.isRaining;
    if (this.snowParticles) this.snowParticles.visible = this.isSnowing;
  }

  public toggleRain(force?: boolean) {
    this.isRaining = force !== undefined ? force : !this.isRaining;
    if (this.isRaining) this.isSnowing = false;
    if (this.rainParticles) this.rainParticles.visible = this.isRaining;
    if (this.snowParticles) this.snowParticles.visible = this.isSnowing;
  }

  public toggleSnow(force?: boolean) {
    this.isSnowing = force !== undefined ? force : !this.isSnowing;
    if (this.isSnowing) this.isRaining = false;
    if (this.rainParticles) this.rainParticles.visible = this.isRaining;
    if (this.snowParticles) this.snowParticles.visible = this.isSnowing;
  }

  public update(deltaTime: number, skyColor: THREE.Color, cameraPos: THREE.Vector3) {
    this.fog.color.copy(skyColor);

    // Animate Rain
    if (this.isRaining && this.rainParticles) {
      const posAttr = this.rainGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speed = 280 * deltaTime;

      for (let i = 0; i < this.rainCount; i++) {
        let y = arr[i * 3 + 1] - speed;
        if (y < 0) {
          y = 200 + Math.random() * 50;
          arr[i * 3 + 0] = cameraPos.x + (Math.random() - 0.5) * 900;
          arr[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 900;
        }
        arr[i * 3 + 1] = y;
      }
      posAttr.needsUpdate = true;
    }

    // Animate Snow
    if (this.isSnowing && this.snowParticles) {
      const posAttr = this.snowGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const speed = 40 * deltaTime;

      for (let i = 0; i < this.snowCount; i++) {
        let y = arr[i * 3 + 1] - speed;
        let x = arr[i * 3 + 0] + Math.sin(y * 0.05 + i) * 0.4;
        if (y < 0) {
          y = 200 + Math.random() * 50;
          x = cameraPos.x + (Math.random() - 0.5) * 900;
          arr[i * 3 + 2] = cameraPos.z + (Math.random() - 0.5) * 900;
        }
        arr[i * 3 + 0] = x;
        arr[i * 3 + 1] = y;
      }
      posAttr.needsUpdate = true;
    }
  }
}
