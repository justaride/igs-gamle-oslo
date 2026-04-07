import { type FormEvent, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSpeciesBySite } from '../hooks/useSpecies'
import { useToastStore } from '../hooks/useToast'
import { api } from '../services/api'

type SpeciesRow = {
  id: number
  scientific_name: string
  vernacular_name: string | null
  red_list_category: string | null
  is_alien: boolean
  observation_count: number
}

const RED_LIST_COLORS: Record<string, string> = {
  CR: '#cc0000',
  EN: '#ff4444',
  VU: '#ff8800',
  NT: '#ffcc00',
}

function AddObservationForm({ siteId }: { siteId: number }) {
  const [open, setOpen] = useState(false)
  const [scientificName, setScientificName] = useState('')
  const [vernacularName, setVernacularName] = useState('')
  const [count, setCount] = useState('1')
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createSpeciesObservation(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['species'] })
      qc.invalidateQueries({ queryKey: ['species-site', siteId] })
      setScientificName('')
      setVernacularName('')
      setCount('1')
      setOpen(false)
      addToast('Observasjon registrert', 'success')
    },
    onError: () => addToast('Registrering feilet', 'error'),
  })

  if (!open) {
    return (
      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(true)}>
        Legg til observasjon
      </button>
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!scientificName.trim()) return
    create.mutate({
      site_id: siteId,
      scientific_name: scientificName.trim(),
      vernacular_name: vernacularName.trim() || undefined,
      observation_count: Number(count) || 1,
      latitude: 0,
      longitude: 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="species-add-form">
      <input
        type="text"
        placeholder="Vitenskapelig navn"
        value={scientificName}
        onChange={(e) => setScientificName(e.target.value)}
        required
        autoFocus
      />
      <input
        type="text"
        placeholder="Norsk navn (valgfritt)"
        value={vernacularName}
        onChange={(e) => setVernacularName(e.target.value)}
      />
      <input
        type="number"
        placeholder="Antall"
        value={count}
        onChange={(e) => setCount(e.target.value)}
        min="1"
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Avbryt</button>
        <button type="submit" className="btn" disabled={create.isPending}>
          {create.isPending ? 'Lagrer...' : 'Registrer'}
        </button>
      </div>
    </form>
  )
}

export default function SpeciesPanel({ siteId }: { siteId: number }) {
  const { data: species, isLoading } = useSpeciesBySite(siteId)

  if (isLoading) return <div className="species-panel">Laster arter...</div>

  const rows = (species as SpeciesRow[] | undefined) || []

  const redListed = rows.filter((s) => s.red_list_category && ['CR', 'EN', 'VU', 'NT'].includes(s.red_list_category))
  const aliens = rows.filter((s) => s.is_alien)
  const other = rows.filter((s) => !s.is_alien && (!s.red_list_category || !['CR', 'EN', 'VU', 'NT'].includes(s.red_list_category)))

  return (
    <div className="species-panel">
      <h4>Arter ({rows.length})</h4>

      {rows.length === 0 && <em>Ingen arter registrert</em>}

      {redListed.length > 0 && (
        <div className="species-group">
          <h5>Rødlistede ({redListed.length})</h5>
          {redListed.map((s) => (
            <div key={s.id} className="species-row">
              <span
                className="rl-badge"
                style={{ backgroundColor: RED_LIST_COLORS[s.red_list_category!] }}
              >
                {s.red_list_category}
              </span>
              <span className="species-name">
                <em>{s.scientific_name}</em>
                {s.vernacular_name && ` — ${s.vernacular_name}`}
              </span>
              <span className="obs-count">{s.observation_count}</span>
            </div>
          ))}
        </div>
      )}

      {aliens.length > 0 && (
        <div className="species-group">
          <h5>Fremmede arter ({aliens.length})</h5>
          {aliens.map((s) => (
            <div key={s.id} className="species-row alien">
              <span className="species-name">
                <em>{s.scientific_name}</em>
                {s.vernacular_name && ` — ${s.vernacular_name}`}
              </span>
              <span className="obs-count">{s.observation_count}</span>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="species-group">
          <h5>Andre ({other.length})</h5>
          {other.slice(0, 20).map((s) => (
            <div key={s.id} className="species-row">
              <span className="species-name">
                <em>{s.scientific_name}</em>
                {s.vernacular_name && ` — ${s.vernacular_name}`}
              </span>
              <span className="obs-count">{s.observation_count}</span>
            </div>
          ))}
          {other.length > 20 && <div className="more">...og {other.length - 20} til</div>}
        </div>
      )}

      {api.hasEditorToken() && <AddObservationForm siteId={siteId} />}
    </div>
  )
}
