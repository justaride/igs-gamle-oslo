import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useReviewQueue } from '../hooks/useReviewQueue'
import { useStore } from '../hooks/useStore'
import { useSites } from '../hooks/useSites'
import { useToastStore } from '../hooks/useToast'
import { formatArea, formatNumber } from '../lib/dashboardMetrics'
import { getReviewQueueStaleMessage } from '../lib/reviewQueueMeta'
import { STATUS_LABELS, type ReviewQueueItem } from '../types'
import { api } from '../services/api'

const PAGE_SIZE = 20

const SCORE_EXPLANATION = `Poeng basert på overlapp med QA-lag:
  Bratt terreng: +3
  Geo-edgeland: +3
  Residual infrastruktur: +2
  Farlig: +2
  Støy: +1
  For lite: +1`

function formatOverlapShare(value: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value)
}

function QueueItem({ item, isActive, onSelect, checked, onToggle }: {
  item: ReviewQueueItem
  isActive: boolean
  onSelect: () => void
  checked: boolean
  onToggle: () => void
}) {
  const overlapSummary = [
    item.overlaps.steepSlopesM2 > 0
      ? `bratt terreng ${formatArea(item.overlaps.steepSlopesM2)}`
      : null,
    item.overlaps.geoEdgesM2 > 0
      ? `geo-edge ${formatArea(item.overlaps.geoEdgesM2)}`
      : null,
    item.overlaps.residualBuffersM2 > 0
      ? `residual ${formatArea(item.overlaps.residualBuffersM2)}`
      : null,
    item.overlaps.roadMaskM2 > 0
      ? `veibane ${formatArea(item.overlaps.roadMaskM2)}`
      : null,
  ]
    .filter(Boolean)
    .join(' \u2022 ')

  return (
    <div className={`review-queue-item ${isActive ? 'review-queue-item-active' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="review-queue-checkbox"
        onClick={(e) => e.stopPropagation()}
      />
      <button className="review-queue-item-btn" onClick={onSelect}>
        <div className="review-queue-item-head">
          <strong>{item.siteNumber}</strong>
          <span className="review-queue-score-chip" title={SCORE_EXPLANATION}>
            Score {item.score}
          </span>
        </div>
        <div className="review-queue-item-meta">
          <span>{item.igsType}</span>
          <span>{STATUS_LABELS[item.status]}</span>
          <span>{formatArea(item.areaM2 ?? 0)}</span>
          <span>{formatOverlapShare(item.maxOverlapRatio)}</span>
        </div>
        <p>{item.reasons.join(' \u2022 ')}</p>
        {overlapSummary ? <small>{overlapSummary}</small> : null}
      </button>
    </div>
  )
}

export default function ReviewQueuePanel() {
  const { selectSite, selectedSiteId, statusFilter, setFlyToSiteId } = useStore()
  const { data: sites } = useSites()
  const { data: reviewQueueResponse, isLoading, isError } = useReviewQueue()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) => {
      await api.bulkUpdateStatus(ids, status)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sites'] })
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      setSelectedIds(new Set())
      addToast('Bulk-oppdatering fullført', 'success')
    },
    onError: () => addToast('Bulk-oppdatering feilet', 'error'),
  })

  const refreshQueue = useMutation({
    mutationFn: () => api.refreshReviewQueue(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-queue'] })
      addToast('Revisjonskø oppdatert', 'success')
    },
    onError: () => addToast('Oppdatering feilet', 'error'),
  })

  const allItems = reviewQueueResponse?.items ?? []
  const staleMessage = getReviewQueueStaleMessage(reviewQueueResponse?.meta)

  const siteIds = new Set(
    sites?.features
      .filter((f) => statusFilter === 'all' || f.properties.status === statusFilter)
      .map((f) => f.properties.id) ?? []
  )
  const filteredItems = allItems.filter((item) => siteIds.has(item.id))
  const visibleItems = filteredItems.slice(0, visibleCount)

  const handleSelect = (id: number) => {
    selectSite(id)
    setFlyToSiteId(id)
  }

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="sidebar review-queue-panel">
      <div className="review-queue-header">
        <span className="eyebrow">Revisjonskø</span>
        <strong>{formatNumber(filteredItems.length)} steder</strong>
      </div>
      <p className="review-queue-desc">
        Prioritert etter overlapp mot QA-lag. Klikk for å velge et sted i kartet.
      </p>
      {staleMessage && (
        <div className="inline-notice">
          {staleMessage}
          <button
            className="btn btn-secondary"
            style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
            onClick={() => refreshQueue.mutate()}
            disabled={refreshQueue.isPending}
          >
            {refreshQueue.isPending ? 'Oppdaterer...' : 'Oppdater nå'}
          </button>
        </div>
      )}
      {selectedIds.size > 0 && (
        <div className="review-queue-bulk-actions">
          <span>{selectedIds.size} valgt</span>
          <button
            className="btn btn-validate"
            onClick={() => bulkStatus.mutate({ ids: [...selectedIds], status: 'validated' })}
            disabled={bulkStatus.isPending}
          >
            Valider valgte
          </button>
          <button
            className="btn btn-reject"
            onClick={() => bulkStatus.mutate({ ids: [...selectedIds], status: 'rejected' })}
            disabled={bulkStatus.isPending}
          >
            Avvis valgte
          </button>
        </div>
      )}
      {visibleItems.length > 0 ? (
        <div className="review-queue-list">
          {visibleItems.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              isActive={selectedSiteId === item.id}
              onSelect={() => handleSelect(item.id)}
              checked={selectedIds.has(item.id)}
              onToggle={() => toggleId(item.id)}
            />
          ))}
          {visibleCount < filteredItems.length && (
            <button
              className="btn btn-secondary review-queue-show-more"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Vis {Math.min(PAGE_SIZE, filteredItems.length - visibleCount)} flere
            </button>
          )}
        </div>
      ) : (
        <div className="empty-state">
          {isLoading
            ? 'Bygger revisjonskø\u2026'
            : isError
              ? 'Revisjonskøen kunne ikke lastes.'
              : 'Ingen prioriterte steder matcher gjeldende filter.'}
        </div>
      )}
    </div>
  )
}
