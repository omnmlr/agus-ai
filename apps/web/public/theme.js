(() => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-workspace')) return;
  const key = 'agus-workspace-theme';
  const options = new Set(['light', 'dark', 'system']);
  let preference = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (options.has(saved)) preference = saved;
  } catch { /* The system preference still works when storage is unavailable. */ }

  const sync = () => {
    if (preference === 'system') delete root.dataset.theme;
    else root.dataset.theme = preference;
    for (const select of document.querySelectorAll('[data-theme-control]')) select.value = preference;
  };
  sync();
  document.addEventListener('DOMContentLoaded', sync);
  document.addEventListener('change', ({ target }) => {
    if (!target.matches('[data-theme-control]') || !options.has(target.value)) return;
    preference = target.value;
    try { localStorage.setItem(key, preference); } catch { /* Apply for this view. */ }
    sync();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = options.has(event.newValue) ? event.newValue : 'system';
    sync();
  });
})();
