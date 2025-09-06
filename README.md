# Simple Pong Game

A lightweight, installable Pong built with HTML5 Canvas, vanilla JS, and a PWA service worker. Play in the browser or add to your home screen.

## Features
- Single-player vs AI with 3 difficulties (Easy, Normal, Hard)
- Scoreboard and win screen (first to 7 wins)
- Tap/click to start; pointer/touch controls on mobile
- Sound effects with a mute toggle
- PWA: offline support, installable, maskable icons
- Mobile-responsive canvas sizing

## Controls
- Move paddle: drag on the canvas (touch) or move the mouse
- Start/Pause rounds: tap/click the canvas (after score)
- UI controls: difficulty select and mute toggle above the canvas

## Development
- Files live in this folder:
  - `index.html`, `style.css`, `pong.js`
  - `sw.js`, `manifest.webmanifest`
  - `icons/` (SVG sources; PNGs generated in CI)
  - `scripts/gen-icons.js` (icon generator)
- Run locally by opening `index.html` in a browser.
  - Note: service worker registration works from file:// in some browsers but is best tested via a local server.

## Icons
- SVG sources: `icons/icon.svg` (any), `icons/icon-maskable.svg` (maskable)
- CI generates PNG sizes: 192, 256, 384, 512 (maskable and non-maskable) and `icon-180.png` for Apple touch.
- Update the SVGs and push; CI regenerates PNGs automatically.

## PWA
- Offline caching handled by `sw.js` (pre-caches core assets)
- Manifest: `manifest.webmanifest` with maskable and standard icons

## GitHub Pages
- This repo deploys via GitHub Actions on pushes to `main`.
- Workflow: `.github/workflows/pages.yml`
- In GitHub Settings → Pages, set Source to GitHub Actions.
- Your site URL will be `https://<username>.github.io/<repo>/`.

## CI Linting
- ESLint runs in CI (Node 20) with a basic recommended config.
- Scripts:
  - `npm run gen:icons` – generate PNGs from SVGs
  - `npm run lint` – lint `*.js` files

## License
Personal or educational use. No warranty.
