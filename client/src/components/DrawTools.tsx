import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import { useStore } from '../hooks/useStore'
import { useUpdateSiteGeometry } from '../hooks/useSites'
import { useQueryClient } from '@tanstack/react-query'
import type { SiteCollection } from '../types'

export default function DrawTools() {
  const map = useMap()
  const { selectedSiteId, editingGeometry, setEditingGeometry, editMode } = useStore()
  const updateGeometry = useUpdateSiteGeometry()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!editingGeometry || !selectedSiteId) return

    const drawnItems = new L.FeatureGroup()

    if (editMode === 'reshape') {
      const sites = queryClient.getQueryData<SiteCollection>(['sites'])
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

      let saved = false

      const onEdited = () => {
        saved = true
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
          updateGeometry.mutate({
            id: selectedSiteId,
            geometry: { type: 'MultiPolygon', coordinates },
          })
        }
        setEditingGeometry(false)
      }

      const onEditStop = () => {
        if (!saved) {
          setEditingGeometry(false)
        }
      }

      map.on(L.Draw.Event.EDITED, onEdited as L.LeafletEventHandlerFn)
      map.on(L.Draw.Event.EDITSTOP, onEditStop)

      // Auto-enable edit mode
      const toolbar = (drawControl as unknown as Record<string, unknown>)._toolbars
      if (toolbar && typeof toolbar === 'object') {
        const editToolbar = (toolbar as Record<string, { _modes?: Record<string, { handler?: { enable: () => void } }> }>).edit
        if (editToolbar?._modes?.edit?.handler) {
          editToolbar._modes.edit.handler.enable()
        }
      }

      return () => {
        map.removeControl(drawControl)
        map.removeLayer(drawnItems)
        map.off(L.Draw.Event.EDITED, onEdited as L.LeafletEventHandlerFn)
        map.off(L.Draw.Event.EDITSTOP, onEditStop)
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
      updateGeometry.mutate({
        id: selectedSiteId,
        geometry: multiGeom,
      })
      setEditingGeometry(false)
    }

    map.on(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)

    return () => {
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      map.off(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)
    }
  }, [editingGeometry, selectedSiteId, editMode])

  return null
}
