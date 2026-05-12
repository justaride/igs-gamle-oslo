import { useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import { useStore } from '../hooks/useStore'
import { useUpdateSiteGeometry } from '../hooks/useSites'
import { useQueryClient } from '@tanstack/react-query'
import type { SiteCollection } from '../types'

export default function DrawTools() {
  const map = useMap()
  const {
    selectedSiteId,
    editingGeometry,
    setEditingGeometry,
    editMode,
    creatingNewSite,
    setPendingGeometry,
    saveAndExitRequested,
    clearSaveAndExitRequest,
  } = useStore()
  const updateGeometry = useUpdateSiteGeometry()
  const queryClient = useQueryClient()

  const updateGeometryRef = useRef(updateGeometry)
  const queryClientRef = useRef(queryClient)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const selectedSiteIdRef = useRef(selectedSiteId)

  useEffect(() => { updateGeometryRef.current = updateGeometry }, [updateGeometry])
  useEffect(() => { queryClientRef.current = queryClient }, [queryClient])
  useEffect(() => { selectedSiteIdRef.current = selectedSiteId }, [selectedSiteId])

  const extractAndSaveGeometry = useCallback(() => {
    const drawnItems = drawnItemsRef.current
    const siteId = selectedSiteIdRef.current
    if (!drawnItems || !siteId) return

    const coordinates: GeoJSON.Position[][][] = []
    drawnItems.eachLayer((layer) => {
      const geojson = (layer as L.Polygon).toGeoJSON()
      const geom = geojson.geometry
      if (geom.type === 'Polygon') {
        coordinates.push(geom.coordinates as GeoJSON.Position[][])
      } else if (geom.type === 'MultiPolygon') {
        coordinates.push(...(geom.coordinates as GeoJSON.Position[][][]))
      }
    })

    if (coordinates.length > 0) {
      updateGeometryRef.current.mutate({
        id: siteId,
        geometry: { type: 'MultiPolygon', coordinates },
      })
    }
  }, [])

  // Handle save-and-exit requests from header button / Escape key
  useEffect(() => {
    if (!saveAndExitRequested || !editingGeometry) {
      if (saveAndExitRequested) clearSaveAndExitRequest()
      return
    }

    if (editMode === 'reshape') {
      extractAndSaveGeometry()
    }

    setEditingGeometry(false)
    clearSaveAndExitRequest()
  }, [saveAndExitRequested])

  // Warn before leaving the page while editing
  useEffect(() => {
    if (!editingGeometry) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editingGeometry])

  // Create new site mode
  useEffect(() => {
    if (!creatingNewSite) return

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems },
    })
    map.addControl(drawControl)

    const onCreated = (e: L.DrawEvents.Created) => {
      const layer = e.layer
      drawnItems.addLayer(layer)
      const geojson = (layer as L.Polygon).toGeoJSON()
      const geom = geojson.geometry
      const multiGeom: GeoJSON.MultiPolygon = geom.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geom.coordinates as GeoJSON.Position[][]] }
        : geom as GeoJSON.MultiPolygon
      setPendingGeometry(multiGeom)
      map.removeControl(drawControl)
    }

    map.on(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)

    return () => {
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      map.off(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)
    }
  }, [creatingNewSite])

  // Edit existing geometry
  useEffect(() => {
    if (!editingGeometry || !selectedSiteId) return

    const drawnItems = new L.FeatureGroup()
    drawnItemsRef.current = drawnItems

    if (editMode === 'reshape') {
      const sites = queryClientRef.current.getQueryData<SiteCollection>(['sites'])
      const feature = sites?.features.find((f) => f.properties.id === selectedSiteId)
      if (!feature) return

      map.addLayer(drawnItems)

      const layers = L.geoJSON(feature.geometry)
      layers.eachLayer((layer) => drawnItems.addLayer(layer))

      const drawControl = new L.Control.Draw({
        draw: {
          polygon: false,
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: { featureGroup: drawnItems },
      })
      map.addControl(drawControl)

      const onEdited = () => {
        extractAndSaveGeometry()
        setEditingGeometry(false)
      }

      map.on(L.Draw.Event.EDITED, onEdited as L.LeafletEventHandlerFn)

      // Auto-enable edit mode
      const toolbar = (drawControl as unknown as Record<string, unknown>)._toolbars
      if (toolbar && typeof toolbar === 'object') {
        const editToolbar = (toolbar as Record<string, { _modes?: Record<string, { handler?: { enable: () => void } }> }>).edit
        if (editToolbar?._modes?.edit?.handler) {
          editToolbar._modes.edit.handler.enable()
        }
      }

      return () => {
        drawnItemsRef.current = null
        map.removeControl(drawControl)
        map.removeLayer(drawnItems)
        map.off(L.Draw.Event.EDITED, onEdited as L.LeafletEventHandlerFn)
      }
    }

    // Redraw mode: draw a new polygon from scratch
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems },
    })
    map.addControl(drawControl)

    const onCreated = (e: L.DrawEvents.Created) => {
      const layer = e.layer
      const geojson = (layer as L.Polygon).toGeoJSON()
      const geom = geojson.geometry
      const multiGeom = geom.type === 'Polygon'
        ? { type: 'MultiPolygon' as const, coordinates: [geom.coordinates] }
        : geom
      updateGeometryRef.current.mutate({
        id: selectedSiteId,
        geometry: multiGeom,
      })
      setEditingGeometry(false)
    }

    map.on(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)

    return () => {
      drawnItemsRef.current = null
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      map.off(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)
    }
  }, [editingGeometry, selectedSiteId, editMode])

  return null
}
