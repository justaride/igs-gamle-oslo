export type ContextLayerPlacement = 'underlay' | 'overlay'

export type ContextLayerStyle = {
  defaultVisible: boolean
  placement: ContextLayerPlacement
  color: string
  fillColor?: string
  fillOpacity?: number
  weight: number
  dashArray?: string
}

export const CONTEXT_LAYER_STYLES: Record<string, ContextLayerStyle> = {
  buildings: {
    defaultVisible: true,
    placement: 'underlay',
    color: '#a5b3bd',
    fillColor: '#607381',
    fillOpacity: 0.08,
    weight: 1,
  },
  highways: {
    defaultVisible: false,
    placement: 'overlay',
    color: '#ff9f43',
    weight: 2.2,
    dashArray: '9,4',
  },
  railways: {
    defaultVisible: false,
    placement: 'overlay',
    color: '#ff5f6d',
    weight: 2.1,
    dashArray: '4,6',
  },
  waterways: {
    defaultVisible: true,
    placement: 'overlay',
    color: '#45c7f4',
    weight: 2.1,
    dashArray: '10,3',
  },
  landuse: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#91c66c',
    fillColor: '#91c66c',
    fillOpacity: 0.07,
    weight: 1,
  },
  natural: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#57cc99',
    fillColor: '#57cc99',
    fillOpacity: 0.06,
    weight: 1,
  },
  tram: {
    defaultVisible: false,
    placement: 'overlay',
    color: '#b388ff',
    weight: 2,
    dashArray: '2,6',
  },
  residual_infra_buffers: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#ff8c42',
    fillColor: '#ff8c42',
    fillOpacity: 0.08,
    weight: 1.2,
    dashArray: '6,6',
  },
  residual_road_surface_mask: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#ff5f6d',
    fillColor: '#ff5f6d',
    fillOpacity: 0.12,
    weight: 1,
  },
  edgeland_water_buffer: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#4cc9f0',
    fillColor: '#4cc9f0',
    fillOpacity: 0.1,
    weight: 1.2,
    dashArray: '5,7',
  },
  edgeland_bio_edges: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#80ed99',
    fillColor: '#80ed99',
    fillOpacity: 0.12,
    weight: 1.2,
  },
  edgeland_geo_edges: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#ffd166',
    fillColor: '#ffd166',
    fillOpacity: 0.12,
    weight: 1.2,
  },
  steep_slopes: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#e76f51',
    fillColor: '#e76f51',
    fillOpacity: 0.1,
    weight: 1.2,
    dashArray: '2,6',
  },
  lot_candidate_source: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#b8f236',
    fillColor: '#b8f236',
    fillOpacity: 0.09,
    weight: 1.2,
  },
  opportunity_candidate_source: {
    defaultVisible: false,
    placement: 'underlay',
    color: '#61b1ff',
    fillColor: '#61b1ff',
    fillOpacity: 0.08,
    weight: 1.2,
  },
}

export function getContextLayerStyle(layerKey: string): ContextLayerStyle {
  return CONTEXT_LAYER_STYLES[layerKey] ?? {
    defaultVisible: false,
    placement: 'overlay',
    color: '#cbd5e1',
    fillColor: '#cbd5e1',
    fillOpacity: 0.06,
    weight: 1.2,
  }
}
