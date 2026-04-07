const BASE = '/api'
const EDITOR_TOKEN_STORAGE_KEY = 'igs-editor-token'

function getEditorToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(EDITOR_TOKEN_STORAGE_KEY)?.trim() ?? ''
}

function buildHeaders(options?: RequestInit, requireEditorToken = false) {
  const headers = new Headers(options?.headers)

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (requireEditorToken) {
    const token = getEditorToken()
    if (token) {
      headers.set('x-editor-token', token)
    }
  }

  return headers
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: buildHeaders(options),
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`)
  return res.json()
}

export const api = {
  getSites: () => fetchJSON('/sites'),

  getReviewQueue: (limit = 200) => fetchJSON(`/sites/review-queue?limit=${limit}`),

  getSite: (id: number) => fetchJSON(`/sites/${id}`),

  updateSite: (id: number, fields: Record<string, unknown>) =>
    fetchJSON(`/sites/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(undefined, true),
      body: JSON.stringify(fields),
    }),

  updateSiteGeometry: (id: number, geometry: object) =>
    fetchJSON(`/sites/${id}/geometry`, {
      method: 'PATCH',
      headers: buildHeaders(undefined, true),
      body: JSON.stringify({ geometry }),
    }),

  updateSiteStatus: (id: number, status: string) =>
    fetchJSON(`/sites/${id}/status`, {
      method: 'PATCH',
      headers: buildHeaders(undefined, true),
      body: JSON.stringify({ status }),
    }),

  resetSiteOverrides: (id: number) =>
    fetchJSON(`/sites/${id}/reset-overrides`, {
      method: 'POST',
      headers: buildHeaders(undefined, true),
    }),

  getSpecies: () => fetchJSON('/species'),

  getSpeciesBySite: (siteId: number) => fetchJSON(`/species/site/${siteId}`),

  getParks: () => fetchJSON('/parks'),

  getContextLayers: (keys?: string[]) => {
    const query = keys && keys.length > 0
      ? `?keys=${encodeURIComponent(keys.join(','))}`
      : ''
    return fetchJSON(`/context-layers${query}`)
  },

  downloadExcel: async () => {
    const res = await fetch(`${BASE}/export/excel`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'IGS_Assessment_GamleOslo.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  },

  setEditorToken: (token: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(EDITOR_TOKEN_STORAGE_KEY, token.trim())
    }
  },

  clearEditorToken: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(EDITOR_TOKEN_STORAGE_KEY)
    }
  },
}
