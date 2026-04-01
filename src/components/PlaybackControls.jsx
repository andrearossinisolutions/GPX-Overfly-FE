export default function PlaybackControls({
  onPlay,
  onStop,
  speed,
  setSpeed
}) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={onPlay}>Play flyover</button>
      <button onClick={onStop}>Stop</button>

      <label>
        Speed:
        <input
          type="range"
          min="0.5"
          max="8"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        {speed}x
      </label>
    </div>
  )
}