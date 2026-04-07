import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { SiteCollection } from '../types'

export function useSites() {
  return useQuery<SiteCollection>({
    queryKey: ['sites'],
    queryFn: () => api.getSites() as Promise<SiteCollection>,
  })
}

export function useUpdateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api.updateSite(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}

export function useUpdateSiteStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateSiteStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}

export function useUpdateSiteGeometry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, geometry }: { id: number; geometry: object }) =>
      api.updateSiteGeometry(id, geometry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}

export function useResetSiteOverrides() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number }) => api.resetSiteOverrides(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })
}
