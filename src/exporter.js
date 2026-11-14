// Real in-browser GLB export (no Blender needed): builds clean geometry from the part list
// (true colors, no preview-only tint/outlines) and writes a binary glTF with GLTFExporter.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as BGU from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// r128 exposes the helper as BGU.BufferGeometryUtils.mergeBufferGeometries; later versions export it by name
const U = BGU.BufferGeometryUtils || BGU;   // r128 helper functions rely on `this`, so keep them bound
const mergeBufferGeometries = (U.mergeBufferGeometries || U.mergeGeometries).bind(U);

const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);

// Same Blender(Z-up) -> glTF(Y-up) mapping as the live preview
function partMatrix(p) {
  const d = THREE.MathUtils.degToRad;
  const q = new THREE.Quaternion().setFromAxisAngle(AY, d(p.rot?.[2] || 0))
    .multiply(new THREE.Quaternion().setFromAxisAngle(AZ, -d(p.rot?.[1] || 0)))
    .multiply(new THREE.Quaternion().setFromAxisAngle(AX, d(p.rot?.[0] || 0)));
  const pos = new THREE.Vector3(p.pos?.[0] || 0, p.pos?.[2] || 0, -(p.pos?.[1] || 0));
  return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
}

function collectItems(parts, silhouette, silColor) {
  const items = parts.map((p, i) => {
    let geom;
    if (p.type === 'polygon') {
      geom = new THREE.ExtrudeGeometry(new THREE.Shape(p.pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: p.thick, bevelEnabled: false });
      geom.translate(0, 0, -p.thick / 2);
    } else if (p.type === 'cylinder') {
      geom = new THREE.CylinderGeometry(p.radius || 0.03, p.radius || 0.03, p.depth || 0.2, 14);
    } else {
      geom = new THREE.BoxGeometry(p.size?.[0] || 0.2, p.size?.[2] || 0.1, p.size?.[1] || 0.1);
    }
    return { geom, matrix: partMatrix(p), color: (p.color || '#189AA7').toUpperCase(), name: p.name || `Part_${i}` };
  });
  if (silhouette && silhouette.pts?.length > 2) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(silhouette.pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: silhouette.thick, bevelEnabled: false });
    g.translate(0, 0, -silhouette.thick / 2);
    items.unshift({ geom: g, matrix: new THREE.Matrix4(), color: (silColor || '#189AA7').toUpperCase(), name: 'Silhouette_Body' });
  }
  return items;
}

function buildRoot(items, single, name) {
  const mats = new Map();
  const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.45, metalness: 0.05, name: 'Mat_' + c.slice(1) })); return mats.get(c); };
  const root = new THREE.Group(); root.name = name;

  if (single) {
    // One mesh, one material slot per color (what Roblox wants for a single MeshPart)
    const byColor = new Map();
    items.forEach(it => {
      const g = it.geom.index ? it.geom.toNonIndexed() : it.geom.clone();
      g.clearGroups(); g.applyMatrix4(it.matrix);
      if (!byColor.has(it.color)) byColor.set(it.color, []);
      byColor.get(it.color).push(g);
    });
    const colors = [...byColor.keys()];
    const perColor = colors.map(c => mergeBufferGeometries(byColor.get(c), false));
    const merged = perColor.every(Boolean) ? mergeBufferGeometries(perColor, true) : null;
    if (merged) {
      const mesh = new THREE.Mesh(merged, colors.map(mat)); mesh.name = name; root.add(mesh);
      return root;
    }
  }
  items.forEach(it => { const m = new THREE.Mesh(it.geom, mat(it.color)); m.name = it.name; m.applyMatrix4(it.matrix); root.add(m); });
  return root;
}

export function exportGlb({ parts, silhouette, silColor, single, name }) {
  const root = buildRoot(collectItems(parts, silhouette, silColor), single, name || 'Model');
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(root, res => res instanceof ArrayBuffer ? resolve(res) : reject(new Error('Exporter returned no binary data')), { binary: true });
  });
}
