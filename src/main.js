import './style.css';
import * as THREE from 'three';
import { createIcons, icons } from 'lucide';
import { DEFAULT_AK47_PARTS } from './presets.js';
import { exportGlb } from './exporter.js';
import { sanitizeParts, findLoose, fixConnectivity } from './parts.js';

const ICONS = icons;
// =========================================================================
// 1. STATE & DEFAULT PRESET DATA (Stylized AK-47 Reference)
// =========================================================================
let apiKey = ""; // Entered by the user in the header; kept in this browser's localStorage only
try { apiKey = localStorage.getItem("img2bpy_key") || ""; } catch (e) {}

const state = {
  imageBase64: null,
  imageMimeType: "image/png",
  palette: ["#189AA7", "#1D456E", "#F2741F", "#9E462C", "#162436", "#E5EEF2"],
  showGrid: false,
  eyedropperActive: false,
  currentCode: "",
  wireframeMode: false,
  partsSpec: [], xform: null, refPlane: null, silhouette: null, modelName: "" // Structured primitive list used to render live 3D blockout
};

// Pre-loaded Stylized AK-47 primitive specification (matches the user's reference image)


// =========================================================================
// 2. DOM ELEMENTS & INITIALIZATION
// =========================================================================
const refCanvas = document.getElementById("refCanvas");
const refCtx = refCanvas.getContext("2d", { willReadFrequently: true });
let loadedImageObj = null;

function showToast(message, isError = false) {
  const banner = document.getElementById("toastBanner");
  const text = document.getElementById("toastText");
  const icon = document.getElementById("toastIcon");
  text.textContent = message;
  icon.innerHTML = isError
    ? `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400"></i>`
    : `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>`;
  createIcons({ icons: ICONS });
  banner.classList.remove("hidden");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => banner.classList.add("hidden"), isError ? 6500 : 3200);
}

// =========================================================================
// 3. CANVAS DRAWING, PRESET ILLUSTRATION & COLOR QUANTIZATION
// =========================================================================
function drawAk47PresetToCanvas() {
  // Draw a crisp stylized AK-47 vector illustration onto the canvas as the built-in preset
  const w = 800, h = 450;
  refCanvas.width = w;
  refCanvas.height = h;
  refCtx.fillStyle = "#F4F6F9";
  refCtx.fillRect(0, 0, w, h);

  refCtx.save();
  refCtx.lineWidth = 4;
  refCtx.strokeStyle = "#162436";
  refCtx.lineJoin = "round";

  // Buttstock
  refCtx.fillStyle = "#9E462C";
  refCtx.beginPath();
  refCtx.moveTo(60, 175);
  refCtx.lineTo(240, 175);
  refCtx.lineTo(240, 225);
  refCtx.lineTo(75, 275);
  refCtx.quadraticCurveTo(55, 275, 55, 240);
  refCtx.closePath();
  refCtx.fill();
  refCtx.stroke();

  // Pistol Grip
  refCtx.beginPath();
  refCtx.moveTo(255, 225);
  refCtx.lineTo(300, 225);
  refCtx.lineTo(280, 315);
  refCtx.lineTo(235, 305);
  refCtx.closePath();
  refCtx.fill();
  refCtx.stroke();

  // Curved Magazine
  refCtx.fillStyle = "#189AA7";
  refCtx.beginPath();
  refCtx.moveTo(365, 225);
  refCtx.lineTo(430, 225);
  refCtx.quadraticCurveTo(445, 305, 495, 345);
  refCtx.lineTo(460, 370);
  refCtx.quadraticCurveTo(395, 315, 365, 225);
  refCtx.fill();
  refCtx.stroke();

  // Magazine Orange Stripe
  refCtx.strokeStyle = "#F2741F";
  refCtx.lineWidth = 8;
  refCtx.beginPath();
  refCtx.moveTo(395, 238);
  refCtx.quadraticCurveTo(412, 295, 458, 338);
  refCtx.stroke();

  // Receiver & Dust Cover
  refCtx.lineWidth = 4;
  refCtx.strokeStyle = "#162436";
  refCtx.fillStyle = "#189AA7";
  refCtx.beginPath();
  refCtx.roundRect(240, 152, 225, 73, 10);
  refCtx.fill();
  refCtx.stroke();

  // Selector Lever
  refCtx.fillStyle = "#1D456E";
  refCtx.beginPath();
  refCtx.roundRect(285, 178, 95, 16, 6);
  refCtx.fill();
  refCtx.stroke();

  // Handguard
  refCtx.fillStyle = "#F2741F";
  refCtx.beginPath();
  refCtx.roundRect(465, 158, 130, 62, 10);
  refCtx.fill();
  refCtx.stroke();

  // Barrel & Gas Tube
  refCtx.fillStyle = "#1D456E";
  refCtx.fillRect(595, 182, 130, 12);
  refCtx.strokeRect(595, 182, 130, 12);

  refCtx.fillStyle = "#189AA7";
  refCtx.fillRect(595, 162, 75, 12);
  refCtx.strokeRect(595, 162, 75, 12);

  // Front Sight
  refCtx.beginPath();
  refCtx.moveTo(695, 182);
  refCtx.lineTo(710, 135);
  refCtx.lineTo(722, 135);
  refCtx.lineTo(722, 182);
  refCtx.closePath();
  refCtx.fill();
  refCtx.stroke();

  // Muzzle Brake
  refCtx.fillStyle = "#F2741F";
  refCtx.beginPath();
  refCtx.roundRect(725, 177, 42, 22, 5);
  refCtx.fill();
  refCtx.stroke();

  refCtx.restore();

  if (state.showGrid) drawProportionGrid();

  // Capture base64 for Gemini Vision calls
  const dataUrl = refCanvas.toDataURL("image/png");
  state.imageBase64 = dataUrl.split(",")[1];
  state.imageMimeType = "image/png";
  loadedImageObj = null;
}

function renderCanvas() {
  if (!loadedImageObj) {
    drawAk47PresetToCanvas();
    return;
  }
  const maxW = 900;
  const scale = Math.min(1, maxW / loadedImageObj.width);
  refCanvas.width = Math.round(loadedImageObj.width * scale);
  refCanvas.height = Math.round(loadedImageObj.height * scale);

  refCtx.clearRect(0, 0, refCanvas.width, refCanvas.height);
  refCtx.drawImage(loadedImageObj, 0, 0, refCanvas.width, refCanvas.height);

  if (state.showGrid) {
    drawProportionGrid();
  }
}

