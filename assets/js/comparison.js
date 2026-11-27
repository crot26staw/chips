(() => {
  const wrapper = document.querySelector('[data-comparison-scroll]');
  const { gsap } = window;
  if (!wrapper || !gsap) return;
  const section = wrapper.querySelector('.comparison');
  const visuals = [...wrapper.querySelectorAll('[data-comparison-visual]')];
  const copies = [...wrapper.querySelectorAll('[data-comparison-copy]')];
  gsap.matchMedia().add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
    if (!context.conditions.motion) return;
    wrapper.setAttribute('data-comparison-animated', '');
    section.setAttribute('data-comparison-playing', '');
    let timeline;
    let start = 0;
    let distance = 0;
    let frame;
    let pending = false;
    let lastProgress = -1;
    function update() {
      pending = false;
      const progress = gsap.utils.clamp(0, 1, (scrollY - start) / distance);
      if (progress === lastProgress) return;
      lastProgress = progress;
      timeline.progress(progress);
    }
    function schedule() {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(update);
    }
    function measure() {
      lastProgress = -1;
      timeline?.kill();
      start = wrapper.getBoundingClientRect().top + scrollY;
      distance = section.clientHeight * 2.6;
      wrapper.style.setProperty('--comparison-scroll-distance', distance + 'px');
      visuals.forEach((visual, index) => gsap.set(visual, {
        clipPath: index === 0 ? 'inset(0% 0% 0% 0%)' : 'inset(100% 0% 0% 0%)',
        autoAlpha: index === 0 ? 1 : 0,
        y: index === 0 ? 0 : 48,
      }));
      copies.forEach((copy, index) => gsap.set(copy, { autoAlpha: index === 0 ? 1 : 0, y: index === 0 ? 0 : 24 }));
      timeline = gsap.timeline({ paused: true });
      timeline.to({}, { duration: 0.35 });
      for (let index = 1; index < visuals.length; index++) {
        const at = 0.35 + (index - 1) * 1.25;
        timeline.to(visuals[index - 1], { clipPath: 'inset(0% 0% 100% 0%)', autoAlpha: 0, y: -16, duration: 0.8, ease: 'power1.inOut' }, at)
          .to(visuals[index], { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1, y: 0, duration: 0.8, ease: 'power1.inOut' }, at)
          .to(copies[index - 1], { autoAlpha: 0, duration: 0.25 }, at)
          .to(copies[index], { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power1.out' }, at + 0.25);
      }
      timeline.to({}, { duration: 0.5 });
      update();
    }
    measure();
    addEventListener('scroll', schedule, { passive: true });
    const geometry = new ResizeObserver(measure);
    geometry.observe(section);
    const layout = new ResizeObserver(() => { start = wrapper.getBoundingClientRect().top + scrollY; schedule(); });
    layout.observe(document.querySelector('main'));
    return () => {
      removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      geometry.disconnect();
      layout.disconnect();
      timeline.kill();
      gsap.set(visuals, { clearProps: 'clipPath,opacity,visibility,transform' });
      gsap.set(copies, { clearProps: 'opacity,visibility,transform' });
      wrapper.removeAttribute('data-comparison-animated');
      section.removeAttribute('data-comparison-playing');
      wrapper.style.removeProperty('--comparison-scroll-distance');
    };
  });
})();
