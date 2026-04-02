import { useEffect, useMemo, useRef } from 'react'
import { initCesium } from '../cesiumInit'

let Cesium = null

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function distance2D(a, b) {
  const dx = b.lon - a.lon
  const dy = b.lat - a.lat
  return Math.sqrt(dx * dx + dy * dy)
}

function normalize2D(vx, vy) {
  const len = Math.sqrt(vx * vx + vy * vy)
  if (len === 0) return { x: 0, y: 0 }
  return { x: vx / len, y: vy / len }
}

function dot2D(ax, ay, bx, by) {
  return ax * bx + ay * by
}

function angleBetweenDirs(inDir, outDir) {
  const d = clamp(dot2D(inDir.x, inDir.y, outDir.x, outDir.y), -1, 1)
  return Math.acos(d)
}

function pointAlong(from, dir, dist) {
  return {
    lon: from.lon + dir.x * dist,
    lat: from.lat + dir.y * dist,
    ele: from.ele || 0
  }
}

function lerpPoint(a, b, t) {
  return {
    lon: lerp(a.lon, b.lon, t),
    lat: lerp(a.lat, b.lat, t),
    ele: lerp(a.ele || 0, b.ele || 0, t)
  }
}

function quadraticBezier(p0, p1, p2, t) {
  const u = 1 - t
  return {
    lon: u * u * p0.lon + 2 * u * t * p1.lon + t * t * p2.lon,
    lat: u * u * p0.lat + 2 * u * t * p1.lat + t * t * p2.lat,
    ele: u * u * (p0.ele || 0) + 2 * u * t * (p1.ele || 0) + t * t * (p2.ele || 0)
  }
}

function dedupeNearPoints(points, epsilon = 1e-9) {
  if (!points?.length) return []
  const out = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    if (
      Math.abs(prev.lat - cur.lat) > epsilon ||
      Math.abs(prev.lon - cur.lon) > epsilon ||
      Math.abs((prev.ele || 0) - (cur.ele || 0)) > epsilon
    ) {
      out.push(cur)
    }
  }

  return out
}

function buildRoundedPath(points, options = {}) {
  const {
    cornerRadius = 0.01,
    minCornerAngleDeg = 8,
    samplesPerCorner = 12
  } = options

  if (!points?.length) return []
  if (points.length < 3) return [...points]

  const minCornerAngle = (minCornerAngleDeg * Math.PI) / 180
  const out = [points[0]]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]

    const inVec = { x: curr.lon - prev.lon, y: curr.lat - prev.lat }
    const outVec = { x: next.lon - curr.lon, y: next.lat - curr.lat }

    const inLen = Math.sqrt(inVec.x * inVec.x + inVec.y * inVec.y)
    const outLen = Math.sqrt(outVec.x * outVec.x + outVec.y * outVec.y)

    if (inLen === 0 || outLen === 0) {
      out.push(curr)
      continue
    }

    const inDirForward = normalize2D(inVec.x, inVec.y)
    const outDirForward = normalize2D(outVec.x, outVec.y)

    const incomingTowardsVertex = { x: -inDirForward.x, y: -inDirForward.y }
    const angle = angleBetweenDirs(incomingTowardsVertex, outDirForward)

    // quasi rettilineo => nessun raccordo
    if (angle < minCornerAngle || Math.abs(Math.PI - angle) < 0.01) {
      out.push(curr)
      continue
    }

    // distanza di trimming sui lati: solo vicino al vertice
    const trim = Math.min(cornerRadius, inLen * 0.35, outLen * 0.35)

    if (trim <= 0) {
      out.push(curr)
      continue
    }

    const entry = {
      lon: curr.lon - inDirForward.x * trim,
      lat: curr.lat - inDirForward.y * trim,
      ele: lerp(curr.ele || 0, prev.ele || 0, trim / inLen)
    }

    const exit = {
      lon: curr.lon + outDirForward.x * trim,
      lat: curr.lat + outDirForward.y * trim,
      ele: lerp(curr.ele || 0, next.ele || 0, trim / outLen)
    }

    // preserva rettilineo fino all'entry point
    out.push(entry)

    // raccordo locale centrato sul vertice
    for (let s = 1; s < samplesPerCorner; s++) {
      const t = s / samplesPerCorner
      out.push(quadraticBezier(entry, curr, exit, t))
    }

    // non pushiamo curr: l'angolo viene sostituito dalla curva
    out.push(exit)
  }

  out.push(points[points.length - 1])
  return dedupeNearPoints(out)
}

