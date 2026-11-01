# Chronova Type-0

A scroll-driven product page for a skeleton tourbillon watch, built with React, Framer Motion and Three.js.

The watch is modelled in code (`src/scene/buildWatch.js`), not loaded from a file. One fixed WebGL canvas follows
the scroll: each section has empty "slot" elements, and `src/scene/timeline.js` lists keyframes that say which slot
the watch sits in and how it is posed (rotation, zoom, exploded caliber, finish, lighting, backdrop).

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build          # static site in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

## Notes

- The reservation form is front-end only. Connect it to your booking backend in `src/components/Sections.jsx` (`Reserve`).
- Smooth scrolling uses Lenis. Reduced-motion users get instant transitions and no loader.
