import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useToastStore } from './useToast'
import type { SiteCollection } from '../types'

export function useSites() {
  return useQuery<SiteCollection>({
    queryKey: ['sites'],
    queryFn: () => api.getSites() as Promise<SiteCollection>,
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createSite(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Nytt område opprettet', 'success')
    },
    onError: () => addToast('Opprettelse feilet', 'error'),
  })
}

export function useUpdateSite() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: Record<string, unknown> }) =>
      api.updateSite(id, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Endringer lagret', 'success')
    },
    onError: () => addToast('Lagring feilet', 'error'),
  })
}

export function useUpdateSiteStatus() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateSiteStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Status oppdatert', 'success')
    },
    onError: () => addToast('Statusendring feilet', 'error'),
  })
}

export function useUpdateSiteGeometry() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ id, geometry }: { id: number; geometry: object }) =>
      api.updateSiteGeometry(id, geometry),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Geometri oppdatert', 'success')
    },
    onError: () => addToast('Geometrioppdatering feilet', 'error'),
  })
}

export function useResetSiteOverrides() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ id }: { id: number }) => api.resetSiteOverrides(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Overstyringer tilbakestilt', 'success')
    },
    onError: () => addToast('Tilbakestilling feilet', 'error'),
  })
}
