
// --- helpers ---
function normalizeUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return u;
  // remove leading ./ or sbr/ relative pieces and force root-absolute
  return '/' + u.replace(/^(\.\/)+/, '').replace(/^sbr\//, '');
}

async function fetchJsonNoStore(path) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    return await res.json();
  } catch (e) {
    console.error('fetch failed', path, e);
    return null;
  }
}

// --- pubs ---
async function fetchPubsEntries() {
  const data = await fetchJsonNoStore('/assets/data/pubs.json');
  if (!data) return [];
  const arr = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);
  const norm = arr.map(x => ({
    id: x.id || '',
    date: (x.date || '').slice(0,10),
    title: x.title || '',
    authors: Array.isArray(x.authors) ? x.authors.map(a => (a.name || a)).filter(Boolean) : (x.authors ? String(x.authors).split(/[;,]/).map(s=>s.trim()) : []),
    abstract: x.abstract || '',
    volume: typeof x.volume === 'number' ? x.volume : parseInt(x.volume,10) || 0,
    issue: typeof x.issue === 'number' ? x.issue : parseInt(x.issue,10) || 0,
    pages: x.pages || '',
    doi: x.doi || '',
    pdf: normalizeUrl(x.pdf || (x.file || ''))
  }));
  // sort by volume desc, then issue desc, then pages/ title
  norm.sort((a,b) => (b.volume - a.volume) || (b.issue - a.issue) || (a.pages||'').localeCompare(b.pages||'') || a.title.localeCompare(b.title));
  return norm;
}

function ensureMarked(callback){
  if (window.marked) return callback();
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
  s.onload = callback;
  document.head.appendChild(s);
}

function renderPubsArchive(entries){
  const root = document.getElementById('pubs-archive');
  if (!root) return;
  // Clear any placeholder content
  root.innerHTML = '';

  // group by volume then issue
  const byVol = new Map();
  entries.forEach(e => {
    if (!byVol.has(e.volume)) byVol.set(e.volume, new Map());
    const byIssue = byVol.get(e.volume);
    if (!byIssue.has(e.issue)) byIssue.set(e.issue, []);
    byIssue.get(e.issue).push(e);
  });

  // sort volumes desc
  const vols = Array.from(byVol.keys()).sort((a,b)=>b-a);
  vols.forEach(v => {
    const h2 = document.createElement('h2');
    h2.textContent = `Vol.${v}`;
    root.appendChild(h2);
    const byIssue = byVol.get(v);
    const issues = Array.from(byIssue.keys()).sort((a,b)=>b-a);
    issues.forEach(i => {
      const h3 = document.createElement('h3');
      h3.textContent = `No.${i}`;
      root.appendChild(h3);
      const list = document.createElement('div');
      list.className = 'paper-list';
      byIssue.get(i).forEach(p => {
        const art = document.createElement('article');
        art.className = 'paper';
        const h4 = document.createElement('h4');
        h4.textContent = p.title;
        const meta = document.createElement('div');
        meta.className = 'muted';
        meta.textContent = (p.authors && p.authors.length ? '저자: ' + p.authors.join(' · ') + ' · ' : '') + (p.pages || '');
        const actions = document.createElement('div');
        actions.className = 'paper-meta';
        if (p.pdf) {
          const a = document.createElement('a');
          a.href = normalizeUrl(p.pdf);
          a.className = 'btn btn-sm';
          a.textContent = 'PDF';
          a.setAttribute('download','');
          actions.appendChild(a);
        }
        if (p.doi) {
          const a2 = document.createElement('a');
          a2.href = /^https?:\/\//.test(p.doi) ? p.doi : ('https://doi.org/' + p.doi);
          a2.className = 'link';
          a2.target = '_blank';
          a2.rel = 'noopener';
          a2.textContent = 'DOI';
          actions.appendChild(a2);
        }
        const more = document.createElement('a');
        more.href = 'javascript:void(0)';
        more.className = 'link';
        more.textContent = '초록 보기';
        more.addEventListener('click', ()=> openPubModal(p));
        actions.appendChild(more);

        art.appendChild(h4);
        art.appendChild(meta);
        art.appendChild(actions);
        list.appendChild(art);
      });
      root.appendChild(list);
    });
  });
}

function openPubModal(item){
  ensureMarked(()=>{
    let modal = document.getElementById('pubs-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pubs-modal';
      document.body.appendChild(modal);
    }
    modal.className = 'news-modal';
    modal.innerHTML = '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    const title = document.createElement('h3'); title.textContent = item.title;
    const meta = document.createElement('div'); meta.className = 'muted';
    meta.textContent = `Vol.${item.volume} No.${item.issue}` + (item.pages ? ` · ${item.pages}` : '');
    const body = document.createElement('div'); body.className = 'modal-body';
    try {
      body.innerHTML = window.marked.parse(item.abstract || '');
    } catch(e) {
      body.textContent = item.abstract || '';
    }
    const actions = document.createElement('div'); actions.style.marginTop = '.8rem';
    if (item.pdf) {
      const a = document.createElement('a');
      a.href = normalizeUrl(item.pdf);
      a.className = 'btn btn-sm';
      a.textContent = 'PDF 다운로드';
      a.setAttribute('download','');
      actions.appendChild(a);
    }
    if (item.doi) {
      const a2 = document.createElement('a');
      a2.href = /^https?:\/\//.test(item.doi) ? item.doi : ('https://doi.org/' + item.doi);
      a2.className = 'btn btn-sm';
      a2.textContent = 'DOI 열기';
      a2.target = '_blank'; a2.rel = 'noopener';
      actions.appendChild(a2);
    }
    const close = document.createElement('button'); close.className='btn btn-sm'; close.textContent='닫기';
    close.addEventListener('click', ()=>{ modal.style.display='none'; });
    box.appendChild(title); box.appendChild(meta); box.appendChild(body); box.appendChild(actions); box.appendChild(close);
    modal.appendChild(overlay); modal.appendChild(box);
    modal.style.display='block';
  });
}

async function bootPubs(){
  const entries = await fetchPubsEntries();
  renderPubsArchive(entries);
  // If we also have a board container on publications.html, render a flat list
  const board = document.getElementById('pubs-board');
  if (board) {
    board.innerHTML='';
    entries.forEach(p => {
      const card = document.createElement('article');
      card.className='news-item';
      const h = document.createElement('h3'); h.textContent = p.title;
      const m = document.createElement('div'); m.className='muted';
      m.textContent = `Vol.${p.volume} No.${p.issue}` + (p.pages ? ` · ${p.pages}` : '');
      const btns = document.createElement('div');
      if (p.pdf) {
        const a = document.createElement('a'); a.href = normalizeUrl(p.pdf); a.className='btn btn-sm'; a.textContent='PDF'; a.setAttribute('download','');
        btns.appendChild(a);
      }
      const more = document.createElement('a'); more.href='javascript:void(0)'; more.className='link'; more.textContent='초록';
      more.addEventListener('click', ()=> openPubModal(p));
      btns.appendChild(more);
      card.appendChild(h); card.appendChild(m); card.appendChild(btns);
      board.appendChild(card);
    });
  }
}

document.addEventListener('DOMContentLoaded', bootPubs);
