(() => {
  const wrapper = document.querySelector('[data-balance-scroll]');
  const { gsap } = window;
  if (!wrapper || !gsap) return;
  const section = wrapper.querySelector('.balance');
  const video = section.querySelector('[data-balance-video]');
  const cards = [...wrapper.querySelectorAll('[data-balance-card]')];
  const match = gsap.matchMedia();

  match.add({ motion: '(prefers-reduced-motion: no-preference)', stacked: '(max-width: 1024px)', mobile: '(width < 768px)' }, context => {
    if (!context.conditions.motion) return;
    const stacked = context.conditions.stacked;
    wrapper.setAttribute('data-balance-animated', '');
    let timeline;
    let start = 0;
    let distance = 0;
    let exitDistance = 0;
    const exitEase = gsap.parseEase('power1.inOut');
    let pending = false;
    let frame;
    let targetVideoTime = 0;
    let lastProgress = -1;
    let lastExitProgress = -1;
    let disposed = false;

    // Coalesce fast scroll updates while the browser decodes the current seek.
    // currentTime preserves the original encoded frames (no canvas or re-encode).
    function seekVideo() {
      if (disposed || !video || video.readyState < 1 || video.seeking || !Number.isFinite(video.duration)) return;
      if (Math.abs(video.currentTime - targetVideoTime) > 1 / 60) video.currentTime = targetVideoTime;
    }
    function revealVideo() {
      if (!disposed && video.readyState >= 2) section.setAttribute('data-video-ready', '');
    }
    function onSeeked() { revealVideo(); seekVideo(); }
    function onMetadata() { lastProgress = -1; schedule(); }
    function videoError() { section.removeAttribute('data-video-ready'); }
    let videoObserver;
    if (video) {
      section.removeAttribute('data-video-ready');
      video.muted = true;
      video.addEventListener('loadedmetadata', onMetadata);
      video.addEventListener('loadeddata', revealVideo);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', videoError);
      videoObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        video.src = context.conditions.mobile ? video.dataset.srcMobile : video.dataset.srcDesktop;
        video.load();
        videoObserver.disconnect();
      }, { rootMargin: '50% 0px' });
      videoObserver.observe(wrapper);
    }

    function update() {
      pending = false;
      const progress = gsap.utils.clamp(0, 1, (window.scrollY - start) / distance);
      const exitProgress = gsap.utils.clamp(0, 1, (window.scrollY - start - distance) / exitDistance);
      if (progress === lastProgress && exitProgress === lastExitProgress) return;
      lastProgress = progress;
      lastExitProgress = exitProgress;
      timeline.progress(progress);
      // The video reaches its final frame before flavours starts overlapping.
      section.style.setProperty('--balance-progress', progress);
      if (video && Number.isFinite(video.duration)) {
        targetVideoTime = progress * Math.max(0, video.duration - 0.001);
        seekVideo();
      }
      section.style.setProperty('--balance-shade', exitEase(exitProgress) * 0.65);
    }
    function schedule() {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(update);
    }
    function measure() {
      lastProgress = lastExitProgress = -1;
      timeline?.kill();
      gsap.set(cards, { clearProps: 'transform,opacity,visibility,zIndex' });
      distance = section.clientHeight * (stacked ? 2.4 : 1.8);
      exitDistance = section.clientHeight;
      wrapper.style.setProperty('--balance-scroll-distance', distance + 'px');
      // Also inherited by flavours, which overlaps the last viewport of the pin.
      wrapper.parentElement.style.setProperty('--balance-exit-distance', exitDistance + 'px');
      start = wrapper.getBoundingClientRect().top + window.scrollY;
      timeline = gsap.timeline({ paused: true });
      if (stacked) {
        const cardHeight = cards[0].getBoundingClientRect().height;
        cards.forEach((card, index) => gsap.set(card, { y: -index * 12, scale: 1 - index * 0.035, zIndex: 3 - index }));
        timeline.to({}, { duration: 0.3 });
        for (let index = 0; index < 2; index++) {
          const front = cards[index];
          const next = cards[index + 1];
          const at = 0.3 + index * 1.2;
          timeline.to(front, { y: -cardHeight * 0.6 - 24, duration: 0.45, ease: 'power2.inOut' }, at)
            .set(front, { zIndex: index === 0 ? 0 : 1 }, at + 0.45)
            .to(front, { y: -24 + index * 12, scale: 0.93 + index * 0.035, duration: 0.45, ease: 'power2.inOut' }, at + 0.45)
            .to(next, { y: 0, scale: 1, duration: 0.6, ease: 'power2.inOut' }, at + 0.3);
          if (index === 0) timeline.to(cards[2], { y: -12, scale: 0.965, duration: 0.6 }, at + 0.3);
        }
        timeline.to({}, { duration: 0.4 });
      } else {
        gsap.set(cards, { y: section.clientHeight });
        timeline.to({}, { duration: 0.15 })
          .to(cards, { y: 0, duration: 0.7, stagger: 0.35, ease: 'power2.out' })
          .to({}, { duration: 0.4 });
      }
      update();
    }
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    const geometry = new ResizeObserver(measure);
    geometry.observe(section);
    // Earlier images/fonts can move the start without changing this viewport.
    const layout = new ResizeObserver(() => {
      start = wrapper.getBoundingClientRect().top + window.scrollY;
      schedule();
    });
    layout.observe(document.querySelector('main'));
    return () => {
      disposed = true;
      videoObserver?.disconnect();
      window.removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      geometry.disconnect();
      layout.disconnect();
      timeline.kill();
      gsap.set(cards, { clearProps: 'transform,opacity,visibility,zIndex' });
      wrapper.removeAttribute('data-balance-animated');
      wrapper.style.removeProperty('--balance-scroll-distance');
      wrapper.parentElement.style.removeProperty('--balance-exit-distance');
      section.style.removeProperty('--balance-progress');
      section.style.removeProperty('--balance-shade');
      if (video) {
        video.removeEventListener('loadedmetadata', onMetadata);
        video.removeEventListener('loadeddata', revealVideo);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', videoError);
        video.pause();
        video.removeAttribute('src');
        video.load();
        section.removeAttribute('data-video-ready');
      }
    };
  });
})();
