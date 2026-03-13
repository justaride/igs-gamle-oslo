import type {
  IgsType,
  ParkCollection,
  SiteCollection,
  SiteStatus,
  SpeciesCollection,
} from '../types'
import { RED_LIST_CATEGORIES } from '../types'

export type DashboardMetrics = {
  totalSites: number
  totalAreaM2: number
  parkCount: number
  speciesFeatureCount: number
  speciesObservationCount: number
  redListedSpeciesCount: number
  alienSpeciesCount: number
  goodOpportunityCount: number
  hiddenGemCount: number
  typeCounts: Record<IgsType, number>
  statusCounts: Record<SiteStatus, number>
}

export function getDashboardMetrics(
  sites?: SiteCollection,
  species?: SpeciesCollection,
  parks?: ParkCollection
): DashboardMetrics {
  const typeCounts: Record<IgsType, number> = {
    Residual: 0,
    Lot: 0,
    Edgeland: 0,
    Opportunity: 0,
  }

  const statusCounts: Record<SiteStatus, number> = {
    candidate: 0,
    validated: 0,
    rejected: 0,
  }

  let totalAreaM2 = 0
  let goodOpportunityCount = 0
  let hiddenGemCount = 0

  for (const feature of sites?.features ?? []) {
    typeCounts[feature.properties.igs_type] += 1
    statusCounts[feature.properties.status] += 1
    totalAreaM2 += feature.properties.area_m2 ?? 0

    if (feature.properties.good_opportunity) goodOpportunityCount += 1
    if (feature.properties.hidden_gem) hiddenGemCount += 1
  }

  let speciesObservationCount = 0
  let redListedSpeciesCount = 0
  let alienSpeciesCount = 0

  for (const feature of species?.features ?? []) {
    speciesObservationCount += feature.properties.observation_count ?? 0

    if (
      feature.properties.red_list_category &&
      RED_LIST_CATEGORIES.includes(feature.properties.red_list_category)
    ) {
      redListedSpeciesCount += 1
    }

    if (feature.properties.is_alien) {
      alienSpeciesCount += 1
    }
  }

  return {
    totalSites: sites?.features.length ?? 0,
    totalAreaM2,
    parkCount: parks?.features.length ?? 0,
    speciesFeatureCount: species?.features.length ?? 0,
    speciesObservationCount,
    redListedSpeciesCount,
    alienSpeciesCount,
    goodOpportunityCount,
    hiddenGemCount,
    typeCounts,
    statusCounts,
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('nb-NO').format(value)
}

export function formatArea(value: number) {
  if (value >= 10_000) {
    return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 }).format(value / 10_000)} ha`
  }

  return `${formatNumber(Math.round(value))} m²`
}
