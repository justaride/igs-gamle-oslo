import {
  DATAFLOW_STEPS,
  TECHNICAL_LOG_ENTRIES,
  TECHNICAL_STACK,
} from '../data/technicalLog'

type TechnicalLogPageProps = {
  onOpenMap: () => void
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('nb-NO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export default function TechnicalLogPage({ onOpenMap }: TechnicalLogPageProps) {
  return (
    <div className="technical-log-page">
      <section className="page-hero page-hero-compact">
        <div className="hero-copy">
          <span className="eyebrow">Teknisk logg</span>
          <h2>Prosjektets tekniske spor og milepæler</h2>
          <p className="page-intro">
            Denne siden fungerer som en redaksjonell logg for stack, dataflyt og viktige
            gjennomførte endringer. Den er ment som et raskt oppslagsverk for alle som jobber med
            kartet videre.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onOpenMap}>
              Til kartarbeidsflaten
            </button>
          </div>
        </div>

        <aside className="hero-panel">
          <span className="panel-kicker">Siste registrerte endring</span>
          <strong className="hero-panel-title">{TECHNICAL_LOG_ENTRIES[0].title}</strong>
          <p>{TECHNICAL_LOG_ENTRIES[0].summary}</p>
          <div className="hero-panel-footnote">{formatDate(TECHNICAL_LOG_ENTRIES[0].date)}</div>
        </aside>
      </section>

      <section className="stack-grid">
        {TECHNICAL_STACK.map((item) => (
          <article key={item.title} className="content-card stack-card">
            <span className="eyebrow">{item.title}</span>
            <h3>{item.value}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="content-card">
        <div className="section-heading">
          <span className="eyebrow">Dataflyt</span>
          <h3>Hvordan data går fra råkilder til dashboard</h3>
        </div>
        <div className="dataflow-list">
          {DATAFLOW_STEPS.map((step, index) => (
            <article key={step} className="dataflow-step">
              <span className="step-number">{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-card">
        <div className="section-heading">
          <span className="eyebrow">Logg</span>
          <h3>Viktige tekniske milepæler</h3>
        </div>
        <div className="tech-log-timeline">
          {TECHNICAL_LOG_ENTRIES.map((entry) => (
            <article key={entry.id} className="tech-log-entry">
              <div className="tech-log-meta">
                <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                <span className={`log-category log-category-${entry.category.toLowerCase()}`}>
                  {entry.category}
                </span>
              </div>
              <div className="tech-log-body">
                <h4>{entry.title}</h4>
                <p>{entry.summary}</p>
                <ul className="detail-list">
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
                {entry.reference && <code className="commit-ref">Commit {entry.reference}</code>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
