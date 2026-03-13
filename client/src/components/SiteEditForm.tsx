import { useState, useEffect } from 'react'
import { useUpdateSite } from '../hooks/useSites'
import type { SiteFeature, IgsType } from '../types'

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

type Props = { feature: SiteFeature }

export default function SiteEditForm({ feature }: Props) {
  const p = feature.properties
  const update = useUpdateSite()
  const [form, setForm] = useState({
    igs_type: p.igs_type as IgsType,
    subtype: p.subtype || '',
    name: p.name || '',
    ownership: p.ownership,
    access_control: p.access_control,
    access_description: p.access_description || '',
    natural_barrier: p.natural_barrier || '',
    maintenance: p.maintenance || '',
    maintenance_frequency: p.maintenance_frequency || '',
    prox_housing: p.prox_housing ?? false,
    hidden_gem: p.hidden_gem ?? false,
    dangerous: p.dangerous ?? false,
    noisy: p.noisy ?? false,
    too_small: p.too_small ?? false,
    notes: p.notes || '',
  })

  useEffect(() => {
    setForm({
      igs_type: p.igs_type as IgsType,
      subtype: p.subtype || '',
      name: p.name || '',
      ownership: p.ownership,
      access_control: p.access_control,
      access_description: p.access_description || '',
      natural_barrier: p.natural_barrier || '',
      maintenance: p.maintenance || '',
      maintenance_frequency: p.maintenance_frequency || '',
      prox_housing: p.prox_housing ?? false,
      hidden_gem: p.hidden_gem ?? false,
      dangerous: p.dangerous ?? false,
      noisy: p.noisy ?? false,
      too_small: p.too_small ?? false,
      notes: p.notes || '',
    })
  }, [p.id])

  const handleSave = () => {
    update.mutate({ id: p.id, fields: form })
  }

  return (
    <div className="edit-form">
      <h4>Vurdering</h4>

      <label>
        IGS-type
        <select
          value={form.igs_type}
          onChange={(e) => {
            const newType = e.target.value as IgsType
            const opts = SUBTYPE_OPTIONS[newType]
            setForm({ ...form, igs_type: newType, subtype: opts[0]?.value || '' })
          }}
        >
          <option value="Residual">Residual</option>
          <option value="Lot">Lot</option>
          <option value="Edgeland">Edgeland</option>
          <option value="Opportunity">Opportunity</option>
        </select>
      </label>

      <label>
        Subtype
        <select
          value={form.subtype}
          onChange={(e) => setForm({ ...form, subtype: e.target.value })}
        >
          <option value="">—</option>
          {SUBTYPE_OPTIONS[form.igs_type]?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </label>

      <label>
        Navn
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </label>

      <label>
        Eierskap
        <select
          value={form.ownership}
          onChange={(e) => setForm({ ...form, ownership: e.target.value as 'PUB' | 'PRI' | 'UNK' })}
        >
          <option value="PUB">Offentlig (PUB)</option>
          <option value="PRI">Privat (PRI)</option>
          <option value="UNK">Ukjent (UNK)</option>
        </select>
      </label>

      <label>
        Tilgangskontroll
        <select
          value={form.access_control}
          onChange={(e) => setForm({ ...form, access_control: e.target.value as 'O' | 'P' | 'C' })}
        >
          <option value="O">Åpen (O)</option>
          <option value="P">Delvis (P)</option>
          <option value="C">Lukket (C)</option>
        </select>
      </label>

      <label>
        Tilgangsbeskrivelse
        <input
          value={form.access_description}
          onChange={(e) => setForm({ ...form, access_description: e.target.value })}
          placeholder="f.eks. lavt gjerde, port stengt om natten"
        />
      </label>

      <label>
        Naturlig barriere
        <input
          value={form.natural_barrier}
          onChange={(e) => setForm({ ...form, natural_barrier: e.target.value })}
          placeholder="f.eks. bratt skråning, tett vegetasjon"
        />
      </label>

      <label>
        Vedlikehold
        <select
          value={form.maintenance}
          onChange={(e) => setForm({ ...form, maintenance: e.target.value })}
        >
          <option value="">—</option>
          <option value="FM">Formelt (FM)</option>
          <option value="IM">Uformelt (IM)</option>
          <option value="NM">Ingen (NM)</option>
        </select>
      </label>

      <label>
        Vedlikeholdsfrekvens
        <select
          value={form.maintenance_frequency}
          onChange={(e) => setForm({ ...form, maintenance_frequency: e.target.value })}
        >
          <option value="">—</option>
          <option value="W">Ukentlig (W)</option>
          <option value="M">Månedlig (M)</option>
          <option value="S">Sesongbasert (S)</option>
          <option value="U">Ukjent (U)</option>
          <option value="VL">Svært lite (VL)</option>
        </select>
      </label>

      <fieldset>
        <legend>Muligheter</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.prox_housing}
            onChange={(e) => setForm({ ...form, prox_housing: e.target.checked })}
          />
          Nærhet til boliger (PROX)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.hidden_gem}
            onChange={(e) => setForm({ ...form, hidden_gem: e.target.checked })}
          />
          Skjult perle (GEM)
        </label>
      </fieldset>

      <fieldset>
        <legend>Utfordringer</legend>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.dangerous}
            onChange={(e) => setForm({ ...form, dangerous: e.target.checked })}
          />
          Farlig infrastruktur (DANG)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.noisy}
            onChange={(e) => setForm({ ...form, noisy: e.target.checked })}
          />
          Støy &gt;65 dB (NOIS)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.too_small}
            onChange={(e) => setForm({ ...form, too_small: e.target.checked })}
          />
          For lite (SML)
        </label>
      </fieldset>

      <label>
        Notater
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />
      </label>

      <button className="btn btn-save" onClick={handleSave} disabled={update.isPending}>
        {update.isPending ? 'Lagrer...' : 'Lagre endringer'}
      </button>
    </div>
  )
}
