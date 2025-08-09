
// Netlify Identity invite token auto-redirect
(function(){
  try {
    var h = window.location.hash || '';
    if (h.indexOf('invite_token=') !== -1 && window.location.pathname !== '/admin/') {
      window.location.replace('/admin/' + h);
    }
  } catch(e) {}
})();

document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year'); if (year) year.textContent = new Date().getFullYear();
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = nav.style.display === 'flex';
      nav.style.display = open ? 'none' : 'flex';
      toggle.setAttribute('aria-expanded', String(!open));
    });
  }
});

/* === News rendering (clean) === */
async function loadNewsData() {
  try {
    const res = await fetch('/assets/data/news.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load news.json');
    const data = await res.json();
    data.sort((a,b)=> (a.date < b.date ? 1 : -1));
    return data;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function renderNewsBrief(ulId, limit=4) {
  const listEl = document.getElementById(ulId);
  if (!listEl) return;
  const items = await loadNewsData();
  listEl.innerHTML = '';
  const slice = items.slice(0, limit);
  if (slice.length === 0) {
    listEl.innerHTML = '<li>목록을 불러오지 못했습니다.</li>';
    return;
  }
  slice.forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = it.href;
    a.textContent = `(${it.date}) ${it.title}`;
    li.appendChild(a);
    listEl.appendChild(li);
  });
}

async function renderNewsList(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const items = await loadNewsData();
  wrap.innerHTML = '';
  if (items.length === 0) {
    wrap.innerHTML = '<p>목록을 불러오지 못했습니다.</p>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'news-list';
  items.forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = it.href;
    a.textContent = `(${it.date}) ${it.title}`;
    li.appendChild(a);
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
}

document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('news-brief')) renderNewsBrief('news-brief', 4);
  if (document.getElementById('news-list-wrap')) renderNewsList('news-list-wrap');
});




