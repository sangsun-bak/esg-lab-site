
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


// ===== Helpers =====
function ensureMarked(cb){
  if (window.marked) return cb();
  var s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/marked/marked.min.js'; 
  s.onload=cb; document.head.appendChild(s);
}
function normalizeAssetUrl(u){
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return u;
  if (u.startsWith('assets/')) return '/'+u;
  return '/assets/'+u.replace(/^\/+/,''); // fallback
}

// ===== News =====
async function fetchNewsEntries(){
  try{
    const res=await fetch('/assets/data/news.json',{cache:'no-store'});
    const data=await res.json();
    const arr=Array.isArray(data)?data:(Array.isArray(data.entries)?data.entries:[]);
    const norm=arr.map(x=>({
      id:x.id||'',
      date:(x.date||'').slice(0,10),
      title:x.title||'',
      content:x.content||'',
      attachments:Array.isArray(x.attachments)?x.attachments:[]
    }));
    norm.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return norm;
  }catch(e){console.error('news load fail',e);return []}
}

function renderLatest3News(entries){
  // Try to inject into an existing notice list if present
  const targets = [
    document.querySelector('#latest-news .news-list'),
    document.querySelector('.notice .news-list'),
    document.querySelector('.notice ul'),
    document.querySelector('#news-brief')
  ];
  const list = targets.find(Boolean);
  if (!list) return;
  list.innerHTML='';
  entries.slice(0,3).forEach(item=>{
    const li=document.createElement('li');
    const a=document.createElement('a');
    a.href='/news.html#'+encodeURIComponent(item.id);
    a.textContent=`[${item.date}] ${item.title}`;
    li.appendChild(a);
    list.appendChild(li);
  });
}

function renderNewsBoard(entries){
  const board=document.querySelector('#news-board'); if (!board) return;
  board.innerHTML='';
  entries.forEach(item=>{
    const card=document.createElement('article'); card.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a');
    a.href='javascript:void(0)'; a.textContent=item.title; a.addEventListener('click',()=>openNewsModal(item));
    h3.appendChild(a);
    const meta=document.createElement('div'); meta.className='muted'; meta.textContent=item.date;
    const excerpt=document.createElement('div'); excerpt.className='excerpt';
    const tmp=document.createElement('div'); tmp.innerHTML=item.content||'';
    const text=(tmp.textContent||'').trim().slice(0,160); excerpt.textContent=text;
    card.appendChild(h3); card.appendChild(meta); card.appendChild(excerpt);
    board.appendChild(card);
  });
  if (location.hash){
    const id=decodeURIComponent(location.hash.substring(1));
    const target=entries.find(e=>e.id===id); if (target) openNewsModal(target);
  }
}

function openNewsModal(item){
  let modal=document.getElementById('news-modal'); if (!modal){ modal=document.createElement('div'); modal.id='news-modal'; document.body.appendChild(modal); }
  modal.className='news-modal'; modal.innerHTML='';
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  const box=document.createElement('div'); box.className='modal-box';
  const title=document.createElement('h3'); title.textContent=item.title;
  const meta=document.createElement('div'); meta.className='muted'; meta.textContent=item.date;
  const body=document.createElement('div'); body.className='modal-body';
  ensureMarked(()=>{ try{ body.innerHTML = item.content && item.content.trim().startsWith('<') ? item.content : marked.parse(item.content||''); }catch(e){ body.textContent=item.content||''; } });
  const files=document.createElement('div');
  if (item.attachments && item.attachments.length){
    const ul=document.createElement('ul');
    item.attachments.forEach(att=>{
      const li=document.createElement('li'); const a=document.createElement('a');
      a.href=normalizeAssetUrl(att.file||att.url||'#'); a.target='_blank'; a.textContent=att.name||att.file||'첨부파일';
      li.appendChild(a); ul.appendChild(li);
    }); files.appendChild(ul);
  }
  const close=document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기'; close.addEventListener('click',()=>{modal.style.display='none';});
  box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(files); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box); modal.style.display='block';
}

// ===== Publications (Vol/Issue → Papers) =====
async function fetchPubsEntries(){
  try{
    const res=await fetch('/assets/data/pubs.json',{cache:'no-store'});
    const data=await res.json();
    const arr=Array.isArray(data)?data:(Array.isArray(data.entries)?data.entries:[]);
    return arr.map(x=>({
      id:x.id||'',
      date:(x.date||'').slice(0,10),
      title:x.title||'',
      authors:Array.isArray(x.authors)?x.authors:[],
      abstract:x.abstract||'',
      volume:parseInt(x.volume||0,10)||0,
      issue:parseInt(x.issue||0,10)||0,
      pages:x.pages||'',
      doi:x.doi||'',
      pdf:normalizeAssetUrl(x.pdf||'')
    }));
  }catch(e){console.error('pubs load fail',e);return []}
}

function groupByVolIssue(entries){
  const map={};
  entries.forEach(e=>{
    const v=e.volume||0, i=e.issue||0;
    if(!map[v]) map[v]={};
    if(!map[v][i]) map[v][i]=[];
    map[v][i].push(e);
  });
  return map;
}

