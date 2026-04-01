import { useMemo, useState } from 'react'
import GpxUploader from './components/GpxUploader'
import PlaybackControls from './components/PlaybackControls'
import CesiumMap from './components/CesiumMap'
import { parseGpxText } from './utils/parseGpx'
import { buildFlightSamples } from './utils/buildFlightSamples'

export default function App() {
  const [rawPoints, setRawPoints] = useState([])
  const [trackName, setTrackName] = useState('')
  const [playNonce, setPlayNonce] = useState(0)
  const [stopNonce, setStopNonce] = useState(0)
  const [speed, setSpeed] = useState(1)

  const trackPoints = useMemo(
    () => buildFlightSamples(rawPoints, 1),
    [rawPoints]
  )

  const handleLoaded = (text, name) => {
    const points = parseGpxText(text)
    setRawPoints(points)
    setTrackName(name)
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>GPS Overfly Preview</h1>

      <GpxUploader onLoaded={handleLoaded} />

      {trackName && (
        <p>
          <strong>Track:</strong> {trackName} — {trackPoints.length} punti
        </p>
      )}

      <PlaybackControls
        onPlay={() => setPlayNonce((n) => n + 1)}
        onStop={() => setStopNonce((n) => n + 1)}
        speed={speed}
        setSpeed={setSpeed}
      />

      <CesiumMap
        trackPoints={trackPoints}
        shouldPlay={playNonce}
        stopSignal={stopNonce}
        speed={speed}
      />
    </div>
  )
}