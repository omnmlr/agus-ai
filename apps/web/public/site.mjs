import { steps } from './tour-data.mjs';

const lab = document.querySelector('.lab');
for (const item of lab?.querySelectorAll('.lab-controls > [hidden]') ?? []) item.hidden = false;
lab?.addEventListener('click', event => {
  const button = event.target.closest('[data-step]');
  if (!button) return;
  const step = steps[Number(button.dataset.step)];
  lab.querySelector('.lab-visual').dataset.stage = button.dataset.step;
  for (const control of lab.querySelectorAll('[data-step]')) {
    control.setAttribute('aria-pressed', String(control === button));
  }
  for (const item of lab.querySelectorAll('[data-demo]')) {
    item.textContent = step[item.dataset.demo];
  }
});

const mobileMenu = document.querySelector('.mobile-menu');
const updateMenu = () => mobileMenu?.querySelector('summary')?.setAttribute('aria-label', mobileMenu.open ? 'Close navigation' : 'Open navigation');
mobileMenu?.addEventListener('toggle', updateMenu);
mobileMenu?.addEventListener('click', event => {
  if (event.target.closest('a')) mobileMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && mobileMenu?.open) {
    mobileMenu.open = false;
    mobileMenu.querySelector('summary').focus();
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-copy]');
  if (!button) return;
  const code = button.closest('.snippet').querySelector('code');
  try {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = 'Copied';
  } catch {
    const selection = getSelection();
    const range = new Range();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = 'Selected';
  }
});
