import { useEffect, useRef } from 'react'
import { initCesium } from '../cesiumInit'

export default function CesiumMap({
  trackPoints,
  shouldPlay,
  stopSignal,
  speed
}) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const flightRef = useRef({
    animationId: null,
    stopped: false
  })

  useEffect(() => {
    const Cesium = initCesium()

    if (!containerRef.current || viewerRef.current) return

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: true,
      geocoder: true,
      sceneModePicker: false
    })

    viewer.scene.globe.depthTestAgainstTerrain = true
    viewerRef.current = viewer

    return () => {
      if (flightRef.current.animationId) {
        cancelAnimationFrame(flightRef.current.animationId)
      }
      if (!viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    const Cesium = initCesium()
    const viewer = viewerRef.current
    if (!viewer) return

    viewer.entities.removeAll()

    if (!trackPoints?.length) return

    const positions = trackPoints.map((p) =>
      Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.ele || 0)
    )

    viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CYAN
      }
    })

    viewer.zoomTo(viewer.entities)
  }, [trackPoints])

  useEffect(() => {
    const Cesium = initCesium()
    const viewer = viewerRef.current
    if (!viewer || !trackPoints?.length || !shouldPlay) return

    const state = flightRef.current
    state.stopped = false

    let index = 0
    let lastTs = null

    const cameraHeightOffset = 80

    const tick = (ts) => {
      if (state.stopped) return
      if (lastTs == null) lastTs = ts

      const dt = (ts - lastTs) / 1000
      lastTs = ts

      index += dt * speed * 8

      const i = Math.floor(index)
      if (i >= trackPoints.length - 1) return

      const current = trackPoints[i]
      const next = trackPoints[i + 1]

      const destination = Cesium.Cartesian3.fromDegrees(
        current.lon,
        current.lat,
        (current.ele || 0) + cameraHeightOffset
      )

      const target = Cesium.Cartesian3.fromDegrees(
        next.lon,
        next.lat,
        (next.ele || 0) + 5
      )

      viewer.camera.flyTo({
        destination,
        orientation: {
          direction: Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.subtract(
              target,
              destination,
              new Cesium.Cartesian3()
            ),
            new Cesium.Cartesian3()
          )
        },
        duration: 0
      })

      state.animationId = requestAnimationFrame(tick)
    }

    state.animationId = requestAnimationFrame(tick)

    return () => {
      if (state.animationId) cancelAnimationFrame(state.animationId)
    }
  }, [shouldPlay, trackPoints, speed])

  useEffect(() => {
    if (!stopSignal) return
    const state = flightRef.current
    state.stopped = true
    if (state.animationId) cancelAnimationFrame(state.animationId)
  }, [stopSignal])

  return <div ref={containerRef} style={{ width: '100%', height: '70vh' }} />
}