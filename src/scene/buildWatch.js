import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
  Procedural model of the Chronova Type-0, a skeletonised flying-tourbillon.
  Units: the case is ~2.4 wide. The dial faces +Z.
  Every part lives in a named "layer" so the caliber can be exploded along Z.

  Realism notes:
  - Metals are physically based and take their look from the environment map, so
    finishes are modelled as surface structure rather than colour: brushed steel and
    circular-grained wheels use anisotropy, bridges carry Geneva stripes, the main
    plate has perlage, and every edge that would be hand-bevelled (anglage) is polished.
  - ExtrudeGeometry puts the flat faces in group 0 and the walls and bevels in group 1,
    so a [finish, polish] material pair gives grained tops with mirror-polished edges.
*/

const TAU = Math.PI * 2;

/* ---------- canvas helpers ---------- */

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function dataTexture(c, { srgb = false, repeat = null } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(repeat, repeat);
  return t;
}

// Deterministic noise so the model looks identical on every load.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/* ---------- surface finishes ---------- */

// Straight satin brushing: fine streaks running along U.
function brushedTexture() {
  const [c, g] = canvas(512);
  const r = rng(7);
  g.fillStyle = 'rgb(190,190,190)';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + r() * 135;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    g.lineWidth = 0.6 + r() * 1.2;
    const y = r() * 512;
    const x = r() * 512;
    g.beginPath();
    g.moveTo(x - 400, y);
    g.lineTo(x + 400, y + (r() - 0.5) * 0.6);
    g.stroke();
  }
  return dataTexture(c, { repeat: 3 });
}

