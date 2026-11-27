(() => {
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const items = [...document.querySelectorAll('[data-reveal]')];
  const pending = new Set();
  const running = new Map();
  const candidates = new Set();
  let observer;
  let frame = 0;

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
      trigger: parseFloat(style.getPropertyValue('--reveal-trigger')),
      visibleRatio: parseFloat(style.getPropertyValue('--reveal-visible-ratio')),
    };
  }

  function finish(item) {
    // Remove our effects, leaving the original CSS (including hover) in control.
    item.dataset.revealState = 'revealed';
    pending.delete(item);
    candidates.delete(item);
    observer?.unobserve(item);
    running.get(item)?.forEach(animation => animation.cancel());
    running.delete(item);
  }

  function reveal(item, delay, config) {
    if (!pending.has(item)) return;
    pending.delete(item);
    candidates.delete(item);
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
    cancelAnimationFrame(frame);
    frame = 0;
    candidates.clear();
    items.forEach(finish);
  }

  function schedule() {
    if (!frame && candidates.size && pending.size) frame = requestAnimationFrame(checkVisibility);
  }

  function checkVisibility() {
    frame = 0;
    if (document.hidden || document.documentElement.classList.contains('menu-open')) return;
    const config = settings();
    const groups = new Map();
    const sections = new Map();
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
    // IO supplies nearby candidates. Check their current geometry on the actual
    // scroll frame, including sticky sections and sections overlapping each other.
    for (const item of items) {
      if (!candidates.has(item) || !pending.has(item)) continue;
      const rect = item.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const group = item.closest('[data-reveal-group]') || item;
      if (!sections.has(group)) {
        sections.set(group, { rect: group.getBoundingClientRect(), sticky: getComputedStyle(group).position === 'sticky' });
      }
      const section = sections.get(group);
      const top = Math.max(0, rect.top, section.rect.top);
      const bottom = Math.min(innerHeight, rect.bottom, section.rect.bottom);
      if (bottom - top < Math.min(rect.height, innerHeight) * config.visibleRatio) continue;
      const firstScreen = group.matches('.header, .hero');
      // A heading near the bottom of a pinned viewport cannot reach the usual
      // trigger line. Reveal it once that section has fully entered instead.
      const pinned = section.sticky && section.rect.top <= 1;
      if (!firstScreen && !pinned && !atEnd && rect.top > innerHeight * config.trigger) continue;
      // Geometric intersection alone does not account for another section above.
      const x = Math.max(1, Math.min(innerWidth - 1, rect.left + rect.width / 2));
      const painted = document.elementFromPoint(x, (top + bottom) / 2);
      if (!painted || !group.contains(painted)) continue;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    }
    // Read all geometry before starting effects. Neighbours overlap in time,
    // while each newly visible section gets its own independent sequence.
    for (const group of groups.values()) {
      group.forEach((item, index) => reveal(item, index * config.stagger, config));
    }
  }

  if (motion.matches) return;
  try {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) candidates.add(entry.target);
        else candidates.delete(entry.target);
      }
      schedule();
    }, { threshold: 0 });

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
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    addEventListener('site:menu', schedule);
    document.addEventListener('visibilitychange', schedule);
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
