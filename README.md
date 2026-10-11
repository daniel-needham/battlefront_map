# Orbital

A browser prototype of a destination loading sequence: rotating Earth, target acquisition, orbital descent, and staged 2D satellite zooms. Built with vanilla JavaScript, a small WebGL orthographic globe renderer, and MapLibre GL JS. No Google APIs, API keys, build step, or package installation required.

## Run

Use Node 20 or newer. From this directory, run `npm run dev`, then open http://127.0.0.1:4173. `dist/` can also be served by any static HTTP server. Do not open index.html directly as a file, because ES modules need HTTP.

Enter decimal latitude and longitude and press Go. The satellite map's Mercator projection supports latitudes between −85.05° and +85.05°. Address search is reserved for the next iteration. Optional URL parameters: `?lat=-33.8688&lon=151.2093`.

The interface is intentionally minimal: globe, coordinate field, and Go. Cancel appears during the sequence; Back to globe appears on arrival. The completed map supports pan and zoom. Reduced-motion preferences bypass the camera sequence. Tile failures return to the globe with a retry message. Tiles are requested from EOX on demand, so the satellite sequence needs an internet connection.

## Imagery and attribution

- Globe: NASA Goddard Space Flight Center / NASA Earth Observatory. Reto Stöckli (land surface, shallow water, clouds), Robert Simmon (ocean color and compositing). This is the original Blue Marble **Land Surface, Ocean Color, Sea Ice, and Clouds** composite, replacing the initially selected snowy January 2004 base map.
- Local asset `dist/assets/blue-marble.jpg`: https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/land_ocean_ice_cloud_2048.jpg
- Source and credit: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/
- NASA use guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/
- The globe uses the global equirectangular image bounds (longitude −180° to 180°, latitude 90° to −90°); the JPEG itself has no GeoTIFF metadata. Its projection and the HUD use the same coordinate basis. This is a composite, not live weather.
- Satellite: Sentinel-2 cloudless 2024 by EOX IT Services GmbH. Contains modified Copernicus Sentinel data (2024). Licensed CC BY-NC-SA 4.0; this prototype is for non-commercial use. Keep attribution and license links visible. Commercial use needs appropriate imagery rights.
- Tile endpoint: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg`
- Service: https://maps.eox.at/ · imagery: https://cloudless.eox.at/ · license: https://creativecommons.org/licenses/by-nc-sa/4.0/
- EOX imagery is roughly 10 m/pixel. The final zoom is 13, with optional exploration up to 14. It is suitable for landscapes and neighbourhoods, rather than house-level close-ups. Public EOX services are rate limited and have no availability guarantee.
- MapLibre GL JS 5.15.0 is bundled locally. Its BSD license and bundled dependency notices are in `dist/vendor/MAPLIBRE-LICENSE.txt`.

`npm run assets` refreshes the NASA and MapLibre assets. `npm test` checks coordinate validation, orthographic targeting, dateline rotation, and tile bounds.

## Structure

- `dist/app.js`: input, sequence timing, tile preloading, and map transitions.
- `dist/globe.js`: Earth shader and target overlay.
- `dist/geo.js`: coordinate parsing and projection math.
- `dist/styles.css`: minimal globe and input layout.
- `scripts/serve.mjs`: dependency-free local preview server.
