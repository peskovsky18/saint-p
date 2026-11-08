/**
 * Saint Petersburg Geospatial coordinate projection
 * Converts WGS84 Lat/Lon to local 3D world meters centered at Palace Square (Дворцовая площадь).
 */

export const SPB_ORIGIN = {
  lat: 59.939832,
  lon: 30.314560,
  name: 'Дворцовая площадь'
};

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6378137.0; // WGS84 equatorial radius in meters
const LAT_RAD = SPB_ORIGIN.lat * DEG_TO_RAD;
const METERS_PER_DEG_LAT = (EARTH_RADIUS * Math.PI) / 180;
const METERS_PER_DEG_LON = METERS_PER_DEG_LAT * Math.cos(LAT_RAD);

export interface Point2D {
  x: number;
  z: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Converts GPS Coordinates to 3D world coordinates (meters)
 * +X is East, -X is West
 * -Z is North, +Z is South
 */
export function latLonToMeters(lat: number, lon: number): Point2D {
  const x = (lon - SPB_ORIGIN.lon) * METERS_PER_DEG_LON;
  const z = -(lat - SPB_ORIGIN.lat) * METERS_PER_DEG_LAT;
  return { x, z };
}

/**
 * Converts 3D world meters back to GPS coordinates
 */
export function metersToLatLon(x: number, z: number): LatLon {
  const lon = SPB_ORIGIN.lon + x / METERS_PER_DEG_LON;
  const lat = SPB_ORIGIN.lat - z / METERS_PER_DEG_LAT;
  return { lat, lon };
}
