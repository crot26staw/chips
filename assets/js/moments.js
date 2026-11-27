(() => {
  const wrapper = document.querySelector('[data-moments-scroll]');
  const { gsap } = window;
  if (!wrapper || !gsap) return;
  const section = wrapper.querySelector('.moments');
  const stack = wrapper.querySelector('[data-moments-stack]');
  const cards = [...wrapper.querySelectorAll('[data-moment-card]')];

  gsap.matchMedia().add({
    motion: '(prefers-reduced-motion: no-preference)',
    roomy: '(min-height: 600px)',
    adaptive: '(max-width: 1024px)',
  }, context => {
    if (!context.conditions.motion || !context.conditions.roomy) return;
    wrapper.setAttribute('data-moments-animated', '');
    let timeline;
    let start = 0;
    let distance = 0;
    let frame;
    let pending = false;

    function update() {
      pending = false;
      timeline.progress(gsap.utils.clamp(0, 1, (scrollY - start) / distance));
    }
    function schedule() {
      if (pending) return;
      pending = true;
      frame = requestAnimationFrame(update);
    }
    function measure() {
      timeline?.kill();
      gsap.set(cards, { clearProps: 'transform,zIndex' });
      start = wrapper.getBoundingClientRect().top + scrollY;
      distance = section.clientHeight * 2.6;
      wrapper.style.setProperty('--moments-scroll-distance', distance + 'px');
      cards.forEach((card, index) => gsap.set(card, {
        zIndex: cards.length - index, y: index * 12, scale: 1 - index * 0.035,
      }));
      timeline = gsap.timeline({ paused: true });
      timeline.to({}, { duration: 0.3 });
      for (let index = 0; index < cards.length - 1; index++) {
        const at = 0.3 + index * 1.15;
        // Like the reference: enlarge and tip the front card as it leaves upward.
        const travel = stack.getBoundingClientRect().top - section.getBoundingClientRect().top + stack.clientHeight * 1.35 + 80;
        timeline.to(cards[index], { y: -travel, rotation: -14, scale: 1.18, duration: 0.95, ease: 'none' }, at);
        for (let next = index + 1; next < cards.length; next++) {
          const depth = next - index - 1;
          timeline.to(cards[next], { y: depth * 12, scale: 1 - depth * 0.035, duration: 0.8, ease: 'power1.inOut' }, at + 0.1);
        }
      }
      // Hold the final scene before the whole section resumes normal scrolling.
      timeline.to({}, { duration: 0.4 });
      update();
    }
    measure();
    addEventListener('scroll', schedule, { passive: true });
    const geometry = new ResizeObserver(measure);
    geometry.observe(section);
    geometry.observe(stack);
    geometry.observe(section.querySelector('.moments__intro'));
    const layout = new ResizeObserver(() => {
      start = wrapper.getBoundingClientRect().top + scrollY;
      schedule();
    });
    layout.observe(document.querySelector('main'));
    return () => {
      removeEventListener('scroll', schedule);
      cancelAnimationFrame(frame);
      geometry.disconnect();
      layout.disconnect();
      timeline.kill();
      gsap.set(cards, { clearProps: 'transform,zIndex' });
      wrapper.removeAttribute('data-moments-animated');
      wrapper.style.removeProperty('--moments-scroll-distance');
    };
  });
})();
