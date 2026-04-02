import { useEffect, useRef } from 'react'
import { initCesium } from '../cesiumInit'

function lerp(a, b, t) {
  return a + (b - a) * t
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function interpolatePoint(points, indexFloat) {
  if (!points?.length) return null

  const maxIndex = points.length - 1
  const clampedIndex = clamp(indexFloat, 0, maxIndex)

  const i0 = Math.floor(clampedIndex)
  const i1 = Math.min(i0 + 1, maxIndex)
  const t = clampedIndex - i0

  const p0 = points[i0]
  const p1 = points[i1]

  return {
    lat: lerp(p0.lat, p1.lat, t),
    lon: lerp(p0.lon, p1.lon, t),
    ele: lerp(p0.ele || 0, p1.ele || 0, t)
  }
}

function computeHeadingRadians(fromPoint, toPoint) {
  const dLon = Cesium.Math.toRadians(toPoint.lon - fromPoint.lon)
  const lat1 = Cesium.Math.toRadians(fromPoint.lat)
  const lat2 = Cesium.Math.toRadians(toPoint.lat)

  const y = Math.sin(dLon) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)

  return Math.atan2(y, x)
}

let Cesium = null

export default function CesiumMap({
  trackPoints,
  shouldPlay,
  stopSignal,
  speed
}) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const trackEntityRef = useRef(null)
  const flightRef = useRef({
    animationId: null,
    stopped: false
  })

  useEffect(() => {
    Cesium = initCesium()

    console.log('🟢 INIT Cesium viewer')

    if (!containerRef.current) {
      console.warn('⚠️ containerRef non pronto')
      return
    }

    if (viewerRef.current) {
      console.warn('⚠️ viewer già inizializzato')
      return
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: true,
      geocoder: true,
      sceneModePicker: false,
      infoBox: false,
      selectionIndicator: false
    })

    viewer.scene.globe.depthTestAgainstTerrain = true
    viewerRef.current = viewer
    window.viewer = viewer

    console.log('✅ Viewer creato')

    return () => {
      console.log('🧹 Destroy viewer')

      if (flightRef.current.animationId) {
        cancelAnimationFrame(flightRef.current.animationId)
      }

      if (!viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    Cesium = initCesium()
    const viewer = viewerRef.current

    console.log('🗺️ useEffect trackPoints trigger')
    console.log('📊 trackPoints:', trackPoints?.length)

    if (!viewer) {
      console.warn('⚠️ viewer non pronto')
      return
    }

    viewer.entities.removeAll()
    trackEntityRef.current = null

    if (!trackPoints?.length) {
      console.warn('⚠️ Nessun punto da renderizzare')
      return
    }

    const positions = trackPoints.map((p, i) => {
      if (i < 3) console.log('📍 Sample point:', p)
      return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.ele || 0)
    })

    console.log('✅ Positions create:', positions.length)

    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CYAN,
        clampToGround: false
      }
    })

    trackEntityRef.current = entity

    console.log('🚀 Zoom to entities')
    viewer.zoomTo(entity)
  }, [trackPoints])

  useEffect(() => {
    Cesium = initCesium()
    const viewer = viewerRef.current

    console.log('🎬 Play trigger')
    console.log('➡️ shouldPlay:', shouldPlay)
    console.log('📊 trackPoints:', trackPoints?.length)

    if (!viewer) {
      console.warn('⚠️ viewer non pronto')
      return
    }

    if (!trackPoints?.length) {
      console.warn('⚠️ no trackPoints → niente animazione')
      return
    }

    if (!shouldPlay) {
      console.warn('⚠️ shouldPlay falso → skip')
      return
    }

    const state = flightRef.current
    state.stopped = false

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    let progress = 0
    let lastTs = null

    const cameraHeightOffset = 500
    const lookAhead = 0.75
    const pointsPerSecond = 0.5 * speed
    const pitch = Cesium.Math.toRadians(-10)

    console.log('🚀 START flyover continuo')

    const tick = (ts) => {
      if (state.stopped) {
        console.log('⛔ animazione stoppata')
        return
      }

      if (lastTs == null) {
        lastTs = ts
      }

      const dt = (ts - lastTs) / 1000
      lastTs = ts

      progress += dt * pointsPerSecond

      if (progress >= trackPoints.length - 1) {
        console.log('🏁 Fine animazione')
        state.animationId = null
        return
      }

      const current = interpolatePoint(trackPoints, progress)
      const ahead = interpolatePoint(trackPoints, progress + lookAhead)

      if (!current || !ahead) {
        console.warn('⚠️ interpolazione fallita')
        state.animationId = null
        return
      }

      if (Math.floor(progress) % 10 === 0) {
        console.log('🎯 Progress:', progress.toFixed(2), current)
      }

      const destination = Cesium.Cartesian3.fromDegrees(
        current.lon,
        current.lat,
        Math.min((current.ele || 0) + cameraHeightOffset, 1500)
      )

      const heading = computeHeadingRadians(current, ahead)

      viewer.camera.setView({
        destination,
        orientation: {
          heading,
          pitch,
          roll: 0
        }
      })

      state.animationId = requestAnimationFrame(tick)
    }

    state.animationId = requestAnimationFrame(tick)

    return () => {
      console.log('🧹 cleanup flyover')

      if (state.animationId) {
        cancelAnimationFrame(state.animationId)
        state.animationId = null
      }
    }
  }, [shouldPlay, trackPoints, speed])

  useEffect(() => {
    if (!stopSignal) return

    console.log('🛑 STOP signal ricevuto')

    const state = flightRef.current
    state.stopped = true

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }
  }, [stopSignal])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '70vh' }}
    />
  )
}