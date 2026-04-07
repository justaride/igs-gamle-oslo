import { useState, useCallback } from 'react'
import Map from '../components/Map'
import ReviewQueuePanel from '../components/ReviewQueuePanel'
import SiteSidebar from '../components/SiteSidebar'
import ExportButton from '../components/ExportButton'
import SiteSearch from '../components/SiteSearch'
import LoginDialog from '../components/LoginDialog'
import SiteCreateForm from '../components/SiteCreateForm'
import { useStore } from '../hooks/useStore'
import { useSites } from '../hooks/useSites'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { api } from '../services/api'
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
  const { selectedSiteId, editingGeometry, setEditingGeometry, editMode, setEditMode, creatingNewSite, setCreatingNewSite } = useStore()
  useKeyboardShortcuts()

  const [showLogin, setShowLogin] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(api.hasEditorToken())

  const handleLogout = useCallback(() => {
    api.clearEditorToken()
    setIsAuthenticated(false)
  }, [])

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
          {isAuthenticated && !selectedSiteId && !editingGeometry && !creatingNewSite && (
            <button className="btn" onClick={() => setCreatingNewSite(true)}>
              Nytt område
            </button>
          )}
          {creatingNewSite && (
            <button className="btn btn-active" onClick={() => setCreatingNewSite(false)}>
              Avbryt tegning
            </button>
          )}
          {isAuthenticated && selectedSiteId && !editingGeometry && !creatingNewSite && (
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
          {isAuthenticated ? (
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logg ut
            </button>
          ) : (
            <button className="btn" onClick={() => setShowLogin(true)}>
              Logg inn
            </button>
          )}
        </div>
      </header>
      <div className="app-body">
        <div className="map-container">
          <Map />
        </div>
        {creatingNewSite ? <SiteCreateForm /> : selectedSiteId ? <SiteSidebar /> : <ReviewQueuePanel />}
      </div>
      {showLogin && (
        <LoginDialog
          onClose={() => setShowLogin(false)}
          onSuccess={() => {
            setShowLogin(false)
            setIsAuthenticated(true)
          }}
        />
      )}
    </div>
  )
}
