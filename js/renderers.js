import { escapeHtml, fetchText, checkFileExists, parseTitle } from './utils.js';
import { preprocessMarkdown, enhanceLessonContent, refineVocabDisplay } from './dialogue.js';
import { insertLessonVideo } from './media.js';
import { groupClass, groupIconSVG } from './grouping.js';
import { initVNToggle } from './toggles.js';
import { buildAbsoluteUrl, buildLessonUrl, buildProjectListUrl, buildProjectUrl } from './links.js';

export function createRenderers({ markdownView, outlineView, detailControls }) {
  let controlsRef = detailControls || null;

  function renderProjects(projects) {
    if (!outlineView) return;

    if (!projects || projects.length === 0) {
      const hint = location.protocol === 'file:'
        ? 'Không thể tải dữ liệu khi mở bằng file://. Hãy chạy server local hoặc GitHub Pages.'
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
      const levelLabel = localizeProjectLevel(project.level);
      const hasLessons = Array.isArray(project.groups)
        && project.groups.some((group) => Array.isArray(group.items) && group.items.length > 0);
      const summaryHtml = project.summary ? buildProjectSummary(project.summary) : '';

      if (hasLessons) {
        card.innerHTML = `
          <a class="project-link" href="${buildProjectUrl(project.id)}" aria-label="Mở dự án ${escapeHtml(project.title)}">
            <div class="project-header">
              <div class="project-icon ${iconClass}">${groupIconSVG(iconClass)}</div>
              <div class="project-info-compact">
                <div class="project-title-row">
                  <h3 class="project-title">${escapeHtml(project.title)}</h3>
                  <span class="project-level level-${String(project.level || 'beginner').toLowerCase()}">${escapeHtml(levelLabel)}</span>
                </div>
                <p class="project-desc">${escapeHtml(project.description || '')}</p>
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
                  <span class="project-level level-${String(project.level || 'beginner').toLowerCase()}">${escapeHtml(levelLabel)}</span>
                </div>
                <p class="project-desc">${escapeHtml(project.description || '')}</p>
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
      <a href="${buildProjectListUrl()}" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Quay lại danh sách dự án
      </a>
    `;
    frag.appendChild(backButton);

    const iconClass = project.icon || 'gi-default';
    const groupsWithAvailability = await Promise.all((project.groups || []).map(async (group) => {
      const items = await Promise.all((group.items || []).map(async (item) => {
        const path = item.path || `data/project1/${item.id}.md`;
        const isAvailable = await checkFileExists(path);
        return { ...item, path, isAvailable };
      }));
      return { ...group, items };
    }));

    const stats = summarizeProject(project, groupsWithAvailability);
    const dashboard = document.createElement('div');
    dashboard.className = 'project-dashboard';
    dashboard.innerHTML = buildProjectDashboard(project, iconClass, stats, projectId);

    const stagesContainer = dashboard.querySelector('.project-stage-list');

    for (const [groupIndex, group] of groupsWithAvailability.entries()) {
      const section = document.createElement('section');
      section.className = 'project-stage-section';

      const giClass = groupClass(group.group);
      const availableCount = group.items.filter((item) => item.isAvailable).length;

      section.innerHTML = `
        <div class="project-stage-header">
          <div class="project-stage-icon ${giClass}" aria-hidden="true">${groupIconSVG(giClass)}</div>
          <div class="project-stage-copy">
            <div class="project-stage-overline">
              <span class="project-stage-order">Giai đoạn ${groupIndex + 1}</span>
              <span class="project-stage-count">${group.items.length} bài học</span>
            </div>
            <h3 class="project-stage-title">${escapeHtml(group.group || `Giai đoạn ${groupIndex + 1}`)}</h3>
            <p class="project-stage-desc">${escapeHtml(buildGroupSummary(group, availableCount))}</p>
          </div>
        </div>
      `;

      const lessonList = document.createElement('div');
      lessonList.className = 'project-lesson-list';

      for (const [itemIndex, item] of group.items.entries()) {
        const row = document.createElement('article');
        const isFeatured = Boolean(stats.firstAvailablePath && item.path === stats.firstAvailablePath);
        row.className = 'project-lesson-row'
          + (item.isAvailable ? ' available' : ' locked')
          + (isFeatured ? ' featured' : '');

        const lessonTitle = escapeHtml(item.title || item.topic || `Bài ${itemIndex + 1}`);
        const lessonMeta = `${String(groupIndex + 1).padStart(2, '0')}.${String(itemIndex + 1).padStart(2, '0')}`;
        const lessonDesc = item.content ? `<p class="project-lesson-desc">${escapeHtml(item.content)}</p>` : '';

        if (item.isAvailable) {
          const id = item.id ? String(item.id) : deriveIdFromPath(item.path);
          const lessonHref = buildLessonUrl({ path: item.path, projectId, lessonId: id });

          row.innerHTML = `
            <a class="project-lesson-link" href="${lessonHref}" aria-label="Mở ${lessonTitle}">
              <div class="project-lesson-leading">
                <span class="project-lesson-bullet" aria-hidden="true">${isFeatured ? '&#9654;' : '&#8226;'}</span>
                <div class="project-lesson-body">
                  <div class="project-lesson-topline">
                    <span class="project-lesson-index">${lessonMeta}</span>
                    <span class="project-lesson-status">${isFeatured ? 'Đang học' : 'Sẵn sàng'}</span>
                  </div>
                  <h4 class="project-lesson-title">${lessonTitle}</h4>
                  ${lessonDesc}
                </div>
              </div>
              <span class="project-lesson-cta">${isFeatured ? 'Tiếp tục' : 'Mở bài'}</span>
            </a>
          `;
        } else {
          row.innerHTML = `
            <div class="project-lesson-link" aria-disabled="true">
              <div class="project-lesson-leading">
                <span class="project-lesson-bullet locked" aria-hidden="true">&#9679;</span>
                <div class="project-lesson-body">
                  <div class="project-lesson-topline">
                    <span class="project-lesson-index">${lessonMeta}</span>
                    <span class="project-lesson-status muted">Sắp có</span>
                  </div>
                  <h4 class="project-lesson-title">${lessonTitle}</h4>
                  ${lessonDesc}
                </div>
              </div>
              <span class="project-lesson-cta muted">Khóa</span>
            </div>
          `;
        }

        lessonList.appendChild(row);
      }

      section.appendChild(lessonList);
      stagesContainer?.appendChild(section);
    }

    frag.appendChild(dashboard);
    outlineView.innerHTML = '';
    outlineView.appendChild(frag);
  }

  async function renderLesson(path) {
    if (!markdownView || !outlineView) return;

    outlineView.hidden = true;
    markdownView.hidden = false;
    markdownView.innerHTML = '<p class="loading">Đang tải bài học...</p>';

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
      <button id="btn-print" class="icon-btn" type="button" title="In bài học" aria-label="In bài học">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9V3h12v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 17h12v4H6v-4z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 13H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
          title: `IT Nihongo Kaiwa - ${titleFromMd}`,
          description: summarizeText(markdownText, 160),
          url: absoluteUrl
        });
      } catch {
        document.title = `IT Nihongo Kaiwa - ${titleFromMd}`;
      }
    } else {
      document.title = `IT Nihongo Kaiwa - ${titleFromMd}`;
    }
  }

  function buildProjectSummary(summary) {
    return `
      <div class="project-info">
        <div class="info-item">
          <span class="info-label">Scope:</span>
          <span class="info-value">${escapeHtml(summary.scope || '')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Duration:</span>
          <span class="info-value">${escapeHtml(summary.duration || '')}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Team:</span>
          <span class="info-value">${escapeHtml(summary.team || '')}</span>
        </div>
      </div>
    `;
  }

  return { renderProjects, renderProjectLessons, renderLesson };
}

