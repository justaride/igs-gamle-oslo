import { useState } from 'react'
import { useReviewQueue } from '../hooks/useReviewQueue'
import { useStore } from '../hooks/useStore'
import { useSites } from '../hooks/useSites'
import { formatArea, formatNumber } from '../lib/dashboardMetrics'
import { STATUS_LABELS, type ReviewQueueItem } from '../types'

const PAGE_SIZE = 20

function formatOverlapShare(value: number) {
  return new Intl.NumberFormat('nb-NO', {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value)
}

function QueueItem({ item, isActive, onSelect }: {
  item: ReviewQueueItem
  isActive: boolean
  onSelect: () => void
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
    <button
      className={`review-queue-item ${isActive ? 'review-queue-item-active' : ''}`}
      onClick={onSelect}
    >
      <div className="review-queue-item-head">
        <strong>{item.siteNumber}</strong>
        <span className="review-queue-score-chip">Score {item.score}</span>
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
  )
}

export default function ReviewQueuePanel() {
  const { selectSite, statusFilter, setFlyToSiteId } = useStore()
  const { data: sites } = useSites()
  const { data: reviewQueueResponse, isLoading, isError } = useReviewQueue()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const allItems = reviewQueueResponse?.items ?? []

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

  return (
    <div className="sidebar review-queue-panel">
      <div className="review-queue-header">
        <span className="eyebrow">Revisjonskø</span>
        <strong>{formatNumber(filteredItems.length)} steder</strong>
      </div>
      <p className="review-queue-desc">
        Prioritert etter overlapp mot QA-lag. Klikk for å velge et sted i kartet.
      </p>
      {visibleItems.length > 0 ? (
        <div className="review-queue-list">
          {visibleItems.map((item) => (
            <QueueItem
              key={item.id}
              item={item}
              isActive={false}
              onSelect={() => handleSelect(item.id)}
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
