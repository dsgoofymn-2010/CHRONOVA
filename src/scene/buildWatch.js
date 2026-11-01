import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
  Procedural model of the Chronova Type-0, a skeletonised flying-tourbillon.
  Round 42 mm case with sculpted lugs, domed sapphire and a stitched leather strap.
  The gear train is laid out from real tooth counts: each wheel sits at the
  distance where its teeth meet the next pinion, and every speed follows from
  the ratios (the centre wheel turns once an hour, the tourbillon once a minute).
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
  const nums = {};
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

/* ---------- extra parts for the round case ---------- */

// Sawtooth ratchet wheel that sits on the barrel arbor.
function ratchetGeometry(teeth, r, tooth, depth) {
  const s = new THREE.Shape();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const p0 = [Math.cos(a) * (r - tooth), Math.sin(a) * (r - tooth)];
    const p1 = [Math.cos(a + step * 0.85) * r, Math.sin(a + step * 0.85) * r];
    const p2 = [Math.cos(a + step) * (r - tooth), Math.sin(a + step) * (r - tooth)];
    i === 0 ? s.moveTo(...p0) : s.lineTo(...p0);
    s.lineTo(...p1);
    s.lineTo(...p2);
  }
  s.holes.push(circlePath(0.02));
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.002, bevelSegments: 1 });
  return planarUV(geo, 1 / (2 * r), 0.5, 0.5);
}

// Swiss-lever escape wheel: 15 club teeth leaning in the direction of travel.
function escapeWheelGeometry(r, depth) {
  const teeth = 15;
  const s = new THREE.Shape();
  const root = r * 0.62;
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [root, a],
      [r * 0.97, a + step * 0.42],
      [r, a + step * 0.5],
      [r * 0.9, a + step * 0.56],
      [root * 1.05, a + step * 0.35 + step * 0.4],
    ];
    pts.forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
      i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  addSpokeHoles(s, root - 0.008, { spokes: 4, hub: 0.012, spokeW: 0.006 });
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1 });
}

