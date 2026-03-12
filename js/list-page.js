import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildAbsoluteUrl, buildProjectListUrl } from './links.js';

document.addEventListener('DOMContentLoaded', async () => {
  const outlineView = document.getElementById('outline-view');
  const renderer = createRenderers({ outlineView, markdownView: null, detailControls: null });

  const data = await loadProjectsData();
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  renderer.renderProjects(projects);
  updateListSEO();
});

function updateListSEO() {
  const pageTitle = 'IT Nihongo Kaiwa - Projects';
  document.title = pageTitle;
  if (typeof setDynamicSEO === 'function') {
    try {
      setDynamicSEO({
        title: pageTitle,
        description: 'Danh sach cac project luyen IT tieng Nhat theo tinh huong thuc te.',
        url: buildAbsoluteUrl(buildProjectListUrl())
      });
    } catch {
      // ignore SEO errors
    }
  }
}
