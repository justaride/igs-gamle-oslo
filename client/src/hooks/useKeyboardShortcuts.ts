import { useEffect } from 'react'
import { useStore } from './useStore'
import { useSites, useUpdateSiteStatus } from './useSites'

export function useKeyboardShortcuts() {
  const { selectedSiteId, selectSite, setEditingGeometry, setFlyToSiteId } = useStore()
  const { data: sites } = useSites()
  const updateStatus = useUpdateSiteStatus()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === 'Escape') {
        setEditingGeometry(false)
        selectSite(null)
        return
      }

      if (!selectedSiteId || !sites) return
      const feature = sites.features.find((f) => f.properties.id === selectedSiteId)
      if (!feature) return

      if (e.key === 'v' || e.key === 'V') {
        if (feature.properties.status !== 'validated') {
          updateStatus.mutate({ id: selectedSiteId, status: 'validated' })
        }
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        if (feature.properties.status !== 'rejected') {
          updateStatus.mutate({ id: selectedSiteId, status: 'rejected' })
        }
        return
      }

      const sorted = [...sites.features].sort((a, b) =>
        a.properties.site_number.localeCompare(b.properties.site_number, undefined, { numeric: true })
      )
      const currentIndex = sorted.findIndex((f) => f.properties.id === selectedSiteId)

      if (e.key === 'n' || e.key === 'N') {
        const next = sorted[currentIndex + 1]
        if (next) {
          selectSite(next.properties.id)
          setFlyToSiteId(next.properties.id)
        }
        return
      }

      if (e.key === 'p' || e.key === 'P') {
        const prev = sorted[currentIndex - 1]
        if (prev) {
          selectSite(prev.properties.id)
          setFlyToSiteId(prev.properties.id)
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedSiteId, sites])
}
