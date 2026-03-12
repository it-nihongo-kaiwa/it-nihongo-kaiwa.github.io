import { loadProjectsData } from './data.js';
import { createRenderers } from './renderers.js';
import { buildLessonUrl, buildProjectUrl, getQueryParam, normalizeLessonPath } from './links.js';
import { groupClass, groupIconSVG } from './grouping.js';
import { escapeHtml } from './utils.js';

const OPENAI_API_KEY = '';

let selectedPronunciationText = '';
let selectedPronunciationRow = null;
let allowNextSentence = false;

document.addEventListener('DOMContentLoaded', async () => {
  const markdownView = document.getElementById('markdown-view');
  const outlineView = document.getElementById('outline-view');
  const detailControls = document.getElementById('detail-controls');
  const renderer = createRenderers({ markdownView, outlineView, detailControls });
  initPrintButton();
  initPronunciationCheckV2();

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
  const pageTitle = document.title || 'Bài học';
  return pageTitle.replace(/^IT Nihongo Kaiwa\s*[・-]\s*/i, '').trim() || 'Bài học';
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

function initPronunciationCheckV2() {
  const recordToggle = document.getElementById('record-toggle');
  const playBtn = document.getElementById('play-recording');
  const nextBtn = document.getElementById('next-sentence');
  const audioPlayer = document.getElementById('recording-audio');
  const timer = document.getElementById('record-timer');
  const status = document.getElementById('pronunciation-status');
  const result = document.getElementById('pronunciation-result');
  const toggleBtn = document.getElementById('toggle-pronunciation');
  const panel = document.getElementById('pronunciation-panel');
  const clearBtn = document.getElementById('clear-selection');
  const keyInput = document.getElementById('openai-key');
  const saveKeyBtn = document.getElementById('save-key');

  if (!recordToggle || !playBtn || !nextBtn || !audioPlayer || !timer || !status || !result || !panel || !keyInput || !saveKeyBtn) return;

  let mediaRecorder = null;
  let chunks = [];
  let timerId = null;

  const subtitle = panel.querySelector('.pronunciation-subtitle');
  if (subtitle) {
    subtitle.textContent = 'Nhập API Key để sử dụng tính năng đánh giá phát âm AI. Bấm vào nút Micro ở từng câu thoại để bắt đầu ghi âm.';
  }

  const savedKey = localStorage.getItem('openai_api_key');
  if (savedKey) keyInput.value = savedKey;

  recordToggle.textContent = 'Ghi âm';
  playBtn.textContent = 'Nghe lại';
  updateSelectedLine('');

  const syncButtons = () => {
    const hasSelection = Boolean(selectedPronunciationText);
    const hasRecording = Boolean(audioPlayer.src);
    const hasNext = hasNextPronunciationRow();
    const isRecording = mediaRecorder && mediaRecorder.state === 'recording';
    
    recordToggle.disabled = !hasSelection;
    playBtn.disabled = !hasRecording || isRecording;
    nextBtn.disabled = !allowNextSentence || !hasSelection || !hasNext;
    if (clearBtn) clearBtn.disabled = !hasSelection;
  };

  const setDefaultMessage = () => {
    setPronunciationMessage(
      localStorage.getItem('openai_api_key')
        ? 'Chọn một câu rồi bấm mic để bắt đầu luyện phát âm.'
        : 'Thêm OpenAI API key rồi chọn một câu để bắt đầu.',
      'muted'
    );
  };

  saveKeyBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) return;
    localStorage.setItem('openai_api_key', key);
    setPronunciationMessage('Đã lưu API key trong trình duyệt.', 'success');
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (selectedPronunciationRow) {
        selectedPronunciationRow.classList.remove('pronunciation-selected');
        setRowScoreState(selectedPronunciationRow, 'idle');
      }
      selectedPronunciationRow = null;
      selectedPronunciationText = '';
      allowNextSentence = false;
      updateSelectedLine('');
      result.hidden = true;
      if (audioPlayer.src) {
        URL.revokeObjectURL(audioPlayer.src);
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
      }
      audioPlayer.hidden = true;
      setDefaultMessage();
      syncButtons();
    });
  }

  playBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return;
    audioPlayer.play().catch(() => {});
  });

  recordToggle.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordToggle.textContent = 'Ghi âm';
      return;
    }

    if (!selectedPronunciationText) {
      setPronunciationMessage('Chọn một câu trong đoạn hội thoại trước đã.', 'muted');
      return;
    }

    revealPronunciationPanel();
    result.hidden = true;
    setPronunciationMessage('Đang chuẩn bị ghi âm...', 'muted');
    syncButtons();

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
        setRowMicState(selectedPronunciationRow, 'processing');
        setRowScoreState(selectedPronunciationRow, 'processing', '...');

        const blob = new Blob(chunks, { type: 'audio/webm' });
        if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src);
        audioPlayer.src = URL.createObjectURL(blob);
        audioPlayer.hidden = false;
        recordToggle.textContent = 'Ghi âm';
        syncButtons();

        await analyzePronunciationV2(blob, result, {
          onProcessing: () => {
            setPronunciationMessage('Đang chấm phát âm và tạo nhận xét chi tiết...', 'processing');
            setRowScoreState(selectedPronunciationRow, 'processing');
          },
          onSuccess: () => {
            setPronunciationMessage('Đã chấm xong. Kết quả hiện ngay bên dưới.', 'success');
            setRowMicState(selectedPronunciationRow, 'idle');
            syncButtons();
            focusPronunciationResult();
          },
          onError: (message) => {
            setPronunciationMessage(message, 'error');
            setRowScoreState(selectedPronunciationRow, 'error', 'Lỗi');
            setRowMicState(selectedPronunciationRow, 'idle');
            syncButtons();
          }
        });
      };

      mediaRecorder.start();
      timerId = startTimer(timer, Date.now());
      recordToggle.textContent = 'Dừng';
      setPronunciationMessage('Đang ghi âm. Đọc theo câu mẫu rồi bấm lại để dừng.', 'recording');
      setRowScoreState(selectedPronunciationRow, 'recording');
      setRowMicState(selectedPronunciationRow, 'recording');
      syncButtons();
    } catch (error) {
      console.error(error);
      setPronunciationMessage('Không thể truy cập micro. Hãy kiểm tra quyền.', 'error');
      setRowScoreState(selectedPronunciationRow, 'error', 'Lỗi');
      setRowMicState(selectedPronunciationRow, 'idle');
      syncButtons();
    }
  });

  setDefaultMessage();
  syncButtons();
}

