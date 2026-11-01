import { useEffect, useState } from 'react';
import { motion, animate } from 'framer-motion';
import { EASE } from './motion.jsx';

export default function Loader({ onDone }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const c = animate(0, 100, {
      duration: 1.9,
      ease: [0.65, 0, 0.35, 1],
      onUpdate: (v) => setN(Math.round(v)),
      onComplete: () => setTimeout(onDone, 250),
    });
    return () => c.stop();
  }, [onDone]);
  return (
    <motion.div
      className="loader"
      initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
      exit={{ clipPath: 'inset(0% 0% 100% 0%)' }}
      transition={{ duration: 1.1, ease: EASE }}
    >
      <div className="loader-inner">
        <motion.div
          className="brand-l"
          initial={{ opacity: 0, letterSpacing: '0.9em' }}
          animate={{ opacity: 1, letterSpacing: '0.5em' }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
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
