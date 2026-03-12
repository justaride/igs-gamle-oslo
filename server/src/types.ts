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
