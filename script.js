// ════════════════════════════════════════════════
//  ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗
// ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝
// ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗
// ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║
// ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝
//  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
//  FACES — People Memory App  |  script.js v2
// ════════════════════════════════════════════════
// 🔧 SWAP YOUR SUPABASE CREDENTIALS BELOW:
const SUPABASE_URL  = 'https://wxzjbubohefcajmbqndq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4empidWJvaGVmY2FqbWJxbmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDcyMTYsImV4cCI6MjA5NzcyMzIxNn0.x6f7WX_20c75XtzRi9IjG8XW7k8bRtOtjd65vnjpmRw';
// ════════════════════════════════════════════════

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Tag colour palette (cycles) ────────────────
const TAG_COLOURS = [
  { bg: 'rgba(124,58,237,0.25)',  text: '#c4b5fd' },
  { bg: 'rgba(5,150,105,0.25)',   text: '#6ee7b7' },
  { bg: 'rgba(217,119,6,0.25)',   text: '#fcd34d' },
  { bg: 'rgba(37,99,235,0.25)',   text: '#93c5fd' },
  { bg: 'rgba(234,88,12,0.25)',   text: '#fdba74' },
  { bg: 'rgba(8,145,178,0.25)',   text: '#67e8f9' },
  { bg: 'rgba(220,38,38,0.25)',   text: '#fca5a5' },
  { bg: 'rgba(232,136,184,0.25)', text: '#f9a8d4' },
];
function tagColour(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLOURS.length;
  return TAG_COLOURS[h];
}

// ─── Totem emoji groups ──────────────────────────
const TOTEM_EMOJIS = [
  '😀','😎','🤓','🥳','😴','🤩','🧐','😤',
  '🎸','⚽','🏏','🎮','📚','🎨','🎵','🍕',
  '🚗','✈️','🏠','🌟','🔥','💡','🎯','🏆',
  '🌸','🌊','⛰️','🌙','☀️','🌈','❄️','🍀',
  '🐶','🐱','🦁','🐘','🦋','🐬','🦅','🐢',
  '💎','🔮','🎩','👑','🗝️','🧲','⚡','🎪',
];

// ─── Auth ────────────────────────────────────────
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
      .from('app_config').select('value').eq('key', 'app_password').single();
    if (error) throw error;
    if (data.value === pw) { sessionStorage.setItem('faces_auth', '1'); unlock(); }
    else { authError.textContent = 'Wrong passphrase. Try again.'; authInput.value = ''; }
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

// ─── State ───────────────────────────────────────
let allPeople    = [];
let categories   = [];
let activeCategory = 'all';
let searchQuery  = '';
let editingId    = null;
let pendingPhoto = null;   // base64 string
let pendingVoice = null;   // base64 string
let formTags     = [];
let mediaRecorder = null;
let audioChunks  = [];
let recordTimer  = null;

// ─── Init ────────────────────────────────────────
async function init() {
  await Promise.all([loadCategories(), loadPeople()]);
  buildTotemGrid();
}

// ─── Categories ──────────────────────────────────
async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('name');
  categories = data || [];
  renderFilterBar();
  populateCategorySelect();
}

function getCatById(id) { return categories.find(c => c.id === id); }

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  // keep All + Favourites pills, then add category pills
  bar.innerHTML = `
    <button class="filter-pill ${activeCategory==='all'?'active':''}" data-cat="all">All</button>
    <button class="filter-pill fav-pill ${activeCategory==='favourites'?'active':''}" data-cat="favourites">⭐ Favourites</button>
  `;
  categories.forEach(c => {
    const b = document.createElement('button');
    b.className = 'filter-pill' + (activeCategory === c.id ? ' active' : '');
    b.dataset.cat = c.id;
    b.style.setProperty('--pill-col', c.colour);
    if (activeCategory === c.id) { b.style.background = c.colour; b.style.borderColor = c.colour; b.style.color = '#fff'; }
    b.textContent = c.name;
    bar.appendChild(b);
  });
  bar.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      bar.querySelectorAll('.filter-pill').forEach(b => {
        b.classList.remove('active');
        b.style.background = ''; b.style.borderColor = ''; b.style.color = '';
      });
      btn.classList.add('active');
      // colour the category pills when active
      if (btn.dataset.cat !== 'all' && btn.dataset.cat !== 'favourites') {
        const cat = getCatById(btn.dataset.cat);
        if (cat) { btn.style.background = cat.colour; btn.style.borderColor = cat.colour; btn.style.color = '#fff'; }
      }
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
  const { data } = await supabase.from('people').select('*').order('name');
  allPeople = data || [];
  renderCards();
}

