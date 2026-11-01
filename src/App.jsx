import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import Lenis from 'lenis';
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
  const [sceneReady, setSceneReady] = useState(false);
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
    let cancelled = false;
    // three.js loads as its own chunk, so the page and opening video appear first.
    import('./scene/Stage.js')
      .then(({ Stage }) => {
        if (cancelled) return;
        stage = new Stage(canvasRef.current, { reducedMotion: reduced });
        stageRef.current = stage;
        for (const [k, el] of Object.entries(pending.current.backdrops)) stage.registerBackdrop(k, el);
        for (const [k, el] of Object.entries(pending.current.hotspots)) stage.registerHotspot(k, el);
        // Fonts change layout; re-measure once they land.
        document.fonts?.ready.then(() => stage.measure());
        // Shaders keep compiling in the background: the watch is hidden behind the
        // opening video, so there's no need to hold the loading screen for them.
      })
      .catch((err) => console.warn('WebGL unavailable', err))
      .finally(() => !cancelled && setSceneReady(true));
    return () => {
      cancelled = true;
      stage?.dispose();
    };
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
    if (l) loading ? l.stop() : l.start();
    if (loading || !sceneReady) return;
    // Prepare the watch's shaders while the opening video plays.
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 300));
    // Wait for the loading screen's exit animation to finish first.
    const t = setTimeout(() => idle(() => stageRef.current?.warmUp()), 1200);
    return () => clearTimeout(t);
  }, [loading, sceneReady]);

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
      <AnimatePresence>{loading && <Loader key="loader" ready={sceneReady} onDone={() => setLoading(false)} />}</AnimatePresence>
    </MotionConfig>
  );
}
