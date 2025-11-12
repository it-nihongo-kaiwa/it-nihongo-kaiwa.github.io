import { initVNToggle } from './toggles.js';
import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';

let renderer = null;
let projects = [];
let markdownView = null;
let outlineView = null;
let detailControls = null;

window.addEventListener('hashchange', () => {
  route().catch((error) => console.error('Route error', error));
});

document.addEventListener('DOMContentLoaded', async () => {
  await ensurePartialsReady();
  cacheElements();
  renderer = createRenderers({ markdownView, outlineView, detailControls });
  initVNToggle();

  const data = await loadProjectsData();
  projects = Array.isArray(data?.projects) ? data.projects : [];

  if (!window.location.hash) window.location.hash = '#list';
  await route();
});

async function route() {
  if (!renderer || !outlineView || !markdownView) return;
  const hash = window.location.hash || '';
  toggleHero(hash);

  const pretty = hash.match(/^#lesson\/?([A-Za-z0-9_\-.]+)/);
  const colon = hash.match(/^#lesson:(.+)$/);
  const legacyMd = hash.match(/^#(.+\.md)$/i);
  const projectMatch = hash.match(/^#project\/([A-Za-z0-9_\-]+)/);

  if (pretty && pretty[1]) {
    await renderer.renderLesson(`data/project1/${pretty[1]}.md`);
    return;
  }
  if (colon && colon[1]) {
    const path = colon[1].includes('..') ? 'data/project1/0-1.md' : colon[1];
    await renderer.renderLesson(path);
    return;
  }
  if (legacyMd && legacyMd[1]) {
    await renderer.renderLesson(legacyMd[1]);
    return;
  }
  if (projectMatch && projectMatch[1]) {
    prepareOutlineView();
    updateProjectSEO(projectMatch[1]);
    await renderer.renderProjectLessons(projects, projectMatch[1]);
    return;
  }

  prepareOutlineView();
  updateListSEO();
  renderer.renderProjects(projects);
}

function cacheElements() {
  markdownView = document.getElementById('markdown-view');
  outlineView = document.getElementById('outline-view');
  detailControls = document.getElementById('detail-controls');
  if (detailControls) detailControls.hidden = true;
}

async function ensurePartialsReady() {
  if (window.__partialsReady && typeof window.__partialsReady.then === 'function') {
    try {
      await window.__partialsReady;
    } catch (error) {
      console.error('Khong th? t?i partials', error);
    }
  }
}

function prepareOutlineView() {
  if (markdownView) markdownView.hidden = true;
  if (outlineView) outlineView.hidden = false;
  if (detailControls) detailControls.hidden = true;
}

function toggleHero(hash) {
  const heroSection = document.getElementById('hero-section');
  if (heroSection) {
    heroSection.hidden = !(hash === '' || hash === '#list');
  }
}

function updateProjectSEO(projectId) {
  const project = projects.find((item) => item.id === projectId);
  const title = project ? project.title : projectId;
  const pageTitle = `IT Nihongo Kaiwa ÅE ${title}`;
  document.title = pageTitle;

  if (typeof setDynamicSEO === 'function') {
    try {
      setDynamicSEO({
        title: pageTitle,
        description: project ? project.description : 'Bai h?c IT ti?ng Nh?t theo d? an.',
        url: location.origin + location.pathname + `#project/${projectId}`
      });
    } catch {
      // ignore SEO errors
    }
  }
}

function updateListSEO() {
  const pageTitle = 'IT Nihongo Kaiwa ÅE D? an';
  document.title = pageTitle;
  if (typeof setDynamicSEO === 'function') {
    try {
      setDynamicSEO({
        title: pageTitle,
        description: 'Danh sach cac d? an luy?n IT ti?ng Nh?t. M?u cau, t? v?ng va tinh hu?ng th?c t?.',
        url: location.origin + location.pathname + '#list'
      });
    } catch {
      // ignore SEO errors
    }
  }
}
