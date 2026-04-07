import { useEffect, useMemo, useState } from 'react'
import CesiumMap from './components/CesiumMap'
import { parseGpxText } from './utils/parseGpx'
import { buildFlightSamples } from './utils/buildFlightSamples'
import MiniMap2D from './components/MiniMap2D'

export default function App() {
  const [rawPoints, setRawPoints] = useState([])
  const [trackName, setTrackName] = useState('')
  const [playNonce, setPlayNonce] = useState(0)
  const [stopNonce, setStopNonce] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [cameraLookDirection, setCameraLookDirection] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [error, setError] = useState('')
  const [currentPoint, setCurrentPoint] = useState(null)
  const [recordEnabled, setRecordEnabled] = useState(false)
  const [interpretLastAsAlternate, setInterpretLastAsAlternate] = useState(false)
  const [recordingResult, setRecordingResult] = useState(null)
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [showSpeedPanel, setShowSpeedPanel] = useState(false)
  const [showViewPanel, setShowViewPanel] = useState(false)

  const speedOptions = [0.25, 0.5, 1, 2, 4]

  useEffect(() => {
    return () => {
      if (recordingResult?.url) {
        URL.revokeObjectURL(recordingResult.url)
      }
    }
  }, [recordingResult])

  const trackPoints = useMemo(() => {
    return buildFlightSamples(rawPoints, 1)
  }, [rawPoints])

  const resetFlightUi = () => {
    setCameraLookDirection(0)
    setShowMiniMap(false)
    setShowSpeedPanel(false)
    setShowViewPanel(false)
  }

  const toggleMiniMap = () => {
    setShowMiniMap((current) => {
      const next = !current
      if (next) {
        setShowSpeedPanel(false)
        setShowViewPanel(false)
      }
      return next
    })
  }

  const toggleSpeedPanel = () => {
    setShowSpeedPanel((current) => {
      const next = !current
      if (next) {
        setShowMiniMap(false)
        setShowViewPanel(false)
      }
      return next
    })
  }

  const toggleViewPanel = () => {
    setShowViewPanel((current) => {
      const next = !current
      if (next) {
        setShowMiniMap(false)
        setShowSpeedPanel(false)
      }
      return next
    })
  }

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
      resetFlightUi()
      setRecordingResult(null)
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Error loading GPX file')
    }
  }

  const handlePlay = () => {
    if (!trackPoints.length) {
      setError('Load a GPX file first')
      return
    }

    setError('')
    resetFlightUi()
    setRecordingResult(null)
    setHasStarted(true)
    setPlayNonce((n) => n + 1)
  }

  const handleReset = () => {
    window.location.reload()
  }

  const handleStop = () => {
    resetFlightUi()
    setStopNonce((n) => n + 1)
    setHasStarted(false)
    setCurrentPoint(null)
  }

  const handleFlightComplete = () => {
    resetFlightUi()
    setHasStarted(false)
    setCurrentPoint(null)
  }

  const handleRecordingReady = ({ blob, filename }) => {
    if (!blob || !filename) return

    setRecordingResult((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url)
      }

      return {
        blob,
        filename,
        url: URL.createObjectURL(blob)
      }
    })
  }

  const handleDownloadRecording = () => {
    if (!recordingResult?.url || !recordingResult?.filename) return

    const a = document.createElement('a')
    a.href = recordingResult.url
    a.download = recordingResult.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleCloseRecordingModal = () => {
    setRecordingResult((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url)
      }

      return null
    })
  }

  const toggleLooking = (direction) => {
    setCameraLookDirection((currentDirection) =>
      currentDirection === direction ? 0 : direction
    )
  }

  const getLookButtonStyle = (direction) => {
    const active = cameraLookDirection === direction

    return {
      padding: '10px 12px',
      borderRadius: 12,
      border: active
        ? '1px solid rgba(147, 197, 253, 0.95)'
        : '1px solid rgba(255,255,255,0.12)',
      background: active
        ? 'rgba(59, 130, 246, 0.35)'
        : 'rgba(255,255,255,0.08)',
      color: '#fff',
      fontWeight: 700,
      cursor: 'pointer',
      boxShadow: active
        ? '0 0 0 1px rgba(147, 197, 253, 0.18) inset, 0 10px 24px rgba(37, 99, 235, 0.22)'
        : 'none'
    }
  }

  const overlayCardStyle = {
    background: 'rgba(15, 23, 42, 0.5)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)'
  }

  const floatingButtonStyle = (active = false, danger = false) => ({
    minWidth: 74,
    padding: '10px 12px',
    borderRadius: 14,
    border: active
      ? '1px solid rgba(255,255,255,0.9)'
      : danger
        ? '1px solid rgba(248, 113, 113, 0.4)'
        : '1px solid rgba(255,255,255,0.12)',
    background: active
      ? 'rgba(255,255,255,0.18)'
      : danger
        ? 'rgba(127, 29, 29, 0.45)'
        : 'rgba(15, 23, 42, 0.65)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  })

  const floatingPanelStyle = {
    ...overlayCardStyle,
    width: 'min(320px, calc(100vw - 24px))',
    padding: 14
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 768px) {
          .gpx-mini-map-shift {
            position: fixed;
            right: 16px;
            bottom: 88px;
            z-index: 26;
          }
        }
      `}</style>

      <CesiumMap
        trackPoints={trackPoints}
        shouldPlay={playNonce}
        stopSignal={stopNonce}
        speed={speed}
        cameraLookDirection={cameraLookDirection}
        onPositionChange={setCurrentPoint}
        recordEnabled={recordEnabled}
        onRecordingReady={handleRecordingReady}
        onFlightComplete={handleFlightComplete}
        recordingFileName={trackName ? trackName.replace(/\.gpx$/i, '-recording.gpx') : 'recording.gpx'}
        interpretLastAsAlternate={interpretLastAsAlternate}
      />

      <div className="gpx-mini-map-shift">
        <MiniMap2D
          points={trackPoints}
          currentPoint={currentPoint}
          visible={hasStarted && showMiniMap && !showSpeedPanel && !showViewPanel && trackPoints.length > 0}
        />
      </div>

      {!hasStarted && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: !trackName ? 'center' : 'end',
            justifyContent: !trackName ? 'center' : 'start',
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
            {!trackName && (
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginBottom: 8
                  }}
                >
                  GPX Overfly
                </div>
                <div style={{ opacity: 0.5, lineHeight: 1.45 }}>
                  Load a GPX track and start the flyover.
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gap: 16
              }}
            >
              {!trackName ? (
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
                    Load GPX file
                  </label>
                  <input
                    id="gpx-file"
                    type="file"
                    accept=".gpx"
                    onChange={handleFile}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    minHeight: 22,
                    opacity: trackName ? 1 : 0.75
                  }}
                >
                  {trackName} — {trackPoints.length} points
                </div>
              )}

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

              {trackName && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginTop: 4
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      opacity: 0.9,
                      pointerEvents: trackName ? 'auto' : 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={interpretLastAsAlternate}
                      onChange={(e) => setInterpretLastAsAlternate(e.target.checked)}
                      disabled={!trackName}
                      style={{ cursor: trackName ? 'pointer' : 'not-allowed' }}
                    />
                    Last point is alternate
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      opacity: 0.9,
                      pointerEvents: trackName ? 'auto' : 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={recordEnabled}
                      onChange={(e) => setRecordEnabled(e.target.checked)}
                      disabled={!trackName}
                      style={{ cursor: trackName ? 'pointer' : 'not-allowed' }}
                    />
                    Record
                  </label>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 12
                    }}
                  >
                    <button
                      onClick={handleReset}
                      style={{
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: 'none',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Unload
                    </button>

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
                      TAKE OFF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {recordingResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(2, 6, 23, 0.55)',
            zIndex: 40
          }}
        >
          <div
            style={{
              ...overlayCardStyle,
              width: 'min(420px, calc(100vw - 32px))',
              padding: 24
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Recording completed
            </div>

            <div
              style={{
                opacity: 0.78,
                lineHeight: 1.5,
                marginBottom: 18
              }}
            >
              Your video is ready. Tap Download to save it to your device.
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10
              }}
            >
              <button
                onClick={handleCloseRecordingModal}
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
                Close
              </button>

              <button
                onClick={handleDownloadRecording}
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#fff',
                  color: '#0f172a',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {hasStarted && (
        <>
          {showSpeedPanel && (
            <div
              style={{
                position: 'fixed',
                right: 12,
                bottom: 74,
                zIndex: 30
              }}
            >
              <div style={floatingPanelStyle}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Speed</div>

                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap'
                  }}
                >
                  {speedOptions.map((option) => {
                    const active = speed === option

                    return (
                      <button
                        key={option}
                        onClick={() => setSpeed(option)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: active
                            ? '1px solid rgba(255,255,255,0.9)'
                            : '1px solid rgba(255,255,255,0.12)',
                          background: active
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          minWidth: 52
                        }}
                      >
                        {option}x
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {showViewPanel && (
            <div
              style={{
                position: 'fixed',
                right: 12,
                bottom: 74,
                zIndex: 30
              }}
            >
              <div style={floatingPanelStyle}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Window view</div>

                <div
                  style={{
                    opacity: 0.72,
                    fontSize: 13,
                    lineHeight: 1.45,
                    marginBottom: 10
                  }}
                >
                  Click a button to look 90° out the side window. Click it again to face forward.
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8
                  }}
                >
                  <button
                    onClick={() => toggleLooking(-1)}
                    style={getLookButtonStyle(-1)}
                  >
                    ◀ LOOK LEFT
                  </button>

                  <button
                    onClick={() => toggleLooking(1)}
                    style={getLookButtonStyle(1)}
                  >
                    LOOK RIGHT ▶
                  </button>
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              position: 'fixed',
              right: 12,
              bottom: 30,
              zIndex: 31,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, auto)',
              gap: 8,
              alignItems: 'center'
            }}
          >
            <button
              onClick={toggleMiniMap}
              style={floatingButtonStyle(showMiniMap && !showSpeedPanel && !showViewPanel)}
            >
              Map
            </button>

            <button
              onClick={toggleSpeedPanel}
              style={floatingButtonStyle(showSpeedPanel)}
            >
              Speed
            </button>

            <button
              onClick={toggleViewPanel}
              style={floatingButtonStyle(showViewPanel)}
            >
              View
            </button>

            <button
              onClick={handleStop}
              style={floatingButtonStyle(false, true)}
            >
              Land
            </button>
          </div>
        </>
      )}
    </div>
  )
}