// Tangent-space direction field for concentric (circular-grained) brushing.
// RG = direction, B = strength. UVs are planar and centred on 0.5.
function concentricAnisoTexture() {
  const S = 256;
  const [c, g] = canvas(S);
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) / S - 0.5;
      const v = 0.5 - (py + 0.5) / S;
      const len = Math.hypot(u, v) || 1;
      const i = (py * S + px) * 4;
      img.data[i] = (-v / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (u / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = dataTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Fine concentric rings used as roughness on wheels.
function concentricGrainTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  const r = rng(11);
  g.fillStyle = 'rgb(180,180,180)';
  g.fillRect(0, 0, S, S);
  for (let rad = 2; rad < S * 0.72; rad += 1.1) {
    const v = 120 + r() * 135;
    g.strokeStyle = `rgba(${v},${v},${v},0.5)`;
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(S / 2, S / 2, rad, 0, TAU);
    g.stroke();
  }
  const t = dataTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Côtes de Genève: parallel waves, each band a shallow ridge with its own sheen.
function genevaTexture() {
  const S = 512;
  const bands = 4;
  const [c, g] = canvas(S);
  const bw = S / bands;
  for (let b = 0; b < bands; b++) {
    const gr = g.createLinearGradient(b * bw, 0, (b + 1) * bw, 0);
    gr.addColorStop(0, 'rgb(70,70,70)');
    gr.addColorStop(0.18, 'rgb(150,150,150)');
    gr.addColorStop(0.55, 'rgb(235,235,235)');
    gr.addColorStop(0.92, 'rgb(150,150,150)');
    gr.addColorStop(1, 'rgb(60,60,60)');
    g.fillStyle = gr;
    g.fillRect(b * bw, 0, bw, S);
  }
  // Each wave is cut by a rotating disc, so the bands are curved, not straight.
  const img = g.getImageData(0, 0, S, S);
  const out = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    const shift = Math.round(Math.sin((y / S) * TAU) * bw * 0.18);
    for (let x = 0; x < S; x++) {
      const sx = (x + shift + S) % S;
      const si = (y * S + sx) * 4, di = (y * S + x) * 4;
      out.data[di] = out.data[di + 1] = out.data[di + 2] = img.data[si];
      out.data[di + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return dataTexture(c);
}

// Perlage: overlapping spots of circular graining, as made by a rotating peg.
function perlageTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.fillStyle = 'rgb(150,150,150)';
  g.fillRect(0, 0, S, S);
  const step = 32;
  const rad = step * 0.95;
  for (let row = -1, y = -step; y < S + step; y += step * 0.72, row++) {
    for (let x = -step + (row % 2 ? step * 0.5 : 0); x < S + step; x += step * 0.82) {
      g.save();
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.clip();
      const gr = g.createRadialGradient(x - rad * 0.25, y - rad * 0.25, 1, x, y, rad);
      gr.addColorStop(0, 'rgb(240,240,240)');
      gr.addColorStop(0.6, 'rgb(150,150,150)');
      gr.addColorStop(1, 'rgb(70,70,70)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let k = 3; k < rad; k += 2.2) {
        g.beginPath();
        g.arc(x, y, k, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
  }
  return dataTexture(c, { repeat: 7 });
}

function radialGlowTexture() {
  const [c, g] = canvas(256);
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,170,90,1)');
  gr.addColorStop(0.35, 'rgba(255,110,40,0.4)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return dataTexture(c, { srgb: true });
}

function arcText(g, text, radius, centerAngle, { font, color, spacing = 1, inward = false }) {
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const widths = [...text].map((ch) => g.measureText(ch).width * spacing);
  const total = widths.reduce((a, b) => a + b, 0);
  // Text at the bottom of the dial reads left to right, so it runs counter-clockwise.
  const dir = inward ? -1 : 1;
  let a = centerAngle - dir * (total / radius) / 2;
  [...text].forEach((ch, i) => {
    const half = widths[i] / 2 / radius;
    a += dir * half;
    g.save();
    g.rotate(a);
    g.translate(0, inward ? radius : -radius);
    g.fillText(ch, 0, 0);
    g.restore();
    a += dir * half;
  });
}

// The printed flange: anthracite lacquer with minute track, numerals and signatures.
// Mapped with planar UVs where 2048 px span 1.8 model units.
function dialTexture() {
  const S = 2048;
  const [c, g] = canvas(S);
  const px = S / 1.8;
  g.fillStyle = '#1c1d21';
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  // Faint sunray so the lacquer catches light.
  const r = rng(3);
  for (let i = 0; i < 1400; i++) {
    const a = r() * TAU;
    g.strokeStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(Math.cos(a) * 0.68 * px, Math.sin(a) * 0.68 * px);
    g.lineTo(Math.cos(a) * 0.9 * px, Math.sin(a) * 0.9 * px);
    g.stroke();
  }
  const ink = '#eeeae2';
  g.strokeStyle = ink;
  g.lineCap = 'butt';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const five = i % 5 === 0;
    const r0 = (five ? 0.842 : 0.852) * px;
    const r1 = 0.875 * px;
    g.lineWidth = five ? 6 : 3;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
    // Quarter-second subdivisions between minutes.
    for (let k = 1; k < 4; k++) {
      const b = a + (k / 4) * (TAU / 60);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(Math.cos(b) * 0.864 * px, Math.sin(b) * 0.864 * px);
      g.lineTo(Math.cos(b) * r1, Math.sin(b) * r1);
      g.stroke();
    }
  }
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 0.877 * px, 0, TAU);
  g.stroke();

  g.fillStyle = '#e8a27c';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 68px "Chakra Petch", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';
  const nums = { 10: 10, 2: 2, 4: 4, 8: 8 };
  for (const [label, hour] of Object.entries(nums)) {
    const a = (hour / 12) * TAU - Math.PI / 2;
    const rr = 0.79 * px;
    g.save();
    g.translate(Math.cos(a) * rr, Math.sin(a) * rr);
    g.rotate(a + Math.PI / 2 + (hour > 3 && hour < 9 ? Math.PI : 0));
    g.fillText(label, 0, 0);
    g.restore();
  }
  // Angles are measured from 12 o'clock for outward text and from 6 o'clock for inward text.
  arcText(g, 'CHRONOVA', 0.795 * px, 0, { font: '700 40px "Chakra Petch", Arial, sans-serif', color: ink, spacing: 1.5 });
  arcText(g, 'TOURBILLON', 0.795 * px, 0, { font: '500 28px "Chakra Petch", Arial, sans-serif', color: ink, spacing: 1.5, inward: true });
  arcText(g, 'SWISS MADE', 0.745 * px, 0, { font: '500 19px Arial, sans-serif', color: 'rgba(238,234,226,0.8)', spacing: 1.35, inward: true });
  return dataTexture(c, { srgb: true });
}

// Engraved case back: a ring of text and a fine circular brushing.
function casebackTexture() {
  const S = 1024;
  const [c, g] = canvas(S);
  g.fillStyle = 'rgb(200,200,200)';
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  const px = S / 2 / 1.0;
  for (let rad = 0.62 * px; rad < px; rad += 1.3) {
    g.strokeStyle = `rgba(${150 + Math.random() * 80 | 0},150,150,0.35)`;
    g.beginPath();
    g.arc(0, 0, rad, 0, TAU);
    g.stroke();
  }
  arcText(g, 'CHRONOVA  ·  TYPE-0  ·  FLYING TOURBILLON  ·  SAPPHIRE  ·  100 M  ·  Nº 0042  ·', 0.79 * px, 0, {
    font: '600 30px Arial, sans-serif',
    color: 'rgb(40,40,40)',
    spacing: 1.2,
  });
  return dataTexture(c);
}

function hudRingTexture() {
  const s = 1024;
  const [c, g] = canvas(s);
  g.translate(s / 2, s / 2);
  g.strokeStyle = 'rgba(255,150,70,1)';
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * TAU;
    const long = i % 15 === 0;
    g.lineWidth = long ? 4 : 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 470, Math.sin(a) * 470);
    g.lineTo(Math.cos(a) * (long ? 430 : 452), Math.sin(a) * (long ? 430 : 452));
    g.stroke();
  }
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 500, 0, TAU);
  g.stroke();
  g.setLineDash([18, 14]);
  g.beginPath();
  g.arc(0, 0, 380, 0, TAU);
  g.stroke();
  return dataTexture(c, { srgb: true });
}

/* ---------- geometry helpers ---------- */

// Replace UVs with a planar XY projection: uv = xy * scale + offset.
function planarUV(geo, scale, ox = 0, oy = 0) {
  const p = geo.attributes.position;
  const uv = new THREE.Float32BufferAttribute(p.count * 2, 2);
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + ox, p.getY(i) * scale + oy);
  geo.setAttribute('uv', uv);
  return geo;
}

function superellipse(a, b, n, segs = 480) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * TAU;
    const c = Math.cos(t), si = Math.sin(t);
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = b * Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  return s;
}

function circlePath(r, cx = 0, cy = 0) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, TAU, true);
  return p;
}

function circleShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, TAU, false);
  return s;
}

// Wheel teeth with the rounded ogival tips of horological (cycloidal) gearing.
function toothedShape(teeth, r, tooth) {
  const s = new THREE.Shape();
  const rRoot = r - tooth;
  const step = TAU / teeth;
  const gap = 0.5;
  let first = true;
  const put = (rad, a) => {
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    first ? s.moveTo(x, y) : s.lineTo(x, y);
    first = false;
  };
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (let k = 0; k <= 2; k++) put(rRoot, a + (k / 2) * step * gap);
    for (let k = 1; k <= 8; k++) {
      const t = k / 9;
      put(rRoot + tooth * Math.pow(Math.sin(Math.PI * t), 0.55), a + step * (gap + (1 - gap) * t));
    }
  }
  s.closePath();
  return s;
}

