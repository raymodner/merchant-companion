import L from 'leaflet';

// ── Terrain config (populated from API) ───────────────────────────────────
let TERRAINS = {};

let resourceData = [];
let regions = { countries: {}, states: {} };

const STEP = 0.1;

// ── Auth ──────────────────────────────────────────────────────────────────
const getToken  = ()  => localStorage.getItem('auth-token');
const setToken  = (t) => localStorage.setItem('auth-token', t);
const clearToken = () => localStorage.removeItem('auth-token');

function authHeaders(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const t = getToken();
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

// ── API client ────────────────────────────────────────────────────────────
const api = {
  async load(region) {
    try {
      const res = await fetch(`/api/terrain/${region}`);
      if (!res.ok) return {};
      return (await res.json()).data || {};
    } catch { return {}; }
  },
  async paintCell(region, cellKey, terrainKey) {
    try {
      await fetch(`/api/terrain/${region}/cell`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ cellKey, terrainKey: terrainKey || null }),
      });
    } catch {}
  },
  async remove(region) {
    try {
      await fetch(`/api/terrain/${region}`, { method: 'DELETE', headers: authHeaders() });
    } catch {}
  },
};

// ── State ─────────────────────────────────────────────────────────────────
let currentUser    = null;
let activeTerrain  = null;
let paintMode      = false;
let isDragging     = false;
let currentCountry = localStorage.getItem('selected-country') || 'Netherlands';
let currentState   = localStorage.getItem('selected-state')   || null;
let cellState      = {};
let hiddenTerrains = new Set();
const cells   = {};
const markers = {};

// ── Map ───────────────────────────────────────────────────────────────────
const map = L.map('map').setView([52.3, 5.3], 8);
setTimeout(() => map.invalidateSize(), 100);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap contributors · © CartoDB',
  maxZoom: 19,
}).addTo(map);

// ── Helpers ───────────────────────────────────────────────────────────────
const snap       = (n) => Math.round(n * 10) / 10;
const cellKey    = (lat, lng) => `${lat.toFixed(1)},${lng.toFixed(1)}`;
const cellCenter = (lat, lng) => [lat + STEP / 2, lng + STEP / 2];

function slugify(s) { return s.toLowerCase().replace(/\s+/g, '-'); }

function activeRegionKey() {
  if (currentCountry === 'United States' && currentState) return 'us-' + slugify(currentState);
  return slugify(currentCountry);
}

function computeView(bounds) {
  const center = [(bounds.latMin + bounds.latMax) / 2, (bounds.lngMin + bounds.lngMax) / 2];
  const span   = Math.max(bounds.latMax - bounds.latMin, bounds.lngMax - bounds.lngMin);
  const zoom   = span > 20 ? 5 : span > 10 ? 6 : span > 6 ? 7 : span > 3 ? 8 : 9;
  return { center, zoom };
}

function styleFor(terrainKey) {
  if (!terrainKey) {
    return { color: 'rgba(90,62,26,0.22)', weight: 1, fillColor: '#8a6020', fillOpacity: 0.06 };
  }
  return { color: 'rgba(0,0,0,0.28)', weight: 1, fillColor: TERRAINS[terrainKey].color, fillOpacity: 0.60 };
}

function tooltipFor(terrainKey, lat, lng) {
  const coord = `${lat.toFixed(1)}°N, ${lng.toFixed(1)}°E`;
  if (!terrainKey) return coord;
  const t = TERRAINS[terrainKey];
  return `<b>${t.icon} ${terrainKey}</b><br><small>${coord}</small>`;
}

function makeIcon(terrainKey) {
  return L.divIcon({
    html: `<span>${TERRAINS[terrainKey].icon}</span>`,
    className: 'cell-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// ── Grid build / teardown ─────────────────────────────────────────────────
function clearGrid() {
  Object.values(cells).forEach(r => r.remove());
  Object.values(markers).forEach(m => m.remove());
  for (const k in cells)   delete cells[k];
  for (const k in markers) delete markers[k];
}

async function buildGrid(bounds, regionKey, center, zoom) {
  cellState = await api.load(regionKey);
  const { latMin, latMax, lngMin, lngMax } = bounds;

  for (let lat = latMin; lat < latMax; lat = snap(lat + STEP)) {
    for (let lng = lngMin; lng < lngMax; lng = snap(lng + STEP)) {
      const key     = cellKey(lat, lng);
      const terrain = cellState[key] || null;

      const rect = L.rectangle(
        [[lat, lng], [snap(lat + STEP), snap(lng + STEP)]],
        styleFor(terrain)
      ).bindTooltip(tooltipFor(terrain, lat, lng), { sticky: true });

      rect.on('mousedown', (e) => {
        if (!paintMode || e.originalEvent.button !== 0) return;
        isDragging = true;
        paintCell(key, activeTerrain);
      });
      rect.on('mouseover', () => { if (paintMode && isDragging) paintCell(key, activeTerrain); });
      rect.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e);
        if (paintMode) paintCell(key, null);
      });

      rect.addTo(map);
      cells[key] = rect;

      if (terrain) {
        markers[key] = L.marker(cellCenter(lat, lng), {
          icon: makeIcon(terrain), interactive: false, zIndexOffset: 10,
        }).addTo(map);
      }
    }
  }

  map.setView(center, zoom);
}

