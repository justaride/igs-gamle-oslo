import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Map from './components/Map'
import SiteSidebar from './components/SiteSidebar'
import ExportButton from './components/ExportButton'
import DrawTools from './components/DrawTools'
import { useStore } from './hooks/useStore'
import './app.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AppContent() {
  const { selectedSiteId, editingGeometry, setEditingGeometry } = useStore()

  return (
    <div className="app">
      <header className="app-header">
        <h1>IGS Gamle Oslo</h1>
        <span className="subtitle">Uformelle grøntområder — interaktivt kartverk</span>
        <div className="header-actions">
          {selectedSiteId && (
            <button
              className={`btn ${editingGeometry ? 'btn-active' : ''}`}
              onClick={() => setEditingGeometry(!editingGeometry)}
            >
              {editingGeometry ? 'Avslutt tegning' : 'Juster polygon'}
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