function startTimer(el, startTime) {
  const update = () => {
    const diff = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    if (el) el.textContent = `${mm}:${ss}`;
    if (selectedPronunciationRow && selectedPronunciationRow.dataset.scoreState === 'recording') {
      const badge = selectedPronunciationRow.querySelector('.dialog-score-badge');
      if (badge) badge.textContent = `${mm}:${ss}`;
    }
  };
  update();
  return setInterval(update, 500);
}

function stopTimer(el, id) {
  if (id) clearInterval(id);
  if (el) el.textContent = '00:00';
}

function setPronunciationMessage(message, tone = 'muted') {
  const status = document.getElementById('pronunciation-status');
  if (!status) return;
  status.textContent = message || '';
  status.dataset.tone = tone;
}

function updateSelectedLine(text) {
  const selectedLine = document.getElementById('selected-line');
  if (!selectedLine) return;
  selectedLine.textContent = text || 'Hãy chọn 1 câu hội thoại.';
}

function revealPronunciationPanel() {
  const panel = document.getElementById('pronunciation-panel');
  if (panel) panel.classList.remove('collapsed', 'pronunciation-hidden-dock');
}

function focusPronunciationResult() {
  const result = document.getElementById('pronunciation-result');
  if (result && !result.hidden) result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function analyzePronunciationV2(audioBlob, resultEl, callbacks = {}) {
  const apiKey = OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  if (!apiKey) {
    callbacks.onError?.('Thiếu OpenAI API key.');
    return;
  }

  const expectedText = getPronunciationTargetText();
  if (!expectedText) {
    callbacks.onError?.('Không tìm thấy câu tiếng Nhật để so sánh.');
    return;
  }

  try {
    setPronunciationMessage('Đang chuyển giọng nói thành văn bản...', 'processing');
    const transcription = await transcribeAudio(apiKey, audioBlob);
    const transcriptText = transcription.text || '';
    const audioMetrics = await analyzeAudioMetrics(audioBlob);
    const localScores = scorePaceFluency(audioMetrics, transcriptText);
    callbacks.onProcessing?.();
    const scores = await evaluatePronunciationV2(apiKey, expectedText, transcriptText, transcription, audioMetrics);
    if (localScores.pace !== null) scores.pace = localScores.pace;
    if (localScores.fluency !== null) scores.fluency = localScores.fluency;
    fillPronunciationResultV2(scores, transcriptText);
    resultEl.hidden = false;
    callbacks.onSuccess?.();
  } catch (error) {
    console.error(error);
    callbacks.onError?.('Có lỗi khi đánh giá. Hãy thử lại.');
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
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  form.append('timestamp_granularities[]', 'word');
  form.append('file', blob, 'speech.webm');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!response.ok) throw new Error(`Transcription error ${response.status}`);
  return await response.json();
}

async function analyzeAudioMetrics(blob) {
  return new Promise((resolve) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(reader.result);
        const duration = audioBuffer.duration;
        const channelData = audioBuffer.getChannelData(0);
        let rmsSum = 0;
        for (let i = 0; i < channelData.length; i++) rmsSum += channelData[i] * channelData[i];
        const rms = Math.sqrt(rmsSum / channelData.length);
        let pauses = 0;
        let inPause = false;
        const pauseThreshold = 0.01;
        const sliceSize = Math.floor(audioBuffer.sampleRate * 0.1);
        let pauseDuration = 0;
        for (let i = 0; i < channelData.length; i += sliceSize) {
          let sliceSum = 0;
          const end = Math.min(i + sliceSize, channelData.length);
          for (let j = i; j < end; j++) sliceSum += Math.abs(channelData[j]);
          const avg = sliceSum / (end - i);
          if (avg < pauseThreshold) {
            if (!inPause) { inPause = true; pauses++; }
            pauseDuration += 0.1;
          } else { inPause = false; }
        }
        resolve({ duration, rms, pauseRatio: pauseDuration / duration, pauses });
      } catch {
        resolve({ duration: 0, rms: 0, pauseRatio: 0, pauses: 0 });
      } finally {
        audioContext.close();
      }
    };
    reader.readAsArrayBuffer(blob);
  });
}

