import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildAbsoluteUrl, buildIndexUrl } from './links.js';

document.addEventListener('DOMContentLoaded', async () => {
  const outlineView = document.getElementById('outline-view');
  const renderer = createRenderers({ outlineView, markdownView: null, detailControls: null });

  const data = await loadProjectsData();
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  renderer.renderProjects(projects);
  updateListSEO();
});

function updateListSEO() {
  const pageTitle = 'IT Nihongo Kaiwa';
  document.title = pageTitle;
  if (typeof setDynamicSEO === 'function') {
    try {
      setDynamicSEO({
        title: pageTitle,
        description: 'Danh sách các dự án luyện IT tiếng Nhật. Mẫu câu, từ vựng và tình huống thực tế.',
        url: buildAbsoluteUrl(buildIndexUrl())
      });
    } catch {
      // ignore SEO errors
    }
  }
}