function drawProportionGrid() {
  const w = refCanvas.width;
  const h = refCanvas.height;
  refCtx.save();
  refCtx.strokeStyle = "rgba(0, 162, 255, 0.38)";
  refCtx.lineWidth = 1;
  const cols = 12, rows = 8;
  for (let i = 1; i < cols; i++) {
    refCtx.beginPath();
    refCtx.moveTo((w / cols) * i, 0);
    refCtx.lineTo((w / cols) * i, h);
    refCtx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    refCtx.beginPath();
    refCtx.moveTo(0, (h / rows) * j);
    refCtx.lineTo(w, (h / rows) * j);
    refCtx.stroke();
  }
  // Center axes (X/Z mapping)
  refCtx.strokeStyle = "rgba(232, 125, 13, 0.85)";
  refCtx.lineWidth = 1.5;
  refCtx.setLineDash([6, 4]);
  refCtx.beginPath();
  refCtx.moveTo(0, h / 2);
  refCtx.lineTo(w, h / 2);
  refCtx.moveTo(w / 2, 0);
  refCtx.lineTo(w / 2, h);
  refCtx.stroke();
  refCtx.restore();
}

// Quantized Dominant Color Extraction (ignores pure white/transparent background)
function extractDominantColors(maxColors = 6) {
  const w = refCanvas.width;
  const h = refCanvas.height;
  const imgData = refCtx.getImageData(0, 0, w, h).data;
  const buckets = new Map();

  const step = Math.max(1, Math.floor((w * h) / 12000));
  for (let i = 0; i < imgData.length; i += 4 * step) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    const a = imgData[i + 3];
    if (a < 180) continue;
    // Skip near-white background pixels
    if (r > 238 && g > 238 && b > 238) continue;

    // Quantize to 24-level bins
    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;

    if (!buckets.has(key)) {
      buckets.set(key, { rSum: 0, gSum: 0, bSum: 0, count: 0 });
    }
    const entry = buckets.get(key);
    entry.rSum += r;
    entry.gSum += g;
    entry.bSum += b;
    entry.count++;
  }

  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .map(b => {
      const r = Math.min(255, Math.round(b.rSum / b.count));
      const g = Math.min(255, Math.round(b.gSum / b.count));
      const bl = Math.min(255, Math.round(b.bSum / b.count));
      return "#" + [r, g, bl].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    });

  // Deduplicate similar colors
  const distinct = [];
  for (const hex of sorted) {
    if (distinct.length >= maxColors) break;
    const isTooClose = distinct.some(existing => colorDistance(existing, hex) < 38);
    if (!isTooClose) distinct.push(hex);
  }

  if (distinct.length > 0) {
    state.palette = distinct;
    renderPaletteSwatches();
  }
}

function colorDistance(hex1, hex2) {
  const c1 = [parseInt(hex1.slice(1,3),16), parseInt(hex1.slice(3,5),16), parseInt(hex1.slice(5,7),16)];
  const c2 = [parseInt(hex2.slice(1,3),16), parseInt(hex2.slice(3,5),16), parseInt(hex2.slice(5,7),16)];
  return Math.hypot(c1[0]-c2[0], c1[1]-c2[1], c1[2]-c2[2]);
}

function renderPaletteSwatches() {
  const container = document.getElementById("paletteContainer");
  container.innerHTML = "";
  state.palette.forEach((hex, idx) => {
    const btn = document.createElement("button");
    btn.className = "group flex flex-col items-center gap-1 p-1.5 rounded-lg bg-studio-bg border border-studio-border hover:border-slate-400 transition";
    btn.title = `Click to copy ${hex}`;
    btn.innerHTML = `
      <span class="w-full h-6 rounded-md border border-white/15 shadow-inner" style="background-color: ${hex}"></span>
      <span class="text-[10px] font-mono text-slate-300 group-hover:text-white">${hex}</span>
    `;
    btn.addEventListener("click", () => {
      copyToClipboard(hex);
      showToast(`Copied color ${hex} to clipboard`);
    });
    container.appendChild(btn);
  });
}

// Handle Image Upload
function handleImageFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Please upload a valid PNG, JPG, or WEBP image.", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      loadedImageObj = img; state.silhouette = null; state.refPlane = null; state.xform = null;
      renderCanvas();
      extractDominantColors(6);
      const cleanDataUrl = refCanvas.toDataURL("image/jpeg", 0.9);
      state.imageBase64 = cleanDataUrl.split(",")[1];
      state.imageMimeType = "image/jpeg";

      // Suggest a clean filename based on uploaded file
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      document.getElementById("exportFilename").value = `${baseName || "Custom_Model"}_Roblox.glb`;
      showToast("Reference image loaded & palette extracted!");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// =========================================================================
