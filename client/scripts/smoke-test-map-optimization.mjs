import fs from 'node:fs'

const checks = []

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function expect(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail })
}

const app = read('src/App.tsx')
const css = read('src/app.css')
const map = read('src/components/Map.tsx')
const speciesHook = read('src/hooks/useSpecies.ts')
const reviewQueue = read('src/components/ReviewQueuePanel.tsx')
const siteSearch = read('src/components/SiteSearch.tsx')

expect(
  'map route has a scoped shell class',
  app.includes('dashboard-shell-map'),
  'App shell should expose a /map-specific class for mobile layout fixes.'
)

expect(
  'dashboard pages are route-lazy loaded',
  app.includes("lazy(() => import('./pages/MapPage'))") &&
    app.includes("lazy(() => import('./pages/MapLabPage'))") &&
    app.includes('<Suspense'),
  'Route pages should be code-split so the initial dashboard bundle does not carry every map surface.'
)

expect(
  'mobile map topbar is not sticky',
  /dashboard-shell-map[\s\S]*\.dashboard-topbar[\s\S]*position:\s*static/.test(css),
  'Mobile CSS should prevent the map topbar from covering the viewport.'
)

expect(
  'mobile map controls can collapse',
  css.includes('map-control-toggle') && map.includes('showLayerControl') && map.includes('showLegend'),
  'Layer and legend controls should be toggleable on small screens.'
)

expect(
  'species hook supports lazy loading',
  /useSpecies\s*\(\s*enabled\s*=\s*true\s*\)/.test(speciesHook) &&
    /enabled/.test(speciesHook),
  'useSpecies should accept an enabled flag for React Query.'
)

expect(
  'map only enables species query when species layer is visible',
  /useSpecies\s*\(\s*layers\.species\s*\)/.test(map),
  'Map should not fetch species data unless the species layer is active.'
)

expect(
  'species layer avoids React CircleMarker mapping',
  map.includes('SpeciesLayer') &&
    map.includes('L.canvas') &&
    !/species\?\.features\.map/.test(map),
  'Species should render through a canvas-backed Leaflet layer, not thousands of React CircleMarker nodes.'
)

expect(
  'review queue checkboxes have accessible labels',
  reviewQueue.includes('aria-label={`Velg ${item.siteNumber} i revisjonskoen`}'),
  'Each review queue checkbox needs a stable accessible name.'
)

expect(
  'site search input has id and name',
  siteSearch.includes('id="site-search"') && siteSearch.includes('name="site-search"'),
  'The map search input should have id/name attributes for browser autofill and accessibility tooling.'
)

const failed = checks.filter((check) => !check.ok)

for (const check of checks) {
  const status = check.ok ? 'PASS' : 'FAIL'
  console.log(`${status} ${check.name}${check.ok ? '' : ` - ${check.detail}`}`)
}

if (failed.length > 0) {
  console.error(`\n${failed.length} / ${checks.length} map optimization checks failed`)
  process.exit(1)
}

console.log(`\n${checks.length} / ${checks.length} map optimization checks passed`)
