import L from 'leaflet';

// ── Terrain config ────────────────────────────────────────────────────────
const TERRAINS = {
  Flat:     { color: '#72c24a', icon: '🌾' },
  Arid:     { color: '#d4980a', icon: '🌵' },
  Desert:   { color: '#f0d040', icon: '🏜️' },
  Tropical: { color: '#1a7d38', icon: '🌴' },
  Wet:      { color: '#2878c0', icon: '💧' },
  Cold:     { color: '#a0d4ee', icon: '❄️' },
  Hill:     { color: '#3a9e7a', icon: '⛰️' },
  Mountain: { color: '#b86820', icon: '🏔️' },
};

// ── Country config ────────────────────────────────────────────────────────
const COUNTRIES = {
  'Netherlands':    { center: [52.3,  5.3], zoom: 8, latMin: 50.7, latMax: 53.6, lngMin:  3.3, lngMax:  7.3 },
  'Belgium':        { center: [50.6,  4.5], zoom: 8, latMin: 49.5, latMax: 51.5, lngMin:  2.5, lngMax:  6.4 },
  'Luxembourg':     { center: [49.8,  6.1], zoom: 9, latMin: 49.4, latMax: 50.2, lngMin:  5.7, lngMax:  6.5 },
  'Germany':        { center: [51.2, 10.5], zoom: 6, latMin: 47.3, latMax: 55.1, lngMin:  5.9, lngMax: 15.1 },
  'France':         { center: [46.5,  2.3], zoom: 6, latMin: 41.3, latMax: 51.1, lngMin: -5.1, lngMax:  9.6 },
  'United Kingdom': { center: [54.5, -3.5], zoom: 6, latMin: 49.9, latMax: 60.9, lngMin: -8.2, lngMax:  1.8 },
  'Ireland':        { center: [53.2, -8.2], zoom: 7, latMin: 51.4, latMax: 55.4, lngMin:-10.5, lngMax: -5.9 },
  'Spain':          { center: [40.4, -3.7], zoom: 6, latMin: 35.9, latMax: 43.8, lngMin: -9.3, lngMax:  4.3 },
  'Portugal':       { center: [39.6, -8.0], zoom: 7, latMin: 36.9, latMax: 42.2, lngMin: -9.5, lngMax: -6.2 },
  'Italy':          { center: [42.5, 12.5], zoom: 6, latMin: 35.5, latMax: 47.1, lngMin:  6.6, lngMax: 18.5 },
  'Switzerland':    { center: [46.8,  8.2], zoom: 8, latMin: 45.8, latMax: 47.8, lngMin:  5.9, lngMax: 10.5 },
  'Austria':        { center: [47.7, 13.3], zoom: 7, latMin: 46.4, latMax: 49.0, lngMin:  9.5, lngMax: 17.2 },
  'Denmark':        { center: [56.2, 11.7], zoom: 7, latMin: 54.6, latMax: 57.8, lngMin:  8.1, lngMax: 15.2 },
  'Sweden':         { center: [62.2, 17.6], zoom: 5, latMin: 55.3, latMax: 69.1, lngMin: 11.0, lngMax: 24.2 },
  'Norway':         { center: [64.6, 17.9], zoom: 5, latMin: 57.9, latMax: 71.2, lngMin:  4.5, lngMax: 31.2 },
  'Finland':        { center: [64.5, 26.0], zoom: 5, latMin: 59.8, latMax: 70.1, lngMin: 20.0, lngMax: 31.6 },
  'Poland':         { center: [52.0, 19.1], zoom: 6, latMin: 49.0, latMax: 54.9, lngMin: 14.1, lngMax: 24.2 },
  'Czech Republic': { center: [49.8, 15.5], zoom: 7, latMin: 48.6, latMax: 51.1, lngMin: 12.1, lngMax: 18.9 },
  'United States':  { center: [39.5,-98.5], zoom: 5, latMin: 24.5, latMax: 49.4, lngMin:-124.8, lngMax:-66.9 },
};

