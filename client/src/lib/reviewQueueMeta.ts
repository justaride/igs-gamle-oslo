import type { ReviewQueueMeta } from '../types'

const STALE_REASON_LABELS: Record<string, string> = {
  cache_not_initialized: 'køen er ikke bygget ennå',
  cache_status_unavailable: 'cache-status kunne ikke leses',
  context_layer_updated: 'QA-lagene er endret',
  context_layers_seeded: 'QA-lagene er oppdatert fra pipeline',
  manual_refresh_requested: 'en manuell refresh er startet',
  refresh_failed: 'forrige refresh feilet',
  site_geometry_updated: 'geometri er endret',
  site_overrides_reset: 'manuelle endringer er nullstilt',
  site_status_updated: 'status er endret',
  site_updated: 'stedsdata er endret',
}

export function formatReviewQueueTimestamp(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function getReviewQueueStaleReasonLabel(reason: string | null | undefined) {
  if (!reason) {
    return 'grunnlaget er oppdatert uten bekreftet refresh'
  }

  return STALE_REASON_LABELS[reason] ?? 'grunnlaget er endret'
}

export function getReviewQueueStaleMessage(meta: ReviewQueueMeta | null | undefined) {
  if (!meta?.isStale) {
    return null
  }

  const reason = getReviewQueueStaleReasonLabel(meta.staleReason)
  const lastRefreshedAt = formatReviewQueueTimestamp(meta.lastRefreshedAt)
  const staleSince = formatReviewQueueTimestamp(meta.staleSince)

  if (lastRefreshedAt) {
    return `Revisjonskøen er markert som utdatert fordi ${reason}. Sist bekreftet oppdatert ${lastRefreshedAt}.`
  }

  if (staleSince) {
    return `Revisjonskøen er markert som utdatert fordi ${reason}. Ingen vellykket refresh er registrert etter ${staleSince}.`
  }

  return `Revisjonskøen er markert som utdatert fordi ${reason}.`
}
