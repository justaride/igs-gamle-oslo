import { useEffect, useState } from 'react'
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { getContextLayerStyle } from '../data/contextLayerMetadata'
import { useContextLayers } from '../hooks/useContextLayers'
import { useParks } from '../hooks/useParks'
import { useReviewQueue } from '../hooks/useReviewQueue'
import { useSites } from '../hooks/useSites'
import { useSpecies } from '../hooks/useSpecies'
import { useStore } from '../hooks/useStore'
import { formatArea, formatNumber } from '../lib/dashboardMetrics'
import {
  type ContextLayer,
  IGS_COLORS,
  RED_LIST_CATEGORIES,
  type ReviewQueueItem,
  STATUS_LABELS,
  type SiteFeature,
  type SiteStatus,
} from '../types'

type MapLabPageProps = {
  onOpenMap: () => void
}

type BasemapKey = 'osm' | 'topo' | 'topograatone' | 'positron' | 'dark_matter' | 'voyager' | 'satellite'
type ColorMode = 'type' | 'status' | 'opportunity' | 'pressure' | 'biodiversity'
type FocusFilter = 'all' | 'opportunities' | 'hidden_gems' | 'pressure'
type PresetId = 'comparison' | 'correction' | 'ecology' | 'triage'

type SiteSpeciesStats = {
  featureCount: number
  observationCount: number
  redListedCount: number
  alienCount: number
}

type BasemapDefinition = {
  key: BasemapKey
  label: string
  description: string
  url: string
  attribution: string
  maxZoom?: number
}

type ColorModeDefinition = {
  key: ColorMode
  label: string
  description: string
  legend: Array<{ label: string; color: string }>
}

type PresetDefinition = {
  key: PresetId
  label: string
  description: string
}

const GAMLE_OSLO_CENTER: [number, number] = [59.91, 10.78]

const BASEMAPS: BasemapDefinition[] = [
  {
    key: 'osm',
    label: 'OSM',
    description: 'Nåværende referanse. Bra for gatenavn og enkel orientering.',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  {
    key: 'topo',
    label: 'Topo',
    description: 'Kartverkets topografiske kart gir tydeligere terreng og offentlig kartkontekst.',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png',
    attribution: '&copy; <a href="https://www.kartverket.no/">Kartverket</a>',
  },
  {
    key: 'topograatone',
    label: 'Gråtone',
    description: 'Demper bakgrunnen og gjør det enklere å lese polygoner, status og signaler.',
    url: 'https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png',
    attribution: '&copy; <a href="https://www.kartverket.no/">Kartverket</a>',
  },
  {
    key: 'positron',
    label: 'Positron',
    description: 'Lys, minimalistisk bakgrunn — perfekt for fargerik polygon-analyse.',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    key: 'dark_matter',
    label: 'Dark Matter',
    description: 'Mørkt tema — polygoner og signaler popper mot svart bakgrunn.',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    key: 'voyager',
    label: 'Voyager',
    description: 'Fargerikt med terrengdetaljer, god for grøntområder og økologi.',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  },
  {
    key: 'satellite',
    label: 'Satellitt',
    description: 'Ortofoto for visuell verifisering av geometri og arealbruk.',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
]

const COLOR_MODES: ColorModeDefinition[] = [
  {
    key: 'type',
    label: 'IGS-type',
    description: 'Viser klassifiseringen som et tydelig typologisk kart.',
    legend: [
      { label: 'Residual', color: IGS_COLORS.Residual },
      { label: 'Lot', color: IGS_COLORS.Lot },
      { label: 'Edgeland', color: IGS_COLORS.Edgeland },
      { label: 'Opportunity', color: IGS_COLORS.Opportunity },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    description: 'Skiller kandidater, validerte og avviste flater tydeligere.',
    legend: [
      { label: 'Kandidat', color: '#f2c94c' },
      { label: 'Validert', color: '#34d058' },
      { label: 'Avvist', color: '#ea4a5a' },
    ],
  },
  {
    key: 'opportunity',
    label: 'Muligheter',
    description: 'Løfter fram steder med potensial, skjulte perler og mer lukkede rom.',
    legend: [
      { label: 'God mulighet', color: '#38d39f' },
      { label: 'Skjult perle', color: '#ffd166' },
      { label: 'Lukket/privat', color: '#8f7ae5' },
      { label: 'Nøytral', color: '#7ba7ff' },
    ],
  },
  {
    key: 'pressure',
    label: 'Press',
    description: 'Viser hvor dataene peker mot støy, fare eller for små arealer.',
    legend: [
      { label: 'Farlig', color: '#ff5f6d' },
      { label: 'Støy', color: '#ff9f43' },
      { label: 'For lite', color: '#ffd166' },
      { label: 'Lavt press', color: '#60d394' },
    ],
  },
  {
    key: 'biodiversity',
    label: 'Artssignal',
    description: 'Bruker artsdata som leselag for økologisk signal i stedet for bare punkter.',
    legend: [
      { label: 'Rødlistet signal', color: '#ff4d6d' },
      { label: 'Fremmed art', color: '#ff8c42' },
      { label: 'Artsfunn', color: '#45c7f4' },
      { label: 'Ingen data', color: '#73807a' },
    ],
  },
]

const PRESETS: PresetDefinition[] = [
  {
    key: 'comparison',
    label: 'Sammenligning',
    description: 'Starter bredt med typekart, parker og artspunkter.',
  },
  {
    key: 'correction',
    label: 'Korrigering',
    description: 'Demper bakgrunnen og fremhever grenser, sentre og press-signaler.',
  },
  {
    key: 'ecology',
    label: 'Økologi',
    description: 'Setter artssignal og parkreferanser i sentrum.',
  },
  {
    key: 'triage',
    label: 'Triage',
    description: 'Viser bare press- og mulighetssteder for rask gjennomgang.',
  },
]

const EMPTY_SPECIES_STATS: SiteSpeciesStats = {
  featureCount: 0,
  observationCount: 0,
  redListedCount: 0,
  alienCount: 0,
}

const MAP_LAB_STORAGE_KEY = 'igs-map-lab-state-v1'

type MapLabPersistedState = {
  basemap: BasemapKey
  colorMode: ColorMode
  focusFilter: FocusFilter
  showParks: boolean
  showSpecies: boolean
  showCentroids: boolean
  showLabels: boolean
  showSignals: boolean
  fillOpacity: number
  statusVisibility: Record<SiteStatus, boolean>
  contextVisibility: Record<string, boolean>
}

function loadPersistedMapLabState(): MapLabPersistedState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(MAP_LAB_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    return parsed as MapLabPersistedState
  } catch {
    return null
  }
}

function savePersistedMapLabState(state: MapLabPersistedState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MAP_LAB_STORAGE_KEY, JSON.stringify(state))
}

function clearPersistedMapLabState() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(MAP_LAB_STORAGE_KEY)
}

