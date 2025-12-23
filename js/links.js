export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function buildIndexUrl() {
  return 'index.html';
}

export function buildProjectUrl(projectId) {
  return `project.html?id=${encodeURIComponent(projectId)}`;
}

export function buildLessonUrl({ path, projectId, lessonId } = {}) {
  if (path) return `detail.html?path=${encodeURIComponent(path)}`;
  if (projectId && lessonId) {
    return `detail.html?project=${encodeURIComponent(projectId)}&lesson=${encodeURIComponent(lessonId)}`;
  }
  return 'detail.html';
}

export function normalizeLessonPath({ path, projectId, lessonId } = {}) {
  if (path && !path.includes('..')) return path;
  if (projectId && lessonId) return `data/project${projectId}/${lessonId}.md`;
  return null;
}

export function buildAbsoluteUrl(relativeUrl) {
  try {
    return new URL(relativeUrl, window.location.href).toString();
  } catch {
    return relativeUrl;
  }
}
