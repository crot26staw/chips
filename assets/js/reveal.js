(() => {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const items = [...document.querySelectorAll('[data-reveal]')];
  const pending = new Set();
  const running = new Map();
  let observer;

  // CSS is the single source of truth for timing, easing and responsive distance.
  function settings() {
    const style = getComputedStyle(document.documentElement);
    const milliseconds = name => {
      const value = style.getPropertyValue(name).trim();
      return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000);
    };
    return {
      duration: milliseconds('--reveal-duration'),
      stagger: milliseconds('--reveal-stagger'),
      distance: style.getPropertyValue('--reveal-distance').trim(),
      easing: style.getPropertyValue('--reveal-easing').trim(),
    };
  }

  function finish(item) {
    // Remove our effects, leaving the original CSS (including hover) in control.
    item.dataset.revealState = 'revealed';
    pending.delete(item);
    observer?.unobserve(item);
    running.get(item)?.forEach(animation => animation.cancel());
    running.delete(item);
  }

  function reveal(item, delay, config) {
    if (!pending.has(item)) return;
    pending.delete(item);
    observer.unobserve(item);
    try {
      const options = { duration: config.duration, delay, easing: config.easing, fill: 'both' };
      // Add translation to the existing transform; do not replace badge rotations
      // or CSS hover transforms. Opacity uses normal replacement compositing.
      const movement = item.animate([
        { transform: `translateY(${config.distance})` },
        { transform: 'translateY(0px)' },
      ], { ...options, composite: 'add' });
      running.set(item, [movement]);
      const fade = item.animate([{ opacity: 0 }, { opacity: 1 }], options);
      running.get(item).push(fade);
      item.dataset.revealState = 'running';
      fade.onfinish = () => finish(item);
    } catch {
      // Unsupported animation options must never leave content hidden.
      finish(item);
    }
  }

  function showAll() {
    observer?.disconnect();
    items.forEach(finish);
  }

  if (motion.matches) return;
  try {
    observer = new IntersectionObserver(entries => {
      const visible = new Set(entries.filter(entry => entry.isIntersecting).map(entry => entry.target));
      const groups = new Map();
      // Document order follows the composition, including row-major card grids.
      // Only newly visible neighbours share a sequence; no page-wide delay.
      for (const item of items) {
        if (!visible.has(item) || !pending.has(item)) continue;
        const group = item.closest('[data-reveal-group]') || item;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(item);
      }
      const config = settings();
      for (const group of groups.values()) {
        group.forEach((item, index) => reveal(item, index * config.stagger, config));
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

    for (const item of items) {
      pending.add(item);
      item.dataset.revealState = 'pending';
    }
    // Do not wait for offscreen images or videos. Local fonts settle the layout.
    const ready = document.fonts?.ready || Promise.resolve();
    ready.then(() => {
      if (!motion.matches) pending.forEach(item => observer.observe(item));
      else showAll();
    }).catch(showAll);
    motion.addEventListener('change', event => { if (event.matches) showAll(); });
    // Focused controls are immediately visible and usable, even during a delay.
    document.addEventListener('focusin', event => {
      const item = event.target.closest('[data-reveal]');
      if (item) finish(item);
    });
    // Keep a restored page visible; entrances never replay on history traversal.
    addEventListener('pagehide', showAll);
  } catch {
    showAll();
  }
})();
