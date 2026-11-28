import { steps } from './tour-data.mjs';

const theater = document.querySelector('.theater');
if (theater) {
  const controls = [...theater.querySelectorAll('[data-step]')];
  const fields = [...theater.querySelectorAll('[data-demo]')];
  const traceRows = [...theater.querySelectorAll('[data-trace-row]')];
  const announcement = theater.querySelector('[data-stage-announcement]');
  const motion = matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const section = theater.closest('section');
  let active = 0;
  let manualAt = null;
  let inView = false;
  let frame = 0;

  function selectStage(index, manual = false) {
    if (manual) manualAt = scrollY;
    const step = steps[index];
    if (index !== active) {
      active = index;
      theater.dataset.stage = String(index);
      for (const control of controls) control.setAttribute('aria-pressed', String(Number(control.dataset.step) === index));
      for (const field of fields) field.textContent = step[field.dataset.demo];
      traceRows.forEach((row, position) => {
        const selected = position === index;
        if (selected) row.setAttribute('aria-current', 'step');
        else row.removeAttribute('aria-current');
        const [label, detail] = row.children;
        label.textContent = selected ? step.trace : label.dataset.original;
        detail.textContent = selected ? step.traceDetail : detail.dataset.original;
      });
      if (!reduced.matches && !document.hidden) {
        [...theater.querySelectorAll('.log-row')].forEach((row, i) => {
          row.getAnimations().forEach(animation => animation.cancel());
          row.animate([{ opacity: .25, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
            { duration: 245, delay: i * 135, easing: 'ease-out', fill: 'backwards' });
        });
      }
    }
    if (manual) announcement.textContent = step.title + ' ' + step.description;
  }

  theater.querySelector('[data-tour-fallback]').remove();
  for (const item of theater.querySelectorAll('.lab-controls > [hidden]')) item.hidden = false;
  theater.addEventListener('click', event => {
    const button = event.target.closest('[data-step]');
    if (button) selectStage(Number(button.dataset.step), true);
  });
  theater.addEventListener('keydown', event => {
    if (!event.target.matches('[data-step]')) return;
    const movement = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 }[event.key];
    const current = Number(event.target.dataset.step);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1
      : movement ? (current + movement + controls.length) % controls.length : null;
    if (index === null) return;
    event.preventDefault();
    selectStage(index, true);
    controls[index].focus();
  });

  function onScroll() {
    if (!motion.matches || !inView || document.hidden || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (manualAt !== null && Math.abs(scrollY - manualAt) < 150) return;
      if (theater.contains(document.activeElement)) return;
      manualAt = null;
      const bounds = section.getBoundingClientRect();
      const progress = (innerHeight * .55 - bounds.top) / (bounds.height + innerHeight * .15);
      selectStage(progress < .3 ? 0 : progress < .7 ? 1 : 2);
    });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) onScroll();
      else theater.querySelectorAll('.log-row').forEach(row => row.getAnimations().forEach(animation => animation.cancel()));
    }).observe(section);
    addEventListener('scroll', onScroll, { passive: true });
  }
}

const mobileMenu = document.querySelector('.mobile-menu');
const menus = [...document.querySelectorAll('.nav-menu')];
const updateMenu = () => mobileMenu?.querySelector('summary')?.setAttribute('aria-label', mobileMenu.open ? 'Close navigation' : 'Open navigation');
mobileMenu?.addEventListener('toggle', updateMenu);
for (const menu of menus) {
  menu.addEventListener('toggle', () => {
    if (menu.open) menus.filter(other => other !== menu).forEach(other => { other.open = false; });
  });
  menu.addEventListener('click', event => { if (event.target.closest('a')) menu.open = false; });
}
mobileMenu?.addEventListener('click', event => {
  if (event.target.closest('a')) mobileMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (mobileMenu?.open) {
    mobileMenu.open = false;
    mobileMenu.querySelector('summary').focus();
    return;
  }
  const menu = menus.find(item => item.open);
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});

document.addEventListener('click', async event => {
  for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.open = false;
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const code = button.closest('.snippet').querySelector('code');
  try {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = 'Copied';
  } catch {
    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = 'Selected';
  }
  setTimeout(() => { button.textContent = 'Copy'; }, 1500);
});
