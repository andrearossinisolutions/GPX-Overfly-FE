export function parseGpxText(gpxText) {
  console.log("📂 Parsing GPX...")

  const xml = new DOMParser().parseFromString(gpxText, "text/xml")

  const points = []

  // 🔵 1. TRACK POINTS (trkpt)
  const trkpts = xml.getElementsByTagName("trkpt")
  console.log("📊 trkpt trovati:", trkpts.length)

  for (let i = 0; i < trkpts.length; i++) {
    const el = trkpts[i]

    const lat = parseFloat(el.getAttribute("lat"))
    const lon = parseFloat(el.getAttribute("lon"))
    const ele = parseFloat(el.querySelector("ele")?.textContent || 0)

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ lat, lon, ele })
    }
  }

  // 🔵 2. ROUTE POINTS (rtept) → fallback (🔥 tuo caso)
  if (points.length === 0) {
    const rtepts = xml.getElementsByTagName("rtept")
    console.log("📊 rtept trovati:", rtepts.length)

    for (let i = 0; i < rtepts.length; i++) {
      const el = rtepts[i]

      const lat = parseFloat(el.getAttribute("lat"))
      const lon = parseFloat(el.getAttribute("lon"))
      const ele = parseFloat(el.querySelector("ele")?.textContent || 0)

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({ lat, lon, ele })
      }
    }
  }

  // 🔵 3. WAYPOINTS (wpt) → fallback estremo (alcuni GPX strani)
  if (points.length === 0) {
    const wpts = xml.getElementsByTagName("wpt")
    console.log("📊 wpt trovati:", wpts.length)

    for (let i = 0; i < wpts.length; i++) {
      const el = wpts[i]

      const lat = parseFloat(el.getAttribute("lat"))
      const lon = parseFloat(el.getAttribute("lon"))
      const ele = parseFloat(el.querySelector("ele")?.textContent || 0)

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push({ lat, lon, ele })
      }
    }
  }

  console.log("✅ Totale punti:", points.length)

  if (!points.length) {
    console.error("❌ GPX non supportato o vuoto")
    console.log("📄 XML:", xml)
    throw new Error("GPX vuoto o formato non supportato")
  }

  console.log("📍 Primo punto:", points[0])
  console.log("📍 Ultimo punto:", points[points.length - 1])

  return points
}