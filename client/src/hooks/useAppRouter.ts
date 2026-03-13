import { useEffect, useState } from 'react'

export type AppRoute = '/' | '/map' | '/technical-log'

const VALID_ROUTES = new Set<AppRoute>(['/', '/map', '/technical-log'])

function normalizePath(pathname: string): AppRoute {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return VALID_ROUTES.has(normalized as AppRoute) ? (normalized as AppRoute) : '/'
}

export function useAppRouter() {
  const [pathname, setPathname] = useState<AppRoute>(() => normalizePath(window.location.pathname))

  useEffect(() => {
    const syncPath = () => {
      const normalizedPath = normalizePath(window.location.pathname)

      if (window.location.pathname !== normalizedPath) {
        window.history.replaceState({}, '', normalizedPath)
      }

      setPathname(normalizedPath)
    }

    syncPath()
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])

  const navigate = (route: AppRoute) => {
    const nextRoute = normalizePath(route)
    if (nextRoute === pathname) return

    window.history.pushState({}, '', nextRoute)
    setPathname(nextRoute)
  }

  return { pathname, navigate }
}
