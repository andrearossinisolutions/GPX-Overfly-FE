export function buildFlightSamples(points, step = 1) {
  const sampled = []

  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i])
  }

  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1])
  }

  return sampled
}