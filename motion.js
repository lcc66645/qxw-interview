(() => {
  'use strict';
  function mount(root) {
    const disposePortrait = window.PortfolioPortrait?.mount(root.querySelector('.portrait-intro')) || (() => {});
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reveals = [...root.querySelectorAll('.about-copy, .capability-item, .practice-point, .method-item, .insight-item, .tech-group, .job-heading')];
    root.classList.add('motion-enabled');
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: 0.04, rootMargin: '0px 0px 40px 0px' });
    reveals.forEach((element, index) => {
      element.dataset.reveal = '';
      element.style.setProperty('--reveal-delay', `${Math.min(index % 5, 3) * 50}ms`);
      if (media.matches) element.classList.add('is-visible');
      else observer.observe(element);
    });
    function syncMotion() {
      if (media.matches) reveals.forEach(element => { element.classList.add('is-visible'); observer.unobserve(element); });
    }
    media.addEventListener('change', syncMotion);
    return () => { observer.disconnect(); media.removeEventListener('change', syncMotion); disposePortrait(); };
  }
  window.PortfolioMotion = { mount };
})();
