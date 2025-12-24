import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildLessonUrl, getQueryParam, normalizeLessonPath } from './links.js';

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

  const dataPromise = loadProjectsData();
  await renderer.renderLesson(path);
  const data = await dataPromise;
  const projects = Array.isArray(data?.projects) ? data.projects : [];
  setupLessonNav(path, projects);
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

function setupLessonNav(currentPath, projects) {
  const prevButton = document.getElementById('btn-prev');
  const nextButton = document.getElementById('btn-next');
  const prevTitle = document.getElementById('prev-title');
  const nextTitle = document.getElementById('next-title');
  if (!prevButton || !nextButton || !currentPath) return;

  const { prev, next } = findLessonNeighbors(currentPath, projects);
  setNavButton(prevButton, prev, prevTitle);
  setNavButton(nextButton, next, nextTitle);
}

function setNavButton(button, target, titleEl) {
  if (!button) return;
  if (!target) {
    button.classList.add('disabled');
    button.setAttribute('aria-disabled', 'true');
    button.removeAttribute('href');
    button.tabIndex = -1;
    if (titleEl) titleEl.textContent = '---';
    return;
  }
  button.classList.remove('disabled');
  button.removeAttribute('aria-disabled');
  button.setAttribute('href', buildLessonUrl({ path: target.path }));
  button.tabIndex = 0;
  if (titleEl) titleEl.textContent = target.title || '---';
}

function findLessonNeighbors(currentPath, projects) {
  const normalized = normalizePath(currentPath);
  for (const project of projects || []) {
    const lessons = flattenLessons(project);
    const index = lessons.findIndex((lesson) => normalizePath(lesson.path) === normalized);
    if (index !== -1) {
      return {
        prev: index > 0 ? lessons[index - 1] : null,
        next: index < lessons.length - 1 ? lessons[index + 1] : null
      };
    }
  }
  return { prev: null, next: null };
}

function flattenLessons(project) {
  const items = [];
  if (!project || !Array.isArray(project.groups)) return items;
  for (const group of project.groups) {
    for (const item of group.items || []) {
      const path = item.path || `data/project${project.id || 1}/${item.id}.md`;
      items.push({ path, title: item.title || item.topic || item.id || path });
    }
  }
  return items;
}

function normalizePath(path) {
  return String(path || '').replace(/^[./]+/, '');
}
