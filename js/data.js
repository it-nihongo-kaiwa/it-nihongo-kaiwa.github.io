import { tryFetch } from './utils.js';

export async function loadProjectsData() {
  try {
    const jsonData = await loadFromJson();
    if (jsonData) return jsonData;
    return await loadFromTxt();
  } catch (error) {
    console.error('Error loading project data', error);
    return { outlineGroups: [], projects: [] };
  }
}

async function loadFromJson() {
  const jsonRaw = await tryFetch('data/outline.json');
  if (!jsonRaw) return null;
  const data = JSON.parse(jsonRaw);
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  const outlineGroups = normalizeOutlineGroups(collectGroups(projects, data));
  return { outlineGroups, projects };
}

function collectGroups(projects, data) {
  if (Array.isArray(projects) && projects.length > 0) {
    return projects.flatMap((project) => Array.isArray(project?.groups) ? project.groups : []);
  }
  if (Array.isArray(data?.outline)) return data.outline;
  if (Array.isArray(data)) return data;
  return [];
}

async function loadFromTxt() {
  const txt = await tryFetch('data/outline.txt');
  if (!txt) return { outlineGroups: [], projects: [] };
  const lines = txt.split(/\r?\n/).filter((line) => /^\|/.test(line));
  const map = new Map();
  for (const line of lines) {
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const id = cells[1];
    const group = cells[2] || '';
    const topic = cells[3] || '';
    if (!id || !topic) continue;
    const items = map.get(group) || [];
    items.push({ id, title: topic, path: `data/${id}.md` });
    map.set(group, items);
  }
  const entries = Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  return { outlineGroups: normalizeOutlineGroups(entries), projects: [] };
}

function normalizeOutlineGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter((group) => group && Array.isArray(group.items))
    .map((group) => {
      const groupName = group.group || '(Khac)';
      const items = group.items
        .map((item) => normalizeItem(item))
        .filter(Boolean);
      return items.length ? { group: groupName, items } : null;
    })
    .filter(Boolean);
}

function normalizeItem(item) {
  if (!item || !item.id) return null;
  const id = String(item.id).trim();
  const topic = item.title || item.topic || id;
  const content = item.content || item.desc || '';
  const path = item.path || `data/project1/${id}.md`;
  const views = Number(item.views ?? item.view ?? item.count ?? 0) || 0;
  return { id, topic, path, content, views };
}
