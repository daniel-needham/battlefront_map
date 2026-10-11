export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const radians = degrees => degrees * Math.PI / 180;
export const wrapLongitude = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
export const shortestLongitude = (from, to) => wrapLongitude(to - from);
export function parseCoordinates(value) {
  const parts = value.trim().split(/[,;\s]+/).filter(Boolean);
  if (parts.length !== 2 || parts.some(v => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v))) throw new Error('Enter latitude and longitude, for example 51.5074, -0.1278.');
  const [lat, lon] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Latitude must be −90 to 90; longitude must be −180 to 180.');
  if (Math.abs(lat) > 85.05112878) throw new Error('The satellite map covers latitudes up to 85.05° north or south. Choose a point within that range.');
  return {lat, lon};
}
export function formatCoordinates({lat, lon}) { return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? 'S' : 'N'}  ·  ${Math.abs(lon).toFixed(4)}° ${lon < 0 ? 'W' : 'E'}`; }
// Orthographic projection uses the same camera basis as the globe shader.
export function projectOnGlobe(point, camera) {
  const lat = radians(point.lat), delta = radians(point.lon - camera.lon), c = radians(camera.lat);
  return { x: Math.cos(lat) * Math.sin(delta), y: Math.sin(lat) * Math.cos(c) - Math.cos(lat) * Math.cos(delta) * Math.sin(c), visible: Math.sin(lat) * Math.sin(c) + Math.cos(lat) * Math.cos(delta) * Math.cos(c) > 0 };
}
export function tileCoordinates(lat, lon, zoom) {
  const size = 2 ** zoom;
  return {x: clamp(Math.floor((lon + 180) / 360 * size), 0, size - 1), y: clamp(Math.floor((1 - Math.asinh(Math.tan(radians(lat))) / Math.PI) / 2 * size), 0, size - 1)};
}
