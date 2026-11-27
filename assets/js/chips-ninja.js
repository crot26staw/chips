(async () => {
  'use strict';

  const assetDirectory = new URL('../images/game/', document.currentScript.src);
  async function loadImage(name) {
    const image = new Image();
    image.src = new URL(name, assetDirectory).href;
    await image.decode();
    return image;
  }
  const spriteFiles = [
    ['whole-carrot.webp', 'carrot1.webp'],
    ['whole-beet.webp', 'beet1.webp', 'beet2.webp'],
    ['whole-potato.webp', 'potato1.webp', 'potato2.webp'],
  ];
  let sprites;
  try {
    const groups = await Promise.all(spriteFiles.map(async files => {
      const [vegetable, ...chips] = await Promise.all(files.map(loadImage));
      return chips.map(image => ({ image, vegetable }));
    }));
    sprites = groups.flat();
  } catch {
    // Пока графика недоступна, посетитель видит обычный подвал.
    return;
  }
  const gravity = 650;
  const bladeLife = 170;
  const bladeMaxWidth = 13;
  const bladeGlow = 15;
  const crack = [[-.02, -.5], [.07, -.27], [-.08, -.08], [.06, .12], [-.04, .3], [.02, .5]];
  const halves = [-.5, .5].map(edge => [[edge, -.5], ...crack, [edge, .5]]);
  const crumbShapes = [
    [[-.5, -.4], [.4, -.5], [.5, .3], [-.3, .5]],
    [[-.44, .32], [-.15, -.5], [.5, .16]],
    [[-.5, -.2], [.15, -.46], [.5, .08], [.02, .48]],
  ];
  const nutritionValues = ['Б 1,05 г', 'Ж 3,9 г', 'У 22,8 г', '132 ккал'];
  const random = (min, max) => min + Math.random() * (max - min);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const chipScale = width => Math.min(1.35, width / 650 + .35);
  const chipDepth = phase => .45 + .55 * Math.abs(Math.cos(phase));

  for (const canvas of document.querySelectorAll('[data-chips-footer] [data-game-canvas]')) {
    const context = canvas.getContext('2d');
    if (!context) continue;

    const footer = canvas.closest('[data-chips-footer]');
    const blade = footer.querySelector('[data-game-blade]');
    const bladeContext = blade?.getContext('2d');
    const nutritionLayer = footer.querySelector('[data-game-nutrition]');
    const bladePoints = [];
    let width = 0;
    let height = 0;
    let displayScale = 0;
    let frameId = 0;
    let lastFrame = 0;
    let nextSpawn = 0;
    let launchIndex = 0;
    let previousPointer = null;
    let seeded = false;
    let audio;
    let chips = [];
    let fragments = [];
    let nextNutrition = 0;
    let inView = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function fitCanvas() {
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      if (width === bounds.width && height === bounds.height && displayScale === scale) return;

      if (width > 0 && height > 0 && bounds.width > 0 && bounds.height > 0) {
        const radiusScale = chipScale(bounds.width) / chipScale(width);
        for (const chip of chips) {
          chip.x *= bounds.width / width;
          chip.y *= bounds.height / height;
          chip.radius *= radiusScale;
        }
      }
      width = bounds.width;
      height = bounds.height;
      displayScale = scale;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (bladeContext) {
        blade.width = canvas.width;
        blade.height = canvas.height;
        bladeContext.setTransform(scale, 0, 0, scale, 0, 0);
      }
      previousPointer = null;
      fragments = [];
      bladePoints.length = 0;
      nutritionLayer?.replaceChildren();
    }

    function seedScene() {
      const mobile = width <= 580;
      const size = mobile ? .64 : 1;
      const scene = [
        { sprite: 0, x: .515, y: .16, radius: 83, rotation: .24, phase: 0, vx: 26, vy: -80 },
        { sprite: 2, x: mobile ? .16 : .10, y: .41, radius: 80, rotation: .08, phase: 0, vx: 25, vy: -120 },
        { sprite: 1, x: mobile ? .84 : .90, y: .46, radius: 82, rotation: -.21, phase: .25, vx: -34, vy: -104 },
        { sprite: 4, x: mobile ? .23 : .423, y: .79, radius: 59, rotation: .28, phase: .25, vx: -22, vy: -155 },
        { sprite: 0, x: .56, y: 1.05, radius: 84, rotation: -.43, phase: .2, vx: 26, vy: -300 },
        { sprite: 3, x: mobile ? .79 : .68, y: 1.02, radius: 54, rotation: .61, phase: .3, vx: -29, vy: -265 },
      ];
      chips = scene.map(({ sprite, x, y, radius, ...motion }) => ({
        ...motion,
        ...sprites[sprite],
        x: x * width,
        y: y * height,
        radius: radius * size,
        spin: random(-.7, .7),
      }));
    }

    function spawn() {
      const radius = random(38, 72) * chipScale(width);
      const lane = launchIndex++ % 4;
      let x;
      let vx;
      if (lane === 0 || lane === 2) {
        const inset = Math.max(radius * .8, width * random(.035, .10));
        x = lane === 0 ? inset : width - inset;
        vx = (lane === 0 ? 1 : -1) * Math.min(65, width * random(.035, .065));
      } else {
        x = random(width * .20, width * .80);
        vx = (width / 2 - x) * .45 + random(-60, 60);
      }
      chips.push({
        ...sprites[Math.floor(random(0, sprites.length))],
        x,
        y: height + radius,
        vx,
        vy: -Math.sqrt(2 * gravity * (height * random(.48, .9) + radius)),
        radius,
        rotation: random(-3, 3),
        spin: random(-1.6, 1.6),
        phase: random(0, 6),
      });
    }

    function drawChip(chip) {
      const { image, radius, polygon, cutAngle } = chip;
      const spriteWidth = radius * 2;
      const spriteHeight = spriteWidth * image.naturalHeight / image.naturalWidth;

      context.save();
      context.translate(chip.x, chip.y);
      context.rotate(chip.rotation);
      context.scale(1, chipDepth(chip.phase));
      if (polygon) {
        const cuttingHalf = cutAngle !== undefined;
        const cutSpan = cuttingHalf ? Math.hypot(spriteWidth, spriteHeight) : 0;
        const pathWidth = cuttingHalf ? cutSpan : spriteWidth;
        const pathHeight = cuttingHalf ? cutSpan : spriteHeight;
        if (cuttingHalf) context.rotate(cutAngle);
        context.beginPath();
        polygon.forEach(([x, y], index) => {
          if (index === 0) context.moveTo(x * pathWidth, y * pathHeight);
          else context.lineTo(x * pathWidth, y * pathHeight);
        });
        context.closePath();
        context.clip();
        if (cuttingHalf) context.rotate(-cutAngle);
      }
      context.drawImage(image, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
      context.restore();
    }

    function unlockAudio() {
      if (!window.AudioContext || audio?.state === 'running') return;
      try {
        audio ??= new AudioContext();
        audio.resume().catch(() => {});
      } catch {
        // Slicing remains available when audio is unavailable.
      }
    }

    function crunch() {
      if (audio?.state !== 'running') return;
      const sampleCount = Math.floor(audio.sampleRate * .11);
      const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < sampleCount; index++) {
        samples[index] = random(-1, 1) * (1 - index / sampleCount) ** 4 * .075;
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.start();
    }

    function showNutrition(x, y) {
      if (!nutritionLayer) return;
      const label = document.createElement('span');
      label.className = 'footer__nutrition-label';
      label.textContent = nutritionValues[nextNutrition];
      nextNutrition = (nextNutrition + 1) % nutritionValues.length;

      label.addEventListener('animationend', () => label.remove(), { once: true });
      nutritionLayer.append(label);
      const inset = Math.min(width / 2, label.offsetWidth / 2 + 12);
      label.style.left = `${clamp(x, inset, width - inset)}px`;
      label.style.top = `${clamp(y - 12, 72, height - 20)}px`;
    }

    function hit(chip, angle) {
      const localAngle = angle - chip.rotation;
      const cutAngle = Math.atan2(Math.sin(localAngle) / chipDepth(chip.phase), Math.cos(localAngle)) - Math.PI / 2;
      const normalX = Math.sin(angle);
      const normalY = -Math.cos(angle);
      halves.forEach((polygon, index) => {
        const speed = (index === 0 ? -1 : 1) * random(110, 175);
        fragments.push({
          ...chip,
          polygon,
          cutAngle,
          vx: chip.vx * .2 + normalX * speed,
          vy: chip.vy * .25 - 40 + normalY * speed,
          spin: index === 0 ? -4 : 4,
          life: .85,
        });
      });
      for (let index = 0; index < 44; index++) {
        const shard = index < 12;
        const scatter = random(0, Math.PI * 2);
        const speed = shard ? random(100, 275) : random(150, 375);
        fragments.push({
          ...chip,
          polygon: crumbShapes[index % crumbShapes.length],
          radius: shard ? random(5, 11) : random(2, 5),
          x: chip.x + Math.cos(scatter) * random(2, chip.radius * .28),
          y: chip.y + Math.sin(scatter) * random(2, chip.radius * .28),
          vx: chip.vx * .2 + Math.cos(scatter) * speed,
          vy: chip.vy * .18 + Math.sin(scatter) * speed - 70,
          rotation: random(-Math.PI, Math.PI),
          phase: 0,
          spin: random(-13, 13),
          life: shard ? random(.55, .95) : random(.35, .8),
        });
      }
      const burstAngle = random(-Math.PI, Math.PI);
      for (let index = 0; index < 3; index++) {
        const direction = burstAngle + index * (2 * Math.PI / 3) + random(-.18, .18);
        const speed = random(105, 145);
        fragments.push({
          image: chip.vegetable,
          x: chip.x,
          y: chip.y,
          radius: clamp(chip.radius * random(.14, .18), 5, 12),
          vx: chip.vx * .2 + Math.cos(direction) * speed,
          vy: Math.sin(direction) * speed - 110,
          rotation: random(-.6, .6),
          spin: random(-2.5, 2.5),
          phase: 0,
          life: .7,
        });
      }
      showNutrition(chip.x, chip.y);
      crunch();
    }

    function move(event) {
      if (!frameId || !event.isPrimary) return;
      if (event.pointerType !== 'mouse' && !canvas.hasPointerCapture(event.pointerId)) return;

      const bounds = canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const time = performance.now();
      const from = previousPointer;
      const elapsed = from ? time - from.time : Infinity;
      const continuesTrail = elapsed <= bladeLife;
      const dx = continuesTrail ? x - from.x : 0;
      const dy = continuesTrail ? y - from.y : 0;
      const distanceSquared = dx * dx + dy * dy;
      if (continuesTrail && distanceSquared < 1) return;

      const speed = Math.sqrt(distanceSquared) / Math.max(1, elapsed);
      const to = { x, y, time, width: Math.min(bladeMaxWidth, 2 + speed * 3) };
      if (!continuesTrail) bladePoints.length = 0;
      bladePoints.push(to);
      previousPointer = to;
      if (elapsed >= 150) return;

      const angle = Math.atan2(dy, dx);
      chips = chips.filter(chip => {
        const offsetX = chip.x - from.x;
        const offsetY = chip.y - from.y;
        const projection = clamp((offsetX * dx + offsetY * dy) / distanceSquared, 0, 1);
        if (Math.hypot(offsetX - projection * dx, offsetY - projection * dy) >= chip.radius * .62) return true;
        hit(chip, angle);
        return false;
      });
    }

    function drawEffects(delta) {
      for (const fragment of fragments) {
        fragment.life -= delta;
        fragment.x += fragment.vx * delta;
        fragment.y += fragment.vy * delta;
        fragment.vy += 550 * delta;
        fragment.rotation += fragment.spin * delta;
        context.globalAlpha = clamp(fragment.life * 4, 0, 1);
        drawChip(fragment);
      }
      context.globalAlpha = 1;
      fragments = fragments.filter(fragment => fragment.life > 0);
    }

    function drawBlade(now) {
      if (!bladeContext) return;
      bladeContext.clearRect(0, 0, width, height);
      while (bladePoints.length && now - bladePoints[0].time > bladeLife) {
        bladePoints.shift();
      }
      if (bladePoints.length < 2) return;

      let points = bladePoints;
      // With only two samples, add a midpoint so the tapered blade has a body.
      if (bladePoints.length === 2) {
        const [start, end] = bladePoints;
        points = [start, {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2,
          time: (start.time + end.time) / 2,
          width: (start.width + end.width) / 2,
        }, end];
      }

      const left = [];
      const right = [];
      const lastIndex = points.length - 1;
      for (let index = 0; index <= lastIndex; index++) {
        const point = points[index];
        const previous = points[Math.max(0, index - 1)];
        const next = points[Math.min(lastIndex, index + 1)];
        const dx = next.x - previous.x;
        const dy = next.y - previous.y;
        const length = Math.hypot(dx, dy) || 1;
        const progress = index / lastIndex;
        const taper = Math.sin(Math.PI * progress) ** .8 * progress ** .7;
        const freshness = clamp(1 - (now - point.time) / bladeLife, 0, 1);
        const halfWidth = point.width * taper * freshness;
        const offsetX = -dy / length * halfWidth;
        const offsetY = dx / length * halfWidth;

        left.push([point.x + offsetX, point.y + offsetY]);
        right.push([point.x - offsetX, point.y - offsetY]);
      }

      const outline = left.concat(right.reverse());
      bladeContext.beginPath();
      bladeContext.moveTo(...outline[0]);
      for (let index = 1; index < outline.length - 1; index++) {
        const [x, y] = outline[index];
        const [nextX, nextY] = outline[index + 1];
        bladeContext.quadraticCurveTo(x, y, (x + nextX) / 2, (y + nextY) / 2);
      }
      bladeContext.lineTo(...outline.at(-1));
      bladeContext.closePath();

      bladeContext.save();
      bladeContext.fillStyle = '#fff';
      bladeContext.shadowColor = '#fff';
      bladeContext.globalAlpha = clamp(1 - (now - points[lastIndex].time) / bladeLife, 0, 1);
      bladeContext.shadowBlur = bladeGlow;
      bladeContext.fill();
      bladeContext.shadowBlur = 3;
      bladeContext.fill();
      bladeContext.restore();
    }

    function frame(now) {
      const delta = clamp((now - lastFrame) / 1000, 0, .035);
      lastFrame = now;
      if (now >= nextSpawn) {
        spawn();
        if (Math.random() < .45) spawn();
        nextSpawn = now + random(370, 720);
      }

      context.clearRect(0, 0, width, height);
      for (const chip of chips) {
        chip.vy += gravity * delta;
        chip.x += chip.vx * delta;
        chip.y += chip.vy * delta;
        chip.phase += delta * 1.5;
        chip.rotation += chip.spin * delta;
        drawChip(chip);
      }
      chips = chips.filter(chip => chip.y < height + chip.radius * 2 || chip.vy < 0);
      drawEffects(delta);
      drawBlade(now);
      frameId = requestAnimationFrame(frame);
    }

    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary) return;
      unlockAudio();
      if (event.pointerType !== 'mouse') canvas.setPointerCapture(event.pointerId);
      previousPointer = null;
      move(event);
    });
    canvas.addEventListener('pointerup', unlockAudio);
    for (const event of ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(event, () => { previousPointer = null; });
    }

    new ResizeObserver(() => {
      if (frameId) fitCanvas();
    }).observe(footer);

    function syncPlayback() {
      const active = inView && !document.hidden && !reducedMotion.matches;
      footer.toggleAttribute('data-game-active', active);
      if (active && !frameId) {
        fitCanvas();
        if (!seeded) {
          seedScene();
          seeded = true;
        }
        lastFrame = nextSpawn = performance.now();
        frameId = requestAnimationFrame(frame);
      } else if (!active && frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
        previousPointer = null;
        bladePoints.length = 0;
        nutritionLayer?.replaceChildren();
      }
    }

    reducedMotion.addEventListener('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    }).observe(footer);
  }
})();
