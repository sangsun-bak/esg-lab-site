
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


// === Utility: load marked for Markdown -> HTML ===
(function ensureMarked(){
  if (!window.marked) {
    var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/marked/marked.min.js'; s.defer=true;
    document.head.appendChild(s);
  }
})();

function normalizeAssetUrl(url){
  if(!url) return '';
  if(/^https?:\/\//i.test(url)) return url;
  if(url.startsWith('/')) return url;
  if(url.startsWith('assets/')) return '/' + url;
  return url;
}

async function fetchJSON(path){
  try {
    const res = await fetch(path, {cache:'no-store'});
    const data = await res.json();
    return Array.isArray(data) ? data : (data.entries || []);
  } catch(e){ console.error('fetchJSON failed', path, e); return []; }
}

// ===== News =====
async function loadNews(){
  const entries = await fetchJSON('/assets/data/news.json');
  // sort by date desc
  entries.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  // Latest 3 on index
  const brief = document.querySelector('#latest-news .news-list, #news-brief, .news-brief');
  if(brief){
    brief.innerHTML='';
    entries.slice(0,3).forEach(it=>{
      const li=document.createElement('li');
      const a=document.createElement('a');
      a.href = '/news.html#'+encodeURIComponent(it.id||'');
      a.textContent = `[${(it.date||'').slice(0,10)}] ${it.title||''}`;
      li.appendChild(a); brief.appendChild(li);
    });
  }
  // Board
  const board = document.querySelector('#news-board');
  if(board){
    board.innerHTML='';
    entries.forEach(it=>{
      const card=document.createElement('article'); card.className='news-item';
      const h3=document.createElement('h3'); const a=document.createElement('a'); a.href='javascript:void(0)'; a.textContent=it.title||'';
      a.addEventListener('click',()=>openNewsModal(it)); h3.appendChild(a);
      const meta=document.createElement('div'); meta.className='muted'; meta.textContent=(it.date||'').slice(0,10);
      const ex=document.createElement('div'); ex.className='excerpt';
      const tmp=document.createElement('div'); tmp.innerHTML = it.content || '';
      const plain=(tmp.textContent||'').trim().replace(/\s+/g,' ').slice(0,160);
      ex.textContent=plain;
      card.appendChild(h3); card.appendChild(meta); card.appendChild(ex);
      board.appendChild(card);
    });
    if(location.hash){
      const id=decodeURIComponent(location.hash.substring(1));
      const t=entries.find(e=>e.id===id); if(t) openNewsModal(t);
    }
  }
}

function openNewsModal(it){
  let modal=document.getElementById('news-modal');
  if(!modal){ modal=document.createElement('div'); modal.id='news-modal'; document.body.appendChild(modal); }
  modal.className='news-modal';
  modal.innerHTML='';
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  const box=document.createElement('div'); box.className='modal-box';
  const title=document.createElement('h3'); title.textContent=it.title||'';
  const meta=document.createElement('div'); meta.className='muted'; meta.textContent=(it.date||'').slice(0,10);
  const body=document.createElement('div'); body.className='modal-body';
  // If looks like markdown (no tags), render via marked when available
  if(it.content && it.content.indexOf('<')===-1 && window.marked){
    body.innerHTML = window.marked.parse(it.content);
  } else {
    body.innerHTML = it.content || '';
  }
  const files=document.createElement('div');
  (it.attachments||[]).forEach(att=>{
    const a=document.createElement('a'); a.href=normalizeAssetUrl(att.file||att.url||'#'); a.target='_blank';
    a.textContent=att.name || att.file || '첨부파일';
    const p=document.createElement('p'); p.appendChild(a); files.appendChild(p);
  });
  const close=document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기';
  close.addEventListener('click',()=>{ modal.style.display='none'; });
  box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(files); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box); modal.style.display='block';
}

