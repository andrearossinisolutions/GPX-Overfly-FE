import { useEffect, useMemo, useRef } from 'react'
import { initCesium } from '../cesiumInit'

let Cesium = null

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
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
    ele:
      u * u * (p0.ele || 0) +
      2 * u * t * (p1.ele || 0) +
      t * t * (p2.ele || 0)
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
    cornerRadius = 0.5,
    minCornerAngleDeg = 10,
    samplesPerCorner = 30
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

    if (angle < minCornerAngle || Math.abs(Math.PI - angle) < 0.01) {
      out.push(curr)
      continue
    }

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

    out.push(entry)

    for (let s = 1; s < samplesPerCorner; s++) {
      const t = s / samplesPerCorner
      out.push(quadraticBezier(entry, curr, exit, t))
    }

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

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

function computeCurvatureFactor(points, distances, distanceProgress, sampleDistance) {
  const totalDistance = distances[distances.length - 1] || 0

  const p0 = interpolateAlongPath(
    points,
    distances,
    Math.max(0, distanceProgress - sampleDistance)
  )
  const p1 = interpolateAlongPath(
    points,
    distances,
    Math.max(0, distanceProgress - sampleDistance * 0.35)
  )
  const p2 = interpolateAlongPath(
    points,
    distances,
    Math.min(totalDistance, distanceProgress + sampleDistance * 0.35)
  )
  const p3 = interpolateAlongPath(
    points,
    distances,
    Math.min(totalDistance, distanceProgress + sampleDistance)
  )

  if (!p0 || !p1 || !p2 || !p3) return 0

  const headingBefore = computeHeadingRadians(p0, p1)
  const headingAfter = computeHeadingRadians(p2, p3)
  const delta = Math.abs(wrapAngle(headingAfter - headingBefore))

  return smoothstep(
    Cesium.Math.toRadians(2),
    Cesium.Math.toRadians(28),
    delta
  )
}

function computeLocalSignedTurn(points, distances, distanceProgress, sampleDistance) {
  const totalDistance = distances[distances.length - 1] || 0

  const p0 = interpolateAlongPath(
    points,
    distances,
    Math.max(0, distanceProgress - sampleDistance)
  )
  const p1 = interpolateAlongPath(
    points,
    distances,
    Math.max(0, distanceProgress - sampleDistance * 0.2)
  )
  const p2 = interpolateAlongPath(
    points,
    distances,
    Math.min(totalDistance, distanceProgress + sampleDistance * 0.2)
  )
  const p3 = interpolateAlongPath(
    points,
    distances,
    Math.min(totalDistance, distanceProgress + sampleDistance)
  )

  if (!p0 || !p1 || !p2 || !p3) return 0

  const headingBefore = computeHeadingRadians(p0, p1)
  const headingAfter = computeHeadingRadians(p2, p3)

  return wrapAngle(headingAfter - headingBefore)
}

function flyToPathTopDown(viewer, positions) {
  if (!viewer || !positions?.length || !Cesium) return

  const boundingSphere = Cesium.BoundingSphere.fromPoints(positions)
  const range = Math.max(boundingSphere.radius * 3.5, 1500)

  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 1.2,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-90),
      range
    )
  })
}

function getSupportedRecordingMimeType() {
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ]

  for (const mimeType of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(mimeType)) {
      return mimeType
    }
  }

  return ''
}

function sanitizeFilename(name = 'gps-overfly') {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'gps-overfly'
}

function downloadRecording(chunks, filenameBase = 'gps-overfly') {
  if (!chunks?.length) return

  const blob = new Blob(chunks, { type: 'video/webm' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(filenameBase)}.webm`
  a.click()
  URL.revokeObjectURL(url)
}

function getPathBBox(points) {
  if (!points?.length) return null

  const lats = points.map((p) => p.lat)
  const lons = points.map((p) => p.lon)

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  }
}

function bboxToString(bbox) {
  if (!bbox) return ''
  return `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
}

function normalizeReportingPointsResponse(data) {
  if (!data) return []

  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.features)) return data.features
  if (Array.isArray(data)) return data

  return []
}

