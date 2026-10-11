# Orbital

Develop locally and publish through GitHub Pages. OpenAI Sites hosting is not used.

A browser prototype of a destination loading sequence: Earth starts facing Asia (25° N, 105° E), rotates to centre the chosen coordinates, then zooms through 2D satellite views. Four separate blue scan lines move vertically, then horizontally around the destination. Each line retains its full frame span throughout selection and the transition to the next zoom level. Their intersections define the selected region, then expand to fill the frame as the next image enlarges. Intermediate views vary the destination's position; the final satellite view always centres it. Their geographic registration keeps the entered location inside each crop. There is no centre cursor. Built with vanilla JavaScript, a small WebGL orthographic globe renderer, MapLibre GL JS, and Mediabunny for video export. No Google APIs, API keys, build step, or package installation required.

## Run

Use Node 20 or newer. From this directory, run `npm run dev`, then open http://127.0.0.1:4173. `dist/` can also be served by any static HTTP server. Do not open index.html directly as a file, because ES modules need HTTP.

Enter decimal latitude and longitude and press Go. The satellite map's Mercator projection supports latitudes between −85.05° and +85.05°. Address search is reserved for the next iteration. Optional URL parameters: `?lat=-33.8688&lon=151.2093`.

The interface is intentionally minimal: preview, coordinate field, Go, resolution, selection percentage, and Save video. **Selection** applies to every selection box, as a percentage of both the frame's width and height (1–50%, default 5%). Larger percentages use more zoom stages to reach the same final detail. Satellite zoom steps are calculated from the percentage so successive images align during expansion. Cancel appears while loading, playing, or saving; Back to globe appears on arrival and returns to Asia. The completed view is a still frame of the destination. All satellite views load before playback starts, so tile loading cannot interrupt the animation. Tile failures return to the globe with a retry message. EOX imagery needs an internet connection.

## Saving a presentation video

Choose **1920 × 1080** (default) or **1280 × 720**, set Selection, enter coordinates, and press Go. After the sequence finishes, press **Save video**. The browser downloads a silent **30 fps MP4 (H.264)**, approximately **19.1 seconds** with the default 5% selection and timings. Duration changes with the number of zoom stages. A Download MP4 link remains available if automatic downloading is blocked. If the browser cannot encode H.264, the exporter uses WebM and labels the file accordingly; use a current Chrome or Edge browser for MP4. Saving is done entirely in the browser, with no upload or external encoding service.

The render size is fixed at the chosen resolution; the 16:9 preview scales to fit the window. Controls and status messages sit outside the frame and do not appear in the video. NASA/EOX credits are included in the rendered frames. Playback and export use the same renderer, absolute-time timeline, and sampled view positions. Export generates every frame with a fixed timestamp rather than recording the browser screen, so browser timing and preview size do not change the saved resolution or frame rate. Reduced-motion preferences skip the live preview animation but the deliberately requested export contains the full sequence. Changing resolution or Selection clears the previous sequence; press Go again before saving.

After arrival, **View extent** shows the final frame's NW, NE, SE, and SW corner coordinates in latitude/longitude (WGS84 / EPSG:4326). **Download JSON** saves these coordinates alongside the destination, frame resolution, selection ratio, and zoom level. The corners come from MapLibre's `unproject` at the four frame edges when the image is captured. They describe the satellite frame used in both preview and export. The final extent is consistent for a given destination and resolution, regardless of the randomized intermediate views or selection percentage. The extent changes between output resolutions because the final zoom stays fixed at 13. The map uses [MapLibre's transform constraint callback](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/#transformconstrain) to keep the target centred near the polar boundary; areas beyond the satellite coverage appear as the background.

To change speed, edit `dist/sequence.js`: `LINE_MOVE_SECONDS` controls each axis's movement (default 1.3 seconds); `EXPAND_SECONDS` controls the enlargement (default 1.2 seconds). Higher values make movement slower. Line movements use cubic ease-out: quick at the start, then progressively slower as the rectangle forms. Lines reach the frame corners, with no corner gaps. `SELECTION_RATIO` sets the default size for all selections (0.05 of the frame's width and height), and can be overridden with the Selection control. `GLOBE_START` sets the starting globe coordinates. The `TIMING` object also controls orbit, acquisition pause, selected-region pause, pause between stages, and final hold. Reload the local page after editing; total video duration is calculated automatically.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` tests the app and publishes `dist/` on every push to `main`. It can also be run manually from Actions. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source before the first deployment. The workflow's `github-pages` environment links to the live site after deployment succeeds.

Only the static app and its bundled assets are deployed. All asset URLs are relative, so the app also works under a repository path such as `https://USERNAME.github.io/orbital/`. Satellite tiles are requested from EOX, and video encoding and downloads happen in the visitor's browser. No Node server, API key, dependency installation, or asset download is needed during deployment. GitHub Pages serves the app over HTTPS, allowing browser video encoding.

