import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';

export const EASE = [0.76, 0, 0.24, 1];
export const EASE_OUT = [0.16, 1, 0.3, 1];

/* Masked line reveal: each line slides up from behind its own clip. */
export function Lines({ lines, className = '', as: Tag = 'h2', delay = 0, play = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  const show = play && inView;
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        <span className="mask" key={i}>
          <motion.span
            initial={{ y: '105%' }}
            animate={show ? { y: '0%' } : { y: '105%' }}
            transition={{ duration: 1.1, ease: EASE_OUT, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/* Fade + rise for supporting copy. */
export function Rise({ children, delay = 0, className = '', play = true, ...rest }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  const show = play && inView;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 1, ease: EASE_OUT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/* Counts up to a value the first time it enters view. */
export function Count({ to, decimals = 0, prefix = '', suffix = '', sep = ',', duration = 2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to, duration]);
  const fixed = v.toFixed(decimals);
  const [int, dec] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (
    <span ref={ref}>
      {prefix}
      {grouped}
      {dec ? `.${dec}` : ''}
      {suffix}
    </span>
  );
}