// Cut-outs between spokes, with a rim and a hub.
function addSpokeHoles(shape, rIn, { spokes, hub, spokeW }) {
  if (spokes <= 0 || rIn <= hub + 0.015) return;
  const seg = TAU / spokes;
  for (let k = 0; k < spokes; k++) {
    const a0 = k * seg;
    const go = spokeW / 2 / rIn;
    const gi = spokeW / 2 / hub;
    const h = new THREE.Path();
    h.moveTo(Math.cos(a0 + gi) * hub, Math.sin(a0 + gi) * hub);
    h.absarc(0, 0, rIn, a0 + go, a0 + seg - go, false);
    h.lineTo(Math.cos(a0 + seg - gi) * hub, Math.sin(a0 + seg - gi) * hub);
    h.absarc(0, 0, hub, a0 + seg - gi, a0 + gi, true);
    shape.holes.push(h);
  }
}

function gearGeometry({ teeth, r, depth = 0.022, tooth = 0.018, spokes = 4, hub = 0.04, rim = 0.03, spokeW = 0.026, bore = 0.012 }) {
  const s = toothedShape(teeth, r, tooth);
  addSpokeHoles(s, r - tooth - rim, { spokes, hub, spokeW });
  if (bore) s.holes.push(circlePath(bore));
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0025,
    bevelSegments: 2,
    curveSegments: 10,
  });
  return planarUV(geo, 1 / (2 * r), 0.5, 0.5);
}

function wheelGeometry({ r, rim, spokes, hub, spokeW, depth, bore = 0 }) {
  const s = circleShape(r);
  addSpokeHoles(s, r - rim, { spokes, hub, spokeW });
  if (bore) s.holes.push(circlePath(bore));
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
    curveSegments: 48,
  });
  return planarUV(geo, 1 / (2 * r), 0.5, 0.5);
}

// A bridge arm with rounded ends, already placed in movement coordinates.
function bridgeGeometry(a, b, w, depth) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const s = new THREE.Shape();
  const r = w / 2;
  // Bridges flare where they are screwed down, like a real skeleton bridge.
  s.moveTo(0, -r);
  s.bezierCurveTo(len * 0.4, -r * 0.7, len * 0.7, -r * 0.75, len, -r * 1.15);
  s.absarc(len, 0, r * 1.15, -Math.PI / 2, Math.PI / 2, false);
  s.bezierCurveTo(len * 0.7, r * 0.75, len * 0.4, r * 0.7, 0, r);
  s.absarc(0, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 16,
  });
  geo.rotateZ(Math.atan2(dy, dx));
  geo.translate(a[0], a[1], 0);
  // Planar UVs in movement space keep the Geneva stripes continuous across bridges.
  return planarUV(geo, 1 / 0.5);
}

// Skeletonised "sword" hand with a diamond-cut (faceted) bevel.
function skeletonHandGeometry(len, w, tail) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.32, -tail);
  s.quadraticCurveTo(0, -tail * 1.25, w * 0.32, -tail);
  s.lineTo(w / 2, len * 0.14);
  s.lineTo(w * 0.4, len * 0.86);
  s.lineTo(0, len);
  s.lineTo(-w * 0.4, len * 0.86);
  s.lineTo(-w / 2, len * 0.14);
  s.closePath();
  const h = new THREE.Path();
  const iw = w * 0.2;
  h.moveTo(-iw, len * 0.22);
  h.lineTo(iw, len * 0.22);
  h.lineTo(iw * 0.75, len * 0.8);
  h.lineTo(0, len * 0.87);
  h.lineTo(-iw * 0.75, len * 0.8);
  h.closePath();
  s.holes.push(h);
  s.holes.push(circlePath(w * 0.16, 0, 0));
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.006,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: w * 0.09,
    bevelSegments: 1,
  });
}

function secondsHandGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.004, 0.86);
  s.lineTo(0.004, 0.86);
  s.lineTo(0.009, 0.02);
  s.lineTo(0.009, -0.06);
  s.absarc(0, -0.1, 0.034, Math.PI / 2 - 0.27, -Math.PI * 1.5 + 0.27, true);
  s.lineTo(-0.009, -0.06);
  s.lineTo(-0.009, 0.02);
  s.closePath();
  s.holes.push(circlePath(0.018, 0, -0.1));
  s.holes.push(circlePath(0.008, 0, 0));
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.004,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 24,
  });
}

function indexGeometry(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: w * 0.28,
    bevelSegments: 1,
  });
}

// Lathe built around Y, turned so its axis is Z. Profiles are written from the axis
// (or inner edge) outwards; that order would face the surface away from the viewer,
// so it is reversed unless the profile already runs the other way.
function lathe(points, segs, { flip = true } = {}) {
  const pts = flip ? [...points].reverse() : points;
  const geo = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), segs);
  geo.rotateX(Math.PI / 2);
  return geo;
}

// Push vertices inwards on the outer wall to cut coin-edge flutes.
function fluteRadially(geo, { from, count, depth, sharp = 6 }) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const rad = Math.hypot(x, y);
    if (rad < from) continue;
    const a = Math.atan2(y, x);
    const k = Math.min(1, (rad - from) / 0.01);
    const cut = depth * k * Math.pow(Math.max(0, Math.cos(a * count)), sharp);
    const f = (rad - cut) / rad;
    p.setXY(i, x * f, y * f);
  }
  geo.computeVertexNormals();
  // The lathe's first and last columns sit on top of each other; average their normals
  // so the closing seam doesn't show as a line.
  const { points, segments } = geo.parameters;
  const n = geo.attributes.normal;
  const cols = points.length;
  const v = new THREE.Vector3();
  for (let j = 0; j < cols; j++) {
    const a = j, b = segments * cols + j;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}

// three r16x uses iridescenceThicknessRange; later releases split it into min/max.
function setIridescenceRange(mat, min, max) {
  if ('iridescenceThicknessMinimum' in mat) {
    mat.iridescenceThicknessMinimum = min;
    mat.iridescenceThicknessMaximum = max;
  } else {
    mat.iridescenceThicknessRange = [min, max];
  }
}

/* ---------- the model ---------- */

