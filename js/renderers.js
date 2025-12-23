import { escapeHtml, fetchText, checkFileExists, parseTitle } from './utils.js';
import { preprocessMarkdown, enhanceLessonContent, refineVocabDisplay } from './dialogue.js';
import { insertLessonVideo } from './media.js';
import { groupClass, groupIconSVG } from './grouping.js';
import { initVNToggle } from './toggles.js';
import { buildAbsoluteUrl, buildIndexUrl, buildLessonUrl, buildProjectUrl } from './links.js';

export function createRenderers({ markdownView, outlineView, detailControls }) {
  let controlsRef = detailControls || null;

  function renderProjects(projects) {
    if (!outlineView) return;
    if (!projects || projects.length === 0) {
      const hint = location.protocol === 'file:'
        ? 'Đang mở trực tiếp file (file://). Chạy server tĩnh hoặc GitHub Pages để tải dữ liệu.'
        : 'Không tìm thấy dự án. Hãy thêm projects trong data/outline.json.';
      outlineView.innerHTML = `<p class="loading">${hint}</p>`;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'projects-grid';

    for (const project of projects) {
      const card = document.createElement('article');
      card.className = 'project-card';
      const iconClass = project.icon || 'gi-default';
      const hasLessons = Array.isArray(project.groups) && project.groups.some((group) => Array.isArray(group.items) && group.items.length > 0);
      const summaryHtml = project.summary ? buildProjectSummary(project.summary) : '';

      if (hasLessons) {
        card.innerHTML = `
          <a class="project-link" href="${buildProjectUrl(project.id)}" aria-label="Mở dự án ${escapeHtml(project.title)}">
            <div class="project-header">
              <div class="project-icon ${iconClass}">${groupIconSVG(iconClass)}</div>
              <div class="project-info-compact">
                <div class="project-title-row">
                  <h3 class="project-title">${escapeHtml(project.title)}</h3>
                  <span class="project-level level-${project.level?.toLowerCase() || 'beginner'}">${project.level || 'Beginner'}</span>
                </div>
                <p class="project-desc">${escapeHtml(project.description)}</p>
              </div>
            </div>
            ${summaryHtml}
            <span class="cta">Xem bài học</span>
          </a>
        `;
      } else {
        card.innerHTML = `
          <div class="project-link">
            <div class="project-header">
              <div class="project-icon ${iconClass}">${groupIconSVG(iconClass)}</div>
              <div class="project-info-compact">
                <div class="project-title-row">
                  <h3 class="project-title">${escapeHtml(project.title)}</h3>
                  <span class="project-level level-${project.level?.toLowerCase() || 'beginner'}">${project.level || 'Beginner'}</span>
                </div>
                <p class="project-desc">${escapeHtml(project.description)}</p>
              </div>
            </div>
            ${summaryHtml}
            <span class="badge-draft">Sắp có</span>
          </div>
        `;
      }

      grid.appendChild(card);
    }

    outlineView.innerHTML = '';
    outlineView.appendChild(grid);
  }

  async function renderProjectLessons(projects, projectId) {
    if (!outlineView || !Array.isArray(projects)) return;
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      outlineView.innerHTML = '<p class="loading">Không tìm thấy dự án.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    const backButton = document.createElement('div');
    backButton.className = 'back-button';
    backButton.innerHTML = `
      <a href="${buildIndexUrl()}" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Quay lại danh sách dự án
      </a>
    `;
    frag.appendChild(backButton);

    const header = document.createElement('div');
    header.className = 'project-header detail-header';
    const iconClass = project.icon || 'gi-default';
    const summaryHtml = project.summary ? buildProjectDetailSummary(project.summary) : '';
    header.innerHTML = `
      <div class="project-icon ${iconClass}">${groupIconSVG(iconClass)}</div>
      <div class="project-info">
        <h2 class="project-title">${escapeHtml(project.title)}</h2>
        <p class="project-desc">${escapeHtml(project.description)}</p>
        ${summaryHtml}
      </div>
    `;
    frag.appendChild(header);

    for (const group of project.groups || []) {
      const section = document.createElement('section');
      section.className = 'outline-section';
      const giClass = groupClass(group.group);
      section.innerHTML = `<h3 class="outline-group"><span class="group-icon ${giClass}" aria-hidden="true">${groupIconSVG(giClass)}</span><span>${escapeHtml(group.group)}</span></h3>`;
      const grid = document.createElement('div');
      grid.className = 'outline-grid';

      const availability = await Promise.all((group.items || []).map(async (item) => {
        const path = item.path || `data/project1/${item.id}.md`;
        const isAvailable = await checkFileExists(path);
        return { ...item, path, isAvailable };
      }));

      for (const item of availability) {
        const card = document.createElement('article');
        card.className = 'outline-card' + (item.isAvailable ? ' available' : '');
        if (item.isAvailable) {
          const id = item.id ? String(item.id) : deriveIdFromPath(item.path);
          const lessonHref = buildLessonUrl({ path: item.path, projectId, lessonId: id });
          card.innerHTML = `
            <a class="card-link" href="${lessonHref}" aria-label="Mở ${escapeHtml(item.title || item.topic)}">
              <h4 class="outline-title">${escapeHtml(item.title || item.topic)}</h4>
              ${item.content ? `<p class="outline-desc">${escapeHtml(item.content)}</p>` : ''}
              <span class="cta">Mở bài học</span>
            </a>
          `;
        } else {
          card.innerHTML = `
            <h4 class="outline-title">${escapeHtml(item.title || item.topic)}</h4>
            ${item.content ? `<p class="outline-desc">${escapeHtml(item.content)}</p>` : ''}
            <span class="badge-draft">Sắp có</span>
          `;
        }
        grid.appendChild(card);
      }

      section.appendChild(grid);
      frag.appendChild(section);
    }

    outlineView.innerHTML = '';
    outlineView.appendChild(frag);
  }

  async function renderLesson(path) {
    if (!markdownView || !outlineView) return;
    outlineView.hidden = true;
    markdownView.hidden = false;
    markdownView.innerHTML = '<p class="loading">Đang tải bài học…</p>';

    markdownView.querySelectorAll('.back-button').forEach((btn) => btn.remove());
    outlineView.querySelectorAll('.back-button').forEach((btn) => btn.remove());

    try {
      const text = await fetchText(path);
      const processed = preprocessMarkdown(text);
      if (window.marked) {
        markdownView.innerHTML = window.marked.parse(processed, { gfm: true, breaks: true });
      } else {
        markdownView.textContent = text;
      }

      if (path.includes('/project')) {
        const projectId = getProjectIdFromPath(path);
        const backButton = buildLessonBackButton(projectId);
        const controls = ensureDetailControls(backButton);
        if (controls) initVNToggle(controls.querySelector('#btn-vn'));
        markdownView.insertBefore(backButton, markdownView.firstChild);
      }

      enhanceLessonContent(markdownView);
      refineVocabDisplay(markdownView);
      await insertLessonVideo(markdownView, path);

      updateLessonSEO(path, text);
    } catch (error) {
      markdownView.innerHTML = `<blockquote><span class="label vn">Info</span> <span class="vn">Không thể tải: ${escapeHtml(String(error))}</span></blockquote>`;
    }
  }

  function ensureDetailControls(backButton) {
    if (controlsRef) {
      controlsRef.hidden = false;
      backButton.appendChild(controlsRef);
      return controlsRef;
    }
    const fallback = document.createElement('section');
    fallback.className = 'detail-controls';
    fallback.innerHTML = `
      <button id="btn-vn" class="icon-btn active" aria-pressed="true" title="Hiện/ẩn tiếng Việt (VN)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    `;
    controlsRef = fallback;
    backButton.appendChild(fallback);
    return fallback;
  }

  function buildLessonBackButton(projectId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'back-button';
    wrapper.innerHTML = `
      <a href="${buildProjectUrl(projectId)}" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Quay lại dự án
      </a>
    `;
    return wrapper;
  }

  function updateLessonSEO(path, markdownText) {
    const baseName = path.split('/').pop() || 'lesson';
    const lessonId = baseName.replace(/\.md$/i, '');
    const titleFromMd = parseTitle(markdownText, lessonId);
    const lessonUrl = buildLessonUrl({ path });
    const absoluteUrl = buildAbsoluteUrl(lessonUrl);

    if (typeof setDynamicSEO === 'function' && typeof summarizeText === 'function') {
      try {
        setDynamicSEO({
          title: `IT Nihongo Kaiwa ・ ${titleFromMd}`,
          description: summarizeText(markdownText, 160),
          url: absoluteUrl
        });
      } catch {
        document.title = `IT Nihongo Kaiwa ・ ${titleFromMd}`;
      }
    } else {
      document.title = `IT Nihongo Kaiwa ・ ${titleFromMd}`;
    }
  }

  function buildProjectSummary(summary) {
    return `
      <div class="project-info">
        <div class="info-item">
          <span class="info-label">Scope:</span>
          <span class="info-value">${escapeHtml(summary.scope)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Duration:</span>
          <span class="info-value">${escapeHtml(summary.duration)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Team:</span>
          <span class="info-value">${escapeHtml(summary.team)}</span>
        </div>
      </div>
    `;
  }

  function buildProjectDetailSummary(summary) {
    return `
      <div class="project-summary">
        <div class="summary-row">
          <div class="summary-item">
            <span class="summary-label">Scope:</span>
            <span class="summary-value">${escapeHtml(summary.scope)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Duration:</span>
            <span class="summary-value">${escapeHtml(summary.duration)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Team:</span>
            <span class="summary-value">${escapeHtml(summary.team)}</span>
          </div>
        </div>
        ${summary.features ? renderFeatureTags(summary.features) : ''}
        ${summary.tech ? `<div class="summary-tech"><span class="summary-label">Tech Stack:</span><span class="summary-value">${escapeHtml(summary.tech)}</span></div>` : ''}
      </div>
    `;
  }

  function renderFeatureTags(features) {
    if (!Array.isArray(features) || features.length === 0) return '';
    return `
      <div class="summary-features">
        <span class="summary-label">Key Features:</span>
        <div class="feature-tags">
          ${features.map((feature) => `<span class="feature-tag">${escapeHtml(feature)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  return { renderProjects, renderProjectLessons, renderLesson };
}

function getProjectIdFromPath(path) {
  const match = path.match(/\/project(\d+)\//);
  return match ? match[1] : '1';
}

function deriveIdFromPath(path) {
  return String(path.split('/').pop() || '').replace(/\.md$/i, '');
}