// Faceted dauphine hand: a raised ridge down the centre and two flat facets each side.
function dauphineHandGeometry(len, w, tail, ridge) {
  const outline = [
    [0, len], [w * 0.5, len * 0.12], [w * 0.32, -tail], [0, -tail * 1.15],
    [-w * 0.32, -tail], [-w * 0.5, len * 0.12],
  ];
  const top = [0, len * 0.12, ridge]; // highest point of the ridge
  const tip = [0, len, ridge * 0.15];
  const back = [0, -tail * 1.15, ridge * 0.4];
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const R = [w * 0.5, len * 0.12, 0], L = [-w * 0.5, len * 0.12, 0];
  const RB = [w * 0.32, -tail, 0], LB = [-w * 0.32, -tail, 0];
  // Upper facets.
  tri(tip, R, top); tri(tip, top, L);
  tri(top, R, RB); tri(top, RB, back);
  tri(top, back, LB); tri(top, LB, L);
  // Underside.
  const z0 = -0.004;
  const u = outline.map(([x, y]) => [x, y, z0]);
  for (let i = 1; i < u.length - 1; i++) tri(u[0], u[i + 1], u[i]);
  // Thin polished walls.
  const ring = [tip, R, RB, back, LB, L].map((p, i) => [p, [outline[i][0], outline[i][1], z0]]);
  for (let i = 0; i < ring.length; i++) {
    const [a, a0] = ring[i], [b, b0] = ring[(i + 1) % ring.length];
    const ta = [a[0], a[1], Math.min(a[2], 0.001)], tb = [b[0], b[1], Math.min(b[2], 0.001)];
    tri(ta, a0, b0); tri(ta, b0, tb);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Lug drawn as a side profile (y along the watch, z up) and extruded across its width.
function lugGeometry(width, flip) {
  const sy = flip ? -1 : 1;
  const P = (y, z) => new THREE.Vector2(y * sy, z);
  const s = new THREE.Shape();
  s.moveTo(0.7 * sy, 0.06);
  s.splineThru([P(0.92, 0.045), P(1.1, 0.0), P(1.24, -0.08), P(1.3, -0.16), P(1.29, -0.24), P(1.22, -0.29)]);
  s.splineThru([P(1.06, -0.28), P(0.88, -0.25), P(0.7, -0.24)]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 32,
  });
  // Shape x -> watch y, shape y -> watch z, extrusion -> watch x.
  geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  geo.translate(-width / 2, 0, 0);
  planarUV(geo, 2);
  return geo;
}

// Leather: dark grain with contrast saddle stitching along both edges.
function leatherTextures() {
  const W = 256, H = 256;
  const [c, g] = canvas(W, H);
  const r = rng(29);
  g.fillStyle = '#1d1916';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) {
    const v = 18 + r() * 26;
    g.fillStyle = `rgba(${v + 6},${v + 2},${v},${0.35 + r() * 0.4})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  // Painted edges.
  g.fillStyle = '#120f0d';
  g.fillRect(0, 0, 6, H);
  g.fillRect(W - 6, 0, 6, H);
  // Stitches: angled, slightly irregular, like hand-sewn saddle stitch.
  for (const x of [20, W - 20]) {
    for (let y = 4; y < H; y += 16) {
      g.save();
      g.translate(x, y + 6);
      g.rotate(-0.35);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(-2.5, -6, 5, 13);
      g.fillStyle = '#c98a55';
      g.fillRect(-2, -6, 4, 11);
      g.fillStyle = 'rgba(255,220,180,0.35)';
      g.fillRect(-1, -5, 1.2, 9);
      g.restore();
    }
  }
  const map = dataTexture(c, { srgb: true });
  // Height map for the grain and stitch relief.
  const [b, h] = canvas(W, H);
  const r2 = rng(31);
  h.fillStyle = 'rgb(128,128,128)';
  h.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const v = 90 + r2() * 90;
    h.fillStyle = `rgba(${v},${v},${v},0.5)`;
    h.beginPath();
    h.arc(r2() * W, r2() * H, 0.8 + r2() * 1.8, 0, TAU);
    h.fill();
  }
  for (const x of [20, W - 20]) {
    h.fillStyle = 'rgb(70,70,70)';
    h.fillRect(x - 5, 0, 10, H);
    for (let y = 4; y < H; y += 16) {
      h.save();
      h.translate(x, y + 6);
      h.rotate(-0.35);
      h.fillStyle = 'rgb(230,230,230)';
      h.fillRect(-2, -6, 4, 11);
      h.restore();
    }
  }
  const bump = dataTexture(b);
  return { map, bump };
}

// Strap swept along a curve in the YZ plane, with a rounded-rectangle cross-section.
function strapGeometry(points, { side, w0, w1, t0, t1, segs = 90, ring = 28, tile = 0.5 }) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const length = curve.getLength();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const P = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    // Normal in the YZ plane, pointing away from the wrist.
    const N = new THREE.Vector3(0, -T.z * side, T.y * side).normalize();
    const w = THREE.MathUtils.lerp(w0, w1, Math.min(1, t * 1.6)) / 2;
    const h = THREE.MathUtils.lerp(t0, t1, t) / 2;
    for (let k = 0; k <= ring; k++) {
      const a = (k / ring) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = w * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / 7);
      const y = h * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / 7);
      pos.push(x, P.y + N.y * y, P.z + N.z * y);
      uv.push(x / (2 * w) + 0.5, (t * length) / tile);
    }
  }
  const row = ring + 1;
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < ring; k++) {
      const a = i * row + k, b = a + row, c = a + 1, d = b + 1;
      if (side > 0) idx.push(a, b, c, c, b, d);
      else idx.push(a, c, b, c, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Printed seconds track around the tourbillon aperture (the cage is the seconds hand).
function secondsTrackTexture() {
  const S = 512;
  const [c, g] = canvas(S);
  g.translate(S / 2, S / 2);
  const px = S / 2 / 0.26;
  g.strokeStyle = '#eeeae2';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - Math.PI / 2;
    const five = i % 5 === 0;
    g.lineWidth = five ? 3 : 1.4;
    const r0 = (five ? 0.224 : 0.232) * px, r1 = 0.244 * px;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(0, 0, 0.246 * px, 0, TAU);
  g.stroke();
  return dataTexture(c, { srgb: true });
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
    leather: leatherTextures(),
  };

  const mats = {
    steel: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.07 }),
    brushed: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.34, roughnessMap: tex.brushed, anisotropy: 0.85 }),
    // Ratchet and crown wheel: steel with a sunburst (soleil) finish.
    soleil: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.22, roughnessMap: tex.grain, anisotropy: 0.9, anisotropyMap: tex.aniso }),
    gunmetal: new THREE.MeshPhysicalMaterial({
      color: '#7a7e86', metalness: 1, roughness: 0.28, roughnessMap: tex.geneva, bumpMap: tex.geneva, bumpScale: 0.35, anisotropy: 0.6, anisotropyRotation: Math.PI / 2,
    }),
    gunmetalPolish: new THREE.MeshPhysicalMaterial({ color: '#a2a6ad', metalness: 1, roughness: 0.06 }),
    plate: new THREE.MeshPhysicalMaterial({ color: '#5f636a', metalness: 1, roughness: 0.48, roughnessMap: tex.perlage, bumpMap: tex.perlage, bumpScale: 0.15 }),
    copper: new THREE.MeshPhysicalMaterial({
      color: copperColor.clone(), metalness: 1, roughness: 0.26, roughnessMap: tex.grain, anisotropy: 0.9, anisotropyMap: tex.aniso, emissive: new THREE.Color('#ff6a24'), emissiveIntensity: 0,
    }),
    copperPolish: new THREE.MeshPhysicalMaterial({ color: copperColor.clone(), metalness: 1, roughness: 0.06 }),
    copperDark: new THREE.MeshPhysicalMaterial({ color: copperDarkColor.clone(), metalness: 1, roughness: 0.3, roughnessMap: tex.grain, anisotropy: 0.9, anisotropyMap: tex.aniso }),
    gold: new THREE.MeshPhysicalMaterial({ color: goldColor.clone(), metalness: 1, roughness: 0.12 }),
    blue: new THREE.MeshPhysicalMaterial({ color: '#1d3a94', metalness: 1, roughness: 0.1, iridescence: 0.7, iridescenceIOR: 1.6 }),
    screwSlot: new THREE.MeshStandardMaterial({ color: '#05070d', metalness: 1, roughness: 0.6 }),
    // Synthetic ruby: deep red with a glassy clearcoat. (No transmission, which would
    // cost a full extra render pass every frame.)
    ruby: new THREE.MeshPhysicalMaterial({
      color: '#b0001c', metalness: 0, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0, specularIntensity: 1, ior: 1.76,
      emissive: '#3a0008', sheen: 1, sheenColor: new THREE.Color('#ff3350'), sheenRoughness: 0.3,
    }),
    dial: new THREE.MeshPhysicalMaterial({ map: dialTexture(), metalness: 0.25, roughness: 0.5, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
    track: new THREE.MeshPhysicalMaterial({ map: secondsTrackTexture(), transparent: true, metalness: 0.2, roughness: 0.5, depthWrite: false }),
    orange: new THREE.MeshPhysicalMaterial({ color: '#ff5a1c', metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#ff4410', emissiveIntensity: 0 }),
    lume: new THREE.MeshPhysicalMaterial({ color: '#eef3e6', roughness: 0.75, emissive: '#6dffc8', emissiveIntensity: 0 }),
    // Sapphire crystal: clear, with reflections and a faint blue anti-reflective sheen.
    crystal: new THREE.MeshPhysicalMaterial({
      color: '#ffffff', metalness: 0, roughness: 0, transparent: true, opacity: 0.1, depthWrite: false,
      specularIntensity: 1, ior: 1.77, clearcoat: 1, iridescence: 0.45, iridescenceIOR: 1.38,
    }),
    hairspring: new THREE.MeshPhysicalMaterial({ color: '#7f8fb3', metalness: 1, roughness: 0.18, emissive: '#ff7a2a', emissiveIntensity: 0 }),
    leather: new THREE.MeshPhysicalMaterial({
      map: tex.leather.map, bumpMap: tex.leather.bump, bumpScale: 1.2, roughness: 0.62, metalness: 0, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color('#5a4a3e'),
    }),
  };
  const gilt = [mats.copper, mats.copperPolish];
  setIridescenceRange(mats.blue, 240, 420);
  setIridescenceRange(mats.crystal, 180, 260);

  const screwHead = lathe([[0, 0.016], [0.018, 0.013], [0.027, 0.006], [0.03, 0], [0.03, -0.008], [0, -0.008]], 32);
  let screwSeed = 0;
  const addScrew = (parent, x, y, z, scale = 1) => {
    const head = new THREE.Mesh(screwHead, mats.blue);
    head.position.set(x, y, z);
    head.scale.setScalar(scale);
    parent.add(head);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.054 * scale, 0.007 * scale, 0.012 * scale), mats.screwSlot);
    slot.position.set(x, y, z + 0.013 * scale);
    slot.rotation.z = (screwSeed++ * 2.39996) % Math.PI;
    parent.add(slot);
  };
  const chatonGeo = lathe([[0.012, 0.004], [0.028, 0.008], [0.036, 0.004], [0.038, -0.006], [0.02, -0.006]], 40);
  const rubyGeo = lathe([[0, 0.006], [0.012, 0.0055], [0.02, 0.003], [0.021, -0.004], [0, -0.004]], 32);
  const addJewel = (parent, x, y, z, scale = 1) => {
    const setting = new THREE.Mesh(chatonGeo, mats.gold);
    setting.position.set(x, y, z);
    setting.scale.setScalar(scale);
    parent.add(setting);
    const j = new THREE.Mesh(rubyGeo, mats.ruby);
    j.position.set(x, y, z + 0.002 * scale);
    j.scale.setScalar(scale);
    parent.add(j);
  };

  /* case back: brushed, engraved, with a sapphire exhibition window */
  const back = layer('caseback', -1.25);
  {
    const backTex = casebackTexture();
    const backMat = new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.32, roughnessMap: backTex, bumpMap: backTex, bumpScale: 1.5 });
    const geo = lathe([[0.6, -0.26], [0.6, -0.29], [0.66, -0.32], [0.93, -0.33], [0.98, -0.31], [0.99, -0.265]], 128, { flip: false });
    planarUV(geo, 0.5, 0.5, 0.5);
    back.add(new THREE.Mesh(geo, backMat));
    const win = new THREE.Mesh(
      new THREE.CylinderGeometry(0.61, 0.61, 0.02, 96),
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0, transparent: true, opacity: 0.1, depthWrite: false, specularIntensity: 1, clearcoat: 1 })
    );
    win.rotation.x = Math.PI / 2;
    win.position.z = -0.29;
    win.userData.noShadow = true;
    back.add(win);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const scr = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 24), mats.steel);
      scr.rotation.x = Math.PI / 2;
      scr.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, -0.335);
      back.add(scr);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.007, 0.01), mats.screwSlot);
      slot.position.set(Math.cos(a) * 0.8, Math.sin(a) * 0.8, -0.345);
      slot.rotation.z = a;
      back.add(slot);
    }
  }

  /* middle case: round, softly curved flanks, sculpted lugs and crown */
  const caseL = layer('case', -0.7);
  {
    const band = lathe([[0.95, 0.075], [1.03, 0.075], [1.05, 0.05], [1.06, -0.02], [1.056, -0.15], [1.036, -0.23], [0.99, -0.265], [0.95, -0.265]], 256);
    caseL.add(new THREE.Mesh(band, mats.brushed));
    // Polished chamfer where the band meets the bezel.
    const chamfer = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.012, 12, 256), mats.steel);
    chamfer.position.z = 0.068;
    caseL.add(chamfer);
    const lug = lugGeometry(0.17, false);
    const lugB = lugGeometry(0.17, true);
    for (const sx of [-1, 1]) {
      for (const [g, sy] of [[lug, 1], [lugB, -1]]) {
        const m = new THREE.Mesh(g, [mats.brushed, mats.steel]);
        m.position.x = sx * 0.545;
        caseL.add(m);
        // Spring bar between each pair of lugs.
        if (sx === 1) {
          const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.94, 16), mats.steel);
          bar.rotation.z = Math.PI / 2;
          bar.position.set(0, sy * 1.17, -0.17);
          caseL.add(bar);
        }
      }
    }
    // Crown: coin-edge knurling, a polished cap and a tube into the case.
    const crown = new THREE.Group();
    const knurl = fluteRadially(lathe([[0, -0.08], [0.105, -0.08], [0.115, -0.065], [0.115, 0.065], [0.105, 0.08], [0, 0.08]], 360, { flip: false }), {
      from: 0.106, count: 40, depth: 0.012, sharp: 2,
    });
    const knurled = new THREE.Mesh(knurl, mats.steel);
    knurled.rotation.y = Math.PI / 2;
    crown.add(knurled);
    const cap = new THREE.Mesh(lathe([[0, 0.094], [0.065, 0.09], [0.09, 0.083], [0.096, 0.08]], 64), mats.steel);
    cap.rotation.y = Math.PI / 2;
    crown.add(cap);
    const emblem = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 8, 48), mats.gold);
    emblem.rotation.y = Math.PI / 2;
    emblem.position.x = 0.094;
    crown.add(emblem);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 32), mats.steel);
    tube.rotation.z = Math.PI / 2;
    tube.position.x = -0.11;
    crown.add(tube);
    crown.position.set(1.17, 0, -0.1);
    caseL.add(crown);
  }

  /* main plate with perlage */
  const plateL = layer('plate', -0.25);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.04, 128), mats.plate);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.12;
    plateL.add(m);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: radialGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })
    );
    glow.position.set(0, -0.15, -0.095);
    glow.userData.noShadow = true;
    plateL.add(glow);
    plateL.userData.glow = glow;
    // Back of the movement, seen through the case-back window: striped bridges,
    // jewels and blued screws on the underside of the plate.
    const under = new THREE.Group();
    under.rotation.y = Math.PI; // face the case back
    under.position.z = -0.142;
    plateL.add(under);
    const backArms = [
      [[0, 0.33], [-0.5, 0.25], 0.16],
      [[0, 0.33], [0.5, 0.25], 0.16],
      [[0, -0.05], [-0.48, -0.32], 0.13],
      [[0, -0.05], [0.48, -0.32], 0.13],
    ];
    backArms.forEach(([a, b, w]) => under.add(new THREE.Mesh(bridgeGeometry(a, b, w, 0.02), [mats.gunmetal, mats.gunmetalPolish])));
    for (const [x, y] of [[-0.5, 0.25], [0.5, 0.25], [-0.48, -0.32], [0.48, -0.32]]) addScrew(under, x, y, 0.034);
    for (const [x, y] of [[0, 0.33], [0, -0.05], [0, -0.45]]) addJewel(under, x, y, 0.03, 1.2);
  }

  /*
    Gear train, laid out from tooth counts (module m: pitch radius = m * z / 2).
    Barrel 90 -> centre pinion 10 -> centre wheel 80 -> third pinion 10
    -> third wheel 75 -> tourbillon pinion 10. 75 x 80 / (10 x 10) = 60, so the
    cage turns 60 times for each turn of the centre wheel: once a minute vs once an hour.
  */
  const B = new THREE.Vector2(0, 0.3333);
  const C = new THREE.Vector2(0, 0);
  const TB = new THREE.Vector2(0, -0.45);
  const T = new THREE.Vector2(-0.1052, -0.2488);
  const gearsL = layer('gears', 0.12);
  const train = {};
  {
    const wheel = (key, pos, z, opts, face, edge) => {
      const m = new THREE.Mesh(gearGeometry(opts), [face, edge]);
      m.position.set(pos.x, pos.y, z);
      gearsL.add(m);
      train[key] = m;
      return m;
    };
    const pinion = (pos, z, r, depth) => {
      const m = new THREE.Mesh(gearGeometry({ teeth: 10, r, tooth: r * 0.42, spokes: 0, depth, bore: 0 }), mats.steel);
      m.position.set(pos.x, pos.y, z);
      gearsL.add(m);
      return m;
    };
    const arbor = (pos, z0, z1) => {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, z1 - z0, 12), mats.steel);
      a.rotation.x = Math.PI / 2;
      a.position.set(pos.x, pos.y, (z0 + z1) / 2);
      gearsL.add(a);
    };
    // Barrel: drum with teeth, closed by a grained cover.
    wheel('barrel', B, -0.1, { teeth: 90, r: 0.3, tooth: 0.013, spokes: 0, depth: 0.03, bore: 0.02 }, mats.copperDark, mats.copperPolish);
    const cover = new THREE.Mesh(wheelGeometry({ r: 0.26, rim: 0, spokes: 0, hub: 0, spokeW: 0, depth: 0.008, bore: 0.025 }), [mats.copper, mats.copperPolish]);
    cover.position.set(B.x, B.y, -0.066);
    gearsL.add(cover);
    train.cover = cover;
    arbor(B, -0.1, 0.04);
    // Centre wheel and the pinion the barrel drives.
    train.centerPinion = pinion(C, -0.1, 0.0333, 0.03);
    wheel('center', C, -0.03, { teeth: 80, r: 0.24, tooth: 0.012, spokes: 4, hub: 0.035, rim: 0.022, spokeW: 0.02 }, mats.copper, mats.copperPolish);
    arbor(C, -0.1, 0.15);
    // Third wheel and its pinion (driven by the centre wheel).
    train.thirdPinion = pinion(T, -0.035, 0.03, 0.03);
    wheel('third', T, -0.075, { teeth: 75, r: 0.2, tooth: 0.011, spokes: 4, hub: 0.03, rim: 0.02, spokeW: 0.018 }, mats.copper, mats.copperPolish);
    arbor(T, -0.1, 0.03);
  }

  /* bridges: Geneva-striped, bevelled, each one carrying a pivot */
  const bridgesL = layer('bridges', 0.48);
  {
    const z = 0.005;
    const arms = [
      // Barrel bridge: over the barrel arbor, screwed at both ends.
      [[B.x, B.y], [-0.62, 0.48], 0.09],
      [[B.x, B.y], [0.62, 0.48], 0.09],
      // Train bridge: holds the third-wheel and centre pivots.
      [[T.x, T.y], [-0.7, -0.3], 0.065],
      [[T.x, T.y], [0, 0], 0.06],
      [[0, 0], [0.7, -0.22], 0.06],
    ];
    arms.forEach(([a, b, w]) => {
      bridgesL.add(new THREE.Mesh(bridgeGeometry(a, b, w, 0.026), [mats.gunmetal, mats.gunmetalPolish]));
    });
    for (const [x, y] of [[-0.62, 0.48], [0.62, 0.48], [-0.7, -0.3], [0.7, -0.22]]) addScrew(bridgesL, x, y, z + 0.041);
    addJewel(bridgesL, T.x, T.y, z + 0.037);
    // Keyless works on top of the barrel bridge: ratchet, crown wheel and click.
    const ratchet = new THREE.Mesh(ratchetGeometry(42, 0.15, 0.012, 0.018), [mats.soleil, mats.steel]);
    ratchet.position.set(B.x, B.y, z + 0.034);
    bridgesL.add(ratchet);
    addScrew(bridgesL, B.x, B.y, z + 0.06, 1.4);
    const cw = new THREE.Vector2(B.x + Math.cos(0.6) * 0.24, B.y + Math.sin(0.6) * 0.24);
    const crownWheel = new THREE.Mesh(gearGeometry({ teeth: 26, r: 0.09, tooth: 0.012, spokes: 0, depth: 0.016, bore: 0.012 }), [mats.soleil, mats.steel]);
    crownWheel.position.set(cw.x, cw.y, z + 0.034);
    bridgesL.add(crownWheel);
    addScrew(bridgesL, cw.x, cw.y, z + 0.054, 0.9);
    const click = new THREE.Mesh(bridgeGeometry([-0.27, 0.42], [-0.15, 0.39], 0.03, 0.012), [mats.steel, mats.steel]);
    click.position.z = z + 0.034;
    bridgesL.add(click);
    addScrew(bridgesL, -0.27, 0.42, z + 0.05, 0.7);
    bridgesL.userData.ratchet = ratchet;
    bridgesL.userData.crownWheel = crownWheel;
  }

  /* flying tourbillon at 6 o'clock: no upper bridge, carried from below */
  const tourL = layer('tourbillon', 0.85);
  const tour = { cage: new THREE.Group(), balance: new THREE.Group(), spring: null, escape: null, fork: new THREE.Group() };
  {
    const base = new THREE.Group();
    base.position.set(TB.x, TB.y, 0);
    tourL.add(base);
    // Fixed fourth wheel the escape pinion rolls around; it does not turn.
    const fixed = new THREE.Mesh(gearGeometry({ teeth: 64, r: 0.092, tooth: 0.008, spokes: 0, depth: 0.012, bore: 0.03 }), [mats.gold, mats.gold]);
    fixed.position.z = -0.058;
    base.add(fixed);
    // The cage pinion meshes with the third wheel, on the same level.
    const cagePinion = new THREE.Mesh(gearGeometry({ teeth: 10, r: 0.0267, tooth: 0.011, spokes: 0, depth: 0.03, bore: 0 }), mats.steel);
    cagePinion.position.z = -0.08;
    tour.cage.add(cagePinion);
    base.add(tour.cage);
    // Lower and upper frames joined by three posts.
    const frameGeo = wheelGeometry({ r: 0.2, rim: 0.016, spokes: 3, hub: 0.04, spokeW: 0.026, depth: 0.01, bore: 0.02 });
    const lower = new THREE.Mesh(frameGeo, [mats.steel, mats.steel]);
    lower.position.z = -0.04;
    tour.cage.add(lower);
    const upper = new THREE.Mesh(frameGeo, [mats.steel, mats.steel]);
    upper.position.z = 0.045;
    upper.rotation.z = Math.PI / 3;
    tour.cage.add(upper);
    const screwGeo = lathe([[0, 0.01], [0.012, 0.008], [0.016, 0.003], [0.016, -0.004], [0, -0.004]], 24);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + Math.PI / 2;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.095, 12), mats.steel);
      post.rotation.x = Math.PI / 2;
      post.position.set(Math.cos(a) * 0.192, Math.sin(a) * 0.192, 0.003);
      tour.cage.add(post);
      const scr = new THREE.Mesh(screwGeo, mats.blue);
      scr.position.set(Math.cos(a) * 0.192, Math.sin(a) * 0.192, 0.058);
      tour.cage.add(scr);
    }
    // Seconds pointer on the cage: the tourbillon itself shows the seconds.
    const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.17, 0.004), mats.orange);
    pointer.position.set(0, 0.11, 0.062);
    tour.cage.add(pointer);
    // Escapement: escape wheel on a pinion that meshes with the fixed wheel.
    const escPos = new THREE.Vector2(0, -0.105);
    tour.escape = new THREE.Group();
    tour.escape.position.set(escPos.x, escPos.y, -0.012);
    tour.escape.add(new THREE.Mesh(escapeWheelGeometry(0.062, 0.008), mats.steel));
    const escPinion = new THREE.Mesh(gearGeometry({ teeth: 8, r: 0.014, tooth: 0.005, spokes: 0, depth: 0.03, bore: 0 }), mats.steel);
    escPinion.position.z = -0.04;
    tour.escape.add(escPinion);
    tour.cage.add(tour.escape);
    // Pallet fork: lever with two ruby pallet stones and a fork towards the balance.
    tour.fork.position.set(0, -0.048, -0.004);
    const lever = new THREE.Mesh(bridgeGeometry([0, 0], [0, 0.04], 0.012, 0.005), mats.steel);
    tour.fork.add(lever);
    const crossbar = new THREE.Mesh(bridgeGeometry([-0.036, -0.012], [0.036, -0.012], 0.01, 0.005), mats.steel);
    tour.fork.add(crossbar);
    for (const sx of [-1, 1]) {
      const stone = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.024, 0.008), mats.ruby);
      stone.position.set(sx * 0.03, -0.026, 0.004);
      stone.rotation.z = sx * 0.3;
      tour.fork.add(stone);
    }
    tour.cage.add(tour.fork);
    // Balance with timing screws, above the escapement.
    tour.cage.add(tour.balance);
    const wheel = new THREE.Mesh(wheelGeometry({ r: 0.13, rim: 0.015, spokes: 2, hub: 0.018, spokeW: 0.015, depth: 0.011, bore: 0.005 }), [mats.gold, mats.gold]);
    wheel.position.z = 0.008;
    tour.balance.add(wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.015, 12), mats.gold);
      w.position.set(Math.cos(a) * 0.136, Math.sin(a) * 0.136, 0.013);
      w.rotation.z = a - Math.PI / 2;
      tour.balance.add(w);
    }
    // Hairspring: Archimedean spiral in blued steel, outer end held by a stud.
    const pts = [];
    const turns = 11;
    for (let i = 0; i <= 900; i++) {
      const t = i / 900;
      const a = t * turns * TAU;
      const r = 0.018 + t * 0.075;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.028 + (t > 0.96 ? (t - 0.96) * 0.15 : 0)));
    }
    tour.spring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1400, 0.0011, 5, false), mats.hairspring);
    tour.cage.add(tour.spring);
    const stud = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.02), mats.steel);
    stud.position.set(0.093, 0, 0.03);
    tour.cage.add(stud);
    const collet = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 16), mats.steel);
    collet.rotation.x = Math.PI / 2;
    collet.position.z = 0.028;
    tour.cage.add(collet);
    addJewel(tour.cage, 0, 0, 0.052, 0.7);
  }

  /* flange (sloped chapter ring) with printed track and applied indices */
  const ringL = layer('ring', 1.15);
  {
    const geo = lathe([[0.7, 0.08], [0.72, 0.085], [0.88, 0.14], [0.9, 0.12], [0.9, 0.06]], 160);
    planarUV(geo, 1 / 1.8, 0.5, 0.5);
    ringL.add(new THREE.Mesh(geo, mats.dial));
    // Seconds track around the tourbillon aperture.
    const track = new THREE.Mesh(new THREE.RingGeometry(0.218, 0.26, 96), mats.track);
    planarUV(track.geometry, 1 / 0.52, 0.5, 0.5);
    track.position.set(TB.x, TB.y, 0.075);
    track.userData.noShadow = true;
    ringL.add(track);
    const idx = indexGeometry(0.024, 0.07);
    const lumeGeo = new THREE.BoxGeometry(0.01, 0.05, 0.006);
    const markers = new THREE.InstancedMesh(idx, [mats.copperPolish, mats.copperPolish], 12);
    const lumes = new THREE.InstancedMesh(lumeGeo, mats.lume, 12);
    const d = new THREE.Object3D();
    let mi = 0;
    for (let i = 0; i < 12; i++) {
      if (i === 6) continue;
      const a = (i / 12) * TAU;
      for (const off of i === 0 ? [-0.022, 0.022] : [0]) {
        d.position.set(Math.sin(a) * 0.755 + Math.cos(a) * off, Math.cos(a) * 0.755 - Math.sin(a) * off, 0.09);
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

  /* hands: faceted dauphine, with a lume channel */
  const handsL = layer('hands', 1.45);
  const hands = {};
  {
    const make = (len, w, tail, z) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(dauphineHandGeometry(len, w, tail, 0.012), mats.copperPolish));
      const lume = new THREE.Mesh(new RoundedBoxGeometry(0.008, len * 0.5, 0.004, 2, 0.002), mats.lume);
      lume.position.set(0, len * 0.52, 0.009);
      lume.rotation.x = -0.012;
      g.add(lume);
      g.position.z = z;
      return g;
    };
    hands.hour = make(0.42, 0.095, 0.07, 0.16);
    hands.minute = make(0.66, 0.075, 0.09, 0.182);
    const cap = new THREE.Mesh(lathe([[0, 0.012], [0.014, 0.01], [0.022, 0.004], [0.024, -0.008], [0, -0.008]], 32), mats.copperPolish);
    cap.position.z = 0.2;
    handsL.add(hands.hour, hands.minute, cap);
  }

  /* bezel: polished, smooth, with a narrow satin top */
  const bezelL = layer('bezel', 1.8);
  {
    const geo = lathe([[0.875, 0.14], [0.89, 0.2], [0.915, 0.232], [0.99, 0.242], [1.025, 0.222], [1.042, 0.18], [1.042, 0.1], [1.03, 0.075]], 256);
    bezelL.add(new THREE.Mesh(geo, mats.steel));
  }

  /* domed sapphire crystal */
  const crystalL = layer('crystal', 2.1);
  {
    const m = new THREE.Mesh(lathe([[0, 0.272], [0.45, 0.266], [0.75, 0.252], [0.88, 0.238], [0.9, 0.228], [0.9, 0.22], [0, 0.22]], 128), mats.crystal);
    m.userData.noShadow = true;
    crystalL.add(m);
  }

  /* stitched leather strap, attached at the spring bars and curving round the wrist */
  const bracelet = new THREE.Group();
  root.add(bracelet);
  {
    const V = (y, z) => new THREE.Vector3(0, y, z);
    const path = [V(1.1, -0.17), V(1.4, -0.22), V(1.72, -0.38), V(1.98, -0.7), V(2.12, -1.15), V(2.12, -1.65), V(1.98, -2.1)];
    const opts = { w0: 0.9, w1: 0.76, t0: 0.12, t1: 0.095 };
    bracelet.add(new THREE.Mesh(strapGeometry(path, { ...opts, side: 1 }), mats.leather));
    const pathB = path.map((p) => V(-p.y, p.z));
    bracelet.add(new THREE.Mesh(strapGeometry(pathB, { ...opts, side: -1 }), mats.leather));
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
    tourbillon: new THREE.Vector3(TB.x, TB.y, 0.08),
    barrel: new THREE.Vector3(0.18, 0.52, 0.0),
    escape: new THREE.Vector3(T.x, T.y, 0.05),
    balance: new THREE.Vector3(B.x + Math.cos(0.6) * 0.24, B.y + Math.sin(0.6) * 0.24, 0.06),
  };

  const tmpColor = new THREE.Color();
  let extra = 0; // extra seconds added when a scene speeds the movement up

  /* per-frame update: time in seconds, pose = smoothed scene state */
  function update(time, pose, dt) {
    for (const g of Object.values(layers)) g.position.z = g.userData.offset * pose.explode * 1.35;
    const caseScale = Math.max(0.0001, 1 - pose.explode * 1.4);
    layers.case.scale.setScalar(caseScale);
    layers.case.visible = caseScale > 0.02;

    const bScale = Math.max(0.0001, 1 - pose.explode * 1.6) * pose.bracelet;
    bracelet.visible = bScale > 0.02;
    bracelet.scale.setScalar(Math.max(bScale, 0.0001));

    hud.position.z = -1.9 * pose.explode - 0.4;
    hudMat.opacity = pose.hud * 0.85;
    hud.userData.a.rotation.z = time * 0.08;
    hud.userData.b.rotation.z = -time * 0.15;
    hud.visible = pose.hud > 0.01;

    tmpColor.copy(steelColor).lerp(dlcColor, pose.finish);
    mats.steel.color.copy(tmpColor);
    mats.brushed.color.copy(tmpColor).multiplyScalar(0.94);
    mats.soleil.color.copy(tmpColor);
    mats.steel.roughness = 0.07 + pose.finish * 0.2;
    mats.brushed.roughness = 0.34 + pose.finish * 0.1;
    tmpColor.copy(copperColor).lerp(goldColor, pose.gold);
    for (const m of gilt) m.color.copy(tmpColor);
    mats.copperDark.color.copy(copperDarkColor).lerp(goldDarkColor, pose.gold);

    mats.copper.emissiveIntensity = pose.glow * 0.08;
    mats.hairspring.emissiveIntensity = pose.glow * 0.25;
    mats.orange.emissiveIntensity = pose.glow * 0.05;
    mats.lume.emissiveIntensity = pose.lume * 2.4;
    const bloom = Math.max(0, pose.glow - 0.5);
    plateL.userData.glow.material.opacity = bloom * 0.45;
    glowLight.intensity = bloom * 4;
    glowLight.distance = 4 * root.scale.x;

    // Clock time, with optional fast-forward for dramatic scenes.
    extra += dt * Math.max(0, pose.speed - 1) * 6;
    const now = new Date();
    const ms = now.getMilliseconds();
    const beats = Math.floor((now.getSeconds() * 1000 + ms) / 125) + Math.floor(extra * 8);
    const sec = (beats / 8) % 60;
    const m = now.getMinutes() + now.getSeconds() / 60;
    const h = (now.getHours() % 12) + m / 60;
    hands.minute.rotation.z = -(m / 60) * TAU;
    hands.hour.rotation.z = -(h / 12) * TAU;

    // Gear train driven by the cage angle through the real ratios.
    const cage = -((sec + 60 * (now.getMinutes() % 60)) / 60) * TAU;
    tour.cage.rotation.z = cage;
    train.third.rotation.z = -cage / 7.5;
    train.thirdPinion.rotation.z = train.third.rotation.z;
    train.center.rotation.z = cage / 60;
    train.centerPinion.rotation.z = train.center.rotation.z;
    train.barrel.rotation.z = -cage / 540;
    train.cover.rotation.z = train.barrel.rotation.z;

    // Escapement: the escape wheel jumps half a tooth on every beat, the fork flips,
    // and the balance swings at 4 Hz (28,800 vibrations an hour).
    const phase = ((now.getSeconds() * 1000 + ms) / 125 + extra * 8) % 1;
    const settle = 1 - Math.pow(1 - Math.min(1, phase * 6), 3);
    tour.escape.rotation.z = -((beats + settle) * (TAU / 15)) / 2;
    tour.fork.rotation.z = (beats % 2 ? 1 : -1) * 0.12 * (settle * 2 - 1);
    const swing = Math.sin(((beats + phase) / 2) * TAU);
    tour.balance.rotation.z = swing * 2.4;
    tour.spring.rotation.z = tour.balance.rotation.z * 0.22;
    const breathe = 1 + swing * 0.035;
    tour.spring.scale.set(breathe, breathe, 1);
  }

  return { root, update, mats, hotspots };
}
