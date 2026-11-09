const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const reveals = document.querySelectorAll('.reveal');
if (reduceMotion) {
  reveals.forEach(el => el.classList.add('in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -5% 0px', threshold: 0 });
  reveals.forEach(el => io.observe(el));
}

const films = document.querySelectorAll('video[data-autoplay]');
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
