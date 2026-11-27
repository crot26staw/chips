(() => {
  const header = document.querySelector('.header');
  const toggle = header.querySelector('.header__toggle');
  const nav = header.querySelector('nav');
  const backdrop = document.querySelector('[data-menu-backdrop]');
  const adaptive = matchMedia('(max-width: 1024px)');
  const mobile = matchMedia('(width < 768px)');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pageContent = [...document.querySelectorAll('.site > main, .site > footer')];
  const sections = [...document.querySelectorAll('[data-section]')];
  const lightSurfaces = new Set(['ingredients', 'flavours', 'production', 'moments', 'shops']);
  const contrastTargets = [...header.querySelectorAll('.header__links > a, .header__brand, .header__actions > a, .header__toggle')];
  let open = false;
  let animation;
  let scheduled = false;
  toggle.hidden = false;

  // Measure at the header text's actual vertical position, including restored scroll.
  function updateContrast() {
    scheduled = false;
    const bounds = sections.map(section => ({ section, rect: section.getBoundingClientRect() }));
    for (const target of contrastTargets) {
      const rect = target.getBoundingClientRect();
      const y = rect.top + rect.height / 2;
      // Later sections paint over a pinned section during an overlapping transition.
      const underlying = bounds.findLast(item => item.rect.top <= y && item.rect.bottom > y)?.section;
      const tone = underlying && [...underlying.classList].some(name => lightSurfaces.has(name)) ? 'dark' : 'light';
      if (target.dataset.headerTone !== tone) target.dataset.headerTone = tone;
    }
  }
  function scheduleContrast() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateContrast);
  }
  addEventListener('scroll', scheduleContrast, { passive: true });
  addEventListener('resize', scheduleContrast);
  new ResizeObserver(scheduleContrast).observe(document.querySelector('main'));
  updateContrast();

  function setOpen(next, restoreFocus = false) {
    next = next && adaptive.matches;
    if (next === open) return;
    open = next;
    animation?.kill();
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    header.toggleAttribute('data-menu-open', open);
    backdrop.hidden = !open;
    document.documentElement.classList.toggle('menu-open', open);
    for (const content of pageContent) content.inert = open;
    window.dispatchEvent(new CustomEvent('site:menu', { detail: { open } }));
    if (open) {
      if (window.gsap && !motion.matches) {
        animation = gsap.fromTo(nav, { autoAlpha: 0, y: mobile.matches ? 20 : -10 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out', clearProps: 'opacity,visibility,transform' });
      }
      const first = mobile.matches ? nav.querySelector('[data-menu-close]') : nav.querySelector('.header__links a');
      first.focus({ preventScroll: true });
    } else {
      if (window.gsap) gsap.set(nav, { clearProps: 'opacity,visibility,transform' });
      if (restoreFocus) toggle.focus({ preventScroll: true });
    }
    scheduleContrast();
  }
  toggle.addEventListener('click', () => setOpen(!open));
  backdrop.addEventListener('click', () => setOpen(false, true));
  nav.querySelector('[data-menu-close]').addEventListener('click', () => setOpen(false, true));
  nav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !open) return;
    setOpen(false, !link.hash);
    if (link.hash) {
      const target = document.querySelector(link.hash);
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); return; }
    if (event.key !== 'Tab') return;
    const scope = mobile.matches ? nav : header;
    const focusable = [...scope.querySelectorAll('a[href], button:not([hidden])')].filter(element => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  adaptive.addEventListener('change', () => setOpen(false));
  mobile.addEventListener('change', () => setOpen(false));
})();
