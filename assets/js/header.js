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
  const footer = document.querySelector('[data-chips-footer]');
  let lastScroll = scrollY;
  let scrollingDown = true;
  let touchY = null;
  let resizeUntil = 0;
  toggle.hidden = false;

  function updateFooterHeader() {
    // iOS can report positions outside the scroll range during rubber-banding.
    // Returning from that range is not a deliberate reverse scroll.
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const position = Math.max(0, Math.min(maximum, scrollY));
    const delta = position - Math.max(0, Math.min(maximum, lastScroll));
    if (touchY === null && performance.now() >= resizeUntil && Math.abs(delta) > 2) scrollingDown = delta > 0;
    lastScroll = position;
    const inFooter = footer && footer.getBoundingClientRect().top <= header.offsetHeight;
    header.toggleAttribute('data-footer-hidden', mobile.matches && !open && inFooter && scrollingDown);
  }

  // Measure at the header text's actual vertical position, including restored scroll.
  function updateContrast() {
    scheduled = false;
    updateFooterHeader();
    const bounds = sections.map(section => ({ section, rect: section.getBoundingClientRect() }));
    const headerShift = header.getBoundingClientRect().top;
    for (const target of contrastTargets) {
      const rect = target.getBoundingClientRect();
      // Use the resting header position while it slides back into the viewport.
      const y = rect.top - headerShift + rect.height / 2;
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
  function viewportChanged() {
    resizeUntil = performance.now() + 250;
    scheduleContrast();
  }
  addEventListener('resize', viewportChanged);
  window.visualViewport?.addEventListener('resize', viewportChanged);
  window.visualViewport?.addEventListener('scroll', scheduleContrast);
  addEventListener('touchstart', event => { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; }, { passive: true });
  addEventListener('touchmove', event => {
    if (touchY === null || event.touches.length !== 1) return;
    const nextY = event.touches[0].clientY;
    if (Math.abs(nextY - touchY) < 6) return;
    scrollingDown = nextY < touchY;
    touchY = nextY;
    scheduleContrast();
  }, { passive: true });
  function endTouch() { touchY = null; }
  addEventListener('touchend', endTouch, { passive: true });
  addEventListener('touchcancel', endTouch, { passive: true });
  new ResizeObserver(scheduleContrast).observe(document.querySelector('main'));
  updateContrast();

  function setOpen(next, restoreFocus = false) {
    next = next && adaptive.matches;
    if (next === open) return;
    open = next;
    header.removeAttribute('data-footer-hidden');
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
      // The mobile close control is the header toggle, above the panel.
      if (mobile.matches) toggle.focus({ preventScroll: true });
      else requestAnimationFrame(() => nav.querySelector('.header__links a').focus({ preventScroll: true }));
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
    if (event.key === 'Tab') header.removeAttribute('data-footer-hidden');
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false, true); return; }
    if (event.key !== 'Tab') return;
    const scope = header;
    const controls = mobile.matches ? [toggle, ...nav.querySelectorAll('a[href], button:not([hidden])')] : [...scope.querySelectorAll('a[href], button:not([hidden])')];
    const focusable = controls.filter(element => element.getClientRects().length);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
  adaptive.addEventListener('change', () => setOpen(false));
  mobile.addEventListener('change', () => { setOpen(false); scheduleContrast(); });
})();
