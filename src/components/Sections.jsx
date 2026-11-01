import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useTransform } from 'framer-motion';
import { Lines, Rise, Count, EASE_OUT } from './motion.jsx';

const media = (f) => `${import.meta.env.BASE_URL}media/${f}`;

/* Background clip: plays only while on screen, scales gently with scroll. */
function Clip({ src, poster, className, scrollRef, lazy = false }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ['start start', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1.04, 1.18]);
  // Play only while on screen; a lazy clip doesn't download until it is about to be seen.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (lazy && v.preload !== 'auto') {
            v.preload = 'auto';
            v.load();
          }
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [lazy]);
  return (
    <motion.video
      ref={ref}
      className={className}
      style={{ scale }}
      src={media(src)}
      poster={media(poster)}
      autoPlay={!lazy}
      muted
      loop
      playsInline
      preload={lazy ? 'none' : 'auto'}
      aria-hidden="true"
    />
  );
}

/* ---------------- 01 Hero ---------------- */
export function Hero({ ready, go }) {
  const ref = useRef(null);
  return (
    <section id="overview" className="hero wrap" ref={ref}>
      <div className="hero-media under" aria-hidden="true">
        <Clip src="w1.mp4" poster="w1-poster.jpg" className="hero-video" scrollRef={ref} />
        <div className="hero-veil" />
      </div>
      <div className="hero-copy over">
        <Rise play={ready} delay={0.1}>
          <span className="hud">Ref. CX-0 — Skeleton flying tourbillon</span>
        </Rise>
        <Lines
          as="h1"
          className="display thin"
          play={ready}
          delay={0.15}
          lines={['Chronova', <><span className="slash">//</span> Type-0</>]}
        />
        <Rise play={ready} delay={0.5}>
          <p className="lede">
            A hand-wound tourbillon you can see straight through. 214 parts, one watchmaker, and a balance
            that beats four times every second.
          </p>
        </Rise>
        <Rise play={ready} delay={0.65} className="hero-actions">
          <button className="btn solid" onClick={() => go('reserve')}>Reserve yours <span className="tick" /></button>
          <button className="btn" onClick={() => go('mechanism')}>See the movement</button>
        </Rise>
        <Rise play={ready} delay={0.8} className="hero-meta">
          <div><span className="hud">Case</span><strong>42 mm titanium</strong></div>
          <div><span className="hud">Reserve</span><strong>72 hours</strong></div>
          <div><span className="hud">Edition</span><strong>88 / year</strong></div>
        </Rise>
      </div>
      <div id="slot-hero" className="slot" aria-hidden="true" />
    </section>
  );
}

/* ---------------- 02 Mechanism (pinned) ---------------- */
const STEPS = [
  {
    kicker: ['Specifications', '01. Movement'],
    big: 'CX-0',
    copy: 'Hand-wound calibre, 36.6 mm across. Every bridge is skeletonised by hand so light passes through the whole movement.',
    list: [['Diameter', '36.6 mm'], ['Jewels', '31'], ['Parts', '214']],
  },
  {
    kicker: ['Specifications', '02. Rotation'],
    big: '4 Hz',
    copy: 'The balance swings 28,800 times an hour. Its cage turns once a minute, averaging out the pull of gravity.',
    list: [['Frequency', '28,800 vph'], ['Cage turn', '60 s'], ['Hairspring', 'Phillips curve']],
  },
  {
    kicker: ['03. Caliber', 'Balance'],
    big: 'Active',
    copy: 'Seven layers from case back to sapphire. Each one is finished and inspected before the next goes on.',
    list: [['Layers', '7'], ['Finishing', 'Perlage, anglage'], ['Screws', 'Flame-blued']],
  },
  {
    kicker: ['04. Assembly', 'Cased'],
    big: '12 h',
    copy: 'Twelve hours to case it, then four weeks of regulation in six positions before it leaves Le Brassus.',
    list: [['Regulation', '6 positions'], ['Tolerance', '±2 s / day'], ['Test', '28 days']],
  },
];

export function Mechanism() {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // Breakpoints match the 3D timeline: macro, tilt, exploded, reassembled.
    const s = v < 0.24 ? 0 : v < 0.5 ? 1 : v < 0.8 ? 2 : 3;
    setStep(s);
  });
  const s = STEPS[step];
  return (
    <section id="mechanism" className="pin" ref={ref}>
      <div className="pin-stage">
        <div id="slot-mech" className="slot slot-full" aria-hidden="true" />
        <div id="slot-mech-side" className="slot slot-side" aria-hidden="true" />
        <div className="shade" aria-hidden="true" />
        <div className="step-copy">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              style={{ display: 'grid', gap: 18 }}
            >
              <h2 className="step-kicker">
                {s.kicker[0]}
                <br />
                <span className="slash">//</span> {s.kicker[1]}
              </h2>
              <div className="step-big">{s.big}</div>
              <p className="lede" style={{ fontSize: 15 }}>{s.copy}</p>
              <ul className="step-list hud">
                {s.list.map(([k, v]) => (
                  <li key={k}><span>{k}</span><span>{v}</span></li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="step-index hud" aria-hidden="true">
          {STEPS.map((x, i) => (
            <span key={i} className={i === step ? 'on' : ''}>0{i + 1} {x.kicker[1].replace(/^\d+\.\s*/, '')}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Manifesto ---------------- */
export function Manifesto({ go }) {
  return (
    <section id="manifesto" className="manifesto wrap">
      <div className="manifesto-copy over">
        <span className="hud">Ref. CX-0 — In brief</span>
        <Lines className="display" lines={['Not just', <span className="accent">a watch.</span>]} />
        <Rise delay={0.15}>
          <p className="lede">
            The Type-0 shows you how it keeps time. No dial hides the gear train, so the barrel, the wheels and the
            tourbillon all stay in view while you wear it.
          </p>
        </Rise>
        <Rise delay={0.25} className="minispecs">
          <div><span className="hud">Calibre</span><strong>CX-0</strong></div>
          <div><span className="hud">Frequency</span><strong>28 800 vph</strong></div>
          <div><span className="hud">Reserve</span><strong>72 h</strong></div>
        </Rise>
        <Rise delay={0.35}>
          <button className="btn" onClick={() => go('mechanism')}>Explore the mechanism <span className="tick" /></button>
        </Rise>
      </div>
      <div id="slot-manifesto" className="slot" aria-hidden="true" />
    </section>
  );
}

/* ---------------- Made by hand ---------------- */
export function Craft() {
  const ref = useRef(null);
  return (
    <section id="craft" className="craft wrap" ref={ref}>
      <motion.div
        className="craft-panel"
        initial={{ clipPath: 'inset(12% 12% 12% 12%)' }}
        whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
        viewport={{ once: true, margin: '0px 0px -15% 0px' }}
        transition={{ duration: 1.4, ease: EASE_OUT }}
      >
        <div id="slot-craft" className="slot" aria-hidden="true" />
        <Clip src="w2.mp4" poster="w2-poster.jpg" className="craft-video" scrollRef={ref} lazy />
        <span className="hud">Atelier 3 — Bench 07</span>
      </motion.div>
      <div className="craft-copy over">
        <span className="hud">Craftsmanship</span>
        <Lines className="display" lines={['Made by', <span className="accent">hand.</span>]} />
        <Rise delay={0.15}>
          <p className="lede">
            Every CX-0 movement is assembled by a single watchmaker, start to finish. It takes eleven weeks, and
            their initials are engraved under the barrel bridge when it is done.
          </p>
        </Rise>
        <Rise delay={0.25} className="craft-list">
          <div><strong><Count to={214} /></strong><span className="hud">Components</span></div>
          <div><strong><Count to={72} suffix="h" /></strong><span className="hud">Power reserve</span></div>
          <div><strong><Count to={1} duration={0.8} /></strong><span className="hud">Watchmaker per piece</span></div>
        </Rise>
      </div>
    </section>
  );
}

/* ---------------- Numbers ---------------- */
const NUMS = [
  { n: <Count to={214} />, title: ['Hand-assembled', 'components'], copy: 'Counted, cleaned and fitted one at a time under a 12x loupe.' },
  { n: <Count to={28800} sep="." />, ice: true, title: ['VPH', 'frequency'], copy: 'Eight beats a second. Fast enough to hold accuracy through a knock.' },
  { n: <Count to={72} suffix="H" />, title: ['Hours', 'power reserve'], copy: 'Three full days from one winding, from twin series-coupled barrels.' },
  { n: <Count to={2} prefix="±" suffix="s" duration={1.2} />, title: ['Seconds', 'per day'], copy: 'Regulated in six positions, tighter than the chronometer standard.' },
];

export function Numbers() {
  return (
    <section id="numbers" className="numbers wrap">
      <div id="slot-numbers" className="slot" aria-hidden="true" />
      <Rise className="over" style={{ marginBottom: 28 }}>
        <span className="hud">By the numbers</span>
      </Rise>
      <div className="rows over">
        {NUMS.map((r, i) => (
          <motion.div
            key={i}
            className="num-row"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -12% 0px' }}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.05 }}
          >
            <div className={`n ${r.ice ? 'ice' : ''}`}>{r.n}</div>
            <div>
              <h3>{r.title[0]}<br />{r.title[1]}</h3>
              <p>{r.copy}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Every detail (pinned chapters) ---------------- */
const CHAPTERS = [
  { n: '01', color: 'var(--gold)', title: ['Worn by', 'the few.'], cap: '88 pieces a year. Each case back is engraved with its owner’s initials.' },
  { n: '02', color: 'var(--ice)', title: ['Forged', 'in cold.'], cap: 'Grade 5 titanium, cold-forged, then coated in black DLC hard enough to shrug off keys.' },
  { n: '03', color: 'var(--bone)', title: ['Hand', 'assembled.'], cap: '214 components, one watchmaker, eleven weeks from main plate to case.' },
  { n: '04', color: '#7fb0ff', title: ['Built', 'for', 'darkness.'], cap: 'Super-LumiNova on hands and indices. Water resistant to 100 m.' },
  { n: '05', color: 'var(--copper)', title: ['28 800', 'beats/h.'], cap: 'The balance never rests. Eight beats every second, for three days straight.' },
];

export function Details() {
  const ref = useRef(null);
  const [ch, setCh] = useState(0);
  const [intro, setIntro] = useState(true);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // Section is 6.2 screens tall, so 5.2 screens of pinned travel.
    const u = v * 5.2;
    setIntro(u < 0.45);
    setCh(u < 1.2 ? 0 : u < 2.2 ? 1 : u < 3.2 ? 2 : u < 4.2 ? 3 : 4);
  });
  const introY = useTransform(scrollYProgress, [0, 0.1], [0, -60]);
  const c = CHAPTERS[ch];
  return (
    <section id="details" className="details" ref={ref}>
      <div className="pin-stage">
        <div id="slot-chapter" className="slot slot-chapter" aria-hidden="true" />
        <div id="slot-chapter-macro" className="slot slot-full" aria-hidden="true" />
        <div className="shade" aria-hidden="true" />
        <motion.div className="details-intro" style={{ y: introY }} animate={{ opacity: intro ? 1 : 0 }} transition={{ duration: 0.5 }}>
          <span className="hud">The life of a Type-0</span>
          <Lines className="display" lines={['Every', 'detail.']} />
        </motion.div>
        <div className="chapter-copy">
          <AnimatePresence mode="wait">
            <motion.div key={ch} style={{ display: 'grid', gap: 10 }}>
              <span className="mask">
                <motion.span
                  className="chapter-num"
                  style={{ color: c.color }}
                  initial={{ y: '100%' }}
                  animate={{ y: '0%' }}
                  exit={{ y: '-100%' }}
                  transition={{ duration: 0.7, ease: EASE_OUT }}
                >
                  {c.n}
                </motion.span>
              </span>
              <h3 className="chapter-title">
                {c.title.map((t, i) => (
                  <span className="mask" key={i}>
                    <motion.span
                      initial={{ y: '105%' }}
                      animate={{ y: '0%' }}
                      exit={{ y: '-105%' }}
                      transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.06 + i * 0.06 }}
                    >
                      {t}
                    </motion.span>
                  </span>
                ))}
              </h3>
              <motion.p
                className="chapter-cap"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
              >
                {c.cap}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="chapter-dots hud" aria-hidden="true">
          {CHAPTERS.map((x, i) => (
            <span key={x.n} className={i === ch ? 'on' : ''}>{x.n} <i /></span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Open heart ---------------- */
export const HOTSPOTS = [
  { id: 'barrel', label: 'Mainspring barrel' },
  { id: 'tourbillon', label: 'Tourbillon cage', left: true },
  { id: 'escape', label: 'Fourth wheel' },
  { id: 'balance', label: 'Third wheel', left: true },
];

export function Heart() {
  return (
    <section id="heart" className="heart wrap">
      <div className="heart-copy over">
        <span className="hud">The mechanism</span>
        <Lines className="display" lines={['Open', <span className="accent">heart.</span>]} />
        <Rise delay={0.15}>
          <p className="lede">
            The dial is cut away so the escapement stays in view. The tourbillon cage weighs 0.3 g and makes one
            full turn every 60 seconds, correcting for gravity as it goes.
          </p>
        </Rise>
        <Rise delay={0.25} className="heart-stats">
          <div><strong><Count to={214} /></strong><span className="hud">Components</span></div>
          <div><strong><Count to={0.3} decimals={1} suffix="g" /></strong><span className="hud">Cage weight</span></div>
          <div><strong><Count to={28800} sep=" " /></strong><span className="hud">Vibrations / h</span></div>
          <div><strong>±2s</strong><span className="hud">Per day</span></div>
        </Rise>
      </div>
      <motion.div
        className="heart-panel"
        initial={{ clipPath: 'inset(0% 0% 0% 100%)' }}
        whileInView={{ clipPath: 'inset(0% 0% 0% 0%)' }}
        viewport={{ once: true, margin: '0px 0px -20% 0px' }}
        transition={{ duration: 1.3, ease: EASE_OUT }}
      >
        <div id="slot-heart" className="slot" aria-hidden="true" />
      </motion.div>
    </section>
  );
}

export function Hotspots({ register }) {
  return (
    <div className="hotspots" aria-hidden="true">
      {HOTSPOTS.map((h) => (
        <div key={h.id} className={`hotspot ${h.left ? 'left' : ''}`} ref={(el) => register(h.id, el)}>
          <span className="pin-dot" />
          <span className="tag hud">{h.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Pure + marquee ---------------- */
export function Pure() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, [0, 1], ['-42%', '-58%']);
  return (
    <section id="pure" className="pure wrap" ref={ref}>
      <motion.div className="pure-word under" style={{ x }} aria-hidden="true">PURE.</motion.div>
      <div id="slot-pure" className="slot" aria-hidden="true" />
      <Rise className="pure-caption">
        <span className="hud" style={{ color: 'var(--bone)' }}>Chronova Type-0 — Black DLC titanium</span>
        <span className="hud">Ref. CX-0/BK · 42 mm · 100 m</span>
      </Rise>
    </section>
  );
}

export function Marquee() {
  const items = Array.from({ length: 4 });
  return (
    <div className="marquee" aria-hidden="true">
      <motion.div
        className="marquee-track"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {[0, 1].map((k) => (
          <div key={k} style={{ display: 'flex' }}>
            {items.map((_, i) => (
              <span key={i}>Chronova Type-0 <b>//</b> Swiss made <b>•</b></span>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ---------------- Reserve + footer ---------------- */
export function Reserve() {
  const [sent, setSent] = useState(null);
  const [finish, setFinish] = useState('titanium');
  const onSubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSent({ name: f.get('name'), finish });
  };
  return (
    <section id="reserve" className="reserve wrap">
      <div className="reserve-copy">
        <span className="hud">Allocation 2027</span>
        <Lines className="display" lines={['Reserve', 'a Type-0.']} />
        <div className="price">CHF 48,500</div>
        <div className="terms hud">
          <div><span>Edition</span><span>88 pieces per year</span></div>
          <div><span>Delivery</span><span>From March 2027</span></div>
          <div><span>Deposit</span><span>20% on allocation</span></div>
          <div><span>Warranty</span><span>8 years</span></div>
        </div>
      </div>
      <form className="reserve-form" onSubmit={onSubmit}>
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div key="sent" className="sent" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
              <span className="hud" style={{ color: 'var(--gold)' }}>Request received</span>
              <p className="lede">
                Thank you, {sent.name}. Your request for the {sent.finish === 'dlc' ? 'black DLC' : 'titanium'} Type-0 is
                on the list. The atelier replies within two working days.
              </p>
              <button type="button" className="btn" onClick={() => setSent(null)}>Edit request</button>
            </motion.div>
          ) : (
            <motion.div key="form" style={{ display: 'grid', gap: 18 }} exit={{ opacity: 0, y: -10 }}>
              <span className="hud">Request an allocation</span>
              <div className="field">
                <label className="hud" htmlFor="r-name">Full name</label>
                <input id="r-name" name="name" required autoComplete="name" />
              </div>
              <div className="field">
                <label className="hud" htmlFor="r-email">Email</label>
                <input id="r-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="field">
                <span className="hud">Finish</span>
                <div className="finishes hud" role="radiogroup">
                  <label><input id="r-ti" type="radio" name="finish" checked={finish === 'titanium'} onChange={() => setFinish('titanium')} /><span>Titanium</span></label>
                  <label><input id="r-dlc" type="radio" name="finish" checked={finish === 'dlc'} onChange={() => setFinish('dlc')} /><span>Black DLC</span></label>
                </div>
              </div>
              <div className="field">
                <label className="hud" htmlFor="r-boutique">Preferred boutique</label>
                <select id="r-boutique" name="boutique" defaultValue="Geneva">
                  <option>Geneva</option>
                  <option>Le Brassus</option>
                  <option>London</option>
                  <option>Dubai</option>
                  <option>Singapore</option>
                </select>
              </div>
              <button className="btn solid" type="submit" style={{ justifySelf: 'start' }}>Request allocation <span className="tick" /></button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="foot wrap hud">
      <span>© 2026 Chronova — Le Brassus, Switzerland</span>
      <span>Chronova Type-0 · Ref. CX-0</span>
    </footer>
  );
}
