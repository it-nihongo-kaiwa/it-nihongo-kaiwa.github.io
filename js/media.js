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
    if (!firstDialog) {
      root.insertBefore(fig, root.firstChild);
      return;
    }

    const transcriptNodes = collectTranscriptNodes(firstDialog);
    const layout = createMediaLayout(firstDialog);
    const { wrapper, mediaColumn, transcriptColumn } = layout;
    mediaColumn.innerHTML = '';
    mediaColumn.appendChild(fig);
    transcriptNodes.forEach((node) => {
      transcriptColumn.appendChild(node);
    });
    const controls = attachTranscriptSync(transcriptColumn, video);
    insertTranscriptToolbar(transcriptColumn, controls);
    moveLegendOutside(wrapper, transcriptColumn);
  } catch (error) {
    console.error('Lesson video error', error);
  }
}

function collectTranscriptNodes(firstDialog) {
  const nodes = [];
  let current = firstDialog;
  while (current) {
    if (isDialogElement(current) || isLegendElement(current)) {
      nodes.push(current);
      current = current.nextSibling;
      continue;
    }
    if (isWhitespaceNode(current)) {
      const next = current.nextSibling;
      current.remove();
      current = next;
      continue;
    }
    break;
  }
  return nodes;
}

function createMediaLayout(firstDialog) {
  const layout = document.createElement('div');
  layout.className = 'lesson-media-layout';

  const mediaColumn = document.createElement('div');
  mediaColumn.className = 'lesson-media';

  const transcriptWrap = document.createElement('div');
  transcriptWrap.className = 'lesson-transcript-wrap';

  const transcriptColumn = document.createElement('div');
  transcriptColumn.className = 'lesson-transcript';

  transcriptWrap.appendChild(transcriptColumn);
  layout.append(mediaColumn, transcriptWrap);
  firstDialog.parentNode.insertBefore(layout, firstDialog);

  return { wrapper: layout, mediaColumn, transcriptColumn, transcriptWrap };
}

function attachTranscriptSync(transcript, video) {
  if (!transcript || !video) return;

  let activeRow = null;
  const timedRows = Array.from(transcript.querySelectorAll('.dialog-row[data-time]'));
  let segmentEndTime = null;
  let segmentActive = false;
  let playMode = 'single';

  const setActiveRow = (row) => {
    if (activeRow === row) return;
    if (activeRow) activeRow.classList.remove('active');
    activeRow = row || null;
    if (activeRow) {
      activeRow.classList.add('active');
      ensureRowVisible(activeRow, transcript);
    }
  };

  const clearSegment = () => {
    segmentActive = false;
    segmentEndTime = null;
  };

  transcript.addEventListener('click', (event) => {
    const row = event.target.closest('.dialog-row[data-time]');
    if (!row) return;
    const seconds = Number(row.dataset.time);
    if (!Number.isFinite(seconds)) return;
    video.currentTime = seconds;
    if (playMode === 'single') {
      const nextTime = getNextRowTime(row, timedRows, video.duration);
      if (Number.isFinite(nextTime)) {
        segmentEndTime = Math.max(nextTime - 0.35, seconds + 0.1);
        segmentActive = true;
      } else {
        segmentEndTime = null;
        segmentActive = false;
      }
    } else {
      clearSegment();
    }
    video.play();
    setActiveRow(row);
  });

  if (timedRows.length) {
    video.addEventListener('timeupdate', () => {
      const current = video.currentTime;
      if (segmentActive && Number.isFinite(segmentEndTime) && current >= segmentEndTime - 0.05) {
        video.pause();
        video.currentTime = segmentEndTime;
        clearSegment();
        return;
      }
      if (segmentActive) return;
      let candidate = null;
      for (let i = timedRows.length - 1; i >= 0; i--) {
        const row = timedRows[i];
        const time = Number(row.dataset.time);
        if (!Number.isFinite(time)) continue;
        if (current >= time - 0.25) {
          candidate = row;
          break;
        }
      }
      if (candidate) setActiveRow(candidate);
    });
  }

  const setMode = (mode) => {
    playMode = mode === 'all' ? 'all' : 'single';
    if (playMode === 'all') clearSegment();
  };

  return { clearSegment, setMode };
}

function ensureRowVisible(row, container) {
  if (!container || container.scrollHeight <= container.clientHeight) return;
  const rowRect = row.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  if (rowRect.top < containerRect.top) {
    container.scrollTop -= (containerRect.top - rowRect.top) + 12;
  } else if (rowRect.bottom > containerRect.bottom) {
    container.scrollTop += (rowRect.bottom - containerRect.bottom) + 12;
  }
}

function isDialogElement(node) {
  return node && node.nodeType === Node.ELEMENT_NODE && node.classList.contains('dialog');
}

function isLegendElement(node) {
  return node && node.nodeType === Node.ELEMENT_NODE && node.classList.contains('dialog-legend');
}

function isWhitespaceNode(node) {
  return node && node.nodeType === Node.TEXT_NODE && !node.textContent.trim();
}

function moveLegendOutside(wrapper, transcriptColumn) {
  if (!wrapper || !transcriptColumn) return;
  const legends = Array.from(transcriptColumn.querySelectorAll('.dialog-legend'));
  if (!legends.length) return;
  const legendContainer = document.createElement('div');
  legendContainer.className = 'lesson-legend';
  legends.forEach((legend) => legendContainer.appendChild(legend));
  transcriptColumn.parentNode.insertBefore(legendContainer, transcriptColumn.nextSibling);
}

function getNextRowTime(row, rows, duration) {
  const index = rows.indexOf(row);
  if (index === -1) return null;
  for (let i = index + 1; i < rows.length; i++) {
    const time = Number(rows[i].dataset.time);
    if (Number.isFinite(time)) return time;
  }
  if (Number.isFinite(duration) && duration > 0) return duration;
  return null;
}

function insertTranscriptToolbar(transcriptColumn, controls) {
  if (!transcriptColumn || !controls) return;
  const toolbar = document.createElement('div');
  toolbar.className = 'transcript-toolbar';
  toolbar.innerHTML = `
    <span class="toolbar-label">Chế độ phát: <strong id="play-mode-label">Phát câu đang chọn</strong></span>
    <div class="toolbar-actions">
      <button type="button" class="toolbar-btn active" data-mode="single">Phát câu đang chọn</button>
      <button type="button" class="toolbar-btn" data-mode="all">Phát toàn bài</button>
    </div>
  `;
  const label = toolbar.querySelector('#play-mode-label');
  const buttons = Array.from(toolbar.querySelectorAll('.toolbar-btn'));
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode === 'all' ? 'all' : 'single';
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      if (label) label.textContent = mode === 'all' ? 'Phát toàn bài' : 'Phát câu đang chọn';
      controls.setMode(mode);
    });
  });
  transcriptColumn.parentNode.insertBefore(toolbar, transcriptColumn);
}