async function loadCurrentRegion() {
  clearGrid();
  if (currentCountry === 'United States') {
    if (!currentState) { map.setView([39.5, -98.5], 5); return; }
    const bounds = regions.states[currentState];
    if (!bounds) return;
    const { center, zoom } = computeView(bounds);
    await buildGrid(bounds, activeRegionKey(), center, zoom);
  } else {
    const c = regions.countries[currentCountry];
    if (!c) return;
    await buildGrid(c, activeRegionKey(), c.center, c.zoom);
  }
}

// ── Paint ─────────────────────────────────────────────────────────────────
function paintCell(key, terrainKey) {
  if (!currentUser) { showModal(); return; }
  const rect = cells[key];
  if (!rect) return;

  if (terrainKey) cellState[key] = terrainKey;
  else delete cellState[key];

  const hidden = terrainKey && hiddenTerrains.has(terrainKey);
  rect.setStyle(hidden ? styleFor(null) : styleFor(terrainKey || null));

  const [lat, lng] = key.split(',').map(Number);
  rect.setTooltipContent(tooltipFor(terrainKey || null, lat, lng));

  if (markers[key]) { markers[key].remove(); delete markers[key]; }
  if (terrainKey) {
    const m = L.marker(cellCenter(lat, lng), {
      icon: makeIcon(terrainKey), interactive: false, zIndexOffset: 10,
    }).addTo(map);
    if (hidden) m.getElement()?.style.setProperty('display', 'none');
    markers[key] = m;
  }

  api.paintCell(activeRegionKey(), key, terrainKey || null);
}

// ── Sidebar: Country selector ─────────────────────────────────────────────
const stateWrap = document.getElementById('state-select-wrap');
let countryDd, stateDd;

function initDropdowns() {
  countryDd = makeDropdown(
    document.getElementById('country-select-wrap'),
    Object.keys(regions.countries).map(n => ({ value: n, label: n })),
    async (v) => {
      currentCountry = v;
      localStorage.setItem('selected-country', v);
      const isUS = v === 'United States';
      stateWrap.style.display = isUS ? 'block' : 'none';
      currentState = isUS ? (stateDd.getValue() || null) : null;
      savePreferences();
      await loadCurrentRegion();
    },
    'sidebar'
  );
  countryDd.setValue(currentCountry);

  stateDd = makeDropdown(
    stateWrap,
    [
      { value: '', label: '— Select a state —' },
      ...Object.keys(regions.states).map(n => ({ value: n, label: n })),
    ],
    async (v) => {
      currentState = v || null;
      if (currentState) localStorage.setItem('selected-state', currentState);
      savePreferences();
      await loadCurrentRegion();
    },
    'sidebar'
  );
  if (currentState) stateDd.setValue(currentState);

  stateWrap.style.display = currentCountry === 'United States' ? 'block' : 'none';
}

// ── Sidebar: Paint & Filters ──────────────────────────────────────────────
const terrainList = document.getElementById('terrain-list');
const terrainBtns = {};
const filterList  = document.getElementById('filter-list');
const filterRows  = {};

