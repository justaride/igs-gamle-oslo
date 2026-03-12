import { IGS_COLORS } from '../types'

const ITEMS = [
  { label: 'Residual IGS', color: IGS_COLORS.Residual },
  { label: 'Lot IGS', color: IGS_COLORS.Lot },
  { label: 'Edgelands', color: IGS_COLORS.Edgeland },
  { label: 'Opportunity', color: IGS_COLORS.Opportunity },
  { label: 'Parker (formelle)', color: '#88cc88', outline: true },
  { label: 'Rødlistede arter', color: '#ff0000', dot: true },
  { label: 'Fremmede arter', color: '#ff8800', dot: true },
]

export default function Legend() {
  return (
    <div className="legend">
      <h4>Forklaring</h4>
      {ITEMS.map(({ label, color, outline, dot }) => (
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
