(() => {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;
  const hero = video.closest('.hero');
  const mobile = matchMedia('(width < 768px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = hero.getBoundingClientRect().bottom > 0;
  let menuOpen = document.documentElement.classList.contains('menu-open');

  // Muted inline playback over the section's solid background.
  video.muted = true;
  function shouldPlay() { return visible && !document.hidden && !menuOpen && !reduced.matches; }
  function syncPlayback() {
    if (!video.hasAttribute('src')) return;
    if (!shouldPlay()) { video.pause(); return; }
    video.play()?.catch(() => {
      // Autoplay may be denied (for example in a power-saving mode).
      // Keep the solid background until playback succeeds after a user gesture.
      if (video.paused) hero.removeAttribute('data-hero-video-ready');
    });
  }
  function syncSource() {
    if (reduced.matches) {
      video.pause();
      hero.removeAttribute('data-hero-video-ready');
      video.removeAttribute('src');
      video.load();
      return;
    }
    const source = mobile.matches ? video.dataset.srcMobile : video.dataset.srcDesktop;
    if (video.getAttribute('src') !== source) {
      hero.removeAttribute('data-hero-video-ready');
      video.src = source;
      video.load();
    }
    syncPlayback();
  }
  video.addEventListener('playing', () => {
    if (shouldPlay()) hero.setAttribute('data-hero-video-ready', '');
    else video.pause();
  });
  video.addEventListener('error', () => hero.removeAttribute('data-hero-video-ready'));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      syncPlayback();
    }).observe(hero);
  }
  document.addEventListener('visibilitychange', syncPlayback);
  addEventListener('site:menu', event => { menuOpen = event.detail.open; syncPlayback(); });
  addEventListener('pointerdown', () => { if (video.paused && shouldPlay()) syncPlayback(); }, { passive: true });
  mobile.addEventListener('change', syncSource);
  reduced.addEventListener('change', syncSource);
  syncSource();
})();
