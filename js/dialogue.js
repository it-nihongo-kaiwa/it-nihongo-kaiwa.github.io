import { escapeHtml } from './utils.js';

export function preprocessMarkdown(src) {
  const lines = src.split(/\r?\n/);
  const out = [];
  let inDialog = false;
  let left = true;

  const closeDialog = () => {
    if (!inDialog) return;
    out.push('</div>');
    out.push('<div class="dialog-legend"><span class="legend-item"><span class="chip chip-kh"></span>KH (Khach hang)</span><span class="legend-item"><span class="chip chip-brse"></span>BrSE</span></div>');
    inDialog = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dialogMatch = line.match(/^\s*\*\*([^*]+?):\*\*\s*(.+)$/);
    if (dialogMatch) {
      const name = dialogMatch[1].trim();
      const jp = dialogMatch[2].trim();
      let vn = '';
      if (i + 1 < lines.length) {
        const vnMatch = lines[i + 1].match(/^\s*\*(.+)\*\s*$/);
        if (vnMatch) {
          vn = vnMatch[1].trim();
          i++;
        }
      }
      if (!inDialog) {
        out.push('<div class="dialog">');
        inDialog = true;
      }
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let role = 'other';
      if (key.includes('brse')) role = 'brse';
      else if (key === 'kh' || key.includes('client') || key.includes('khach')) role = 'kh';
      else if (key.includes('pm')) role = 'pm';
      else if (key.includes('qa')) role = 'qa';
      else if (key.includes('dev') || key.includes('engineer')) role = 'dev';
      let side = left ? 'left' : 'right';
      if (role === 'kh') side = 'left';
      if (role === 'brse') side = 'right';
      out.push(
        `<div class="dialog-row ${side} role-${role}">` +
          '<div class="bubble">' +
            `<div class="jp" lang="ja">${escapeHtml(jp)}</div>` +
            (vn ? `<div class="vn" lang="vi">${escapeHtml(vn)}</div>` : '') +
          '</div>' +
        '</div>'
      );
      if (role === 'other' || role === 'pm' || role === 'qa' || role === 'dev') left = !left;
      continue;
    }

    const jpLine = line.match(/^\s*JP:\s*(.*)$/);
    if (jpLine) {
      if (!inDialog) {
        out.push('<div class="dialog">');
        inDialog = true;
      }
      out.push(`<div class="dialog-row left"><div class="bubble"><div class="jp" lang="ja">${escapeHtml(jpLine[1])}</div></div></div>`);
      left = false;
      continue;
    }

    const vnLine = line.match(/^\s*VN:\s*(.*)$/);
    if (vnLine) {
      if (!inDialog) {
        out.push('<div class="dialog">');
        inDialog = true;
      }
      out.push(`<div class="dialog-row right"><div class="bubble"><div class="vn" lang="vi">${escapeHtml(vnLine[1])}</div></div></div>`);
      left = true;
      continue;
    }

    if (line.trim().length > 0) closeDialog();
    out.push(line);
  }

  closeDialog();
  return out.join('\n');
}

export function enhanceLessonContent(root) {
  if (!root) return;
  const headings = root.querySelectorAll('h2, h3');
  const normalize = (value) => {
    if (!value) return '';
    const text = String(value);
    return text.normalize ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : text.toLowerCase();
  };

  headings.forEach((heading) => {
    const text = String(heading.textContent || '');
    const normalized = normalize(text);
    const isVocab = text.includes('単語') || normalized.includes('tu vung') || normalized.includes('tu-vung') || normalized.includes('tu_vung');
    const isPhrase = text.includes('フレーズ') || normalized.includes('mau cau') || normalized.includes('mau-cau') || normalized.includes('mau_cau');

    if (isVocab) {
      heading.classList.add('sec-head', 'vocab-head');
      const list = heading.nextElementSibling;
      if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
        list.classList.add('vocab-list');
        list.querySelectorAll('li').forEach((li) => {
          if (li.dataset.enhanced) return;
          const raw = (li.textContent || '').trim();
          const parts = raw.split(/\s[–?-]\s/);
          if (parts.length >= 2) {
            const left = parts.shift();
            const right = parts.join(' - ');
            li.innerHTML = `<span class="v-term jp" lang="ja">${escapeHtml(left)}</span><span class="v-mean" lang="vi">${escapeHtml(right)}</span>`;
            li.dataset.enhanced = '1';
          }
        });
      }
    }

    if (isPhrase) {
      heading.classList.add('sec-head', 'phrase-head');
      const list = heading.nextElementSibling;
      if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
        list.classList.add('phrase-list');
        list.querySelectorAll('li').forEach((li) => {
          const jp = li.querySelector('p');
          const vn = li.querySelector('p em, em');
          if (jp) jp.classList.add('jp');
          if (vn) vn.classList.add('vn');
        });
      }
    }
  });
}

export function refineVocabDisplay(root) {
  if (!root) return;
  const lists = root.querySelectorAll('.vocab-list');
  lists.forEach((list) => {
    list.querySelectorAll('li').forEach((li) => {
      if (li.dataset.vrefined === '1') return;
      const raw = (li.textContent || '').trim();

      let match = raw.match(/^(.+?)\s*[（(]([^）)]+)[）)]\s*\|\s*(.+)$/);
      if (match) {
        const term = match[1].trim();
        const kana = match[2].trim();
        const meaning = match[3].trim();
        li.classList.remove('v-head');
        const styledMeaning = meaning.replace(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\b/g, '<span class="english">$1</span>');
        li.innerHTML = `<span class="v-term jp" lang="ja">${escapeHtml(term)} <span class="hiragana">（${escapeHtml(kana)}）</span></span><span class="v-mean" lang="vi">${styledMeaning}</span>`;
      } else {
        match = raw.match(/^(.+?)\s*\|\s*(.+)$/);
        if (match) {
          const term = match[1].trim();
          const meaning = match[2].trim();
          li.classList.remove('v-head');
          const isEnglish = /^[a-zA-Z\s\-.]+$/.test(term);
          const termClass = isEnglish ? 'english-term' : 'jp-term';
          const termLang = isEnglish ? 'en' : 'ja';
          const styledMeaning = meaning.replace(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)*)\b/g, '<span class="english">$1</span>');
          li.innerHTML = `<span class="v-term ${termClass}" lang="${termLang}">${escapeHtml(term)}</span><span class="v-mean" lang="vi">${styledMeaning}</span>`;
        } else if (!li.querySelector('.v-term')) {
          li.classList.add('v-head');
          li.innerHTML = `<span class="v-term jp" lang="ja">${escapeHtml(raw)}</span>`;
        }
      }
      li.dataset.vrefined = '1';
    });
  });
}