function cumulativeDistances(points) {
  const acc = [0]
  for (let i = 1; i < points.length; i++) {
    acc.push(acc[i - 1] + distance2D(points[i - 1], points[i]))
  }
  return acc
}

function interpolateAlongPath(points, distances, s) {
  if (!points?.length) return null
  if (points.length === 1) return points[0]

  const total = distances[distances.length - 1]
  const clamped = clamp(s, 0, total)

  let i = 0
  while (i < distances.length - 2 && distances[i + 1] < clamped) {
    i++
  }

  const d0 = distances[i]
  const d1 = distances[i + 1]
  const span = d1 - d0 || 1
  const t = (clamped - d0) / span

  return lerpPoint(points[i], points[i + 1], t)
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

  const smoothedPath = useMemo(() => {
    if (!trackPoints?.length) return []

    // 0.01 ~ dipende dalle coordinate in gradi; qui usiamo un valore molto piccolo
    // per arrotondare solo gli angoli senza deformare i rettilinei
    const rounded = buildRoundedPath(trackPoints, {
      cornerRadius: 0.006,
      minCornerAngleDeg: 10,
      samplesPerCorner: 10
    })

    console.log('🧩 rounded path points:', rounded.length)
    return rounded
  }, [trackPoints])

  const pathDistances = useMemo(() => {
    return cumulativeDistances(smoothedPath)
  }, [smoothedPath])

  useEffect(() => {
    Cesium = initCesium()

    if (!containerRef.current || viewerRef.current) return

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
      if (flightRef.current.animationId) {
        cancelAnimationFrame(flightRef.current.animationId)
      }
      if (!viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    Cesium = initCesium()

    console.log('🗺️ render path', smoothedPath.length)

    if (!viewer) return

    viewer.entities.removeAll()

    if (!smoothedPath?.length) return

    const positions = smoothedPath.map((p, i) => {
      if (i < 5) console.log('📍 path sample', p)
      return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.ele || 0)
    })

    const entity = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Cesium.Color.CYAN,
        clampToGround: false
      }
    })

    viewer.zoomTo(entity)
  }, [smoothedPath])

  useEffect(() => {
    const viewer = viewerRef.current
    Cesium = initCesium()

    console.log('🎬 Play trigger', shouldPlay)

    if (!viewer || !smoothedPath?.length || !shouldPlay) return

    const state = flightRef.current
    state.stopped = false

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    let distanceProgress = 0
    let lastTs = null

    const totalDistance = pathDistances[pathDistances.length - 1] || 0
    const distancePerSecond = totalDistance * 0.08 * speed
    const tangentLookAheadDistance = totalDistance * 0.006
    const cameraHeightOffset = 500
    const pitch = Cesium.Math.toRadians(-10)

    console.log('🚀 START flyover rounded-corners')

    const tick = (ts) => {
      if (state.stopped) return

      if (lastTs == null) lastTs = ts
      const dt = (ts - lastTs) / 1000
      lastTs = ts

      distanceProgress += dt * distancePerSecond

      if (distanceProgress >= totalDistance) {
        console.log('🏁 Fine animazione')
        state.animationId = null
        return
      }

      const current = interpolateAlongPath(smoothedPath, pathDistances, distanceProgress)
      const ahead = interpolateAlongPath(
        smoothedPath,
        pathDistances,
        Math.min(distanceProgress + tangentLookAheadDistance, totalDistance)
      )

      if (!current || !ahead) {
        console.warn('⚠️ interpolazione fallita')
        state.animationId = null
        return
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
      if (state.animationId) {
        cancelAnimationFrame(state.animationId)
        state.animationId = null
      }
    }
  }, [shouldPlay, smoothedPath, pathDistances, speed])

  useEffect(() => {
    if (!stopSignal) return
    const state = flightRef.current
    state.stopped = true
    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }
  }, [stopSignal])

  return <div ref={containerRef} style={{ width: '100%', height: '70vh' }} />
}