(() => {
  const section = document.querySelector('#production');
  const { gsap } = window;
  if (!section || !gsap) return;
  const wrapper = section.closest('[data-production-scroll]');
  const slides = [...section.querySelectorAll('[data-production-slide]')];
  const buttons = [...section.querySelectorAll('[data-production-target]')];
  const deck = section.querySelector('[data-production-deck]');
  const navigation = section.querySelector('[data-production-navigation]');
  const progress = section.querySelector('[data-production-progress]');
  const status = section.querySelector('[data-production-status]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(width < 768px)');
  let active = 0;
  let elapsed = 0;
  let previousTime;
  let visible = false;
  let menuOpen = false;
  let hovering = false;
  let focused = false;
  let transitioning = false;
  let animation;
  let queued = null;
  let videoPlaying = false;
  let videoAttempt = 0;
  let openingTouch = false;

  // Each stage can receive its own sources later; currently all share a placeholder.
  slides.forEach((slide, index) => {
    if (!slide.dataset.videoSrc) return;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.tabIndex = -1;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('aria-hidden', 'true');
    const media = document.createElement('div');
    media.className = 'production__media';
    slide.prepend(media);
    media.append(video);
    video.addEventListener('loadeddata', () => {
      if (!reduced.matches && !video.error) slide.setAttribute('data-video-ready', '');
    });
    video.addEventListener('ended', () => { if (index === active && running()) go((active + 1) % slides.length); });
    video.addEventListener('error', () => {
      video.pause();
      if (index === active) videoPlaying = false;
      video.dataset.failed = '';
      slide.removeAttribute('data-video-ready');
    });
  });

  function prepareVideo(slide) {
    const video = slide.querySelector('video');
    if (!video || reduced.matches) return video;
    const source = mobile.matches && slide.dataset.videoSrcMobile ? slide.dataset.videoSrcMobile : slide.dataset.videoSrc;
    if (video.getAttribute('src') !== source) {
      slide.removeAttribute('data-video-ready');
      delete video.dataset.failed;
      video.src = source;
      video.load();
    }
    return video;
  }
  function running() { return visible && !document.hidden && !reduced.matches && !menuOpen && !hovering && !focused && !transitioning && !deck.classList.contains('is-expanded'); }
  function syncVideo() {
    const attempt = ++videoAttempt;
    slides.forEach((slide, index) => { if (index !== active) slide.querySelector('video')?.pause(); });
    const video = slides[active].querySelector('video');
    if (!video) { videoPlaying = false; return; }
    if (!running()) { video.pause(); return; }
    prepareVideo(slides[active]);
    prepareVideo(slides[(active + 1) % slides.length]);
    if ('failed' in video.dataset) { videoPlaying = false; return; }
    if (video.ended) { go((active + 1) % slides.length); return; }
    video.play().then(() => {
      if (attempt === videoAttempt) {
        videoPlaying = true;
        slides[active].setAttribute('data-video-ready', '');
      }
    }).catch(error => {
      if (attempt !== videoAttempt || error.name === 'AbortError') return;
      videoPlaying = false;
      slides[active].removeAttribute('data-video-ready');
    });
  }
  function positionCards(animate = true) {
    const expanded = deck.classList.contains('is-expanded');
    const height = buttons[0].offsetHeight;
    const gap = parseFloat(getComputedStyle(deck).fontSize) * 0.75;
    buttons.forEach((button, index) => {
      const order = (index - active + slides.length) % slides.length;
      button.setAttribute('aria-current', String(index === active));
      const target = { y: expanded ? -order * (height + gap) : order * 7, scale: expanded ? 1 : 1 - order * 0.045, zIndex: slides.length - order };
      button.style.pointerEvents = expanded || index === active ? 'auto' : 'none';
      button.tabIndex = 0;
      if (animate && !reduced.matches) gsap.to(button, { ...target, duration: 0.4, ease: 'power3.out', overwrite: true });
      else gsap.set(button, target);
    });
  }
  function expand(value) {
    deck.classList.toggle('is-expanded', value);
    positionCards();
  }
  function go(index, manual = false) {
    if (transitioning) { queued = { index, manual }; return; }
    if (index === active) { elapsed = 0; expand(false); syncVideo(); return; }
    const outgoing = slides[active];
    const incoming = slides[index];
    const incomingMedia = incoming.querySelector('.production__media');
    const outgoingHeading = outgoing.querySelector('.production__heading');
    const incomingHeading = incoming.querySelector('.production__heading');
    const oldButton = buttons[active];
    transitioning = true;
    ++videoAttempt;
    slides.forEach(slide => slide.querySelector('video')?.pause());
    incoming.hidden = false;
    incoming.inert = false;
    incoming.setAttribute('aria-hidden', 'false');
    outgoing.inert = true;
    outgoing.setAttribute('aria-hidden', 'true');
    active = index;
    elapsed = 0;
    gsap.set(progress, { scaleX: 0 });
    videoPlaying = false;
    const video = incoming.querySelector('video');
    if (video) {
      prepareVideo(incoming);
      if (video.readyState >= 1) video.currentTime = 0;
    }
    expand(false);
    const finish = () => {
      outgoing.hidden = true;
      gsap.set([outgoing, incoming], { clearProps: 'transform,clipPath,zIndex,willChange' });
      gsap.set(incomingMedia, { clearProps: 'transform' });
      gsap.set([outgoingHeading, incomingHeading], { clearProps: 'transform,opacity,visibility' });
      transitioning = false;
      positionCards(false);
      if (manual) status.textContent = buttons[active].textContent.trim();
      syncVideo();
      if (queued) { const next = queued; queued = null; go(next.index, next.manual); }
    };
    if (reduced.matches) { finish(); return; }
    // Keep both frames stationary. Wipe the upper frame away, revealing the
    // next image beneath it, as in the Featured section of the reference.
    gsap.set(outgoing, { zIndex: 2, clipPath: 'inset(0% 0% 0% 0%)', willChange: 'clip-path' });
    gsap.set(incoming, { zIndex: 1, clipPath: 'inset(0% 0% 0% 0%)' });
    animation = gsap.timeline({ onComplete: finish });
    animation.to(outgoing, { clipPath: 'inset(0% 100% 0% 0%)', duration: 1.05, ease: 'power3.inOut' }, 0)
      .fromTo(incomingMedia, { scale: 1.2 }, { scale: 1, duration: 1.05, ease: 'power3.out' }, 0)
      .to(outgoingHeading, { autoAlpha: 0, duration: 0.2 }, 0)
      .fromTo(incomingHeading, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.35);
    // The outgoing navigation card lifts, then settles behind the new front card.
    gsap.to(oldButton, { y: -buttons[0].offsetHeight * 0.65, duration: 0.25, overwrite: true, onComplete: () => positionCards() });
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    if (openingTouch) { openingTouch = false; return; }
    go(index, true);
  }));
  deck.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hovering = true; expand(true); syncVideo(); } });
  deck.addEventListener('pointerleave', event => { if (event.pointerType !== 'mouse') return; hovering = false; if (!focused) expand(false); syncVideo(); });
  deck.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); expand(true); syncVideo(); });
  deck.addEventListener('focusout', event => { if (!deck.contains(event.relatedTarget)) { focused = false; expand(false); syncVideo(); } });
  deck.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
  });
  // First touch opens the deck; a second tap can select any stage.
  deck.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || deck.classList.contains('is-expanded')) return;
    event.preventDefault(); openingTouch = true; expand(true); syncVideo();
  });
  deck.addEventListener('pointercancel', () => { openingTouch = false; });
  document.addEventListener('pointerdown', event => { if (!navigation.contains(event.target)) expand(false); });
  function syncMotion() {
    wrapper.toggleAttribute('data-production-pinned', !reduced.matches);
    if (reduced.matches && transitioning) animation?.progress(1);
    if (reduced.matches) slides.forEach(slide => {
      const video = slide.querySelector('video');
      if (!video?.hasAttribute('src')) return;
      video.pause();
      video.removeAttribute('src');
      video.load();
      slide.removeAttribute('data-video-ready');
    });
    positionCards(false);
    syncVideo();
  }
  reduced.addEventListener('change', syncMotion);
  mobile.addEventListener('change', () => {
    ++videoAttempt;
    videoPlaying = false;
    elapsed = 0;
    slides.forEach(slide => {
      slide.querySelector('video')?.pause();
      slide.removeAttribute('data-video-ready');
    });
    syncVideo();
  });
  window.addEventListener('site:menu', event => { menuOpen = event.detail.open; syncVideo(); });
  document.addEventListener('visibilitychange', syncVideo);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.5; syncVideo(); }, { threshold: [0, 0.5, 1] }).observe(section);
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting || reduced.matches) return;
    prepareVideo(slides[active]);
    prepareVideo(slides[(active + 1) % slides.length]);
  }, { rootMargin: '100% 0px' }).observe(wrapper);
  new ResizeObserver(() => positionCards(false)).observe(section);
  gsap.ticker.add(time => {
    const delta = previousTime === undefined ? 0 : Math.min(time - previousTime, 0.1);
    previousTime = time;
    if (!running()) return;
    const video = slides[active].querySelector('video');
    let value;
    if (videoPlaying && video && Number.isFinite(video.duration) && video.duration > 0) value = video.currentTime / video.duration;
    else { elapsed += delta; value = elapsed / (Number(slides[active].dataset.duration) || 5); }
    gsap.set(progress, { scaleX: Math.min(value, 1) });
    if (value >= 1 && !videoPlaying) go((active + 1) % slides.length);
  });
  slides.forEach((slide, index) => { slide.inert = index !== 0; slide.setAttribute('aria-hidden', String(index !== 0)); });
  navigation.hidden = false;
  syncMotion();
})();
