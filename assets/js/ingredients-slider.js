(() => {
  const track = document.querySelector('[data-ingredients-slider]');
  const { gsap } = window;
  if (!track || !gsap) return;

  const imageRoot = new URL('../images/', document.currentScript.src);
  const vegetables = [
    { name: 'Картофель', result: 'картофельный чипс', raw: 'cutouts/potato-2x.webp', chip: 'cutouts/chip-2x.webp' },
    { name: 'Морковь', result: 'морковный чипс', raw: 'cutouts/carrot-2x.webp', chip: 'cutouts/carrot-chip.webp' },
    { name: 'Свёкла', result: 'свекольный чипс', raw: 'cutouts/beet-2x.webp', chip: 'cutouts/beet-chip.webp' },
  ];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const status = document.querySelector('[data-ingredient-status]');
  let active = 0;
  let busy = false;
  let timeline;
  let cards = [];
  const wrap = value => (value % vegetables.length + vegetables.length) % vegetables.length;
  const spacing = () => track.clientWidth * (matchMedia('(max-width: 1024px)').matches ? 0.5 : 0.25);

  // Decode both states before exposing the interactive version.
  Promise.all(vegetables.flatMap(vegetable => [vegetable.raw, vegetable.chip]).map(async source => {
    const image = new Image();
    image.src = new URL(source, imageRoot).href;
    await image.decode();
  })).then(() => {
    render();
    track.dataset.sliderReady = '';
  }).catch(() => { /* Keep the original HTML illustration if an asset cannot load. */ });

  function render() {
    const fragment = document.createDocumentFragment();
    cards = [];
    for (let slot = -3; slot <= 3; slot++) {
      const vegetable = vegetables[wrap(active + slot)];
      const card = document.createElement('div');
      card.className = 'ingredient-slide';
      card.setAttribute('aria-hidden', 'true');
      const shape = document.createElement('span');
      shape.className = 'ingredient-slide__shape';
      card.append(shape);
      for (const state of ['raw', 'chip']) {
        const image = document.createElement('img');
        image.className = 'ingredient-slide__' + state;
        image.src = new URL(vegetable[state], imageRoot).href;
        image.alt = '';
        image.draggable = false;
        card.append(image);
      }
      gsap.set(card, { x: slot * spacing() });
      if (slot === 0) {
        gsap.set(card.querySelector('.ingredient-slide__raw'), { autoAlpha: 0 });
        gsap.set([shape, card.querySelector('.ingredient-slide__chip')], { autoAlpha: 1 });
      }
      cards.push({ card, slot });
      fragment.append(card);
    }
    track.replaceChildren(fragment);
    status.textContent = vegetables[active].name + ' → ' + vegetables[active].result;
  }

  function move(direction) {
    if (busy || !track.hasAttribute('data-slider-ready')) return;
    active = wrap(active + direction);
    if (reducedMotion.matches) { render(); return; }
    busy = true;
    timeline = gsap.timeline({ onComplete: () => { busy = false; render(); } });
    for (const { card, slot } of cards) {
      timeline.to(card, { x: (slot - direction) * spacing(), duration: 0.65, ease: 'power3.inOut' }, 0);
      if (slot === 0 || slot === direction) {
        const selected = slot === direction;
        timeline.to(card.querySelector('.ingredient-slide__raw'), {
          autoAlpha: selected ? 0 : 1, scale: selected ? 0.8 : 1,
          rotation: selected ? -12 : 0, duration: 0.35,
        }, selected ? 0.25 : 0);
        timeline.fromTo(card.querySelector('.ingredient-slide__chip'),
          { scale: selected ? 0.6 : 1, rotation: selected ? 15 : 0 },
          { autoAlpha: selected ? 1 : 0, scale: 1, rotation: 0, duration: 0.4, ease: 'power3.out' }, selected ? 0.3 : 0);
        timeline.to(card.querySelector('.ingredient-slide__shape'), { autoAlpha: selected ? 1 : 0, duration: 0.35 }, selected ? 0.25 : 0);
      }
    }
  }

  track.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
  let gesture;
  track.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || busy) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    render();
  }
  new ResizeObserver(reset).observe(track);
  reducedMotion.addEventListener('change', reset);
})();
