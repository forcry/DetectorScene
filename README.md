# Scene Detector
On-device object detection + tracking from the phone camera. Static site, no backend. MediaPipe Tasks Vision (WASM) + EfficientDet-Lite0 (COCO, 80 classes).

## Setup (once)
    npm run fetch      # downloads runtime + model into vendor/ and models/ (Node 18+, needs internet)
    npm run verify     # confirms every referenced file exists and is precached
The app itself needs no Node; Node is only for the download script and the optional dev server.

## Local dev
    npm run dev        # http://localhost:8080 (localhost counts as secure for the camera; service worker is skipped here)

## Deploy (GitHub Pages)
1. Run `npm run fetch`, then commit everything including `vendor/` and `models/` (~15 MB).
2. Push to GitHub, then Settings > Pages > Deploy from branch > `main` / root.
3. Open `https://<user>.github.io/<repo>/` on the phone in Chrome. HTTPS is provided. Any static HTTPS host (Netlify, Cloudflare Pages) works the same: upload the folder as-is.
All paths are relative, so subpath hosting works.

## Offline caching
`sw.js` precaches the shell, runtime and model on first online visit, then serves cache-first. **Bump `VERSION` in `sw.js` on every deploy** or users keep the old files. If any precached file is missing, the service worker fails to install (the app still works online).

## HUD
Top bar: detections/s, inference ms, compute backend, tracked objects, REC time. Boxes show `CLASS #id ZONE conf%`. IDs are per class; a track shows after 2 consecutive hits and survives ~5 missed inferences.

## Performance tuning
Settings > "Detect every" (higher = cooler phone, lower detect rate; video stays smooth). Keep Compute on GPU; it falls back to CPU automatically. Raise Confidence to cut flicker. Resolution is requested at 1280x720 (`startCam` in `app.js`); lower it for older phones.

## Troubleshooting
- "Camera needs HTTPS": open the deployed https URL, not an http LAN address.
- Permission denied: Chrome > site settings > Camera > Allow.
- "Failed ... model": run `npm run fetch`, redeploy, hard-reload (or clear site data) to drop the old cache.
- Recording downloads nothing: browser lacks MediaRecorder; use Chrome.

## Model limitations
Small COCO model: misses distant/small/occluded objects, weak at night, confuses similar classes, and gives no depth or distance. Zones (LEFT/CENTER/RIGHT) are only image-position thirds.

## Privacy
All inference runs locally. No network requests after install, no analytics. Recordings are saved only to the device's downloads. Settings live in `localStorage`.

## Safety limitations
Experimental. Do not use for driving, navigation or any safety decision. Do not operate while driving. Missed detections are expected.

## Extending
Swap the model by changing `modelAssetPath` in `app.js` (and the precache list). Tracker is isolated in `tracker.js` (`npm test`-style check: `node test-tracker.mjs`). Natural next steps: size-growth for APPROACHING/STABLE, rough distance estimates, road/lane geometry.

## Device-testing checklist (Android Chrome, HTTPS)
[ ] Permission prompt appears and camera starts [ ] Back/front flip works [ ] Boxes align with objects, also after rotating the phone [ ] IDs stay stable while an object moves [ ] REC produces a playable file with boxes burned in [ ] Settings survive a reload [ ] Airplane mode: reload still works [ ] 5 minutes of use: phone stays usable (raise interval if hot)

## Motion state and distance (client-side only)
Labels look like `CAR #4 CENTER ~MID APPROACHING`.
- **State** comes from the least-squares slope of log(box area) over the last `window` measurements, i.e. relative area growth per second. It is scale-free: a big vehicle is not APPROACHING just because it is big. A change needs `confirm` agreeing measurements, respects `cooldownMs`, and uses a wider band to enter than to leave (hysteresis). Boxes touching the frame edge are skipped. A track shows no state until it has ~4 measurements.
- **Distance** `~FAR / ~MID / ~NEAR` is only the box's share of the frame area (smoothed, 10% hysteresis). It is a rough, class-blind size estimate, NOT a physical distance; a bus and a person of equal box size get the same label. No meter estimate is implemented. Turn it off in Settings.
- **Caveat:** the phone's own motion is not compensated. Driving or walking toward a scene makes static objects look APPROACHING.
- **Tuning:** Settings has the thresholds. Turn on Debug / calibration to see per box: area (px), area change since last measurement, approach score (growth/s, compare it with the threshold), distance category, confidence, and ID. Suggested loop: film something approaching and something static, note the scores, set the approach threshold just above the static jitter.
- Defaults live in `DEFAULTS` at the top of `tracker.js`. Bump `VERSION` in `sw.js` after changing any file (now `sd-v2`).
