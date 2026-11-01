import { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

export const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'mechanism', label: 'Mechanism' },
  { id: 'craft', label: 'Craftsmanship' },
  { id: 'details', label: 'Details' },
  { id: 'heart', label: 'Specs' },
];

export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight * 0.45;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= mid) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ids]);
  return active;
}

const IDS = ['overview', 'mechanism', 'manifesto', 'craft', 'numbers', 'details', 'heart', 'pure', 'reserve'];

export default function Hud({ go, show }) {
  const active = useActiveSection(IDS);
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const navActive = { manifesto: 'mechanism', numbers: 'craft', pure: 'heart', reserve: 'heart' }[active] ?? active;
  const idx = IDS.indexOf(active) + 1;

  return (
    <>
      <motion.header
        className="nav"
        initial={{ y: -30, opacity: 0 }}
        animate={show ? { y: 0, opacity: 1 } : {}}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      >
        <a className="brand" href="#overview" onClick={(e) => { e.preventDefault(); go('overview'); }}>
          <b>CHRONOVA</b>
          <small>Vallée de Joux</small>
        </a>
        <nav className="navlinks hud" aria-label="Sections">
          {NAV.map((n, i) => (
            <button key={n.id} onClick={() => go(n.id)} className={navActive === n.id ? 'on' : ''}>
              <span className="num">0{i + 1}</span>
              {n.label}
              {navActive === n.id && <motion.span layoutId="navbar" className="bar" transition={{ type: 'spring', stiffness: 380, damping: 34 }} />}
            </button>
          ))}
        </nav>
        <button className="btn" onClick={() => go('reserve')}>
          Reserve <span className="tick" />
        </button>
      </motion.header>

      <motion.div className="frame" aria-hidden="true" initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : {}} transition={{ duration: 1.4, delay: 0.6 }}>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
      </motion.div>

      <div className="side-meta hud" aria-hidden="true">46°36′N 6°13′E — Le Brassus</div>

      <motion.div className="rail" aria-hidden="true" initial={{ opacity: 0 }} animate={show ? { opacity: 1 } : {}} transition={{ duration: 1.2, delay: 0.5 }}>
        <span className="hud live"><span className="dot" /> CX-0 / 4 Hz</span>
        <div className="track">
          <span className="ticks" />
          <motion.span className="fill" style={{ scaleX: fill }} />
        </div>
        <span className="hud" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {String(idx).padStart(2, '0')} / {String(IDS.length).padStart(2, '0')}
        </span>
      </motion.div>
    </>
  );
}
