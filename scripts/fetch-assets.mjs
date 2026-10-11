import { mkdir, writeFile } from 'node:fs/promises';
const files = [
  ['https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/land_ocean_ice_cloud_2048.jpg', 'dist/assets/blue-marble.jpg'],
  ['https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.js', 'dist/vendor/maplibre-gl.js'],
  ['https://unpkg.com/maplibre-gl@5.15.0/dist/maplibre-gl.css', 'dist/vendor/maplibre-gl.css'],
  ['https://unpkg.com/maplibre-gl@5.15.0/LICENSE.txt', 'dist/vendor/MAPLIBRE-LICENSE.txt'],
  ['https://unpkg.com/mediabunny@1.61.3/dist/bundles/mediabunny.mjs', 'dist/vendor/mediabunny.mjs'],
  ['https://unpkg.com/mediabunny@1.61.3/LICENSE', 'dist/vendor/MEDIABUNNY-LICENSE.txt'],
];
await Promise.all(files.map(async ([url, destination]) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${destination}: HTTP ${response.status}`);
  await mkdir(destination.slice(0, destination.lastIndexOf('/')), { recursive: true });
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(destination, bytes);
  console.log(`${destination}: ${bytes.length} bytes`);
}));
