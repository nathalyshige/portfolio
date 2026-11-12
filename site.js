(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* Videos: play only while on screen; under reduced motion, give controls instead */
  const films = $$('video[data-autoplay]');
  if (reduceMotion) {
    films.forEach(v => { v.controls = true; });
  } else {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    }, { threshold: 0.25 });
    films.forEach(v => vio.observe(v));
  }

  if (reduceMotion) {
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }

  /* Headlines: split plain-text headings into words that rise in sequence */
  $$('.hero h1, .case-hero h1, .section-title, .contact-title, .next-title, .lead-name').forEach(el => {
    if (Array.from(el.childNodes).some(n => n.nodeType !== Node.TEXT_NODE)) return;
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'wi';
      span.textContent = word;
      span.style.setProperty('--d', i);
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    el.classList.add('words');
  });

  /* Groups whose children arrive one after another */
  const staggers = $$('.figures, .cards, .skills, .media-grid, .case-meta, .diagram, .hero-actions, .points');
  staggers.forEach(el => {
    el.classList.add('stagger');
    Array.from(el.children).forEach((child, i) => child.style.setProperty('--i', i));
  });

  /* Media: images and films open from a narrower window as they enter */
  const clips = [];
  $$('.work-media, .case-cover, .panel-shot').forEach(box => {
    const target = box.querySelector('.browser') || box.querySelector('img, video');
    if (target) { target.classList.add('clip'); clips.push(target); }
  });

  /* Section dividers draw across the page */
  const sections = $$('.section');
  sections.forEach(s => s.classList.add('draw'));

  /* Reveal observer: whatever enters together is staggered by arrival order */
  const settle = (el, delay) => {
    setTimeout(() => {
      el.style.removeProperty('--base');
      el.classList.remove('stagger');
    }, delay + 1600);
  };

  const io = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const delay = Math.min(n, 6) * 110;
      el.style.setProperty('--base', delay + 'ms');
      el.classList.add('in');
      io.unobserve(el);
      settle(el, delay + (el.children.length || 0) * 80);
      n++;
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  const observed = new Set([
    ...$$('.reveal'),
    ...$$('.words'),
    ...staggers.filter(el => !el.classList.contains('reveal')),
    ...clips,
    ...sections,
  ]);
  observed.forEach(el => io.observe(el));

  /* Numbers count up when they come into view */
  const counters = [];
  $$('.figures b, .case-stats b').forEach(el => {
    const raw = el.textContent.trim();
    const m = raw.match(/^(~?)([\d,]+(?:\.\d+)?)(\D*)$/);
    if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, ''));
    if (!target) return;
    const decimals = (m[2].split('.')[1] || '').length;
    const comma = m[2].includes(',');
    const fmt = v => m[1] + (comma ? Math.round(v).toLocaleString('en-US') : v.toFixed(decimals)) + m[3];
    el.setAttribute('aria-label', raw);
    el.textContent = fmt(0);
    counters.push({ el, target, fmt, raw });
  });

  const cio = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const c = counters.find(x => x.el === e.target);
      cio.unobserve(e.target);
      if (!c) return;
      const start = performance.now() + 150;
      const dur = 1500;
      const tick = (now) => {
        const t = Math.min(Math.max((now - start) / dur, 0), 1);
        const eased = 1 - Math.pow(1 - t, 3);
        c.el.textContent = t < 1 ? c.fmt(c.target * eased) : c.raw;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach(c => cio.observe(c.el));

  /* Scroll-linked: reading progress in the nav, gentle parallax on project media */
  const nav = document.querySelector('.nav');
  const drifters = $$('.work-media');
  const wide = window.matchMedia('(min-width: 961px)');
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    if (nav) nav.style.setProperty('--p', max > 0 ? Math.min(window.scrollY / max, 1).toFixed(4) : 0);

    if (!wide.matches) {
      drifters.forEach(el => { el.style.translate = ''; });
      return;
    }
    const mid = window.innerHeight / 2;
    drifters.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const offset = (r.top + r.height / 2 - mid) * -0.07;
      el.style.translate = `0 ${Math.max(-32, Math.min(32, offset)).toFixed(1)}px`;
    });
  };

  const request = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  onScroll();
})();
