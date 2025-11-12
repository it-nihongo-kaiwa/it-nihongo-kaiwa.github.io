export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function fetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

export async function tryFetch(path) {
  try {
    return await fetchText(path);
  } catch {
    return null;
  }
}

export async function checkFileExists(path) {
  try {
    const response = await fetch(path, { method: 'HEAD', cache: 'no-cache' });
    return response.ok;
  } catch {
    return false;
  }
}

export function parseTitle(markdown, fallback) {
  const m = markdown.match(/^\s*#\s+(.+)$/m);
  return (m ? m[1].trim() : fallback).replace(/\s+$/, '');
}
