import { useSpeciesBySite } from '../hooks/useSpecies'

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

export default function SpeciesPanel({ siteId }: { siteId: number }) {
  const { data: species, isLoading } = useSpeciesBySite(siteId)

  if (isLoading) return <div className="species-panel">Laster arter...</div>

  const rows = (species as SpeciesRow[] | undefined) || []
  if (rows.length === 0) return <div className="species-panel"><em>Ingen arter registrert</em></div>

  const redListed = rows.filter((s) => s.red_list_category && ['CR', 'EN', 'VU', 'NT'].includes(s.red_list_category))
  const aliens = rows.filter((s) => s.is_alien)
  const other = rows.filter((s) => !s.is_alien && (!s.red_list_category || !['CR', 'EN', 'VU', 'NT'].includes(s.red_list_category)))

  return (
    <div className="species-panel">
      <h4>Arter ({rows.length})</h4>

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
    </div>
  )
}
