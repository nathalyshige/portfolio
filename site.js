(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* Videos: play only while on screen; under reduced motion, give controls instead */
  const films = $$('video[data-autoplay]');
  if (reduceMotion) {
    films.forEach(v => {
      v.controls = true;
      if (v.dataset.still) v.poster = v.dataset.still;
    });
  } else {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    }, { threshold: 0.25 });
    films.forEach(v => vio.observe(v));
  }

  /* Case studies: a side menu of sections that marks where the reader is */
  const navSecs = $$('[data-nav]');
  if (navSecs.length > 2) {
    const toc = document.createElement('nav');
    toc.className = 'toc';
    toc.setAttribute('aria-label', 'Sections');
    const links = navSecs.map(sec => {
      if (!sec.id) sec.id = 's-' + sec.dataset.nav.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const a = document.createElement('a');
      a.href = '#' + sec.id;
      a.innerHTML = '<i aria-hidden="true"></i><span></span>';
      a.querySelector('span').textContent = sec.dataset.nav;
      a.addEventListener('click', e => {
        e.preventDefault();
        const y = sec === navSecs[0] ? 0 : sec.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
        history.replaceState(null, '', '#' + sec.id);
      });
      toc.appendChild(a);
      return a;
    });
    document.body.appendChild(toc);
    let current = -1, ticking = false;
    const update = () => {
      ticking = false;
      const line = window.innerHeight * 0.35;
      let idx = 0;
      navSecs.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= line) idx = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = navSecs.length - 1;
      if (idx !== current) {
        links.forEach((a, i) => {
          a.classList.toggle('on', i === idx);
          if (i === idx) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
        current = idx;
      }
      toc.classList.toggle('show', window.scrollY > 160);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  if (reduceMotion) {
    $$('.reveal').forEach(el => el.classList.add('in'));
    return;
  }

  /* Diagrams: a request travels through each one while it is on screen */
  const inView = (el, onChange) => {
    const io = new IntersectionObserver(es => es.forEach(e => onChange(e.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
  };
  const ease = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const centerOf = (el, root, side) => {
    const r = el.getBoundingClientRect(), o = root.getBoundingClientRect();
    const x = { l: r.left, r: r.right, c: r.left + r.width / 2 }[side[0]] - o.left;
    const y = { t: r.top, b: r.bottom, c: r.top + r.height / 2 }[side[1]] - o.top;
    return [x, y];
  };
  function makeDot(root, cls = '') {
    const d = document.createElement('span');
    d.className = 'flow-dot ' + cls;
    root.appendChild(d);
    return d;
  }
  // a timeline of steps: { at, dur, from:[el,side], to:[el,side], dot, lit:[els] }
  function runTimeline(root, steps, total) {
    let raf = 0, t0 = 0, on = false;
    const lits = new Set();
    steps.forEach(s => (s.lit || []).forEach(el => lits.add(el)));
    const frame = now => {
      if (!on) return;
      const t = ((now - t0) / 1000) % total;
      const litNow = new Set(), moving = new Set();
      steps.forEach(s => {
        const k = (t - s.at) / s.dur;
        if (s.dot && k > 0 && k < 1) {
          const a = centerOf(s.from[0], root, s.from[1]), b = centerOf(s.to[0], root, s.to[1]);
          const e = ease(k);
          s.dot.style.transform = `translate(${a[0] + (b[0] - a[0]) * e}px, ${a[1] + (b[1] - a[1]) * e}px)`;
          s.dot.style.opacity = Math.min(1, k * 6, (1 - k) * 6);
          moving.add(s.dot);
        }
        if (s.lit && t >= s.at && t < s.at + (s.hold || s.dur)) s.lit.forEach(el => litNow.add(el));
      });
      steps.forEach(s => { if (s.dot && !moving.has(s.dot)) s.dot.style.opacity = 0; });
      lits.forEach(el => el.classList.toggle('lit', litNow.has(el)));
      raf = requestAnimationFrame(frame);
    };
    inView(root, v => {
      on = v;
      if (v) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); lits.forEach(el => el.classList.remove('lit')); steps.forEach(s => s.dot && (s.dot.style.opacity = 0)); }
    });
  }

  // step-by-step rows: light each node, then carry a dot along the wire to the next
  $$('.diagram--row').forEach(diag => {
    const nodes = $$('.node', diag), wires = $$('.wire', diag);
    if (nodes.length < 2) return;
    diag.classList.add('flowing');
    const dot = makeDot(diag);
    const steps = []; let t = 0.3;
    nodes.forEach((n, i) => {
      steps.push({ at: t, dur: 0.75, lit: [n] });
      t += 0.55;
      const w = wires[i];
      if (w && nodes[i + 1]) {
        const row = getComputedStyle(diag).flexDirection !== 'column';
        steps.push({ at: t, dur: 0.6, dot, from: [w, row ? 'lc' : 'ct'], to: [w, row ? 'rc' : 'cb'] });
        t += 0.6;
      }
    });
    steps[steps.length - 1].hold = 1.4;
    runTimeline(diag, steps, t + 1.8);
  });

  // the Smart Match architecture: one results request, end to end
  const arch = document.querySelector('[data-arch]');
  if (arch) {
    const N = k => arch.querySelector(`[data-k="${k}"]`);
    const W = k => arch.querySelector(`[data-w="${k}"]`);
    const d1 = makeDot(arch), d2 = makeDot(arch), d3 = makeDot(arch), d4 = makeDot(arch), dv = makeDot(arch, 'vec'), dOff = makeDot(arch, 'faint');
    const steps = [
      { at: 0.2, dur: 0.9, lit: [N('quiz')] },
      { at: 0.0, dur: 1.2, dot: dOff, from: [N('builder'), 'rc'], to: [N('matrix'), 'lc'], lit: [N('builder')], hold: 1.2 },
      { at: 0.9, dur: 0.8, dot: d1, from: [N('quiz'), 'cb'], to: [N('controller'), 'ct'] },
      { at: 1.6, dur: 0.7, lit: [N('controller')] },
      { at: 2.1, dur: 0.5, dot: d1, from: [N('controller'), 'rc'], to: [N('intent'), 'lc'] },
      { at: 2.5, dur: 0.7, lit: [N('intent')] },
      { at: 3.0, dur: 0.5, dot: d1, from: [N('intent'), 'rc'], to: [N('service'), 'lc'] },
      { at: 3.4, dur: 4.6, lit: [N('service')] },
      { at: 3.9, dur: 0.8, dot: d2, from: [N('service'), 'cb'], to: [N('embed'), 'rt'], lit: [W('query')], hold: 1.9 },
      { at: 4.6, dur: 0.6, lit: [N('embed')] },
      { at: 5.1, dur: 0.8, dot: dv, from: [N('embed'), 'rt'], to: [N('service'), 'cb'] },
      { at: 6.0, dur: 0.7, dot: d2, from: [N('service'), 'cb'], to: [N('matrix'), 'ct'], lit: [N('matrix')], hold: 1.1 },
      { at: 6.15, dur: 0.7, dot: d3, from: [N('service'), 'cb'], to: [N('rules'), 'ct'], lit: [N('rules')], hold: 1.0 },
      { at: 6.3, dur: 0.7, dot: d4, from: [N('service'), 'cb'], to: [N('cities'), 'ct'], lit: [N('cities')], hold: 0.9 },
      { at: 7.6, dur: 1.0, dot: d1, from: [N('service'), 'ct'], to: [N('results'), 'cb'], lit: [W('answers')], hold: 1.0 },
      { at: 8.5, dur: 1.4, lit: [N('results')] },
    ];
    runTimeline(arch, steps, 11.2);
  }

  // scoring: the bar fills, then each part is walked through; hovering any piece links the rest
  const score = document.querySelector('[data-score]');
  if (score) {
    const section = score.closest('.case-section') || document;
    const parts = ['sim', 'attr', 'dist'];
    const els = p => $$(`[data-part="${p}"]`, section);
    const focus = p => parts.forEach(q => els(q).forEach(el => { el.classList.toggle('dim', !!p && q !== p); el.classList.toggle('hot', q === p); }));
    let walking = false, hovering = false;
    inView(score, v => {
      if (!v || walking || score.dataset.done) return;
      walking = true; score.dataset.done = '1';
      score.classList.add('filled');
      const seq = ['sim', 'attr', 'dist', null];
      seq.forEach((p, i) => setTimeout(() => { if (!hovering) focus(p); if (i === seq.length - 1) walking = false; }, 1200 + i * 1500));
    });
    parts.forEach(p => els(p).forEach(el => {
      el.addEventListener('mouseenter', () => { hovering = true; focus(p); });
      el.addEventListener('mouseleave', () => { hovering = false; focus(null); });
    }));
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
