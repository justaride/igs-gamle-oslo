import Map from '../components/Map'
import ReviewQueuePanel from '../components/ReviewQueuePanel'
import SiteSidebar from '../components/SiteSidebar'
import ExportButton from '../components/ExportButton'
import SiteSearch from '../components/SiteSearch'
import { useStore } from '../hooks/useStore'
import { useSites } from '../hooks/useSites'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import type { SiteStatus } from '../types'

const STATUS_FILTERS: { value: 'all' | SiteStatus; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'candidate', label: 'Kandidat' },
  { value: 'validated', label: 'Validert' },
  { value: 'rejected', label: 'Avvist' },
]

function StatusFilterPills() {
  const { statusFilter, setStatusFilter } = useStore()
  const { data: sites } = useSites()

  const counts: Record<string, number> = { all: 0, candidate: 0, validated: 0, rejected: 0 }
  if (sites) {
    for (const feature of sites.features) {
      counts[feature.properties.status] += 1
      counts.all += 1
    }
  }

  return (
    <div className="status-pills">
      {STATUS_FILTERS.map((statusFilterOption) => (
        <button
          key={statusFilterOption.value}
          className={`status-pill ${
            statusFilter === statusFilterOption.value ? 'status-pill-active' : ''
          }`}
          onClick={() => setStatusFilter(statusFilterOption.value)}
        >
          {statusFilterOption.label} ({counts[statusFilterOption.value]})
        </button>
      ))}
    </div>
  )
}

export default function MapPage() {
  const { selectedSiteId, editingGeometry, setEditingGeometry, editMode, setEditMode } = useStore()
  useKeyboardShortcuts()

  const startEdit = (mode: 'reshape' | 'redraw') => {
    setEditMode(mode)
    setEditingGeometry(true)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="page-title-group">
          <h2>Kartarbeidsflate</h2>
          <span className="subtitle">
            Valider, søk, rediger geometri og eksporter kartdata for Gamle Oslo.
          </span>
        </div>
        <SiteSearch />
        <StatusFilterPills />
        <div className="header-actions">
          {selectedSiteId && !editingGeometry && (
            <>
              <button className="btn" onClick={() => startEdit('reshape')}>
                Rediger grense
              </button>
              <button className="btn btn-secondary" onClick={() => startEdit('redraw')}>
                Tegn ny polygon
              </button>
            </>
          )}
          {editingGeometry && (
            <button className="btn btn-active" onClick={() => setEditingGeometry(false)}>
              Avslutt {editMode === 'reshape' ? 'redigering' : 'tegning'}
            </button>
          )}
          <ExportButton />
        </div>
      </header>
      <div className="app-body">
        <div className="map-container">
          <Map />
        </div>
        {selectedSiteId ? <SiteSidebar /> : <ReviewQueuePanel />}
      </div>
    </div>
  )
}
