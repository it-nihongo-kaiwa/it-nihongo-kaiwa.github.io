import { createRenderers } from './renderers.js';
import { getQueryParam, normalizeLessonPath } from './links.js';

document.addEventListener('DOMContentLoaded', async () => {
  const markdownView = document.getElementById('markdown-view');
  const outlineView = document.getElementById('outline-view');
  const detailControls = document.getElementById('detail-controls');
  const renderer = createRenderers({ markdownView, outlineView, detailControls });

  const path = normalizeLessonPath({
    path: getQueryParam('path'),
    projectId: getQueryParam('project'),
    lessonId: getQueryParam('lesson')
  });

  if (!path) {
    if (outlineView) outlineView.hidden = true;
    if (markdownView) {
      markdownView.hidden = false;
      markdownView.innerHTML = '<p class="loading">Không tìm thấy bài học.</p>';
    }
    return;
  }

  await renderer.renderLesson(path);
});
