import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildLessonUrl, getQueryParam, normalizeLessonPath } from './links.js';

const OPENAI_API_KEY = '';

let selectedPronunciationText = '';
let selectedPronunciationRow = null;

document.addEventListener('DOMContentLoaded', async () => {
  const markdownView = document.getElementById('markdown-view');
  const outlineView = document.getElementById('outline-view');
  const detailControls = document.getElementById('detail-controls');
  const renderer = createRenderers({ markdownView, outlineView, detailControls });
  initPrintButton();
  initPronunciationCheck();

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
  attachPronunciationToLesson(markdownView);
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
  const extra = buildPrintExtras(markdownView);
  if (extra) sheet.append(extra);
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

function initPronunciationCheck() {
  const recordToggle = document.getElementById('record-toggle');
  const playBtn = document.getElementById('play-recording');
  const audioPlayer = document.getElementById('recording-audio');
  const timer = document.getElementById('record-timer');
  const status = document.getElementById('pronunciation-status');
  const result = document.getElementById('pronunciation-result');
  const toggleBtn = document.getElementById('toggle-pronunciation');
  const panel = document.getElementById('pronunciation-panel');
  const clearBtn = document.getElementById('clear-selection');
  const keyInput = document.getElementById('openai-key');
  const saveKeyBtn = document.getElementById('save-key');

  if (!recordToggle || !playBtn || !audioPlayer || !timer || !status || !result || !keyInput || !saveKeyBtn) return;

  const savedKey = localStorage.getItem('openai_api_key');
  if (savedKey) keyInput.value = savedKey;

  saveKeyBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (key) {
      localStorage.setItem('openai_api_key', key);
      status.textContent = 'Đã lưu API key trong trình duyệt.';
    }
  });

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (selectedPronunciationRow) {
        selectedPronunciationRow.classList.remove('pronunciation-selected');
        selectedPronunciationRow = null;
      }
      selectedPronunciationText = '';
      updateSelectedLine('');
      recordToggle.disabled = true;
      playBtn.disabled = true;
      status.textContent = 'Hãy chọn 1 câu hội thoại trước khi ghi âm.';
    });
  }

  let mediaRecorder = null;
  let chunks = [];
  let startTime = null;
  let timerId = null;

  recordToggle.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordToggle.textContent = 'Bắt đầu ghi';
      recordToggle.disabled = false;
      status.textContent = 'Đang xử lý...';
      return;
    }
    if (!selectedPronunciationText) {
      status.textContent = 'Hãy chọn 1 câu hội thoại trước khi ghi âm.';
      return;
    }
    status.textContent = '';
    result.hidden = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        stopTimer(timer, timerId);
        timerId = null;
        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src);
        audioPlayer.src = URL.createObjectURL(blob);
        audioPlayer.hidden = false;
        playBtn.disabled = false;
        recordToggle.textContent = 'Bắt đầu ghi';
        await analyzePronunciation(blob, status, result);
      };
      mediaRecorder.start();
      startTime = Date.now();
      timerId = startTimer(timer, startTime);
      recordToggle.textContent = 'Dừng';
      status.textContent = 'Đang ghi âm...';
    } catch (error) {
      status.textContent = 'Không thể truy cập micro. Hãy kiểm tra quyền.';
      console.error(error);
    }
  });

  playBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return;
    audioPlayer.play().catch(() => {});
  });

  recordToggle.disabled = true;
  playBtn.disabled = true;
  status.textContent = 'Hãy chọn 1 câu hội thoại trước khi ghi âm.';
}

function startTimer(el, startTime) {
  const update = () => {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    el.textContent = `${mm}:${ss}`;
  };
  update();
  return setInterval(update, 500);
}

function stopTimer(el, id) {
  if (id) clearInterval(id);
  el.textContent = '00:00';
}

async function analyzePronunciation(audioBlob, statusEl, resultEl) {
  const apiKey = OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  if (!apiKey) {
    statusEl.textContent = 'Thiếu OpenAI API Key trong cấu hình.';
    return;
  }
  const expectedText = getPronunciationTargetText();
  if (!expectedText) {
    statusEl.textContent = 'Không tìm thấy nội dung tiếng Nhật để so sánh.';
    return;
  }

  try {
    statusEl.textContent = 'Đang chuyển giọng nói thành văn bản...';
    const transcript = await transcribeAudio(apiKey, audioBlob);
    statusEl.textContent = 'Đang chấm điểm phát âm...';
    const scores = await evaluatePronunciation(apiKey, expectedText, transcript);
    fillPronunciationResult(scores, transcript);
    resultEl.hidden = false;
    statusEl.textContent = 'Hoàn tất.';
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'Có lỗi khi đánh giá. Hãy thử lại.';
  }
}

function getExpectedPronunciationText() {
  const markdownView = document.getElementById('markdown-view');
  if (!markdownView) return '';
  const jpLines = Array.from(markdownView.querySelectorAll('.jp'))
    .map((el) => (el.textContent || '').trim())
    .filter(Boolean);
  return jpLines.join(' ');
}

function getPronunciationTargetText() {
  if (selectedPronunciationText) return selectedPronunciationText;
  return getExpectedPronunciationText();
}

async function transcribeAudio(apiKey, blob) {
  const form = new FormData();
  form.append('model', 'whisper-1');
  form.append('language', 'ja');
  form.append('file', blob, 'speech.webm');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });
  if (!response.ok) {
    throw new Error(`Transcription error ${response.status}`);
  }
  const data = await response.json();
  return data.text || '';
}