function scorePaceFluency(metrics, transcript) {
  if (!metrics || metrics.duration === 0) return { pace: 5, fluency: 5 };
  const wordCount = (transcript || '').trim().split(/\s+/).length;
  const wpm = (wordCount / metrics.duration) * 60;
  let paceScore = 8;
  if (wpm < 80) paceScore = 6;
  if (wpm < 50) paceScore = 4;
  if (wpm > 200) paceScore = 6;
  let fluencyScore = 9;
  const pauseRatio = metrics.pauseRatio || 0;
  if (pauseRatio > 0.4) fluencyScore = 6;
  if (pauseRatio > 0.6) fluencyScore = 4;
  return { pace: paceScore, fluency: fluencyScore };
}

async function evaluatePronunciation(apiKey, expected, transcript, transcription, metrics) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Bạn là giáo viên phát âm tiếng Nhật. Chấm điểm 0-10 từng mục và tổng 0-100. Trả về JSON: {overall, notes, tips}' },
        { role: 'user', content: `Expected: ${expected}\nTranscript: ${transcript}` }
      ],
      response_format: { type: 'json_object' }
    })
  });
  if (!response.ok) throw new Error('Evaluation error');
  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return {
    total_score: result.overall,
    notes: result.notes,
    tips: result.tips
  };
}

