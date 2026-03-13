import { IGS_COLORS, STATUS_LABELS, type IgsType, type SiteStatus } from '../types'

type LayerKey = IgsType | 'parks' | 'species'

export type MapElementDetail = {
  id: string
  label: string
  color: string
  description: string
  outline?: boolean
  dot?: boolean
  layerKey?: LayerKey
}

export type MapTypeDetail = MapElementDetail & {
  id: IgsType
  layerKey: IgsType
}

export type MapLayerDetail = MapElementDetail & {
  layerKey: LayerKey
}

export type StatusDetail = {
  key: SiteStatus
  label: string
  accent: string
  description: string
}

export const IGS_TYPE_DETAILS: MapTypeDetail[] = [
  {
    id: 'Residual',
    layerKey: 'Residual',
    label: 'Residual IGS',
    color: IGS_COLORS.Residual,
    description: 'Restarealer mellom bebyggelse, infrastruktur og tekniske baksoner.',
  },
  {
    id: 'Lot',
    layerKey: 'Lot',
    label: 'Lot IGS',
    color: IGS_COLORS.Lot,
    description: 'Tomter og åpne flater som ikke er formelt opparbeidet, men fortsatt grønne eller åpne.',
  },
  {
    id: 'Edgeland',
    layerKey: 'Edgeland',
    label: 'Edgelands',
    color: IGS_COLORS.Edgeland,
    description: 'Kantsoner og lineære overgangsrom der ulike bysystemer møtes.',
  },
  {
    id: 'Opportunity',
    layerKey: 'Opportunity',
    label: 'Opportunity',
    color: IGS_COLORS.Opportunity,
    description: 'Arealer med tydelig potensial for habitat, brukskvalitet eller videre aktivering.',
  },
]

export const MAP_LAYER_DETAILS: MapLayerDetail[] = [
  ...IGS_TYPE_DETAILS,
  {
    id: 'parks',
    layerKey: 'parks',
    label: 'Parker (formelle)',
    color: '#88cc88',
    description: 'Formelle parker og grønne anlegg brukt som referanse- og sammenligningslag.',
    outline: true,
  },
  {
    id: 'species',
    layerKey: 'species',
    label: 'Arter',
    color: '#ff0000',
    description: 'Artspunkter som viser naturmangfold, rødlistestatus og fremmede arter.',
    dot: true,
  },
]

export const OVERVIEW_ELEMENT_DETAILS: MapElementDetail[] = [
  ...MAP_LAYER_DETAILS,
  {
    id: 'red_list_species',
    label: 'Rødlistede arter',
    color: '#ff0000',
    description: 'Observasjoner med rødlistestatus som signaliserer sårbare eller truede naturverdier.',
    dot: true,
  },
  {
    id: 'alien_species',
    label: 'Fremmede arter',
    color: '#ff8800',
    description: 'Observasjoner av fremmede arter som kan påvirke stedets økologiske kvalitet.',
    dot: true,
  },
  {
    id: 'steep_slopes',
    label: 'Bratte skråninger',
    color: '#e74c3c',
    description: 'QA-lag som markerer terreng med bratt helning, brukes i revisjonskøen for å flagge steder med krevende topografi.',
  },
  {
    id: 'edgeland_geo_edges',
    label: 'Geo-edgeland',
    color: '#3498db',
    description: 'QA-lag som markerer geologiske kantområder der ulike flater møtes, brukes for å prioritere steder som trenger nærmere vurdering.',
  },
  {
    id: 'residual_infra_buffers',
    label: 'Residual infrastruktur',
    color: '#9b59b6',
    description: 'QA-lag med buffersoner rundt infrastruktur, brukes for å identifisere steder der polygon kan overlappe med veier eller anlegg.',
  },
]

export const LEGEND_ITEMS: MapElementDetail[] = [
  ...IGS_TYPE_DETAILS,
  {
    id: 'parks_legend',
    label: 'Parker (formelle)',
    color: '#88cc88',
    description: 'Formelle parker og grønne anlegg.',
    outline: true,
  },
  {
    id: 'red_list_legend',
    label: 'Rødlistede arter',
    color: '#ff0000',
    description: 'Rødlistede artsobservasjoner.',
    dot: true,
  },
  {
    id: 'alien_legend',
    label: 'Fremmede arter',
    color: '#ff8800',
    description: 'Fremmede artsobservasjoner.',
    dot: true,
  },
]

export const STATUS_DETAILS: StatusDetail[] = [
  {
    key: 'candidate',
    label: STATUS_LABELS.candidate,
    accent: '#f2c94c',
    description: 'Foreløpig registrert og klar for vurdering i kartarbeidsflaten.',
  },
  {
    key: 'validated',
    label: STATUS_LABELS.validated,
    accent: '#34d058',
    description: 'Gjennomgått og godkjent som del av det bekreftede datasettet.',
  },
  {
    key: 'rejected',
    label: STATUS_LABELS.rejected,
    accent: '#ea4a5a',
    description: 'Registrert, men vurdert som ikke relevant eller ikke gyldig IGS.',
  },
]
