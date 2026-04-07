import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

type Change = {
  id: number
  fieldName: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: string
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status',
  igs_type: 'IGS-type',
  subtype: 'Subtype',
  name: 'Navn',
  ownership: 'Eierskap',
  access_control: 'Tilgang',
  maintenance: 'Vedlikehold',
  dangerous: 'Farlig',
  noisy: 'Støy',
  too_small: 'For lite',
  prox_housing: 'Nær bolig',
  hidden_gem: 'Skjult perle',
  notes: 'Notater',
  geometry: 'Geometri',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('nb-NO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChangeHistory({ siteId }: { siteId: number }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery<{ changes: Change[] }>({
    queryKey: ['site-changes', siteId],
    queryFn: () => api.getSiteChanges(siteId) as Promise<{ changes: Change[] }>,
    enabled: open,
  })

  return (
    <div className="change-history">
      <button
        className="change-history-toggle"
        onClick={() => setOpen(!open)}
      >
        {open ? '▾' : '▸'} Endringshistorikk
      </button>
      {open && (
        <div className="change-history-list">
          {isLoading && <p className="change-history-empty">Laster...</p>}
          {data && data.changes.length === 0 && (
            <p className="change-history-empty">Ingen endringer registrert</p>
          )}
          {data?.changes.map((c) => (
            <div key={c.id} className="change-history-item">
              <span className="change-field">{FIELD_LABELS[c.fieldName] ?? c.fieldName}</span>
              <span className="change-values">
                {c.oldValue ?? '–'} → {c.newValue ?? '–'}
              </span>
              <span className="change-meta">{formatDate(c.changedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
