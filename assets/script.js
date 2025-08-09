
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


// ===== Publications (Volume/Issue Navigation) =====
async function fetchPubsEntries() {
  try {
    const res = await fetch('/assets/data/pubs.json', { cache: 'no-store' });
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
    const norm = arr.map(x => ({
      id: x.id || '',
      date: (x.date || '').slice(0,10),
      title: x.title || '',
      authors: Array.isArray(x.authors) ? x.authors.map(a=>a.name||a) : (x.authors ? String(x.authors).split(/,|·/).map(s=>s.trim()).filter(Boolean) : []),
      abstract: x.abstract || '',
      pdf: x.pdf || (x.file || ''),
      volume: x.volume || '',
      issue: x.issue || '',
      pages: x.pages || '',
      doi: x.doi || ''
    }));
    norm.sort((a,b)=> (b.date||'').localeCompare(a.date||'') || a.title.localeCompare(b.title));
    return norm;
  } catch (e) {
    console.error('Failed to load pubs.json', e);
    return [];
  }
}

function groupByVolIssue(entries){
  const map = {};
  entries.forEach(e=>{
    const v = e.volume || 'Unspecified';
    const n = e.issue || 'Unspecified';
    (map[v] ||= {});
    (map[v][n] ||= []).push(e);
  });
  Object.values(map).forEach(issues => {
    Object.values(issues).forEach(list => {
      list.sort((a,b)=>{
        const pa = parseInt((a.pages||'').match(/\d+/)?.[0]||'0',10);
        const pb = parseInt((b.pages||'').match(/\d+/)?.[0]||'0',10);
        return pa - pb || a.title.localeCompare(b.title);
      });
    });
  });
  return map;
}

function renderPubsNav(map){
  const nav = document.getElementById('pubs-nav');
  if (!nav) return;
  nav.innerHTML = '';
  const vols = Object.keys(map).sort((a,b)=>{
    const na = parseInt(a.replace(/\\D/g,''))||0;
    const nb = parseInt(b.replace(/\\D/g,''))||0;
    return nb - na;
  });
  vols.forEach(v=>{
    const section = document.createElement('div');
    section.className = 'vol';
    const h = document.createElement('h2'); h.textContent = `Vol.${v}`;
    section.appendChild(h);
    const ul = document.createElement('ul');
    Object.keys(map[v]).sort((a,b)=>{
      const na = parseInt(a.replace(/\\D/g,''))||0;
      const nb = parseInt(b.replace(/\\D/g,''))||0;
      return nb - na;
    }).forEach(i=>{
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#vol=${encodeURIComponent(v)}&issue=${encodeURIComponent(i)}`;
      a.textContent = `No.${i}`;
      li.appendChild(a);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    nav.appendChild(section);
  });
}

function renderPubsIssue(map, vol, issue){
  const content = document.getElementById('pubs-content');
  if (!content) return;
  content.innerHTML = '';
  const v = map[vol]; const list = v ? v[issue] : null;
  const header = document.createElement('div');
  header.innerHTML = `<h2>Vol.${vol} · No.${issue}</h2>`;
  content.appendChild(header);
  if (!list || !list.length){
    const p = document.createElement('p');
    p.textContent = '이 권호의 논문이 없습니다.';
    content.appendChild(p);
    return;
  }
  list.forEach(item=>{
    const card = document.createElement('article');
    card.className = 'news-item';
    const h3 = document.createElement('h3');
    const a = document.createElement('a');
    a.href = `#vol=${encodeURIComponent(vol)}&issue=${encodeURIComponent(issue)}&paper=${encodeURIComponent(item.id)}`;
    a.textContent = item.title;
    h3.appendChild(a);
    const meta = document.createElement('div');
    meta.className = 'muted';
    meta.textContent = `${(item.authors||[]).join(' · ')}${item.pages? ' · ' + item.pages: ''}`;
    const actions = document.createElement('div');
    actions.className = 'actions';
    if (item.pdf){
      const btn = document.createElement('a');
      btn.className = 'btn btn-sm';
      btn.href = item.pdf;
      btn.target = '_blank';
      btn.textContent = 'PDF';
      actions.appendChild(btn);
    }
    if (item.doi){
      const link = document.createElement('a');
      link.className = 'link';
      link.href = item.doi;
      link.target = '_blank';
      link.textContent = 'DOI';
      actions.appendChild(link);
    }
    card.appendChild(h3);
    card.appendChild(meta);
    card.appendChild(actions);
    card.addEventListener('click', (ev)=>{
      if (ev.target.tagName.toLowerCase()==='a' && (ev.target.classList.contains('btn')||ev.target.classList.contains('link'))) return;
      openPubModal(item);
    });
    content.appendChild(card);
  });
}

function openPubModal(item){
  let modal = document.getElementById('pubs-modal') || document.getElementById('news-modal');
  if (!modal){ modal = document.createElement('div'); modal.id='pubs-modal'; document.body.appendChild(modal); }
  modal.className = 'news-modal'; modal.innerHTML = '';
  const overlay = document.createElement('div'); overlay.className = 'modal-overlay';
  const box = document.createElement('div'); box.className = 'modal-box';
  const title = document.createElement('h3'); title.textContent = item.title;
  const meta = document.createElement('div'); meta.className = 'muted'; meta.textContent = `${(item.authors||[]).join(' · ')}${item.pages? ' · ' + item.pages: ''}`;
  const body = document.createElement('div'); body.className = 'modal-body';
  const ensureMarked = () => new Promise(res=>{
    if (window.marked) return res();
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js'; s.onload=()=>res(); document.head.appendChild(s);
  });
  ensureMarked().then(()=>{
    if (item.abstract && window.marked){ body.innerHTML = window.marked.parse(item.abstract); }
    else { body.textContent = item.abstract || ''; }
  });
  const actions = document.createElement('div');
  if (item.pdf){ const btn = document.createElement('a'); btn.className='btn btn-sm'; btn.href=item.pdf; btn.target='_blank'; btn.textContent='PDF 다운로드'; actions.appendChild(btn); }
  if (item.doi){ const link = document.createElement('a'); link.className='link'; link.href=item.doi; link.target='_blank'; link.textContent='DOI 바로가기'; actions.appendChild(link); }
  const close = document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기'; close.addEventListener('click', ()=> modal.style.display='none');
  box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(actions); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box); modal.style.display='block';
}

function handlePubsRouting(map){
  const hash = location.hash || '';
  const mVol = hash.match(/vol=([^&]+)/);
  const mIss = hash.match(/issue=([^&]+)/);
  const mPaper = hash.match(/paper=([^&]+)/);
  const vols = Object.keys(map).sort();
  const vol = mVol ? decodeURIComponent(mVol[1]) : (vols.length? vols[vols.length-1] : '');
  const issues = map[vol] ? Object.keys(map[vol]).sort() : [];
  const issue = mIss ? decodeURIComponent(mIss[1]) : (issues.length? issues[issues.length-1] : '');
  renderPubsIssue(map, vol, issue);
  if (mPaper){
    const list = map[vol] && map[vol][issue] ? map[vol][issue] : [];
    const target = list.find(x=>x.id===decodeURIComponent(mPaper[1]));
    if (target) openPubModal(target);
  }
}

async function initPubs(){
  const entries = await fetchPubsEntries();
  if (!entries.length) return;
  const map = groupByVolIssue(entries);
  renderPubsNav(map);
  handlePubsRouting(map);
  window.addEventListener('hashchange', ()=>handlePubsRouting(map));
}

document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('pubs-nav')) initPubs();
});
