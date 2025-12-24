import { createRenderers } from './renderers.js';
import { getQueryParam, normalizeLessonPath } from './links.js';

document.addEventListener('DOMContentLoaded', async () => {
  const markdownView = document.getElementById('markdown-view');
  const outlineView = document.getElementById('outline-view');
  const detailControls = document.getElementById('detail-controls');
  const renderer = createRenderers({ markdownView, outlineView, detailControls });
  initPrintButton();

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

function initPrintButton() {
  const button = document.getElementById('btn-print');
  if (!button || button.dataset.printReady === '1') return;
  button.dataset.printReady = '1';
  button.addEventListener('click', () => {
    buildPrintArea();
    window.print();
  });
}

function buildPrintArea() {
  const printArea = document.getElementById('print-area');
  const markdownView = document.getElementById('markdown-view');
  if (!printArea) return;

  const sheet = document.createElement('section');
  sheet.className = 'print-sheet';

  const title = document.createElement('h1');
  title.className = 'print-title';
  title.textContent = getLessonTitle(markdownView);

  const meta = document.createElement('div');
  meta.className = 'print-meta';
  meta.textContent = formatDate(new Date());

  const content = document.createElement('div');
  content.className = 'print-content';
  if (markdownView) {
    const transcript = markdownView.querySelector('.lesson-transcript');
    const dialogs = Array.from(markdownView.querySelectorAll('.dialog'));
    if (transcript) {
      const transcriptClone = transcript.cloneNode(true);
      transcriptClone.querySelectorAll('[hidden]').forEach((node) => node.removeAttribute('hidden'));
      stripVietnamese(transcriptClone);
      content.append(transcriptClone);
    } else if (dialogs.length > 0) {
      dialogs.forEach((dialog) => {
        const dialogClone = dialog.cloneNode(true);
        dialogClone.querySelectorAll('[hidden]').forEach((node) => node.removeAttribute('hidden'));
        stripVietnamese(dialogClone);
        content.append(dialogClone);
      });
    } else {
      const clone = markdownView.cloneNode(true);
      clone.querySelectorAll('.back-button, .detail-controls').forEach((node) => node.remove());
      clone.querySelectorAll('[hidden]').forEach((node) => node.removeAttribute('hidden'));
      stripVietnamese(clone);
      content.innerHTML = clone.innerHTML;
    }
  }

  sheet.append(title, meta, content);
  printArea.innerHTML = '';
  printArea.append(sheet);
}

function getLessonTitle(markdownView) {
  const heading = markdownView ? markdownView.querySelector('h1') : null;
  if (heading && heading.textContent) return heading.textContent.trim();
  const pageTitle = document.title || 'Bai hoc';
  return pageTitle.replace(/^IT Nihongo Kaiwa\s*[・-]\s*/i, '').trim() || 'Bai hoc';
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function stripVietnamese(root) {
  root.querySelectorAll('.vn').forEach((node) => node.remove());
}
