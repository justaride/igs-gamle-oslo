import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { ContextLayerResponse } from '../types'

export function useContextLayers(keys?: string[]) {
  return useQuery<ContextLayerResponse>({
    queryKey: ['context-layers', ...(keys ?? [])],
    queryFn: () => api.getContextLayers(keys) as Promise<ContextLayerResponse>,
  })
}