// 4. BLENDER PYTHON (BPY) SCRIPT BUILDER FROM STRUCTURED PARTS
// =========================================================================
    function buildBlenderScriptFromParts(parts, modelName = "Stylized_Model") {
      const optTarget = document.getElementById("optTarget").value;
      const styleMode = document.getElementById("styleMode").value;
      const addOutline = document.getElementById("chkOutline").checked;
      const addRefPlane = document.getElementById("chkRefPlane").checked;
      let exportFilename = document.getElementById("exportFilename").value.trim() || "Stylized_Asset_Roblox.glb";
      if (!exportFilename.toLowerCase().endsWith(".glb") && !exportFilename.toLowerCase().endsWith(".gltf")) {
        exportFilename += ".glb";
      }

      // Collect unique hex colors from parts
      const uniqueHexes = Array.from(new Set(parts.map(p => (p.color || "#189AA7").toUpperCase())));
      const matVarMap = {};
      uniqueHexes.forEach((hex, idx) => {
        matVarMap[hex] = `mat_color_${idx + 1}`;
      });

      const bevelMultiplier = styleMode === "voxel_blocky" ? 0.0 : (styleMode === "smooth_subdiv" ? 1.5 : 1.0);
      const subdivCode = styleMode === "smooth_subdiv"
        ? `
    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.ops.object.modifier_apply(modifier="Subsurf")`
        : "";

      const materialLines = uniqueHexes.map((hex, i) => {
        return `${matVarMap[hex]} = make_mat("Palette_Mat_${i + 1}", "${hex}", roughness=0.40)`;
      }).join("\n");

      const partLines = parts.map((p, idx) => {
        const safeName = (p.name || `Part_${idx}`).replace(/[^a-zA-Z0-9_]/g, "_");
        const hex = (p.color || "#189AA7").toUpperCase();
        const matVar = matVarMap[hex] || "mat_color_1";
        const pos = p.pos || [0, 0, 0];
        const rot = p.rot || [0, 0, 0];

        if (p.type === "polygon") {
          return `parts.append(add_poly("${safeName}", [${p.pts.map(q => `(${q[0].toFixed(4)}, ${q[1].toFixed(4)})`).join(", ")}], ${p.thick.toFixed(4)}, (${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)}), mat=${matVar}))`;
        }
        if (p.type === "cylinder") {
          const r = p.radius || 0.03;
          const d = p.depth || 0.2;
          return `parts.append(add_cyl("${safeName}", ${r.toFixed(4)}, ${d.toFixed(4)}, (${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)}), (math.radians(${rot[0]}), math.radians(${rot[1]}), math.radians(${rot[2]})), mat=${matVar}))`;
        } else {
          const s = p.size || [0.2, 0.1, 0.1];
          const bev = ((p.bevel !== undefined ? p.bevel : 0.01) * bevelMultiplier).toFixed(4);
          return `parts.append(add_part("${safeName}", (${s[0].toFixed(3)}, ${s[1].toFixed(3)}, ${s[2].toFixed(3)}), (${pos[0].toFixed(3)}, ${pos[1].toFixed(3)}, ${pos[2].toFixed(3)}), (math.radians(${rot[0]}), math.radians(${rot[1]}), math.radians(${rot[2]})), mat=${matVar}, bevel_width=${bev}))`;
        }
      }).join("\n");

      const outlineBlock = addOutline ? `
# Add Stylized Inverted-Hull Cartoon Outline
mat_outline = make_mat("Cartoon_Outline", "#141821", roughness=0.9)
mat_outline.use_backface_culling = True

for obj in list(parts):
    outline = obj.copy()
    outline.data = obj.data.copy()
    outline.name = obj.name + "_Outline"
    bpy.context.collection.objects.link(outline)
    outline.data.materials.clear()
    outline.data.materials.append(mat_outline)
    # Flip normals inward for backface-culled silhouette outline
    bpy.context.view_layer.objects.active = outline
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.flip_normals()
    bpy.ops.transform.shrink_fatten(value=-0.006)
    bpy.ops.object.mode_set(mode='OBJECT')
    parts.append(outline)
` : "";

      const refPlaneBlock = addRefPlane ? `
# Optional: Load Reference Image Plane in Viewport (Excluded from GLB export)
try:
    ref_img = bpy.data.images.load(r"REPLACE_WITH_PATH_TO_YOUR_IMAGE.png")
    ref_empty = bpy.data.objects.new("Reference_Guide", None)
    ref_empty.empty_display_type = 'IMAGE'
    ref_empty.data = ref_img
    ref_empty.empty_display_size = 2.5
    ref_empty.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.collection.objects.link(ref_empty)  # not selected, so excluded from the GLB
except Exception as e:
    print("Reference image skipped:", e)
` : "";

      const sil = (state.silhouette && document.getElementById("chkSilhouette").checked) ? state.silhouette : null;
      const silBlock = sil ? `
def add_silhouette(name, pts, thick, mat):
    import bmesh
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x, -thick / 2, z)) for x, z in pts])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, thick, 0), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.data.materials.append(mat)
    return obj

parts.append(add_silhouette("Silhouette_Body", [${sil.pts.map(p => `(${p[0]}, ${p[1]})`).join(", ")}], ${sil.thick}, make_mat("Silhouette_Body_Mat", "${(state.palette[0] || "#189AA7").toUpperCase()}", roughness=0.45)))
` : "";

      const joinBlock = optTarget === "roblox_single" ? `
# Join all parts into one single optimized MeshPart for Roblox Studio
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
main_mesh = bpy.context.active_object
main_mesh.name = "${modelName}"

# Weld nearby vertices & set clean origin
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
` : `
# Keep parts separate inside a parent collection/selection for Roblox rig/animation
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
`;

      const exportFmt = exportFilename.toLowerCase().endsWith(".gltf") ? "GLTF_SEPARATE" : "GLB";

      return `import bpy
import math
import os

# ==============================================================================
# Generated by BloxForge — Stylized 3D Asset Builder for Roblox
# Target Mode: ${optTarget} | Style: ${styleMode}
# ==============================================================================

# 1. Reset Scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Create Stylized PBR Materials from Reference Palette
def make_mat(name, hex_color, roughness=0.40):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    hex_color = hex_color.lstrip('#')
    rgb = tuple(int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    linear = [pow((c + 0.055) / 1.055, 2.4) if c > 0.04045 else c / 12.92 for c in rgb]
    bsdf.inputs["Base Color"].default_value = (*linear, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

${materialLines}

# 3. Geometry Builder Helpers
def add_part(name, size, location, rotation=(0, 0, 0), mat=None, bevel_width=0.01):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel_width > 0:
        bev = obj.modifiers.new(name="Bevel", type='BEVEL')
        bev.width = bevel_width
        bev.segments = 2
        bpy.ops.object.modifier_apply(modifier="Bevel")${subdivCode}
    if mat:
        obj.data.materials.append(mat)
    return obj

def add_cyl(name, radius, depth, location, rotation=(0, 0, 0), mat=None, segs=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name${subdivCode}
    if mat:
        obj.data.materials.append(mat)
    return obj

def add_poly(name, pts, thick, location, mat=None):
    import bmesh
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new((x, -thick / 2, z)) for x, z in pts])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, thick, 0), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = location
    if mat:
        obj.data.materials.append(mat)
    return obj

# 4. Construct 3D Sub-Parts (+X Forward, +Z Up)
parts = []
${silBlock}${partLines}
${outlineBlock}
# 5. Optimize & Prepare Hierarchy for Export
${joinBlock}
${refPlaneBlock}
# 6. Export Optimized GLB to Desktop
desktop = os.path.join(os.path.expanduser("~"), "Desktop")
export_dir = desktop if os.path.exists(desktop) else os.path.expanduser("~")
export_path = os.path.join(export_dir, "${exportFilename}")

bpy.ops.export_scene.gltf(
    filepath=export_path,
    export_format='${exportFmt}',
    use_selection=True,
    export_apply=True
)

print(f"[BloxForge] Successfully exported 3D model to: {export_path}")
`;
    }

