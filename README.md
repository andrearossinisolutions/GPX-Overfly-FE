# GPX Overfly Frontend

React + Vite frontend to display a GPX track as an interactive 3D flyover on a Cesium map.

It allows you to:

- upload GPX files
- view the route in 3D
- start a kinematic flyover
- adjust speed during flight
- record the flyover as a .webm video
- view VFR reporting points and airspaces from the OpenAIP proxy backend
- display a 2D mini-map during navigation

Use it directly at: <https://gpxoverfly.rossinisolutions.com/>

Feel free to contribute opening a PR!

---

## Stack

- React
- Vite
- CesiumJS

---

## Main Features

### GPX View

- GPX file parsing
- track and route point support
- route construction for 3D rendering

### 3D Flyover

- kinematic intro from above
- camera oriented along the track
- curve smoothing
- banking during turns
- slowing down during turns
- final approach and outro

### UI

- overlay Initial with file upload
- `TAKEOFF` button
- `Record` checkbox
- Compact overlay during playback
- `LAND NOW` button
- Speed ​​control with steps:
- `0.25x`
- `0.5x`
- `1x`
- `2x`
- `4x`

### Video Recording

- Recording of the Cesium canvas via `MediaRecorder`
- Automatic export at the end of the flyover
- Video file name identical to the uploaded GPX file, without the `.gpx` extension

### Aeronautical Data

- VFR reporting points from OpenAIP backend
- Airspaces uploaded via backend
- Current support for:
- CTR (`type: 4`)
- ATZ (`type: 13`)
- MATZ (`type: 14`)
- Extendable structure to add other airspace types

### 2D Mini-map

- Small track display
- Current position marker during the flyover flight

---

## Requirements

- Node.js 20+
- OpenAIP backend enabled
- Modern browser with support:
- WebGL
- MediaRecorder
- `captureStream()`

---

## Installation

```bash
npm install
```

---

## Startup

```bash
npm run dev
```

Frontend available at:

```text
http://localhost:5173
```

---

## Configuration

The frontend expects the backend to be available at:

```text
http://api.gpxoverfly.rossinisolutions.com
```

Endpoints used:

- `/api/reporting-points`
- `/api/airspaces`

If the backend is running on a different host or port, update the URLs `fetch(...)` in the code.

---

## Project Structure

```text
src/
components/
CesiumMap.jsx
MiniMap2D.jsx
utils/
parseGpx.js
buildFlightSamples.js
App.jsx
main.jsx
```

---

## Application Behavior

1. The user uploads a GPX file
2. The track is parsed and sampled
3. Cesium displays:
- route
- Takeoff / Landing
- VFR reporting points
- airspaces
4. When `TAKEOFF` is pressed:
- the camera flies to the starting point
- the flyover starts
5. If `Record` is active:
- recording starts
- the video is automatically downloaded at the end

---

## Supported airspaces

### CTR

- blue color
- 3D volume
- continuous ground outline

### ATZ / MATZ

- blue color
- 3D volume
- dotted ground outline

### P / D

- red color
- 3D volume
- solid ground outline

The styling structure is designed to be easily extended to other types.

---

## Technical Notes

- the path is smoothed only in the corners
- straights remain unchanged
- changing speed does not restart the flyover
- the camera returns to top-down view when stopped
- recording uses the current Cesium canvas resolution

---

## Roadmap

- TMA / CTA with dedicated colors
- advanced airspace labels
- airspace filtering by proximity to the track
- configurable quality video export
- frame-by-frame export
- aeronautical weather
- obstacle and terrain clearance
- mini-map with real tiles

---

## License

MIT