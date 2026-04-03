# GPX Overfly Frontend

Frontend React + Vite per visualizzare una traccia GPX come flyover 3D interattivo su mappa Cesium.

Permette di:

- caricare file GPX
- visualizzare il percorso in 3D
- avviare un flyover cinematico
- regolare la velocità durante il volo
- registrare il flyover in video `.webm`
- visualizzare reporting points VFR e airspaces da backend OpenAIP proxy
- mostrare una mini-mappa 2D durante la navigazione

---

## Stack

- React
- Vite
- CesiumJS

---

## Funzionalità principali

### Visualizzazione GPX

- parsing del file GPX
- supporto a tracce e route point
- costruzione del percorso per il rendering 3D

### Flyover 3D

- intro cinematica dall’alto
- camera orientata lungo la traccia
- smoothing delle curve
- banking in virata
- rallentamento in curva
- final approach e outro

### UI

- overlay iniziale con upload file
- pulsante `TAKEOFF`
- checkbox `Record`
- overlay compatto durante il playback
- pulsante `LAND NOW`
- controllo velocità con step:
  - `0.25x`
  - `0.5x`
  - `1x`
  - `2x`
  - `4x`

### Registrazione video

- registrazione del canvas Cesium tramite `MediaRecorder`
- export automatico a fine flyover
- nome file video uguale al file GPX caricato, senza estensione `.gpx`

### Dati aeronautici

- reporting points VFR da backend OpenAIP
- airspaces caricati via backend
- supporto attuale per:
  - CTR (`type: 4`)
  - ATZ (`type: 13`)
  - MATZ (`type: 14`)
- struttura estendibile per aggiungere altri tipi di airspace

### Mini-mappa 2D

- visualizzazione della traccia in piccolo
- marker della posizione corrente durante il volo

---

## Requisiti

- Node.js 20+
- backend OpenAIP attivo
- browser moderno con supporto:
  - WebGL
  - MediaRecorder
  - `captureStream()`

---

## Installazione

```bash
npm install
```

---

## Avvio

```bash
npm run dev
```

Frontend disponibile su:

```text
http://localhost:5173
```

---

## Configurazione

Il frontend si aspetta che il backend sia disponibile su:

```text
http://localhost:3001
```

Endpoint usati:

- `/api/reporting-points`
- `/api/airspaces`

Se il backend gira su un host o porta diversa, aggiornare gli URL `fetch(...)` nel codice.

---

## Struttura progetto

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

## Comportamento applicativo

1. L’utente carica un file GPX
2. La traccia viene parseata e campionata
3. Cesium mostra:
   - percorso
   - Takeoff / Landing
   - reporting points VFR
   - airspaces
4. Alla pressione di `TAKEOFF`:
   - la camera vola verso il punto iniziale
   - parte il flyover
5. Se `Record` è attivo:
   - parte la registrazione
   - il video viene scaricato automaticamente alla fine

---

## Airspaces supportati

### CTR

- colore blu
- volume 3D
- outline a terra continua

### ATZ / MATZ

- colore blu
- volume 3D
- outline a terra tratteggiata

### P / D

- colore rosso
- volume 3D
- outline a terra continua

La struttura styling è pensata per essere facilmente estesa ad altri tipi.

---

## Note tecniche

- il percorso è smussato solo negli angoli
- i rettilinei restano inalterati
- il cambio velocità non riavvia il flyover
- la camera torna alla vista top-down allo stop
- la registrazione usa la risoluzione corrente del canvas Cesium

---

## Roadmap

- TMA / CTA con colori dedicati
- label avanzate sugli airspaces
- filtering airspaces per vicinanza alla traccia
- esportazione video a qualità configurabile
- export frame-by-frame
- meteo aeronautico
- ostacoli e terrain clearance
- mini-mappa con tiles reali

---

## Licenza

MIT
