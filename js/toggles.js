export function initVNToggle(button = document.getElementById('btn-vn')) {
  const saved = localStorage.getItem('showVN');
  const showVN = saved !== '0';
  document.body.classList.toggle('vn-hidden', !showVN);

  if (!button) return;

  button.setAttribute('aria-pressed', showVN ? 'true' : 'false');
  button.classList.toggle('active', showVN);

  if (button.dataset.vnToggleReady === '1') return;
  button.dataset.vnToggleReady = '1';

  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', next ? 'true' : 'false');
    button.classList.toggle('active', next);
    document.body.classList.toggle('vn-hidden', !next);
    localStorage.setItem('showVN', next ? '1' : '0');
  });
}