// ===== Publications (Pubs) =====
async function loadPubs(){
  const entries = await fetchJSON('/assets/data/pubs.json');
  // normalization
  const items = entries.map(e=> ({
    id: e.id||'',
    date: (e.date||'').slice(0,10),
    title: e.title||'',
    authors: Array.isArray(e.authors)? e.authors : (typeof e.authors==='string' ? e.authors.split(',').map(s=>({name:s.trim()})) : []),
    abstract: e.abstract||'',
    pdf: normalizeAssetUrl(e.pdf||''),
    volume: Number(e.volume||0),
    issue: Number(e.issue||0),
    pages: e.pages||'',
    doi: e.doi||''
  }));
  // Containers
  const board = document.querySelector('#pubs-board');
  const archive = document.querySelector('#pubs-archive');
  if (board) renderPubsBoard(items);
  if (archive) renderPubsArchive(items);
  // Deep link
  if (location.hash){
    const params = Object.fromEntries(new URLSearchParams(location.hash.replace(/^#/, '').replace(/&/g,'&')).entries());
    const v = Number(params.vol||params.volume||0);
    const i = Number(params.issue||0);
    const pid = params.paper||params.id||'';
    if (archive) renderPubsArchive(items, v, i, pid);
  }
}

function renderPubsBoard(items){
  const el = document.querySelector('#pubs-board'); if(!el) return;
  el.innerHTML = '';
  // Group by volume/issue desc
  items.sort((a,b)=> (b.volume - a.volume) || (b.issue - a.issue) || (a.pages||'').localeCompare(b.pages||''));
  items.forEach(it=>{
    const card=document.createElement('article'); card.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a'); a.href='javascript:void(0)'; a.textContent=it.title;
    a.addEventListener('click',()=>openPubModal(it)); h3.appendChild(a);
    const meta=document.createElement('div'); meta.className='muted'; 
    meta.textContent = `Vol.${it.volume} No.${it.issue}` + (it.pages? ` · pp.${it.pages}`:'') + (it.date? ` · ${it.date}`:'');
    const auth=document.createElement('div'); auth.className='muted';
    auth.textContent = (it.authors||[]).map(a=> (typeof a==='string'?a:(a.name||'')) ).filter(Boolean).join(', ');
    const btns=document.createElement('div');
    if(it.pdf){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.pdf; b.target='_blank'; b.textContent='PDF'; btns.appendChild(b); }
    if(it.doi){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.doi; b.target='_blank'; b.textContent='DOI'; btns.appendChild(b); }
    card.appendChild(h3); card.appendChild(auth); card.appendChild(meta); card.appendChild(btns);
    el.appendChild(card);
  });
}

function renderPubsArchive(items, volFilter=0, issueFilter=0, paperId=''){
  const el = document.querySelector('#pubs-archive'); if(!el) return;
  el.innerHTML = '';
  // Build volumes map
  const groups = {};
  items.forEach(it=>{
    const v=it.volume||0, i=it.issue||0;
    if(!groups[v]) groups[v] = {};
    if(!groups[v][i]) groups[v][i] = [];
    groups[v][i].push(it);
  });
  const vols = Object.keys(groups).map(n=>Number(n)).sort((a,b)=>b-a);
  // Controls
  const nav=document.createElement('div'); nav.className='pubs-nav';
  vols.forEach(v=>{
    const volBtn=document.createElement('button'); volBtn.className='btn btn-sm'; volBtn.textContent='Vol. '+v;
    volBtn.addEventListener('click',()=>renderPubsArchive(items, v, 0, ''));
    nav.appendChild(volBtn);
    if(volFilter===v){
      const issues = Object.keys(groups[v]).map(n=>Number(n)).sort((a,b)=>b-a);
      const wrap=document.createElement('span'); wrap.style.marginLeft='6px';
      issues.forEach(i=>{
        const ib=document.createElement('button'); ib.className='btn btn-sm'; ib.textContent='No. '+i;
        ib.addEventListener('click',()=>renderPubsArchive(items, v, i, ''));
        wrap.appendChild(ib);
      });
      nav.appendChild(wrap);
    }
  });
  el.appendChild(nav);
  // List
  let list=[];
  vols.forEach(v=>{
    Object.keys(groups[v]).forEach(i=>{
      const issueNum=Number(i);
      groups[v][i].sort((a,b)=> (a.pages||'').localeCompare(b.pages||''));
    });
  });
  if(volFilter && issueFilter){
    list = groups[volFilter]?.[issueFilter] || [];
  }else if(volFilter){
    // flatten all issues in this volume
    list = Object.values(groups[volFilter]||{}).flat();
  }else{
    list = items.slice();
  }
  const wrap=document.createElement('div'); wrap.className='pubs-list';
  list.forEach(it=>{
    const row=document.createElement('article'); row.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a'); a.href='javascript:void(0)'; a.textContent=it.title;
    a.addEventListener('click',()=>openPubModal(it));
    h3.appendChild(a);
    const meta=document.createElement('div'); meta.className='muted'; meta.textContent=`Vol.${it.volume} No.${it.issue}` + (it.pages? ` · pp.${it.pages}`:'') + (it.date? ` · ${it.date}`:'');
    const auth=document.createElement('div'); auth.className='muted'; auth.textContent=(it.authors||[]).map(a=> (typeof a==='string'?a:(a.name||'')) ).filter(Boolean).join(', ');
    const btns=document.createElement('div');
    if(it.pdf){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.pdf; b.target='_blank'; b.textContent='PDF'; btns.appendChild(b); }
    if(it.doi){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.doi; b.target='_blank'; b.textContent='DOI'; btns.appendChild(b); }
    row.appendChild(h3); row.appendChild(auth); row.appendChild(meta); row.appendChild(btns);
    wrap.appendChild(row);
  });
  el.appendChild(wrap);
  // Deep link open
  if(paperId){
    const t=list.find(x=>x.id===paperId); if(t) openPubModal(t);
  }
}

function openPubModal(it){
  let modal=document.getElementById('pubs-modal');
  if(!modal){ modal=document.createElement('div'); modal.id='pubs-modal'; document.body.appendChild(modal); }
  modal.className='news-modal'; modal.innerHTML='';
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  const box=document.createElement('div'); box.className='modal-box';
  const title=document.createElement('h3'); title.textContent=it.title||'';
  const meta=document.createElement('div'); meta.className='muted'; meta.textContent=`Vol.${it.volume} No.${it.issue}` + (it.pages? ` · pp.${it.pages}`:'') + (it.date? ` · ${it.date}`:'');
  const auth=document.createElement('div'); auth.className='muted'; auth.textContent=(it.authors||[]).map(a=> (typeof a==='string'?a:(a.name||'')) ).filter(Boolean).join(', ');
  const body=document.createElement('div'); body.className='modal-body';
  if(it.abstract && it.abstract.indexOf('<')===-1 && window.marked){
    body.innerHTML = window.marked.parse(it.abstract);
  } else {
    body.innerHTML = it.abstract || '';
  }
  const actions=document.createElement('div'); 
  if(it.pdf){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.pdf; b.target='_blank'; b.textContent='PDF'; actions.appendChild(b); }
  if(it.doi){ const b=document.createElement('a'); b.className='btn btn-sm'; b.href=it.doi; b.target='_blank'; b.textContent='DOI'; actions.appendChild(b); }
  const close=document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기'; close.addEventListener('click',()=>{ modal.style.display='none'; });
  box.appendChild(title); box.appendChild(auth); box.appendChild(meta); box.appendChild(body); box.appendChild(actions); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box); modal.style.display='block';
}

document.addEventListener('DOMContentLoaded', function(){
  loadNews();
  loadPubs();
});
