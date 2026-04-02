# 🚀 GPS Overfly Preview

Web app per visualizzare una traccia GPX come un **flyover 3D animato** sopra il terreno, con camera cinematografica stile drone/flight simulator.

---

## ✨ Features

- 🗺️ Rendering 3D con **CesiumJS**
- 📍 Import GPX (`trkpt` e `rtept`)
- ✈️ Flyover automatico lungo il percorso
- 🎥 Camera dinamica:
  - orientata lungo la direzione
  - tilt in curva (banking)
  - rallentamento nelle curve
- 🌀 Curve smussate (no spigoli)
- 🎬 Intro & Outro cinematici:
  - discesa iniziale dall’alto
  - decollo progressivo
  - atterraggio e risalita finale
- 🧭 Vista automatica del percorso (fit completo)
- ⚡ Velocità regolabile:
  - `0.25x`, `0.5x`, `1x`, `2x`, `4x`
- 📌 Marker:
  - 🟢 Takeoff
  - 🔴 Landing
- 🖥️ UI overlay minimale:
  - schermata iniziale
  - controlli compatti durante playback

---

## 🧱 Tech Stack

- ⚛️ React + Vite
- 🌍 CesiumJS
- 🧮 Logica matematica custom per smoothing e camera

---

## 📦 Installazione

### 1. Clona il progetto

```bash
git clone <repo-url>
cd gps-overfly