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

  const gameFooter = document.querySelector("[data-chips-footer]");
  if (gameFooter && "IntersectionObserver" in window) {
    const gameUrl = new URL("chips-ninja.js", document.currentScript.src);
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const preload = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !motion.matches) return;
      preload.disconnect();
      motion.removeEventListener("change", observeFooter);
      const script = document.createElement("script");
      script.src = gameUrl.href;
      document.head.append(script);
    }, { rootMargin: "480px 0px" });

    function observeFooter() {
      if (motion.matches) preload.observe(gameFooter);
      else preload.disconnect();
    }
    observeFooter();
    motion.addEventListener("change", observeFooter);
  }

  const { gsap, Lenis } = window;
  if (!gsap || !Lenis) return;

  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    const lenis = new Lenis({ autoRaf: false, anchors: true });
    const syncMenuScroll = event => event.detail.open ? lenis.stop() : lenis.start();
    window.addEventListener('site:menu', syncMenuScroll);
    if (root.classList.contains('menu-open')) lenis.stop();
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
      window.removeEventListener('site:menu', syncMenuScroll);
      lenis.destroy();
    };
  });
})();
