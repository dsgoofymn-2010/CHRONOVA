import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
  Procedural model of the Chronova Type-0.
  Units: the case is ~2.4 wide. The dial faces +Z.
  Every part lives in a named "layer" so the caliber can be exploded along Z.
*/

const TAU = Math.PI * 2;

/* ---------- textures drawn on canvas ---------- */

function perlageTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4540';
  g.fillRect(0, 0, 512, 512);
  // Overlapping circular graining, the classic perlage finish on a main plate.
  const step = 22;
  for (let y = -step; y < 512 + step; y += step * 0.8) {
    for (let x = -step; x < 512 + step; x += step * 0.8) {
      const gr = g.createRadialGradient(x, y, 1, x, y, step);
      gr.addColorStop(0, 'rgba(255,255,255,0.20)');
      gr.addColorStop(0.55, 'rgba(255,255,255,0.04)');
      gr.addColorStop(0.75, 'rgba(0,0,0,0.18)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, step, 0, TAU);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

function radialGlowTexture(inner = 'rgba(255,140,60,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, 'rgba(255,90,20,0.45)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function numeralsTexture() {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  g.translate(s / 2, s / 2);
  const R = s / 2;
  g.fillStyle = '#d98b5f';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 74px "Chakra Petch", "Arial Narrow", sans-serif';
  // Numerals sit on the sloped rehaut: 10, 2, 4, 8 and a 60 at noon.
  const nums = { 10: 10, 2: 2, 4: 4, 8: 8, 60: 12 };
  for (const [label, hour] of Object.entries(nums)) {
    const a = (hour / 12) * TAU - Math.PI / 2;
    const r = R * 0.815;
    g.save();
    g.translate(Math.cos(a) * r, Math.sin(a) * r);
    g.fillText(label, 0, 0);
    g.restore();
  }
  g.fillStyle = 'rgba(236,230,218,0.85)';
  g.font = '600 26px "Chakra Petch", "Arial Narrow", sans-serif';
  g.fillText('SWISS  MADE', 0, R * 0.9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function hudRingTexture() {
  const s = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
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
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- shape helpers ---------- */

function superellipse(a, b, n, segs = 160) {
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

function gearGeometry({ teeth, r, depth = 0.026, tooth = 0.022, spokes = 4, hub = 0.04, rim = 0.035, spokeW = 0.03 }) {
  const s = new THREE.Shape();
  const rRoot = r - tooth;
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts = [
      [rRoot, a],
      [r, a + step * 0.22],
      [r, a + step * 0.5],
      [rRoot, a + step * 0.72],
    ];
    pts.forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr;
      i === 0 && k === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  const rIn = rRoot - rim;
  if (spokes > 0 && rIn > hub + 0.02) {
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
      s.holes.push(h);
    }
  }
  s.holes.push(circlePath(0.012));
  return new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.003,
    bevelSegments: 1,
    curveSegments: 6,
  });
}

function capsuleGeometry(len, w, depth) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(0, -r);
  s.lineTo(len, -r);
  s.absarc(len, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r);
  s.absarc(0, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 12,
  });
}

function skeletonHandGeometry(len, w, tail) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.35, -tail);
  s.lineTo(w * 0.35, -tail);
  s.lineTo(w / 2, len * 0.15);
  s.lineTo(w * 0.42, len * 0.86);
  s.lineTo(0, len);
  s.lineTo(-w * 0.42, len * 0.86);
  s.lineTo(-w / 2, len * 0.15);
  s.closePath();
  const h = new THREE.Path();
  const iw = w * 0.22;
  h.moveTo(-iw, len * 0.2);
  h.lineTo(iw, len * 0.2);
  h.lineTo(iw * 0.8, len * 0.8);
  h.lineTo(0, len * 0.88);
  h.lineTo(-iw * 0.8, len * 0.8);
  h.closePath();
  s.holes.push(h);
  s.holes.push(circlePath(w * 0.18, 0, 0));
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
  });
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

  const steelColor = new THREE.Color('#c3c7cd');
  const dlcColor = new THREE.Color('#1c1d21');
  const copperColor = new THREE.Color('#c8744a');
  const goldColor = new THREE.Color('#dcb15a');

  const mats = {
    steel: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.22, clearcoat: 0.4, clearcoatRoughness: 0.15 }),
    brushed: new THREE.MeshPhysicalMaterial({ color: steelColor.clone(), metalness: 1, roughness: 0.42 }),
    gunmetal: new THREE.MeshStandardMaterial({ color: '#2b2d33', metalness: 0.92, roughness: 0.34 }),
    plate: new THREE.MeshStandardMaterial({ map: perlageTexture(), color: '#8a7f75', metalness: 0.85, roughness: 0.45 }),
    copper: new THREE.MeshStandardMaterial({ color: copperColor.clone(), metalness: 1, roughness: 0.28, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0 }),
    copperDark: new THREE.MeshStandardMaterial({ color: '#8f4f30', metalness: 1, roughness: 0.35 }),
    gold: new THREE.MeshStandardMaterial({ color: goldColor.clone(), metalness: 1, roughness: 0.22 }),
    blue: new THREE.MeshStandardMaterial({ color: '#2d55b0', metalness: 1, roughness: 0.22 }),
    ruby: new THREE.MeshStandardMaterial({ color: '#a3101f', metalness: 0.1, roughness: 0.1, emissive: '#3a0008' }),
    dial: new THREE.MeshStandardMaterial({ color: '#16171a', metalness: 0.7, roughness: 0.5 }),
    orange: new THREE.MeshStandardMaterial({ color: '#ff5b1f', emissive: '#ff4410', emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.35 }),
    lume: new THREE.MeshStandardMaterial({ color: '#cfe9df', emissive: '#7dffd0', emissiveIntensity: 0, roughness: 0.6 }),
    crystal: new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.03, transparent: true, opacity: 0.09, clearcoat: 1, depthWrite: false }),
  };

  /* case back */
  const back = layer('caseback', -1.25);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.94, 0.08, 96), mats.gunmetal);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.28;
    back.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.012, 8, 96), mats.brushed);
    ring.position.z = -0.235;
    back.add(ring);
  }

  /* middle case: rounded octagon with integrated lugs */
  const caseL = layer('case', -0.7);
  {
    const shape = superellipse(1.15, 1.25, 2.9);
    shape.holes.push(circlePath(0.9));
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 5,
      curveSegments: 96,
    });
    const m = new THREE.Mesh(g, mats.brushed);
    m.position.z = -0.24;
    caseL.add(m);
    // Crown with grip ridges and guards.
    const crown = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 40), mats.steel);
    cyl.rotation.z = Math.PI / 2;
    crown.add(cyl);
    const ridgeGeo = new THREE.BoxGeometry(0.15, 0.012, 0.02);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      const r = new THREE.Mesh(ridgeGeo, mats.brushed);
      r.position.set(0, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
      r.rotation.x = a;
      crown.add(r);
    }
    crown.position.set(1.28, 0, -0.08);
    caseL.add(crown);
    for (const s of [-1, 1]) {
      const guard = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.07, 0.2, 2, 0.03), mats.brushed);
      guard.position.set(1.23, s * 0.15, -0.08);
      caseL.add(guard);
    }
  }

  /* main plate with perlage */
  const plateL = layer('plate', -0.25);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.04, 96), mats.plate);
    m.rotation.x = Math.PI / 2;
    m.position.z = -0.12;
    plateL.add(m);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: radialGlowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 })
    );
    glow.position.set(0, -0.15, -0.085);
    plateL.add(glow);
    plateL.userData.glow = glow;
  }

  /* gear train */
  const gearsL = layer('gears', 0.12);
  const gears = [];
  {
    const spec = [
      { name: 'barrel', x: 0, y: 0.38, teeth: 78, r: 0.29, spokes: 5, speed: 0.04, mat: 'copper', hub: 0.07 },
      { name: 'center', x: 0, y: 0.02, teeth: 64, r: 0.2, spokes: 4, speed: -0.22, mat: 'copper' },
      { name: 'third', x: -0.36, y: -0.1, teeth: 48, r: 0.16, spokes: 4, speed: 0.5, mat: 'copper' },
      { name: 'fourth', x: 0.35, y: -0.08, teeth: 44, r: 0.15, spokes: 3, speed: -0.9, mat: 'copper' },
      { name: 'winding', x: -0.46, y: 0.32, teeth: 30, r: 0.11, spokes: 3, speed: 0.3, mat: 'copperDark' },
      { name: 'ratchet', x: 0.46, y: 0.3, teeth: 34, r: 0.12, spokes: 0, speed: -0.25, mat: 'gold' },
      { name: 'escape', x: 0.2, y: -0.55, teeth: 15, r: 0.075, spokes: 3, speed: 2.4, mat: 'gold', hub: 0.02, rim: 0.015, spokeW: 0.012 },
    ];
    spec.forEach((s, i) => {
      const geo = gearGeometry({ teeth: s.teeth, r: s.r, spokes: s.spokes, hub: s.hub ?? 0.04, rim: s.rim ?? 0.03, spokeW: s.spokeW ?? 0.028 });
      const m = new THREE.Mesh(geo, mats[s.mat]);
      m.position.set(s.x, s.y, -0.08 + (i % 2) * 0.03);
      m.userData.speed = s.speed;
      gearsL.add(m);
      gears.push(m);
      const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 16), mats.steel);
      pinion.rotation.x = Math.PI / 2;
      pinion.position.set(s.x, s.y, -0.06);
      gearsL.add(pinion);
    });
  }

  /* skeleton bridges with blued screws and jewels */
  const bridgesL = layer('bridges', 0.48);
  {
    const arms = [
      // [from, to, width]
      [[0, 0.38], [-0.62, 0.5], 0.075],
      [[0, 0.38], [0.62, 0.5], 0.075],
      [[0, 0.38], [0, 0.82], 0.07],
      [[-0.36, -0.1], [-0.8, -0.02], 0.06],
      [[-0.36, -0.1], [-0.6, -0.5], 0.06],
      [[0.35, -0.08], [0.8, 0.02], 0.06],
      [[0.35, -0.08], [0.6, -0.48], 0.06],
    ];
    arms.forEach(([a, b, w]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      const m = new THREE.Mesh(capsuleGeometry(len, w, 0.03), mats.gunmetal);
      m.position.set(a[0], a[1], 0.0);
      m.rotation.z = Math.atan2(dy, dx);
      bridgesL.add(m);
      addScrew(b[0], b[1]);
    });
    [[0, 0.38], [-0.36, -0.1], [0.35, -0.08]].forEach(([x, y]) => {
      addJewel(x, y, 0.045);
    });
    function addScrew(x, y) {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 20), mats.blue);
      head.rotation.x = Math.PI / 2;
      head.position.set(x, y, 0.05);
      bridgesL.add(head);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.01), mats.dial);
      slot.position.set(x, y, 0.062);
      slot.rotation.z = Math.random() * Math.PI;
      bridgesL.add(slot);
    }
    function addJewel(x, y, z) {
      const setting = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 10, 24), mats.gold);
      setting.position.set(x, y, z);
      bridgesL.add(setting);
      const j = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 20), mats.ruby);
      j.rotation.x = Math.PI / 2;
      j.position.set(x, y, z);
      bridgesL.add(j);
    }
  }

  /* flying tourbillon at 6 o'clock */
  const tourL = layer('tourbillon', 0.85);
  const tour = { cage: new THREE.Group(), balance: new THREE.Group(), spring: null };
  {
    const base = new THREE.Group();
    base.position.set(0, -0.42, 0.06);
    tourL.add(base);
    base.add(tour.cage);
    const ringGeo = new THREE.TorusGeometry(0.2, 0.011, 10, 64);
    const ring = new THREE.Mesh(ringGeo, mats.gold);
    tour.cage.add(ring);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(capsuleGeometry(0.2, 0.026, 0.014), mats.steel);
      arm.rotation.z = (i / 3) * TAU + Math.PI / 2;
      arm.position.z = 0.02;
      tour.cage.add(arm);
      const scr = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.016, 14), mats.blue);
      scr.rotation.x = Math.PI / 2;
      const a = (i / 3) * TAU + Math.PI / 2;
      scr.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.035);
      tour.cage.add(scr);
    }
    tour.cage.add(tour.balance);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.014, 10, 56), mats.copper);
    tour.balance.add(rim);
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.016, 0.01), mats.copper);
      sp.rotation.z = (i * Math.PI) / 2;
      tour.balance.add(sp);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mats.gold);
      w.position.set(Math.cos(a) * 0.145, Math.sin(a) * 0.145, 0);
      tour.balance.add(w);
    }
    // Hairspring: a flat Archimedean spiral.
    const pts = [];
    const turns = 7;
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const a = t * turns * TAU;
      const r = 0.018 + t * 0.085;
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.016));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    tour.spring = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 600, 0.0022, 5, false),
      new THREE.MeshStandardMaterial({ color: '#ffb46b', emissive: '#ff7a2a', emissiveIntensity: 0.5, metalness: 1, roughness: 0.25 })
    );
    tour.cage.add(tour.spring);
    const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 20), mats.ruby);
    jewel.rotation.x = Math.PI / 2;
    jewel.position.z = 0.04;
    tour.cage.add(jewel);
    // Upper tourbillon bridge (the curved arm crossing the cage).
  }

  /* rehaut (sloped chapter ring) with indices and numerals */
  const ringL = layer('ring', 1.15);
  {
    const prof = [
      new THREE.Vector2(0.7, 0.08),
      new THREE.Vector2(0.72, 0.085),
      new THREE.Vector2(0.88, 0.14),
      new THREE.Vector2(0.9, 0.12),
      new THREE.Vector2(0.9, 0.06),
    ];
    const reh = new THREE.Mesh(new THREE.LatheGeometry(prof, 120), mats.dial);
    reh.rotation.x = Math.PI / 2;
    ringL.add(reh);
    const tick = new THREE.BoxGeometry(0.006, 0.035, 0.006);
    const ticks = new THREE.InstancedMesh(tick, mats.brushed, 60);
    const marker = new THREE.BoxGeometry(0.022, 0.07, 0.02);
    const markers = new THREE.InstancedMesh(marker, mats.copper, 12);
    const d = new THREE.Object3D();
    let mi = 0;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      d.position.set(Math.sin(a) * 0.865, Math.cos(a) * 0.865, 0.138);
      d.rotation.set(-0.38 * Math.cos(a) * 0, 0, -a);
      d.updateMatrix();
      ticks.setMatrixAt(i, d.matrix);
      if (i % 5 === 0) {
        d.position.set(Math.sin(a) * 0.74, Math.cos(a) * 0.74, 0.095);
        d.updateMatrix();
        markers.setMatrixAt(mi++, d.matrix);
      }
    }
    ringL.add(ticks, markers);
    const numerals = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshStandardMaterial({ map: numeralsTexture(), transparent: true, metalness: 0.6, roughness: 0.4, depthWrite: false })
    );
    numerals.position.z = 0.122;
    ringL.add(numerals);
  }

  /* hands */
  const handsL = layer('hands', 1.45);
  const hands = {};
  {
    hands.hour = new THREE.Group();
    hands.hour.add(new THREE.Mesh(skeletonHandGeometry(0.42, 0.075, 0.06), mats.copper));
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.18, 0.008), mats.lume);
    hl.position.set(0, 0.26, 0.012);
    hands.hour.add(hl);
    hands.hour.position.z = 0.16;
    hands.minute = new THREE.Group();
    hands.minute.add(new THREE.Mesh(skeletonHandGeometry(0.66, 0.06, 0.08), mats.copper));
    const ml = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.32, 0.008), mats.lume);
    ml.position.set(0, 0.4, 0.012);
    hands.minute.add(ml);
    hands.minute.position.z = 0.185;
    hands.second = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.86, 0.008), mats.orange);
    sh.position.y = 0.3;
    hands.second.add(sh);
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24), mats.orange);
    cw.rotation.x = Math.PI / 2;
    cw.position.y = -0.1;
    hands.second.add(cw);
    hands.second.position.z = 0.21;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 24), mats.orange);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.22;
    handsL.add(hands.hour, hands.minute, hands.second, cap);
  }

  /* bezel with coin-edge fluting */
  const bezelL = layer('bezel', 1.8);
  {
    const prof = [
      new THREE.Vector2(0.88, 0.13),
      new THREE.Vector2(0.9, 0.2),
      new THREE.Vector2(0.99, 0.235),
      new THREE.Vector2(1.06, 0.2),
      new THREE.Vector2(1.08, 0.12),
      new THREE.Vector2(1.06, 0.06),
    ];
    const bz = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), mats.steel);
    bz.rotation.x = Math.PI / 2;
    bezelL.add(bz);
    const flute = new THREE.BoxGeometry(0.014, 0.03, 0.12);
    const n = 150;
    const inst = new THREE.InstancedMesh(flute, mats.brushed, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      d.position.set(Math.cos(a) * 1.075, Math.sin(a) * 1.075, 0.135);
      d.rotation.set(0, 0, a);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    bezelL.add(inst);
  }

  /* sapphire crystal */
  const crystalL = layer('crystal', 2.1);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.02, 96), mats.crystal);
    m.rotation.x = Math.PI / 2;
    m.position.z = 0.24;
    crystalL.add(m);
  }

  /* integrated bracelet */
  const bracelet = new THREE.Group();
  root.add(bracelet);
  {
    const center = new RoundedBoxGeometry(0.34, 0.25, 0.15, 3, 0.045);
    const outer = new RoundedBoxGeometry(0.42, 0.25, 0.17, 3, 0.05);
    const R = 1.9;
    for (const side of [1, -1]) {
      for (let i = 0; i < 15; i++) {
        const th = 0.07 + i * 0.13;
        const link = new THREE.Group();
        const widen = i < 2 ? 1.25 - i * 0.1 : 1;
        const c = new THREE.Mesh(center, mats.steel);
        c.scale.x = widen;
        link.add(c);
        for (const s of [-1, 1]) {
          const o = new THREE.Mesh(outer, mats.brushed);
          o.position.x = s * 0.4 * widen;
          o.scale.x = widen;
          link.add(o);
        }
        link.position.set(0, side * (1.2 + R * Math.sin(th)), -0.1 - R * (1 - Math.cos(th)));
        link.rotation.x = -side * th;
        bracelet.add(link);
      }
    }
  }

  /* holographic platform rings shown in the exploded view */
  const hud = new THREE.Group();
  root.add(hud);
  const hudMat = new THREE.MeshBasicMaterial({ map: hudRingTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide });
  {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), hudMat);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), hudMat);
    b.position.z = 0.25;
    hud.add(a, b);
    hud.userData.a = a;
    hud.userData.b = b;
  }

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

    // Finishes.
    tmpColor.copy(steelColor).lerp(dlcColor, pose.finish);
    mats.steel.color.copy(tmpColor);
    mats.brushed.color.copy(tmpColor).multiplyScalar(0.92);
    mats.steel.roughness = 0.22 + pose.finish * 0.18;
    mats.brushed.roughness = 0.42 + pose.finish * 0.08;
    mats.copper.color.copy(copperColor).lerp(goldColor, pose.gold);
    mats.copper.emissiveIntensity = pose.glow * 0.55;
    mats.lume.emissiveIntensity = pose.lume * 2.2;
    mats.orange.emissiveIntensity = 0.5 + pose.glow * 0.6;
    plateL.userData.glow.material.opacity = 0.25 + pose.glow * 0.75;
    glowLight.intensity = pose.glow * 6;
    glowLight.distance = 4 * root.scale.x;

    // Gear train turns; speed multiplier from the timeline.
    const k = pose.speed;
    for (const g of gears) g.rotation.z += g.userData.speed * dt * k;

    // Balance at 4 Hz (28,800 vibrations per hour), tourbillon cage 1 rev / 60 s.
    tour.balance.rotation.z = Math.sin(time * TAU * 4) * 1.4;
    tour.spring.rotation.z = tour.balance.rotation.z * 0.25;
    tour.spring.scale.setScalar(1 + Math.sin(time * TAU * 4) * 0.03);
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
