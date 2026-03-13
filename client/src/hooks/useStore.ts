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

type EditMode = 'reshape' | 'redraw'
type StatusFilter = 'all' | 'candidate' | 'validated' | 'rejected'

type Store = {
  selectedSiteId: number | null
  selectSite: (id: number | null) => void
  layers: LayerVisibility
  toggleLayer: (layer: keyof LayerVisibility) => void
  editingGeometry: boolean
  setEditingGeometry: (v: boolean) => void
  editMode: EditMode
  setEditMode: (mode: EditMode) => void
  statusFilter: StatusFilter
  setStatusFilter: (f: StatusFilter) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  flyToSiteId: number | null
  setFlyToSiteId: (id: number | null) => void
}

export const useStore = create<Store>((set) => ({
  selectedSiteId: null,
  selectSite: (id) => set({ selectedSiteId: id, editingGeometry: false }),
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
  editMode: 'reshape',
  setEditMode: (mode) => set({ editMode: mode }),
  statusFilter: 'all',
  setStatusFilter: (f) => set({ statusFilter: f }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  flyToSiteId: null,
  setFlyToSiteId: (id) => set({ flyToSiteId: id }),
}))
