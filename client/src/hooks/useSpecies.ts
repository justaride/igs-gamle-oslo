import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { SpeciesCollection } from '../types'

export function useSpecies(enabled = true) {
  return useQuery<SpeciesCollection>({
    queryKey: ['species'],
    queryFn: () => api.getSpecies() as Promise<SpeciesCollection>,
    enabled,
  })
}

export function useSpeciesBySite(siteId: number | null) {
  return useQuery({
    queryKey: ['species', 'site', siteId],
    queryFn: () => api.getSpeciesBySite(siteId!),
    enabled: siteId !== null,
  })
}