function fillPronunciationResult(scores, transcript) {
  const overall = resolveOverallScore(scores);
  const notes = readText(scores, ['notes', 'comment', 'remarks']);
  const tips = readText(scores, ['tips', 'suggestions', 'improvement']);

  const numeric = Math.round(Number(overall));
  setText('score-overall', isNaN(numeric) ? '--' : numeric);
  setText('transcript-text', transcript ? `"${transcript}"` : '...');

  const summary = buildSummaryText(overall);
  setText('score-summary-text', summary.text);
  setSummaryTone(summary.tone);

  setText('score-notes-text', notes || 'Phát âm tốt.');
  setText('score-tips-text', tips || 'Tiếp tục phát huy!');

  updateNextSentenceState(summary.allowNext);
  applyScoreToSelectedRow(overall, summary.tone);
}

async function evaluatePronunciationV2(apiKey, expected, transcript, transcription, metrics) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Ban la giao vien phat am tieng Nhat. Cham pronunciation, intonation, pace, fluency, accuracy theo thang 0-10. Them overall theo thang 0-100. Tra ve duy nhat JSON dang {overall, pronunciation, intonation, pace, fluency, accuracy, notes, tips}. notes va tips phai la chuoi ngan gon.'
        },
        { role: 'user', content: `Expected: ${expected}\nTranscript: ${transcript}` }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) throw new Error('Evaluation error');
  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  return {
    total_score: result.overall,
    pronunciation: result.pronunciation,
    intonation: result.intonation,
    pace: result.pace,
    fluency: result.fluency,
    accuracy: result.accuracy,
    notes: result.notes,
    tips: result.tips
  };
}

function fillPronunciationResultV2(scores, transcript) {
  const overall = resolveOverallScore(scores);
  const notes = sanitizeFeedbackText(readText(scores, ['notes', 'comment', 'remarks']));
  const tips = sanitizeFeedbackText(readText(scores, ['tips', 'suggestions', 'improvement']));

  const numeric = Math.round(Number(overall));
  setText('score-overall', Number.isFinite(numeric) ? numeric : '--');
  setText('transcript-text', transcript ? `"${transcript}"` : '...');
  renderScoreBreakdown(scores);

  const summary = buildSummaryText(overall);
  setText('score-summary-text', summary.text);
  setSummaryTone(summary.tone);

  setText('score-notes-text', notes || 'Phat am tam on, can luyen them.');
  setText('score-tips-text', tips || 'Thu doc cham hon va nhan ro tu khoa chinh.');

  updateNextSentenceState(summary.allowNext);
  applyScoreToSelectedRow(overall, summary.tone);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '--';
}

function buildSummaryText(overallScore) {
  const score = Number(overallScore);
  if (!Number.isFinite(score)) return { text: '...', tone: 'neutral', allowNext: false };
  if (score >= 90) return { text: 'Xuất sắc!', tone: 'good', allowNext: true };
  if (score >= 70) return { text: 'Khá tốt.', tone: 'ok', allowNext: true };
  return { text: 'Cần luyện thêm.', tone: 'warn', allowNext: false };
}

function setSummaryTone(tone) {
  const result = document.getElementById('pronunciation-result');
  if (!result) return;
  result.classList.remove('summary-good', 'summary-ok', 'summary-warn');
  if (tone === 'good') result.classList.add('summary-good');
  if (tone === 'ok') result.classList.add('summary-ok');
  if (tone === 'warn') result.classList.add('summary-warn');
}

function updateNextSentenceState(allowNext) {
  allowNextSentence = Boolean(allowNext);
  const nextBtn = document.getElementById('next-sentence');
  if (nextBtn) nextBtn.disabled = !allowNextSentence || !selectedPronunciationText || !hasNextPronunciationRow();
}

function readScore(obj, keys) {
  if (!obj) return 0;
  for (const k of keys) if (obj[k] !== undefined) return obj[k];
  return 0;
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.]/g, '');
    if (!cleaned) return NaN;
    return Number(cleaned);
  }
  return NaN;
}

function normalizeTenPointScore(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(10, Math.round(numeric > 10 ? numeric / 10 : numeric)));
}

function normalizeOverallScore(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric <= 10 ? numeric * 10 : numeric)));
}

