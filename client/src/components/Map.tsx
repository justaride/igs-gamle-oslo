import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useStore } from '../hooks/useStore'
import { useParks } from '../hooks/useParks'
import { useSites } from '../hooks/useSites'
import { useSpecies } from '../hooks/useSpecies'
import { IGS_COLORS, RED_LIST_CATEGORIES } from '../types'
import type { SiteCollection, SiteFeature, SpeciesCollection, SpeciesFeature, IgsType } from '../types'
import type { GeoJSON as LeafletGeoJson, Layer } from 'leaflet'
import LayerControl from './LayerControl'
import Legend from './Legend'
import DrawTools from './DrawTools'

const GAMLE_OSLO_CENTER: [number, number] = [59.91, 10.78]
const EMPTY_SITE_COLLECTION: SiteCollection = {
  type: 'FeatureCollection',
  features: [],
}

function FlyToHandler() {
  const map = useMap()
  const { flyToSiteId, setFlyToSiteId } = useStore()
  const { data: sites } = useSites()

  useEffect(() => {
    if (!flyToSiteId || !sites) return

    const feature = sites.features.find((f) => f.properties.id === flyToSiteId)
    if (!feature) {
      setFlyToSiteId(null)
      return
    }

    const layer = L.geoJSON(feature.geometry)
    map.flyToBounds(layer.getBounds(), { padding: [50, 50], maxZoom: 17 })
    setFlyToSiteId(null)
  }, [flyToSiteId, map, setFlyToSiteId, sites])

  return null
}

function getSpeciesStyle(props: SpeciesFeature['properties']) {
  const isAlien = props.is_alien
  const isRedListed = props.red_list_category
    ? RED_LIST_CATEGORIES.includes(props.red_list_category)
    : false

  return {
    color: isAlien ? '#ff8800' : isRedListed ? '#ff0000' : '#666',
    fillColor: isAlien ? '#ff8800' : isRedListed ? '#ff0000' : '#999',
    fillOpacity: 0.8,
    weight: 1,
    radius: 5,
  }
}

function getSpeciesTooltip(props: SpeciesFeature['properties']) {
  const name = props.vernacular_name || props.scientific_name
  const redList = props.red_list_category ? ` (${props.red_list_category})` : ''
  const alien = props.is_alien ? ' — Fremmed art' : ''
  return `${name}${redList}${alien}`
}

function SpeciesLayer({ species }: { species: SpeciesCollection }) {
  const map = useMap()
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), [])

  useEffect(() => {
    const layer = L.geoJSON(species as GeoJSON.GeoJsonObject, {
      pointToLayer: (feature, latlng) => {
        const props = (feature as SpeciesFeature).properties
        return L.circleMarker(latlng, {
          ...getSpeciesStyle(props),
          renderer,
        }).bindTooltip(getSpeciesTooltip(props))
      },
    })

    layer.addTo(map)
    return () => {
      layer.removeFrom(map)
    }
  }, [map, renderer, species])

  return null
}

export default function Map() {
  const { layers, selectSite, selectedSiteId, editingGeometry, editMode, statusFilter } = useStore()
  const { data: sites } = useSites()
  const { data: species } = useSpecies(layers.species)
  const { data: parks } = useParks()
  const siteLayerRef = useRef<LeafletGeoJson | null>(null)
  const [showLayerControl, setShowLayerControl] = useState(false)
  const [showLegend, setShowLegend] = useState(false)
  const hiddenSiteId =
    editingGeometry && editMode === 'reshape' ? selectedSiteId : null

  const onEachSite = (feature: GeoJSON.Feature, layer: Layer) => {
    const props = (feature as SiteFeature).properties
    layer.on({
      click: () => {
        const state = useStore.getState()
        if (state.editingGeometry || state.creatingNewSite) return
        selectSite(props.id)
      },
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
      dashArray: props.subtype === 'Hydro-buried' ? '2,8' : props.status === 'candidate' ? '5,5' : undefined,
    }
  }

  useEffect(() => {
    const layer = siteLayerRef.current
    if (!layer) return

    layer.clearLayers()

    if (!sites) {
      return
    }

    const filteredSites = {
      ...sites,
      features: sites.features.filter((feature) => {
        if (!layers[feature.properties.igs_type as keyof typeof layers]) return false
        if (statusFilter !== 'all' && feature.properties.status !== statusFilter) return false
        if (hiddenSiteId && feature.properties.id === hiddenSiteId) return false
        return true
      }),
    }

    layer.addData(filteredSites as GeoJSON.GeoJsonObject)
    layer.setStyle(siteStyle)
  }, [
    hiddenSiteId,
    layers.Edgeland,
    layers.Lot,
    layers.Opportunity,
    layers.Residual,
    sites,
    statusFilter,
  ])

  useEffect(() => {
    const layer = siteLayerRef.current
    if (!layer) return

    layer.setStyle(siteStyle)
  }, [selectedSiteId])

  return (
    <MapContainer
      center={GAMLE_OSLO_CENTER}
      zoom={14}
      preferCanvas
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

      <GeoJSON
        ref={siteLayerRef}
        key="sites"
        data={EMPTY_SITE_COLLECTION}
        style={siteStyle}
        onEachFeature={onEachSite}
      />

      {layers.species && species && <SpeciesLayer species={species} />}

      <DrawTools />
      <FlyToHandler />
      <div className="map-control-toggle" aria-label="Kartkontroller">
        <button
          type="button"
          aria-pressed={showLayerControl}
          onClick={() => {
            setShowLayerControl((open) => !open)
            setShowLegend(false)
          }}
        >
          Kartlag
        </button>
        <button
          type="button"
          aria-pressed={showLegend}
          onClick={() => {
            setShowLegend((open) => !open)
            setShowLayerControl(false)
          }}
        >
          Forklaring
        </button>
      </div>
      <LayerControl className={showLayerControl ? 'map-panel-open' : ''} />
      <Legend className={showLegend ? 'map-panel-open' : ''} />
    </MapContainer>
  )
}
