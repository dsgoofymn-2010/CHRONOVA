import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import Lenis from 'lenis';
import { Stage } from './scene/Stage.js';
import Loader from './components/Loader.jsx';
import Hud from './components/Hud.jsx';
import Backdrops from './components/Backdrops.jsx';
import { Hero, Mechanism, Manifesto, Craft, Numbers, Details, Heart, Hotspots, Pure, Marquee, Reserve, Footer } from './components/Sections.jsx';

const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function App() {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const lenisRef = useRef(null);
  const pending = useRef({ backdrops: {}, hotspots: {} });
  const [loading, setLoading] = useState(!reduced);
  const ready = !loading;

  // Elements can mount before the WebGL stage exists, so queue them.
  const registerBackdrop = useCallback((name, el) => {
    if (!el) return;
    pending.current.backdrops[name] = el;
    stageRef.current?.registerBackdrop(name, el);
  }, []);
  const registerHotspot = useCallback((name, el) => {
    if (!el) return;
    pending.current.hotspots[name] = el;
    stageRef.current?.registerHotspot(name, el);
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    let stage;
    try {
      stage = new Stage(canvasRef.current, { reducedMotion: reduced });
    } catch (err) {
      console.warn('WebGL unavailable', err);
      return;
    }
    stageRef.current = stage;
    for (const [k, el] of Object.entries(pending.current.backdrops)) stage.registerBackdrop(k, el);
    for (const [k, el] of Object.entries(pending.current.hotspots)) stage.registerHotspot(k, el);
    // Fonts change layout; re-measure once they land.
    document.fonts?.ready.then(() => stage.measure());
    return () => stage.dispose();
  }, []);

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;
    let id;
    const raf = (t) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); };
  }, []);

  useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    loading ? l.stop() : l.start();
  }, [loading]);

  const go = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (lenisRef.current) lenisRef.current.scrollTo(el, { duration: 2.2 });
    else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Backdrops register={registerBackdrop} />
      <canvas ref={canvasRef} className="webgl" aria-label="3D model of the Chronova Type-0 watch" role="img" />
      <Hotspots register={registerHotspot} />
      <div className="grain" aria-hidden="true" />
      <Hud go={go} show={ready} />
      <main>
        <Hero ready={ready} go={go} />
        <Mechanism />
        <Manifesto go={go} />
        <Craft />
        <Numbers />
        <Details />
        <Heart />
        <Pure />
        <Marquee />
        <Reserve />
      </main>
      <Footer />
      <AnimatePresence>{loading && <Loader key="loader" onDone={() => setLoading(false)} />}</AnimatePresence>
    </MotionConfig>
  );
}