function initTerrainUI() {
  terrainList.innerHTML = '';
  filterList.innerHTML  = '';

  Object.entries(TERRAINS).forEach(([key, t]) => {
    const btn = document.createElement('div');
    btn.className = 'terrain-btn';
    btn.innerHTML = `<div class="swatch" style="background:${t.color}"></div>
                     <span class="terrain-label">${t.icon} ${key}</span>`;
    btn.addEventListener('click', () => select(key));
    terrainBtns[key] = btn;
    terrainList.appendChild(btn);

    const row = document.createElement('div');
    row.className = 'filter-row visible';
    row.innerHTML = `<div class="swatch" style="background:${t.color};width:10px;height:10px"></div>
                     <div class="filter-check">✓</div>
                     <span class="terrain-label" style="font-size:13px">${t.icon} ${key}</span>`;
    row.addEventListener('click', () => toggleFilter(key));
    filterRows[key] = row;
    filterList.appendChild(row);
  });

  // Populate terrain filter in resource modal
  resTerrainDd.setOptions([
    { value: '', label: 'All Terrains' },
    ...Object.keys(TERRAINS).map(n => ({ value: n, label: `${TERRAINS[n].icon} ${n}` })),
  ]);
}

const paintModeBtn = document.getElementById('paint-mode-btn');

function setPaintMode(on) {
  paintMode = on;
  paintModeBtn.classList.toggle('active', on);
  paintModeBtn.textContent = on ? '🖌 Painting On' : '🖌 Start Painting';
  document.getElementById('map').classList.toggle('paint-cursor', on);
}

paintModeBtn.addEventListener('click', () => setPaintMode(!paintMode));

function select(key) {
  activeTerrain = key;
  Object.values(terrainBtns).forEach(b => b.classList.remove('active'));
  document.getElementById('eraser-btn').classList.remove('active');
  if (key === null) document.getElementById('eraser-btn').classList.add('active');
  else terrainBtns[key]?.classList.add('active');
  setPaintMode(true);
}

document.getElementById('eraser-btn').addEventListener('click', () => select(null));

function toggleFilter(key) {
  if (hiddenTerrains.has(key)) {
    hiddenTerrains.delete(key);
    filterRows[key].classList.remove('hidden');
    filterRows[key].classList.add('visible');
    filterRows[key].querySelector('.filter-check').textContent = '✓';
  } else {
    hiddenTerrains.add(key);
    filterRows[key].classList.add('hidden');
    filterRows[key].classList.remove('visible');
    filterRows[key].querySelector('.filter-check').textContent = '';
  }
  applyFilters();
}

function applyFilters() {
  Object.entries(cells).forEach(([key, rect]) => {
    const terrain = cellState[key];
    const hidden  = terrain && hiddenTerrains.has(terrain);
    rect.setStyle(hidden ? styleFor(null) : styleFor(terrain || null));
    const marker = markers[key];
    if (marker) {
      if (hidden) marker.getElement()?.style.setProperty('display', 'none');
      else        marker.getElement()?.style.removeProperty('display');
    }
  });
}

document.getElementById('filter-all').addEventListener('click', () => {
  hiddenTerrains.clear();
  Object.keys(TERRAINS).forEach(key => {
    filterRows[key].classList.remove('hidden');
    filterRows[key].classList.add('visible');
    filterRows[key].querySelector('.filter-check').textContent = '✓';
  });
  applyFilters();
});

document.getElementById('filter-none').addEventListener('click', () => {
  Object.keys(TERRAINS).forEach(key => {
    hiddenTerrains.add(key);
    filterRows[key].classList.add('hidden');
    filterRows[key].classList.remove('visible');
    filterRows[key].querySelector('.filter-check').textContent = '';
  });
  applyFilters();
});

document.addEventListener('mouseup', () => { isDragging = false; });
map.on('mousedown', () => { if (paintMode) map.dragging.disable(); });
document.addEventListener('mouseup', () => map.dragging.enable());


// ── Auth UI ───────────────────────────────────────────────────────────────
const authOverlay = document.getElementById('auth-overlay');
const authError   = document.getElementById('auth-error');

function showModal() { authOverlay.classList.remove('hidden'); }
function hideModal() { authOverlay.classList.add('hidden'); }

async function savePreferences() {
  if (!currentUser) return;
  try {
    await fetch('/api/auth/preferences', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ country: currentCountry, state: currentState || null }),
    });
  } catch {}
}

async function onLoggedIn(user) {
  currentUser = user;
  hideModal();
  document.getElementById('login-btn').style.display      = 'none';
  document.getElementById('username-display').textContent = `⚔ ${user.username}`;
  document.getElementById('username-display').style.display = '';
  document.getElementById('logout-btn').style.display     = '';

  // Apply server-stored region preference if it differs from current
  const pref = user.preferred_country;
  if (pref && pref !== currentCountry) {
    currentCountry = pref;
    currentState   = user.preferred_state || null;
    localStorage.setItem('selected-country', currentCountry);
    if (currentState) localStorage.setItem('selected-state', currentState);
    else localStorage.removeItem('selected-state');
    if (countryDd) countryDd.setValue(currentCountry);
    const isUS = currentCountry === 'United States';
    if (stateWrap) stateWrap.style.display = isUS ? 'block' : 'none';
    if (stateDd && currentState) stateDd.setValue(currentState);
    await loadCurrentRegion();
  }
}

