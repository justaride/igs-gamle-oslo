import { useStore } from '../hooks/useStore'
import { useSites, useUpdateSiteStatus } from '../hooks/useSites'
import { STATUS_LABELS, IGS_COLORS } from '../types'
import type { SiteFeature } from '../types'
import SiteEditForm from './SiteEditForm'
import SpeciesPanel from './SpeciesPanel'

export default function SiteSidebar() {
  const { selectedSiteId, selectSite } = useStore()
  const { data: sites } = useSites()
  const updateStatus = useUpdateSiteStatus()

  if (!selectedSiteId || !sites) return null

  const feature = sites.features.find(
    (f) => f.properties.id === selectedSiteId
  ) as SiteFeature | undefined

  if (!feature) return null

  const p = feature.properties

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
        <button className="close-btn" onClick={() => selectSite(null)}>
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
      </div>

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
      </div>

      <SiteEditForm feature={feature} />
      <SpeciesPanel siteId={p.id} />
    </div>
  )
}
