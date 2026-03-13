import { MAP_LAYER_DETAILS } from '../data/mapMetadata'
import { useStore } from '../hooks/useStore'

export default function LayerControl() {
  const { layers, toggleLayer } = useStore()

  return (
    <div className="layer-control">
      <h4>Kartlag</h4>
      {MAP_LAYER_DETAILS.map(({ layerKey, label, color }) => (
        <label key={layerKey} className="layer-item">
          <input
            type="checkbox"
            checked={layers[layerKey]}
            onChange={() => toggleLayer(layerKey)}
          />
          <span className="layer-swatch" style={{ backgroundColor: color }} />
          {label}
        </label>
      ))}
    </div>
  )
}
