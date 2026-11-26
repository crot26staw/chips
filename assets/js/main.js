(() => {
  const root = document.documentElement;
  // clientWidth учитывает место, которое занимает системная полоса прокрутки.
  const syncLayoutWidth = () => {
    const width = root.clientWidth + "px";
    if (root.style.getPropertyValue("--layout-width") !== width) {
      root.style.setProperty("--layout-width", width);
    }
  };
  syncLayoutWidth();
  new ResizeObserver(syncLayoutWidth).observe(root);

  const { gsap, Lenis } = window;
  if (!gsap || !Lenis) return;

  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const lenis = new Lenis({ autoRaf: false, anchors: true });
    // GSAP передаёт секунды, а Lenis принимает миллисекунды.
    const updateScroll = (seconds) => lenis.raf(seconds * 1000);
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(updateScroll);

    const intro = document.querySelector("[data-intro]");
    if (intro) {
      gsap.from(intro, { y: "0.75rem", duration: 0.5, ease: "power2.out", clearProps: "transform" });
    }

    return () => {
      gsap.ticker.remove(updateScroll);
      lenis.destroy();
    };
  });
})();