// /* Markdown support start */
let _markedReady = false;
async function ensureMarked() {
  if (_markedReady) return true;
  try {
    if (!window.marked) {
      // dynamically load marked from CDN
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    _markedReady = !!window.marked;
  } catch(e) { console.warn('marked load failed', e); _markedReady = false; }
  return _markedReady;
}

function looksLikeHtml(str) {
  return /<\/?[a-z][\s\S]*>/i.test(str || '');
}

// Very small fallback: convert blank-line separated paragraphs and line breaks
function simpleMarkdownToHtml(md) {
  if (!md) return '';
  // escape basic HTML to avoid injection in fallback
  const esc = md.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // paragraphs: split by two or more newlines
  return esc.split(/\n{2,}/).map(p => '<p>' + p.replace(/\n/g,'<br>') + '</p>').join('\n');
}

async function renderContentHtml(raw) {
  if (!raw) return '';
  if (looksLikeHtml(raw)) return raw; // already HTML (migrated old posts)
  const ok = await ensureMarked();
  if (ok && window.marked) {
    try { return window.marked.parse(raw); } catch(e) { console.warn('marked parse fail', e); }
  }
  return simpleMarkdownToHtml(raw);
}

function stripToText(htmlOrMd) {
  if (!htmlOrMd) return '';
  // If it's markdown, just remove common markdown syntax for excerpt
  if (!looksLikeHtml(htmlOrMd)) {
    return htmlOrMd.replace(/[#>*_`~\-!\[\]\(\)]/g,' ').replace(/\s+/g,' ').trim();
  }
  // else HTML -> text
  const tmp = document.createElement('div');
  tmp.innerHTML = htmlOrMd;
  return (tmp.textContent || '').trim();
}
// /* Markdown support end */
// ===== News Board & Latest Notices =====
async function fetchNewsEntries() {
  try {
    const res = await fetch('/assets/data/news.json', { cache: 'no-store' });
    const data = await res.json();
    // Support both array root and { entries: [] }
    const arr = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
    // Normalize date to ISO string and sort desc
    const norm = arr.map(x => ({
      id: x.id || '',
      date: (x.date || '').slice(0,10),
      title: x.title || '',
      content: x.content || '',
      attachments: Array.isArray(x.attachments) ? x.attachments : []
    }));
    norm.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return norm;
  } catch (e) {
    console.error('Failed to load news.json', e);
    return [];
  }
}


function renderBoard(entries) {
  const board = document.querySelector('#news-board');
  if (!board) return;
  board.innerHTML = '';
  entries.forEach(item => {
    const card = document.createElement('article');
    card.className = 'news-item';
    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.textContent = item.title;
    a.addEventListener('click', () => openNewsModal(item));
    h3.appendChild(a);
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = item.date;
    const excerpt = document.createElement('div');
    excerpt.className = 'excerpt';
    // Simple excerpt from content (strip tags)
    const text = stripToText(item.content || '').slice(0, 160);
    excerpt.textContent = text;
    card.appendChild(h3);
    card.appendChild(meta);
    card.appendChild(excerpt);
    board.appendChild(card);
  });
  // If URL hash matches an item id, open it automatically
  if (location.hash) {
    const id = decodeURIComponent(location.hash.substring(1));
    const target = entries.find(e => e.id === id);
    if (target) openNewsModal(target);
  }
}

async function openNewsModal(item) {
  let modal = document.getElementById('news-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'news-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'news-modal';
  modal.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const box = document.createElement('div');
  box.className = 'modal-box';
  const title = document.createElement('h3');
  title.textContent = item.title;
  const meta = document.createElement('div');
  meta.className = 'muted';
  meta.textContent = item.date;
  const body = document.createElement('div');
  body.className = 'modal-body';
  /* render markdown or html */
  const files = document.createElement('div');
  if (item.attachments && item.attachments.length) {
    const ul = document.createElement('ul');
    item.attachments.forEach(att => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = att.file || att.url || '#';
      a.target = '_blank';
      a.textContent = att.name || att.file || '첨부파일';
      li.appendChild(a);
      ul.appendChild(li);
    });
    files.appendChild(ul);
  }
  const close = document.createElement('button');
  close.className = 'btn btn-sm';
  close.textContent = '닫기';
  close.addEventListener('click', () => { modal.style.display = 'none'; });
  box.appendChild(title);
  box.appendChild(meta);
  // render content
  const _html = await renderContentHtml(item.content || '');
  body.innerHTML = _html;
  box.appendChild(body);
  box.appendChild(files);
  box.appendChild(close);
  modal.appendChild(overlay);
  modal.appendChild(box);
  modal.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
  const news = await fetchNewsEntries();
  renderLatest3(news);
  renderBoard(news);
});

function renderLatest3(entries) {
  // Fill existing '공지' list on homepage if present
  const list = document.querySelector('#news-brief');
  if (!list) return;
  list.innerHTML = '';
  entries.slice(0,3).forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '/news.html#' + encodeURIComponent(item.id);
    a.textContent = `${item.title} (${item.date})`;
    li.appendChild(a);
    list.appendChild(li);
  });
}


