(() => {
  const track = document.querySelector('[data-ingredients-slider]');
  const { gsap } = window;
  if (!track || !gsap) return;
  const section = track.closest('.ingredients');
  const wrapper = section.closest('[data-ingredients-scroll]');
  const imageRoot = new URL('../images/', document.currentScript.src);
  const vegetables = [
    { name: 'Картофель', result: 'картофельный чипс', raw: 'cutouts/potato-2x.webp', chip: 'cutouts/chip-2x.webp' },
    { name: 'Морковь', result: 'морковный чипс', raw: 'cutouts/carrot-whole.webp', chip: 'cutouts/carrot-chip.webp' },
    { name: 'Свёкла', result: 'свекольный чипс', raw: 'cutouts/beet-2x.webp', chip: 'cutouts/beet-chip.webp' },
  ];
  const config = { interval: 2.5, duration: 0.9 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const roomy = matchMedia('(min-height: 600px)');
  const status = document.querySelector('[data-ingredient-status]');
  let active = 0, busy = false, visible = false, menuOpen = false, focused = false, elapsed = 0;
  let timeline, gesture, previousTime;
  let cards = [];
  const wrap = value => (value % vegetables.length + vegetables.length) % vegetables.length;
  const spacing = () => track.clientWidth * (matchMedia('(max-width: 1024px)').matches ? 0.5 : 0.25);

  // Decode both states before replacing the static illustration.
  Promise.all(vegetables.flatMap(vegetable => [vegetable.raw, vegetable.chip]).map(async source => {
    const image = new Image();
    image.src = new URL(source, imageRoot).href;
    await image.decode();
  })).then(() => {
    track.dataset.sliderReady = '';
    reset();
    gsap.ticker.add(tick);
  }).catch(() => { /* Keep the original HTML illustration if an asset cannot load. */ });

  function morph(pair, x, size) {
    // Half entered: the vegetable centre has reached the fixed shape edge.
    const shapeHalf = size * 0.88 / 2;
    const fadeDistance = size * 0.65 / 2;
    pair.setOpacity(gsap.utils.clamp(0, 1, (shapeHalf - Math.abs(x)) / fadeDistance));
  }
  function render(announce = true) {
    const fragment = document.createDocumentFragment();
    const rawLane = document.createElement('div');
    rawLane.className = 'ingredients__lane ingredients__lane--raw';
    const shape = document.createElement('span');
    shape.className = 'ingredients__shape';
    shape.setAttribute('aria-hidden', 'true');
    const chipLane = document.createElement('div');
    chipLane.className = 'ingredients__lane ingredients__lane--chips';
    cards = [];
    const step = spacing();
    const size = track.clientHeight;
    for (let slot = -3; slot <= 3; slot++) {
      const vegetable = vegetables[wrap(active + slot)];
      const pair = { slot };
      for (const state of ['raw', 'chip']) {
        const card = document.createElement('div');
        card.className = 'ingredient-slide';
        card.setAttribute('aria-hidden', 'true');
        const image = document.createElement('img');
        image.className = 'ingredient-slide__' + state;
        image.src = new URL(vegetable[state], imageRoot).href;
        image.alt = '';
        image.draggable = false;
        card.append(image);
        (state === 'raw' ? rawLane : chipLane).append(card);
        pair[state] = card;
      }
      pair.setX = gsap.quickSetter([pair.raw, pair.chip], 'x', 'px');
      pair.setOpacity = gsap.quickSetter(pair.chip, 'opacity');
      pair.setX(slot * step);
      morph(pair, slot * step, size);
      cards.push(pair);
    }
    fragment.append(rawLane, shape, chipLane);
    track.replaceChildren(fragment);
    track.dataset.ingredientIndex = active;
    // Do not announce autoplay to screen readers every 2.5 seconds.
    if (announce) status.textContent = vegetables[active].name + ' → ' + vegetables[active].result;
  }
  function move(direction, automatic = false) {
    if (busy || !track.hasAttribute('data-slider-ready')) return;
    elapsed = 0;
    active = wrap(active + direction);
    if (reducedMotion.matches) { render(); return; }
    busy = true;
    const step = spacing();
    const size = track.clientHeight;
    const travel = { progress: 0 };
    timeline = gsap.timeline({ onComplete: () => { busy = false; render(!automatic); } });
    timeline.to(travel, {
      progress: 1, duration: config.duration, ease: 'power2.inOut',
      onUpdate: () => {
        for (const pair of cards) {
          const x = (pair.slot - direction * travel.progress) * step;
          pair.setX(x);
          morph(pair, x, size);
        }
      },
    });
  }
  function tick(time) {
    const delta = previousTime === undefined ? 0 : Math.min(time - previousTime, 0.1);
    previousTime = time;
    const revealed = !['pending', 'running'].includes(track.dataset.revealState);
    if (!visible || !revealed || document.hidden || menuOpen || focused || gesture || reducedMotion.matches) {
      elapsed = 0;
      return;
    }
    elapsed += delta;
    if (elapsed >= config.interval && !busy) move(1, true);
  }
  function syncPause() {
    timeline?.paused(document.hidden || menuOpen);
    elapsed = 0;
  }
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
    if (!visible) elapsed = 0;
  }, { threshold: [0, 0.6, 1] }).observe(track);
  document.addEventListener('visibilitychange', syncPause);
  addEventListener('site:menu', event => { menuOpen = event.detail.open; syncPause(); });
  track.addEventListener('focusin', () => { focused = track.matches(':focus-visible'); elapsed = 0; });
  track.addEventListener('focusout', event => { focused = track.contains(event.relatedTarget); elapsed = 0; });
  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    focused = true;
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
  track.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || busy) return;
    focused = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    elapsed = 0;
  });
  track.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) track.setPointerCapture(event.pointerId);
  });
  track.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1);
  });
  track.addEventListener('pointercancel', () => { gesture = null; });
  track.addEventListener('lostpointercapture', () => { gesture = null; });
  function reset() {
    if (!track.hasAttribute('data-slider-ready')) return;
    timeline?.kill();
    busy = false;
    gesture = null;
    elapsed = 0;
    // Short windows and reduced motion retain ordinary document scrolling.
    wrapper.toggleAttribute('data-ingredients-pinned', !reducedMotion.matches && roomy.matches);
    render();
    if (section.scrollHeight > section.clientHeight + 1) wrapper.removeAttribute('data-ingredients-pinned');
  }
  new ResizeObserver(reset).observe(track);
  reducedMotion.addEventListener('change', reset);
  roomy.addEventListener('change', reset);
})();