function onLoggedOut() {
  currentUser = null;
  document.getElementById('login-btn').style.display      = '';
  document.getElementById('username-display').style.display = 'none';
  document.getElementById('logout-btn').style.display     = 'none';
}

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    document.getElementById('login-form').style.display    = which === 'login'    ? 'flex' : 'none';
    document.getElementById('register-form').style.display = which === 'register' ? 'flex' : 'none';
    authError.textContent = '';
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const { email, password } = e.target;
  const res  = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.value, password: password.value }),
  });
  const data = await res.json();
  if (!res.ok) { authError.textContent = data.error; return; }
  setToken(data.token);
  onLoggedIn(data.user);
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const { username, email, password } = e.target;
  const res  = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.value, email: email.value, password: password.value }),
  });
  const data = await res.json();
  if (!res.ok) { authError.textContent = data.error; return; }
  setToken(data.token);
  onLoggedIn(data.user);
});

document.getElementById('login-btn').addEventListener('click', showModal);
document.getElementById('modal-close').addEventListener('click', hideModal);

document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  onLoggedOut();
});

// ── Resource Lookup modal ─────────────────────────────────────────────────
const resOverlay   = document.getElementById('resource-overlay');
const resProductEl = document.getElementById('res-product');
let resMinStars    = 0;
let resTerrain     = '';
let resType        = '';
let resName        = '';

function makeDropdown(container, initialOpts, onChange, cls = '') {
  let value   = initialOpts[0]?.value ?? '';
  let options = [...initialOpts];

  const btn  = document.createElement('button');
  btn.className  = cls ? `res-dd-btn ${cls}-btn`  : 'res-dd-btn';
  btn.dataset.ddBtn = '1';
  const list = document.createElement('div');
  list.className = cls ? `res-dd-list ${cls}-list` : 'res-dd-list';
  list.dataset.ddList = '1';
  container.appendChild(btn);
  container.appendChild(list);

  function renderBtn() {
    const label = options.find(o => o.value === value)?.label ?? options[0]?.label ?? '';
    btn.innerHTML = `<span class="res-dd-value">${label}</span><span class="res-dd-arrow">▾</span>`;
  }
  function renderList() {
    list.innerHTML = '';
    options.forEach(o => {
      const item = document.createElement('div');
      item.className = 'res-dd-item' + (o.value === value ? ' active' : '');
      item.textContent = o.label;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        value = o.value;
        close();
        renderBtn();
        renderList();
        onChange(value);
      });
      list.appendChild(item);
    });
  }
  function open() {
    document.querySelectorAll('[data-dd-list].open').forEach(l => {
      l.classList.remove('open');
      l.previousElementSibling?.classList.remove('open');
    });
    const r = btn.getBoundingClientRect();
    list.style.top   = (r.bottom + 3) + 'px';
    list.style.left  = r.left + 'px';
    list.style.width = r.width + 'px';
    list.classList.add('open');
    btn.classList.add('open');
  }
  function close() { list.classList.remove('open'); btn.classList.remove('open'); }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    list.classList.contains('open') ? close() : open();
  });

  renderBtn();
  renderList();

  return {
    getValue:   ()        => value,
    setValue:   (v)       => { value = v; renderBtn(); renderList(); },
    setOptions: (newOpts) => {
      options = [...newOpts];
      value   = newOpts[0]?.value ?? '';
      renderBtn();
      renderList();
    },
  };
}

document.addEventListener('click', () => {
  document.querySelectorAll('[data-dd-list].open').forEach(l => {
    l.classList.remove('open');
    l.previousElementSibling?.classList.remove('open');
  });
});

const resTypeDd    = makeDropdown(document.getElementById('res-type-wrap'), [
  { value: '', label: 'All Types' },
  { value: 'Ore',      label: '⛏ Ore' },
  { value: 'Stone',    label: '🪨 Stone' },
  { value: 'Wood',     label: '🌲 Wood' },
  { value: 'Raw Food', label: '🌾 Raw Food' },
], (v) => { resType = v; populateResNames(); });

const resNameDd    = makeDropdown(document.getElementById('res-name-wrap'),
  [{ value: '', label: 'All Resources' }],
  (v) => { resName = v; renderResources(); }
);

