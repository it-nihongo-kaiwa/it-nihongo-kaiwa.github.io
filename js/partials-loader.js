(function () {
  const slots = document.querySelectorAll('[data-include]');

  async function loadPartial(slot) {
    const src = slot.getAttribute('data-include');
    if (!src) return;
    try {
      const response = await fetch(src, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      slot.outerHTML = html;
    } catch (error) {
      console.error('Không thể tải partial:', src, error);
      slot.innerHTML = `<p class="loading-error">Không thể tải ${src}</p>`;
    }
  }

  window.__partialsReady = slots.length
    ? Promise.all(Array.from(slots).map(loadPartial))
    : Promise.resolve();
})();
