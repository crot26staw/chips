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

  const header = document.querySelector(".header");
  const menuButton = header.querySelector(".header__toggle");
  const navigation = header.querySelector("nav");
  const closeMenu = () => menuButton.setAttribute("aria-expanded", "false");
  menuButton.hidden = false;
  menuButton.addEventListener("click", () => {
    const open = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!open));
  });
  navigation.addEventListener("click", closeMenu);
  header.addEventListener("focusout", (event) => {
    if (!header.contains(event.relatedTarget)) closeMenu();
  });
  document.addEventListener("click", (event) => {
    if (!header.contains(event.target)) closeMenu();
  });
  header.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      closeMenu();
      menuButton.focus();
    }
  });
  window.matchMedia("(max-width: 1024px)").addEventListener("change", closeMenu);

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