function getDefaultContextVisibility(layers: ContextLayer[]) {
  return Object.fromEntries(
    layers.map((layer) => [layer.key, getContextLayerStyle(layer.key).defaultVisible])
  )
}

function getContextLayerTooltip(layer: ContextLayer, feature: GeoJSON.Feature) {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const parts = [layer.label]

  for (const key of [
    'name',
    'source_type',
    'candidate_type',
    'edge_type',
    'building',
    'highway',
    'railway',
    'waterway',
    'landuse',
    'natural',
  ]) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) {
      parts.push(value)
      break
    }
  }

  return parts.join(' • ')
}

function formatOverlapShare(value: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value)
}

function FitToSites({
  featuresCount,
  geojson,
  fitKey,
}: {
  featuresCount: number
  geojson: GeoJSON.FeatureCollection | null
  fitKey: string
}) {
  const map = useMap()

  useEffect(() => {
    if (!geojson || featuresCount === 0) return

    const bounds = L.geoJSON(geojson).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 })
    }
  }, [featuresCount, fitKey, map])

  return null
}

function FocusSelectedSite({ feature }: { feature: SiteFeature | null }) {
  const map = useMap()

  useEffect(() => {
    if (!feature) return

    const bounds = L.geoJSON(feature).getBounds()
    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 17 })
    }
  }, [feature, map])

  return null
}

function getFeatureCenter(feature: SiteFeature) {
  return L.geoJSON(feature).getBounds().getCenter()
}

function getCentroidRadius(areaM2: number | null) {
  if (!areaM2 || areaM2 < 250) return 4
  if (areaM2 < 1_000) return 6
  if (areaM2 < 3_000) return 8
  if (areaM2 < 8_000) return 10
  return 12
}

function getStatusColor(status: SiteStatus) {
  if (status === 'validated') return '#34d058'
  if (status === 'rejected') return '#ea4a5a'
  return '#f2c94c'
}

function getColorForSite(feature: SiteFeature, mode: ColorMode, speciesStats: SiteSpeciesStats) {
  const props = feature.properties

  if (mode === 'type') {
    return {
      color: IGS_COLORS[props.igs_type],
      fillColor: IGS_COLORS[props.igs_type],
    }
  }

  if (mode === 'status') {
    const color = getStatusColor(props.status)
    return { color, fillColor: color }
  }

  if (mode === 'opportunity') {
    if (props.good_opportunity) {
      return { color: '#38d39f', fillColor: '#38d39f' }
    }

    if (props.hidden_gem) {
      return { color: '#ffd166', fillColor: '#ffd166' }
    }

    if (props.access_control === 'C' || props.ownership === 'PRI') {
      return { color: '#8f7ae5', fillColor: '#8f7ae5' }
    }

    return { color: '#7ba7ff', fillColor: '#7ba7ff' }
  }

  if (mode === 'pressure') {
    if (props.dangerous) return { color: '#ff5f6d', fillColor: '#ff5f6d' }
    if (props.noisy) return { color: '#ff9f43', fillColor: '#ff9f43' }
    if (props.too_small) return { color: '#ffd166', fillColor: '#ffd166' }
    return { color: '#60d394', fillColor: '#60d394' }
  }

  if (speciesStats.redListedCount > 0) {
    return { color: '#ff4d6d', fillColor: '#ff4d6d' }
  }

  if (speciesStats.alienCount > 0) {
    return { color: '#ff8c42', fillColor: '#ff8c42' }
  }

  if (speciesStats.featureCount > 0) {
    return { color: '#45c7f4', fillColor: '#45c7f4' }
  }

  return { color: '#73807a', fillColor: '#73807a' }
}

function LabStat({
  label,
  value,
  note,
}: {
  label: string
  value: string
  note: string
}) {
  return (
    <article className="lab-stat">
      <span className="lab-stat-label">{label}</span>
      <strong className="lab-stat-value">{value}</strong>
      <p>{note}</p>
    </article>
  )
}

