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


/* === News rendering (auto from assets/data/news.json) === */
async function loadNewsData() {
  try {
    const url = '/assets/data/news.json?v=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load news.json: ' + res.status);
    const data = await res.json();
    data.sort((a,b)=> (a.date < b.date ? 1 : -1)); // newest first
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
  throw new Error('All fetch attempts failed: ' + urls.join(', '));
}

function candidatePaths(rel) {
  // Current directory relative path
  const loc = window.location;
  const baseRel = rel.startsWith('./') ? rel : './' + rel;
  const fromHere = baseRel;
  // Site root absolute (may fail on subpath deployments)
  const fromRoot = '/' + rel.replace(/^\.?\//, '');
  // Resolve against <base> or current URL
  const resolved = new URL(rel, document.baseURI).pathname;
  return [fromHere, resolved, fromRoot];
}

async function loadNewsData() {
  try {
    const url = '/assets/data/news.json?v=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load news.json: ' + res.status);
    const data = await res.json();
    data.sort((a,b)=> (a.date < b.date ? 1 : -1)); // newest first
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
    listEl.innerHTML = '<li>목록을 불러오지 못했습니다. 새로고침하거나 잠시 후 다시 시도해 주세요.</li>';
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
    li.innerHTML = `<a href="${it.href}">(${it.date}) ${it.title}</a>`;
    ul.appendChild(li);
  });
  wrap.appendChild(ul);
}

document.addEventListener('DOMContentLoaded', ()=>{
  if (document.getElementById('news-brief')) renderNewsBrief('news-brief', 4);
  if (document.getElementById('news-list-wrap')) renderNewsList('news-list-wrap');
});