function normalizeAirspacesResponse(data) {
  if (!data) return []

  if (Array.isArray(data.items)) return data.items
  if (Array.isArray(data.features)) return data.features
  if (Array.isArray(data)) return data

  return []
}

function polygonCoordinatesToDegreesArray(coords) {
  if (!Array.isArray(coords) || !coords.length) return []

  let ring = null

  if (
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0]) &&
    typeof coords[0][0][0] === 'number'
  ) {
    ring = coords[0]
  } else if (
    Array.isArray(coords[0]) &&
    typeof coords[0][0] === 'number'
  ) {
    ring = coords
  } else if (
    Array.isArray(coords[0]) &&
    Array.isArray(coords[0][0]) &&
    Array.isArray(coords[0][0][0])
  ) {
    ring = coords[0][0]
  }

  if (!ring) return []

  const out = []

  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) continue
    const lon = Number(p[0])
    const lat = Number(p[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    out.push(lon, lat)
  }

  return out
}

function toMeters(value, unit) {
  if (!Number.isFinite(value)) return null

  const normalizedUnit = String(unit || '').toUpperCase()

  if (normalizedUnit === 'FT' || normalizedUnit === 'FEET') {
    return value * 0.3048
  }

  if (
    normalizedUnit === 'M' ||
    normalizedUnit === 'METER' ||
    normalizedUnit === 'METERS'
  ) {
    return value
  }

  if (normalizedUnit === 'FL') {
    return value * 100 * 0.3048
  }

  return value
}

function getAirspaceHeightValue(limit) {
  if (!limit) return null

  if (typeof limit === 'number') return limit

  if (typeof limit?.value === 'number') {
    return toMeters(limit.value, limit.unit)
  }

  if (typeof limit?.altitude?.value === 'number') {
    return toMeters(limit.altitude.value, limit.altitude.unit || limit.unit)
  }

  if (typeof limit?.height?.value === 'number') {
    return toMeters(limit.height.value, limit.height.unit || limit.unit)
  }

  if (typeof limit?.meter === 'number') return limit.meter
  if (typeof limit?.meters === 'number') return limit.meters

  return null
}

function getAirspaceHeights(airspace) {
  const lower =
    airspace?.lowerLimit ||
    airspace?.lower ||
    airspace?.properties?.lowerLimit ||
    airspace?.properties?.lower

  const upper =
    airspace?.upperLimit ||
    airspace?.upper ||
    airspace?.properties?.upperLimit ||
    airspace?.properties?.upper

  const lowerValue = getAirspaceHeightValue(lower)
  const upperValue = getAirspaceHeightValue(upper)

  return {
    height: Number.isFinite(lowerValue) ? Math.max(lowerValue, 0) : 0,
    extrudedHeight: Number.isFinite(upperValue)
      ? Math.max(upperValue, 200)
      : 1200
  }
}

function getAirspaceTypeCode(airspace) {
  const rawType =
    airspace?.type ??
    airspace?.properties?.type ??
    airspace?.category ??
    airspace?.properties?.category

  const typeCode = Number(rawType)
  return Number.isFinite(typeCode) ? typeCode : null
}

function createAirspaceStyleMap() {
  return {
    2: {
      key: 'D',
      label: 'D',
      enabled: true,
      fillColorCss: '#ff4d4d',
      fillAlpha: 0.18,
      lineColorCss: '#ff4d4d',
      groundLineColorCss: '#ff4d4d',
      groundDashed: false,
      showVolume: true,
      showOutline: true
    },
    3: {
      key: 'P',
      label: 'P',
      enabled: true,
      fillColorCss: '#ff4d4d',
      fillAlpha: 0.18,
      lineColorCss: '#ff4d4d',
      groundLineColorCss: '#ff4d4d',
      groundDashed: false,
      showVolume: true,
      showOutline: true
    },
    4: {
      key: 'CTR',
      label: 'CTR',
      enabled: true,
      fillColorCss: '#4DA3FF',
      fillAlpha: 0.18,
      lineColorCss: '#4DA3FF',
      groundLineColorCss: '#4DA3FF',
      groundDashed: false,
      showVolume: true,
      showOutline: true
    },
    13: {
      key: 'ATZ',
      label: 'ATZ',
      enabled: true,
      fillColorCss: '#4DA3FF',
      fillAlpha: 0.1,
      lineColorCss: '#4DA3FF',
      groundLineColorCss: '#4DA3FF',
      groundDashed: true,
      showVolume: true,
      showOutline: true
    },
    14: {
      key: 'MATZ',
      label: 'MATZ',
      enabled: true,
      fillColorCss: '#4DA3FF',
      fillAlpha: 0.1,
      lineColorCss: '#4DA3FF',
      groundLineColorCss: '#4DA3FF',
      groundDashed: true,
      showVolume: true,
      showOutline: true
    }
  }
}