// =========================================================================
// 5. SYNTAX HIGHLIGHTING & CODE DISPLAY
// =========================================================================
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightPython(code) {
  const lines = code.split("\n");
  const highlighted = lines.map(line => {
    let escaped = escapeHtml(line);
    // Comments
    if (escaped.trim().startsWith("#")) {
      return `<span class="syn-cmt">${escaped}</span>`;
    }
    // Single pass so tokens inside strings are not re-highlighted
    escaped = escaped.replace(/(&quot;.*?&quot;|".*?"|'.*?')|\b(import|from|def|return|if|else|for|in|try|except|as|True|False|None)\b|\b(bpy|math|os)\b|\b(-?\d+\.?\d*)\b/g,
      (m, s, k, b, num) => s ? `<span class="syn-str">${s}</span>` : k ? `<span class="syn-kw">${k}</span>` : b ? `<span class="syn-bpy">${b}</span>` : `<span class="syn-num">${num}</span>`);
    return escaped;
  });

  document.getElementById("codeOutput").innerHTML = highlighted.join("\n");
  document.getElementById("lineNumbers").innerHTML = lines.map((_, i) => i + 1).join("<br>");
}

function updateTriangleEstimate(parts) {
  const styleMode = document.getElementById("styleMode").value;
  const addOutline = document.getElementById("chkOutline").checked;
  let tris = 0;
  parts.forEach(p => {
    if (p.type === "polygon") {
          tris += p.pts.length * 4;
        } else if (p.type === "cylinder") {
          tris += 48;
    } else {
      tris += styleMode === "voxel_blocky" ? 12 : (styleMode === "smooth_subdiv" ? 280 : 96);
    }
  });
  if (state.silhouette && document.getElementById("chkSilhouette").checked) tris += state.silhouette.pts.length * 4;
  if (addOutline) tris *= 2;
  document.getElementById("triCountText").textContent = `~${tris.toLocaleString()} tris`;
  const over = tris > 10000 && document.getElementById("optTarget").value === "roblox_single";
  const badge = document.getElementById("triEstimateBadge");
  badge.classList.toggle("text-rose-400", over);
  badge.classList.toggle("border-rose-500/40", over);
  badge.classList.toggle("text-emerald-400", !over);
  badge.classList.toggle("border-emerald-500/30", !over);
  badge.title = over ? "Over the 10k-tri target for a single Roblox MeshPart" : "Within budget";
  document.getElementById("previewPartsCount").textContent = `Parts: ${parts.length} primitives` + (findLoose(parts).size ? ` | ${findLoose(parts).size} loose (red)` : "");
}

