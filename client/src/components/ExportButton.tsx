import { api } from '../services/api'
import { useStore } from '../hooks/useStore'

const FILTER_LABELS: Record<string, string> = {
  all: '',
  candidate: ' (Kandidat)',
  validated: ' (Validert)',
  rejected: ' (Avvist)',
}

export default function ExportButton() {
  const statusFilter = useStore((s) => s.statusFilter)
  const label = FILTER_LABELS[statusFilter] ?? ''

  return (
    <div className="export-group">
      <button className="export-btn" onClick={() => api.downloadExcel(statusFilter)}>
        Excel{label}
      </button>
      <button className="export-btn" onClick={() => api.downloadGeoJSON(statusFilter)}>
        GeoJSON{label}
      </button>
    </div>
  )
}