// ── US States config ──────────────────────────────────────────────────────
const US_STATES = {
  'Alabama':        { latMin: 30.2, latMax: 35.0, lngMin: -88.5, lngMax: -84.9 },
  'Alaska':         { latMin: 54.6, latMax: 71.4, lngMin:-168.0, lngMax:-129.9 },
  'Arizona':        { latMin: 31.3, latMax: 37.0, lngMin:-114.8, lngMax:-109.0 },
  'Arkansas':       { latMin: 33.0, latMax: 36.5, lngMin: -94.6, lngMax: -89.6 },
  'California':     { latMin: 32.5, latMax: 42.0, lngMin:-124.5, lngMax:-114.1 },
  'Colorado':       { latMin: 37.0, latMax: 41.0, lngMin:-109.1, lngMax:-102.0 },
  'Connecticut':    { latMin: 41.0, latMax: 42.1, lngMin: -73.7, lngMax: -71.8 },
  'Delaware':       { latMin: 38.5, latMax: 39.8, lngMin: -75.8, lngMax: -75.0 },
  'Florida':        { latMin: 24.5, latMax: 31.0, lngMin: -87.6, lngMax: -80.0 },
  'Georgia':        { latMin: 30.4, latMax: 35.0, lngMin: -85.6, lngMax: -80.8 },
  'Hawaii':         { latMin: 18.9, latMax: 22.2, lngMin:-160.3, lngMax:-154.8 },
  'Idaho':          { latMin: 42.0, latMax: 49.0, lngMin:-117.2, lngMax:-111.0 },
  'Illinois':       { latMin: 37.0, latMax: 42.5, lngMin: -91.5, lngMax: -87.5 },
  'Indiana':        { latMin: 37.8, latMax: 41.8, lngMin: -88.1, lngMax: -84.8 },
  'Iowa':           { latMin: 40.4, latMax: 43.5, lngMin: -96.6, lngMax: -90.1 },
  'Kansas':         { latMin: 37.0, latMax: 40.0, lngMin:-102.1, lngMax: -94.6 },
  'Kentucky':       { latMin: 36.5, latMax: 39.1, lngMin: -89.6, lngMax: -81.9 },
  'Louisiana':      { latMin: 29.0, latMax: 33.0, lngMin: -94.1, lngMax: -89.0 },
  'Maine':          { latMin: 43.1, latMax: 47.5, lngMin: -71.1, lngMax: -66.9 },
  'Maryland':       { latMin: 37.9, latMax: 39.7, lngMin: -79.5, lngMax: -75.1 },
  'Massachusetts':  { latMin: 41.2, latMax: 42.9, lngMin: -73.5, lngMax: -69.9 },
  'Michigan':       { latMin: 41.7, latMax: 48.3, lngMin: -90.4, lngMax: -82.4 },
  'Minnesota':      { latMin: 43.5, latMax: 49.4, lngMin: -97.2, lngMax: -89.5 },
  'Mississippi':    { latMin: 30.2, latMax: 35.0, lngMin: -91.7, lngMax: -88.1 },
  'Missouri':       { latMin: 36.0, latMax: 40.6, lngMin: -95.8, lngMax: -89.1 },
  'Montana':        { latMin: 44.4, latMax: 49.0, lngMin:-116.1, lngMax:-104.0 },
  'Nebraska':       { latMin: 40.0, latMax: 43.0, lngMin:-104.1, lngMax: -95.3 },
  'Nevada':         { latMin: 35.0, latMax: 42.0, lngMin:-120.0, lngMax:-114.0 },
  'New Hampshire':  { latMin: 42.7, latMax: 45.3, lngMin: -72.6, lngMax: -70.7 },
  'New Jersey':     { latMin: 38.9, latMax: 41.4, lngMin: -75.6, lngMax: -73.9 },
  'New Mexico':     { latMin: 31.3, latMax: 37.0, lngMin:-109.1, lngMax:-103.0 },
  'New York':       { latMin: 40.5, latMax: 45.0, lngMin: -79.8, lngMax: -71.9 },
  'North Carolina': { latMin: 33.8, latMax: 36.6, lngMin: -84.3, lngMax: -75.5 },
  'North Dakota':   { latMin: 45.9, latMax: 49.0, lngMin:-104.1, lngMax: -96.6 },
  'Ohio':           { latMin: 38.4, latMax: 42.3, lngMin: -84.8, lngMax: -80.5 },
  'Oklahoma':       { latMin: 33.6, latMax: 37.0, lngMin:-103.0, lngMax: -94.4 },
  'Oregon':         { latMin: 42.0, latMax: 46.3, lngMin:-124.6, lngMax:-116.5 },
  'Pennsylvania':   { latMin: 39.7, latMax: 42.3, lngMin: -80.5, lngMax: -74.7 },
  'Rhode Island':   { latMin: 41.1, latMax: 42.0, lngMin: -71.9, lngMax: -71.1 },
  'South Carolina': { latMin: 32.0, latMax: 35.2, lngMin: -83.4, lngMax: -78.5 },
  'South Dakota':   { latMin: 42.5, latMax: 45.9, lngMin:-104.1, lngMax: -96.4 },
  'Tennessee':      { latMin: 35.0, latMax: 36.7, lngMin: -90.3, lngMax: -81.6 },
  'Texas':          { latMin: 25.8, latMax: 36.5, lngMin:-106.7, lngMax: -93.5 },
  'Utah':           { latMin: 37.0, latMax: 42.0, lngMin:-114.1, lngMax:-109.0 },
  'Vermont':        { latMin: 42.7, latMax: 45.0, lngMin: -73.4, lngMax: -71.5 },
  'Virginia':       { latMin: 36.5, latMax: 39.5, lngMin: -83.7, lngMax: -75.2 },
  'Washington':     { latMin: 45.5, latMax: 49.0, lngMin:-124.8, lngMax:-116.9 },
  'West Virginia':  { latMin: 37.2, latMax: 40.6, lngMin: -82.6, lngMax: -77.7 },
  'Wisconsin':      { latMin: 42.5, latMax: 47.1, lngMin: -92.9, lngMax: -86.8 },
  'Wyoming':        { latMin: 41.0, latMax: 45.0, lngMin:-111.1, lngMax:-104.1 },
};