function getFiltered() {
  return allPeople.filter(p => {
    if (activeCategory === 'favourites' && !p.favourite) return false;
    if (activeCategory !== 'all' && activeCategory !== 'favourites' && p.relationship_category !== activeCategory) return false;
    const q = searchQuery.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.nickname||'').toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderCards() {
  const container = document.getElementById('cards-container');
  const people = getFiltered();
  if (!people.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="big-emoji">👤</div>
        <h3>${allPeople.length ? 'No matches' : 'No people yet'}</h3>
        <p>${allPeople.length ? 'Try a different filter or search.' : 'Tap ＋ to add the first person.'}</p>
      </div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'cards-grid';

  people.forEach(p => {
    const cat = getCatById(p.relationship_category);
    const card = document.createElement('div');
    card.className = 'person-card';

    const photoHTML = p.photo_url
      ? `<img src="${p.photo_url}" alt="${escHtml(p.name)}" loading="lazy">`
      : `<div class="card-photo-placeholder">${personEmoji(p.name)}</div>`;

    const tagsHTML = (p.tags||[]).slice(0,3).map(t => {
      const c = tagColour(t);
      return `<span class="tag-chip" style="background:${c.bg};color:${c.text}">${escHtml(t)}</span>`;
    }).join('');

    card.innerHTML = `
      ${cat ? `<div class="card-cat-tab" style="background:${cat.colour}"></div>` : ''}
      ${p.favourite ? `<div class="card-fav-star">⭐</div>` : ''}
      <div class="card-photo-wrap">${photoHTML}</div>
      ${p.totem_emoji ? `<div class="card-totem">${p.totem_emoji}</div>` : ''}
      <div class="card-body">
        <div class="card-name">${escHtml(p.name)}</div>
        ${p.nickname ? `<div class="card-nick">"${escHtml(p.nickname)}"</div>` : ''}
        ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}
        ${p.voice_memo ? `<span class="card-audio-badge">🔊</span>` : ''}
        ${p.memory_hook ? `<div class="card-hook">${escHtml(p.memory_hook)}</div>` : ''}
        <div class="card-actions">
          <button class="card-action-btn" data-action="view"   data-id="${p.id}">👁</button>
          <button class="card-action-btn" data-action="edit"   data-id="${p.id}">✏️</button>
          <button class="card-action-btn del" data-action="delete" data-id="${p.id}">🗑</button>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(grid);

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view')   openDetail(id);
      if (btn.dataset.action === 'edit')   openEdit(id);
      if (btn.dataset.action === 'delete') deletePerson(id);
    });
  });
  grid.querySelectorAll('.person-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.querySelector('[data-action="view"]').dataset.id));
  });
}

// ─── Search ──────────────────────────────────────
document.getElementById('search-input').addEventListener('input', e => {
  searchQuery = e.target.value; renderCards();
});

// ─── Detail modal ────────────────────────────────
async function openDetail(id) {
  const p = allPeople.find(x => x.id === id);
  if (!p) return;
  const cat = getCatById(p.relationship_category);

  // Load connections + timeline in parallel
  const [connData, timelineData] = await Promise.all([
    supabase.from('person_connections')
      .select('*').or(`person_a.eq.${id},person_b.eq.${id}`),
    supabase.from('encounter_timeline')
      .select('*').eq('person_id', id).order('seen_at', { ascending: false })
  ]);

  const connections = (connData.data || []).map(c => c.person_a === id ? c.person_b : c.person_a);
  const connectedPeople = allPeople.filter(x => connections.includes(x.id));
  const timeline = timelineData.data || [];

  const tagsHTML = (p.tags||[]).map(t => {
    const c = tagColour(t);
    return `<span class="tag-chip" style="background:${c.bg};color:${c.text}">${escHtml(t)}</span>`;
  }).join('');

  const photoHTML = p.photo_url
    ? `<img src="${p.photo_url}" alt="${escHtml(p.name)}">`
    : `<div class="detail-photo-placeholder">${personEmoji(p.name)}</div>`;

  const lastSeenHTML = p.last_seen
    ? `<div style="text-align:center;color:var(--muted);font-size:12px;font-weight:700;padding:4px 0 8px;">Last seen: ${formatDate(p.last_seen)}</div>`
    : '';

  // Also Known By mini cards
  const alsoKnownHTML = connectedPeople.length ? `
    <div class="detail-section">
      <div class="detail-section-label">Also Known By</div>
      <div class="also-known-scroll">
        ${connectedPeople.map(cp => {
          const ccat = getCatById(cp.relationship_category);
          const cphoto = cp.photo_url
            ? `<img class="also-known-photo" src="${cp.photo_url}" alt="${escHtml(cp.name)}">`
            : `<div class="also-known-placeholder">${personEmoji(cp.name)}</div>`;
          return `<div class="also-known-card" data-open="${cp.id}">
            ${ccat ? `<div class="also-known-cat-tab" style="background:${ccat.colour}"></div>` : ''}
            ${cphoto}
            <div class="also-known-name">${escHtml(cp.name)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // Timeline
  const timelineHTML = `
    <div class="detail-section">
      <div class="detail-section-label">Encounter Timeline</div>
    </div>
    <div class="timeline-wrap">
      <button class="timeline-add-btn" id="detail-add-enc">＋ Log an Encounter</button>
      <div class="timeline-list">
        ${timeline.map(e => `
          <div class="timeline-entry">
            <div class="timeline-dot"></div>
            <div class="timeline-body">
              <div class="timeline-when">${formatDateTime(e.seen_at)}</div>
              ${e.location ? `<div class="timeline-where">📍 ${escHtml(e.location)}</div>` : ''}
              ${e.note ? `<div class="timeline-note">${escHtml(e.note)}</div>` : ''}
            </div>
          </div>`).join('')}
        ${!timeline.length ? `<div style="color:var(--muted);font-size:13px;padding:8px 0 0 28px;">No encounters logged yet.</div>` : ''}
      </div>
      ${lastSeenHTML}
    </div>`;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="modal-handle"></div>
    <div class="detail-header-row">
      ${cat ? `<div class="detail-cat-tab" style="background:${cat.colour}"></div>` : '<div></div>'}
      <button class="detail-fav-btn" id="detail-fav-btn">${p.favourite ? '⭐' : '☆'}</button>
      <button class="modal-close" id="detail-modal-close" style="margin-left:8px;">✕</button>
    </div>
    <div class="detail-photo-outer">
      <div class="detail-photo-wrap">${photoHTML}</div>
      ${p.totem_emoji ? `<div class="detail-totem">${p.totem_emoji}</div>` : ''}
    </div>
    <div class="detail-name">${escHtml(p.name)}</div>
    ${p.nickname ? `<div class="detail-nick">"${escHtml(p.nickname)}"</div>` : ''}
    ${tagsHTML ? `<div class="detail-tags">${tagsHTML}</div>` : ''}
    ${p.voice_memo ? `
      <div class="detail-voice">
        <button class="detail-voice-play" id="detail-voice-play">▶</button>
        <div>
          <div class="detail-voice-label">Voice Memo</div>
          <audio id="detail-audio" src="${p.voice_memo}" style="display:none;"></audio>
        </div>
      </div>` : ''}
    ${p.memory_hook ? `
      <div class="detail-section">
        <div class="detail-section-label">Memory Hook</div>
        <div class="detail-hook-text">${escHtml(p.memory_hook)}</div>
      </div>` : ''}
    ${alsoKnownHTML}
    ${timelineHTML}
    <div class="detail-actions">
      <button class="detail-edit-btn" id="detail-edit-btn">✏️ Edit</button>
      <button class="detail-del-btn"  id="detail-del-btn">🗑 Remove</button>
    </div>
    <div style="height:16px;"></div>
  `;

  // Wire events
  document.getElementById('detail-modal-close').addEventListener('click', () => closeModal('detail-modal'));
  document.getElementById('detail-edit-btn').addEventListener('click', () => { closeModal('detail-modal'); openEdit(id); });
  document.getElementById('detail-del-btn').addEventListener('click', () => { closeModal('detail-modal'); deletePerson(id); });

  document.getElementById('detail-fav-btn').addEventListener('click', async () => {
    const newFav = !p.favourite;
    await supabase.from('people').update({ favourite: newFav }).eq('id', id);
    p.favourite = newFav;
    document.getElementById('detail-fav-btn').textContent = newFav ? '⭐' : '☆';
    renderCards();
  });

  const voicePlay = document.getElementById('detail-voice-play');
  if (voicePlay) {
    voicePlay.addEventListener('click', () => {
      const audio = document.getElementById('detail-audio');
      if (audio.paused) { audio.play(); voicePlay.textContent = '⏸'; }
      else { audio.pause(); voicePlay.textContent = '▶'; }
    });
  }

  document.getElementById('detail-add-enc').addEventListener('click', () => {
    document.getElementById('enc-person-id').value = id;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('enc-time').value = now.toISOString().slice(0,16);
    document.getElementById('enc-location').value = '';
    document.getElementById('enc-note').value = '';
    openModal('encounter-modal');
  });

  content.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => { closeModal('detail-modal'); openDetail(el.dataset.open); });
  });

  openModal('detail-modal');
}

// ─── Encounter save ───────────────────────────────
document.getElementById('enc-submit-btn').addEventListener('click', async () => {
  const personId = document.getElementById('enc-person-id').value;
  const seenAt   = document.getElementById('enc-time').value;
  const location = document.getElementById('enc-location').value.trim();
  const note     = document.getElementById('enc-note').value.trim();
  if (!seenAt) { showToast('Pick a date/time', 'error'); return; }
  const btn = document.getElementById('enc-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';
  const { error } = await supabase.from('encounter_timeline').insert({
    person_id: personId, seen_at: seenAt, location: location||null, note: note||null
  });
  btn.disabled = false; btn.textContent = 'Save Encounter';
  if (error) { showToast('Failed: ' + error.message, 'error'); return; }
  showToast('Encounter logged ✓', 'success');
  closeModal('encounter-modal');
  openDetail(personId);
});
document.getElementById('encounter-modal-close').addEventListener('click', () => closeModal('encounter-modal'));

// ─── Add / Edit form ─────────────────────────────
document.getElementById('open-add-btn').addEventListener('click', openAdd);

function openAdd() {
  editingId = null; pendingPhoto = null; pendingVoice = null; formTags = [];
  resetForm();
  document.getElementById('form-modal-title').textContent = 'Add Person';
  document.getElementById('form-submit-btn').textContent = 'Save Person';
  document.getElementById('also-known-group').style.display = 'none';
  openModal('form-modal');
}

function openEdit(id) {
  const p = allPeople.find(x => x.id === id);
  if (!p) return;
  editingId = id; pendingPhoto = null; pendingVoice = null;
  formTags = Array.isArray(p.tags) ? [...p.tags] : [];

  document.getElementById('edit-id').value      = id;
  document.getElementById('f-name').value       = p.name || '';
  document.getElementById('f-nick').value       = p.nickname || '';
  document.getElementById('f-category').value   = p.relationship_category || '';
  document.getElementById('f-hook').value       = p.memory_hook || '';
  document.getElementById('f-totem').value      = p.totem_emoji || '';
  document.getElementById('f-last-seen').value  = p.last_seen || '';
  document.getElementById('f-favourite').checked = !!p.favourite;

  // Photo
  if (p.photo_url) {
    document.getElementById('photo-preview-container').innerHTML =
      `<img src="${p.photo_url}" class="photo-preview"><div class="upload-label">Tap to change</div>`;
  } else resetPhotoPreview();

  // Voice
  if (p.voice_memo) {
    pendingVoice = p.voice_memo;
    document.getElementById('voice-status').textContent = 'Existing memo loaded';
    document.getElementById('voice-playback').src = p.voice_memo;
    document.getElementById('voice-playback').style.display = 'block';
    document.getElementById('voice-clear-btn').style.display = 'block';
  } else {
    resetVoiceUI();
  }

  renderTagChips();
  buildKnownByList(id);
  document.getElementById('also-known-group').style.display = 'block';
  document.getElementById('form-modal-title').textContent = 'Edit Person';
  document.getElementById('form-submit-btn').textContent  = 'Update Person';
  openModal('form-modal');
}

async function buildKnownByList(currentId) {
  // Load existing connections
  const { data } = await supabase.from('person_connections')
    .select('*').or(`person_a.eq.${currentId},person_b.eq.${currentId}`);
  const connected = (data||[]).map(c => c.person_a === currentId ? c.person_b : c.person_a);

  const list = document.getElementById('known-by-list');
  const others = allPeople.filter(p => p.id !== currentId);
  if (!others.length) { list.innerHTML = '<div style="color:var(--muted);font-size:13px;">No other people added yet.</div>'; return; }

  list.innerHTML = '';
  others.forEach(p => {
    const isConnected = connected.includes(p.id);
    const item = document.createElement('div');
    item.className = 'known-by-item' + (isConnected ? ' selected' : '');
    item.dataset.pid = p.id;
    const photoEl = p.photo_url
      ? `<img src="${p.photo_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`
      : `<div class="kbi-placeholder">${personEmoji(p.name)}</div>`;
    item.innerHTML = `${photoEl}<span class="kbi-name">${escHtml(p.name)}</span><span class="kbi-check">✓</span>`;
    item.addEventListener('click', () => item.classList.toggle('selected'));
    list.appendChild(item);
  });
}

function resetForm() {
  document.getElementById('edit-id').value      = '';
  document.getElementById('f-name').value       = '';
  document.getElementById('f-nick').value       = '';
  document.getElementById('f-category').value   = '';
  document.getElementById('f-hook').value       = '';
  document.getElementById('f-totem').value      = '';
  document.getElementById('f-last-seen').value  = '';
  document.getElementById('f-favourite').checked = false;
  formTags = [];
  renderTagChips();
  resetPhotoPreview();
  resetVoiceUI();
}
function resetPhotoPreview() {
  document.getElementById('photo-preview-container').innerHTML =
    `<span class="upload-icon">📷</span>
     <div class="upload-label">Tap to add photo</div>
     <div class="upload-sub">Their face is the key</div>`;
}
function resetVoiceUI() {
  document.getElementById('voice-status').textContent = '';
  document.getElementById('voice-playback').style.display = 'none';
  document.getElementById('voice-playback').src = '';
  document.getElementById('voice-clear-btn').style.display = 'none';
  document.getElementById('voice-record-btn').textContent = '🎙 Hold to Record';
  document.getElementById('voice-record-btn').classList.remove('recording');
}

// ─── Totem grid ──────────────────────────────────
function buildTotemGrid() {
  const grid = document.getElementById('totem-grid');
  TOTEM_EMOJIS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'totem-btn'; btn.textContent = emoji; btn.type = 'button';
    btn.addEventListener('click', () => {
      document.getElementById('f-totem').value = emoji;
      grid.querySelectorAll('.totem-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });
}

// ─── Tag management ──────────────────────────────
function renderTagChips() {
  const container = document.getElementById('tag-chips');
  container.innerHTML = '';
  formTags.forEach((tag, i) => {
    const c = tagColour(tag);
    const chip = document.createElement('span');
    chip.className = 'tag-chip-editable';
    chip.style.background = c.bg; chip.style.color = c.text;
    chip.innerHTML = `${escHtml(tag)}<button type="button" data-i="${i}">✕</button>`;
    chip.querySelector('button').addEventListener('click', () => { formTags.splice(i, 1); renderTagChips(); });
    container.appendChild(chip);
  });
}
document.getElementById('f-tag-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,/g,'');
    if (val && !formTags.includes(val) && formTags.length < 10) {
      formTags.push(val); renderTagChips(); e.target.value = '';
    }
  }
});

// ─── Photo resize ────────────────────────────────
document.getElementById('photo-file-input').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  resizeToBase64(file, 300, 300, 0.82).then(b64 => {
    pendingPhoto = b64;
    document.getElementById('photo-preview-container').innerHTML =
      `<img src="${b64}" class="photo-preview"><div class="upload-label">Tap to change</div>`;
  });
});

function resizeToBase64(file, maxW, maxH, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = maxW; canvas.height = maxH;
      canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, maxW, maxH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}

// ─── Voice recorder ──────────────────────────────
const voiceBtn = document.getElementById('voice-record-btn');

voiceBtn.addEventListener('pointerdown', async () => {
  if (!navigator.mediaDevices) { showToast('Microphone not available', 'error'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        pendingVoice = reader.result;
        document.getElementById('voice-playback').src = pendingVoice;
        document.getElementById('voice-playback').style.display = 'block';
        document.getElementById('voice-clear-btn').style.display = 'block';
        document.getElementById('voice-status').textContent = 'Memo recorded ✓';
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mediaRecorder.start();
    voiceBtn.textContent = '⏹ Recording… (release to stop)';
    voiceBtn.classList.add('recording');
    document.getElementById('voice-status').textContent = 'Recording…';
    // Auto-stop after 10 seconds
    recordTimer = setTimeout(() => stopRecording(), 10000);
  } catch(e) {
    showToast('Microphone permission denied', 'error');
  }
});

voiceBtn.addEventListener('pointerup', stopRecording);
voiceBtn.addEventListener('pointerleave', stopRecording);

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    clearTimeout(recordTimer);
    mediaRecorder.stop();
    voiceBtn.textContent = '🎙 Hold to Record';
    voiceBtn.classList.remove('recording');
  }
}

document.getElementById('voice-clear-btn').addEventListener('click', () => {
  pendingVoice = null; resetVoiceUI();
});

// ─── Submit form ─────────────────────────────────
document.getElementById('form-submit-btn').addEventListener('click', submitForm);

async function submitForm() {
  const name     = document.getElementById('f-name').value.trim();
  const nick     = document.getElementById('f-nick').value.trim();
  const cat      = document.getElementById('f-category').value;
  const hook     = document.getElementById('f-hook').value.trim();
  const totem    = document.getElementById('f-totem').value.trim();
  const lastSeen = document.getElementById('f-last-seen').value;
  const fav      = document.getElementById('f-favourite').checked;

  if (!name) { showToast('Name is required', 'error'); return; }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true; btn.textContent = editingId ? 'Updating…' : 'Saving…';

  try {
    const payload = {
      name,
      nickname:              nick || null,
      relationship_category: cat  || null,
      memory_hook:           hook || null,
      totem_emoji:           totem|| null,
      tags:                  formTags.length ? formTags : null,
      last_seen:             lastSeen || null,
      favourite:             fav,
    };
    if (pendingPhoto) payload.photo_url  = pendingPhoto;
    if (pendingVoice !== undefined) {
      // only update voice if changed (pendingVoice is null = clear, string = new)
      if (pendingVoice !== null || editingId) payload.voice_memo = pendingVoice;
    }

    let savedId = editingId;

    if (editingId) {
      const { error } = await supabase.from('people').update(payload).eq('id', editingId);
      if (error) throw error;
    } else {
      if (!pendingPhoto) delete payload.photo_url;
      if (!pendingVoice) delete payload.voice_memo;
      const { data, error } = await supabase.from('people').insert(payload).select().single();
      if (error) throw error;
      savedId = data.id;
    }

    // Save Also Known By connections (only in edit mode where list is visible)
    if (editingId) {
      const list = document.getElementById('known-by-list');
      if (list) {
        const selectedIds = [...list.querySelectorAll('.known-by-item.selected')].map(el => el.dataset.pid);
        // Delete all existing connections for this person first
        await supabase.from('person_connections')
          .delete().or(`person_a.eq.${editingId},person_b.eq.${editingId}`);
        // Re-insert selected ones
        if (selectedIds.length) {
          const inserts = selectedIds.map(pid => ({ person_a: editingId, person_b: pid }));
          await supabase.from('person_connections').insert(inserts);
        }
      }
    }

    showToast(editingId ? 'Updated ✓' : 'Person added ✓', 'success');
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
  if (!confirm(`Remove ${p?.name}? This cannot be undone.`)) return;
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Removed', 'success');
  await loadPeople();
}

// ─── Modals ──────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.getElementById('form-modal-close').addEventListener('click', () => closeModal('form-modal'));
document.getElementById('form-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('form-modal')) closeModal('form-modal');
});
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('detail-modal')) closeModal('detail-modal');
});
document.getElementById('encounter-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('encounter-modal')) closeModal('encounter-modal');
});

// ─── Toast ───────────────────────────────────────
let toastTimer;
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Utils ───────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function personEmoji(name) {
  const e = ['🧑','👩','👨','🧒','👴','👵','🙎','🙍'];
  return e[(name||'').charCodeAt(0) % e.length];
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
}
function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
}
