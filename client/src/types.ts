export type IgsType = 'Residual' | 'Lot' | 'Edgeland' | 'Opportunity'
export type SiteStatus = 'candidate' | 'validated' | 'rejected'
export type Ownership = 'PUB' | 'PRI' | 'UNK'
export type AccessControl = 'O' | 'P' | 'C'
export type Maintenance = 'FM' | 'IM' | 'NM'
export type MaintenanceFrequency = 'W' | 'M' | 'S' | 'U' | 'VL'

export type SiteProperties = {
  id: number
  site_number: string
  igs_type: IgsType
  subtype: string | null
  status: SiteStatus
  name: string | null
  ownership: Ownership
  access_control: AccessControl
  access_description: string | null
  natural_barrier: string | null
  maintenance: Maintenance | null
  maintenance_frequency: MaintenanceFrequency | null
  prox_housing: boolean | null
  hidden_gem: boolean | null
  dangerous: boolean | null
  noisy: boolean | null
  too_small: boolean | null
  notes: string | null
  area_m2: number | null
  good_opportunity: boolean
}

export type SiteFeature = GeoJSON.Feature<GeoJSON.MultiPolygon, SiteProperties>
export type SiteCollection = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, SiteProperties>

export type SpeciesProperties = {
  id: number
  site_id: number
  scientific_name: string
  vernacular_name: string | null
  red_list_category: string | null
  is_alien: boolean
  observation_count: number
}

export type SpeciesFeature = GeoJSON.Feature<GeoJSON.Point, SpeciesProperties>
export type SpeciesCollection = GeoJSON.FeatureCollection<GeoJSON.Point, SpeciesProperties>

export type ParkProperties = {
  id: number
  name: string | null
}

export type ParkFeature = GeoJSON.Feature<GeoJSON.MultiPolygon, ParkProperties>
export type ParkCollection = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, ParkProperties>

export type ContextLayerCategory = 'reference' | 'qa'

export type ContextLayer = {
  key: string
  label: string
  category: ContextLayerCategory
  description: string | null
  featureCount: number
  geojson: GeoJSON.FeatureCollection
}

export type ContextLayerResponse = {
  layers: ContextLayer[]
}

export type ReviewQueueOverlaps = {
  steepSlopesM2: number
  geoEdgesM2: number
  residualBuffersM2: number
  roadMaskM2: number
}

export type ReviewQueueItem = {
  id: number
  siteNumber: string
  igsType: IgsType
  subtype: string | null
  status: SiteStatus
  areaM2: number | null
  goodOpportunity: boolean
  hiddenGem: boolean | null
  dangerous: boolean | null
  noisy: boolean | null
  tooSmall: boolean | null
  score: number
  signalCount: number
  maxOverlapRatio: number
  overlaps: ReviewQueueOverlaps
  reasons: string[]
}

export type ReviewQueueResponse = {
  items: ReviewQueueItem[]
}

export const IGS_COLORS: Record<IgsType, string> = {
  Residual: '#1a5c1a',
  Lot: '#44ff44',
  Edgeland: '#00e5ff',
  Opportunity: '#ffff00',
}

export const STATUS_LABELS: Record<SiteStatus, string> = {
  candidate: 'Kandidat',
  validated: 'Validert',
  rejected: 'Avvist',
}

export const RED_LIST_CATEGORIES: readonly string[] = ['CR', 'EN', 'VU', 'NT']
