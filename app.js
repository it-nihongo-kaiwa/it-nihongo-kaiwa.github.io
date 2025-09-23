// IT Nihongo Kaiwa — static client
// - Outline page grouped by data/outline.txt (if present)
// - Fallback outline from discovered lessons
// - Detail page renders Markdown with JP/VN bubbles and VN toggle

(function () {
  const defaultLesson = 'data/lesson01.md';
  const markdownView = document.getElementById('markdown-view');
  const outlineView = document.getElementById('outline-view');
  const detailControls = document.getElementById('detail-controls');
  const btnVN = document.getElementById('btn-vn');

  let lessons = []; // discovered lessons
  let outlineGroups = null; // [{group, items:[{id, topic, path, available}]}]

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function fetchText(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
  }
  async function tryFetch(path) { try { return await fetchText(path); } catch { return null; } }

  function parseTitle(md, fallback) {
    const m = md.match(/^\s*#\s+(.+)$/m);
    return (m ? m[1].trim() : fallback).replace(/\s+$/, '');
  }

  // VN toggle state
  function initVNToggle() {
    const saved = localStorage.getItem('showVN');
    // Default ON when not set; saved === '0' means OFF
    const showVN = saved !== '0';
    document.body.classList.toggle('vn-hidden', !showVN);
    if (btnVN) {
      btnVN.setAttribute('aria-pressed', showVN ? 'true' : 'false');
      btnVN.classList.toggle('active', showVN);
      btnVN.addEventListener('click', () => {
        const on = btnVN.getAttribute('aria-pressed') !== 'true';
        btnVN.setAttribute('aria-pressed', on ? 'true' : 'false');
        btnVN.classList.toggle('active', on);
        document.body.classList.toggle('vn-hidden', !on);
        localStorage.setItem('showVN', on ? '1' : '0');
      });
    }
  }

  // Markdown preprocessing  Edialogues
  function preprocessMarkdown(src) {
    const lines = src.split(/\r?\n/);
    const out = [];
    let inDialog = false;
    let left = true;

    function closeDialog() {
      if (inDialog) {
        out.push('</div>');
        out.push('<div class="dialog-legend"><span class="legend-item"><span class="chip chip-kh"></span>KH (Khách hàng)</span><span class="legend-item"><span class="chip chip-brse"></span>BrSE</span></div>');
        inDialog = false;
      }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^\s*\*\*([^*]+?):\*\*\s*(.+)$/);
      if (m) {
        const name = m[1].trim();
        const jp = m[2].trim();
        let vn = '';
        if (i + 1 < lines.length) {
          const t = lines[i + 1].match(/^\s*\*(.+)\*\s*$/);
          if (t) { vn = t[1].trim(); i++; }
        }
        if (!inDialog) { out.push('<div class="dialog">'); inDialog = true; }
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
          `<div class="dialog-row ${side} role-${role}">`+
            `<div class="bubble">`+
              `<div class="jp" lang="ja">${escapeHtml(jp)}</div>`+
              (vn ? `<div class="vn" lang="vi">${escapeHtml(vn)}</div>` : '')+
            `</div>`+
          `</div>`
        );
        if (role === 'other' || role === 'pm' || role === 'qa' || role === 'dev') left = !left;
        continue;
      }

      const jpm = line.match(/^\s*JP:\s*(.*)$/);
      if (jpm) {
        if (!inDialog) { out.push('<div class="dialog">'); inDialog = true; }
        out.push(`<div class="dialog-row left"><div class="bubble"><div class="jp" lang="ja">${escapeHtml(jpm[1])}</div></div></div>`);
        left = false; continue;
      }
      const vnm = line.match(/^\s*VN:\s*(.*)$/);
      if (vnm) {
        if (!inDialog) { out.push('<div class="dialog">'); inDialog = true; }
        out.push(`<div class="dialog-row right"><div class="bubble"><div class="vn" lang="vi">${escapeHtml(vnm[1])}</div></div></div>`);
        left = true; continue;
      }

      if (line.trim().length > 0) closeDialog();
      out.push(line);
    }
    closeDialog();
    return out.join('\n');
  }

  // Discover lessons and outline
  async function discoverLessons() {
    const found = [];
    const manifestRaw = await tryFetch('data/lessons.json');
    if (manifestRaw) {
      try {
        const entries = JSON.parse(manifestRaw);
        for (const e of entries) {
          const text = await tryFetch(e.path);
          if (!text) continue;
          found.push({ id: e.id || e.path, path: e.path, title: e.title || parseTitle(text, e.path) });
        }
      } catch {}
    }
    if (found.length === 0) {
      const limit = 50;
      const probes = Array.from({ length: limit }, (_, i) => {
        const num = String(i + 1).padStart(2, '0');
        const path = `data/lesson${num}.md`;
        return tryFetch(path).then(text => ({ path, text, num }));
      });
      const results = await Promise.all(probes);
      for (const r of results) if (r.text) found.push({ id: `l${r.num}`, path: r.path, title: parseTitle(r.text, `Lesson ${r.num}`) });
    }
    lessons = found;
    try { outlineGroups = await loadOutlineGroups(); } catch { outlineGroups = null; }
  }

  async function loadOutlineGroups() {
    // Try JSON first
    const jsonRaw = await tryFetch('data/outline.json');
    if (jsonRaw) {
      try {
        const data = JSON.parse(jsonRaw);
        const groups = Array.isArray(data?.outline) ? data.outline : (Array.isArray(data) ? data : []);
        const normalized = [];
        for (const g of groups) {
          if (!g || !g.items) continue;
          const groupName = g.group || '(Khác)';
          const items = [];
          for (const it of g.items) {
            if (!it || !it.id) continue;
            const id = String(it.id).trim();
            const topic = it.title || it.topic || id;
            const content = it.content || it.desc || '';
            const path = `data/${id}.md`;
            const views = Number(it.views ?? it.view ?? it.count ?? 0) || 0;
            items.push({ id, topic, path, content, views });
            normalized.push({ id, topic, path, group: groupName, content, views });
          }
        }
        // Availability checks
        await Promise.all(normalized.map(r => tryFetch(r.path).then(t => { r.available = !!t; })));
        // Re-group after availability
        const byGroup = new Map();
        for (const r of normalized) {
          if (!byGroup.has(r.group)) byGroup.set(r.group, []);
          byGroup.get(r.group).push({ id: r.id, topic: r.topic, path: r.path, available: r.available, content: r.content, views: r.views || 0 });
        }
        return Array.from(byGroup.entries()).map(([group, items]) => ({ group, items }));
      } catch {
        // fall through to TXT parser
      }
    }

    // Fallback: parse outline.txt if present
    const txt = await tryFetch('data/outline.txt');
    if (!txt) return null;
    const lines = txt.split(/\r?\n/).filter(l => /^\|/.test(l));
    const rows = [];
    for (const l of lines) {
      if (/^\|\s*-+\s*\|/.test(l)) continue;
      const cells = l.split('|').map(c => c.trim());
      if (cells.length < 5) continue;
      const id = cells[1];
      const group = cells[2] || '';
      const topic = cells[3] || '';
      if (!id || !topic) continue;
      const path = `data/${id}.md`;
      rows.push({ id, group: group || '(Khác)', topic, path });
    }
    const byGroup = new Map();
    for (const r of rows) {
      if (!byGroup.has(r.group)) byGroup.set(r.group, []);
      byGroup.get(r.group).push(r);
    }
    await Promise.all(rows.map(r => tryFetch(r.path).then(t => { r.available = !!t; })));
    return Array.from(byGroup.entries()).map(([group, items]) => ({ group, items }));
  }

  function renderOutline() {
    if (!outlineView) return;
    if (!outlineGroups && lessons.length === 0) {
      const hint = location.protocol === 'file:'
        ? 'Đang mềEtrực tiếp file (file://). Hãy dùng máy chủ tĩnh hoặc GitHub Pages đềEcho phép fetch().' : 'Không tìm thấy nội dung. Thêm md trong data/ hoặc tạo data/lessons.json.';
      outlineView.innerHTML = `<p class="loading">${hint}</p>`;
      return;
    }
    if (outlineGroups && outlineGroups.length) {
      const frag = document.createDocumentFragment();
      for (const g of outlineGroups) {
        const section = document.createElement('section');
        section.className = 'outline-section';
        const giClass = groupClass(g.group);
        section.innerHTML = `<h3 class="outline-group"><span class="group-icon ${giClass}" aria-hidden="true">${groupIconSVG(giClass)}</span><span>${escapeHtml(g.group)}</span></h3>`;
        const grid = document.createElement('div');
        grid.className = 'outline-grid';
        for (const it of g.items) {
          const card = document.createElement('article');
          card.className = 'outline-card' + (it.available ? ' available' : '');
          if (it.available) {
            card.innerHTML = `
              <a class="card-link" href="#lesson:${it.path}" aria-label="Mo ${escapeHtml(it.topic)}">
                <h4 class="outline-title">${escapeHtml(it.topic)}</h4>
                ${it.content ? `<p class=\"outline-desc\">${escapeHtml(it.content)}</p>` : ''}
                <span class="cta">Mở bài →</span>
              </a>
            `;
          } else {
            card.innerHTML = `
              <h4 class="outline-title">${escapeHtml(it.topic)}</h4>
              ${it.content ? `<p class=\"outline-desc\">${escapeHtml(it.content)}</p>` : ''}
              <span class="badge-draft">Sắp có</span>
            `;
          }
          // Add view badge into available cards (if link exists)
          try {
            const link = card.querySelector('.card-link');
            if (link) {
              const id = (it && it.id) ? String(it.id) : String((it && it.path || '').split('/').pop() || '').replace(/\.md$/i, '');
              try { link.setAttribute('href', `#lesson/${id}`); } catch {}
              const meta = document.createElement('div');
              meta.className = 'outline-meta';
              meta.innerHTML = `<span class="views" data-lesson-id="${escapeHtml(id)}">👁 <span class=\"num\">—</span></span>`;
              const cta = link.querySelector('.cta');
              if (cta) link.insertBefore(meta, cta); else link.appendChild(meta);
            }
          } catch {}
          grid.appendChild(card);
        }
        section.appendChild(grid);
        frag.appendChild(section);
      }
      outlineView.innerHTML = '';
      outlineView.appendChild(frag);
      try { if (window.populateOutlineViewCounts) window.populateOutlineViewCounts(); } catch {}
      return;
    }
    // Fallback: discovered lessons flat grid
    const grid = document.createElement('div');
    grid.className = 'outline-grid';
    for (const l of lessons) {
      const card = document.createElement('article');
      card.className = 'outline-card available';
      card.innerHTML = `
        <a class="card-link" href="#lesson:${l.path}">
          <h3 class="outline-title">${escapeHtml(l.title)}</h3>
          <span class="cta">Mở bài →</span>
        </a>
      `;
      // Add view badge for discovered lessons
      try {
        const link = card.querySelector('.card-link');
        if (link) {
          const id = (l.path.split('/').pop() || '').replace(/\.md$/i, '');
          try { link.setAttribute('href', `#lesson/${id}`); } catch {}
          const meta = document.createElement('div');
          meta.className = 'outline-meta';
          meta.innerHTML = `<span class="views" data-lesson-id="${escapeHtml(id)}">👁 <span class=\"num\">—</span></span>`;
          const cta = link.querySelector('.cta');
          if (cta) link.insertBefore(meta, cta); else link.appendChild(meta);
        }
      } catch {}
      grid.appendChild(card);
    }
    outlineView.innerHTML = '';
    outlineView.appendChild(grid);
    try { if (window.populateOutlineViewCounts) window.populateOutlineViewCounts(); } catch {}
  }

  async function renderLesson(path) {
    outlineView.hidden = true;
    if (detailControls) detailControls.hidden = false;
    markdownView.hidden = false;
    markdownView.innerHTML = '<p class="loading">Loading lesson…</p>';
    try {
      const text = await fetchText(path);
      const processed = preprocessMarkdown(text);
      if (window.marked) {
        const html = window.marked.parse(processed, { gfm: true, breaks: true });
        markdownView.innerHTML = html;
      } else {
        markdownView.textContent = text;
      }
      enhanceLessonContent();
      refineVocabDisplay();
      await insertLessonVideo(path);
      // View counter: show cached immediately, update after network
      try {
        const _id = (path.split('/').pop() || '').replace(/\.md$/i, '');
        const _cached = (window.cachedViewCount ? window.cachedViewCount(_id) : 0);
        renderDetailViewCount(_id, _cached);
        hitViewCount(_id).then(c => { try { renderDetailViewCount(_id, c); } catch {} }).catch(()=>{});
      } catch {}
      const baseName = path.split('/').pop() || 'lesson';
      document.title = `IT Nihongo Kaiwa — ${baseName.replace(/\.md$/i, '')}`;
      // SEO dynamic fallback if helpers available
      try {
        const baseName = path.split('/').pop() || 'lesson';
        const lessonId = baseName.replace(/\.md$/i, '');
        const titleFromMd = (typeof parseTitle === 'function') ? parseTitle(text, lessonId) : lessonId;
        if (typeof setDynamicSEO === 'function' && typeof summarizeText === 'function') {
          setDynamicSEO({
            title: `IT Nihongo Kaiwa — ${titleFromMd}`,
            description: summarizeText(text, 160),
            url: location.origin + location.pathname + `#lesson/${lessonId}`
          });
        } else {
          document.title = `IT Nihongo Kaiwa — ${titleFromMd}`;
        }
      } catch {}
    } catch (e) {
      markdownView.innerHTML = `<blockquote><span class="label vn">Info</span> <span class="vn">Khong the tai: ${escapeHtml(String(e))}</span></blockquote>`;
    }
  }

  // Enhance sections like Vocabulary / Phrases after Markdown render
    // Enhance sections like Vocabulary / Phrases after Markdown render
  function enhanceLessonContent() {
    const root = markdownView;
    if (!root) return;
    const headings = root.querySelectorAll('h2, h3');
    const norm = s => (s && s.normalize) ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : String(s || '').toLowerCase();
    headings.forEach(h => {
      const t = String(h.textContent || '');
      const tn = norm(t);
      const isVocab = t.includes('語彙') || tn.includes('tu vung') || tn.includes('tu-vung') || tn.includes('tu_vung');
      const isPhrase = t.includes('フレーズ') || tn.includes('mau cau') || tn.includes('mau-cau') || tn.includes('mau_cau');
      if (isVocab) {
        h.classList.add('sec-head', 'vocab-head');
        const next = h.nextElementSibling;
        if (next && (next.tagName === 'UL' || next.tagName === 'OL')) {
          next.classList.add('vocab-list');
          next.querySelectorAll('li').forEach(li => {
            if (li.dataset.enhanced) return;
            const raw = (li.textContent || '').trim();
            const parts = raw.split(/\s[–—-]\s/);
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
        h.classList.add('sec-head', 'phrase-head');
        const next = h.nextElementSibling;
        if (next && (next.tagName === 'UL' || next.tagName === 'OL')) {
          next.classList.add('phrase-list');
          next.querySelectorAll('li').forEach(li => {
            const p1 = li.querySelector('p');
            const p2 = li.querySelector('p em, em');
            if (p1) p1.classList.add('jp');
            if (p2) p2.classList.add('vn');
          });
        }
      }
    });
  }function refineVocabDisplay() {
    const lists = markdownView ? markdownView.querySelectorAll('.vocab-list') : [];
    lists.forEach(ul => {
      ul.querySelectorAll('li').forEach(li => {
        if (li.dataset.vrefined === '1') return;
        const raw = (li.textContent || '').trim();
        const m = raw.match(/^(.*?)\s*[\-– E E ]\s*(.+)$/); // allow dash/colon without strict spacing
        if (m) {
          const left = m[1].trim();
          const right = m[2].trim();
          li.classList.remove('v-head');
          li.innerHTML = `<span class="v-term jp" lang="ja">${escapeHtml(left)}</span><span class="v-mean" lang="vi">${escapeHtml(right)}</span>`;
        } else if (!li.querySelector('.v-term')) {
          li.classList.add('v-head');
          li.innerHTML = `<span class="v-term jp" lang="ja">${escapeHtml(raw)}</span>`;
        }
        li.dataset.vrefined = '1';
      });
    });
  }

  // Insert lesson video (data/<id>.mp4) above the first dialogue
  async function insertLessonVideo(mdPath) {
    try {
      if (!markdownView) return;
      const base = (mdPath.split('/').pop() || '').replace(/\.md$/i, '');
      const candidates = [
        `video/${base}.mp4`,
        `videos/${base}.mp4`,
        mdPath.replace(/\.md$/i, '.mp4')
      ];
      let mp4 = null;
      for (const url of candidates) {
        if (await resourceExists(url)) { mp4 = url; break; }
      }
      if (!mp4) return;
      const fig = document.createElement('figure');
      fig.className = 'lesson-video';
      fig.innerHTML = `
        <video class="lesson-video-player" controls preload="metadata" playsinline src="${mp4}"></video>
      `;
      const firstDialog = markdownView.querySelector('.dialog');
      if (firstDialog && firstDialog.parentNode) {
        firstDialog.parentNode.insertBefore(fig, firstDialog);
      } else {
        markdownView.insertBefore(fig, markdownView.firstChild);
      }
    } catch {}
  }

  async function resourceExists(url) {
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
      if (head.ok) return true;
    } catch {}
    try {
      const res = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' }, cache: 'no-cache' });
      return res.ok;
    } catch { return false; }
  }

  // Map group to class for color + icon choice
    // Map group to class for color + icon choice (ASCII-safe)
  function groupClass(name) {
    const k = (name || '').toLowerCase();
    if (k.includes('pre')) return 'gi-pre';
    if (k.includes('kick')) return 'gi-kick';
    if (k.includes('basic')) return 'gi-basic';
    if (k.includes('detail')) return 'gi-detail';
    if (k.includes('coding') || k.includes('code')) return 'gi-code';
    if (k.includes('test')) return 'gi-test';
    if (k.includes('uat')) return 'gi-uat';
    if (k.includes('release') || k.includes('ops')) return 'gi-release';
    if (k.includes('process') || k.includes('proc')) return 'gi-process';
    if (k.includes('interview')) return 'gi-interview';
    return 'gi-default';
  }function groupIconSVG(giClass) {
    switch (giClass) {
      case 'gi-pre':
      case 'gi-kick':
        // calendar/briefing
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18" stroke="currentColor" stroke-width="1.6"/><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
      case 'gi-basic':
        // blueprint
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M9 5v14M5 9h14" stroke="currentColor" stroke-width="1.6"/></svg>`;
      case 'gi-detail':
        // schema
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="15" y="3" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="15" width="6" height="6" rx="1.2" stroke="currentColor" stroke-width="1.6"/><path d="M6 9v3h12V9" stroke="currentColor" stroke-width="1.6"/></svg>`;
      case 'gi-code':
        // code brackets
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l-4-6 4-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6l4 6-4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'gi-test':
        // checklist
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 8h8M6 12h8M6 16h5" stroke="currentColor" stroke-width="1.6"/><path d="M18 7l2 2 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'gi-uat':
        // shield/check
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'gi-release':
        // rocket
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 19l4-1 6-6 2-6-6 2-6 6-1 4z" stroke="currentColor" stroke-width="1.6"/><path d="M9 15l-3-3" stroke="currentColor" stroke-width="1.6"/></svg>`;
      case 'gi-process':
        // loop arrows
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 12a7 7 0 0112-5l2-2v6h-6l2-2a5 5 0 10.9 7.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      case 'gi-interview':
        // chat bubble
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 15a6 6 0 01-6 6H6l-3 3V9a6 6 0 016-6h6a6 6 0 016 6v6z" stroke="currentColor" stroke-width="1.6"/></svg>`;
      default:
        // default grid
        return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
    }
  }

  function route() {
    const hash = window.location.hash || '';
    const pretty = hash.match(/^#lesson\/?([A-Za-z0-9_\-\.]+)/);
    const m = hash.match(/^#lesson:(.+)$/);
    const legacy = hash.match(/^#(.+\.md)$/i);
    if (pretty && pretty[1]) {
      const id = pretty[1];
      const path = `data/${id}.md`;
      renderLesson(path);
    } else if (m && m[1]) {
      const path = m[1].includes('..') ? defaultLesson : m[1];
      renderLesson(path);
    } else if (legacy) {
      renderLesson(legacy[1]);
    } else {
      markdownView.hidden = true;
      outlineView.hidden = false;
      if (detailControls) detailControls.hidden = true;
      document.title = 'IT Nihongo Kaiwa — Outline';
      try {
        if (typeof setDynamicSEO === 'function') {
          setDynamicSEO({
            title: 'IT Nihongo Kaiwa — Mục lục',
            description: 'Mục lục các bài hội thoại IT tiếng Nhật. Mẫu câu, từ vựng, và tình huống thực tế.',
            url: location.origin + location.pathname + '#list'
          });
        } else {
          document.title = 'IT Nihongo Kaiwa — Mục lục';
        }
      } catch { document.title = 'IT Nihongo Kaiwa — Mục lục'; }
      renderOutline();
    }
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', async () => {
    initVNToggle();
    await discoverLessons();
    try {
      // Seed initial view counts from outline (if provided)
      if (window && Array.isArray(outlineGroups)) {
        const seed = {};
        for (const g of outlineGroups) {
          for (const it of (g.items || [])) {
            seed[it.id] = Number(it.views || 0) || 0;
          }
        }
        window.__seedViews = seed;
      }
    } catch {}
    if (!window.location.hash) window.location.hash = '#list';
    route();
  });
})();

// --- Views counter (CountAPI + local fallback) ---
(function(){
  window.lessonIdFromPath = function(p){
    const base = (p || '').split('/').pop() || '';
    return base.replace(/\.md$/i, '');
  }

  const VIEW_NS = 'it-nihongo-kaiwa';
  async function apiJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  // SEO helpers (safe no-ops if not used)
  window.setDynamicSEO = function({ title, description, url }){
    try {
      if (title) document.title = title;
      const set = (selector, attr, val) => {
        let el = document.querySelector(selector);
        if (!el) {
          if (selector.startsWith('meta[name="')) { el = document.createElement('meta'); el.setAttribute('name', selector.match(/meta\[name=\"([^\"]+)/)[1]); }
          else if (selector.startsWith('meta[property="')) { el = document.createElement('meta'); el.setAttribute('property', selector.match(/meta\[property=\"([^\"]+)/)[1]); }
          else if (selector.startsWith('link[rel="canonical"')) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); }
          if (el) document.head.appendChild(el);
        }
        if (el) el.setAttribute(attr, val);
      };
      if (description) {
        set('meta[name="description"]', 'content', description);
        set('meta[property="og:description"]', 'content', description);
        set('meta[name="twitter:description"]', 'content', description);
      }
      if (title) {
        set('meta[property="og:title"]', 'content', title);
        set('meta[name="twitter:title"]', 'content', title);
      }
      if (url) {
        set('meta[property="og:url"]', 'content', url);
        set('link[rel="canonical"]', 'href', url);
      }
    } catch {}
  }

  window.summarizeText = function(md, limit){
    try {
      const t = String(md || '')
        .replace(/`{3}[\s\S]*?`{3}/g, ' ')
        .replace(/`[^`]+`/g, ' ')
        .replace(/^>.*$/gm, ' ')
        .replace(/\!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/[#*_>\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return t.length > limit ? t.slice(0, limit - 1) + '…' : t;
    } catch { return ''; }
  }

  // Cached count without waiting for network (seed + local)
  window.cachedViewCount = function(id){
    const seed = (window.__seedViews && window.__seedViews[id]) ? Number(window.__seedViews[id]) : 0;
    return seed + lsGet(id);
  }

  function lsGet(id){
    try { return parseInt(localStorage.getItem('vc::'+id) || '0', 10) || 0; } catch { return 0; }
  }
  function lsSet(id, v){ try { localStorage.setItem('vc::'+id, String(v)); } catch {} }

  window.getViewCount = async function(id){
    try {
      const data = await apiJSON(`https://api.countapi.xyz/get/${encodeURIComponent(VIEW_NS)}/${encodeURIComponent(id)}`);
      if (typeof data?.value === 'number') return data.value;
    } catch {}
    const seed = (window.__seedViews && window.__seedViews[id]) ? Number(window.__seedViews[id]) : 0;
    return seed + lsGet(id);
  }

  window.hitViewCount = async function(id){
    try {
      const data = await apiJSON(`https://api.countapi.xyz/hit/${encodeURIComponent(VIEW_NS)}/${encodeURIComponent(id)}`);
      if (typeof data?.value === 'number') { lsSet(id, data.value); return data.value; }
    } catch {}
    const v = lsGet(id) + 1; lsSet(id, v);
    const seed = (window.__seedViews && window.__seedViews[id]) ? Number(window.__seedViews[id]) : 0;
    return seed + v;
  }

  window.renderDetailViewCount = function(id, count){
    const root = document.getElementById('markdown-view');
    if (!root) return;
    let badge = root.querySelector('.view-stats');
    if (badge) {
      const num = badge.querySelector('.num');
      if (num) num.textContent = String(count);
      else badge.textContent = `👁 ${count} lượt xem`;
      return;
    }
    const target = root.querySelector('h1');
    badge = document.createElement('div');
    badge.className = 'view-stats';
    badge.innerHTML = `👁 <span class="num">${count}</span> lượt xem`;
    if (target && target.parentNode) target.insertAdjacentElement('afterend', badge);
    else root.insertBefore(badge, root.firstChild);
  }

  window.populateOutlineViewCounts = async function(){
    const els = document.querySelectorAll('.views[data-lesson-id]');
    const tasks = [];
    els.forEach(el => {
      const id = el.getAttribute('data-lesson-id');
      // Set cached value immediately
      try {
        const cached = window.cachedViewCount ? window.cachedViewCount(id) : 0;
        const num1 = el.querySelector('.num');
        if (num1) num1.textContent = cached; else el.textContent = `👁 ${cached}`;
      } catch {}
      // Refresh from network in background
      tasks.push(getViewCount(id).then(v => {
        const num2 = el.querySelector('.num');
        if (num2) num2.textContent = v; else el.textContent = `👁 ${v}`;
      }).catch(()=>{}));
    });
    await Promise.allSettled(tasks);
  }
})();




