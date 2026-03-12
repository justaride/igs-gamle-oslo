import { api } from '../services/api'

export default function ExportButton() {
  return (
    <button className="export-btn" onClick={() => api.downloadExcel()}>
      Eksporter Excel
    </button>
  )
}
