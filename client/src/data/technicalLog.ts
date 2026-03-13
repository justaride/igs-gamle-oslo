export type TechnicalLogEntry = {
  id: string
  date: string
  category: 'Frontend' | 'Kart' | 'Pipeline' | 'Deploy'
  title: string
  summary: string
  details: string[]
  reference?: string
}

export const TECHNICAL_STACK = [
  {
    title: 'Frontend',
    value: 'React 18, Vite, React Query, Zustand',
    description: 'Dashboard, navigasjon og kartflate leveres som en lett SPA med klientbasert datainnhenting.',
  },
  {
    title: 'Kartlag',
    value: 'Leaflet + GeoJSON',
    description: 'IGS-flater, artspunkter og formelle parker visualiseres i samme arbeidsflate.',
  },
  {
    title: 'Backend',
    value: 'Express + PostgreSQL/PostGIS',
    description: 'API-et leverer GeoJSON og håndterer oppdatering av status, metadata og geometri.',
  },
  {
    title: 'Pipeline',
    value: 'Python-import, Excel, OSM, arter, høyde',
    description: 'Ingest og beriking skjer via scripts som bygger opp kartgrunnlag og støtteinformasjon.',
  },
]

export const DATAFLOW_STEPS = [
  'Rådata og stedslister importeres fra Excel og prosjektspesifikke scripts.',
  'IGS-detektering, artsberiking og høydehenting utvider datagrunnlaget før lagring.',
  'PostGIS lagrer geometri og attributter som eksponeres som GeoJSON via API-et.',
  'Kontekstlag (terreng, edgeland, infrastruktur) importeres og brukes til å beregne revisjonskøens scorer.',
  'Revisjonskøen caches i en egen tabell og oppdateres automatisk ved sted- og kontekstlagendringer.',
  'Dashboardet bruker de samme API-endepunktene til oversikt, kartarbeidsflate og revisjonskø.',
]

export const TECHNICAL_LOG_ENTRIES: TechnicalLogEntry[] = [
  {
    id: 'review-queue-cache',
    date: '2026-03-13',
    category: 'Kart',
    title: 'Revisjonskø med cache og kontekstlag-trigger',
    summary: 'Revisjonskøen ble flyttet fra on-demand PostGIS-spørring til en cachemodell, og kontekstlag-oppdateringer trigger nå automatisk refresh av køen.',
    details: [
      'review_queue_cache-tabellen lagrer ferdigberegnede scorer og overlapp mot steep_slopes, edgeland_geo_edges og residual_infra_buffers.',
      'Enkeltredigeringer av et sted oppdaterer cache-raden for det stedet automatisk.',
      'Full refresh av kontekstlag via pipeline eller API trigger full re-beregning av hele køen.',
      'Ny API-rute POST /api/context-layers/refresh-review-queue for manuell trigger.',
      'Revisjonskø-KPI lagt til på oversiktssiden, og køen er tilgjengelig i både Kartlab og Kart-fanen.',
    ],
    reference: '1fac700',
  },
  {
    id: 'dashboard-overview',
    date: '2026-03-13',
    category: 'Frontend',
    title: 'Dashboardet fikk forside og teknisk logg',
    summary: 'Arbeidsflaten ble utvidet fra én kartside til et lite dashboard med oversikt, kart og prosjektlogg.',
    details: [
      'Ny oversiktsside samler introduksjon, nøkkeltall og forklaring av kartets elementer.',
      'Kartet ble beholdt som egen operativ side med eksisterende søk, filtrering, redigering og eksport.',
      'Teknisk logg-siden dokumenterer milepæler, stack og dataflyt i prosjektet.',
    ],
  },
  {
    id: '18ca086',
    date: '2026-03-13',
    category: 'Kart',
    title: 'Feilretting før overlevering til Kim',
    summary: 'Fem feil fra andre iterasjon ble lukket for å stabilisere arbeidsflaten før videre bruk.',
    details: [
      'Arbeidsflaten ble ryddet opp etter siste iterasjon slik at redigering og daglig bruk ble mer robust.',
      'Endringen la grunnlag for videre dashboard-utvidelser uten å svekke eksisterende kartarbeid.',
    ],
    reference: '18ca086',
  },
  {
    id: '8bb7a26',
    date: '2026-03-13',
    category: 'Kart',
    title: 'Iterasjon 2 utvidet redigering og navigasjon',
    summary: 'Kartet fikk type- og subtype-redigering, polygon-reshape, søk og tastatursnarveier.',
    details: [
      'Redaktørene kan nå oppdatere type og subtype direkte i sidepanelet.',
      'Polygoner kan reshapes eller tegnes på nytt uten å forlate dashboardet.',
      'Søk og tastatursnarveier gjør gjennomgangen raskere ved større datasett.',
    ],
    reference: '8bb7a26',
  },
  {
    id: '40064a1',
    date: '2026-03-13',
    category: 'Pipeline',
    title: 'Datapipelinen ble utvidet med arter, høyde og Kim-import',
    summary: 'Import- og berikingsstegene ble parallellisert og utvidet med flere kilder.',
    details: [
      'Artsdata og høydeinformasjon ble lagt inn som egne berikingssteg i pipelinen.',
      'Import av Kims steder ble standardisert slik at de kan inn i samme database og dashboard.',
    ],
    reference: '40064a1',
  },
  {
    id: '31041e5',
    date: '2026-03-12',
    category: 'Pipeline',
    title: 'IGS-detektering optimalisert for større datamengder',
    summary: 'Kjernen i IGS-detekteringen ble justert for bedre ytelse ved større kjørsler.',
    details: [
      'Optimaliseringene reduserer friksjon i databyggingen når flere områder og flere flater analyseres.',
      'Ytelsesløftet gjør det enklere å iterere på metode og parametere.',
    ],
    reference: '31041e5',
  },
  {
    id: '8eb982a',
    date: '2026-03-12',
    category: 'Deploy',
    title: 'Containeroppsettet ble justert for tryggere deploy',
    summary: 'Klientcontaineren ble endret til å bruke intern eksponering i stedet for åpne porter.',
    details: [
      'Endringen gjorde deployoppsettet ryddigere og reduserte unødvendig eksponering.',
      'Nginx fortsetter å håndtere SPA-ruting og proxying av API-kall mot servercontaineren.',
    ],
    reference: '8eb982a',
  },
]
