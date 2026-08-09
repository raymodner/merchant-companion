const BASE = '/api'
const json = { 'Content-Type': 'application/json' }

export const api = {
  // ── Terrain ───────────────────────────────────────────────────────────────
  async loadTerrain(regionId) {
    try {
      const res = await fetch(`${BASE}/terrain/${regionId}`)
      if (!res.ok) return {}
      const data = await res.json()
      return data.data || {}
    } catch { return {} }
  },

  async paintCell(regionId, cellKey, terrainKey) {
    try {
      await fetch(`${BASE}/terrain/${regionId}/cell`, {
        method: 'POST',
        headers: json,
        credentials: 'include',
        body: JSON.stringify({ cellKey, terrainKey: terrainKey || null }),
      })
    } catch {}
  },

  // ── Lookup ────────────────────────────────────────────────────────────────
  async getResources() {
    try {
      const res = await fetch(`${BASE}/resources`)
      return res.ok ? res.json() : { resources: [] }
    } catch { return { resources: [] } }
  },

  async getTerrains() {
    try {
      const res = await fetch(`${BASE}/terrains`)
      return res.ok ? res.json() : { terrains: [] }
    } catch { return { terrains: [] } }
  },

  async getRegions() {
    try {
      const res = await fetch(`${BASE}/regions`)
      return res.ok ? res.json() : { countries: {}, states: {} }
    } catch { return { countries: {}, states: {} } }
  },

  async getTribes() {
    try {
      const res = await fetch(`${BASE}/tribes`)
      return res.ok ? res.json() : { tribes: [] }
    } catch { return { tribes: [] } }
  },

  async getStages() {
    try {
      const res = await fetch(`${BASE}/settlement-stages`)
      return res.ok ? res.json() : { stages: [] }
    } catch { return { stages: [] } }
  },

  async patchResourceLocation(id, stars) {
    try {
      const res = await fetch(`${BASE}/resource-locations/${id}`, {
        method: 'PATCH',
        headers: json,
        credentials: 'include',
        body: JSON.stringify({ stars }),
      })
      return res.ok
    } catch { return false }
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: json,
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    return { ok: res.ok, data: await res.json() }
  },

  async register(username, email, password) {
    const res = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: json,
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    })
    return { ok: res.ok, data: await res.json() }
  },

  async changePassword(currentPassword, newPassword) {
    const res = await fetch(`${BASE}/auth/password`, {
      method: 'PATCH',
      headers: json,
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    return { ok: res.ok, data: await res.json() }
  },

  async logout() {
    try {
      await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' })
    } catch {}
  },

  async me() {
    try {
      const res = await fetch(`${BASE}/auth/me`, { credentials: 'include' })
      if (!res.ok) return null
      const data = await res.json()
      return data.user || null
    } catch { return null }
  },

  async savePreferences(country, state) {
    try {
      await fetch(`${BASE}/auth/preferences`, {
        method: 'PATCH',
        headers: json,
        credentials: 'include',
        body: JSON.stringify({ country, state: state || null }),
      })
    } catch {}
  },

  // ── Tribe markers ─────────────────────────────────────────────────────────
  async getTribeMarkers(regionId) {
    try {
      const res = await fetch(`${BASE}/tribe-markers/${regionId}`, {
        credentials: 'include',
      })
      return res.ok ? res.json() : { markers: [] }
    } catch { return { markers: [] } }
  },

  async createTribeMarker(data) {
    const res = await fetch(`${BASE}/tribe-markers`, {
      method: 'POST',
      headers: json,
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return res.ok ? res.json() : null
  },

  async updateTribeMarker(id, data) {
    const res = await fetch(`${BASE}/tribe-markers/${id}`, {
      method: 'PATCH',
      headers: json,
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return { ok: res.ok, data: await res.json() }
  },

  async deleteTribeMarker(id) {
    const res = await fetch(`${BASE}/tribe-markers/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return res.ok
  },

  // ── Settlements ───────────────────────────────────────────────────────────
  async getSettlements(regionId) {
    try {
      const res = await fetch(`${BASE}/player-settlements/${regionId}`, {
        credentials: 'include',
      })
      return res.ok ? res.json() : { settlements: [] }
    } catch { return { settlements: [] } }
  },

  async createSettlement(data) {
    const res = await fetch(`${BASE}/player-settlements`, {
      method: 'POST',
      headers: json,
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return res.ok ? res.json() : null
  },

  async updateSettlement(id, data) {
    const res = await fetch(`${BASE}/player-settlements/${id}`, {
      method: 'PATCH',
      headers: json,
      credentials: 'include',
      body: JSON.stringify(data),
    })
    return { ok: res.ok, data: await res.json() }
  },

  async deleteSettlement(id) {
    const res = await fetch(`${BASE}/player-settlements/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    return res.ok
  },
}
