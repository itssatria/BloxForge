<p align="center">
  <img src="docs/logo.png" width="440" alt="BloxForge">
</p>

<p align="center">
  <b>Turn a flat reference image into a Roblox-ready 3D asset.</b><br>
  Gemini reads the picture, BloxForge rebuilds it in 3D, and you leave with a Blender script and a clean GLB.
</p>

<p align="center">
  <a href="https://itssatria.github.io/BloxForge/"><img alt="Live demo" src="https://img.shields.io/badge/live-demo-2ea44f?style=flat-square"></a>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r128-000000?style=flat-square&logo=three.js&logoColor=white">
  <img alt="Gemini" src="https://img.shields.io/badge/Gemini-vision-8E75B2?style=flat-square">
  <img alt="No backend" src="https://img.shields.io/badge/backend-none-4c566a?style=flat-square">
</p>

![BloxForge interface with a stylized AK-47 built from primitive parts in the 3D viewport](docs/hero.png)

---

## What it does

Most "AI makes a 3D model" tools hand you a dense, untextured blob that no Roblox game would ship. BloxForge goes the other way: it keeps assets **low-poly, hard-edged and made of primitives**, which is what actually looks good on Roblox and stays inside a sane triangle budget.

Drop in a picture of an object, a prop or a weapon. The app returns:

- a **live 3D blockout** you can orbit while it works,
- a **ready-to-run Blender Python (`bpy`) script** that rebuilds the model with proper materials,
- a **single-mesh GLB** with one material slot per color, ready to import as a `MeshPart`.

## How the pipeline works

| Step | What happens |
| --- | --- |
| **1. Read** | Gemini Vision labels the reference image as a list of parts: a name, a rectangle, a color, and whether the shape is a box, a cylinder, or a traced outline. |
| **2. Unflatten** | Every part is mapped onto a projection plane and given real depth. A traced outline is kept as a polygon and extruded, so a curved part becomes a curved solid instead of a picture standing upright. |
| **3. Weld** | Loose parts are detected as disconnected components and rigidly snapped onto the main body, so nothing floats off the model. |
| **4. Build** | The image silhouette is extruded into a body shell, the part list is written into a `bpy` script, and the same part list feeds the Three.js preview and the GLB exporter. |

Everything after the vision call is deterministic, so an imperfect read still produces a script you can hand-edit.

## Part types

A model is a flat list of three primitives. Positions are in model units on the side profile (X forward, Y across, Z up).

| Type | Fields | Use it for |
| --- | --- | --- |
| `box` | `size: [x, y, z]`, `bevel` | Slabs, receivers, rails, most hard-edged parts. |
| `cylinder` | `radius`, `depth`, `rot` | Barrels, tubes, pins, anything round in profile. |
| `polygon` | `pts: [[x, z], …]` (3 or more), `thick` | Curved, tapered or angled outlines: a banana magazine, a pistol grip, a stock. |

A `polygon` follows the outline you give it and extrudes that outline into a solid, the same trick the silhouette body uses for the whole object. `pts` is traced in order around the shape on the X/Z plane and `thick` is the depth along Y. Gemini returns `polygon_2d` in 0–1000 image space with 6–16 points; the app converts it to points and thickness for you.

Polygons are first-class everywhere downstream: the preview and GLB export build them with `ExtrudeGeometry`, the generated script builds them with `add_poly()` in `bmesh`, and loose-part detection measures them by their outline bounds. A polygon with fewer than three valid points silently falls back to a box, so a malformed read can never break the build.

## Features

**Input**
- Drag-drop or pick any PNG/JPG reference; a built-in AK-47 preset loads on first visit.
- Palette extraction with click-to-copy hex swatches, plus an eyedropper to sample straight off the image.
- Optional part hints ("curved magazine, orange muzzle tip") to steer the read.

**Geometry**
- Three primitives: `box`, `cylinder`, and `polygon` outlines extruded into solids.
- Sanitized part specs: bad numbers, colors or sizes can't break the script or the preview.
- Loose-part detection and auto-snap onto the main body.
- Silhouette body extrusion for shapes primitives alone can't describe.
- Inverted-hull cartoon outline option, bevel width control, single-mesh or multi-part output.

**Export**
- `Download .py` for Blender, including the reference-plane option for aligned comparison.
- `.glb` export built in-browser with `GLTFExporter`; one material slot per color for `MeshPart` imports.
- Live triangle counter with a Roblox-friendly target mode under 10k tris.

**Viewport**
- Orbit, zoom, pan, reset; perspective and orthographic side-by-side reference view.
- Wireframe toggle and a proportion grid overlay.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a static bundle:

```bash
npm run build    # -> dist/
npm run preview  # sanity-check the production bundle
```

Node 18+ is recommended.

### The API key

There is no backend. Each visitor pastes their own [Gemini API key](https://aistudio.google.com/apikey) into the header; it stays in that browser's `localStorage` and is sent directly to Google.

> Never hardcode a key in the source. Anything in a public build is readable by every visitor. If you want a shared key, put a small serverless proxy in front of the API and keep the key server-side.

## From image to Roblox

1. Set **Target Platform Optimization** to `Roblox Studio (< 10k tris, Single MeshPart, GLB)`.
2. Click **Generate Blender Python Script**.
3. **Download .py** and run it in Blender (Scripting > Open > Run Script). The model arrives with materials already applied.
4. Tweak the mesh, then `File > Export > glTF 2.0 (.glb)`.
5. Import the GLB into Roblox Studio and convert it to a `MeshPart`; the imported mesh keeps one material slot per color.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page markup, panels and controls. |
| `src/main.js` | App logic: canvas, Gemini calls, script builder, Three.js preview, UI wiring. |
| `src/parts.js` | Pure geometry helpers: sanitize, bounds, loose-part detection, snapping. |
| `src/exporter.js` | In-browser GLB export from the part list. |
| `src/presets.js` | Built-in AK-47 preset parts. |
| `src/style.css` | Tailwind entry plus custom styles. |
| `docs/` | Readme images. |

## Deployment

The repo ships with a GitHub Pages workflow:

- `Settings > Pages > Source` must be set to **GitHub Actions** (already configured for this repo).
- Every push to `main` runs `.github/workflows/deploy.yml`, builds with Vite and publishes `dist/`.
- `vite.config.js` uses `base: './'`, so the bundle works from a project subpath.

Any static host works the same way: build command `npm run build`, output directory `dist`.

## Blender output

The generated script is plain `bpy`: it resets the scene, builds Principled BSDF materials from the extracted palette, creates one object per part (boxes and cylinders with bevel modifiers, polygons via `add_poly()` in `bmesh`), and optionally adds an inverted-hull outline and the reference image plane. You can read it top to bottom before running it.

<p align="center">
  <img src="docs/code-panel.png" width="900" alt="Generated Blender Python script inside BloxForge">
</p>

## Notes

- The vision read is a suggestion, not a measurement; treat the first generation as a blockout.
- Hard-surface props, weapons, tools and stylized objects are the sweet spot. Polygon outlines cover the curved cases (magazines, grips, stocks); fully organic shapes are still out of scope by design.
- No license file yet: add one before reusing this code in your own project.