const AIRSPACE_STYLE_BY_TYPE = createAirspaceStyleMap()

function materializeAirspaceStyle(style) {
  if (!style || !Cesium) return null

  return {
    ...style,
    fillColor: Cesium.Color.fromCssColorString(style.fillColorCss).withAlpha(
      style.fillAlpha ?? 0.18
    ),
    lineColor: Cesium.Color.fromCssColorString(style.lineColorCss),
    groundLineColor: Cesium.Color.fromCssColorString(style.groundLineColorCss)
  }
}

function getAirspaceStyle(airspace) {
  const typeCode = getAirspaceTypeCode(airspace)
  if (typeCode == null) return null
  return materializeAirspaceStyle(AIRSPACE_STYLE_BY_TYPE[typeCode] || null)
}

function createGroundLineMaterial(style) {
  if (style.groundDashed) {
    return new Cesium.PolylineDashMaterialProperty({
      color: style.groundLineColor,
      dashLength: 18
    })
  }

  return style.groundLineColor
}

export default function CesiumMap({
  trackPoints,
  shouldPlay,
  stopSignal,
  speed,
  onPositionChange,
  recordEnabled = false,
  recordingFileName = 'gps-overfly',
  interpretLastAsAlternate = false
}) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const pathPositionsRef = useRef(null)
  const speedRef = useRef(speed)
  const recorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingActiveRef = useRef(false)
  const recordingFileNameRef = useRef(recordingFileName)
  const reportingPointEntitiesRef = useRef([])
  const airspaceEntitiesRef = useRef([])

  const renderedTrackPoints = useMemo(() => {
    return trackPoints || []
  }, [trackPoints])

  const navigableTrackPoints = useMemo(() => {
    if (!trackPoints?.length) return []
    if (!interpretLastAsAlternate) return trackPoints
    if (trackPoints.length <= 1) return trackPoints
    return trackPoints.slice(0, -1)
  }, [trackPoints, interpretLastAsAlternate])

  const alternatePoint = useMemo(() => {
    if (!interpretLastAsAlternate) return null
    if (!trackPoints?.length || trackPoints.length <= 1) return null
    return trackPoints[trackPoints.length - 1]
  }, [trackPoints, interpretLastAsAlternate])

  const clearReportingPoints = () => {
    const viewer = viewerRef.current
    if (!viewer) return

    for (const entity of reportingPointEntitiesRef.current) {
      viewer.entities.remove(entity)
    }

    reportingPointEntitiesRef.current = []
  }

  const clearAirspaces = () => {
    const viewer = viewerRef.current
    if (!viewer) return

    for (const entity of airspaceEntitiesRef.current) {
      viewer.entities.remove(entity)
    }

    airspaceEntitiesRef.current = []
  }

  const addReportingPointsToMap = (reportingPoints) => {
    const viewer = viewerRef.current
    if (!viewer || !Cesium) return

    clearReportingPoints()

    for (const rp of reportingPoints) {
      const coords =
        rp?.geometry?.coordinates ||
        rp?.geometry?.coordinates?.[0] ||
        null

      const lon = Array.isArray(coords) ? Number(coords[0]) : undefined
      const lat = Array.isArray(coords) ? Number(coords[1]) : undefined

      const name =
        rp?.name ||
        rp?.properties?.name ||
        rp?.properties?.title ||
        'VFR Point'

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 260),
        point: {
          pixelSize: 9,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        },
        label: {
          text: name,
          font: 'bold 14px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale: 0.85
        }
      })

      reportingPointEntitiesRef.current.push(entity)
    }
  }

  const addAirspacesToMap = (airspaces) => {
    const viewer = viewerRef.current
    if (!viewer || !Cesium) return

    clearAirspaces()

    let rendered = 0

    for (const airspace of airspaces) {
      const coords = airspace?.geometry?.coordinates
      const degreesArray = polygonCoordinatesToDegreesArray(coords)
      const style = getAirspaceStyle(airspace)

      const typeInfo = {
        name: airspace?.name || airspace?.properties?.name,
        type: getAirspaceTypeCode(airspace),
        category: airspace?.category || airspace?.properties?.category,
        class: airspace?.properties?.class,
        style: style?.key || null
      }

      if (degreesArray.length < 6) {
        console.log('⚠️ airspace skip geometry', typeInfo, coords)
        continue
      }

      console.log('🧪 airspace parsed', {
        ...typeInfo,
        render: Boolean(style?.enabled),
        points: degreesArray.length / 2
      })

      if (!style?.enabled) continue

      const { height, extrudedHeight } = getAirspaceHeights(airspace)
      const baseHeight = Math.max(0, height)
      const topHeight = Math.max(baseHeight + 200, extrudedHeight)

      if (style.showVolume) {
        const polygonEntity = viewer.entities.add({
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(degreesArray),
            height: baseHeight,
            extrudedHeight: topHeight,
            material: style.fillColor,
            outline: style.showOutline,
            outlineColor: style.lineColor,
            perPositionHeight: false
          }
        })

        airspaceEntitiesRef.current.push(polygonEntity)
      }

      const groundOutlineEntity = viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(degreesArray),
          width: 3,
          material: createGroundLineMaterial(style),
          clampToGround: true
        }
      })

      airspaceEntitiesRef.current.push(groundOutlineEntity)
      rendered++
    }

    console.log('✅ Airspaces rendered:', rendered)
  }

  const flightRef = useRef({
    animationId: null,
    stopped: false,
    speedFactor: 1,
    roll: 0,
    transitioningToStart: false
  })

  const smoothedPath = useMemo(() => {
    if (!navigableTrackPoints?.length) return []

    const rounded = buildRoundedPath(navigableTrackPoints, {
      cornerRadius: 0.006,
      minCornerAngleDeg: 10,
      samplesPerCorner: 10
    })

    console.log('🧩 rounded path points:', rounded.length)
    return rounded
  }, [navigableTrackPoints])

  const pathDistances = useMemo(() => {
    return cumulativeDistances(smoothedPath)
  }, [smoothedPath])

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !renderedTrackPoints?.length) {
      clearReportingPoints()
      return
    }

    const controller = new AbortController()

    const loadReportingPoints = async () => {
      try {
        const bbox = getPathBBox(renderedTrackPoints)
        const bboxParam = bboxToString(bbox)

        if (!bboxParam) return

        const response = await fetch(
          `http://localhost:3001/api/reporting-points?bbox=${encodeURIComponent(bboxParam)}`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Reporting points request failed: ${response.status}`)
        }

        const data = await response.json()
        const reportingPoints = normalizeReportingPointsResponse(data)

        console.log('🟡 reporting points:', reportingPoints.length)

        addReportingPointsToMap(reportingPoints)
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('❌ Failed to load reporting points:', error)
        clearReportingPoints()
      }
    }

    loadReportingPoints()

    return () => {
      controller.abort()
      clearReportingPoints()
    }
  }, [renderedTrackPoints, interpretLastAsAlternate])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !renderedTrackPoints?.length) {
      clearAirspaces()
      return
    }

    const controller = new AbortController()

    const loadAirspaces = async () => {
      try {
        const bbox = getPathBBox(renderedTrackPoints)
        const bboxParam = bboxToString(bbox)

        if (!bboxParam) return

        const response = await fetch(
          `http://localhost:3001/api/airspaces?bbox=${encodeURIComponent(bboxParam)}`,
          { signal: controller.signal }
        )

        if (!response.ok) {
          throw new Error(`Airspaces request failed: ${response.status}`)
        }

        const data = await response.json()
        const airspaces = normalizeAirspacesResponse(data)

        console.log('🟥 airspaces:', airspaces.length)

        addAirspacesToMap(airspaces)
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('❌ Failed to load airspaces:', error)
        clearAirspaces()
      }
    }

    loadAirspaces()

    return () => {
      controller.abort()
      clearAirspaces()
    }
  }, [renderedTrackPoints, interpretLastAsAlternate])

  useEffect(() => {
    recordingFileNameRef.current = recordingFileName
  }, [recordingFileName])

  const stopRecording = (shouldDownload = true) => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    recorder.onstop = () => {
      recordingActiveRef.current = false

      if (shouldDownload) {
        downloadRecording(
          recordedChunksRef.current,
          recordingFileNameRef.current
        )
      }

      recordedChunksRef.current = []
      recorderRef.current = null
    }

    recorder.stop()
  }

  const startRecording = () => {
    const viewer = viewerRef.current
    if (!viewer || recordingActiveRef.current) return

    const canvas = viewer.scene?.canvas
    if (!canvas?.captureStream || !window.MediaRecorder) {
      console.warn('⚠️ Recording non supportato in questo browser')
      return
    }

    const stream = canvas.captureStream(60)
    const mimeType = getSupportedRecordingMimeType()

    recordedChunksRef.current = []

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    )

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data)
      }
    }

    recorderRef.current = recorder
    recordingActiveRef.current = true
    recorder.start()
  }

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
    viewer.resolutionScale = 1.5
    viewerRef.current = viewer
    window.viewer = viewer

    console.log('✅ Viewer creato')

    return () => {
      if (flightRef.current.animationId) {
        cancelAnimationFrame(flightRef.current.animationId)
      }

      if (recordingActiveRef.current) {
        stopRecording(false)
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
    pathPositionsRef.current = null
    reportingPointEntitiesRef.current = []
    airspaceEntitiesRef.current = []

    if (!smoothedPath?.length) return

    const pathHeightOffset = 200

    const mainPositions = smoothedPath.map((p, i) => {
      if (i < 5) console.log('📍 path sample', p)
      return Cesium.Cartesian3.fromDegrees(
        p.lon,
        p.lat,
        (p.ele || 0) + pathHeightOffset
      )
    })

    let allVisiblePositions = [...mainPositions]

    viewer.entities.add({
      polyline: {
        positions: mainPositions,
        width: 4,
        material: Cesium.Color.CYAN,
        clampToGround: false
      }
    })

    if (
      interpretLastAsAlternate &&
      alternatePoint &&
      navigableTrackPoints.length > 0
    ) {
      const plannedLandingPoint =
        navigableTrackPoints[navigableTrackPoints.length - 1]

      const alternateCartesian = Cesium.Cartesian3.fromDegrees(
        alternatePoint.lon,
        alternatePoint.lat,
        (alternatePoint.ele || 0) + pathHeightOffset
      )

      const alternatePositions = [
        Cesium.Cartesian3.fromDegrees(
          plannedLandingPoint.lon,
          plannedLandingPoint.lat,
          (plannedLandingPoint.ele || 0) + pathHeightOffset
        ),
        alternateCartesian
      ]

      viewer.entities.add({
        polyline: {
          positions: alternatePositions,
          width: 4,
          material: Cesium.Color.ORANGE,
          clampToGround: false
        }
      })

      allVisiblePositions = [...allVisiblePositions, alternateCartesian]
    }

    pathPositionsRef.current = allVisiblePositions

    const markerHeightOffset = pathHeightOffset + 20

    const start = smoothedPath[0]
    const end = smoothedPath[smoothedPath.length - 1]

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        start.lon,
        start.lat,
        (start.ele || 0) + markerHeightOffset
      ),
      point: {
        pixelSize: 12,
        color: Cesium.Color.LIME,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      },
      label: {
        text: 'Takeoff',
        font: 'bold 18px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })

    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        end.lon,
        end.lat,
        (end.ele || 0) + markerHeightOffset
      ),
      point: {
        pixelSize: 12,
        color: Cesium.Color.RED,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2
      },
      label: {
        text: 'Landing',
        font: 'bold 18px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    })

    if (interpretLastAsAlternate && alternatePoint) {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          alternatePoint.lon,
          alternatePoint.lat,
          (alternatePoint.ele || 0) + markerHeightOffset
        ),
        point: {
          pixelSize: 12,
          color: Cesium.Color.ORANGE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2
        },
        label: {
          text: 'Alternate',
          font: 'bold 18px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      })
    }

    flyToPathTopDown(viewer, allVisiblePositions)
  }, [smoothedPath, interpretLastAsAlternate, alternatePoint, navigableTrackPoints])

  useEffect(() => {
    const viewer = viewerRef.current
    Cesium = initCesium()

    console.log('🎬 Play trigger', shouldPlay)

    if (!viewer || !smoothedPath?.length || !shouldPlay) return

    const state = flightRef.current
    state.stopped = false
    state.speedFactor = 1
    state.roll = 0

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    if (recordEnabled) {
      startRecording()
    }

    let distanceProgress = 0
    let lastTs = null
    let phase = 'intro-drop'
    let phaseElapsed = 0

    const totalDistance = pathDistances[pathDistances.length - 1] || 0
    const baseDistancePerSecondBase = totalDistance * 0.04
    const tangentLookAheadDistance = totalDistance * 0.006
    const finalApproachDistance = totalDistance * 0.08

    const curvatureSampleDistance = totalDistance * 0.1
    const minCurveSpeedFactor = 0.5
    const speedResponse = 1.5

    const bankSampleDistance = totalDistance * 0.0085
    const maxRoll = Cesium.Math.toRadians(5)

    const cruiseHeightOffset = 500
    const introHighHeightOffset = 2500
    const outroHeightOffset = 2500
    const introGroundOffset = 80

    const verticalPitch = Cesium.Math.toRadians(-90)
    const groundPitch = Cesium.Math.toRadians(0)
    const climbPitch = Cesium.Math.toRadians(10)
    const cruisePitch = Cesium.Math.toRadians(-10)

    const introDropDuration = 3.2
    const introPullUpDuration = 1.4
    const introSettleDuration = 1.8
    const arrivalLevelDuration = 1.2
    const outroDuration = 5.0

    const startPoint = smoothedPath[0]
    const startAheadPoint =
      smoothedPath[Math.min(1, smoothedPath.length - 1)] || startPoint

    const introStartDestination = Cesium.Cartesian3.fromDegrees(
      startPoint.lon,
      startPoint.lat,
      Math.min((startPoint.ele || 0) + introHighHeightOffset, 4000)
    )

    const introStartHeading = computeHeadingRadians(startPoint, startAheadPoint)

    const endPoint = smoothedPath[smoothedPath.length - 1]
    const endBeforePoint =
      smoothedPath[Math.max(smoothedPath.length - 2, 0)] || endPoint

    console.log(
      '🚀 START flyover intro-drop + intro-pull-up + intro-settle + cruise + arrival-level + outro'
    )

    const tick = (ts) => {
      if (state.stopped) return

      if (lastTs == null) lastTs = ts
      const dt = (ts - lastTs) / 1000
      lastTs = ts
      phaseElapsed += dt

      let current = null
      let ahead = null
      let dynamicPitch = cruisePitch
      let dynamicHeightOffset = cruiseHeightOffset
      let dynamicRoll = 0

      if (phase === 'intro-drop') {
        const t = easeInOut(phaseElapsed / introDropDuration)

        current = startPoint
        ahead = startAheadPoint
        dynamicHeightOffset = lerp(
          introHighHeightOffset,
          introGroundOffset,
          t
        )
        dynamicPitch = lerp(verticalPitch, groundPitch, t)
        dynamicRoll = 0

        if (t >= 1) {
          phase = 'intro-pull-up'
          phaseElapsed = 0
        }
      } else if (phase === 'intro-pull-up') {
        const t = easeInOut(phaseElapsed / introPullUpDuration)

        current =
          interpolateAlongPath(
            smoothedPath,
            pathDistances,
            distanceProgress
          ) || startPoint

        ahead =
          interpolateAlongPath(
            smoothedPath,
            pathDistances,
            Math.min(distanceProgress + tangentLookAheadDistance, totalDistance)
          ) || startAheadPoint

        dynamicHeightOffset = lerp(introGroundOffset, cruiseHeightOffset, t)
        dynamicPitch = lerp(groundPitch, climbPitch, t)
        dynamicRoll = 0

        distanceProgress +=
          dt * baseDistancePerSecondBase * speedRef.current * 0.35

        if (t >= 1) {
          phase = 'intro-settle'
          phaseElapsed = 0
        }
      } else if (phase === 'intro-settle') {
        const t = easeInOut(phaseElapsed / introSettleDuration)

        current =
          interpolateAlongPath(
            smoothedPath,
            pathDistances,
            distanceProgress
          ) || startPoint

        ahead =
          interpolateAlongPath(
            smoothedPath,
            pathDistances,
            Math.min(distanceProgress + tangentLookAheadDistance, totalDistance)
          ) || startAheadPoint

        dynamicHeightOffset = cruiseHeightOffset
        dynamicPitch = lerp(climbPitch, cruisePitch, t)
        dynamicRoll = 0

        distanceProgress +=
          dt * baseDistancePerSecondBase * speedRef.current * 0.7

        if (t >= 1) {
          phase = 'cruise'
          phaseElapsed = 0
        }
      } else if (phase === 'cruise') {
        const curvatureFactor = computeCurvatureFactor(
          smoothedPath,
          pathDistances,
          distanceProgress,
          curvatureSampleDistance
        )

        const targetSpeedFactor =
          1 - curvatureFactor * (1 - minCurveSpeedFactor)

        const speedT = 1 - Math.exp(-speedResponse * dt)
        state.speedFactor = lerp(state.speedFactor, targetSpeedFactor, speedT)

        distanceProgress +=
          dt * baseDistancePerSecondBase * speedRef.current * state.speedFactor

        if (distanceProgress >= totalDistance - finalApproachDistance) {
          distanceProgress = Math.min(distanceProgress, totalDistance)
          phase = 'final-approach'
          phaseElapsed = 0
        }

        current = interpolateAlongPath(
          smoothedPath,
          pathDistances,
          distanceProgress
        )

        ahead = interpolateAlongPath(
          smoothedPath,
          pathDistances,
          Math.min(distanceProgress + tangentLookAheadDistance, totalDistance)
        )

        if (!current || !ahead) {
          console.warn('⚠️ interpolazione fallita')
          state.animationId = null
          return
        }

        const bankLeadDistance = totalDistance * 0.0018

        const signedTurn = computeLocalSignedTurn(
          smoothedPath,
          pathDistances,
          Math.min(distanceProgress + bankLeadDistance, totalDistance),
          bankSampleDistance
        )

        const rawTurnAmount = smoothstep(
          Cesium.Math.toRadians(2.8),
          Cesium.Math.toRadians(13),
          Math.abs(signedTurn)
        )

        const localTurnAmount = rawTurnAmount * rawTurnAmount * rawTurnAmount

        const targetRoll =
          clamp(signedTurn / Cesium.Math.toRadians(12), -1, 1) *
          localTurnAmount *
          maxRoll

        const rollInResponse = 3.5
        const rollOutResponse = 1.5
        const activeRollResponse =
          Math.abs(targetRoll) < Math.abs(state.roll)
            ? rollOutResponse
            : rollInResponse

        const rollT = 1 - Math.exp(-activeRollResponse * dt)
        state.roll = lerp(state.roll, targetRoll, rollT)

        dynamicPitch = cruisePitch
        dynamicHeightOffset = cruiseHeightOffset
        dynamicRoll = state.roll
      } else if (phase === 'final-approach') {
        distanceProgress +=
          dt * baseDistancePerSecondBase * speedRef.current * state.speedFactor

        if (distanceProgress >= totalDistance) {
          distanceProgress = totalDistance
          phase = 'arrival-level'
          phaseElapsed = 0
        }

        current = interpolateAlongPath(
          smoothedPath,
          pathDistances,
          distanceProgress
        )

        ahead = interpolateAlongPath(
          smoothedPath,
          pathDistances,
          Math.min(distanceProgress + tangentLookAheadDistance, totalDistance)
        )

        if (!current || !ahead) {
          console.warn('⚠️ interpolazione fallita')
          state.animationId = null
          return
        }

        const approachStart = totalDistance - finalApproachDistance
        const t = easeInOut(
          (distanceProgress - approachStart) / finalApproachDistance
        )

        dynamicHeightOffset = lerp(cruiseHeightOffset, introGroundOffset, t)
        dynamicPitch = lerp(cruisePitch, groundPitch, t)

        const rollT = 1 - Math.exp(-3.0 * dt)
        state.roll = lerp(state.roll, 0, rollT)
        dynamicRoll = state.roll
      } else if (phase === 'arrival-level') {
        const t = easeInOut(phaseElapsed / arrivalLevelDuration)

        current = endPoint
        ahead = endPoint
        dynamicHeightOffset = introGroundOffset
        dynamicPitch = groundPitch

        const rollT = 1 - Math.exp(-3.0 * dt)
        state.roll = lerp(state.roll, 0, rollT)
        dynamicRoll = state.roll

        if (t >= 1) {
          phase = 'outro'
          phaseElapsed = 0
        }
      } else if (phase === 'outro') {
        const t = easeInOut(phaseElapsed / outroDuration)

        current = endPoint
        ahead = endPoint
        dynamicHeightOffset = lerp(introGroundOffset, outroHeightOffset, t)
        dynamicPitch = lerp(groundPitch, verticalPitch, t)

        const rollT = 1 - Math.exp(-3.0 * dt)
        state.roll = lerp(state.roll, 0, rollT)
        dynamicRoll = state.roll

        if (t >= 1) {
          console.log('🏁 Fine animazione')
          state.animationId = null

          if (recordEnabled) {
            stopRecording(true)
          }

          return
        }
      }

      if (!current) current = startPoint
      if (!ahead) ahead = startAheadPoint

      const destination = Cesium.Cartesian3.fromDegrees(
        current.lon,
        current.lat,
        Math.min((current.ele || 0) + dynamicHeightOffset, 4000)
      )

      const heading =
        phase === 'arrival-level' || phase === 'outro'
          ? computeHeadingRadians(endBeforePoint, endPoint)
          : computeHeadingRadians(current, ahead)

      if (onPositionChange && current) {
        onPositionChange({
          lat: current.lat,
          lon: current.lon,
          ele: current.ele || 0
        })
      }

      viewer.camera.setView({
        destination,
        orientation: {
          heading,
          pitch: dynamicPitch,
          roll: dynamicRoll
        }
      })

      state.animationId = requestAnimationFrame(tick)
    }

    const startFlightTick = () => {
      if (state.stopped) return
      state.transitioningToStart = false
      state.animationId = requestAnimationFrame(tick)
    }

    state.transitioningToStart = true

    viewer.camera.flyTo({
      destination: introStartDestination,
      orientation: {
        heading: introStartHeading,
        pitch: verticalPitch,
        roll: 0
      },
      duration: 1.6,
      easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
      complete: startFlightTick,
      cancel: () => {
        state.transitioningToStart = false
      }
    })

    return () => {
      state.transitioningToStart = false
      viewer.camera.cancelFlight()

      if (recordingActiveRef.current) {
        stopRecording(true)
      }

      if (state.animationId) {
        cancelAnimationFrame(state.animationId)
        state.animationId = null
      }
    }
  }, [
    shouldPlay,
    smoothedPath,
    pathDistances,
    recordEnabled,
    onPositionChange
  ])

  useEffect(() => {
    if (!stopSignal) return

    const state = flightRef.current
    const viewer = viewerRef.current
    const pathPositions = pathPositionsRef.current

    state.stopped = true
    state.transitioningToStart = false

    if (viewer) {
      viewer.camera.cancelFlight()
    }

    if (state.animationId) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    state.roll = 0
    state.speedFactor = 1

    if (recordingActiveRef.current) {
      stopRecording(true)
    }

    if (viewer && pathPositions) {
      flyToPathTopDown(viewer, pathPositions)
    }
  }, [stopSignal])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh'
      }}
    />
  )
}