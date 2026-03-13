import { LEGEND_ITEMS } from '../data/mapMetadata'

export default function Legend() {
  return (
    <div className="legend">
      <h4>Forklaring</h4>
      {LEGEND_ITEMS.map(({ id, label, color, outline, dot }) => (
        <div key={label} className="legend-item">
          {dot ? (
            <span className="legend-dot" style={{ backgroundColor: color }} />
          ) : (
            <span
              className="legend-swatch"
              style={{
                backgroundColor: outline ? 'transparent' : color,
                border: outline ? `2px dashed ${color}` : 'none',
                opacity: 0.7,
              }}
            />
          )}
          <span>{label}</span>
        </div>
      ))}
      <div className="legend-item">
        <span className="legend-swatch" style={{ border: '2px dashed #666', backgroundColor: 'transparent' }} />
        <span>Kandidat (uvalidert)</span>
      </div>
    </div>
  )
}
