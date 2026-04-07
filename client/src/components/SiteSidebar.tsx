import { useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { useResetSiteOverrides, useSites, useUpdateSiteStatus } from '../hooks/useSites'
import { STATUS_LABELS, IGS_COLORS } from '../types'
import type { SiteFeature } from '../types'
import SiteEditForm from './SiteEditForm'
import SpeciesPanel from './SpeciesPanel'

function formatReviewedAt(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function SiteSidebar() {
  const { selectedSiteId, selectSite } = useStore()
  const { data: sites } = useSites()
  const updateStatus = useUpdateSiteStatus()
  const resetOverrides = useResetSiteOverrides()
  const feature = selectedSiteId && sites
    ? sites.features.find((f) => f.properties.id === selectedSiteId) as SiteFeature | undefined
    : undefined

  useEffect(() => {
    if (selectedSiteId && sites && !feature) {
      selectSite(null)
    }
  }, [feature, selectSite, selectedSiteId, sites])

  if (!selectedSiteId || !sites || !feature) return null

  const p = feature.properties
  const hasManualValue = (value: unknown) => value !== null && value !== undefined && value !== ''
  const hasManualFieldOverrides = Boolean(
    p.manual_override ||
    hasManualValue(p.manual_igs_type) ||
    hasManualValue(p.manual_subtype) ||
    hasManualValue(p.manual_status) ||
    hasManualValue(p.manual_name) ||
    hasManualValue(p.manual_ownership) ||
    hasManualValue(p.manual_access_control) ||
    hasManualValue(p.manual_access_description) ||
    hasManualValue(p.manual_natural_barrier) ||
    hasManualValue(p.manual_maintenance) ||
    hasManualValue(p.manual_maintenance_frequency) ||
    hasManualValue(p.manual_prox_housing) ||
    hasManualValue(p.manual_hidden_gem) ||
    hasManualValue(p.manual_dangerous) ||
    hasManualValue(p.manual_noisy) ||
    hasManualValue(p.manual_too_small) ||
    hasManualValue(p.manual_notes) ||
    hasManualValue(p.manual_buried_river) ||
    hasManualValue(p.manual_community_activity_potential) ||
    hasManualValue(p.manual_biodiversity_potential)
  )
  const hasReviewMetadata = Boolean(
    hasManualValue(p.editor_notes) ||
    hasManualValue(p.reviewed_by) ||
    hasManualValue(p.reviewed_at)
  )
  const hasEditorialChanges = hasManualFieldOverrides || hasReviewMetadata
  const reviewedAtLabel = formatReviewedAt(p.reviewed_at)

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <span
            className="type-badge"
            style={{ backgroundColor: IGS_COLORS[p.igs_type] }}
          >
            {p.igs_type}
          </span>
          <h3>{p.site_number}</h3>
          {p.name && <span className="site-name">{p.name}</span>}
        </div>
        <button className="close-btn" aria-label="Lukk sidepanel" onClick={() => selectSite(null)}>
          &times;
        </button>
      </div>

      <div className="sidebar-meta">
        <div>
          Status: <strong>{STATUS_LABELS[p.status]}</strong>
        </div>
        {p.subtype && <div>Subtype: {p.subtype}</div>}
        {p.area_m2 && <div>Areal: {Math.round(p.area_m2).toLocaleString()} m²</div>}
        {p.good_opportunity && (
          <div className="good-opp">God mulighet</div>
        )}
        {reviewedAtLabel && <div>Sist vurdert: {reviewedAtLabel}</div>}
      </div>

      {hasManualFieldOverrides && (
        <div className="sidebar-note sidebar-note-accent">
          Viser manuelle overstyringer. Nullstill-knappen fjerner bare redaksjonelle endringer.
        </div>
      )}

      {!hasManualFieldOverrides && hasReviewMetadata && (
        <div className="sidebar-note">
          Dette stedet har vurderingsdata eller redaksjonelle notater, men ingen manuelle feltendringer.
        </div>
      )}

      {p.source_present === false && (
        <div className="sidebar-note sidebar-note-warning">
          Dette stedet finnes ikke i siste kildeimport, men er beholdt fordi det er manuelt endret
          eller tidligere vurdert.
        </div>
      )}

      <div className="status-actions">
        {p.status !== 'validated' && (
          <button
            className="btn btn-validate"
            onClick={() => updateStatus.mutate({ id: p.id, status: 'validated' })}
          >
            Valider
          </button>
        )}
        {p.status !== 'rejected' && (
          <button
            className="btn btn-reject"
            onClick={() => updateStatus.mutate({ id: p.id, status: 'rejected' })}
          >
            Avvis
          </button>
        )}
        {p.status !== 'candidate' && (
          <button
            className="btn btn-reset"
            onClick={() => updateStatus.mutate({ id: p.id, status: 'candidate' })}
          >
            Tilbake til kandidat
          </button>
        )}
        {hasEditorialChanges && (
          <button
            className="btn btn-secondary"
            onClick={() => resetOverrides.mutate({ id: p.id })}
            disabled={resetOverrides.isPending}
          >
            {resetOverrides.isPending
              ? 'Nullstiller...'
              : hasManualFieldOverrides
                ? 'Nullstill manuelle endringer'
                : 'Nullstill vurderingsdata'}
          </button>
        )}
      </div>

      <SiteEditForm feature={feature} />
      <SpeciesPanel siteId={p.id} />
    </div>
  )
}
