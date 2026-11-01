import * as THREE from 'three';
import { buildWatch } from './buildWatch.js';
import { DEFAULT_POSE, TIMELINE } from './timeline.js';

const REF = 2.6; // model height (case + lugs) that fit=1 maps onto the slot height
const KEYS = Object.keys(DEFAULT_POSE);
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Softbox face: bright centre falling off to the edges, like diffusion fabric.
function softboxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.65, '#d8d8d8');
  gr.addColorStop(0.92, '#6a6a6a');
  gr.addColorStop(1, '#000000');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Product-photography studio: dark walls, a large overhead softbox, tall strip lights
// for the long highlights on polished steel, and a warm bounce card from below.
function studioEnvironment() {
  const s = new THREE.Scene();
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#4a4c52');
  gr.addColorStop(0.45, '#1c1d21');
  gr.addColorStop(1, '#0a0a0c');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const sky = new THREE.CanvasTexture(c);
  sky.colorSpace = THREE.SRGBColorSpace;
  s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide })));

  const face = softboxTexture();
  const box = (w, h, pos, k, color = '#ffffff') => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(18, 8, [0, 11, 4], 3.6);
  box(4, 18, [-11, 1, 5], 2.8);
  box(3, 18, [11, 0, -2], 2.2);
  box(2, 16, [8, 2, 10], 1.8);
  box(16, 9, [0, 0, 15], 0.9);
  box(6, 10, [-9, -4, 9], 0.7);
  box(10, 2, [0, -11, 4], 0.8, '#ffc08a');
  box(4, 4, [-6, 7, 10], 1.2);
  return s;
}

