import { create } from 'zustand'
import type { IgsType } from '../types'

type LayerVisibility = {
  Residual: boolean
  Lot: boolean
  Edgeland: boolean
  Opportunity: boolean
  parks: boolean
  species: boolean
}

type Store = {
  selectedSiteId: number | null
  selectSite: (id: number | null) => void
  layers: LayerVisibility
  toggleLayer: (layer: keyof LayerVisibility) => void
  editingGeometry: boolean
  setEditingGeometry: (v: boolean) => void
}

export const useStore = create<Store>((set) => ({
  selectedSiteId: null,
  selectSite: (id) => set({ selectedSiteId: id }),
  layers: {
    Residual: true,
    Lot: true,
    Edgeland: true,
    Opportunity: true,
    parks: true,
    species: true,
  },
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
  editingGeometry: false,
  setEditingGeometry: (v) => set({ editingGeometry: v }),
}))
