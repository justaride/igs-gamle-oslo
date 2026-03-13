import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { ParkCollection } from '../types'

export function useParks() {
  return useQuery<ParkCollection>({
    queryKey: ['parks'],
    queryFn: () => api.getParks() as Promise<ParkCollection>,
  })
}
