const scene = document.querySelector('[data-orbital-scene]');
const hero = scene.closest('section');
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const pointer = matchMedia('(hover: hover) and (pointer: fine)');
let visible = true;
let scrollFrame = 0;
let pointerFrame = 0;
let px = 0;
let py = 0;

function scrollMotion() {
  if (!visible || !motion.matches || scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const top = hero.getBoundingClientRect().top;
    scene.style.setProperty('--scroll-shift', Math.min(110, Math.max(0, -top * .17)) + 'px');
  });
}
function move(event) {
  if (!visible || !motion.matches || !pointer.matches) return;
  const box = hero.getBoundingClientRect();
  px = (event.clientX - box.left) / box.width - .5;
  py = (event.clientY - box.top) / box.height - .5;
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    scene.style.setProperty('--orbit-x', px * 17 + 'px');
    scene.style.setProperty('--orbit-y', py * 12 + 'px');
    scene.style.setProperty('--orbit-turn', px * 1.8 + 'deg');
  });
}
function resetPointer() {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  for (const property of ['--orbit-x', '--orbit-y', '--orbit-turn']) scene.style.removeProperty(property);
}

hero.addEventListener('pointermove', move, { passive: true });
hero.addEventListener('pointerleave', resetPointer);
addEventListener('scroll', scrollMotion, { passive: true });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) scrollMotion();
  }).observe(hero);
  const sections = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('in-view', entry.isIntersecting);
  }, { threshold: .18 });
  for (const target of document.querySelectorAll('.replay, .workflow-chapter, .evidence-section')) sections.observe(target);
}
motion.addEventListener('change', () => {
  if (motion.matches) scrollMotion();
  else {
    resetPointer();
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
    scene.style.removeProperty('--scroll-shift');
  }
});
