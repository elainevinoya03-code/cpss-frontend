// src/utils/geoUtils.ts

// The standard mapping bounds for our legacy SVG coordinates -> Real WGS84 GPS.
// We map the 440x400 SVG box to the real geographic bounds of Tandang Sora.
// SVG X: 0 to 440
// SVG Y: 0 to 400

const CENTER_LAT = 14.6681;
const CENTER_LNG = 121.0567;

// Approximate bounds of the barangay matching the visual aspect ratio
const MIN_LAT = 14.6600;
const MAX_LAT = 14.6765;
const MIN_LNG = 121.0475;
const MAX_LNG = 121.0659;

export const MAP_CENTER: [number, number] = [CENTER_LAT, CENTER_LNG];

/**
 * Convert legacy (x, y) coordinates from the 440x400 SVG space into real WGS84 GPS coordinates.
 * In legacy SVG, X was often mapped to "lat" and Y to "lng" in the code, but they were pixel coordinates.
 * If the input is already a real WGS84 coordinate (e.g. lat ~ 14.6, lng ~ 121.0), returns it as is.
 */
export function toGeoPoint(lat: number, lng: number): [number, number] {
  // If it's already a real coordinate in the Philippines
  if (lat > 5 && lat < 25 && lng > 115 && lng < 127) {
    return [lat, lng];
  }

  // Treat input as SVG pixel coordinates (lat=x, lng=y)
  // X (0 to 440) -> Longitude (MIN_LNG to MAX_LNG)
  // Y (0 to 400) -> Latitude (MAX_LAT to MIN_LAT) - Y goes down, Lat goes up
  const x = lat;
  const y = lng;

  const geoLng = MIN_LNG + (x / 440) * (MAX_LNG - MIN_LNG);
  const geoLat = MAX_LAT - (y / 400) * (MAX_LAT - MIN_LAT);

  return [geoLat, geoLng];
}

/**
 * Calculate distance in meters between two [lat, lng] points using the Haversine formula.
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Parse an SVG path string (M... L... Z) and convert its points into an array of WGS84 [lat, lng] coordinates.
 */
export function purokZoneToGeo(svgPath: string): [number, number][] {
  // Extract coordinate pairs e.g. "M60,40" or "L160,35" -> "60,40", "160,35"
  const pointsStr = svgPath.match(/[\d.]+,[\d.]+/g) || [];
  return pointsStr.map((pt) => {
    const [x, y] = pt.split(",").map(Number);
    return toGeoPoint(x, y);
  });
}
