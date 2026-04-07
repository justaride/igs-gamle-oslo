export type IgsType = 'Residual' | 'Lot' | 'Edgeland' | 'Opportunity'

export type SiteStatus = 'candidate' | 'validated' | 'rejected'

export type Ownership = 'PUB' | 'PRI' | 'UNK'

export type AccessControl = 'O' | 'P' | 'C'

export type Maintenance = 'FM' | 'IM' | 'NM'

export type MaintenanceFrequency = 'W' | 'M' | 'S' | 'U' | 'VL'

export type Site = {
  id: number
  site_number: string
  geom: unknown
  manual_geometry: unknown | null
  igs_type: IgsType
  manual_igs_type: IgsType | null
  subtype: string | null
  manual_subtype: string | null
  status: SiteStatus
  manual_status: SiteStatus | null
  name: string | null
  manual_name: string | null
  ownership: Ownership
  manual_ownership: Ownership | null
  access_control: AccessControl
  manual_access_control: AccessControl | null
  access_description: string | null
  manual_access_description: string | null
  natural_barrier: string | null
  manual_natural_barrier: string | null
  maintenance: Maintenance | null
  manual_maintenance: Maintenance | null
  maintenance_frequency: MaintenanceFrequency | null
  manual_maintenance_frequency: MaintenanceFrequency | null
  prox_housing: boolean | null
  manual_prox_housing: boolean | null
  hidden_gem: boolean | null
  manual_hidden_gem: boolean | null
  dangerous: boolean | null
  manual_dangerous: boolean | null
  noisy: boolean | null
  manual_noisy: boolean | null
  too_small: boolean | null
  manual_too_small: boolean | null
  notes: string | null
  manual_notes: string | null
  editor_notes: string | null
  area_m2: number | null
  good_opportunity: boolean
  manual_override: boolean
  buried_river: boolean | null
  manual_buried_river: boolean | null
  community_activity_potential: string | null
  manual_community_activity_potential: string | null
  biodiversity_potential: string | null
  manual_biodiversity_potential: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  source_run_id: string | null
  source_feature_hash: string | null
  source_present: boolean
}

export type SpeciesObservation = {
  id: number
  site_id: number
  scientific_name: string
  vernacular_name: string | null
  red_list_category: string | null
  is_alien: boolean
  observation_count: number
  geom: unknown
}
