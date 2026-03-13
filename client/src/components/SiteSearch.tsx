import { useState, useRef, useEffect } from 'react'
import { useSites } from '../hooks/useSites'
import { useStore } from '../hooks/useStore'
import type { SiteFeature } from '../types'

export default function SiteSearch() {
  const { data: sites } = useSites()
  const { selectSite, setFlyToSiteId } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SiteFeature[]>([])
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!value.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(() => {
      if (!sites) return
      const q = value.toLowerCase()
      const matches = sites.features.filter((f) => {
        const p = f.properties
        return (
          p.site_number.toLowerCase().includes(q) ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          p.igs_type.toLowerCase().includes(q) ||
          (p.subtype && p.subtype.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        )
      }).slice(0, 10)
      setResults(matches)
      setOpen(matches.length > 0)
    }, 300)
  }

  const handleSelect = (feature: SiteFeature) => {
    selectSite(feature.properties.id)
    setFlyToSiteId(feature.properties.id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="site-search" ref={containerRef}>
      <input
        type="text"
        className="search-input"
        placeholder="Sok etter site..."
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && (
        <div className="search-results">
          {results.map((f) => (
            <button
              key={f.properties.id}
              className="search-result-item"
              onClick={() => handleSelect(f)}
            >
              <span className="search-result-number">{f.properties.site_number}</span>
              <span className="search-result-type">{f.properties.igs_type}</span>
              {f.properties.name && <span className="search-result-name">{f.properties.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
