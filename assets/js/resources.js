// Warm whole scenes ahead of scrolling, including images hidden in a stack.
(() => {
  const targets = document.querySelectorAll('[data-lazy-background], [data-warm-images]');
  function load(target) {
    target.removeAttribute('data-lazy-background');
    target.querySelectorAll('img[loading="lazy"]').forEach(image => { image.loading = 'eager'; });
  }
  if (!('IntersectionObserver' in window)) {
    targets.forEach(load);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      load(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '100% 0px' });
  targets.forEach(target => observer.observe(target));
})();
