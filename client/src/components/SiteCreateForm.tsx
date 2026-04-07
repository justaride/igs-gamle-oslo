import { type FormEvent, useState } from 'react'
import { useCreateSite } from '../hooks/useSites'
import { useStore } from '../hooks/useStore'
import type { IgsType } from '../types'

const IGS_TYPES: { value: IgsType; label: string }[] = [
  { value: 'Residual', label: 'Residual' },
  { value: 'Lot', label: 'Lot' },
  { value: 'Edgeland', label: 'Edgeland' },
  { value: 'Opportunity', label: 'Opportunity' },
]

const SUBTYPE_OPTIONS: Record<IgsType, { value: string; label: string }[]> = {
  Residual: [
    { value: 'Road', label: 'Road' },
    { value: 'Train', label: 'Train' },
  ],
  Lot: [
    { value: 'vacant', label: 'Vacant' },
    { value: 'brownfield', label: 'Brownfield' },
    { value: 'construction', label: 'Construction' },
  ],
  Edgeland: [
    { value: 'Hydro', label: 'Hydro' },
    { value: 'Hydro-buried', label: 'Hydro (begravd elv)' },
    { value: 'Bio', label: 'Bio' },
    { value: 'Geo', label: 'Geo' },
  ],
  Opportunity: [
    { value: 'commercial', label: 'Commercial' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'retail', label: 'Retail' },
  ],
}

export default function SiteCreateForm() {
  const { pendingGeometry, setCreatingNewSite, setPendingGeometry, selectSite, setFlyToSiteId } = useStore()
  const createSite = useCreateSite()

  const [igsType, setIgsType] = useState<IgsType>('Residual')
  const [subtype, setSubtype] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  const handleCancel = () => {
    setCreatingNewSite(false)
    setPendingGeometry(null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!pendingGeometry) return

    createSite.mutate(
      {
        geometry: pendingGeometry,
        igs_type: igsType,
        subtype: subtype || undefined,
        name: name || undefined,
        notes: notes || undefined,
        ownership: 'UNK',
        access_control: 'O',
      },
      {
        onSuccess: (data: unknown) => {
          setCreatingNewSite(false)
          setPendingGeometry(null)
          const feature = data as { properties?: { id?: number } }
          if (feature?.properties?.id) {
            selectSite(feature.properties.id)
            setFlyToSiteId(feature.properties.id)
          }
        },
      }
    )
  }

  return (
    <div className="site-sidebar">
      <div className="sidebar-header">
        <h3>Nytt IGS-område</h3>
      </div>
      <div className="sidebar-content">
        {!pendingGeometry ? (
          <div className="empty-state" style={{ margin: '16px 0' }}>
            <p>Tegn en polygon i kartet for å definere området.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="site-edit-form">
            <label>
              IGS-type
              <select value={igsType} onChange={(e) => { setIgsType(e.target.value as IgsType); setSubtype('') }}>
                {IGS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>

            <label>
              Subtype
              <select value={subtype} onChange={(e) => setSubtype(e.target.value)}>
                <option value="">Velg...</option>
                {SUBTYPE_OPTIONS[igsType].map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            <label>
              Navn (valgfritt)
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Navn på området..." />
            </label>

            <label>
              Notater (valgfritt)
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Beskrivelse..." />
            </label>

            <div className="form-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Avbryt
              </button>
              <button type="submit" className="btn" disabled={createSite.isPending}>
                {createSite.isPending ? 'Oppretter...' : 'Opprett område'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
