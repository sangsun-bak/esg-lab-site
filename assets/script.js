document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [news, pubs] = await Promise.all([fetchNews(), fetchPubs()]);
    renderNewsBoard(news);
    renderLatest3(news);
    renderPubsBoard(pubs);
    renderPubsArchive(pubs);
  } catch(e) {
    console.error(e);
  }
  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load '+url);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.entries)) return data.entries;
  return [];
}

async function fetchNews(){ try { 
  return (await fetchJson('/assets/data/news.json'))
    .map(x=>({id:x.id||'', date:(x.date||'').slice(0,10), title:x.title||'', content:x.content||'', attachments:Array.isArray(x.attachments)?x.attachments:[]}))
    .sort((a,b)=> (b.date||'').localeCompare(a.date||''));
} catch(e){ console.warn('news.json missing'); return []; }}

async function fetchPubs(){ try { 
  return (await fetchJson('/assets/data/pubs.json'))
    .map(x=>({id:x.id||'', date:(x.date||'').slice(0,10), title:x.title||'', abstract:x.abstract||'', pdf:normalizeUrl(x.pdf), volume:Number(x.volume||0), issue:Number(x.issue||0), pages:x.pages||'', doi:x.doi||'', authors:Array.isArray(x.authors)?x.authors:[]}))
    .sort((a,b)=> (b.volume-a.volume) || (b.issue-a.issue) || (a.pages||'').localeCompare(b.pages||''));
} catch(e){ console.warn('pubs.json missing'); return []; }}

