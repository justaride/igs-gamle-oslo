import { useStore } from '../hooks/useStore'
import { IGS_COLORS } from '../types'

const LAYER_CONFIG = [
  { key: 'Residual' as const, label: 'Residual IGS', color: IGS_COLORS.Residual },
  { key: 'Lot' as const, label: 'Lot IGS', color: IGS_COLORS.Lot },
  { key: 'Edgeland' as const, label: 'Edgelands', color: IGS_COLORS.Edgeland },
  { key: 'Opportunity' as const, label: 'Opportunity', color: IGS_COLORS.Opportunity },
  { key: 'parks' as const, label: 'Parker (formelle)', color: '#88cc88' },
  { key: 'species' as const, label: 'Arter', color: '#ff0000' },
]

export default function LayerControl() {
  const { layers, toggleLayer } = useStore()

  return (
    <div className="layer-control">
      <h4>Kartlag</h4>
      {LAYER_CONFIG.map(({ key, label, color }) => (
        <label key={key} className="layer-item">
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={() => toggleLayer(key)}
          />
          <span className="layer-swatch" style={{ backgroundColor: color }} />
          {label}
        </label>
      ))}
    </div>
  )
}