function summarizeProject(project, groups) {
  const allItems = (groups || []).flatMap((group) => Array.isArray(group.items) ? group.items : []);
  const availableItems = allItems.filter((item) => item.isAvailable);
  const totalLessons = allItems.length;
  const learnedLessons = availableItems.length;
  const remainingLessons = Math.max(totalLessons - learnedLessons, 0);
  const progressPercent = totalLessons > 0 ? Math.round((learnedLessons / totalLessons) * 100) : 0;
  const firstAvailable = availableItems[0] || null;
  const techTags = String(project?.summary?.tech || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    totalLessons,
    availableLessons: availableItems.length,
    learnedLessons,
    remainingLessons,
    totalStages: Array.isArray(groups) ? groups.length : 0,
    progressPercent,
    firstAvailablePath: firstAvailable?.path || null,
    firstAvailableLessonId: firstAvailable?.id ? String(firstAvailable.id) : (firstAvailable?.path ? deriveIdFromPath(firstAvailable.path) : null),
    techTags,
    duration: project?.summary?.duration || `${Array.isArray(groups) ? groups.length : 0} giai đoạn`,
    team: project?.summary?.team || `${availableItems.length} bài học sẵn sàng`,
    scope: project?.summary?.scope || 'Lộ trình BrSE / Comtor',
    features: Array.isArray(project?.summary?.features) ? project.summary.features.slice(0, 3) : []
  };
}

function localizeProjectLevel(level) {
  const normalized = String(level || '').trim().toLowerCase();
  if (!normalized) return 'Cơ bản';
  if (normalized === 'beginner') return 'Cơ bản';
  if (normalized === 'intermediate') return 'Trung cấp';
  if (normalized === 'advanced') return 'Nâng cao';
  return String(level);
}

