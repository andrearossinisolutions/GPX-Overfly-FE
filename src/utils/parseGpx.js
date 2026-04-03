function parseNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function firstDirectChild(parent, tagName) {
  if (!parent) return null

  for (const child of parent.children) {
    if (child.tagName === tagName) return child
  }

  return null
}

function readTextContent(parent, tagName) {
  const el = firstDirectChild(parent, tagName)
  if (!el) return null

  const text = el.textContent?.trim()
  return text ? text : null
}

function readEle(pointEl) {
  const eleText = readTextContent(pointEl, 'ele')
  const ele = parseNumber(eleText)
  return ele ?? 0
}

function readName(pointEl) {
  return readTextContent(pointEl, 'name')
}

function readSkdLevel(pointEl) {
  const extensionsEl = firstDirectChild(pointEl, 'extensions')
  if (!extensionsEl) return null

  for (const child of extensionsEl.children) {
    const tag = child.tagName || ''

    if (tag === 'skd:level' || tag.endsWith(':level') || tag === 'level') {
      const type = child.getAttribute('type')
      const value = child.getAttribute('value')

      if (String(type || '').toUpperCase() === 'A') {
        const numericValue = parseNumber(value)

        if (Number.isFinite(numericValue)) {
          return {
            type: 'A',
            value: numericValue
          }
        }
      }
    }
  }

  return null
}

function parsePoint(pointEl, index, sourceType) {
  const lat = parseNumber(pointEl.getAttribute('lat'))
  const lon = parseNumber(pointEl.getAttribute('lon'))

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    console.warn(`⚠️ Punto ${sourceType}[${index}] senza lat/lon validi`)
    return null
  }

  const ele = readEle(pointEl)
  const name = readName(pointEl)
  const skdLevel = readSkdLevel(pointEl)

  const point = {
    lat,
    lon,
    ele,
    name: name || undefined
  }

  if (skdLevel) {
    point.levelAFeet = skdLevel.value
    point.skdLevel = skdLevel
    point.extensions = {
      'skd:level': skdLevel
    }
  }

  console.log(`🧭 ${sourceType}[${index}] parsed:`, {
    lat,
    lon,
    ele,
    name,
    levelAFeet: point.levelAFeet,
    skdLevel: point.skdLevel
  })

  return point
}

export function parseGpxText(gpxText) {
  console.log('📂 Parsing GPX...')

  const xml = new DOMParser().parseFromString(gpxText, 'text/xml')

  const parserError = xml.querySelector('parsererror')
  if (parserError) {
    console.error('❌ XML parser error:', parserError.textContent)
    throw new Error('GPX non valido')
  }

  const points = []

  const trkpts = Array.from(xml.getElementsByTagName('trkpt'))
  console.log('📊 trkpt trovati:', trkpts.length)

  for (let i = 0; i < trkpts.length; i++) {
    const point = parsePoint(trkpts[i], i, 'trkpt')
    if (point) points.push(point)
  }

  if (points.length === 0) {
    const rtepts = Array.from(xml.getElementsByTagName('rtept'))
    console.log('📊 rtept trovati:', rtepts.length)

    for (let i = 0; i < rtepts.length; i++) {
      const point = parsePoint(rtepts[i], i, 'rtept')
      if (point) points.push(point)
    }
  }

  if (points.length === 0) {
    const wpts = Array.from(xml.getElementsByTagName('wpt'))
    console.log('📊 wpt trovati:', wpts.length)

    for (let i = 0; i < wpts.length; i++) {
      const point = parsePoint(wpts[i], i, 'wpt')
      if (point) points.push(point)
    }
  }

  console.log('✅ Totale punti:', points.length)

  if (!points.length) {
    console.error('❌ GPX non supportato o vuoto')
    console.log('📄 XML:', xml)
    throw new Error('GPX vuoto o formato non supportato')
  }

  console.log('📍 Primo punto:', points[0])
  console.log('📍 Ultimo punto:', points[points.length - 1])

  const pointsWithAltitude = points.filter((p) => Number.isFinite(p.levelAFeet))
  console.log('🛫 Punti con altitude dichiarata:', pointsWithAltitude.length)

  if (pointsWithAltitude.length) {
    console.log('🛫 Sample altitude dichiarata:', {
      first: pointsWithAltitude[0].levelAFeet,
      last: pointsWithAltitude[pointsWithAltitude.length - 1].levelAFeet
    })
  } else {
    console.warn('⚠️ Nessun <skd:level type="A" ...> trovato nei punti')
  }

  return points
}