function resolveOverallScore(scores) {
  const breakdown = collectScoreBreakdown(scores);
  if (breakdown.length) {
    const total = breakdown.reduce((sum, item) => sum + item.value, 0);
    return Math.round((total / breakdown.length) * 10);
  }
  return normalizeOverallScore(readScore(scores, ['total_score', 'overall_score', 'overall', 'total']));
}

function readText(obj, keys) {
  if (!obj) return '';
  for (const k of keys) {
    const value = obj[k];
    if (!value) continue;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter(Boolean).join(' ');
    if (typeof value === 'object') {
      return Object.values(value)
        .flatMap((item) => Array.isArray(item) ? item : [item])
        .filter(Boolean)
        .join(' ');
    }
    return String(value);
  }
  return '';
}

function collectScoreBreakdown(scores) {
  if (!scores || typeof scores !== 'object') return [];

  const scoreMap = [
    { label: 'Phát âm', keys: ['pronunciation', 'pronunciation_score', 'sound'] },
    { label: 'Ngữ điệu', keys: ['intonation', 'intonation_score'] },
    { label: 'Tốc độ', keys: ['pace', 'pace_score', 'speed'] },
    { label: 'Trôi chảy', keys: ['fluency', 'fluency_score'] },
    { label: 'Chính xác', keys: ['accuracy', 'accuracy_score'] }
  ];

  return scoreMap
    .map(({ label, keys }) => {
      const value = normalizeTenPointScore(readScore(scores, keys));
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        label,
        value,
        mappedOverall: value * 10
      };
    })
    .filter(Boolean);
}

function renderScoreBreakdown(scores) {
  const breakdown = document.getElementById('score-breakdown');
  if (!breakdown) return;

  const items = collectScoreBreakdown(scores);
  if (!items.length) {
    breakdown.hidden = true;
    breakdown.innerHTML = '';
    return;
  }

  breakdown.innerHTML = items
    .map(
      ({ label, value, mappedOverall }) => `
        <div class="score-pill">
          <span class="score-pill-label">${label}</span>
          <div class="score-pill-main">
            <span class="score-pill-value">${mappedOverall}</span>
          </div>
        </div>
      `
    )
    .join('');
  breakdown.hidden = false;
}

function sanitizeFeedbackText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ');
  if (/^[\d\s./,-]+$/.test(compact)) return '';
  return compact;
}

function attachPronunciationToLesson(markdownView) {
  const panel = document.getElementById('pronunciation-panel');
  if (!markdownView || !panel) return;
  panel.classList.add('pronunciation-inline');
  panel.classList.remove('pronunciation-hidden-dock', 'collapsed');
  
  const layout = markdownView.querySelector('.lesson-media-layout, .lesson-transcript-section');
  if (layout && layout.parentNode) {
    layout.insertAdjacentElement('afterend', panel);
  }

  enhanceTranscriptRows(markdownView);
  if (markdownView.dataset.pronunciationReady === '1') return;
  markdownView.dataset.pronunciationReady = '1';

  markdownView.addEventListener('click', (event) => {
     // Toggle inline result when clicking the row score badge
    const badge = event.target.closest('.dialog-score-badge');
    if (badge) {
      const row = badge.closest('.dialog-row');
      const result = document.getElementById('pronunciation-result');
      if (row === selectedPronunciationRow && result && hasPronunciationResult()) {
        result.hidden = !result.hidden;
        if (!result.hidden) focusPronunciationResult();
        return;
      }
    }

    const micButton = event.target.closest('.dialog-pron-btn');
    if (micButton) {
      event.preventDefault();
      event.stopPropagation();
      const row = micButton.closest('.dialog-row');
      if (row?.dataset.micState === 'processing') return;
      const jp = row?.querySelector('.jp');
      if (row && jp) {
        selectPronunciationRow(row, (jp.textContent || '').trim());
        const recordBtn = document.getElementById('record-toggle');
        if (recordBtn) {
          recordBtn.disabled = false;
          recordBtn.click();
        }
      }
    }
  });
}

