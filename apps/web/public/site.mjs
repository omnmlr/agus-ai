if (document.querySelector('[data-orbital-scene]')) {
  void import('./orbital-motion.mjs');
  void import('./replay.mjs');
}

const copyTimers = new WeakMap();
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
  clearTimeout(copyTimers.get(button));
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
  copyTimers.set(button, setTimeout(() => { button.textContent = 'Copy'; }, 1500));
});
