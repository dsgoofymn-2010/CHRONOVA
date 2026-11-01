/*
  Scroll timeline for the 3D watch.
  Each keyframe fires when `section` top has scrolled `at` viewport-heights past
  the top of the screen. `anchor` is a DOM slot the watch is centred in and
  scaled to; `fit` scales relative to that slot's height.
  Any field left out falls back to DEFAULT_POSE.
*/

export const DEFAULT_POSE = {
  fit: 1, ox: 0, oy: 0, rx: 0, ry: 0, rz: 0,
  explode: 0, hud: 0, finish: 0, gold: 0, glow: 0.35, lume: 0, speed: 1,
  exposure: 1, warm: 0, cool: 0, clip: 0, hot: 0, bracelet: 1,
  // Ambient backdrops behind the canvas (0..1 each).
  eHalo: 0, eWarm: 0, eCold: 0, eBench: 0, eBlue: 0, eCopper: 0,
};

export const TIMELINE = [
  // Hero: the full watch, three-quarter turn.
  { section: 'overview', at: -0.2, anchor: 'slot-hero', fit: 1.02, rx: 0.12, ry: -0.42, rz: 0.04, eHalo: 1 },
  { section: 'overview', at: 0, anchor: 'slot-hero', fit: 1.02, rx: 0.1, ry: -0.38, rz: 0.03, eHalo: 1 },

  // Mechanism: dive into the dial, tilt for the 4 Hz shot, explode, reassemble.
  { section: 'mechanism', at: 0, anchor: 'slot-mech', fit: 1.7, oy: 0.12, rx: 0.02, ry: -0.05, glow: 0.6, eHalo: 0.4 },
  { section: 'mechanism', at: 0.7, anchor: 'slot-mech', fit: 1.75, oy: 0.12, rx: 0.02, ry: -0.05, glow: 0.6, eHalo: 0.4 },
  { section: 'mechanism', at: 1.3, anchor: 'slot-mech-side', fit: 3.1, ox: 0.06, oy: 0.55, rx: -0.55, ry: 0.32, rz: 0.12, glow: 0.9, speed: 4, eCopper: 0.6 },
  { section: 'mechanism', at: 1.9, anchor: 'slot-mech-side', fit: 3.2, ox: 0.06, oy: 0.55, rx: -0.55, ry: 0.38, rz: 0.18, glow: 1, speed: 4, eCopper: 0.6 },
  { section: 'mechanism', at: 2.5, anchor: 'slot-mech-side', fit: 0.5, oy: 0.1, rx: -1.22, ry: 0, rz: 0.3, explode: 1, hud: 1, glow: 1.4, bracelet: 0, speed: 2, eHalo: 0.5 },
  { section: 'mechanism', at: 3.2, anchor: 'slot-mech-side', fit: 0.5, oy: 0.1, rx: -1.22, ry: 0, rz: 1.1, explode: 1, hud: 1, glow: 1.4, bracelet: 0, speed: 2, eHalo: 0.5 },
  { section: 'mechanism', at: 3.85, anchor: 'slot-mech-side', fit: 0.95, rx: 0.05, ry: -0.5, rz: 0, glow: 0.5, eHalo: 0.8 },

  // Manifesto: steel watch on the right with a soft halo.
  { section: 'manifesto', at: -0.15, anchor: 'slot-manifesto', fit: 0.95, rx: 0.06, ry: -0.5, rz: 0.02, eHalo: 1 },
  { section: 'manifesto', at: 0.25, anchor: 'slot-manifesto', fit: 0.95, rx: 0.08, ry: -0.2, rz: 0.02, eHalo: 1 },

  // Made by hand: lying on the bench inside the photo frame.
  { section: 'craft', at: -0.1, anchor: 'slot-craft', fit: 0.92, rx: -0.7, ry: 0.35, rz: 0.55, clip: 1, warm: 0.6, exposure: 1.1 },
  { section: 'craft', at: 0.5, anchor: 'slot-craft', fit: 0.92, rx: -0.6, ry: 0.5, rz: 0.75, clip: 1, warm: 0.6, exposure: 1.1 },

  // Numbers: the watch recedes into the dark behind the figures.
  { section: 'numbers', at: 0, anchor: 'slot-numbers', fit: 1.2, rx: 0.2, ry: 0.6, rz: -0.2, exposure: 0.22, glow: 0.7 },
  { section: 'numbers', at: 0.9, anchor: 'slot-numbers', fit: 1.2, rx: 0.2, ry: 0.9, rz: -0.25, exposure: 0.22, glow: 0.7 },

  // Every detail: five chapters, each a different setting.
  { section: 'details', at: -0.4, anchor: 'slot-chapter', fit: 1.15, rx: 0.3, ry: -0.75, rz: 0.35, exposure: 0.9, warm: 1, eWarm: 1, clip: 0 },
  { section: 'details', at: 1.0, anchor: 'slot-chapter', fit: 1.15, rx: 0.35, ry: -0.85, rz: 0.4, exposure: 0.9, warm: 1, eWarm: 1 },
  { section: 'details', at: 1.4, anchor: 'slot-chapter', fit: 1.0, rx: -1.0, ry: 0.15, rz: 0.55, finish: 1, cool: 0.5, exposure: 1.05, eCold: 1 },
  { section: 'details', at: 2.0, anchor: 'slot-chapter', fit: 1.0, rx: -0.95, ry: 0.2, rz: 0.7, finish: 1, cool: 0.5, exposure: 1.05, eCold: 1 },
  { section: 'details', at: 2.4, anchor: 'slot-chapter', fit: 1.05, rx: 0.35, ry: 0.55, rz: -0.25, warm: 0.4, exposure: 1.15, eBench: 1 },
  { section: 'details', at: 3.0, anchor: 'slot-chapter', fit: 1.05, rx: 0.3, ry: 0.65, rz: -0.3, warm: 0.4, exposure: 1.15, eBench: 1 },
  { section: 'details', at: 3.4, anchor: 'slot-chapter', fit: 1.1, rx: 0.15, ry: -0.6, rz: 0.2, finish: 0.65, cool: 1, lume: 1, exposure: 0.55, eBlue: 1 },
  { section: 'details', at: 4.0, anchor: 'slot-chapter', fit: 1.1, rx: 0.1, ry: -0.7, rz: 0.25, finish: 0.65, cool: 1, lume: 1, exposure: 0.55, eBlue: 1 },
  { section: 'details', at: 4.4, anchor: 'slot-chapter-macro', fit: 3.4, ox: -0.02, oy: 0.62, rx: -0.35, ry: 0.25, rz: 0.4, glow: 1.2, speed: 3, exposure: 1.05, eCopper: 1 },
  { section: 'details', at: 5.2, anchor: 'slot-chapter-macro', fit: 3.6, ox: -0.02, oy: 0.62, rx: -0.3, ry: 0.32, rz: 0.5, glow: 1.2, speed: 3, exposure: 1.05, eCopper: 1 },

  // Open heart: framed macro of the movement in gold, with pinned labels.
  { section: 'heart', at: -0.25, anchor: 'slot-heart', fit: 1.55, oy: 0.18, rx: -0.05, ry: 0.05, gold: 1, glow: 0.9, clip: 1, hot: 0, exposure: 1.15 },
  { section: 'heart', at: 0.1, anchor: 'slot-heart', fit: 1.6, oy: 0.18, rx: -0.02, ry: 0.05, gold: 1, glow: 0.9, clip: 1, hot: 1, exposure: 1.15 },
  { section: 'heart', at: 0.6, anchor: 'slot-heart', fit: 1.6, oy: 0.18, rx: -0.02, ry: -0.05, gold: 1, glow: 0.9, clip: 1, hot: 1, exposure: 1.15 },

  // Pure: blacked-out watch, face on, behind the outline type.
  { section: 'pure', at: -0.3, anchor: 'slot-pure', fit: 1, finish: 1, exposure: 0.85, glow: 0.4, eHalo: 0.25 },
  { section: 'pure', at: 0.4, anchor: 'slot-pure', fit: 1, finish: 1, exposure: 0.85, glow: 0.4, eHalo: 0.25 },
];