function buildProjectDashboard(project, iconClass, stats, projectId) {
  const levelLabel = localizeProjectLevel(project.level);
  const techChips = stats.techTags.length > 0
    ? stats.techTags.map((tag) => `<span class="project-tech-chip">${escapeHtml(tag)}</span>`).join('')
    : `<span class="project-tech-chip">${escapeHtml(levelLabel)}</span>`;

  const featureTags = stats.features.length > 0
    ? `
      <div class="project-feature-group">
        <span class="project-hero-section-label">Trọng tâm</span>
        <div class="project-feature-pills">${stats.features.map((item) => `<span class="project-feature-pill">${escapeHtml(item)}</span>`).join('')}</div>
      </div>
    `
    : '';

  const progressCta = stats.firstAvailablePath && stats.firstAvailableLessonId
    ? buildLessonUrl({ path: stats.firstAvailablePath, projectId, lessonId: stats.firstAvailableLessonId })
    : buildProjectListUrl();

  return `
    <section class="project-hero-card">
      <div class="project-hero-cover">
        <span class="project-hero-cover-glow" aria-hidden="true"></span>
        <div class="project-icon project-hero-icon ${iconClass}">${groupIconSVG(iconClass)}</div>
      </div>
      <div class="project-hero-main">
        <div class="project-hero-pills">
          <span class="project-hero-pill">${escapeHtml(levelLabel)}</span>
        </div>
        <h2 class="project-hero-title">${escapeHtml(project.title)}</h2>
        <p class="project-hero-description">${escapeHtml(project.description || '')}</p>
        <div class="project-hero-meta">
          <span class="project-hero-meta-item"><strong>Phạm vi</strong>${escapeHtml(stats.scope)}</span>
          <span class="project-hero-meta-item"><strong>Thời lượng</strong>${escapeHtml(stats.duration)}</span>
          <span class="project-hero-meta-item"><strong>Giai đoạn</strong>${stats.totalStages} giai đoạn</span>
        </div>
        <div class="project-hero-foot">
          <div class="project-tech-group">
            <span class="project-hero-section-label">Công nghệ</span>
            <div class="project-tech-list">${techChips}</div>
          </div>
          ${featureTags}
        </div>
      </div>
      <aside class="project-progress-card">
        <div class="project-progress-value">${stats.progressPercent}%</div>
        <div class="project-progress-label">Tiến độ</div>
        <div class="project-progress-meta">${stats.learnedLessons}/${stats.totalLessons} bài học đã mở</div>
        <div class="project-progress-bar"><span style="width:${stats.progressPercent}%"></span></div>
        <a href="${progressCta}" class="project-progress-cta">${stats.firstAvailablePath ? 'Học tiếp' : 'Xem danh sách'}</a>
      </aside>
    </section>

    <div class="project-dashboard-grid">
      <aside class="project-sidebar">
        <section class="project-sidecard">
          <h3 class="project-sidecard-title">Thống kê dự án</h3>
          <div class="project-stat-list">
            <div class="project-stat-row"><span>Tổng bài học</span><strong>${stats.totalLessons}</strong></div>
            <div class="project-stat-row"><span>Đã học</span><strong>${stats.learnedLessons}</strong></div>
            <div class="project-stat-row"><span>Còn lại</span><strong>${stats.remainingLessons}</strong></div>
          </div>
        </section>
        <section class="project-sidecard accent">
          <div class="project-sidecard-head">
            <span class="project-sidecard-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3l7 3v5c0 4.3-2.7 8.2-7 10-4.3-1.8-7-5.7-7-10V6l7-3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M9.6 12.3l1.7 1.7 3.4-3.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <h3 class="project-sidecard-title">Hỗ trợ cố vấn</h3>
          </div>
          <p class="project-sidecard-desc">Gặp khó khăn? Cố vấn của chúng tôi luôn sẵn sàng hỗ trợ bạn xử lý các vấn đề về mã nguồn và nghiệp vụ 24/7.</p>
          <a href="${buildProjectListUrl()}" class="project-sidecard-cta secondary">Đặt câu hỏi ngay</a>
        </section>
      </aside>

      <div class="project-stage-list"></div>
    </div>
  `;
}

function buildGroupSummary(group, availableCount) {
  const firstDescription = Array.isArray(group?.items)
    ? group.items.map((item) => item?.content).find(Boolean)
    : '';
  if (firstDescription) return firstDescription;
  return `${availableCount} bài học sẵn sàng trong giai đoạn này.`;
}

function getProjectIdFromPath(path) {
  const match = path.match(/\/project(\d+)\//);
  return match ? match[1] : '1';
}

function deriveIdFromPath(path) {
  return String(path.split('/').pop() || '').replace(/\.md$/i, '');
}