const STEP = 0.1;

// ── API client ────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

const api = {
  async load(region) {
    try {
      const res = await fetch(`/api/terrain/${region}`);
      if (!res.ok) return {};
      return (await res.json()).data || {};
    } catch { return {}; }
  },
  save: debounce(async (region, data) => {
    try {
      await fetch(`/api/terrain/${region}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
    } catch {}
  }, 600),
  async remove(region) {
    try {
      await fetch(`/api/terrain/${region}`, { method: 'DELETE' });
    } catch {}
  },
};

// ── State ─────────────────────────────────────────────────────────────────
let activeTerrain  = null;
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
        if (e.originalEvent.button !== 0) return;
        isDragging = true;
        paintCell(key, activeTerrain);
      });
      rect.on('mouseover', () => { if (isDragging) paintCell(key, activeTerrain); });
      rect.on('contextmenu', (e) => {
        L.DomEvent.preventDefault(e);
        paintCell(key, null);
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
    const bounds = US_STATES[currentState];
    const { center, zoom } = computeView(bounds);
    await buildGrid(bounds, activeRegionKey(), center, zoom);
  } else {
    const c = COUNTRIES[currentCountry];
    await buildGrid(c, activeRegionKey(), c.center, c.zoom);
  }
}

// ── Paint ─────────────────────────────────────────────────────────────────
function paintCell(key, terrainKey) {
  const rect = cells[key];
  if (!rect) return;

  if (terrainKey) cellState[key] = terrainKey;
  else delete cellState[key];

  const hidden = terrainKey && hiddenTerrains.has(terrainKey);
  rect.setStyle(hidden
    ? { ...styleFor(terrainKey), fillOpacity: 0, opacity: 0 }
    : styleFor(terrainKey || null)
  );

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

  api.save(activeRegionKey(), cellState);
}

// ── Sidebar: Country selector ─────────────────────────────────────────────
const countrySelect = document.getElementById('country-select');
const stateSelect   = document.getElementById('state-select');

Object.keys(COUNTRIES).forEach(name => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  if (name === currentCountry) opt.selected = true;
  countrySelect.appendChild(opt);
});

Object.keys(US_STATES).forEach(name => {
  const opt = document.createElement('option');
  opt.value = name;
  opt.textContent = name;
  if (name === currentState) opt.selected = true;
  stateSelect.appendChild(opt);
});

if (currentCountry === 'United States') stateSelect.style.display = 'block';

countrySelect.addEventListener('change', async () => {
  currentCountry = countrySelect.value;
  localStorage.setItem('selected-country', currentCountry);
  const isUS = currentCountry === 'United States';
  stateSelect.style.display = isUS ? 'block' : 'none';
  if (isUS) currentState = stateSelect.value || null;
  await loadCurrentRegion();
});

stateSelect.addEventListener('change', async () => {
  currentState = stateSelect.value || null;
  if (currentState) localStorage.setItem('selected-state', currentState);
  await loadCurrentRegion();
});

// ── Sidebar: Paint ────────────────────────────────────────────────────────
const terrainList = document.getElementById('terrain-list');
const terrainBtns = {};

Object.entries(TERRAINS).forEach(([key, t]) => {
  const btn = document.createElement('div');
  btn.className = 'terrain-btn';
  btn.innerHTML = `<div class="swatch" style="background:${t.color}"></div>
                   <span class="terrain-label">${t.icon} ${key}</span>`;
  btn.addEventListener('click', () => select(key));
  terrainBtns[key] = btn;
  terrainList.appendChild(btn);
});

function select(key) {
  activeTerrain = key;
  Object.values(terrainBtns).forEach(b => b.classList.remove('active'));
  document.getElementById('eraser-btn').classList.remove('active');
  if (key === null) document.getElementById('eraser-btn').classList.add('active');
  else terrainBtns[key]?.classList.add('active');
}

document.getElementById('eraser-btn').addEventListener('click', () => select(null));

// ── Sidebar: Filters ──────────────────────────────────────────────────────
const filterList = document.getElementById('filter-list');
const filterRows = {};

Object.entries(TERRAINS).forEach(([key, t]) => {
  const row = document.createElement('div');
  row.className = 'filter-row visible';
  row.innerHTML = `<div class="swatch" style="background:${t.color};width:10px;height:10px"></div>
                   <div class="filter-check">✓</div>
                   <span class="terrain-label" style="font-size:13px">${key}</span>`;
  row.addEventListener('click', () => toggleFilter(key));
  filterRows[key] = row;
  filterList.appendChild(row);
});

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
    rect.setStyle(hidden ? { ...styleFor(terrain), fillOpacity: 0, opacity: 0 } : styleFor(terrain || null));
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
map.on('mousedown', () => { if (activeTerrain !== undefined) map.dragging.disable(); });
document.addEventListener('mouseup', () => map.dragging.enable());

// ── Export ────────────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  const label = currentCountry === 'United States' && currentState
    ? `us-${slugify(currentState)}`
    : slugify(currentCountry);
  const json = JSON.stringify(cellState, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `terrain-${label}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Import ────────────────────────────────────────────────────────────────
const importInput = document.getElementById('import-input');
document.getElementById('import-btn').addEventListener('click', () => importInput.click());

importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const validTerrains = new Set(Object.keys(TERRAINS));
      const invalid = Object.values(data).filter(v => !validTerrains.has(v));
      if (invalid.length) { alert(`Unknown terrain types: ${[...new Set(invalid)].join(', ')}`); return; }
      Object.values(markers).forEach(m => m.remove());
      for (const k in markers) delete markers[k];
      cellState = data;
      api.save(activeRegionKey(), cellState);
      Object.entries(cells).forEach(([key, rect]) => {
        const terrain = cellState[key] || null;
        rect.setStyle(styleFor(terrain));
        const [lat, lng] = key.split(',').map(Number);
        rect.setTooltipContent(tooltipFor(terrain, lat, lng));
        if (terrain) {
          markers[key] = L.marker(cellCenter(lat, lng), {
            icon: makeIcon(terrain), interactive: false, zIndexOffset: 10,
          }).addTo(map);
        }
      });
    } catch { alert('Invalid JSON file.'); }
    importInput.value = '';
  };
  reader.readAsText(file);
});

// ── Reset ─────────────────────────────────────────────────────────────────
document.getElementById('reset-btn').addEventListener('click', () => {
  const label = currentCountry === 'United States' && currentState
    ? `${currentState}` : currentCountry;
  if (!confirm(`Reset all terrain for ${label}?`)) return;
  cellState = {};
  api.remove(activeRegionKey());
  Object.entries(cells).forEach(([key, rect]) => {
    const [lat, lng] = key.split(',').map(Number);
    rect.setStyle(styleFor(null));
    rect.setTooltipContent(tooltipFor(null, lat, lng));
  });
  Object.values(markers).forEach(m => m.remove());
  for (const k in markers) delete markers[k];
});

// ── Init ──────────────────────────────────────────────────────────────────
loadCurrentRegion();