export function buildWatch() {
  const root = new THREE.Group();
  const layers = {};
  const layer = (name, offset) => {
    const g = new THREE.Group();
    g.userData.offset = offset;
    root.add(g);
    layers[name] = g;
    return g;
  };

  const steelColor = new THREE.Color('#d2d5da');
  const dlcColor = new THREE.Color('#202125');
  const copperColor = new THREE.Color('#e3a27e');
  const copperDarkColor = new THREE.Color('#a8684a');
  const goldDarkColor = new THREE.Color('#b8903f');
  const goldColor = new THREE.Color('#e9c06e');

  const tex = {
    brushed: brushedTexture(),
    aniso: concentricAnisoTexture(),
    grain: concentricGrainTexture(),
    geneva: genevaTexture(),
    perlage: perlageTexture(),
  };

  const mats = {
    // Mirror polish: bezel, crown, bracelet centre links, every bevelled edge.
    steel: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.07 }),
    // Satin brushing with anisotropic highlights.
    brushed: new THREE.MeshPhysicalMaterial({
      color: steelColor.clone(),
      metalness: 1,
      roughness: 0.34,
      roughnessMap: tex.brushed,
      anisotropy: 0.85,
    }),
    // Anthracite (ruthenium-plated) bridges with Geneva stripes.
    gunmetal: new THREE.MeshPhysicalMaterial({
      color: '#7a7e86',
      metalness: 1,
      roughness: 0.28,
      roughnessMap: tex.geneva,
      bumpMap: tex.geneva,
      bumpScale: 0.35,
      anisotropy: 0.6,
      anisotropyRotation: Math.PI / 2,
    }),
    gunmetalPolish: new THREE.MeshPhysicalMaterial({ color: '#a2a6ad', metalness: 1, roughness: 0.06 }),
    // Rhodium-plated main plate with perlage.
    plate: new THREE.MeshPhysicalMaterial({
      color: '#9a9ea5',
      metalness: 1,
      roughness: 0.48,
      roughnessMap: tex.perlage,
      bumpMap: tex.perlage,
      bumpScale: 0.15,
    }),
    // Rose-gold plated wheels with circular graining (soleillage).
    copper: new THREE.MeshPhysicalMaterial({
      color: copperColor.clone(),
      metalness: 1,
      roughness: 0.26,
      roughnessMap: tex.grain,
      anisotropy: 0.9,
      anisotropyMap: tex.aniso,
      emissive: new THREE.Color('#ff6a24'),
      emissiveIntensity: 0,
    }),
    copperPolish: new THREE.MeshPhysicalMaterial({ color: copperColor.clone(), metalness: 1, roughness: 0.06 }),
    copperDark: new THREE.MeshPhysicalMaterial({
      color: copperDarkColor.clone(),
      metalness: 1,
      roughness: 0.3,
      roughnessMap: tex.grain,
      anisotropy: 0.9,
      anisotropyMap: tex.aniso,
    }),
    gold: new THREE.MeshPhysicalMaterial({ color: goldColor.clone(), metalness: 1, roughness: 0.12 }),
    // Heat-blued steel: deep blue with a violet sheen at grazing angles.
    blue: new THREE.MeshPhysicalMaterial({
      color: '#1d3a94',
      metalness: 1,
      roughness: 0.1,
      iridescence: 0.7,
      iridescenceIOR: 1.6,
    }),
    screwSlot: new THREE.MeshStandardMaterial({ color: '#05070d', metalness: 1, roughness: 0.6 }),
    // Synthetic ruby jewels: transparent and refractive.
    ruby: new THREE.MeshPhysicalMaterial({
      color: '#ff3350',
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      ior: 1.76,
      thickness: 0.02,
      attenuationColor: new THREE.Color('#a80019'),
      attenuationDistance: 0.015,
      specularIntensity: 1,
    }),
    dial: new THREE.MeshPhysicalMaterial({
      map: dialTexture(),
      metalness: 0.25,
      roughness: 0.5,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    }),
    // Lacquered seconds hand.
    orange: new THREE.MeshPhysicalMaterial({
      color: '#ff5a1c',
      metalness: 0.2,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      emissive: '#ff4410',
      emissiveIntensity: 0,
    }),
    // Super-LumiNova: chalky white by day, green-blue in the dark.
    lume: new THREE.MeshPhysicalMaterial({ color: '#eef3e6', roughness: 0.75, emissive: '#6dffc8', emissiveIntensity: 0 }),
    // Sapphire crystal with a faint blue anti-reflective coating.
    crystal: new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0,
      roughness: 0,
      transmission: 1,
      ior: 1.77,
      thickness: 0.03,
      specularIntensity: 1,
      iridescence: 0.45,
      iridescenceIOR: 1.38,
    }),
    hairspring: new THREE.MeshPhysicalMaterial({ color: '#7f8fb3', metalness: 1, roughness: 0.18, emissive: '#ff7a2a', emissiveIntensity: 0 }),
  };
  const gilt = [mats.copper, mats.copperPolish];
  // Coating thickness (nm) sets the hue of the interference sheen.
  setIridescenceRange(mats.blue, 240, 420);
  setIridescenceRange(mats.crystal, 180, 260);

  /* case back: brushed, engraved, with a sapphire exhibition window */
  const back = layer('caseback', -1.25);
  {
    const backTex = casebackTexture();
    const backMat = new THREE.MeshPhysicalMaterial({
      color: steelColor.clone(),
      metalness: 1,
      roughness: 0.32,
      roughnessMap: backTex,
      bumpMap: backTex,
      bumpScale: 1.5,
    });
    const geo = lathe([[0.6, -0.24], [0.6, -0.27], [0.66, -0.3], [0.93, -0.31], [0.97, -0.29], [0.98, -0.24]], 128, { flip: false });
    planarUV(geo, 0.5, 0.5, 0.5);
    back.add(new THREE.Mesh(geo, backMat));
    // Exhibition window: smoked sapphire rendered as clear glass so the plate shows through.
    const win = new THREE.Mesh(
      new THREE.CylinderGeometry(0.61, 0.61, 0.025, 96),
      new THREE.MeshPhysicalMaterial({ color: '#0c0d10', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1, specularIntensity: 1 })
    );
    win.rotation.x = Math.PI / 2;
    win.position.z = -0.27;
    back.add(win);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const scr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 24), mats.steel);
      scr.rotation.x = Math.PI / 2;
      scr.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, -0.315);
      back.add(scr);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.01), mats.screwSlot);
      slot.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, -0.325);
      slot.rotation.z = a;
      back.add(slot);
    }
  }

  /* middle case: rounded cushion with brushed flanks and polished chamfers */
  const caseL = layer('case', -0.7);
  {
    const shape = superellipse(1.15, 1.25, 2.9);
    shape.holes.push(circlePath(0.9));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 6,
      curveSegments: 128,
    });
    planarUV(g, 0.5);
    const m = new THREE.Mesh(g, [mats.brushed, mats.steel]);
    m.position.z = -0.24;
    caseL.add(m);

    // Crown: coin-edge knurling, a polished signed cap and a tube into the case.
    const crown = new THREE.Group();
    const knurl = fluteRadially(lathe([[0, -0.075], [0.098, -0.075], [0.108, -0.06], [0.108, 0.06], [0.098, 0.075], [0, 0.075]], 360, { flip: false }), {
      from: 0.1,
      count: 36,
      depth: 0.012,
      sharp: 2,
    });
    const knurled = new THREE.Mesh(knurl, mats.steel);
    knurled.rotation.y = Math.PI / 2;
    crown.add(knurled);
    const cap = new THREE.Mesh(lathe([[0, 0.088], [0.06, 0.084], [0.085, 0.078], [0.09, 0.075]], 64), mats.steel);
    cap.rotation.y = Math.PI / 2;
    crown.add(cap);
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 48), mats.gold);
    emblem.rotation.y = Math.PI / 2;
    emblem.position.x = 0.088;
    crown.add(emblem);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 32), mats.steel);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = -0.1;
    crown.add(tube);
    crown.position.set(1.3, 0, -0.08);
    caseL.add(crown);
    for (const s of [-1, 1]) {
      const guard = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.07, 0.2, 4, 0.03), mats.brushed);
      guard.position.set(1.22, s * 0.16, -0.08);
      caseL.add(guard);
    }
  }

  /* main plate with perlage */
  const plateL = layer('plate', -0.25);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.04, 128), mats.plate);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.12;
    plateL.add(m);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: radialGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })
    );
    glow.position.set(0, -0.15, -0.085);
    glow.userData.noShadow = true;
    plateL.add(glow);
    plateL.userData.glow = glow;
  }

  /* gear train */
  const gearsL = layer('gears', 0.12);
  const gears = [];
  {
    const spec = [
      { name: 'barrel', x: 0, y: 0.38, teeth: 96, r: 0.29, spokes: 5, speed: 0.04, mat: 'copper', hub: 0.07 },
      { name: 'center', x: 0, y: 0.02, teeth: 80, r: 0.2, spokes: 4, speed: -0.22, mat: 'copper' },
      { name: 'third', x: -0.36, y: -0.1, teeth: 72, r: 0.16, spokes: 4, speed: 0.5, mat: 'copper' },
      { name: 'fourth', x: 0.35, y: -0.08, teeth: 64, r: 0.15, spokes: 4, speed: -0.9, mat: 'copper' },
      { name: 'winding', x: -0.46, y: 0.32, teeth: 40, r: 0.11, spokes: 3, speed: 0.3, mat: 'copperDark' },
      { name: 'ratchet', x: 0.46, y: 0.3, teeth: 44, r: 0.12, spokes: 0, speed: -0.25, mat: 'gold' },
      { name: 'escape', x: 0.2, y: -0.55, teeth: 15, r: 0.075, spokes: 5, speed: 2.4, mat: 'gold', hub: 0.018, rim: 0.012, spokeW: 0.009, tooth: 0.024 },
    ];
    const pinionGeo = gearGeometry({ teeth: 10, r: 0.034, tooth: 0.011, spokes: 0, depth: 0.07, bore: 0 });
    spec.forEach((s, i) => {
      const geo = gearGeometry({
        teeth: s.teeth,
        r: s.r,
        spokes: s.spokes,
        hub: s.hub ?? 0.038,
        rim: s.rim ?? 0.028,
        spokeW: s.spokeW ?? 0.022,
        tooth: s.tooth ?? Math.min(0.018, (TAU * s.r) / s.teeth * 0.75),
      });
      const face = mats[s.mat];
      const edge = s.mat === 'gold' ? mats.gold : mats.copperPolish;
      const m = new THREE.Mesh(geo, [face, edge]);
      m.position.set(s.x, s.y, -0.08 + (i % 2) * 0.03);
      m.userData.speed = s.speed;
      gearsL.add(m);
      gears.push(m);
      const pinion = new THREE.Mesh(pinionGeo, mats.steel);
      pinion.position.set(s.x, s.y, -0.095);
      pinion.userData.speed = s.speed;
      gearsL.add(pinion);
      gears.push(pinion);
      // Polished pivot arbor.
      const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 12), mats.steel);
      arbor.rotation.x = Math.PI / 2;
      arbor.position.set(s.x, s.y, -0.04);
      gearsL.add(arbor);
    });
    // Barrel cover: the mainspring housing, grained like the wheels.
    const cover = new THREE.Mesh(wheelGeometry({ r: 0.235, rim: 0, spokes: 0, hub: 0, spokeW: 0, depth: 0.012, bore: 0.03 }), [mats.copperDark, mats.copperPolish]);
    cover.position.set(0, 0.38, -0.05);
    cover.userData.speed = 0.04;
    gearsL.add(cover);
    gears.push(cover);
  }

  /* skeleton bridges with blued screws and jewels */
  const bridgesL = layer('bridges', 0.48);
  {
    const arms = [
      [[0, 0.38], [-0.62, 0.5], 0.075],
      [[0, 0.38], [0.62, 0.5], 0.075],
      [[0, 0.38], [0, 0.82], 0.07],
      [[-0.36, -0.1], [-0.8, -0.02], 0.06],
      [[-0.36, -0.1], [-0.6, -0.5], 0.06],
      [[0.35, -0.08], [0.8, 0.02], 0.06],
      [[0.35, -0.08], [0.6, -0.48], 0.06],
    ];
    const screwHead = lathe([[0, 0.016], [0.018, 0.013], [0.027, 0.006], [0.03, 0], [0.03, -0.008], [0, -0.008]], 32);
    let seed = 0;
    const addScrew = (x, y) => {
      const head = new THREE.Mesh(screwHead, mats.blue);
      head.position.set(x, y, 0.046);
      bridgesL.add(head);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.007, 0.012), mats.screwSlot);
      slot.position.set(x, y, 0.059);
      slot.rotation.z = (seed++ * 2.39996) % Math.PI;
      bridgesL.add(slot);
    };
    const chatonGeo = lathe([[0.012, 0.004], [0.028, 0.008], [0.036, 0.004], [0.038, -0.006], [0.02, -0.006]], 40);
    const rubyGeo = lathe([[0, 0.006], [0.012, 0.0055], [0.02, 0.003], [0.021, -0.004], [0, -0.004]], 32);
    const addJewel = (x, y, z) => {
      const setting = new THREE.Mesh(chatonGeo, mats.gold);
      setting.position.set(x, y, z);
      bridgesL.add(setting);
      const j = new THREE.Mesh(rubyGeo, mats.ruby);
      j.position.set(x, y, z + 0.002);
      bridgesL.add(j);
    };
    arms.forEach(([a, b, w]) => {
      bridgesL.add(new THREE.Mesh(bridgeGeometry(a, b, w, 0.026), [mats.gunmetal, mats.gunmetalPolish]));
      addScrew(b[0], b[1]);
    });
    [[0, 0.38], [-0.36, -0.1], [0.35, -0.08]].forEach(([x, y]) => addJewel(x, y, 0.042));
  }

  /* flying tourbillon at 6 o'clock */
  const tourL = layer('tourbillon', 0.85);
  const tour = { cage: new THREE.Group(), balance: new THREE.Group(), spring: null };
  {
    const base = new THREE.Group();
    base.position.set(0, -0.42, 0.06);
    tourL.add(base);
    base.add(tour.cage);
    // Polished three-arm cage, cut from one piece.
    const cageFrame = new THREE.Mesh(wheelGeometry({ r: 0.21, rim: 0.018, spokes: 3, hub: 0.045, spokeW: 0.03, depth: 0.012, bore: 0.022 }), [mats.steel, mats.steel]);
    cageFrame.position.z = 0.026;
    cageFrame.rotation.z = Math.PI / 2;
    tour.cage.add(cageFrame);
    const lower = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 12, 96), mats.gold);
    lower.position.z = -0.02;
    tour.cage.add(lower);
    const screwGeo = lathe([[0, 0.01], [0.012, 0.008], [0.016, 0.003], [0.016, -0.004], [0, -0.004]], 24);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + Math.PI / 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 12), mats.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.003);
      tour.cage.add(post);
      const scr = new THREE.Mesh(screwGeo, mats.blue);
      scr.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.044);
      tour.cage.add(scr);
    }
    tour.cage.add(tour.balance);
    // Glucydur-style balance with timing screws on the rim.
    const wheel = new THREE.Mesh(wheelGeometry({ r: 0.135, rim: 0.016, spokes: 2, hub: 0.02, spokeW: 0.016, depth: 0.012, bore: 0.006 }), [mats.gold, mats.gold]);
    wheel.position.z = -0.006;
    tour.balance.add(wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.016, 12), mats.gold);
      w.position.set(Math.cos(a) * 0.141, Math.sin(a) * 0.141, 0);
      w.rotation.z = a - Math.PI / 2;
      tour.balance.add(w);
    }
    // Hairspring: a flat Archimedean spiral in blued steel, with an overcoil terminal.
    const pts = [];
    const turns = 11;
    for (let i = 0; i <= 900; i++) {
      const t = i / 900;
      const a = t * turns * TAU;
      const r = 0.02 + t * 0.082;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.016 + (t > 0.96 ? (t - 0.96) * 0.15 : 0)));
    }
    tour.spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1400, 0.0012, 5, false), mats.hairspring);
    tour.cage.add(tour.spring);
    const collet = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16), mats.steel);
    collet.rotation.x = Math.PI / 2;
    collet.position.z = 0.016;
    tour.cage.add(collet);
    const jewel = new THREE.Mesh(lathe([[0, 0.006], [0.014, 0.005], [0.02, 0.002], [0.02, -0.004], [0, -0.004]], 24), mats.ruby);
    jewel.position.z = 0.04;
    tour.cage.add(jewel);
    const jSet = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 10, 32), mats.gold);
    jSet.position.z = 0.04;
    tour.cage.add(jSet);
  }

  /* flange (sloped chapter ring) with printed track and applied indices */
  const ringL = layer('ring', 1.15);
  {
    const geo = lathe([[0.7, 0.08], [0.72, 0.085], [0.88, 0.14], [0.9, 0.12], [0.9, 0.06]], 160);
    planarUV(geo, 1 / 1.8, 0.5, 0.5);
    ringL.add(new THREE.Mesh(geo, mats.dial));
    // Faceted applied indices with lume inserts; a double index at noon and none at
    // six, where the tourbillon aperture and signature sit.
    const idx = indexGeometry(0.024, 0.07);
    const lumeGeo = new THREE.BoxGeometry(0.01, 0.05, 0.006);
    const count = 12;
    const markers = new THREE.InstancedMesh(idx, [mats.copperPolish, mats.copperPolish], count);
    const lumes = new THREE.InstancedMesh(lumeGeo, mats.lume, count);
    const d = new THREE.Object3D();
    let mi = 0;
    for (let i = 0; i < 12; i++) {
      if (i === 6) continue;
      const a = (i / 12) * TAU;
      const offsets = i === 0 ? [-0.022, 0.022] : [0];
      for (const off of offsets) {
        const x = Math.sin(a) * 0.755 + Math.cos(a) * off;
        const y = Math.cos(a) * 0.755 - Math.sin(a) * off;
        d.position.set(x, y, 0.09);
        d.rotation.set(0, 0, -a);
        d.updateMatrix();
        markers.setMatrixAt(mi, d.matrix);
        d.position.z = 0.107;
        d.updateMatrix();
        lumes.setMatrixAt(mi, d.matrix);
        mi++;
      }
    }
    ringL.add(markers, lumes);
  }

  /* hands */
  const handsL = layer('hands', 1.45);
  const hands = {};
  {
    hands.hour = new THREE.Group();
    hands.hour.add(new THREE.Mesh(skeletonHandGeometry(0.42, 0.075, 0.06), [mats.copperPolish, mats.copperPolish]));
    const hl = new THREE.Mesh(new RoundedBoxGeometry(0.016, 0.17, 0.006, 2, 0.003), mats.lume);
    hl.position.set(0, 0.25, 0.008);
    hands.hour.add(hl);
    hands.hour.position.z = 0.16;
    hands.minute = new THREE.Group();
    hands.minute.add(new THREE.Mesh(skeletonHandGeometry(0.66, 0.06, 0.08), [mats.copperPolish, mats.copperPolish]));
    const ml = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.32, 0.006, 2, 0.003), mats.lume);
    ml.position.set(0, 0.39, 0.008);
    hands.minute.add(ml);
    hands.minute.position.z = 0.182;
    hands.second = new THREE.Group();
    hands.second.add(new THREE.Mesh(secondsHandGeometry(), mats.orange));
    hands.second.position.z = 0.205;
    const cap = new THREE.Mesh(lathe([[0, 0.012], [0.014, 0.01], [0.022, 0.004], [0.024, -0.008], [0, -0.008]], 32), mats.orange);
    cap.position.z = 0.215;
    handsL.add(hands.hour, hands.minute, hands.second, cap);
  }

  /* bezel: polished, with a coin-edge flank */
  const bezelL = layer('bezel', 1.8);
  {
    const geo = lathe([[0.88, 0.13], [0.9, 0.2], [0.93, 0.225], [0.99, 0.238], [1.04, 0.226], [1.07, 0.2], [1.08, 0.16], [1.08, 0.08], [1.06, 0.06]], 960);
    fluteRadially(geo, { from: 1.066, count: 120, depth: 0.012, sharp: 3 });
    bezelL.add(new THREE.Mesh(geo, mats.steel));
  }

  /* sapphire crystal with a bevelled edge */
  const crystalL = layer('crystal', 2.1);
  {
    const m = new THREE.Mesh(lathe([[0, 0.25], [0.88, 0.25], [0.9, 0.243], [0.9, 0.225], [0, 0.225]], 128), mats.crystal);
    m.userData.noShadow = true;
    crystalL.add(m);
  }

  /*
    Integrated bracelet: polished centre links, brushed outer links.
    The links follow one closed path round the wrist (about 170 mm, scaled to
    the 42 mm case) from the 12 o'clock lugs to the 6 o'clock lugs, and the two
    halves meet at a folding clasp under the wrist.
  */
  const bracelet = new THREE.Group();
  root.add(bracelet);
  {
    const center = new RoundedBoxGeometry(0.33, 0.232, 0.15, 4, 0.03);
    const outer = new RoundedBoxGeometry(0.42, 0.236, 0.17, 4, 0.035);
    const V = (y, z) => new THREE.Vector3(0, y, z);
    // Wrist path in the YZ plane, starting at the top lugs and ending at the bottom lugs.
    const path = new THREE.CatmullRomCurve3([
      V(1.2, -0.1), V(1.55, -0.24), V(1.8, -0.58), V(1.9, -1.08), V(1.78, -1.62), V(1.38, -2.08),
      V(0.72, -2.37), V(0, -2.45), V(-0.72, -2.37), V(-1.38, -2.08), V(-1.78, -1.62), V(-1.9, -1.08),
      V(-1.8, -0.58), V(-1.55, -0.24), V(-1.2, -0.1),
    ], false, 'centripetal');
    const L = path.getLength();
    const pitch = 0.238;
    const claspHalf = 0.46;
    // Orient a part so its local Y runs along the bracelet and local Z faces away from the wrist.
    const place = (obj, dist) => {
      const t = dist / L;
      const P = path.getPointAt(t);
      const T = path.getTangentAt(t);
      obj.position.copy(P);
      obj.rotation.x = Math.atan2(T.z, T.y);
    };
    const makeLink = (widen) => {
      const link = new THREE.Group();
      const c = new THREE.Mesh(center, mats.steel);
      c.scale.x = widen;
      c.position.z = 0.01;
      link.add(c);
      for (const sx of [-1, 1]) {
        const o = new THREE.Mesh(outer, mats.brushed);
        o.position.x = sx * 0.39 * widen;
        o.scale.x = widen;
        link.add(o);
      }
      return link;
    };
    // Same number of links on each half, so the clasp sits centred under the wrist.
    const count = Math.floor((L / 2 - claspHalf - 0.125) / pitch) + 1;
    for (let k = 0; k < count; k++) {
      const d = 0.125 + k * pitch;
      const widen = k < 2 ? 1.25 - k * 0.1 : 1; // end links flare into the case
      for (const dist of [d, L - d]) {
        const link = makeLink(widen);
        place(link, dist);
        bracelet.add(link);
      }
    }
    // Folding clasp: polished cover, brushed blade, hinge barrels and release pushers.
    const clasp = new THREE.Group();
    const cover = new THREE.Mesh(new RoundedBoxGeometry(0.98, claspHalf * 2 - 0.04, 0.07, 4, 0.03), mats.steel);
    cover.position.z = 0.045;
    clasp.add(cover);
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.9, claspHalf * 2 - 0.1, 0.06, 4, 0.025), mats.brushed);
    blade.position.z = -0.02;
    clasp.add(blade);
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.01), mats.brushed);
    groove.position.z = 0.081;
    clasp.add(groove);
    for (const sy of [-1, 1]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.96, 24), mats.steel);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(0, sy * (claspHalf - 0.02), 0.0);
      clasp.add(hinge);
    }
    for (const sx of [-1, 1]) {
      const pusher = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.16, 0.06, 3, 0.02), mats.steel);
      pusher.position.set(sx * 0.505, 0, 0.02);
      clasp.add(pusher);
    }
    place(clasp, L / 2);
    bracelet.add(clasp);
  }

  /* holographic platform rings shown in the exploded view */
  const hud = new THREE.Group();
  root.add(hud);
  const hudMat = new THREE.MeshBasicMaterial({ map: hudRingTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
  {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), hudMat);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), hudMat);
    b.position.z = 0.25;
    a.userData.noShadow = b.userData.noShadow = true;
    hud.add(a, b);
    hud.userData.a = a;
    hud.userData.b = b;
  }

  root.traverse((o) => {
    if (!o.isMesh) return;
    const off = o.userData.noShadow;
    o.castShadow = !off;
    o.receiveShadow = !off;
  });

  const glowLight = new THREE.PointLight('#ff6a24', 0, 4, 1.6);
  glowLight.position.set(0, -0.25, 0.05);
  root.add(glowLight);

  // Interest points used to pin DOM labels onto the movement.
  const hotspots = {
    tourbillon: new THREE.Vector3(0, -0.42, 0.1),
    barrel: new THREE.Vector3(0, 0.38, 0.06),
    escape: new THREE.Vector3(0.35, -0.08, 0.06),
    balance: new THREE.Vector3(-0.36, -0.1, 0.06),
  };

  const tmpColor = new THREE.Color();

  /* per-frame update: time in seconds, pose = smoothed scene state */
  function update(time, pose, dt) {
    // Explode layers along local Z.
    for (const g of Object.values(layers)) g.position.z = g.userData.offset * pose.explode * 1.35;
    const caseScale = Math.max(0.0001, 1 - pose.explode * 1.4);
    layers.case.scale.setScalar(caseScale);
    layers.case.visible = caseScale > 0.02;

    // Bracelet fades away as the caliber opens.
    const bScale = Math.max(0.0001, 1 - pose.explode * 1.6) * pose.bracelet;
    bracelet.visible = bScale > 0.02;
    bracelet.scale.setScalar(Math.max(bScale, 0.0001));

    hud.position.z = -1.9 * pose.explode - 0.4;
    hudMat.opacity = pose.hud * 0.85;
    hud.userData.a.rotation.z = time * 0.08;
    hud.userData.b.rotation.z = -time * 0.15;
    hud.visible = pose.hud > 0.01;

    // Finishes: polished steel to black DLC, rose gold to yellow gold.
    tmpColor.copy(steelColor).lerp(dlcColor, pose.finish);
    mats.steel.color.copy(tmpColor);
    mats.brushed.color.copy(tmpColor).multiplyScalar(0.94);
    mats.steel.roughness = 0.07 + pose.finish * 0.2;
    mats.brushed.roughness = 0.34 + pose.finish * 0.1;
    tmpColor.copy(copperColor).lerp(goldColor, pose.gold);
    for (const m of gilt) m.color.copy(tmpColor);
    mats.copperDark.color.copy(copperDarkColor).lerp(goldDarkColor, pose.gold);

    // Warm light from the movement is a lighting effect, so it stays subtle on the metal.
    mats.copper.emissiveIntensity = pose.glow * 0.08;
    mats.hairspring.emissiveIntensity = pose.glow * 0.25;
    mats.orange.emissiveIntensity = pose.glow * 0.05;
    mats.lume.emissiveIntensity = pose.lume * 2.4;
    // The warm bloom only appears in the dramatic, high-glow scenes.
    const bloom = Math.max(0, pose.glow - 0.5);
    plateL.userData.glow.material.opacity = bloom * 0.45;
    glowLight.intensity = bloom * 4;
    glowLight.distance = 4 * root.scale.x;

    // Gear train turns; speed multiplier from the timeline.
    const k = pose.speed;
    for (const g of gears) g.rotation.z += g.userData.speed * dt * k;

    // Balance at 4 Hz (28,800 vibrations per hour), tourbillon cage 1 rev / 60 s.
    tour.balance.rotation.z = Math.sin(time * TAU * 4) * 1.4;
    tour.spring.rotation.z = tour.balance.rotation.z * 0.25;
    tour.spring.scale.set(1 + Math.sin(time * TAU * 4) * 0.03, 1 + Math.sin(time * TAU * 4) * 0.03, 1);
    tour.cage.rotation.z -= (TAU / 60) * dt * Math.max(1, k * 4);

    // Real time on the dial; the seconds hand jumps in 1/8 s steps like a 4 Hz movement.
    const now = new Date();
    const ms = now.getMilliseconds();
    const s = now.getSeconds() + Math.floor(ms / 125) / 8;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;
    hands.second.rotation.z = -(s / 60) * TAU;
    hands.minute.rotation.z = -(m / 60) * TAU;
    hands.hour.rotation.z = -(h / 12) * TAU;
  }

  return { root, update, mats, hotspots };
}