export default function MapLabPage({ onOpenMap }: MapLabPageProps) {
  const { selectSite, setFlyToSiteId, setEditMode, setEditingGeometry } = useStore()
  const { data: sites, isLoading: isSitesLoading, isError: isSitesError } = useSites()
  const { data: parks, isLoading: isParksLoading } = useParks()
  const { data: species, isLoading: isSpeciesLoading } = useSpecies()
  const {
    data: contextLayersResponse,
    isLoading: isContextLayersLoading,
    isError: isContextLayersError,
  } = useContextLayers()
  const {
    data: reviewQueueResponse,
    isLoading: isReviewQueueLoading,
    isError: isReviewQueueError,
  } = useReviewQueue(240)
  const [persistedState] = useState<MapLabPersistedState | null>(() => loadPersistedMapLabState())

  const [basemap, setBasemap] = useState<BasemapKey>(persistedState?.basemap ?? 'topograatone')
  const [colorMode, setColorMode] = useState<ColorMode>(persistedState?.colorMode ?? 'type')
  const [focusFilter, setFocusFilter] = useState<FocusFilter>(persistedState?.focusFilter ?? 'all')
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null)
  const [showParks, setShowParks] = useState(persistedState?.showParks ?? true)
  const [showSpecies, setShowSpecies] = useState(persistedState?.showSpecies ?? false)
  const [showCentroids, setShowCentroids] = useState(persistedState?.showCentroids ?? false)
  const [showLabels, setShowLabels] = useState(persistedState?.showLabels ?? false)
  const [showSignals, setShowSignals] = useState(persistedState?.showSignals ?? false)
  const [fillOpacity, setFillOpacity] = useState(persistedState?.fillOpacity ?? 0.24)
  const [statusVisibility, setStatusVisibility] = useState<Record<SiteStatus, boolean>>(
    persistedState?.statusVisibility ?? {
      candidate: true,
      validated: true,
      rejected: true,
    }
  )
  const [contextVisibility, setContextVisibility] = useState<Record<string, boolean>>(
    persistedState?.contextVisibility ?? {}
  )

  const contextLayers = contextLayersResponse?.layers ?? []

  useEffect(() => {
    if (contextLayers.length === 0) return

    setContextVisibility((current) => {
      const next = { ...current }
      let changed = false

      for (const layer of contextLayers) {
        if (!(layer.key in next)) {
          next[layer.key] = getContextLayerStyle(layer.key).defaultVisible
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [contextLayers])

  useEffect(() => {
    savePersistedMapLabState({
      basemap,
      colorMode,
      focusFilter,
      showParks,
      showSpecies,
      showCentroids,
      showLabels,
      showSignals,
      fillOpacity,
      statusVisibility,
      contextVisibility,
    })
  }, [
    basemap,
    colorMode,
    contextVisibility,
    fillOpacity,
    focusFilter,
    showCentroids,
    showLabels,
    showParks,
    showSignals,
    showSpecies,
    statusVisibility,
  ])

  const speciesStatsBySite = new Map<number, SiteSpeciesStats>()
  for (const feature of species?.features ?? []) {
    const siteId = feature.properties.site_id
    const current = speciesStatsBySite.get(siteId) ?? { ...EMPTY_SPECIES_STATS }
    current.featureCount += 1
    current.observationCount += feature.properties.observation_count ?? 0

    if (
      feature.properties.red_list_category &&
      RED_LIST_CATEGORIES.includes(feature.properties.red_list_category)
    ) {
      current.redListedCount += 1
    }

    if (feature.properties.is_alien) {
      current.alienCount += 1
    }

    speciesStatsBySite.set(siteId, current)
  }

  const filteredFeatures =
    sites?.features.filter((feature) => {
      const props = feature.properties
      if (!statusVisibility[props.status]) return false

      if (focusFilter === 'opportunities') return props.good_opportunity
      if (focusFilter === 'hidden_gems') return Boolean(props.hidden_gem)
      if (focusFilter === 'pressure') {
        return Boolean(props.dangerous || props.noisy || props.too_small)
      }

      return true
    }) ?? []

  const filteredSites = sites
    ? {
        ...sites,
        features: filteredFeatures,
      }
    : null

  const visibleSiteIds = new Set(filteredFeatures.map((feature) => feature.properties.id))
  const visibleSpecies =
    species?.features.filter((feature) => visibleSiteIds.has(feature.properties.site_id)) ?? []

  let visibleAreaM2 = 0
  let visibleOpportunityCount = 0
  let visiblePressureCount = 0
  let visibleBiodiversitySites = 0

  for (const feature of filteredFeatures) {
    visibleAreaM2 += feature.properties.area_m2 ?? 0
    if (feature.properties.good_opportunity) visibleOpportunityCount += 1
    if (feature.properties.dangerous || feature.properties.noisy || feature.properties.too_small) {
      visiblePressureCount += 1
    }

    const siteSpecies = speciesStatsBySite.get(feature.properties.id) ?? EMPTY_SPECIES_STATS
    if (siteSpecies.featureCount > 0) {
      visibleBiodiversitySites += 1
    }
  }

  const selectedSite =
    sites?.features.find((feature) => feature.properties.id === selectedSiteId) ?? null
  const selectedSpeciesStats = selectedSite
    ? speciesStatsBySite.get(selectedSite.properties.id) ?? EMPTY_SPECIES_STATS
    : EMPTY_SPECIES_STATS
  const reviewQueueItems = reviewQueueResponse?.items ?? []

  const activeBasemap = BASEMAPS.find((entry) => entry.key === basemap) ?? BASEMAPS[0]
  const activeColorMode = COLOR_MODES.find((entry) => entry.key === colorMode) ?? COLOR_MODES[0]
  const visibleContextLayers = contextLayers.filter((layer) => contextVisibility[layer.key])
  const underlayContextLayers = visibleContextLayers.filter(
    (layer) => getContextLayerStyle(layer.key).placement === 'underlay'
  )
  const overlayContextLayers = visibleContextLayers.filter(
    (layer) => getContextLayerStyle(layer.key).placement === 'overlay'
  )
  const referenceContextLayers = contextLayers.filter((layer) => layer.category === 'reference')
  const qaContextLayers = contextLayers.filter((layer) => layer.category === 'qa')
  const visibleReviewQueue = reviewQueueItems.filter((item) => visibleSiteIds.has(item.id))
  const reviewQueuePreview = visibleReviewQueue.slice(0, 12)

  const applyPreset = (preset: PresetId) => {
    if (preset === 'comparison') {
      setBasemap('positron')
      setColorMode('type')
      setFocusFilter('all')
      setShowParks(true)
      setShowSpecies(true)
      setShowCentroids(true)
      setShowLabels(false)
      setShowSignals(true)
      setFillOpacity(0.24)
      setStatusVisibility({ candidate: true, validated: true, rejected: true })
      setContextVisibility({
        ...getDefaultContextVisibility(contextLayers),
        landuse: false,
        natural: false,
      })
      return
    }

    if (preset === 'correction') {
      setBasemap('topograatone')
      setColorMode('status')
      setFocusFilter('all')
      setShowParks(false)
      setShowSpecies(false)
      setShowCentroids(true)
      setShowLabels(true)
      setShowSignals(true)
      setFillOpacity(0.14)
      setStatusVisibility({ candidate: true, validated: true, rejected: false })
      setContextVisibility({
        ...getDefaultContextVisibility(contextLayers),
        buildings: true,
        highways: true,
        railways: true,
        waterways: true,
        steep_slopes: true,
        edgeland_geo_edges: true,
        residual_infra_buffers: true,
        residual_road_surface_mask: true,
      })
      return
    }

    if (preset === 'ecology') {
      setBasemap('voyager')
      setColorMode('biodiversity')
      setFocusFilter('all')
      setShowParks(true)
      setShowSpecies(true)
      setShowCentroids(false)
      setShowLabels(false)
      setShowSignals(true)
      setFillOpacity(0.28)
      setStatusVisibility({ candidate: true, validated: true, rejected: false })
      setContextVisibility({
        ...Object.fromEntries(contextLayers.map((layer) => [layer.key, false])),
        waterways: true,
        natural: true,
        landuse: true,
        edgeland_water_buffer: true,
        edgeland_bio_edges: true,
        edgeland_geo_edges: true,
        steep_slopes: true,
      })
      return
    }

    setBasemap('topograatone')
    setColorMode('pressure')
    setFocusFilter('pressure')
    setShowParks(false)
    setShowSpecies(false)
    setShowCentroids(true)
    setShowLabels(true)
    setShowSignals(true)
    setFillOpacity(0.18)
    setStatusVisibility({ candidate: true, validated: true, rejected: false })
    setContextVisibility({
      ...Object.fromEntries(contextLayers.map((layer) => [layer.key, false])),
      buildings: true,
      highways: true,
      railways: true,
      residual_infra_buffers: true,
      lot_candidate_source: true,
      opportunity_candidate_source: true,
    })
  }

  const handleStatusToggle = (status: SiteStatus) => {
    setStatusVisibility((current) => ({
      ...current,
      [status]: !current[status],
    }))
  }

  const handleContextLayerToggle = (layerKey: string) => {
    setContextVisibility((current) => ({
      ...current,
      [layerKey]: !current[layerKey],
    }))
  }

  const resetWorkspace = () => {
    clearPersistedMapLabState()
    applyPreset('comparison')
    setSelectedSiteId(null)
  }

  const openSelectedSiteInOperationalMap = (startEditing: boolean) => {
    if (!selectedSite) return

    selectSite(selectedSite.properties.id)
    setFlyToSiteId(selectedSite.properties.id)

    if (startEditing) {
      setEditMode('reshape')
      setEditingGeometry(true)
    } else {
      setEditingGeometry(false)
    }

    onOpenMap()
  }

  if (isSitesLoading) {
    return (
      <div className="map-lab-page">
        <div className="content-card empty-state">Laster kartlab og datasett…</div>
      </div>
    )
  }

  if (isSitesError || !sites) {
    return (
      <div className="map-lab-page">
        <div className="content-card empty-state">
          Kartlab kunne ikke laste områdedatasettet. Den alternative arbeidsflaten trenger `sites`
          fra API-et for å fungere.
        </div>
      </div>
    )
  }

  return (
    <div className="map-lab-page">
      <section className="map-lab-hero">
        <div className="hero-copy">
          <span className="eyebrow">Kartlab</span>
          <h2>Alternativ arbeidsflate for utforsking, lesbarhet og videre korrigering</h2>
          <p className="page-intro">
            Denne siden beholder dagens operative kart urørt, men gir et eget laboratorium for
            alternative bakgrunnskart, datamodi og referanse-/QA-lag som kan brukes i videre
            korrigering og granulering.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onOpenMap}>
              Til operativt kart
            </button>
          </div>
        </div>

        <aside className="hero-panel">
          <span className="panel-kicker">Hva som testes her</span>
          <ul className="hero-list">
            <li>Alternative basemaps som gjør dataene lettere å lese.</li>
            <li>Flere tematiske visninger av de samme polygonene.</li>
            <li>Signal-lag som peker ut muligheter, press og artsfunn.</li>
          </ul>
          <div className="hero-panel-footnote">
            Laben er nå koblet til rå referanselag og QA-lag fra pipelinen, inkludert terrenglag
            når høydejobben er kjørt.
          </div>
        </aside>
      </section>

      <section className="map-lab-workspace">
        <aside className="content-card map-lab-panel">
          <div className="section-heading">
            <span className="eyebrow">Presets</span>
            <h3>Raskt bytte mellom arbeidsmodi</h3>
          </div>
          <div className="map-lab-option-grid">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                className="map-lab-option"
                onClick={() => applyPreset(preset.key)}
              >
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
          <div className="map-lab-inline-actions">
            <p className="map-lab-help">Arbeidsoppsettet lagres automatisk i denne nettleseren.</p>
            <button className="btn btn-secondary" onClick={resetWorkspace}>
              Nullstill oppsett
            </button>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Bakgrunnskart</span>
            <div className="map-lab-chip-row">
              {BASEMAPS.map((entry) => (
                <button
                  key={entry.key}
                  className={`map-lab-chip ${basemap === entry.key ? 'map-lab-chip-active' : ''}`}
                  onClick={() => setBasemap(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <p className="map-lab-help">{activeBasemap.description}</p>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Fargemodus</span>
            <div className="map-lab-option-grid map-lab-option-grid-compact">
              {COLOR_MODES.map((entry) => (
                <button
                  key={entry.key}
                  className={`map-lab-option ${colorMode === entry.key ? 'map-lab-option-active' : ''}`}
                  onClick={() => setColorMode(entry.key)}
                >
                  <strong>{entry.label}</strong>
                  <span>{entry.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Fokus</span>
            <div className="map-lab-chip-row">
              <button
                className={`map-lab-chip ${focusFilter === 'all' ? 'map-lab-chip-active' : ''}`}
                onClick={() => setFocusFilter('all')}
              >
                Alle
              </button>
              <button
                className={`map-lab-chip ${focusFilter === 'opportunities' ? 'map-lab-chip-active' : ''}`}
                onClick={() => setFocusFilter('opportunities')}
              >
                Muligheter
              </button>
              <button
                className={`map-lab-chip ${focusFilter === 'hidden_gems' ? 'map-lab-chip-active' : ''}`}
                onClick={() => setFocusFilter('hidden_gems')}
              >
                Skjulte perler
              </button>
              <button
                className={`map-lab-chip ${focusFilter === 'pressure' ? 'map-lab-chip-active' : ''}`}
                onClick={() => setFocusFilter('pressure')}
              >
                Press
              </button>
            </div>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Lag</span>
            <label className="map-lab-toggle">
              <input type="checkbox" checked={showParks} onChange={() => setShowParks((value) => !value)} />
              <span>Parker som referanse</span>
            </label>
            <label className="map-lab-toggle">
              <input type="checkbox" checked={showSpecies} onChange={() => setShowSpecies((value) => !value)} />
              <span>Artspunkter</span>
            </label>
            <label className="map-lab-toggle">
              <input type="checkbox" checked={showCentroids} onChange={() => setShowCentroids((value) => !value)} />
              <span>Sentrumsmarkører</span>
            </label>
            <label className="map-lab-toggle">
              <input type="checkbox" checked={showLabels} onChange={() => setShowLabels((value) => !value)} />
              <span>Permanente etiketter</span>
            </label>
            <label className="map-lab-toggle">
              <input type="checkbox" checked={showSignals} onChange={() => setShowSignals((value) => !value)} />
              <span>Signalringer for mulighet/press</span>
            </label>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Statusfilter</span>
            <label className="map-lab-toggle">
              <input
                type="checkbox"
                checked={statusVisibility.candidate}
                onChange={() => handleStatusToggle('candidate')}
              />
              <span>Kandidater</span>
            </label>
            <label className="map-lab-toggle">
              <input
                type="checkbox"
                checked={statusVisibility.validated}
                onChange={() => handleStatusToggle('validated')}
              />
              <span>Validerte</span>
            </label>
            <label className="map-lab-toggle">
              <input
                type="checkbox"
                checked={statusVisibility.rejected}
                onChange={() => handleStatusToggle('rejected')}
              />
              <span>Avviste</span>
            </label>
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">Referanselag</span>
            {referenceContextLayers.length > 0 ? (
              referenceContextLayers.map((layer) => (
                <label key={layer.key} className="map-lab-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(contextVisibility[layer.key])}
                    onChange={() => handleContextLayerToggle(layer.key)}
                  />
                  <span>
                    {layer.label} ({formatNumber(layer.featureCount)})
                  </span>
                </label>
              ))
            ) : (
              <p className="map-lab-help">
                {isContextLayersError
                  ? 'Kontekstlagene kunne ikke lastes fra API-et ennå.'
                  : 'Ingen referanselag er lagret ennå. Kjør pipeline med de nye kontekstlagene for å fylle denne seksjonen.'}
              </p>
            )}
          </div>

          <div className="map-lab-control-block">
            <span className="eyebrow">QA-lag</span>
            {qaContextLayers.length > 0 ? (
              qaContextLayers.map((layer) => (
                <label key={layer.key} className="map-lab-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(contextVisibility[layer.key])}
                    onChange={() => handleContextLayerToggle(layer.key)}
                  />
                  <span>
                    {layer.label} ({formatNumber(layer.featureCount)})
                  </span>
                </label>
              ))
            ) : (
              <p className="map-lab-help">
                {isContextLayersError
                  ? 'QA-lagene er ikke tilgjengelige fordi kontekstlag-API-et ikke svarte som forventet.'
                  : 'QA-lagene blir tilgjengelige når de nye kontekstlagene er seedet til databasen.'}
              </p>
            )}
          </div>

          <div className="map-lab-control-block">
            <div className="map-lab-slider-header">
              <span className="eyebrow">Fyllstyrke</span>
              <strong>{Math.round(fillOpacity * 100)}%</strong>
            </div>
            <input
              className="map-lab-slider"
              type="range"
              min="8"
              max="55"
              step="1"
              value={Math.round(fillOpacity * 100)}
              onChange={(event) => setFillOpacity(Number(event.target.value) / 100)}
            />
          </div>
        </aside>

        <div className="map-lab-stage">
          <div className="map-lab-stage-head">
            <div>
              <span className="eyebrow">Aktiv visning</span>
              <h3>{activeColorMode.label}</h3>
            </div>
            <p>{activeColorMode.description}</p>
          </div>

          <div className="map-lab-stage-stats">
            <LabStat
              label="Synlige områder"
              value={formatNumber(filteredFeatures.length)}
              note="Avhenger av fokus og statusfilter."
            />
            <LabStat
              label="Synlig areal"
              value={formatArea(visibleAreaM2)}
              note="Summert areal for gjeldende utsnitt."
            />
            <LabStat
              label="Mulighetssteder"
              value={formatNumber(visibleOpportunityCount)}
              note="Flagget som gode muligheter i datasettet."
            />
            <LabStat
              label="Press-steder"
              value={formatNumber(visiblePressureCount)}
              note="Støy, fare eller for små arealer."
            />
          </div>

          <div className="map-lab-map-shell">
            <MapContainer
              center={GAMLE_OSLO_CENTER}
              zoom={14}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer key={activeBasemap.key} attribution={activeBasemap.attribution} url={activeBasemap.url} maxZoom={activeBasemap.maxZoom ?? 18} />

              {underlayContextLayers.map((layer) => {
                const style = getContextLayerStyle(layer.key)

                return (
                  <GeoJSON
                    key={`context-underlay-${layer.key}`}
                    data={layer.geojson}
                    style={{
                      color: style.color,
                      fillColor: style.fillColor ?? style.color,
                      fillOpacity: style.fillOpacity ?? 0,
                      weight: style.weight,
                      dashArray: style.dashArray,
                    }}
                    onEachFeature={(feature, leafletLayer) => {
                      if ('bindTooltip' in leafletLayer) {
                        ;(leafletLayer as L.Path).bindTooltip(
                          getContextLayerTooltip(layer, feature),
                          { sticky: true }
                        )
                      }
                    }}
                  />
                )
              })}

              {showParks && parks && (
                <GeoJSON
                  key="lab-parks"
                  data={parks}
                  style={{
                    color: '#8fd6a3',
                    fillColor: '#8fd6a3',
                    fillOpacity: 0.08,
                    weight: 1.6,
                    dashArray: '4,8',
                  }}
                />
              )}

              {filteredSites && (
                <GeoJSON
                  key={`${colorMode}-${fillOpacity}-${filteredFeatures.length}-${selectedSiteId ?? 'none'}`}
                  data={filteredSites}
                  style={(feature) => {
                    if (!feature) return {}
                    const siteFeature = feature as SiteFeature
                    const colors = getColorForSite(
                      siteFeature,
                      colorMode,
                      speciesStatsBySite.get(siteFeature.properties.id) ?? EMPTY_SPECIES_STATS
                    )
                    const isSelected = siteFeature.properties.id === selectedSiteId

                    return {
                      color: isSelected ? '#ffffff' : colors.color,
                      fillColor: colors.fillColor,
                      fillOpacity,
                      weight: isSelected ? 3.2 : 1.6,
                      dashArray:
                        siteFeature.properties.status === 'candidate' ? '7,6' : undefined,
                    }
                  }}
                  onEachFeature={(feature, layer) => {
                    const siteFeature = feature as SiteFeature
                    const siteSpecies =
                      speciesStatsBySite.get(siteFeature.properties.id) ?? EMPTY_SPECIES_STATS

                    layer.on({
                      click: () => setSelectedSiteId(siteFeature.properties.id),
                    })

                    if ('bindTooltip' in layer) {
                      ;(layer as L.Path).bindTooltip(
                        `${siteFeature.properties.site_number} • ${siteFeature.properties.igs_type} • ${STATUS_LABELS[siteFeature.properties.status]} • ${formatNumber(siteSpecies.observationCount)} observasjoner`,
                        { sticky: true }
                      )
                    }
                  }}
                />
              )}

              {overlayContextLayers.map((layer) => {
                const style = getContextLayerStyle(layer.key)

                return (
                  <GeoJSON
                    key={`context-overlay-${layer.key}`}
                    data={layer.geojson}
                    style={{
                      color: style.color,
                      fillColor: style.fillColor ?? style.color,
                      fillOpacity: style.fillOpacity ?? 0,
                      weight: style.weight,
                      dashArray: style.dashArray,
                    }}
                    onEachFeature={(feature, leafletLayer) => {
                      if ('bindTooltip' in leafletLayer) {
                        ;(leafletLayer as L.Path).bindTooltip(
                          getContextLayerTooltip(layer, feature),
                          { sticky: true }
                        )
                      }
                    }}
                  />
                )
              })}

              {showSignals &&
                filteredFeatures.map((feature) => {
                  const center = getFeatureCenter(feature)
                  const hasPressure = Boolean(
                    feature.properties.dangerous ||
                      feature.properties.noisy ||
                      feature.properties.too_small
                  )
                  const hasOpportunity = Boolean(
                    feature.properties.good_opportunity || feature.properties.hidden_gem
                  )

                  if (!hasPressure && !hasOpportunity) return null

                  return (
                    <CircleMarker
                      key={`signal-${feature.properties.id}`}
                      center={center}
                      radius={getCentroidRadius(feature.properties.area_m2) + 5}
                      pathOptions={{
                        color: hasPressure ? '#ff7a6b' : '#61d3a1',
                        fillColor: hasPressure ? '#ff7a6b' : '#61d3a1',
                        fillOpacity: 0.08,
                        weight: 2,
                      }}
                    />
                  )
                })}

              {showCentroids &&
                filteredFeatures.map((feature) => {
                  const center = getFeatureCenter(feature)
                  const speciesStats =
                    speciesStatsBySite.get(feature.properties.id) ?? EMPTY_SPECIES_STATS
                  const centroidColor =
                    colorMode === 'biodiversity'
                      ? getColorForSite(feature, colorMode, speciesStats).color
                      : '#d9f4ff'

                  return (
                    <CircleMarker
                      key={`centroid-${feature.properties.id}`}
                      center={center}
                      radius={getCentroidRadius(feature.properties.area_m2)}
                      pathOptions={{
                        color: '#0f1210',
                        fillColor: centroidColor,
                        fillOpacity: 0.92,
                        weight: 1.2,
                      }}
                      eventHandlers={{
                        click: () => setSelectedSiteId(feature.properties.id),
                      }}
                    >
                      <Tooltip permanent={showLabels} direction="top" offset={[0, -8]}>
                        {feature.properties.site_number}
                      </Tooltip>
                    </CircleMarker>
                  )
                })}

              {showSpecies &&
                visibleSpecies.map((feature) => {
                  const isAlien = feature.properties.is_alien
                  const isRedListed = feature.properties.red_list_category
                    ? RED_LIST_CATEGORIES.includes(feature.properties.red_list_category)
                    : false
                  const radius = Math.max(
                    4,
                    Math.min(12, 3 + (feature.properties.observation_count ?? 0) * 0.4)
                  )

                  return (
                    <CircleMarker
                      key={`species-${feature.properties.id}`}
                      center={[feature.geometry.coordinates[1], feature.geometry.coordinates[0]]}
                      radius={radius}
                      pathOptions={{
                        color: isAlien ? '#ff8c42' : isRedListed ? '#ff4d6d' : '#bfd7ea',
                        fillColor: isAlien ? '#ff8c42' : isRedListed ? '#ff4d6d' : '#45c7f4',
                        fillOpacity: isAlien || isRedListed ? 0.7 : 0.3,
                        weight: isAlien || isRedListed ? 1.2 : 0.8,
                      }}
                    >
                      <Tooltip>
                        {feature.properties.vernacular_name || feature.properties.scientific_name}
                        {feature.properties.red_list_category &&
                          ` (${feature.properties.red_list_category})`}
                      </Tooltip>
                    </CircleMarker>
                  )
                })}

              <FitToSites
                featuresCount={filteredFeatures.length}
                geojson={filteredSites}
                fitKey={filteredFeatures.map((feature) => feature.properties.id).join('-')}
              />
              <FocusSelectedSite feature={selectedSite} />
            </MapContainer>

            <div className="map-lab-overlay map-lab-overlay-top">
              <span className="eyebrow">Bakgrunn</span>
              <strong>{activeBasemap.label}</strong>
              <p>{activeBasemap.description}</p>
            </div>

            <div className="map-lab-overlay map-lab-overlay-bottom">
              <span className="eyebrow">Forklaring for {activeColorMode.label.toLowerCase()}</span>
              <div className="map-lab-legend-list">
                {activeColorMode.legend.map((item) => (
                  <div key={item.label} className="map-lab-legend-item">
                    <span className="map-lab-legend-swatch" style={{ backgroundColor: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <aside className="content-card map-lab-panel">
          <div className="section-heading">
            <span className="eyebrow">Innblikk</span>
            <h3>{selectedSite ? selectedSite.properties.site_number : 'Velg et område i kartet'}</h3>
          </div>

          {selectedSite ? (
            <div className="map-lab-detail-stack">
              <div className="map-lab-selected-card">
                <div className="map-lab-selected-header">
                  <span
                    className="type-badge"
                    style={{ backgroundColor: IGS_COLORS[selectedSite.properties.igs_type] }}
                  >
                    {selectedSite.properties.igs_type}
                  </span>
                  <span className="map-lab-status-chip">
                    {STATUS_LABELS[selectedSite.properties.status]}
                  </span>
                </div>

                <div className="map-lab-selected-grid">
                  <div>
                    <span className="eyebrow">Subtype</span>
                    <strong>{selectedSite.properties.subtype || '—'}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Areal</span>
                    <strong>{formatArea(selectedSite.properties.area_m2 ?? 0)}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Mulighet</span>
                    <strong>{selectedSite.properties.good_opportunity ? 'Ja' : 'Nei'}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Skjult perle</span>
                    <strong>{selectedSite.properties.hidden_gem ? 'Ja' : 'Nei'}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Artsfunn</span>
                    <strong>{formatNumber(selectedSpeciesStats.featureCount)}</strong>
                  </div>
                  <div>
                    <span className="eyebrow">Observasjoner</span>
                    <strong>{formatNumber(selectedSpeciesStats.observationCount)}</strong>
                  </div>
                </div>
              </div>

              <div className="map-lab-signal-list">
                <div className="map-lab-signal-row">
                  <span>Rødlistet signal</span>
                  <strong>{formatNumber(selectedSpeciesStats.redListedCount)}</strong>
                </div>
                <div className="map-lab-signal-row">
                  <span>Fremmedartsignal</span>
                  <strong>{formatNumber(selectedSpeciesStats.alienCount)}</strong>
                </div>
                <div className="map-lab-signal-row">
                  <span>Farlig infrastruktur</span>
                  <strong>{selectedSite.properties.dangerous ? 'Ja' : 'Nei'}</strong>
                </div>
                <div className="map-lab-signal-row">
                  <span>Støy</span>
                  <strong>{selectedSite.properties.noisy ? 'Ja' : 'Nei'}</strong>
                </div>
                <div className="map-lab-signal-row">
                  <span>For lite</span>
                  <strong>{selectedSite.properties.too_small ? 'Ja' : 'Nei'}</strong>
                </div>
              </div>

              <div className="map-lab-action-row">
                <button
                  className="btn btn-secondary"
                  onClick={() => openSelectedSiteInOperationalMap(false)}
                >
                  Åpne i operativt kart
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => openSelectedSiteInOperationalMap(true)}
                >
                  Send til grenserevisjon
                </button>
              </div>

              <div className="map-lab-note-block">
                <span className="eyebrow">Notat</span>
                <p>
                  {selectedSite.properties.notes ||
                    'Dette stedet har ingen fritekstnotat ennå. Bruk operativt kart for redigering.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              Klikk på et polygon eller en sentrumsmarkør for å se hvordan stedet leses i den
              alternative arbeidsflaten.
            </div>
          )}

          <div className="map-lab-note-block">
            <span className="eyebrow">Lesing av datasettet</span>
            <p>
              {formatNumber(visibleBiodiversitySites)} av de synlige flatene har artsfunn. Dette er
              nyttig som signal, og Kartlab har nå {formatNumber(contextLayers.length)} egne
              kontekstlag for referanse og QA. Det gjør at videre korrigering kan skje med langt
              mer sporbarhet enn i den opprinnelige arbeidsflaten.
            </p>
          </div>

          <div className="map-lab-note-block">
            <div className="map-lab-block-head">
              <span className="eyebrow">Revisjonskø</span>
              <strong>{formatNumber(visibleReviewQueue.length)}</strong>
            </div>
            <p>
              Køen prioriterer steder der polygonet overlapper terreng- og infrastruktursignaler i
              QA-lagene. Listen følger dagens status- og fokusfilter i kartet.
            </p>
            {reviewQueuePreview.length > 0 ? (
              <div className="map-lab-queue-list">
                {reviewQueuePreview.map((item) => {
                  const overlapSummary = [
                    item.overlaps.steepSlopesM2 > 0
                      ? `bratt terreng ${formatArea(item.overlaps.steepSlopesM2)}`
                      : null,
                    item.overlaps.geoEdgesM2 > 0
                      ? `geo-edge ${formatArea(item.overlaps.geoEdgesM2)}`
                      : null,
                    item.overlaps.residualBuffersM2 > 0
                      ? `residual ${formatArea(item.overlaps.residualBuffersM2)}`
                      : null,
                    item.overlaps.roadMaskM2 > 0
                      ? `veibane ${formatArea(item.overlaps.roadMaskM2)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')

                  return (
                    <button
                      key={item.id}
                      className={`map-lab-queue-item ${
                        selectedSiteId === item.id ? 'map-lab-queue-item-active' : ''
                      }`}
                      onClick={() => setSelectedSiteId(item.id)}
                    >
                      <div className="map-lab-queue-head">
                        <strong>{item.siteNumber}</strong>
                        <span className="map-lab-score-chip">Score {item.score}</span>
                      </div>
                      <div className="map-lab-queue-meta">
                        <span>{item.igsType}</span>
                        <span>{STATUS_LABELS[item.status]}</span>
                        <span>{formatArea(item.areaM2 ?? 0)}</span>
                        <span>{formatOverlapShare(item.maxOverlapRatio)}</span>
                      </div>
                      <p>{item.reasons.join(' • ')}</p>
                      {overlapSummary ? <small>{overlapSummary}</small> : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state map-lab-inline-empty">
                {isReviewQueueLoading
                  ? 'Bygger revisjonskø…'
                  : isReviewQueueError
                    ? 'Revisjonskøen kunne ikke lastes fra API-et.'
                    : 'Ingen prioriterte steder matcher gjeldende filter akkurat nå.'}
              </div>
            )}
          </div>

          <div className="map-lab-note-block">
            <span className="eyebrow">Neste lag å koble på</span>
            <ul className="detail-list">
              <li>Ortofoto og eiendomsgrenser som siste presisjonslag for geometriarbeid.</li>
              <li>Bedre presentasjon av arealbruk og natur med egne stilprofiler per lag.</li>
              <li>Delte team-presets som kan lagres sentralt, ikke bare lokalt per nettleser.</li>
            </ul>
          </div>

          <div className="map-lab-footnote">
            {isParksLoading || isSpeciesLoading || isContextLayersLoading
              ? 'Noen støtte- eller kontekstlag lastes fortsatt.'
              : isContextLayersError
                ? 'Kartlab virker, men kontekstlag-API-et mangler sannsynligvis migrasjon og seeddata i databasen.'
              : contextLayers.length > 0
                ? `Kartlab bruker eksisterende API-er og ${formatNumber(contextLayers.length)} egne kontekstlag, side om side med dagens kart. Arbeidsoppsettet lagres lokalt.`
                : 'Kartlab er klar, men kontekstlagene dukker først opp etter at ny pipeline og migrasjon er kjørt mot databasen.'}
          </div>
        </aside>
      </section>
    </div>
  )
}
