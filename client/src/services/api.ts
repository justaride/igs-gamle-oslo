const BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
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
      body: JSON.stringify(fields),
    }),

  updateSiteGeometry: (id: number, geometry: object) =>
    fetchJSON(`/sites/${id}/geometry`, {
      method: 'PATCH',
      body: JSON.stringify({ geometry }),
    }),

  updateSiteStatus: (id: number, status: string) =>
    fetchJSON(`/sites/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
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
}
