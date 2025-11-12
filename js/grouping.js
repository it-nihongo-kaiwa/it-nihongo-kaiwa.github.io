export function setLessonHref(link, lessonId) {
  if (!link || !lessonId) return;
  try {
    link.setAttribute('href', `#lesson/${lessonId}`);
  } catch {
    // ignore
  }
}

export function groupClass(name) {
  const key = (name || '').toLowerCase();
  if (key.includes('pre')) return 'gi-pre';
  if (key.includes('kick')) return 'gi-kick';
  if (key.includes('basic')) return 'gi-basic';
  if (key.includes('detail')) return 'gi-detail';
  if (key.includes('coding') || key.includes('code')) return 'gi-code';
  if (key.includes('test')) return 'gi-test';
  if (key.includes('uat')) return 'gi-uat';
  if (key.includes('release') || key.includes('ops')) return 'gi-release';
  if (key.includes('process') || key.includes('proc')) return 'gi-process';
  if (key.includes('interview')) return 'gi-interview';
  return 'gi-default';
}

export function groupIconSVG(giClass) {
  switch (giClass) {
    case 'gi-pre':
    case 'gi-kick':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
    case 'gi-basic':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 5v14M5 9h14" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'gi-detail':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="15" y="3" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="15" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><path d="M6 9v3h12V9" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'gi-code':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l-4-6 4-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6l4 6-4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'gi-test':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 8h8M6 12h8M6 16h5" stroke="currentColor" stroke-width="1.6"/><path d="M18 7l2 2 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'gi-uat':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'gi-release':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 19l4-1 6-6 2-6-6 2-6 6-1 4z" stroke="currentColor" stroke-width="1.6"/><path d="M9 15l-3-3" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'gi-process':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12a7 7 0 0112-5l2-2v6h-6l2-2a5 5 0 10.9 7.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'gi-interview':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a6 6 0 01-6 6H6l-3 3V9a6 6 0 016-6h6a6 6 0 016 6v6z" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'gi-folder':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'gi-shopping-cart':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="21" r="1" stroke="currentColor" stroke-width="1.6"/><circle cx="20" cy="21" r="1" stroke="currentColor" stroke-width="1.6"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" stroke-width="1.6"/></svg>`;
    default:
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
}
