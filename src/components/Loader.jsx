import { useEffect, useRef, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { EASE } from './motion.jsx';

const MIN_MS = 700; // long enough for the brand to register
const MAX_MS = 6000; // never hold the page longer than this

// Finishes as soon as the 3D watch is ready, instead of after a fixed delay.
export default function Loader({ ready, onDone }) {
  const [n, setN] = useState(0);
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const finishing = useRef(false);
  const current = useRef(0);

  // Count towards 90 while the 3D engine loads.
  useEffect(() => {
    const c = animate(0, 90, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        current.current = v;
        setN(Math.round(v));
      },
    });
    const a = setTimeout(() => setMinDone(true), MIN_MS);
    const b = setTimeout(() => setTimedOut(true), MAX_MS);
    return () => {
      c.stop();
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  // Then run the last stretch to 100 and get out of the way.
  useEffect(() => {
    if (finishing.current || !minDone || !(ready || timedOut)) return;
    finishing.current = true;
    animate(current.current, 100, {
      duration: 0.3,
      ease: 'easeOut',
      onUpdate: (v) => setN(Math.round(v)),
      onComplete: onDone,
    });
  }, [ready, timedOut, minDone, onDone]);

  return (
    <motion.div
      className="loader"
      initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className="loader-inner">
        <motion.div
          className="brand-l"
          initial={{ opacity: 0, letterSpacing: '0.9em' }}
          animate={{ opacity: 1, letterSpacing: '0.5em' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          CHRONOVA
        </motion.div>
        <div className="line">
          <i style={{ transform: `scaleX(${n / 100})` }} />
        </div>
        <div className="count">{String(n).padStart(3, '0')} / 100 — calibrating</div>
      </div>
    </motion.div>
  );
}