async function evaluatePronunciation(apiKey, expectedText, transcript) {
  const system = 'You are a Japanese pronunciation evaluator. Return only valid JSON.';
  const user = {
    expected: expectedText,
    transcript,
    request: 'Return JSON with keys: overall_score, pronunciation, intonation, speed, clarity (0-100). Provide short Vietnamese notes and tips as strings.'
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user) }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`Scoring error ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  return parseScoreJson(content);
}

function parseScoreJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return {};
      }
    }
    return {};
  }
}

function fillPronunciationResult(scores, transcript) {
  const overall = readScore(scores, ['overall_score', 'overall', 'total']);
  const pronunciation = readScore(scores, ['pronunciation', 'accuracy']);
  const intonation = readScore(scores, ['intonation']);
  const speed = readScore(scores, ['speed', 'pace']);
  const clarity = readScore(scores, ['clarity']);
  const notes = readText(scores, ['notes', 'comment', 'remarks']);
  const tips = readText(scores, ['tips', 'suggestions', 'improvement']);

  setText('score-overall', overall);
  setText('score-pronunciation', pronunciation);
  setText('score-intonation', intonation);
  setText('score-speed', speed);
  setText('score-clarity', clarity);
  setText('score-notes-text', notes || 'Chưa có nhận xét.');
  setText('score-tips-text', tips || 'Chưa có gợi ý.');
  setText('transcript-text', transcript || '');
  const summary = buildSummaryText(overall);
  setText('score-summary-text', summary.text);
  setSummaryTone(summary.tone);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value !== undefined && value !== null ? String(value) : '--';
}

function buildSummaryText(overallScore) {
  const score = Number(overallScore);
  if (!Number.isFinite(score)) {
    return { text: 'Chưa đủ dữ liệu để kết luận.', tone: 'neutral' };
  }
  if (score >= 90) {
    return { text: 'Trên 90 điểm — Rất tốt, phát âm gần như người bản xứ. Có thể chuyển câu tiếp theo.', tone: 'good' };
  }
  if (score >= 70) {
    return { text: '70–89 điểm — Khá tốt, chỉ cần chỉnh lại một số âm nhỏ. Có thể chuyển câu tiếp theo.', tone: 'ok' };
  }
  return { text: 'Dưới 70 điểm — Nên luyện lại phần phát âm hoặc ngữ điệu trước khi chuyển câu tiếp theo.', tone: 'warn' };
}

function setSummaryTone(tone) {
  const summary = document.querySelector('.score-summary');
  if (!summary) return;
  summary.classList.remove('summary-good', 'summary-ok', 'summary-warn');
  if (tone === 'good') summary.classList.add('summary-good');
  if (tone === 'ok') summary.classList.add('summary-ok');
  if (tone === 'warn') summary.classList.add('summary-warn');
}

function readScore(obj, keys) {
  if (!obj || typeof obj !== 'object') return '--';
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return '--';
}

function readText(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const value = obj[key];
    if (!value) continue;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(' ');
    if (typeof value === 'object') return JSON.stringify(value);
  }
  return '';
}

function attachPronunciationToLesson(markdownView) {
  const panel = document.getElementById('pronunciation-panel');
  if (!markdownView || !panel) return;
  if (!markdownView.contains(panel)) {
    const layout = markdownView.querySelector('.lesson-media-layout');
    if (layout && layout.parentNode) {
      layout.parentNode.insertBefore(panel, layout.nextSibling);
    } else {
      markdownView.append(panel);
    }
  }
  panel.classList.add('pronunciation-inline');
  if (markdownView.dataset.pronunciationReady === '1') return;
  markdownView.dataset.pronunciationReady = '1';

  markdownView.addEventListener('click', (event) => {
    const row = event.target.closest('.dialog-row');
    if (!row || !markdownView.contains(row)) return;
    const jp = row.querySelector('.jp');
    if (!jp) return;
    const text = (jp.textContent || '').trim();
    if (!text) return;
    if (selectedPronunciationRow) {
      selectedPronunciationRow.classList.remove('pronunciation-selected');
    }
    selectedPronunciationRow = row;
    row.classList.add('pronunciation-selected');
    selectedPronunciationText = text;
    updateSelectedLine(text);
    const recordToggle = document.getElementById('record-toggle');
    const playBtn = document.getElementById('play-recording');
    const status = document.getElementById('pronunciation-status');
    if (recordToggle) recordToggle.disabled = false;
    if (playBtn) playBtn.disabled = true;
    if (status) status.textContent = '';
  });
}

function updateSelectedLine(text) {
  const el = document.getElementById('selected-line');
  if (!el) return;
  el.textContent = text || '';
}

function buildPrintExtras(markdownView) {
  if (!markdownView) return null;
  const vocabList = markdownView.querySelector('.vocab-list');
  const phraseList = markdownView.querySelector('.phrase-list');
  if (!vocabList && !phraseList) return null;

  const wrapper = document.createElement('section');
  wrapper.className = 'print-extra';

  if (vocabList) {
    const block = document.createElement('div');
    block.className = 'print-extra-block';
    const title = document.createElement('div');
    title.className = 'print-extra-title';
    title.textContent = 'Từ vựng';
    const list = vocabList.cloneNode(true);
    stripVietnamese(list);
    block.append(title, list);
    wrapper.append(block);
  }

  if (phraseList) {
    const block = document.createElement('div');
    block.className = 'print-extra-block';
    const title = document.createElement('div');
    title.className = 'print-extra-title';
    title.textContent = 'Mẫu câu';
    const list = phraseList.cloneNode(true);
    stripVietnamese(list);
    block.append(title, list);
    wrapper.append(block);
  }

  return wrapper;
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
    if (titleEl) titleEl.textContent = '';
    return;
  }
  button.classList.remove('disabled');
  button.removeAttribute('aria-disabled');
  button.setAttribute('href', buildLessonUrl({ path: target.path }));
  button.tabIndex = 0;
  if (titleEl) titleEl.textContent = target.title || '';
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