function normalizeUrl(u){ if(!u) return ''; if(/^https?:\/\//i.test(u)) return u; if(u.startsWith('/')) return u; return '/'+u.replace(/^\.?\//,''); }

function renderLatest3(entries){
  const ul = document.querySelector('#latest-news .news-list') || document.getElementById('news-brief');
  if (!ul) return;
  ul.innerHTML = '';
  entries.slice(0,3).forEach(it=>{
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '/news.html#'+encodeURIComponent(it.id);
    a.textContent = `[${it.date}] ${it.title}`;
    li.appendChild(a);
    ul.appendChild(li);
  });
}

function renderNewsBoard(entries){
  const root = document.getElementById('news-board');
  if (!root) return;
  root.innerHTML = '';
  entries.forEach(it=>{
    const art = document.createElement('article'); art.className='news-item';
    const h3 = document.createElement('h3'); const a = document.createElement('a'); a.href='javascript:void(0)'; a.textContent=it.title;
    a.onclick=()=>openNewsModal(it); h3.appendChild(a);
    const meta = document.createElement('div'); meta.className='muted'; meta.textContent=it.date;
    const ex = document.createElement('div'); ex.className='excerpt'; ex.textContent=(stripMd(it.content).slice(0,160));
    art.append(h3, meta, ex); root.appendChild(art);
  });
  if (location.hash) {
    const id = decodeURIComponent(location.hash.substring(1));
    const target = entries.find(e=>e.id===id);
    if (target) openNewsModal(target);
  }
}

function renderPubsBoard(entries){
  const root = document.getElementById('pubs-board');
  if (!root) return;
  root.innerHTML='';
  const params = new URLSearchParams(location.hash.replace(/^#/,''));
  const v = Number(params.get('vol'))||null;
  const i = Number(params.get('issue'))||null;
  let list = entries.slice();
  if (v!=null) list = list.filter(e=>e.volume===v);
  if (i!=null) list = list.filter(e=>e.issue===i);
  // Vol/Issue selector
  const vols = [...new Set(entries.map(e=>e.volume))].sort((a,b)=>b-a);
  const volWrap = document.createElement('div'); volWrap.className='row';
  vols.forEach(vol=>{
    const btn=document.createElement('button'); btn.className='btn btn-sm'; btn.textContent='Vol.'+vol;
    btn.onclick=()=>{ location.hash='#vol='+vol; renderPubsBoard(entries); };
    volWrap.appendChild(btn);
  });
  root.appendChild(volWrap);
  if (v!=null){
    const issues=[...new Set(entries.filter(e=>e.volume===v).map(e=>e.issue))].sort((a,b)=>b-a);
    const issueWrap = document.createElement('div'); issueWrap.className='row';
    issues.forEach(is=>{ const b=document.createElement('button'); b.className='btn btn-sm'; b.textContent='No.'+is; b.onclick=()=>{ location.hash='#vol='+v+'&issue='+is; renderPubsBoard(entries); }; issueWrap.appendChild(b); });
    root.appendChild(issueWrap);
  }
  list.forEach(it=>{
    const art=document.createElement('article'); art.className='news-item';
    const h3=document.createElement('h3'); const a=document.createElement('a'); a.href='javascript:void(0)'; a.textContent=it.title;
    a.onclick=()=>openPubModal(it); h3.appendChild(a);
    const meta=document.createElement('div'); meta.className='muted';
    meta.textContent = `Vol.${it.volume} No.${it.issue}${it.pages? ' · pp.'+it.pages:''}`;
    art.append(h3, meta); root.appendChild(art);
  });
  // deep-link to paper
  const p = new URLSearchParams(location.hash.replace(/^#/,'')).get('paper');
  if (p){ const t=list.find(e=>e.id===p) || entries.find(e=>e.id===p); if (t) openPubModal(t); }
}

function renderPubsArchive(entries){
  const root = document.getElementById('pubs-archive');
  if (!root) return;
  root.innerHTML='';
  const grouped = {};
  entries.forEach(e=>{
    const key = 'Vol.'+e.volume+' / No.'+e.issue;
    grouped[key] = grouped[key] || [];
    grouped[key].push(e);
  });
  Object.keys(grouped).sort((a,b)=>{
    const [av,ai]=a.match(/\d+/g).map(Number);
    const [bv,bi]=b.match(/\d+/g).map(Number);
    return (bv-av)||(bi-ai);
  }).forEach(key=>{
    const block=document.createElement('section'); const h=document.createElement('h3'); h.textContent=key; block.appendChild(h);
    const ul=document.createElement('ul');
    grouped[key].sort((a,b)=> (a.pages||'').localeCompare(b.pages||'')).forEach(e=>{
      const li=document.createElement('li'); const a=document.createElement('a'); a.href='javascript:void(0)'; a.textContent = e.title + (e.pages? ' (pp.'+e.pages+')':'');
      a.onclick=()=>openPubModal(e); li.appendChild(a); ul.appendChild(li);
    });
    block.appendChild(ul); root.appendChild(block);
  });
}

function stripMd(md){ return (md||'').replace(/[#*_>`~\-!\[\]\(\)]/g,' ').replace(/\s+/g,' ').trim(); }

function ensureMarked(cb){
  if (window.marked) return cb();
  const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/marked/marked.min.js'; s.onload=cb; document.head.appendChild(s);
}

function openNewsModal(item){
  ensureMarked(()=>{
    const m = getModal(); m.innerHTML='';
    const box = modalBox();
    box.append(h3(item.title), small(item.date));
    const body=document.createElement('div'); body.className='modal-body';
    try{ body.innerHTML = (item.content && /<\w+/.test(item.content)) ? item.content : window.marked.parse(item.content||''); }catch(e){ body.textContent=item.content||''; }
    // attachments
    if (item.attachments && item.attachments.length){
      const ul=document.createElement('ul'); item.attachments.forEach(att=>{ const li=document.createElement('li'); const a=document.createElement('a'); a.href=normalizeUrl(att.file||att.url||''); a.target='_blank'; a.textContent=att.name||att.file||'첨부'; li.appendChild(a); ul.appendChild(li); });
      box.append(ul);
    }
    box.append(closeBtn(m));
    m.append(overlay(m), box); m.style.display='block';
  });
}

function openPubModal(item){
  ensureMarked(()=>{
    const m = getModal(); m.innerHTML='';
    const box = modalBox();
    box.append(h3(item.title), small(`Vol.${item.volume} No.${item.issue}${item.pages?' · pp.'+item.pages:''}`));
    const abs=document.createElement('div'); abs.className='modal-body';
    try{ abs.innerHTML = (item.abstract && /<\w+/.test(item.abstract)) ? item.abstract : window.marked.parse(item.abstract||''); }catch(e){ abs.textContent=item.abstract||''; }
    box.append(abs);
    const act=document.createElement('div'); 
    if (item.pdf){ const pdf=document.createElement('a'); pdf.className='btn btn-sm'; pdf.href=normalizeUrl(item.pdf); pdf.target='_blank'; pdf.textContent='PDF'; act.appendChild(pdf); }
    if (item.doi){ const doi=document.createElement('a'); doi.className='btn btn-sm'; doi.href=item.doi; doi.target='_blank'; doi.textContent='DOI'; act.appendChild(doi); }
    box.append(act);
    box.append(closeBtn(m));
    m.append(overlay(m), box); m.style.display='block';
  });
}

function getModal(){ let m=document.getElementById('pubs-modal')||document.getElementById('news-modal'); if (m) return m; m=document.createElement('div'); m.id='modal'; document.body.appendChild(m); return m; }
function modalBox(){ const box=document.createElement('div'); box.className='modal-box'; return box; }
function overlay(m){ const o=document.createElement('div'); o.className='modal-overlay'; o.onclick=()=>{m.style.display='none'}; return o; }
function closeBtn(m){ const b=document.createElement('button'); b.className='btn btn-sm'; b.textContent='닫기'; b.onclick=()=>{m.style.display='none'}; return b; }
function h3(t){ const e=document.createElement('h3'); e.textContent=t; return e; }
function small(t){ const e=document.createElement('div'); e.className='muted'; e.textContent=t; return e; }
