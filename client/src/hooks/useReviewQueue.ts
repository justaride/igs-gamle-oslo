import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { ReviewQueueResponse } from '../types'

export function useReviewQueue(limit = 200) {
  return useQuery<ReviewQueueResponse>({
    queryKey: ['review-queue', limit],
    queryFn: () => api.getReviewQueue(limit) as Promise<ReviewQueueResponse>,
  })
}