const resTerrainDd = makeDropdown(document.getElementById('res-terrain-wrap'),
  [{ value: '', label: 'All Terrains' }],
  (v) => { resTerrain = v; renderResources(); }
);

document.getElementById('resource-btn').addEventListener('click', () => {
  resOverlay.classList.remove('hidden');
  renderResources();
});
function closeResourceModal() {
  resOverlay.classList.add('hidden');
  if (editMode) {
    editMode = false;
    resEditBtn.classList.remove('active');
    resEditBtn.textContent = '✎ Edit Ratings';
    resResults.classList.remove('edit-mode');
  }
}
document.getElementById('resource-close').addEventListener('click', closeResourceModal);
resOverlay.addEventListener('click', (e) => { if (e.target === resOverlay) closeResourceModal(); });

const resFilterBody  = document.getElementById('res-filter-body');
const resFilterArrow = document.getElementById('res-filter-arrow');
document.getElementById('res-filter-toggle').addEventListener('click', () => {
  const open = resFilterBody.style.display === 'flex';
  resFilterBody.style.display = open ? 'none' : 'flex';
  resFilterArrow.textContent  = open ? '▾' : '▴';
});

function populateResNames() {
  const names = resourceData
    .filter(r => !resType || r.type === resType)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(r => ({ value: r.name, label: `${r.icon} ${r.name}` }));
  resNameDd.setOptions([{ value: '', label: 'All Resources' }, ...names]);
  resName = '';
  renderResources();
}

resProductEl.addEventListener('input', renderResources);

document.querySelectorAll('.res-star-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.res-star-opt').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    resMinStars = parseInt(btn.dataset.val);
    renderResources();
  });
});

function starsHtml(loc) {
  const n = loc.stars ?? 0;
  if (n === 0) {
    return `<span class="res-loc-stars-wrap res-loc-stars-unknown" data-loc-id="${loc.id}">${
      [1,2,3,4,5].map(i => `<span class="res-loc-star unknown" data-star="${i}">★</span>`).join('')
    }</span>`;
  }
  let html = `<span class="res-loc-stars-wrap" data-loc-id="${loc.id}">`;
  for (let i = 1; i <= 5; i++) html += `<span class="res-loc-star ${i <= n ? 'filled' : 'empty'}" data-star="${i}">★</span>`;
  return html + `</span>`;
}

function renderResources() {
  const minS    = resMinStars;
  const product = resProductEl.value.trim().toLowerCase();
  const out     = document.getElementById('resource-results');
  out.innerHTML = '';

  let entries;

  if (product) {
    entries = resourceData.filter(r => {
      if (r.name.toLowerCase().includes(product)) return true;
      if (!r.chain) return false;
      const proc = (r.chain.processed || '').toLowerCase();
      const f1   = (r.chain.final1?.name || '').toLowerCase();
      const f2   = (r.chain.final2?.name || '').toLowerCase();
      return proc.includes(product) || f1.includes(product) || f2.includes(product);
    });
  } else {
    entries = resourceData.filter(r => (!resType || r.type === resType) && (!resName || r.name === resName));
  }

  for (const r of entries) {
    // Group flat locations array by terrain (applying terrain filter)
    const byTerrain = {};
    for (const loc of r.locations) {
      if (resTerrain && loc.terrain !== resTerrain) continue;
      if (!byTerrain[loc.terrain]) byTerrain[loc.terrain] = [];
      byTerrain[loc.terrain].push(loc);
    }

    const matchedTerrains = [];
    for (const [terrain, locs] of Object.entries(byTerrain)) {
      const filtered = locs.filter(l => l.stars === 0 || l.stars >= minS);
      if (filtered.length) matchedTerrains.push({ terrain, locs: filtered });
    }

    // When doing a product search, still show even if no terrain locations match the star filter
    if (!matchedTerrains.length && !product) continue;

    const section = document.createElement('div');
    section.className = 'res-section';

    const hdr = document.createElement('div');
    hdr.className = 'res-section-header';
    hdr.innerHTML = `
      <span class="res-section-name">${r.icon} ${r.name}</span>
      <span class="res-type-badge">${r.type}</span>
      <button class="res-info-btn">ⓘ</button>`;
    section.appendChild(hdr);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'res-info-text hidden';
    infoDiv.textContent = r.info;
    section.appendChild(infoDiv);

    hdr.querySelector('.res-info-btn').addEventListener('click', () => infoDiv.classList.toggle('hidden'));

    // Production chain
    if (r.chain?.processed) {
      const chainEl = document.createElement('div');
      chainEl.className = 'res-chain';
      let html = `<span class="res-chain-arrow">⟶</span><span class="res-chain-item">${r.chain.processed}</span>`;
      if (r.chain.final1) html += `<span class="res-chain-arrow">⟶</span><span class="res-chain-item">${r.chain.final1.name}</span><span class="res-chain-badge">${r.chain.final1.category}</span>`;
      if (r.chain.final2) html += `<span class="res-chain-item"> · ${r.chain.final2.name}</span><span class="res-chain-badge">${r.chain.final2.category}</span>`;
      chainEl.innerHTML = html;
      section.appendChild(chainEl);
    }

    for (const { terrain, locs } of matchedTerrains) {
      const color = TERRAINS[terrain]?.color || '#888';
      const tEl = document.createElement('div');
      tEl.className = 'res-terrain';
      tEl.innerHTML = `<div class="res-terrain-label"><span class="swatch" style="background:${color};width:9px;height:9px;border-radius:2px"></span>${terrain}</div>`;
      for (const l of locs) {
        const row = document.createElement('div');
        row.className = 'res-loc';
        row.innerHTML = `${starsHtml(l)}<span>${l.location}</span>`;
        tEl.appendChild(row);
      }
      section.appendChild(tEl);
    }

    out.appendChild(section);
  }

  if (!out.children.length) {
    out.innerHTML = '<div class="res-empty">No resources match the selected filters.</div>';
  }
}

