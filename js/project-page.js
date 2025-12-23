import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildAbsoluteUrl, buildProjectUrl, getQueryParam } from './links.js';

document.addEventListener('DOMContentLoaded', async () => {
  const outlineView = document.getElementById('outline-view');
  const renderer = createRenderers({ outlineView, markdownView: null, detailControls: null });
  const projectId = getQueryParam('id');

  const data = await loadProjectsData();
  const projects = Array.isArray(data?.projects) ? data.projects : [];

  if (!projectId) {
    if (outlineView) outlineView.innerHTML = '<p class="loading">Không tìm thấy dự án.</p>';
      updateMissingProjectSEO();
    return;
  }

  renderer.renderProjectLessons(projects, projectId);
  updateProjectSEO(projects, projectId);
});

function updateProjectSEO(projects, projectId) {
  const project = Array.isArray(projects) ? projects.find((item) => item.id === projectId) : null;
  const title = project ? project.title : projectId;
  const pageTitle = `IT Nihongo Kaiwa ・ ${title}`;
  document.title = pageTitle;

  if (typeof setDynamicSEO === 'function') {
    try {
      setDynamicSEO({
        title: pageTitle,
        description: project ? project.description : 'Bài học IT tiếng Nhật theo dự án.',
        url: buildAbsoluteUrl(buildProjectUrl(projectId))
      });
    } catch {
      // ignore SEO errors
    }
  }
}

function updateMissingProjectSEO() {
  const pageTitle = 'IT Nihongo Kaiwa ・ Project';
  document.title = pageTitle;
}