// ===== Publications (Pubs) Board / Archive =====
async function fetchPubsEntries() {
  try {
    const res = await fetch('/assets/data/pubs.json?v=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
    const norm = arr.map(x => ({
      id: x.id || '',
      date: (x.date || '').slice(0,10),
      title: x.title || '',
      authors: Array.isArray(x.authors) ? x.authors : [],
      abstract: x.abstract || '',
      pdf: x.pdf || (x.file || ''),
      volume: x.volume || '',
      issue: x.issue || '',
      pages: x.pages || '',
      doi: x.doi || ''
    }));
    norm.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    return norm;
  } catch (e) {
    console.error('Failed to load pubs.json', e);
    return [];
  }
}

function ensureMarked(cb) {
  if (window.marked) return cb();
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  s.onload = cb;
  document.head.appendChild(s);
}

function renderPubsBoard(entries) {
  const wrap = document.querySelector('#pubs-board');
  if (!wrap) return;
  wrap.innerHTML = '';
  entries.forEach(item => {
    const card = document.createElement('article');
    card.className = 'news-item';
    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.textContent = item.title;
    a.addEventListener('click', () => openPubModal(item));
    h3.appendChild(a);
    const meta = document.createElement('div');
    meta.className = 'muted';
    const parts = [];
    if (item.authors.length) parts.push(item.authors.join(' · '));
    if (item.volume || item.issue) parts.push([item.volume, item.issue].filter(Boolean).join(' '));
    if (item.pages) parts.push(item.pages);
    if (item.date) parts.push(item.date);
    meta.textContent = parts.join(' | ');
    const actions = document.createElement('div');
    actions.className = 'pub-actions';
    if (item.pdf) {
      const btn = document.createElement('a');
      btn.className = 'btn btn-sm';
      btn.href = item.pdf;
      btn.target = '_blank';
      btn.textContent = 'PDF';
      actions.appendChild(btn);
    }
    if (item.doi) {
      const link = document.createElement('a');
      link.className = 'link';
      link.href = item.doi.startsWith('http') ? item.doi : ('https://doi.org/' + item.doi);
      link.target = '_blank';
      link.textContent = 'DOI';
      actions.appendChild(link);
    }
    card.appendChild(h3);
    card.appendChild(meta);
    card.appendChild(actions);
    wrap.appendChild(card);
  });
}

function groupByYear(entries) {
  const map = new Map();
  entries.forEach(e => {
    const y = (e.date||'').slice(0,4) || '미상';
    if (!map.has(y)) map.set(y, []);
    map.get(y).push(e);
  });
  return Array.from(map.entries()).sort((a,b)=> b[0].localeCompare(a[0]));
}

function renderPubsArchive(entries) {
  const wrap = document.querySelector('#sbr-archive');
  if (!wrap) return;
  wrap.innerHTML = '';
  const groups = groupByYear(entries);
  groups.forEach(([year, arr]) => {
    const h2 = document.createElement('h2');
    h2.textContent = year;
    wrap.appendChild(h2);
    arr.forEach(item => {
      const row = document.createElement('article');
      row.className = 'news-item';
      const h3 = document.createElement('h3');
      const a = document.createElement('a');
      a.href = 'javascript:void(0)';
      a.textContent = item.title;
      a.addEventListener('click', () => openPubModal(item));
      h3.appendChild(a);
      const meta = document.createElement('div');
      meta.className = 'muted';
      const parts = [];
      if (item.authors.length) parts.push(item.authors.join(' · '));
      if (item.volume || item.issue) parts.push([item.volume, item.issue].filter(Boolean).join(' '));
      if (item.pages) parts.push(item.pages);
      if (item.date) parts.push(item.date);
      meta.textContent = parts.join(' | ');
      row.appendChild(h3);
      row.appendChild(meta);
      wrap.appendChild(row);
    });
  });
}

function openPubModal(item) {
  let modal = document.getElementById('pubs-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pubs-modal';
    document.body.appendChild(modal);
  }
  modal.className = 'news-modal';
  modal.innerHTML = '';
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  const box = document.createElement('div'); box.className = 'modal-box';
  const title = document.createElement('h3'); title.textContent = item.title;
  const meta = document.createElement('div'); meta.className = 'muted';
  const parts = [];
  if (item.authors.length) parts.push(item.authors.join(' · '));
  if (item.volume || item.issue) parts.push([item.volume, item.issue].filter(Boolean).join(' '));
  if (item.pages) parts.push(item.pages);
  if (item.date) parts.push(item.date);
  meta.textContent = parts.join(' | ');
  const body = document.createElement('div'); body.className = 'modal-body';
  function fillBody(){
    if (item.abstract && window.marked) {
      body.innerHTML = window.marked.parse(item.abstract);
    } else if (item.abstract) {
      body.textContent = item.abstract;
    } else {
      body.textContent = '';
    }
  }
  const actions = document.createElement('div'); actions.className='pub-actions';
  if (item.pdf) {
    const btn = document.createElement('a');
    btn.className = 'btn btn-sm';
    btn.href = item.pdf; btn.target='_blank'; btn.textContent='PDF 다운로드';
    actions.appendChild(btn);
  }
  if (item.doi) {
    const link = document.createElement('a');
    link.className = 'link';
    link.href = item.doi.startsWith('http') ? item.doi : ('https://doi.org/' + item.doi);
    link.target = '_blank'; link.textContent='DOI';
    actions.appendChild(link);
  }
  const close = document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기';
  close.addEventListener('click', ()=> { modal.style.display='none'; });

  box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(actions); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box);
  modal.style.display='block';
  ensureMarked(fillBody);
}

document.addEventListener('DOMContentLoaded', async () => {
  const pubs = await fetchPubsEntries();
  renderPubsBoard(pubs);
  renderPubsArchive(pubs);
});
