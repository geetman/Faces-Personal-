// ════════════════════════════════════════════════
//  ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗
// ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝
// ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
// ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
// ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
//  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝
// ════════════════════════════════════════════════
// 🔧 SWAP YOUR SUPABASE CREDENTIALS BELOW:
const SUPABASE_URL  = 'https://wxzjbubohefcajmbqndq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4empidWJvaGVmY2FqbWJxbmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDcyMTYsImV4cCI6MjA5NzcyMzIxNn0.x6f7WX_20c75XtzRi9IjG8XW7k8bRtOtjd65vnjpmRw';

// 🔑 APP PASSWORD — must match the value in Supabase
//    Create a table called `app_config` with column `key` (text) and `value` (text)
//    Insert one row: key = 'app_password', value = 'your-secret-passphrase'
//    The app checks this row on every unlock attempt.
// ════════════════════════════════════════════════

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Auth ───────────────────────────────────────
const authScreen = document.getElementById('auth-screen');
const appEl      = document.getElementById('app');
const authInput  = document.getElementById('auth-pw-input');
const authBtn    = document.getElementById('auth-btn');
const authError  = document.getElementById('auth-error');

if (sessionStorage.getItem('faces_auth') === '1') unlock();

async function tryAuth() {
  const pw = authInput.value.trim();
  if (!pw) { authError.textContent = 'Enter the passphrase.'; return; }
  authBtn.disabled = true; authBtn.textContent = 'Checking…';
  authError.textContent = '';
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'app_password')
      .single();
    if (error) throw error;
    if (data.value === pw) {
      sessionStorage.setItem('faces_auth', '1');
      unlock();
    } else {
      authError.textContent = 'Wrong passphrase. Try again.';
      authInput.value = '';
    }
  } catch(e) {
    authError.textContent = 'Could not reach the server. Check your config.';
    console.error(e);
  }
  authBtn.disabled = false; authBtn.textContent = 'Unlock →';
}

function unlock() {
  authScreen.style.display = 'none';
  appEl.classList.add('visible');
  init();
}

authBtn.addEventListener('click', tryAuth);
authInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryAuth(); });

// ─── State ──────────────────────────────────────
let allPeople = [];
let categories = [];
let activeCategory = 'all';
let searchQuery = '';
let editingId = null;
let pendingPhotoFile = null;

// ─── Init ────────────────────────────────────────
async function init() {
  await Promise.all([loadCategories(), loadPeople()]);
}

// ─── Categories ──────────────────────────────────
async function loadCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name');
  if (error) { showToast('Could not load categories', 'error'); return; }
  categories = data || [];
  renderFilterBar();
  populateCategorySelect();
}

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  bar.innerHTML = `<button class="filter-pill ${activeCategory==='all'?'active':''}" data-cat="all">All</button>`;
  categories.forEach(c => {
    const b = document.createElement('button');
    b.className = 'filter-pill' + (activeCategory === c.id ? ' active' : '');
    b.dataset.cat = c.id;
    b.textContent = c.name;
    bar.appendChild(b);
  });
  bar.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      bar.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    });
  });
}

function populateCategorySelect() {
  const sel = document.getElementById('f-category');
  sel.innerHTML = '<option value="">— choose —</option>';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name; sel.appendChild(o);
  });
}

// ─── People ──────────────────────────────────────
async function loadPeople() {
  document.getElementById('cards-container').innerHTML = '<div class="spinner"></div>';
  const { data, error } = await supabase.from('people').select('*').order('name');
  if (error) { showToast('Could not load people', 'error'); return; }
  allPeople = data || [];
  renderCards();
}

