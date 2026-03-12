import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip } from 'react-leaflet'
import { useStore } from '../hooks/useStore'
import { useSites } from '../hooks/useSites'
import { useSpecies } from '../hooks/useSpecies'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { IGS_COLORS } from '../types'
import type { SiteFeature, ParkCollection, IgsType } from '../types'
import type { Layer, LeafletMouseEvent } from 'leaflet'
import LayerControl from './LayerControl'
import Legend from './Legend'

const GAMLE_OSLO_CENTER: [number, number] = [59.91, 10.78]

export default function Map() {
  const { layers, selectSite, selectedSiteId } = useStore()
  const { data: sites } = useSites()
  const { data: species } = useSpecies()
  const { data: parks } = useQuery<ParkCollection>({
    queryKey: ['parks'],
    queryFn: () => api.getParks() as Promise<ParkCollection>,
  })

  const onEachSite = (feature: GeoJSON.Feature, layer: Layer) => {
    const props = (feature as SiteFeature).properties
    layer.on({
      click: () => selectSite(props.id),
    })
    if ('bindTooltip' in layer) {
      (layer as L.Path).bindTooltip(
        `${props.site_number} — ${props.igs_type}${props.subtype ? ` (${props.subtype})` : ''}`,
        { sticky: true }
      )
    }
  }

  const siteStyle = (feature?: GeoJSON.Feature) => {
    if (!feature) return {}
    const props = (feature as SiteFeature).properties
    const isSelected = props.id === selectedSiteId
    return {
      color: isSelected ? '#ffffff' : IGS_COLORS[props.igs_type as IgsType] || '#888',
      fillColor: IGS_COLORS[props.igs_type as IgsType] || '#888',
      fillOpacity: props.status === 'rejected' ? 0.15 : 0.45,
      weight: isSelected ? 3 : 1.5,
      dashArray: props.status === 'candidate' ? '5,5' : undefined,
    }
  }

  const filteredSites = sites
    ? {
        ...sites,
        features: sites.features.filter(
          (f) => layers[f.properties.igs_type as keyof typeof layers]
        ),
      }
    : null

  return (
    <MapContainer
      center={GAMLE_OSLO_CENTER}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {layers.parks && parks && (
        <GeoJSON
          key="parks"
          data={parks}
          style={{
            color: '#88cc88',
            fillColor: '#88cc88',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '3,6',
          }}
          onEachFeature={(feature, layer) => {
            if ('bindTooltip' in layer && feature.properties?.name) {
              (layer as L.Path).bindTooltip(feature.properties.name, { sticky: true })
            }
          }}
        />
      )}

      {filteredSites && (
        <GeoJSON
          key={JSON.stringify(filteredSites.features.map((f) => f.properties.id)) + selectedSiteId}
          data={filteredSites}
          style={siteStyle}
          onEachFeature={onEachSite}
        />
      )}

      {layers.species &&
        species?.features.map((f) => {
          const isAlien = f.properties.is_alien
          const isRedListed = f.properties.red_list_category &&
            ['CR', 'EN', 'VU', 'NT'].includes(f.properties.red_list_category)
          return (
            <CircleMarker
              key={f.properties.id}
              center={[
                f.geometry.coordinates[1],
                f.geometry.coordinates[0],
              ]}
              radius={5}
              pathOptions={{
                color: isAlien ? '#ff8800' : isRedListed ? '#ff0000' : '#666',
                fillColor: isAlien ? '#ff8800' : isRedListed ? '#ff0000' : '#999',
                fillOpacity: 0.8,
                weight: 1,
              }}
            >
              <Tooltip>
                {f.properties.vernacular_name || f.properties.scientific_name}
                {f.properties.red_list_category && ` (${f.properties.red_list_category})`}
                {isAlien && ' — Fremmed art'}
              </Tooltip>
            </CircleMarker>
          )
        })}

      <LayerControl />
      <Legend />
    </MapContainer>
  )
}
