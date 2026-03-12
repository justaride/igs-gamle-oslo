import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import { useStore } from '../hooks/useStore'
import { useUpdateSiteGeometry } from '../hooks/useSites'

export default function DrawTools() {
  const map = useMap()
  const { selectedSiteId, editingGeometry, setEditingGeometry } = useStore()
  const updateGeometry = useUpdateSiteGeometry()

  useEffect(() => {
    if (!editingGeometry || !selectedSiteId) return

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
      const geojson = (layer as L.Polygon).toGeoJSON()
      updateGeometry.mutate({
        id: selectedSiteId,
        geometry: geojson.geometry,
      })
      setEditingGeometry(false)
    }

    map.on(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)

    return () => {
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      map.off(L.Draw.Event.CREATED, onCreated as L.LeafletEventHandlerFn)
    }
  }, [editingGeometry, selectedSiteId])

  return null
}
