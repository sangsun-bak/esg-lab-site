
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function normalizeNewsData(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

// Try multiple paths so it works on file:// and on Netlify
async function tryFetchJson(urls) {
  for (const u of urls) {
    try {
      const bust = u + (u.includes('?') ? '&' : '?') + 'v=' + Date.now();
      const res = await fetch(bust, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) { /* continue */ }
  }
  throw new Error('All fetch attempts failed: ' + urls.join(', '));
}
function candidatePaths(rel) {
  const baseRel = rel.startsWith('./') ? rel : './' + rel;
  const absRoot = '/' + rel.replace(/^\.?\//,'');
  const resolved = new URL(rel, document.baseURI).pathname;
  return [baseRel, rel, resolved, absRoot];
}

async function loadNewsData() {
  try {
    const raw = await tryFetchJson(candidatePaths('assets/data/news.json'));
    const items = normalizeNewsData(raw);
    items.sort((a,b)=> (a.date < b.date ? 1 : -1)); // newest first
    return items;
  } catch (e) {
    console.error(e);
    return [];
  }
}

function mdToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
  return html;
}
function formatDate(iso) {
  try { const [y,m,d] = iso.split('-').map(Number); return `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')}`; }
  catch(e){ return iso; }
}
function buildListItem(post) {
  const tags = (post.tags||[]).map(t=>`<span class="tag">${t}</span>`).join(' ');
  const href = post.href || (`news.html#post/${post.id}`);
  return `<li class="board-row" data-id="${post.id}">
    <div class="col title"><a href="${href}">${post.title}</a></div>
    <div class="col date">${formatDate(post.date||'')}</div>
    <div class="col tags">${tags}</div>
  </li>`;
}
function renderPagination(total, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  let html = '';
  for (let p=1; p<=totalPages; p++) html += `<button class="page-btn ${p===page?'active':''}" data-page="${p}">${p}</button>`;
  return html;
}

async function renderBoard() {
  const listWrap = $('#board-list');
  const pager = $('#board-pager');
  const searchInput = $('#board-search');
  const tagWrap = $('#board-tags');

  const items = await loadNewsData();
  const allTags = Array.from(new Set(items.flatMap(it => it.tags || [])));
  tagWrap.innerHTML = allTags.map(t=>`<button class="tag-filter" data-tag="${t}">${t}</button>`).join('');

  let state = { q:'', tag:null, page:1, perPage:10 };

  function applyFilters() {
    let filtered = items.slice();
    if (state.q) {
      const q = state.q.toLowerCase();
      filtered = filtered.filter(it => (it.title||'').toLowerCase().includes(q) || (it.body||'').toLowerCase().includes(q));
    }
    if (state.tag) filtered = filtered.filter(it => (it.tags||[]).includes(state.tag));
    const total = filtered.length;
    const start = (state.page-1)*state.perPage;
    const pageItems = filtered.slice(start, start + state.perPage);
    listWrap.innerHTML = '<ul class="board-table">' + pageItems.map(buildListItem).join('') + '</ul>';
    pager.innerHTML = renderPagination(total, state.page, state.perPage);
  }

  if (searchInput) searchInput.addEventListener('input', (e)=>{ state.q = e.target.value.trim(); state.page=1; applyFilters(); });
  if (tagWrap) tagWrap.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tag-filter'); if (!btn) return;
    state.tag = (state.tag === btn.dataset.tag) ? null : btn.dataset.tag;
    $all('.tag-filter').forEach(b=>b.classList.toggle('active', b===btn && state.tag));
    state.page = 1; applyFilters();
  });
  if (pager) pager.addEventListener('click', (e)=>{
    const b = e.target.closest('.page-btn'); if (!b) return;
    state.page = parseInt(b.dataset.page,10)||1; applyFilters();
  });

  applyFilters();
}

async function renderPostDetail(postId) {
  const items = await loadNewsData();
  const post = items.find(it => it.id === postId);
  const wrap = $('#board-detail');
  if (!post) { wrap.innerHTML = '<p>해당 글을 찾을 수 없습니다.</p>'; return; }
  const files = (post.attachments||[]).map(a=>{
    const label = a.label || (a.file||'').split('/').pop();
    return `<li><a href="${a.file}" target="_blank" rel="noopener">${label}</a></li>`;
  }).join('');
  wrap.innerHTML = `
    <article class="post">
      <h2 class="post-title">${post.title}</h2>
      <div class="post-meta">${formatDate(post.date||'')} ${(post.tags||[]).map(t=>`<span class="tag">${t}</span>`).join(' ')}</div>
      <div class="post-body">${mdToHtml(post.body||'')}</div>
      ${ files ? `<h3 class="attach-title">첨부파일</h3><ul class="attach-list">${files}</ul>` : ''}
      <p class="back"><a href="#list">← 목록으로</a></p>
    </article>`;
}

// Populate main page brief with latest 3
async function renderNewsBriefHome() {
  const brief = document.getElementById('news-brief');
  if (!brief) return;
  const items = await loadNewsData();
  brief.innerHTML = '';
  items.slice(0,3).forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = it.href || ('news.html#post/' + it.id);
    a.textContent = `(${it.date}) ${it.title}`;
    li.appendChild(a);
    brief.appendChild(li);
  });
}

function router() {
  const listSec = $('#board-sec-list');
  const detailSec = $('#board-sec-detail');
  const hash = location.hash || '#list';
  if (listSec && detailSec) {
    if (hash.startsWith('#post/')) {
      const postId = hash.replace('#post/','');
      listSec.style.display = 'none';
      detailSec.style.display = 'block';
      renderPostDetail(postId);
    } else {
      listSec.style.display = 'block';
      detailSec.style.display = 'none';
      renderBoard();
    }
  }
}

window.addEventListener('hashchange', router);
document.addEventListener('DOMContentLoaded', ()=>{
  router();
  renderNewsBriefHome();
});