export class Stage {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reduced = reducedMotion;
    this.backdrops = {};
    this.hotspotEls = {};
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Neutral tone mapping keeps metal colours true (gold stays gold); ACES on older three.
    renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
    // Contact shadows from hands, wheels and bridges are what make the movement read as solid.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
    this.scene.environmentIntensity = 1;

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 12);

    this.key = new THREE.DirectionalLight('#ffffff', 2.2);
    this.keyDir = new THREE.Vector3(3, 5, 7).normalize();
    this.key.position.copy(this.keyDir);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.radius = 3;
    this.rim = new THREE.DirectionalLight('#ffffff', 1.6);
    this.rim.position.set(-6, 2, -2);
    this.under = new THREE.DirectionalLight('#ffffff', 0.5);
    this.under.position.set(2, -6, 3);
    this.scene.add(this.key, this.rim, this.under, new THREE.AmbientLight('#ffffff', 0.15));

    this.watch = buildWatch();
    this.scene.add(this.watch.root);
    this.key.target = this.watch.root;

    this.pose = { ...DEFAULT_POSE, ...TIMELINE[0] };
    this.place = null; // smoothed {x, y, s, clip:{x,y,w,h}}
    this.keyY = [];
    this.clock = new THREE.Clock();
    this.time = 0;

    this.warmC = new THREE.Color('#ffa260');
    this.coolC = new THREE.Color('#7fa6ff');
    this.white = new THREE.Color('#ffffff');
    this.v = new THREE.Vector3();

    this.onResize = this.onResize.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.loop = this.loop.bind(this);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(document.body);
    this.onResize();
    this.raf = requestAnimationFrame(this.loop);
  }

  registerBackdrop(name, el) { if (el) this.backdrops[name] = el; }
  registerHotspot(name, el) { if (el) this.hotspotEls[name] = el; }

  onPointer(e) {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.measure();
  }

  // Convert each keyframe into an absolute scroll position.
  measure() {
    const vh = window.innerHeight;
    const keyed = TIMELINE.map((k, i) => {
      const el = document.getElementById(k.section);
      const top = el ? el.getBoundingClientRect().top + window.scrollY : 0;
      return { k, i, y: top + k.at * vh };
    });
    // Sort by scroll position (stable), so keyframes from neighbouring sections never cross.
    keyed.sort((a, b) => a.y - b.y || a.i - b.i);
    this.keys = keyed.map((e) => e.k);
    this.keyY = keyed.map((e) => e.y);
  }

  rectOf(id) {
    const el = document.getElementById(id);
    if (!el) return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  // Target pose + target screen placement for the current scroll position.
  target() {
    const y = window.scrollY;
    const ks = this.keys || TIMELINE, ys = this.keyY;
    let i = 0;
    while (i < ks.length - 1 && ys[i + 1] <= y) i++;
    const a = ks[i];
    const b = ks[Math.min(i + 1, ks.length - 1)];
    let t = 0;
    if (b !== a && ys[i + 1] > ys[i]) t = smooth(Math.min(1, Math.max(0, (y - ys[i]) / (ys[i + 1] - ys[i]))));
    if (y < ys[0]) t = 0;

    const pose = {};
    for (const k of KEYS) {
      const va = a[k] ?? DEFAULT_POSE[k];
      const vb = b[k] ?? DEFAULT_POSE[k];
      pose[k] = lerp(va, vb, t);
    }
    const W = window.innerWidth, H = window.innerHeight;
    const full = { x: 0, y: 0, w: W, h: H };
    const ra = this.rectOf(a.anchor), rb = this.rectOf(b.anchor);
    const ca = this.clipFor(ra, a.clip ?? 0, full), cb = this.clipFor(rb, b.clip ?? 0, full);
    const place = {
      cx: lerp(ra.x + ra.w / 2, rb.x + rb.w / 2, t),
      cy: lerp(ra.y + ra.h / 2, rb.y + rb.h / 2, t),
      h: lerp(Math.min(ra.h, ra.w * 1.25), Math.min(rb.h, rb.w * 1.25), t),
      clip: {
        x: lerp(ca.x, cb.x, t), y: lerp(ca.y, cb.y, t),
        w: lerp(ca.w, cb.w, t), h: lerp(ca.h, cb.h, t),
      },
    };
    return { pose, place };
  }

  clipFor(r, c, full) {
    return {
      x: lerp(full.x, r.x, c), y: lerp(full.y, r.y, c),
      w: lerp(full.w, r.w, c), h: lerp(full.h, r.h, c),
    };
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const { pose: tp, place: tpl } = this.target();

    // Ease toward the target for a weighty, damped feel.
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 5.5);
    for (const key of KEYS) this.pose[key] = lerp(this.pose[key], tp[key], k);
    if (!this.place) this.place = JSON.parse(JSON.stringify(tpl));
    // Screen placement follows faster so the watch tracks scrolling slots.
    const kp = this.reduced ? 1 : 1 - Math.exp(-dt * 11);
    for (const key of ['cx', 'cy', 'h']) this.place[key] = lerp(this.place[key], tpl[key], kp);
    for (const key of ['x', 'y', 'w', 'h']) this.place.clip[key] = lerp(this.place.clip[key], tpl.clip[key], kp);

    const p = this.pose;
    const W = window.innerWidth, H = window.innerHeight;
    const worldH = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const px2w = worldH / H;
    const show = Math.min(1, Math.max(0, p.show));
    const appear = show * show * (3 - 2 * show); // eased fade value
    const s = ((this.place.h * px2w * p.fit) / REF) * (0.9 + 0.1 * appear);

    // Pointer parallax.
    this.pointer.sx = lerp(this.pointer.sx, this.pointer.x, 0.05);
    this.pointer.sy = lerp(this.pointer.sy, this.pointer.y, 0.05);
    const idle = this.reduced ? 0 : Math.sin(this.time * 0.6) * 0.025;

    const root = this.watch.root;
    root.visible = show > 0.003;
    // The canvas holds only the watch, so its opacity fades the whole model (shadows included).
    const op = appear.toFixed(3);
    if (op !== this.lastOpacity) {
      this.canvas.style.opacity = op;
      this.lastOpacity = op;
    }
    root.scale.setScalar(s);
    root.rotation.set(p.rx + this.pointer.sy * 0.08 + idle, p.ry + this.pointer.sx * 0.12, p.rz);
    root.position.set(
      (this.place.cx - W / 2) * px2w + p.ox * s,
      -(this.place.cy - H / 2) * px2w + p.oy * s + idle * 0.4 * s - (1 - appear) * 0.12 * s,
      0
    );

    this.fitShadow(s);

    this.key.color.copy(this.white).lerp(this.warmC, p.warm * 0.5);
    this.rim.color.copy(this.white).lerp(this.warmC, p.warm).lerp(this.coolC, p.cool);
    this.rim.intensity = 1.6 + p.cool * 2.5 + p.warm * 1.2;
    this.renderer.toneMappingExposure = p.exposure;

    this.watch.update(this.time, p, dt);

    // Render, optionally clipped to a framed panel.
    const r = this.renderer;
    r.setScissorTest(false);
    r.clear();
    const c = this.place.clip;
    const clipped = c.w < W - 1 || c.h < H - 1 || c.x > 0.5 || c.y > 0.5;
    if (clipped) {
      r.setScissorTest(true);
      r.setScissor(c.x, H - c.y - c.h, Math.max(0, c.w), Math.max(0, c.h));
    }
    r.render(this.scene, this.camera);
    r.setScissorTest(false);

    // Backdrops behind the canvas.
    const bd = { halo: p.eHalo, warm: p.eWarm, cold: p.eCold, bench: p.eBench, blue: p.eBlue, copper: p.eCopper };
    for (const [name, el] of Object.entries(this.backdrops)) {
      const o = bd[name] ?? 0;
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o < 0.005 ? 'hidden' : 'visible';
    }

    // Pin hotspot labels to projected movement parts.
    for (const [name, el] of Object.entries(this.hotspotEls)) {
      const pt = this.watch.hotspots[name];
      if (!pt) continue;
      this.v.copy(pt);
      root.localToWorld(this.v);
      this.v.project(this.camera);
      const x = (this.v.x * 0.5 + 0.5) * W;
      const y = (-this.v.y * 0.5 + 0.5) * H;
      const inside = x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = (inside ? p.hot * appear : 0).toFixed(3);
    }
  }

  // Keep the shadow frustum wrapped tightly around the watch at its current scale.
  fitShadow(s) {
    const root = this.watch.root;
    const half = 3.4 * s;
    this.key.position.copy(root.position).addScaledVector(this.keyDir, 8 * s);
    const cam = this.key.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 0.5 * s;
    cam.far = 16 * s;
    cam.updateProjectionMatrix();
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.004 * s;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointer);
    this.ro.disconnect();
    this.renderer.dispose();
  }
}
