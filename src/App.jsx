import { useMemo, useState } from 'react'
import CesiumMap from './components/CesiumMap'
import { parseGpxText } from './utils/parseGpx'
import { buildFlightSamples } from './utils/buildFlightSamples'

export default function App() {
  const [rawPoints, setRawPoints] = useState([])
  const [trackName, setTrackName] = useState('')
  const [playNonce, setPlayNonce] = useState(0)
  const [stopNonce, setStopNonce] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [hasStarted, setHasStarted] = useState(false)
  const [error, setError] = useState('')

  const trackPoints = useMemo(() => {
    return buildFlightSamples(rawPoints, 1)
  }, [rawPoints])

  const handleFile = async (event) => {
    try {
      setError('')
      const file = event.target.files?.[0]
      if (!file) return

      const text = await file.text()
      const points = parseGpxText(text)

      setRawPoints(points)
      setTrackName(file.name)
      setHasStarted(false)
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Errore nel caricamento del GPX')
    }
  }

  const handlePlay = () => {
    if (!trackPoints.length) {
      setError('Carica prima un file GPX')
      return
    }

    setError('')
    setHasStarted(true)
    setPlayNonce((n) => n + 1)
  }

  const handleStop = () => {
    setStopNonce((n) => n + 1)
    setHasStarted(false)
  }

  const overlayCardStyle = {
    background: 'rgba(15, 23, 42, 0.82)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)'
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <CesiumMap
        trackPoints={trackPoints}
        shouldPlay={playNonce}
        stopSignal={stopNonce}
        speed={speed}
      />

      {!hasStarted && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20
          }}
        >
          <div
            style={{
              ...overlayCardStyle,
              width: 'min(560px, calc(100vw - 32px))',
              padding: 24,
              pointerEvents: 'auto'
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  marginBottom: 8
                }}
              >
                GPS Overfly Preview
              </div>
              <div style={{ opacity: 0.82, lineHeight: 1.45 }}>
                Carica una traccia GPX e avvia il flyover.
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 16
              }}
            >
              <div>
                <label
                  htmlFor="gpx-file"
                  style={{
                    display: 'inline-block',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Carica file GPX
                </label>
                <input
                  id="gpx-file"
                  type="file"
                  accept=".gpx"
                  onChange={handleFile}
                  style={{ display: 'none' }}
                />
              </div>

              <div
                style={{
                  minHeight: 22,
                  opacity: trackName ? 1 : 0.75
                }}
              >
                {trackName
                  ? `Traccia: ${trackName} — ${trackPoints.length} punti`
                  : 'Nessun file caricato'}
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  Velocità
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <input
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <div
                    style={{
                      minWidth: 48,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {speed.toFixed(1)}x
                  </div>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    color: '#fecaca',
                    background: 'rgba(127, 29, 29, 0.35)',
                    border: '1px solid rgba(248, 113, 113, 0.35)',
                    padding: '10px 12px',
                    borderRadius: 12
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 12,
                  marginTop: 4
                }}
              >
                <button
                  onClick={handlePlay}
                  disabled={!trackPoints.length}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: trackPoints.length ? '#fff' : 'rgba(255,255,255,0.25)',
                    color: '#0f172a',
                    fontWeight: 700,
                    cursor: trackPoints.length ? 'pointer' : 'not-allowed'
                  }}
                >
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasStarted && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 30
          }}
        >
          <div
            style={{
              ...overlayCardStyle,
              padding: 14,
              minWidth: 280
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 10,
                opacity: 0.95
              }}
            >
              Playback
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ marginBottom: 6, fontSize: 13, opacity: 0.9 }}>
                Velocità: {speed.toFixed(1)}x
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleStop}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}