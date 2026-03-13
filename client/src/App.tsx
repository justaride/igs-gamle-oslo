import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type MouseEvent, useEffect } from 'react'
import { type AppRoute, useAppRouter } from './hooks/useAppRouter'
import MapPage from './pages/MapPage'
import MapLabPage from './pages/MapLabPage'
import OverviewPage from './pages/OverviewPage'
import TechnicalLogPage from './pages/TechnicalLogPage'
import './app.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

const ROUTES: Array<{ path: AppRoute; label: string; description: string }> = [
  { path: '/', label: 'Oversikt', description: 'Introduksjon, nøkkeltall og kartinnhold' },
  { path: '/map', label: 'Kart', description: 'Operativ arbeidsflate for validering og redigering' },
  {
    path: '/map-lab',
    label: 'Kartlab',
    description: 'Alternativ arbeidsflate for utforsking og nye kartvisninger',
  },
  {
    path: '/technical-log',
    label: 'Teknisk logg',
    description: 'Stack, dataflyt og viktige prosjektmilepæler',
  },
]

function AppContent() {
  const { pathname, navigate } = useAppRouter()

  useEffect(() => {
    const currentRoute = ROUTES.find((route) => route.path === pathname)
    document.title = currentRoute
      ? `${currentRoute.label} | IGS Gamle Oslo`
      : 'IGS Gamle Oslo'
  }, [pathname])

  const currentRoute = ROUTES.find((route) => route.path === pathname) ?? ROUTES[0]

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, path: AppRoute) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()
    navigate(path)
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="eyebrow">Informal Green Spaces</span>
          <h1>IGS Gamle Oslo</h1>
          <p>Dashboard for kartlegging, validering og teknisk dokumentasjon.</p>
        </div>
        <nav className="dashboard-nav" aria-label="Dashboardnavigasjon">
          {ROUTES.map((route) => (
            <a
              key={route.path}
              href={route.path}
              className={`dashboard-nav-link ${
                pathname === route.path ? 'dashboard-nav-link-active' : ''
              }`}
              onClick={(event) => handleNavClick(event, route.path)}
            >
              <span>{route.label}</span>
              <small>{route.description}</small>
            </a>
          ))}
        </nav>
      </header>
      <main
        className={`dashboard-page ${
          pathname === '/map' ? 'dashboard-page-map' : pathname === '/map-lab' ? 'dashboard-page-lab' : ''
        }`}
      >
        {pathname === '/map' && <MapPage />}
        {pathname === '/map-lab' && <MapLabPage onOpenMap={() => navigate('/map')} />}
        {pathname === '/' && (
          <OverviewPage
            onOpenMap={() => navigate('/map')}
            onOpenTechnicalLog={() => navigate('/technical-log')}
          />
        )}
        {pathname === '/technical-log' && <TechnicalLogPage onOpenMap={() => navigate('/map')} />}
      </main>
      <footer className="dashboard-footer">
        <span>{currentRoute.label}</span>
        <span>{currentRoute.description}</span>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