// =========================================================================
// 6. GEMINI API MULTIMODAL VISION-TO-3D PARSER
// =========================================================================
async function generateWithGeminiVision() {
  if (!state.imageBase64) {
    showToast("Please upload or select a reference image first.", true);
    return;
  }

  if (!apiKey) {
    showToast("Enter your Gemini API key in the header first.", true);
    document.getElementById("apiKeyInput").focus();
    return;
  }
  const btn = document.getElementById("btnGenerate");
  const btnText = document.getElementById("btnGenerateText");
  const loadingBar = document.getElementById("aiLoadingBar");

  btn.disabled = true;
  btn.classList.add("opacity-70", "cursor-not-allowed");
  btnText.textContent = "Analyzing Image & Building 3D Mesh...";
  loadingBar.classList.remove("hidden");

  const customNotes = document.getElementById("customNotes").value.trim();
  const paletteList = state.palette.join(", ");

  const systemPrompt = `You are an expert 3D technical artist building stylized low-poly game assets for Roblox/Blender.
Decompose the subject of the reference image into 12 to 30 primitives ("box", "cylinder" or "polygon") for a side-profile blockout.
Use "polygon" for curved, tapered or angled parts (curved magazine, stock, pistol grip, slanted sights): return polygon_2d = 6 to 16 points [x, y] (x left to right, y top to bottom, normalized 0-1000) tracing the part's outline in order, and also box_2d as its bounding box. A curved banana magazine must be ONE polygon that follows its curve and taper, never several boxes.
For every part return box_2d = [ymin, xmin, ymax, xmax], normalized 0-1000 in the reference image: the tight box of the part measured along its own axes BEFORE tilt, centered where the part sits.
tilt = in-image rotation of the part in degrees, counter-clockwise positive (0 if none).
depth = thickness toward/away from the viewer as a fraction of the object's overall length (0.03 to 0.2).
Parts must touch or slightly overlap their neighbours: no floating parts, every part must connect to the main body.
Use colors from this palette (${paletteList}) or exact sampled colors, as hex.`;

  const userPrompt = `Decompose this reference image into a connected 3D primitive assembly (side-profile blockout).
${customNotes ? `User hints: ${customNotes}` : ""}
Return JSON with a short "modelName" (alphanumeric and underscores) and the array "parts".`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: userPrompt },
          {
            inlineData: {
              mimeType: state.imageMimeType,
              data: state.imageBase64
            }
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          modelName: { type: "STRING" },
          parts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                type: { type: "STRING", enum: ["box", "cylinder", "polygon"] },
                polygon_2d: { type: "ARRAY", items: { type: "ARRAY", items: { type: "NUMBER" } } },
                box_2d: { type: "ARRAY", items: { type: "NUMBER" } },
                tilt: { type: "NUMBER" },
                depth: { type: "NUMBER" },
                color: { type: "STRING" }
              },
              required: ["name", "type", "box_2d", "color"]
            }
          }
        },
        required: ["modelName", "parts"]
      }
    }
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`;

  // Exponential backoff fetch
  let resultJson = null, lastErr = "empty response";
  const delays = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        resultJson = JSON.parse(rawText);
        break;
      }
    } catch (err) {
      if (attempt < delays.length) {
        await new Promise(r => setTimeout(r, delays[attempt]));
      } else {
        lastErr = err.message;
      }
    }
  }

  if (resultJson && Array.isArray(resultJson.parts) && resultJson.parts.length > 0) {
    const conv = convert2D(resultJson.parts);
    state.partsSpec = conv || sanitizeParts(resultJson.parts);
    let fixedN = 0;
    if (conv) {
      state.silhouette = buildSilhouette();
      if (document.getElementById("chkRefine").checked) {
        document.getElementById("aiLoadingStatus").textContent = "Refining: comparing a render of the blockout with the reference...";
        rebuildThreeScene(state.partsSpec);
        const better = await refineWithGemini(payload, resultJson.parts);
        const c2 = better && convert2D(better);
        if (c2 && c2.length) { state.partsSpec = c2; state.silhouette = buildSilhouette(); }
      }
      if (document.getElementById("chkAutoFix").checked) fixedN = fixConnectivity(state.partsSpec);
    } else state.silhouette = null;
    const cleanName = (resultJson.modelName || "Stylized_Asset").replace(/[^a-zA-Z0-9_]/g, "_");
    regenerateScriptAndPreview(cleanName);
    showToast(`Generated ${state.partsSpec.length} parts` + (fixedN ? `, snapped ${fixedN} loose group(s)` : "") + (state.silhouette ? " + silhouette body" : "") + ".");
  } else {
    // Fallback if offline/API unavailable: rebuild with current palette
    regenerateScriptAndPreview();
    showToast(`Gemini request failed (${lastErr}). Check your API key. Script rebuilt from the current parts.`, true);
  }

  btn.disabled = false;
  btn.classList.remove("opacity-70", "cursor-not-allowed");
  btnText.textContent = "Generate Blender Python Script";
  loadingBar.classList.add("hidden");
}

function regenerateScriptAndPreview(modelName) {
  if (modelName) state.modelName = modelName;
  const code = buildBlenderScriptFromParts(state.partsSpec, state.modelName || "Stylized_Asset");
  state.currentCode = code;
  highlightPython(code);
  updateTriangleEstimate(state.partsSpec);
  rebuildThreeScene(state.partsSpec);
}

// =========================================================================
// 7. THREE.JS INTERACTIVE 3D BLOCKOUT PREVIEW
// =========================================================================
// =========================================================================
// 6b. 2D->3D CONVERSION, LOOSE-PART FIXER, SILHOUETTE, SELF-CORRECTION
// =========================================================================
const PRESET_PLANE = { w: 2.93, h: 1.65, cx: 0.225, cz: -0.12 };
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent";
let orthoMode = false, orthoCam, perspCam, refMesh;

// Gemini gives 2D boxes (0-1000) in the image; positions/sizes are computed here, not guessed in 3D.
function convert2D(raw) {
  const W = refCanvas.width, H = refCanvas.height;
  const bx = (raw || []).filter(p => p && Array.isArray(p.box_2d) && p.box_2d.length === 4 && p.box_2d.every(Number.isFinite)).map(p => {
    const [y0, x0, y1, x1] = p.box_2d;
    return { p, x0: Math.min(x0, x1) / 1000 * W, x1: Math.max(x0, x1) / 1000 * W, y0: Math.min(y0, y1) / 1000 * H, y1: Math.max(y0, y1) / 1000 * H };
  });
  if (!bx.length) return null;
  const ux0 = Math.min(...bx.map(b => b.x0)), ux1 = Math.max(...bx.map(b => b.x1));
  const uy0 = Math.min(...bx.map(b => b.y0)), uy1 = Math.max(...bx.map(b => b.y1));
  const s = 2.0 / Math.max(ux1 - ux0, uy1 - uy0, 1), ucx = (ux0 + ux1) / 2, ucy = (uy0 + uy1) / 2;
  state.xform = { s, ucx, ucy };
  state.refPlane = { w: W * s, h: H * s, cx: (W / 2 - ucx) * s, cz: -(H / 2 - ucy) * s };
  return sanitizeParts(bx.map(({ p, x0, x1, y0, y1 }) => {
    const w = (x1 - x0) * s, h = (y1 - y0) * s, tilt = +p.tilt || 0;
    const dep = Math.min(0.3, Math.max(0.03, +p.depth || 0.08)) * 2.0;
    const o = { name: p.name, type: p.type, color: p.color, pos: [((x0 + x1) / 2 - ucx) * s, 0, -((y0 + y1) / 2 - ucy) * s] };
    if (p.type === "polygon") {
      const q = (Array.isArray(p.polygon_2d) ? p.polygon_2d : []).filter(a => Array.isArray(a) && Number.isFinite(+a[0]) && Number.isFinite(+a[1])).map(a => [+a[0] / 1000 * W, +a[1] / 1000 * H]);
      if (q.length >= 3) {
        const cx = (Math.min(...q.map(a => a[0])) + Math.max(...q.map(a => a[0]))) / 2;
        const cy = (Math.min(...q.map(a => a[1])) + Math.max(...q.map(a => a[1]))) / 2;
        o.pos = [(cx - ucx) * s, 0, -(cy - ucy) * s];
        o.pts = q.map(([a, b]) => [(a - cx) * s, -(b - cy) * s]);
        o.thick = dep; o.rot = [0, 0, 0];
        return o;
      }
      o.type = "box";
    }
    if (p.type === "cylinder") {
      if (w >= h) { o.radius = h / 2; o.depth = w; o.rot = [0, 90 - tilt, 0]; }
      else { o.radius = w / 2; o.depth = h; o.rot = [0, -tilt, 0]; }
    } else { o.size = [w, dep, h]; o.rot = [0, -tilt, 0]; o.bevel = Math.min(0.02, Math.min(w, h, dep) * 0.15); }
    return o;
  }));
}

// Trace the object's outer outline from the image (largest foreground blob) -> simplified polygon in model units
function buildSilhouette() {
  const X = state.xform; if (!X) return null;
  const g = state.showGrid; state.showGrid = false; renderCanvas(); state.showGrid = g; if (g) renderCanvas();
  const W = refCanvas.width, H = refCanvas.height, d = refCtx.getImageData(0, 0, W, H).data;
  const k = Math.max(1, Math.round(W / 220)), w = Math.floor(W / k), h = Math.floor(H / k);
  const px = (x, y) => { const i = ((y * k) * W + x * k) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };
  const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([x, y]) => px(x, y));
  const bg = [0, 1, 2].map(i => cs.reduce((a, v) => a + v[i], 0) / 4);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = px(x, y); m[y * w + x] = (p[3] > 40 && Math.hypot(p[0] - bg[0], p[1] - bg[1], p[2] - bg[2]) > 45) ? 1 : 0; }
  const lab = new Int32Array(w * h); let best = 0, bestN = 0, id = 0;
  for (let s0 = 0; s0 < w * h; s0++) {
    if (!m[s0] || lab[s0]) continue;
    id++; lab[s0] = id; const st = [s0]; let n = 0;
    while (st.length) { const q = st.pop(); n++; const x = q % w, y = (q / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const ni = ny * w + nx; if (m[ni] && !lab[ni]) { lab[ni] = id; st.push(ni); } } }
    if (n > bestN) { bestN = n; best = id; }
  }
  if (bestN < 30) return null;
  const inM = (x, y) => x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x] === best;
  let sx = 0, sy = 0; outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inM(x, y)) { sx = x; sy = y; break outer; }
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  let pts = [[sx, sy]], cx = sx, cy = sy, b = 4;
  for (let it = 0; it < w * h * 4; it++) {
    let moved = false;
    for (let i = 1; i <= 8; i++) {
      const di = (b + i) % 8, nx = cx + dirs[di][0], ny = cy + dirs[di][1];
      if (!inM(nx, ny)) continue;
      const pb = (b + i - 1) % 8;
      b = dirs.findIndex(v => v[0] === dirs[pb][0] - dirs[di][0] && v[1] === dirs[pb][1] - dirs[di][1]);
      cx = nx; cy = ny; moved = true; break;
    }
    if (!moved || b < 0 || (cx === sx && cy === sy)) break;
    pts.push([cx, cy]);
  }
  const dist = (p, a, c) => { const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; return Math.abs((c[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (c[1] - a[1])) / L; };
  const dp = (p, e) => { if (p.length < 3) return p; let mx = 0, ix = 0;
    for (let i = 1; i < p.length - 1; i++) { const dd = dist(p[i], p[0], p[p.length - 1]); if (dd > mx) { mx = dd; ix = i; } }
    return mx > e ? [...dp(p.slice(0, ix + 1), e).slice(0, -1), ...dp(p.slice(ix), e)] : [p[0], p[p.length - 1]]; };
  const poly = dp(pts, 1.4).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (poly.length < 3) return null;
  return { thick: 0.07, pts: poly.map(([gx, gy]) => [+((gx * k + k / 2 - X.ucx) * X.s).toFixed(4), +(-(gy * k + k / 2 - X.ucy) * X.s).toFixed(4)]) };
}

// Front-view render of the blockout, framed exactly like the reference image
function captureFront() {
  const rp = state.refPlane; if (!rp || !renderer) return null;
  const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
  const cam = new THREE.OrthographicCamera(rp.cx - rp.w / 2, rp.cx + rp.w / 2, rp.cz + rp.h / 2, rp.cz - rp.h / 2, 0.1, 50);
  cam.position.set(0, 0, 6);
  const gr = scene.getObjectByName("grid"), rv = refMesh && refMesh.visible;
  if (gr) gr.visible = false; if (refMesh) refMesh.visible = false;
  renderer.setPixelRatio(1); renderer.setSize(refCanvas.width, refCanvas.height, false);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL("image/jpeg", 0.85);
  renderer.setPixelRatio(pr); renderer.setSize(sz.x, sz.y, false);
  if (gr) gr.visible = true; if (refMesh) refMesh.visible = rv;
  return url.split(",")[1];
}
async function refineWithGemini(base, rawParts) {
  const shot = captureFront(); if (!shot) return null;
  const p = JSON.parse(JSON.stringify(base));
  p.contents[0].parts = [
    { text: `Image 1 is the reference. Image 2 is our current 3D blockout seen from the front in the same frame (parts drawn in red are detached from the main body). Current parts JSON:\n${JSON.stringify(rawParts)}\nReturn the corrected FULL parts list in the same format: fix wrong boxes, add missing parts, remove wrong ones, and make every part touch or overlap its neighbours.` },
    { inlineData: { mimeType: state.imageMimeType, data: state.imageBase64 } },
    { inlineData: { mimeType: "image/jpeg", data: shot } }];
  try {
    const r = await fetch(GEMINI_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(p) });
    if (!r.ok) return null;
    const t = (await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text;
    return t ? JSON.parse(t).parts : null;
  } catch (e) { return null; }
}

function updateRefPlane() {
  if (refMesh) { scene.remove(refMesh); refMesh.geometry.dispose(); if (refMesh.material.map) refMesh.material.map.dispose(); refMesh.material.dispose(); refMesh = null; }
  const rp = state.refPlane; if (!scene || !orthoMode || !rp) return;
  refMesh = new THREE.Mesh(new THREE.PlaneGeometry(rp.w, rp.h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(refCanvas), transparent: true, opacity: 0.4, depthWrite: false }));
  refMesh.position.set(rp.cx, rp.cz, -0.8); scene.add(refMesh);
}
function setViewMode(on) {
  orthoMode = on; camera = on ? orthoCam : perspCam;
  if (on) { orthoCam.zoom = 1; orthoCam.position.set(0.15, -0.05, 6); orthoCam.lookAt(0.15, -0.05, 0); orthoCam.updateProjectionMatrix(); } else updateCameraPosition();
  onThreeResize(); updateRefPlane();
  const bt = document.getElementById("btnSideView"); if (bt) bt.classList.toggle("border-studio-blender", on);
}
function addSilhouette3D() {
  const S = state.silhouette; if (!modelGroup || !S || !document.getElementById("chkSilhouette").checked) return;
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(S.pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: S.thick, bevelEnabled: false });
  g.translate(0, 0, -S.thick / 2);
  modelGroup.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(state.palette[0] || "#189AA7"), roughness: 0.5, wireframe: state.wireframeMode })));
}

let scene, camera, renderer, modelGroup;
let isDragging = false, prevMouse = { x: 0, y: 0 };
let spherical = { radius: 2.8, theta: 0.45, phi: 1.25 };

function initThreePreview() {
  const container = document.getElementById("threeContainer");
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x121418);

  camera = new THREE.PerspectiveCamera(45, Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight), 0.05, 100);
  perspCam = camera; orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  updateCameraPosition();

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth || 600, container.clientHeight || 400);
  container.appendChild(renderer.domElement);

  // Studio Lighting
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2a2e37, 0.95);
  hemiLight.position.set(0, 5, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);

  const rimLight = new THREE.DirectionalLight(0x00A2FF, 0.35);
  rimLight.position.set(-4, -2, -3);
  scene.add(rimLight);

  // Grid Floor
  const gridHelper = new THREE.GridHelper(4, 16, 0x343946, 0x22252C);
  gridHelper.position.y = -0.65;
  gridHelper.name = "grid";
  scene.add(gridHelper);

  modelGroup = new THREE.Group();
  scene.add(modelGroup);

  // Orbit Controls (Mouse & Touch)
  const domEl = renderer.domElement;
  domEl.addEventListener("mousedown", (e) => {
    isDragging = true;
    prevMouse = { x: e.clientX, y: e.clientY };
  });
  window.addEventListener("mouseup", () => { isDragging = false; });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    prevMouse = { x: e.clientX, y: e.clientY };
    spherical.theta -= dx * 0.01;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - dy * 0.01));
    updateCameraPosition();
  });

  domEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (orthoMode) { orthoCam.zoom = Math.max(0.3, Math.min(6, orthoCam.zoom * (1 - e.deltaY * 0.001))); orthoCam.updateProjectionMatrix(); return; }
    spherical.radius = Math.max(0.8, Math.min(8.0, spherical.radius + e.deltaY * 0.002));
    updateCameraPosition();
  }, { passive: false });

  // Touch Orbit
  domEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });
  domEl.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - prevMouse.x;
    const dy = e.touches[0].clientY - prevMouse.y;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    spherical.theta -= dx * 0.012;
    spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi - dy * 0.012));
    updateCameraPosition();
  }, { passive: true });
  domEl.addEventListener("touchend", () => { isDragging = false; });

  window.addEventListener("resize", onThreeResize);
  animateThree();
}

function updateCameraPosition() {
  if (!camera || orthoMode) return;
  camera.position.x = spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  camera.position.y = spherical.radius * Math.cos(spherical.phi);
  camera.position.z = spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
  camera.lookAt(0.15, -0.05, 0);
}

function onThreeResize() {
  const container = document.getElementById("threeContainer");
  if (!container || !renderer || !camera) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    perspCam.aspect = w / h; perspCam.updateProjectionMatrix();
    const hh = 1.1, hw = hh * w / h; orthoCam.left = -hw; orthoCam.right = hw; orthoCam.top = hh; orthoCam.bottom = -hh; orthoCam.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
}

function rebuildThreeScene(parts) {
  rebuildPartsOnly(parts);
  addSilhouette3D();
  updateRefPlane();
}
function rebuildPartsOnly(parts) {
  if (!modelGroup) return;
  const loose = findLoose(parts);
  while (modelGroup.children.length > 0) {
    const child = modelGroup.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    modelGroup.remove(child);
  }

  const addOutline = document.getElementById("chkOutline").checked;

  parts.forEach((p, pi) => {
    let geom;
    // Map Blender (+X right, +Y depth, +Z up) -> Three.js (+X right, +Y up, +Z front)
    const bx = p.pos?.[0] || 0;
    const by = p.pos?.[1] || 0;
    const bz = p.pos?.[2] || 0;

    const rx = THREE.MathUtils.degToRad(p.rot?.[0] || 0);
    const ry = THREE.MathUtils.degToRad(p.rot?.[1] || 0);
    const rz = THREE.MathUtils.degToRad(p.rot?.[2] || 0);

    if (p.type === "polygon") {
      geom = new THREE.ExtrudeGeometry(new THREE.Shape(p.pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: p.thick, bevelEnabled: false });
      geom.translate(0, 0, -p.thick / 2);
    } else if (p.type === "cylinder") {
      const r = p.radius || 0.03;
      const d = p.depth || 0.2;
      geom = new THREE.CylinderGeometry(r, r, d, 14);
    } else {
      const sx = p.size?.[0] || 0.2;
      const sy = p.size?.[1] || 0.1;
      const sz = p.size?.[2] || 0.1;
      // Blender (sx, sy, sz) -> Three (sx, sz, sy)
      geom = new THREE.BoxGeometry(sx, sz, sy);
    }

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(loose.has(pi) ? "#FF3B3B" : (p.color || "#189AA7")),
      roughness: 0.42,
      metalness: 0.08,
      wireframe: state.wireframeMode
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(bx, bz, -by);
    // Convert Blender Y-pitch rotation to Three.js Z-roll rotation
    // Blender XYZ euler (Rz*Ry*Rx) in Three axes: Bx->X, By->-Z, Bz->Y (cylinder axis Z->Y matches too)
    mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rz)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -ry))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rx));

    modelGroup.add(mesh);

    if (addOutline && !state.wireframeMode) {
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x11151C }));
      line.position.copy(mesh.position);
      line.quaternion.copy(mesh.quaternion);
      modelGroup.add(line);
    }
  });
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// =========================================================================
// 8. CLIPBOARD & FILE DOWNLOAD HELPERS
// =========================================================================
function copyToClipboard(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function downloadPythonFile() {
  const blob = new Blob([state.currentCode], { type: "text/x-python;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const baseGlb = (document.getElementById("exportFilename").value.trim() || "Stylized_Model").replace(/\.[^/.]+$/, "");
  a.href = url;
  a.download = `${baseGlb}_builder.py`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Downloaded ${baseGlb}_builder.py`);
}