function getFiltered() {
  return allPeople.filter(p => {
    const matchCat = activeCategory === 'all' || p.relationship_category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.nickname||'').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
}

function getCatName(id) {
  const c = categories.find(c => c.id === id);
  return c ? c.name : '';
}

function renderCards() {
  const container = document.getElementById('cards-container');
  const people = getFiltered();

  if (!people.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-emoji">👤</div>
        <h3>${allPeople.length ? 'No matches' : 'No people yet'}</h3>
        <p>${allPeople.length ? 'Try a different filter or search.' : 'Tap ＋ to add your first person.'}</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'cards-grid';

  people.forEach(p => {
    const card = document.createElement('div');
    card.className = 'person-card';
    const photoHTML = p.photo_url
      ? `<img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}" loading="lazy">`
      : `<div class="card-photo-placeholder">${personEmoji(p.name)}</div>`;
    const catName = getCatName(p.relationship_category);
    card.innerHTML = `
      <div class="card-photo-wrap">${photoHTML}</div>
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        ${p.nickname ? `<div class="card-nick">"${escHtml(p.nickname)}"</div>` : ''}
        ${catName ? `<span class="card-cat">${escHtml(catName)}</span>` : ''}
        ${p.memory_hook ? `<div class="card-hook">${escHtml(p.memory_hook)}</div>` : ''}
        <div class="card-actions">
          <button class="card-action-btn" data-action="view" data-id="${p.id}">👁</button>
          <button class="card-action-btn" data-action="edit" data-id="${p.id}">✏️</button>
          <button class="card-action-btn del" data-action="delete" data-id="${p.id}">🗑</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);

  // card action events
  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view') openDetail(id);
      if (btn.dataset.action === 'edit') openEdit(id);
      if (btn.dataset.action === 'delete') deletePerson(id);
    });
  });
  // tap card = view detail
  grid.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => {
      const viewBtn = card.querySelector('[data-action="view"]');
      if (viewBtn) openDetail(viewBtn.dataset.id);
    });
  });
}

// ─── Search ──────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderCards();
});

// ─── Detail modal ────────────────────────────────
function openDetail(id) {
  const p = allPeople.find(x => x.id === id);
  if (!p) return;
  const catName = getCatName(p.relationship_category);
  const photoHTML = p.photo_url
    ? `<img src="${escHtml(p.photo_url)}" alt="${escHtml(p.name)}">`
    : `<div class="detail-photo-placeholder">${personEmoji(p.name)}</div>`;

  const content = document.getElementById('detail-content');
  // keep handle and close btn
  content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="modal-header" style="justify-content:flex-end; padding-bottom:0;">
      <button class="modal-close" id="detail-modal-close">✕</button>
    </div>
    <div class="detail-photo-wrap">${photoHTML}</div>
    <div class="detail-name">${escHtml(p.name)}</div>
    ${p.nickname ? `<div class="detail-nick">"${escHtml(p.nickname)}"</div>` : ''}
    ${catName ? `<span class="detail-cat">${escHtml(catName)}</span>` : ''}
    ${p.memory_hook ? `
      <div class="detail-hook-section">
        <div class="detail-hook-label">Memory Hook</div>
        <div class="detail-hook-text">${escHtml(p.memory_hook)}</div>
      </div>` : ''}
    <div class="detail-actions">
      <button class="detail-edit-btn" id="detail-edit-btn">✏️ Edit</button>
      <button class="detail-del-btn" id="detail-del-btn">🗑 Remove</button>
    </div>
    <div style="height:16px;"></div>
  `;

  document.getElementById('detail-modal-close').addEventListener('click', () => closeModal('detail-modal'));
  document.getElementById('detail-edit-btn').addEventListener('click', () => { closeModal('detail-modal'); openEdit(id); });
  document.getElementById('detail-del-btn').addEventListener('click', () => { closeModal('detail-modal'); deletePerson(id); });

  openModal('detail-modal');
}

// ─── Add / Edit form ─────────────────────────────
document.getElementById('open-add-btn').addEventListener('click', openAdd);

function openAdd() {
  editingId = null;
  pendingPhotoFile = null;
  resetForm();
  document.getElementById('form-modal-title').textContent = 'Add Person';
  document.getElementById('form-submit-btn').textContent = 'Save Person';
  openModal('form-modal');
}

function openEdit(id) {
  const p = allPeople.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  pendingPhotoFile = null;
  document.getElementById('edit-id').value = id;
  document.getElementById('f-name').value = p.name || '';
  document.getElementById('f-nick').value = p.nickname || '';
  document.getElementById('f-category').value = p.relationship_category || '';
  document.getElementById('f-hook').value = p.memory_hook || '';
  document.getElementById('form-modal-title').textContent = 'Edit Person';
  document.getElementById('form-submit-btn').textContent = 'Update Person';

  // Show existing photo
  if (p.photo_url) {
    document.getElementById('photo-preview-container').innerHTML =
      `<img src="${escHtml(p.photo_url)}" class="photo-preview">
       <div class="upload-label">Tap to change photo</div>`;
  } else {
    resetPhotoPreview();
  }
  openModal('form-modal');
}

function resetForm() {
  document.getElementById('edit-id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-nick').value = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-hook').value = '';
  resetPhotoPreview();
}

function resetPhotoPreview() {
  document.getElementById('photo-preview-container').innerHTML =
    `<span class="upload-icon">📷</span>
     <div class="upload-label">Tap to add photo</div>
     <div class="upload-sub">Their face is the key</div>`;
}

// Photo file input - REPLACED as requested
document.getElementById('photo-file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  resizeToBase64(file, 300, 300, 0.82).then(b64 => {
    pendingPhotoFile = b64; // now a base64 string, not a File
    document.getElementById('photo-preview-container').innerHTML =
      `<img src="${b64}" class="photo-preview">
       <div class="upload-label">Tap to change photo</div>`;
  });
});

function resizeToBase64(file, maxW, maxH, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      // crop to square from centre
      const size = Math.min(img.width, img.height);
      const sx = (img.width  - size) / 2;
      const sy = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width  = maxW;
      canvas.height = maxH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, maxW, maxH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Submit
document.getElementById('form-submit-btn').addEventListener('click', submitForm);

async function submitForm() {
  const name = document.getElementById('f-name').value.trim();
  const nick = document.getElementById('f-nick').value.trim();
  const cat  = document.getElementById('f-category').value;
  const hook = document.getElementById('f-hook').value.trim();

  if (!name) { showToast('Name is required', 'error'); return; }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true;
  btn.textContent = editingId ? 'Updating…' : 'Saving…';

  try {
    let photoUrl = null;

    // Upload photo if new file chosen - REPLACED as requested
    // No upload needed — photo is already a base64 string in pendingPhotoFile
    if (pendingPhotoFile) {
      photoUrl = pendingPhotoFile;
    }

    if (editingId) {
      const updates = { name, nickname: nick, relationship_category: cat || null, memory_hook: hook };
      if (photoUrl) updates.photo_url = photoUrl;
      const { error } = await supabase.from('people').update(updates).eq('id', editingId);
      if (error) throw error;
      showToast('Updated ✓', 'success');
    } else {
      const { error } = await supabase.from('people').insert({
        name, nickname: nick, relationship_category: cat || null,
        memory_hook: hook, photo_url: photoUrl
      });
      if (error) throw error;
      showToast('Person added ✓', 'success');
    }

    closeModal('form-modal');
    await loadPeople();
  } catch(e) {
    showToast('Save failed: ' + e.message, 'error');
    console.error(e);
  }

  btn.disabled = false;
  btn.textContent = editingId ? 'Update Person' : 'Save Person';
}

// ─── Delete ──────────────────────────────────────
async function deletePerson(id) {
  const p = allPeople.find(x => x.id === id);
  if (!confirm(`Remove ${p?.name}? This can't be undone.`)) return;
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Removed', 'success');
  await loadPeople();
}

// ─── Modal helpers ───────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.getElementById('form-modal-close').addEventListener('click', () => closeModal('form-modal'));
document.getElementById('form-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('form-modal')) closeModal('form-modal');
});
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('detail-modal')) closeModal('detail-modal');
});

// ─── Toast ───────────────────────────────────────
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Utils ───────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function personEmoji(name) {
  const emojis = ['🧑','👩','👨','🧒','👴','👵','🙎','🙍'];
  return emojis[(name||'').charCodeAt(0) % emojis.length];
}
