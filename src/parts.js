// Pure geometry helpers: part sanitizing, bounds, loose-part detection and snapping
// Normalize AI / user part specs so bad values can never break the script or preview
export function sanitizeParts(parts) {
  const n = (v, d) => Number.isFinite(+v) ? +v : d;
  const v3 = (a, d) => [0, 1, 2].map(i => n(a && a[i], d[i]));
  return (parts || []).filter(p => p && typeof p === "object").map((p, i) => {
    const poly = (p.type === "polygon" && Array.isArray(p.pts))
      ? p.pts.filter(a => Array.isArray(a) && Number.isFinite(+a[0]) && Number.isFinite(+a[1])).map(a => [+a[0], +a[1]]) : [];
    const out = {
      name: String(p.name || `Part_${i}`),
      type: poly.length >= 3 ? "polygon" : p.type === "cylinder" ? "cylinder" : "box",
      pos: v3(p.pos, [0, 0, 0]),
      rot: v3(p.rot, [0, 0, 0]),
      color: (c => /^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : /^#[0-9a-f]{3}$/i.test(c) ? ("#" + c.slice(1).split("").map(x => x + x).join("")).toUpperCase() : "#189AA7")(String(p.color || ""))
    };
    if (out.type === "polygon") {
      out.pts = poly;
      out.thick = Math.max(0.01, n(p.thick, 0.1));
    } else if (out.type === "cylinder") {
      out.radius = Math.max(0.002, n(p.radius, 0.03));
      out.depth = Math.max(0.01, n(p.depth, 0.2));
    } else {
      out.size = v3(p.size, [0.2, 0.1, 0.1]).map(x => Math.max(0.005, Math.abs(x)));
      out.bevel = Math.max(0, n(p.bevel, 0.01));
    }
    return out;
  });
}

// Axis-aligned bounds (rotation about Y only, which is what the 2D pipeline produces)
function aabb(p) {
  if (p.type === "polygon") {
    const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]);
    return { min: [p.pos[0] + Math.min(...xs), p.pos[1] - p.thick / 2, p.pos[2] + Math.min(...zs)], max: [p.pos[0] + Math.max(...xs), p.pos[1] + p.thick / 2, p.pos[2] + Math.max(...zs)] };
  }
  const [sx, sy, sz] = p.type === "cylinder" ? [p.radius * 2, p.radius * 2, p.depth] : p.size;
  const a = (p.rot[1] || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const h = [(sx * c + sz * s) / 2, sy / 2, (sx * s + sz * c) / 2];
  return { min: p.pos.map((v, i) => v - h[i]), max: p.pos.map((v, i) => v + h[i]) };
}
// Vector that moves box b until it touches box a
function gapVec(a, b) {
  return [0, 1, 2].map(i => b.min[i] > a.max[i] ? a.max[i] - b.min[i] : a.min[i] > b.max[i] ? a.min[i] - b.max[i] : 0);
}
function components(parts) {
  const bb = parts.map(aabb), par = parts.map((_, i) => i);
  const f = i => par[i] === i ? i : (par[i] = f(par[i]));
  for (let i = 0; i < bb.length; i++) for (let j = i + 1; j < bb.length; j++)
    if (gapVec(bb[i], bb[j]).every(v => Math.abs(v) <= 0.002)) par[f(i)] = f(j);
  const g = {};
  parts.forEach((_, i) => (g[f(i)] = g[f(i)] || []).push(i));
  return { groups: Object.values(g), bb };
}
function mainGroup(groups, bb) {
  const vol = i => bb[i].max.reduce((a, m, k) => a * (m - bb[i].min[k]), 1);
  return groups.reduce((best, g) => { const v = g.reduce((s, i) => s + vol(i), 0); return v > best.v ? { g, v } : best; }, { g: [], v: -1 }).g;
}
export function findLoose(parts) {
  if (!parts.length) return new Set();
  const { groups, bb } = components(parts), m = new Set(mainGroup(groups, bb));
  return new Set(parts.map((_, i) => i).filter(i => !m.has(i)));
}
// Rigidly move each detached group to the nearest point of the main body
export function fixConnectivity(parts) {
  let moves = 0;
  for (let it = 0; it < 40; it++) {
    const { groups, bb } = components(parts);
    if (groups.length < 2) break;
    const main = mainGroup(groups, bb); let best = null;
    for (const g of groups) { if (g === main) continue;
      for (const i of g) for (const j of main) { const v = gapVec(bb[j], bb[i]), d = Math.hypot(...v); if (!best || d < best.d) best = { d, v, g }; } }
    best.g.forEach(i => { parts[i].pos = parts[i].pos.map((c, k) => c + best.v[k] + Math.sign(best.v[k]) * 0.004); });
    moves++;
  }
  return moves;
}