async function handleExportGlb() {
  if (!state.partsSpec.length) { showToast("Nothing to export yet.", true); return; }
  try {
    const base = (document.getElementById("exportFilename").value.trim() || "Stylized_Asset_Roblox").replace(/\.(glb|gltf)$/i, "");
    const useSil = state.silhouette && document.getElementById("chkSilhouette").checked;
    const buf = await exportGlb({
      parts: state.partsSpec,
      silhouette: useSil ? state.silhouette : null,
      silColor: state.palette[0],
      single: document.getElementById("optTarget").value === "roblox_single",
      name: base
    });
    const url = URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${base}.glb`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${base}.glb (${(buf.byteLength / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(err);
    showToast("GLB export failed: " + err.message, true);
  }
}

// =========================================================================
// 9. EVENT WIRING
// =========================================================================
window.addEventListener("DOMContentLoaded", () => {
  createIcons({ icons: ICONS });
  initThreePreview();

  // API key box (header)
  const keyInput = document.getElementById("apiKeyInput");
  const btnKey = document.getElementById("btnToggleKey");
  keyInput.value = apiKey;
  keyInput.addEventListener("input", () => {
    apiKey = keyInput.value.trim();
    try { localStorage.setItem("img2bpy_key", apiKey); } catch (e) {}
  });
  btnKey.addEventListener("click", () => {
    const hide = keyInput.type === "text";
    keyInput.type = hide ? "password" : "text";
    btnKey.textContent = hide ? "Show" : "Hide";
  });

  // Load initial stylized AK-47 preset
  state.partsSpec = JSON.parse(JSON.stringify(DEFAULT_AK47_PARTS)); state.refPlane = PRESET_PLANE; state.silhouette = null; state.xform = null;
  drawAk47PresetToCanvas();
  renderPaletteSwatches();
  regenerateScriptAndPreview("Stylized_AK47");

  // File Input & Drag-and-Drop
  const fileInput = document.getElementById("fileInput");
  const dropZone = document.getElementById("dropZone");

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-studio-blender");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-studio-blender");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-studio-blender");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageFile(e.dataTransfer.files[0]);
    }
  });

  // Grid Overlay Toggle
  document.getElementById("btnToggleGrid").addEventListener("click", (e) => {
    state.showGrid = !state.showGrid;
    e.currentTarget.classList.toggle("border-studio-roblox", state.showGrid);
    e.currentTarget.classList.toggle("text-studio-roblox", state.showGrid);
    renderCanvas();
  });

  // Eyedropper Tool
  const btnEye = document.getElementById("btnEyedropper");
  const eyeReadout = document.getElementById("eyedropperReadout");

  btnEye.addEventListener("click", () => {
    state.eyedropperActive = !state.eyedropperActive;
    btnEye.classList.toggle("border-studio-blender", state.eyedropperActive);
    btnEye.classList.toggle("text-studio-blender", state.eyedropperActive);
    refCanvas.classList.toggle("cursor-eyedropper", state.eyedropperActive);
    eyeReadout.classList.toggle("hidden", !state.eyedropperActive);
  });

  refCanvas.addEventListener("mousemove", (e) => {
    if (!state.eyedropperActive) return;
    const rect = refCanvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * refCanvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * refCanvas.height);
    const pixel = refCtx.getImageData(Math.max(0, Math.min(refCanvas.width - 1, x)), Math.max(0, Math.min(refCanvas.height - 1, y)), 1, 1).data;
    const hex = "#" + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    document.getElementById("sampledSwatch").style.backgroundColor = hex;
    document.getElementById("sampledHex").textContent = hex;
  });

  refCanvas.addEventListener("click", () => {
    if (!state.eyedropperActive) return;
    const hex = document.getElementById("sampledHex").textContent;
    if (!state.palette.includes(hex)) {
      state.palette.unshift(hex);
      if (state.palette.length > 6) state.palette.pop();
      renderPaletteSwatches();
      showToast(`Added ${hex} to palette!`);
    }
  });

  // Re-scan Colors
  document.getElementById("btnReExtract").addEventListener("click", () => {
    extractDominantColors(6);
    showToast("Re-sampled dominant colors from image.");
  });

  // Load AK-47 Preset Button
  // Live Reactive Settings Updates (immediately updates script & 3D preview)
  ["optTarget", "styleMode", "chkOutline", "chkRefPlane", "chkSilhouette", "exportFilename"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      regenerateScriptAndPreview();
    });
  });

  // Main AI Generate Button
  document.getElementById("btnGenerate").addEventListener("click", generateWithGeminiVision);

  // Copy & Download Buttons
  document.getElementById("btnCopyCode").addEventListener("click", () => {
    copyToClipboard(state.currentCode);
    showToast("Blender Python script copied to clipboard!");
  });
  document.getElementById("btnDownloadPy").addEventListener("click", downloadPythonFile);
  document.querySelectorAll("[data-export-glb]").forEach(b => b.addEventListener("click", handleExportGlb));

  // Tab Switching (Code vs 3D Preview)
  const tabCode = document.getElementById("tabCode");
  const tabPreview = document.getElementById("tabPreview");
  const codePane = document.getElementById("codePane");
  const previewPane = document.getElementById("previewPane");

  tabCode.addEventListener("click", () => {
    tabCode.className = "px-3 py-1.5 rounded-md text-xs font-semibold bg-studio-surface text-white shadow-sm flex items-center gap-1.5 transition";
    tabPreview.className = "px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition";
    codePane.classList.remove("hidden");
    previewPane.classList.add("hidden");
  });

  tabPreview.addEventListener("click", () => {
    tabPreview.className = "px-3 py-1.5 rounded-md text-xs font-semibold bg-studio-surface text-white shadow-sm flex items-center gap-1.5 transition";
    tabCode.className = "px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5 transition";
    previewPane.classList.remove("hidden");
    codePane.classList.add("hidden");
    onThreeResize();
  });

  // Start on the 3D preview instead of the code tab
  requestAnimationFrame(() => tabPreview.click());

  // 3D Viewport Controls
  document.getElementById("btnToggleWireframe").addEventListener("click", () => {
    state.wireframeMode = !state.wireframeMode;
    rebuildThreeScene(state.partsSpec);
  });

  document.getElementById("btnSideView").addEventListener("click", () => setViewMode(!orthoMode));
  document.getElementById("btnResetCam").addEventListener("click", () => {
    setViewMode(false);
    spherical = { radius: 2.8, theta: 0.45, phi: 1.25 };
    updateCameraPosition();
  });

  // Help Modal Controls
  const helpModal = document.getElementById("helpModal");
  document.getElementById("btnHelpModal").addEventListener("click", () => helpModal.classList.remove("hidden"));
  document.getElementById("btnCloseModal").addEventListener("click", () => helpModal.classList.add("hidden"));
  document.getElementById("btnGotIt").addEventListener("click", () => helpModal.classList.add("hidden"));
});
  