## Imagery and attribution

- Globe: NASA Goddard Space Flight Center / NASA Earth Observatory. Reto Stöckli (land surface, shallow water, clouds), Robert Simmon (ocean color and compositing). This is the original Blue Marble **Land Surface, Ocean Color, Sea Ice, and Clouds** composite, replacing the initially selected snowy January 2004 base map.
- Local asset `dist/assets/blue-marble.jpg`: https://assets.science.nasa.gov/content/dam/science/esd/eo/content-feature/bluemarble/images/land_ocean_ice_cloud_2048.jpg
- Source and credit: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/
- NASA use guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/
- The globe uses the global equirectangular image bounds (longitude −180° to 180°, latitude 90° to −90°); the JPEG itself has no GeoTIFF metadata. Its projection and the crop calculation use the same coordinate basis. This is a composite, not live weather.
- Satellite: Sentinel-2 cloudless 2024 by EOX IT Services GmbH. Contains modified Copernicus Sentinel data (2024). Licensed CC BY-NC-SA 4.0; this prototype is for non-commercial use. Keep attribution and license links visible. Commercial use needs appropriate imagery rights.
- Tile endpoint: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg`
- Service: https://maps.eox.at/ · imagery: https://cloudless.eox.at/ · license: https://creativecommons.org/licenses/by-nc-sa/4.0/
- EOX imagery is roughly 10 m/pixel. The final zoom level is 13; earlier levels are derived from the selection ratio (12.5% reproduces zoom levels 4, 7, 10, and 13). It is suitable for landscapes and neighbourhoods, rather than house-level close-ups. Public EOX services are rate limited and have no availability guarantee.
- MapLibre GL JS 5.15.0 is bundled locally. Its BSD license and bundled dependency notices are in `dist/vendor/MAPLIBRE-LICENSE.txt`.
- Mediabunny 1.61.3 is bundled locally for browser encoding and MP4/WebM muxing. Its MPL-2.0 license is in `dist/vendor/MEDIABUNNY-LICENSE.txt`; source: https://github.com/Vanilagy/mediabunny/tree/v1.61.3. Browser WebCodecs provides the encoder.

`npm run assets` refreshes the NASA, MapLibre, and Mediabunny assets. `npm test` checks coordinate validation, orthographic targeting, dateline rotation, tile bounds, crop registration, independent scan-line spans, axis order, varied target positions, aspect ratio during expansion, and timeline completion.

## Structure

- `dist/app.js`: input, map snapshots, playback, and download controls.
- `dist/sequence.js`: deterministic timing and rectangle geometry.
- `dist/scene.js`: shared fixed-resolution preview/export renderer.
- `dist/video.js`: frame-by-frame browser video encoding.
- `dist/globe.js`: Earth shader.
- `dist/geo.js`: coordinate parsing and projection math.
- `dist/styles.css`: minimal globe and input layout.
- `scripts/serve.mjs`: dependency-free local preview server.
- `.github/workflows/pages.yml`: test and deploy `dist/` to GitHub Pages.
