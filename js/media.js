async function resourceExists(url) {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    if (head.ok) return true;
  } catch {
    // ignore
  }
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-cache' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function insertLessonVideo(root, mdPath) {
  if (!root || !mdPath) return;
  try {
    const base = (mdPath.split('/').pop() || '').replace(/\.md$/i, '');
    let projectPath = 'video/';
    const projectMatch = mdPath.match(/\/project(\d+)\//);
    if (projectMatch) {
      projectPath = `video/project${projectMatch[1]}/`;
    }

    const candidates = [
      `${projectPath}${base}.mp4`,
      `video/${base}.mp4`,
      `videos/${base}.mp4`,
      mdPath.replace(/\.md$/i, '.mp4')
    ];

    let mp4 = null;
    for (const url of candidates) {
      if (await resourceExists(url)) {
        mp4 = url;
        break;
      }
    }
    if (!mp4) return;

    const fig = document.createElement('figure');
    fig.className = 'lesson-video';
    fig.innerHTML = '<video class="lesson-video-player" controls preload="metadata" playsinline></video>';
    const video = fig.querySelector('video');
    if (video) video.src = mp4;

    const firstDialog = root.querySelector('.dialog');
    if (firstDialog && firstDialog.parentNode) {
      firstDialog.parentNode.insertBefore(fig, firstDialog);
    } else {
      root.insertBefore(fig, root.firstChild);
    }
  } catch {
    // ignore errors to keep lesson rendering
  }
}
