import { OVERVIEW_ELEMENT_DETAILS, STATUS_DETAILS, IGS_TYPE_DETAILS } from '../data/mapMetadata'
import { useParks } from '../hooks/useParks'
import { useReviewQueue } from '../hooks/useReviewQueue'
import { useSites } from '../hooks/useSites'
import { useSpecies } from '../hooks/useSpecies'
import { formatArea, formatNumber, getDashboardMetrics } from '../lib/dashboardMetrics'

type OverviewPageProps = {
  onOpenMap: () => void
  onOpenTechnicalLog: () => void
}

type StatCardProps = {
  label: string
  value: string
  note: string
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="kpi-card">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      <p className="kpi-note">{note}</p>
    </article>
  )
}

export default function OverviewPage({
  onOpenMap,
  onOpenTechnicalLog,
}: OverviewPageProps) {
  const {
    data: sites,
    isLoading: isSitesLoading,
    isError: isSitesError,
  } = useSites()
  const {
    data: species,
    isLoading: isSpeciesLoading,
    isError: isSpeciesError,
  } = useSpecies()
  const {
    data: parks,
    isLoading: isParksLoading,
    isError: isParksError,
  } = useParks()
  const {
    data: reviewQueueResponse,
    isLoading: isReviewQueueLoading,
    isError: isReviewQueueError,
  } = useReviewQueue()

  const metrics = getDashboardMetrics(sites, species, parks)
  const reviewQueueItems = reviewQueueResponse?.items ?? []
  const reviewQueueAvailable = !isReviewQueueError && !isReviewQueueLoading
  const isLoading = isSitesLoading || isSpeciesLoading || isParksLoading
  const siteDataUnavailable = isSitesError || (!sites && !isSitesLoading)
  const speciesDataUnavailable = isSpeciesError || (!species && !isSpeciesLoading)
  const parkDataUnavailable = isParksError || (!parks && !isParksLoading)
  const hasAnyError = siteDataUnavailable || speciesDataUnavailable || parkDataUnavailable
  const totalSites = metrics.totalSites || 1

  const formatMetric = (available: boolean, loading: boolean, value: string) => {
    if (loading) return '–'
    if (!available) return 'Utilgjengelig'
    return value
  }

  return (
    <div className="overview-page">
      <section className="page-hero">
        <div className="hero-copy">
          <span className="eyebrow">Oversikt</span>
          <h2>Dashboard for kartlegging av uformelle grøntområder i Gamle Oslo</h2>
          <p className="page-intro">
            Forsiden samler hva datasettet inneholder, hvordan kartet brukes og hvilke lag som
            inngår i vurderingsarbeidet. Tallene under hentes fra samme API-er som kartsiden.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onOpenMap}>
              Åpne kartet
            </button>
            <button className="btn btn-secondary" onClick={onOpenTechnicalLog}>
              Les teknisk logg
            </button>
          </div>
        </div>

        <aside className="hero-panel">
          <span className="panel-kicker">Hva dashboardet dekker</span>
          <ul className="hero-list">
            <li>4 IGS-typer med status, areal og kvalitetsindikatorer</li>
            <li>Artspunkter og formelle parker som støtte- og referanselag</li>
            <li>Kontekstlag for terreng, edgeland og infrastruktur med automatisk revisjonskø</li>
            <li>Operativ kartflate for validering, geometrieditering og eksport</li>
          </ul>
          <div className="hero-panel-footnote">
            {isLoading
              ? 'Laster datagrunnlag…'
              : hasAnyError
                ? 'Ett eller flere datasett er midlertidig utilgjengelige.'
                : `Samlet areal: ${formatArea(metrics.totalAreaM2)}`}
          </div>
        </aside>
      </section>

      {hasAnyError && (
        <div className="inline-notice">
          Noen API-kall svarte ikke som forventet. Oversikten viser derfor bare tall for datasettene
          som faktisk ble lastet.
        </div>
      )}

      <section className="kpi-grid">
        <StatCard
          label="IGS-områder"
          value={formatMetric(!siteDataUnavailable, isSitesLoading, formatNumber(metrics.totalSites))}
          note={
            siteDataUnavailable
              ? 'Områdedatasettet kunne ikke lastes akkurat nå.'
              : 'Totalt antall polygoner i kartdatabasen.'
          }
        />
        <StatCard
          label="Samlet areal"
          value={formatMetric(!siteDataUnavailable, isSitesLoading, formatArea(metrics.totalAreaM2))}
          note={
            siteDataUnavailable
              ? 'Arealberegning krever at områdedatasettet er tilgjengelig.'
              : 'Summerte arealverdier for områder der geometri er beregnet.'
          }
        />
        <StatCard
          label="Validerte områder"
          value={formatMetric(
            !siteDataUnavailable,
            isSitesLoading,
            formatNumber(metrics.statusCounts.validated)
          )}
          note={
            siteDataUnavailable
              ? 'Statusfordelingen er utilgjengelig uten områdedatasettet.'
              : 'Områder som er gjennomgått og bekreftet i arbeidsflyten.'
          }
        />
        <StatCard
          label="Gode muligheter"
          value={formatMetric(
            !siteDataUnavailable,
            isSitesLoading,
            formatNumber(metrics.goodOpportunityCount)
          )}
          note={
            siteDataUnavailable
              ? 'Indikatoren krever at områdedatasettet er tilgjengelig.'
              : 'Områder som scorer positivt på tilgang, støy, sikkerhet og størrelse.'
          }
        />
        <StatCard
          label="Artsobservasjoner"
          value={formatMetric(
            !speciesDataUnavailable,
            isSpeciesLoading,
            formatNumber(metrics.speciesObservationCount)
          )}
          note={
            speciesDataUnavailable
              ? 'Artsdatasettet kunne ikke lastes akkurat nå.'
              : `Basert på ${formatNumber(metrics.speciesFeatureCount)} artspunkter i kartet.`
          }
        />
        <StatCard
          label="Formelle parker"
          value={formatMetric(!parkDataUnavailable, isParksLoading, formatNumber(metrics.parkCount))}
          note={
            parkDataUnavailable
              ? 'Parklaget kunne ikke lastes akkurat nå.'
              : 'Parker brukes som sammenligningslag mot de uformelle grøntområdene.'
          }
        />
        <StatCard
          label="I revisjonskø"
          value={formatMetric(reviewQueueAvailable, isReviewQueueLoading, formatNumber(reviewQueueItems.length))}
          note={
            isReviewQueueError
              ? 'Revisjonskøen kunne ikke lastes akkurat nå.'
              : 'Steder med overlapp mot terreng- og infrastruktursignaler i QA-lagene.'
          }
        />
      </section>

      <section className="content-grid">
        <article className="content-card">
          <div className="section-heading">
            <span className="eyebrow">Datasammensetning</span>
            <h3>Fordeling av IGS-typer</h3>
          </div>
          {siteDataUnavailable ? (
            <div className="empty-state">
              Områdedatasettet er ikke tilgjengelig akkurat nå, så typefordelingen kan ikke vises.
            </div>
          ) : (
            <div className="distribution-list">
              {IGS_TYPE_DETAILS.map((typeDetail) => {
                const count = metrics.typeCounts[typeDetail.id]
                const share = metrics.totalSites ? (count / totalSites) * 100 : 0

                return (
                  <div key={typeDetail.id} className="distribution-row">
                    <div className="distribution-row-header">
                      <div className="distribution-row-label">
                        <span
                          className="legend-swatch"
                          style={{ backgroundColor: typeDetail.color }}
                        />
                        <span>{typeDetail.label}</span>
                      </div>
                      <strong>{isSitesLoading ? '–' : formatNumber(count)}</strong>
                    </div>
                    <div className="distribution-track">
                      <span
                        className="distribution-fill"
                        style={{
                          width: `${share}%`,
                          backgroundColor: typeDetail.color,
                        }}
                      />
                    </div>
                    <p>{typeDetail.description}</p>
                  </div>
                )
              })}
            </div>
          )}
        </article>

        <article className="content-card">
          <div className="section-heading">
            <span className="eyebrow">Arbeidsflyt</span>
            <h3>Status i kartarbeidet</h3>
          </div>
          {siteDataUnavailable ? (
            <div className="empty-state">
              Statusoversikten er utilgjengelig uten områdedatasettet.
            </div>
          ) : (
            <>
              <div className="status-grid">
                {STATUS_DETAILS.map((status) => (
                  <div key={status.key} className="status-card">
                    <div className="status-card-header">
                      <span
                        className="status-indicator"
                        style={{ backgroundColor: status.accent, color: status.accent }}
                      />
                      <strong>{status.label}</strong>
                    </div>
                    <div className="status-value">
                      {isSitesLoading ? '–' : formatNumber(metrics.statusCounts[status.key])}
                    </div>
                    <p>{status.description}</p>
                  </div>
                ))}
              </div>
              <div className="status-notes">
                <div>
                  <strong>{isSitesLoading ? '–' : formatNumber(metrics.hiddenGemCount)}</strong>
                  <span> områder er markert som skjulte perler</span>
                </div>
                <div>
                  <strong>
                    {formatMetric(
                      !speciesDataUnavailable,
                      isSpeciesLoading,
                      formatNumber(metrics.redListedSpeciesCount)
                    )}
                  </strong>
                  <span> artspunkter er markert som rødlistede i kartet, og </span>
                  <strong>
                    {formatMetric(
                      !speciesDataUnavailable,
                      isSpeciesLoading,
                      formatNumber(metrics.alienSpeciesCount)
                    )}
                  </strong>
                  <span> er fremmede arter</span>
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <span className="eyebrow">Kartets innhold</span>
          <h3>Elementene som inngår i arbeidsflaten</h3>
        </div>
        <div className="element-grid">
          {OVERVIEW_ELEMENT_DETAILS.map((element) => (
            <article key={element.id} className="element-card">
              <div className="element-card-header">
                {element.dot ? (
                  <span className="legend-dot" style={{ backgroundColor: element.color }} />
                ) : (
                  <span
                    className="legend-swatch"
                    style={{
                      backgroundColor: element.outline ? 'transparent' : element.color,
                      border: element.outline ? `2px dashed ${element.color}` : 'none',
                    }}
                  />
                )}
                <strong>{element.label}</strong>
              </div>
              <p>{element.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <span className="eyebrow">Bruk</span>
          <h3>Slik brukes dashboardet</h3>
        </div>
        <div className="step-grid">
          <article className="step-card">
            <span className="step-number">1</span>
            <strong>Start i oversikten</strong>
            <p>
              Bruk forsiden til å forstå omfang, statusfordeling og hvilke kartlag som inngår i
              vurderingen.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">2</span>
            <strong>Gå til kartarbeidsflaten</strong>
            <p>
              Søk opp områder, filtrer på status og åpne sidepanelet for validering, redigering og
              artsinnsikt.
            </p>
          </article>
          <article className="step-card">
            <span className="step-number">3</span>
            <strong>Dokumenter utviklingen</strong>
            <p>
              Bruk teknisk logg til å holde oversikt over deploy, pipeline-endringer og større
              justeringer i dashboardet.
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