function renderPubsBoard(entries){
  const root=document.querySelector('#pubs-board'); if(!root) return;
  const map=groupByVolIssue(entries);
  const vols=Object.keys(map).map(Number).sort((a,b)=>b-a);
  const params=new URLSearchParams(location.hash.replace('#',''));
  let selV=parseInt(params.get('vol')||0,10);
  let selI=parseInt(params.get('issue')||0,10);
  root.innerHTML='';
  // Vol buttons
  const vWrap=document.createElement('div'); vWrap.className='vol-wrap';
  vols.forEach(v=>{
    const btn=document.createElement('button'); btn.className='btn btn-sm'; btn.textContent='Vol.'+v;
    btn.addEventListener('click',()=>{ location.hash=`vol=${v}`; renderPubsBoard(entries); });
    if (v===selV) btn.style.fontWeight='700';
    vWrap.appendChild(btn);
  });
  root.appendChild(vWrap);
  if (!selV && vols.length){ selV=vols[0]; }
  // Issue buttons
  const issues=selV?Object.keys(map[selV]).map(Number).sort((a,b)=>b-a):[];
  const iWrap=document.createElement('div'); iWrap.className='issue-wrap';
  issues.forEach(i=>{
    const btn=document.createElement('button'); btn.className='btn btn-sm'; btn.textContent='No.'+i;
    btn.addEventListener('click',()=>{ location.hash=`vol=${selV}&issue=${i}`; renderPubsBoard(entries); });
    if (i===selI) btn.style.fontWeight='700';
    iWrap.appendChild(btn);
  });
  root.appendChild(iWrap);
  if (!selI && issues.length){ selI=issues[0]; }
  // Papers list
  const list=document.createElement('div'); list.className='paper-list';
  const papers=(map[selV]&&map[selV][selI])?map[selV][selI].slice():[];
  // sort by pages (if like "1–20")
  papers.sort((a,b)=>{
    const getFirst=(p)=>{const m=(p||'').match(/^\s*(\d+)/); return m?parseInt(m[1],10):0;}
    return getFirst(a.pages)-getFirst(b.pages);
  });
  papers.forEach(p=>{
    const item=document.createElement('article'); item.className='paper';
    const h3=document.createElement('h3'); h3.textContent=p.title;
    const meta=document.createElement('div'); meta.className='muted';
    const authors = p.authors.map(a=> (typeof a==='string'?a:(a.name||''))).filter(Boolean).join(' · ');
    meta.textContent=`${authors}${p.pages?(' · pp.'+p.pages):''}`;
    const row=document.createElement('div'); row.className='row';
    const btnPdf=document.createElement('a'); btnPdf.className='btn btn-sm'; btnPdf.href=p.pdf||'#'; btnPdf.target='_blank'; btnPdf.textContent='PDF';
    const btnAbs=document.createElement('button'); btnAbs.className='btn btn-sm'; btnAbs.textContent='초록 보기'; btnAbs.addEventListener('click',()=>openPubModal(p));
    row.appendChild(btnPdf); if (p.doi){ const a=document.createElement('a'); a.href=p.doi; a.target='_blank'; a.className='btn btn-sm'; a.textContent='DOI'; row.appendChild(a); } row.appendChild(btnAbs);
    item.appendChild(h3); item.appendChild(meta); item.appendChild(row);
    list.appendChild(item);
  });
  root.appendChild(list);
  // Deep link: #vol=..&issue=..&paper=id
  const params2=new URLSearchParams(location.hash.replace('#','')); const pid=params2.get('paper');
  if (pid){ const target = entries.find(x=>x.id===pid); if (target) openPubModal(target); }
}

function openPubModal(p){
  let modal=document.getElementById('pubs-modal'); if(!modal){ modal=document.createElement('div'); modal.id='pubs-modal'; document.body.appendChild(modal); }
  modal.className='news-modal'; modal.innerHTML='';
  const overlay=document.createElement('div'); overlay.className='modal-overlay';
  const box=document.createElement('div'); box.className='modal-box';
  const title=document.createElement('h3'); title.textContent=p.title;
  const meta=document.createElement('div'); meta.className='muted';
  const authors = p.authors.map(a=> (typeof a==='string'?a:(a.name||''))).filter(Boolean).join(' · ');
  meta.textContent=`Vol.${p.volume} · No.${p.issue}${p.pages?(' · pp.'+p.pages):''}${authors?' · '+authors:''}`;
  const body=document.createElement('div'); body.className='modal-body';
  ensureMarked(()=>{ try{ body.innerHTML = p.abstract && p.abstract.trim().startsWith('<') ? p.abstract : marked.parse(p.abstract||''); }catch(e){ body.textContent=p.abstract||''; } });
  const actions=document.createElement('div'); 
  if (p.pdf){ const a=document.createElement('a'); a.className='btn btn-sm'; a.href=p.pdf; a.target='_blank'; a.textContent='PDF 다운로드'; actions.appendChild(a); }
  if (p.doi){ const a2=document.createElement('a'); a2.className='btn btn-sm'; a2.href=p.doi; a2.target='_blank'; a2.textContent='DOI'; actions.appendChild(a2); }
  const close=document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기'; close.addEventListener('click',()=>{ modal.style.display='none'; });
  box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(actions); box.appendChild(close);
  modal.appendChild(overlay); modal.appendChild(box); modal.style.display='block';
}

// ===== Bootstrap on DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', async () => {
  const news = await fetchNewsEntries(); renderLatest3News(news); renderNewsBoard(news);
  const pubs = await fetchPubsEntries(); renderPubsBoard(pubs);
});
