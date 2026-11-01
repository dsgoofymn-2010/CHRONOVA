import { useMemo } from 'react';

// Seeded random so the bokeh layout is identical on every load.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function Bokeh({ seed, count, colors, size = [40, 160] }) {
  const dots = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      left: `${r() * 100}%`,
      top: `${r() * 100}%`,
      w: size[0] + r() * (size[1] - size[0]),
      c: colors[Math.floor(r() * colors.length)],
      b: `${6 + r() * 18}px`,
      d: `${8 + r() * 10}s`,
      dx: `${(r() - 0.5) * 60}px`,
      dy: `${(r() - 0.5) * 40}px`,
      o: 0.25 + r() * 0.6,
    }));
  }, [seed, count, colors, size]);
  return dots.map((d, i) => (
    <span
      key={i}
      className="bokeh"
      style={{
        left: d.left, top: d.top, width: d.w, height: d.w, opacity: d.o,
        background: `radial-gradient(circle, ${d.c} 0%, ${d.c} 55%, transparent 72%)`,
        '--b': d.b, '--d': d.d, '--dx': d.dx, '--dy': d.dy,
      }}
    />
  ));
}

const WARM = ['#ffb35c', '#ff8a2b', '#ffd18a', '#c9672a'];
const BLUE = ['#5aa8ff', '#2d6dff', '#ff4b4b', '#ffd27a', '#8fd0ff'];
const COPPER = ['#ff7a2a', '#ffb15c'];

export default function Backdrops({ register }) {
  return (
    <div className="backdrops" aria-hidden="true">
      <div className="backdrop bd-halo" ref={(el) => register('halo', el)} />
      <div className="backdrop bd-warm" ref={(el) => register('warm', el)}>
        <Bokeh seed={7} count={22} colors={WARM} size={[60, 220]} />
      </div>
      <div className="backdrop bd-cold" ref={(el) => register('cold', el)} />
      <div className="backdrop bd-bench" ref={(el) => register('bench', el)} />
      <div className="backdrop bd-blue" ref={(el) => register('blue', el)}>
        <Bokeh seed={23} count={34} colors={BLUE} size={[24, 120]} />
      </div>
      <div className="backdrop bd-copper" ref={(el) => register('copper', el)}>
        <Bokeh seed={41} count={12} colors={COPPER} size={[80, 260]} />
      </div>
    </div>
  );
}
