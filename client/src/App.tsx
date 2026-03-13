import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Map from './components/Map'
import SiteSidebar from './components/SiteSidebar'
import ExportButton from './components/ExportButton'
import SiteSearch from './components/SiteSearch'
import { useStore } from './hooks/useStore'
import { useSites } from './hooks/useSites'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { SiteStatus } from './types'
import './app.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

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
    for (const f of sites.features) {
      counts[f.properties.status]++
      counts.all++
    }
  }

  return (
    <div className="status-pills">
      {STATUS_FILTERS.map((sf) => (
        <button
          key={sf.value}
          className={`status-pill ${statusFilter === sf.value ? 'status-pill-active' : ''}`}
          onClick={() => setStatusFilter(sf.value)}
        >
          {sf.label} ({counts[sf.value]})
        </button>
      ))}
    </div>
  )
}

function AppContent() {
  const { selectedSiteId, editingGeometry, setEditingGeometry, editMode, setEditMode } = useStore()
  useKeyboardShortcuts()

  const startEdit = (mode: 'reshape' | 'redraw') => {
    setEditMode(mode)
    setEditingGeometry(true)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>IGS Gamle Oslo</h1>
        <span className="subtitle">Uformelle grøntområder — interaktivt kartverk</span>
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
        <SiteSidebar />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