// ── Star editing ──────────────────────────────────────────────────────────
const resResults  = document.getElementById('resource-results');
const resEditBtn  = document.getElementById('res-edit-btn');
let   editMode    = false;

resEditBtn.addEventListener('click', () => {
  if (!editMode && !currentUser) { showModal(); return; }
  editMode = !editMode;
  resEditBtn.classList.toggle('active', editMode);
  resEditBtn.textContent = editMode ? '✎ Done' : '✎ Edit Ratings';
  resResults.classList.toggle('edit-mode', editMode);
});

resResults.addEventListener('mouseover', (e) => {
  if (!editMode) return;
  const star = e.target.closest('.res-loc-star');
  if (!star) return;
  const wrap = star.closest('.res-loc-stars-wrap');
  const val  = parseInt(star.dataset.star);
  wrap.querySelectorAll('.res-loc-star').forEach((s, i) => s.classList.toggle('preview', i < val));
});

resResults.addEventListener('mouseout', (e) => {
  if (!editMode) return;
  const wrap = e.target.closest('.res-loc-stars-wrap');
  if (wrap && !wrap.contains(e.relatedTarget))
    wrap.querySelectorAll('.res-loc-star').forEach(s => s.classList.remove('preview'));
});

resResults.addEventListener('click', async (e) => {
  if (!editMode) return;
  const star = e.target.closest('.res-loc-star');
  if (!star) return;
  const wrap     = star.closest('.res-loc-stars-wrap');
  const locId    = parseInt(wrap.dataset.locId);
  const newStars = parseInt(star.dataset.star);

  const res = await fetch(`/api/resource-locations/${locId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ stars: newStars }),
  });
  if (!res.ok) return;

  for (const r of resourceData) {
    const loc = r.locations.find(l => l.id === locId);
    if (loc) { loc.stars = newStars; break; }
  }
  wrap.querySelectorAll('.res-loc-star').forEach((s, i) => {
    s.className = `res-loc-star ${i < newStars ? 'filled' : 'empty'}`;
  });
});

// ── Init ──────────────────────────────────────────────────────────────────
(async () => {
  const [resResp, regResp, terResp] = await Promise.all([
    fetch('/api/resources').then(r => r.json()).catch(() => ({ resources: [] })),
    fetch('/api/regions').then(r => r.json()).catch(() => ({ countries: {}, states: {} })),
    fetch('/api/terrains').then(r => r.json()).catch(() => ({ terrains: [] })),
  ]);
  resourceData = resResp.resources || [];
  regions = { countries: regResp.countries || {}, states: regResp.states || {} };
  for (const t of (terResp.terrains || [])) TERRAINS[t.name] = { color: t.color, icon: t.icon };
  initTerrainUI();
  initDropdowns();
  populateResNames();
  await loadCurrentRegion();

  const token = getToken();
  if (!token) { onLoggedOut(); return; }
  try {
    const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) { onLoggedIn((await res.json()).user); return; }
  } catch {}
  clearToken();
  onLoggedOut();
})();
