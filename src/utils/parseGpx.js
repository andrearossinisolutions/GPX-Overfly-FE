import GPXParser from 'gpxparser'

export function parseGpxText(gpxText) {
  const parser = new GPXParser()
  parser.parse(gpxText)

  const points = []

  for (const track of parser.tracks || []) {
    for (const segment of track.points || []) {
      points.push({
        lat: segment.lat,
        lon: segment.lon,
        ele: Number.isFinite(segment.ele) ? segment.ele : 0,
        time: segment.time || null
      })
    }
  }

  if (!points.length) {
    throw new Error('Nessun punto traccia trovato nel GPX')
  }

  return points
}