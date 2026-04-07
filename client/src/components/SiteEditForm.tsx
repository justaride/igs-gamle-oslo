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
type FormState = ReturnType<typeof buildFormState>

function hasSameFormState(left: FormState, right: FormState) {
  return (
    left.igs_type === right.igs_type &&
    left.subtype === right.subtype &&
    left.name === right.name &&
    left.ownership === right.ownership &&
    left.access_control === right.access_control &&
    left.access_description === right.access_description &&
    left.natural_barrier === right.natural_barrier &&
    left.maintenance === right.maintenance &&
    left.maintenance_frequency === right.maintenance_frequency &&
    left.prox_housing === right.prox_housing &&
    left.hidden_gem === right.hidden_gem &&
    left.dangerous === right.dangerous &&
    left.noisy === right.noisy &&
    left.too_small === right.too_small &&
    left.notes === right.notes
  )
}

function buildFormState(properties: SiteFeature['properties']) {
  return {
    igs_type: properties.igs_type as IgsType,
    subtype: properties.subtype || '',
    name: properties.name || '',
    ownership: properties.ownership,
    access_control: properties.access_control,
    access_description: properties.access_description || '',
    natural_barrier: properties.natural_barrier || '',
    maintenance: properties.maintenance || '',
    maintenance_frequency: properties.maintenance_frequency || '',
    prox_housing: properties.prox_housing ?? false,
    hidden_gem: properties.hidden_gem ?? false,
    dangerous: properties.dangerous ?? false,
    noisy: properties.noisy ?? false,
    too_small: properties.too_small ?? false,
    notes: properties.notes || '',
  }
}

export default function SiteEditForm({ feature }: Props) {
  const p = feature.properties
  const update = useUpdateSite()
  const initialForm = buildFormState(p)
  const [form, setForm] = useState(() => buildFormState(p))

  useEffect(() => {
    setForm(buildFormState(p))
  }, [p])

  const isDirty = !hasSameFormState(form, initialForm)

  const handleSave = () => {
    if (!isDirty || update.isPending) {
      return
    }

    update.mutate({ id: p.id, fields: form })
  }

  const handleResetDraft = () => {
    setForm(initialForm)
  }

  return (
    <div className="edit-form">
      <h4>Vurdering</h4>
      <p className="edit-form-status">
        {isDirty ? 'Du har ulagrede endringer.' : 'Skjemaet er synkronisert med gjeldende steddata.'}
      </p>

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
          {form.subtype && !SUBTYPE_OPTIONS[form.igs_type]?.some((o) => o.value === form.subtype) && (
            <option value={form.subtype}>{form.subtype} (ukjent)</option>
          )}
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

      <div className="edit-form-actions">
        <button
          className="btn btn-secondary"
          onClick={handleResetDraft}
          disabled={!isDirty || update.isPending}
        >
          Nullstill utkast
        </button>
        <button className="btn btn-save" onClick={handleSave} disabled={!isDirty || update.isPending}>
          {update.isPending ? 'Lagrer...' : 'Lagre endringer'}
        </button>
      </div>
    </div>
  )
}
