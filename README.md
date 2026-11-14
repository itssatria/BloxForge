# BloxForge

Turn a reference image into a Blender Python script (stylized, Roblox-ready GLB) with a live Three.js preview.
Gemini reads the image as 2D part boxes; the app converts them to 3D, snaps loose parts together,
extrudes the image silhouette as a body, and writes the `bpy` script.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
```

## Build and publish
```bash
npm run build      # outputs static files to dist/
```
Upload `dist/` to any static host:
- **Netlify / Cloudflare Pages / Vercel**: connect the repo, build command `npm run build`, output directory `dist`.
- **GitHub Pages**: push to `main`; `.github/workflows/deploy.yml` builds and deploys (set Settings > Pages > Source to "GitHub Actions").

## API key
Each visitor enters their own Gemini key in the header box. It is kept in that browser's `localStorage` and sent
directly to Google; this site has no server. Never hardcode your own key in the source: anything in a public
build can be read by visitors. If you want a shared key, put a small serverless proxy in front of the API instead.

## Structure
- `index.html` - page markup
- `src/main.js` - app logic (canvas, Gemini, script builder, Three.js preview, UI wiring)
- `src/parts.js` - pure geometry helpers (sanitize, loose-part detection and snapping)
- `src/presets.js` - built-in AK-47 preset
- `src/style.css` - Tailwind entry + custom styles
