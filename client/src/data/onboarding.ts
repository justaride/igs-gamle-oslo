export type OnboardingCard = {
  id: string
  title: string
  description: string
  bullets: string[]
}

export type OnboardingStep = {
  id: string
  number: string
  title: string
  description: string
}

export const HERO_STATUS_ITEMS = [
  'Deployes som samlet stack',
  'Pipeline starter lett ved første deploy',
  'Manuelle overrides skal overleve reseed',
]

export const ONBOARDING_CARDS: OnboardingCard[] = [
  {
    id: 'stack',
    title: 'Slik er løsningen satt opp',
    description: 'Dashboardet er nå tenkt driftet som én samlet stack, ikke som et lokalt prosjekt.',
    bullets: [
      'Client publiserer dashboardet og proxyer /api videre til serveren.',
      'Server håndterer kartdata, redigering, eksport og revisjonskø.',
      'PostGIS lagrer polygoner, parker, arter og manuelle overrides.',
      'Pipeline kjører som egen service og kan oppdatere datasettet uten å renummerere steder.',
    ],
  },
  {
    id: 'safe-actions',
    title: 'Dette er trygt å gjøre',
    description: 'Redaksjonelt arbeid i dashboardet skal kunne gjøres uten å være redd for neste reseed.',
    bullets: [
      'Endre type, subtype, navn og notater på et sted.',
      'Juster grenser og lagre ny geometri i kartet.',
      'Eksporter Excel og bruk oversikten til å forstå status i prosjektet.',
      'Deploy på nytt med samme pipeline-args uten å miste manuelle endringer.',
    ],
  },
  {
    id: 'careful-actions',
    title: 'Dette må avklares først',
    description: 'Noen operasjoner er fortsatt tunge eller potensielt styrende for datagrunnlaget.',
    bullets: [
      'Full pipeline med artssteg bør kjøres bevisst, ikke som rutine på hver deploy.',
      'Excel-import fra Kim sitt ark skal bare kjøres når riktig fil og mapping er avklart.',
      'Endring av PIPELINE_ARGS bør behandles som en driftsbeslutning.',
      'Migrasjoner må kjøres manuelt dersom prod-databasen allerede eksisterer.',
    ],
  },
]

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'deploy',
    number: '1',
    title: 'Deploy stacken',
    description:
      'Deploy db, server, pipeline og client sammen. Domenet skal peke til client, ikke direkte til API-et.',
  },
  {
    id: 'verify',
    number: '2',
    title: 'Kjør rask verifisering',
    description:
      'Sjekk /api/health, bekreft at kartet laster, og test at en manuell redigering faktisk blir lagret.',
  },
  {
    id: 'operate',
    number: '3',
    title: 'Arbeid redaksjonelt i kartet',
    description:
      'Bruk oversikten og kartflaten til validering, korrigering og dokumentasjon av steder og grenser.',
  },
  {
    id: 'refresh',
    number: '4',
    title: 'Oppdater data kontrollert',
    description:
      'Bruk lett pipeline først, legg på høyde senere, og kjør artssteget bare når dere faktisk trenger det.',
  },
]
