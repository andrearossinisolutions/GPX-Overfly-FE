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

  // 🔵 INIT VIEWER
  useEffect(() => {
    const Cesium = initCesium()

    console.log("🟢 INIT Cesium viewer")

    if (!containerRef.current) {
      console.warn("⚠️ containerRef non pronto")
      return
    }

    if (viewerRef.current) {
      console.warn("⚠️ viewer già inizializzato")
      return
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: true,
      geocoder: true,
      sceneModePicker: false
    })

    console.log("✅ Viewer creato")

    viewer.scene.globe.depthTestAgainstTerrain = true
    viewerRef.current = viewer

    // debug globale (super utile)
    window.viewer = viewer

    return () => {
      console.log("🧹 Destroy viewer")

      if (flightRef.current.animationId) {
        cancelAnimationFrame(flightRef.current.animationId)
      }

      if (!viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  // 🔵 RENDER TRACK
  useEffect(() => {
    const Cesium = initCesium()
    const viewer = viewerRef.current

    console.log("🗺️ useEffect trackPoints trigger")
    console.log("📊 trackPoints:", trackPoints?.length)

    if (!viewer) {
      console.warn("⚠️ viewer non pronto")
      return
    }

    viewer.entities.removeAll()

    if (!trackPoints?.length) {
      console.warn("⚠️ Nessun punto da renderizzare")
      return
    }

    const positions = trackPoints.map((p, i) => {
      if (i < 3) {
        console.log("📍 Sample point:", p)
      }

      return Cesium.Cartesian3.fromDegrees(
        p.lon,
        p.lat,
        p.ele || 0
      )
    })

    console.log("✅ Positions create:", positions.length)

    viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CYAN
      }
    })

    console.log("🚀 Zoom to entities")

    viewer.zoomTo(viewer.entities)
  }, [trackPoints])

  // 🔵 FLYOVER
  useEffect(() => {
    const Cesium = initCesium()
    const viewer = viewerRef.current

    console.log("🎬 Play trigger")
    console.log("➡️ shouldPlay:", shouldPlay)
    console.log("📊 trackPoints:", trackPoints?.length)

    if (!viewer) {
      console.warn("⚠️ viewer non pronto")
      return
    }

    if (!trackPoints?.length) {
      console.warn("⚠️ no trackPoints → niente animazione")
      return
    }

    if (!shouldPlay) {
      console.warn("⚠️ shouldPlay falso → skip")
      return
    }

    const state = flightRef.current
    state.stopped = false

    let index = 0
    let lastTs = null

    const cameraHeightOffset = 80

    console.log("🚀 START flyover")

    const tick = (ts) => {
      if (state.stopped) {
        console.log("⛔ animazione stoppata")
        return
      }

      if (lastTs == null) lastTs = ts

      const dt = (ts - lastTs) / 1000
      lastTs = ts

      index += dt * speed * 8

      const i = Math.floor(index)

      if (i >= trackPoints.length - 1) {
        console.log("🏁 Fine animazione")
        return
      }

      const current = trackPoints[i]
      const next = trackPoints[i + 1]

      if (i % 50 === 0) {
        console.log("🎯 Frame:", i, current)
      }

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
      console.log("🧹 cleanup flyover")

      if (state.animationId) {
        cancelAnimationFrame(state.animationId)
      }
    }
  }, [shouldPlay, trackPoints, speed])

  // 🔵 STOP
  useEffect(() => {
    if (!stopSignal) return

    console.log("🛑 STOP signal ricevuto")

    const state = flightRef.current
    state.stopped = true

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
    }
  }, [stopSignal])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '70vh' }}
    />
  )
}