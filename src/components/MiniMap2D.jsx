import { useMemo } from 'react'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default function MiniMap2D({
  points,
  currentPoint,
  visible = true
}) {
  const { pathD, current, start, end } = useMemo(() => {
    if (!points?.length) {
      return {
        pathD: '',
        current: null,
        start: null,
        end: null
      }
    }

    const width = 220
    const height = 220
    const padding = 18

    const lons = points.map((p) => p.lon)
    const lats = points.map((p) => p.lat)

    const minLon = Math.min(...lons)
    const maxLon = Math.max(...lons)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)

    const lonSpan = Math.max(maxLon - minLon, 1e-9)
    const latSpan = Math.max(maxLat - minLat, 1e-9)

    const usableW = width - padding * 2
    const usableH = height - padding * 2

    const scale = Math.min(usableW / lonSpan, usableH / latSpan)

    const offsetX = (width - lonSpan * scale) / 2
    const offsetY = (height - latSpan * scale) / 2

    const project = (p) => {
      const x = offsetX + (p.lon - minLon) * scale
      const y = height - (offsetY + (p.lat - minLat) * scale)
      return {
        x: clamp(x, 0, width),
        y: clamp(y, 0, height)
      }
    }

    const projected = points.map(project)

    const d = projected
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ')

    return {
      pathD: d,
      current: currentPoint ? project(currentPoint) : null,
      start: project(points[0]),
      end: project(points[points.length - 1])
    }
  }, [points, currentPoint])

  if (!visible || !points?.length) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 74,
        zIndex: 35,
        width: 220,
        height: 220,
        borderRadius: 18,
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }}
    >
      <svg
        viewBox="0 0 220 220"
        width="220"
        height="220"
        style={{ display: 'block' }}
      >
        <rect x="0" y="0" width="220" height="220" fill="transparent" />

        <path
          d={pathD}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {start && (
          <circle
            cx={start.x}
            cy={start.y}
            r="5"
            fill="#22c55e"
            stroke="black"
            strokeWidth="1.5"
          />
        )}

        {end && (
          <circle
            cx={end.x}
            cy={end.y}
            r="5"
            fill="#ef4444"
            stroke="black"
            strokeWidth="1.5"
          />
        )}

        {current && (
          <>
            <circle
              cx={current.x}
              cy={current.y}
              r="8"
              fill="rgba(56,189,248,0.18)"
            />
            <circle
              cx={current.x}
              cy={current.y}
              r="4.5"
              fill="#38bdf8"
              stroke="white"
              strokeWidth="1.5"
            />
          </>
        )}
      </svg>
    </div>
  )
}