function enhanceTranscriptRows(root) {
  root.querySelectorAll('.dialog-row').forEach((row) => {
    if (!row.querySelector('.dialog-speaker-badge')) {
      const role = row.classList.contains('role-kh')
        ? 'KH'
        : row.classList.contains('role-brse')
          ? 'BR'
          : row.classList.contains('role-pm')
            ? 'PM'
            : row.classList.contains('role-qa')
              ? 'QA'
              : row.classList.contains('role-dev')
                ? 'DEV'
                : '...';
      const badge = document.createElement('div');
      badge.className = 'dialog-speaker-badge';
      badge.textContent = role;
      row.insertBefore(badge, row.firstChild);
    }
    if (row.querySelector('.dialog-row-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'dialog-row-controls';
    controls.innerHTML = `
      <div class="dialog-score-badge is-idle" title="Điểm phát âm">--</div>
      <button class="dialog-pron-btn" title="Luyện phát âm câu này" aria-label="Ghi âm câu này">
        <span class="dialog-pron-icon dialog-pron-icon-mic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </span>
        <span class="dialog-pron-icon dialog-pron-icon-stop" aria-hidden="true"></span>
        <span class="dialog-pron-spinner" aria-hidden="true"></span>
      </button>
    `;
    row.dataset.micState = 'idle';
    row.appendChild(controls);
  });
}

function selectPronunciationRow(row, text) {
  if (selectedPronunciationRow) selectedPronunciationRow.classList.remove('pronunciation-selected');
  selectedPronunciationRow = row;
  selectedPronunciationText = text;
  row.classList.add('pronunciation-selected');
  updateSelectedLine(text);
  
  const result = document.getElementById('pronunciation-result');
  if (result) {
    result.hidden = true;
    row.insertAdjacentElement('afterend', result);
  }
}

function hasPronunciationResult() {
  const score = document.getElementById('score-overall');
  if (!score) return false;
  const value = (score.textContent || '').trim();
  return value !== '' && value !== '--';
}

function applyScoreToSelectedRow(score, tone) {
  if (!selectedPronunciationRow) return;
  setRowScoreState(selectedPronunciationRow, tone, score);
}

function setRowScoreState(row, state, value) {
  if (!row) return;
  const badge = row.querySelector('.dialog-score-badge');
  if (!badge) return;
  row.dataset.scoreState = state;
  badge.textContent = value ?? '--';
  badge.classList.remove('is-idle', 'is-good', 'is-ok', 'is-warn', 'is-error', 'is-recording', 'is-processing');
  if (!state || state === 'idle') {
    badge.classList.add('is-idle');
    return;
  }
  if (state === 'good' || state === 'ok' || state === 'warn' || state === 'error') {
    badge.classList.add(`is-${state}`);
    return;
  }
  if (state === 'recording' || state === 'processing') badge.classList.add(`is-${state}`);
}

function setRowMicState(row, state) {
  if (!row) return;
  const button = row.querySelector('.dialog-pron-btn');
  if (!button) return;
  row.dataset.micState = state || 'idle';
  button.classList.remove('is-recording', 'is-processing');
  button.disabled = false;
  button.setAttribute('aria-label', 'Ghi âm câu này');
  button.title = 'Luyện phát âm câu này';
  if (state === 'recording') {
    button.classList.add('is-recording');
    button.setAttribute('aria-label', 'Dừng ghi âm');
    button.title = 'Bấm lại để dừng ghi âm';
    return;
  }
  if (state === 'processing') {
    button.classList.add('is-processing');
    button.disabled = true;
    button.setAttribute('aria-label', 'Đang chấm điểm');
    button.title = 'Đang chấm điểm';
  }
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
    if (titleEl) titleEl.textContent = '';
    return;
  }
  button.classList.remove('disabled');
  button.setAttribute('href', buildLessonUrl({ path: target.path }));
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

function hasNextPronunciationRow() {
  const markdownView = document.getElementById('markdown-view');
  if (!markdownView || !selectedPronunciationRow) return false;
  const rows = Array.from(markdownView.querySelectorAll('.dialog-row'));
  const index = rows.indexOf(selectedPronunciationRow);
  return index !== -1 && index < rows.length - 1;
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
