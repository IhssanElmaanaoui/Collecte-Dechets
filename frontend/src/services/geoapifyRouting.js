/**
 * Fetches road-following route from Geoapify Routing API.
 * Returns polyline coordinates so the map draws routes on streets, not over buildings/forests.
 * Waypoints format: lat,lon (API uses lat,lon separated by |).
 */

const ROUTING_BASE = 'https://api.geoapify.com/v1/routing'
const MAX_WAYPOINTS_PER_REQUEST = 20

async function fetchRouteChunk(apiKey, waypoints, options = {}) {
  const mode = options.mode || 'drive'
  const type = options.type || 'balanced'
  const waypointsStr = waypoints.map(([lat, lon]) => `${lat},${lon}`).join('|')
  const url = `${ROUTING_BASE}?waypoints=${encodeURIComponent(waypointsStr)}&mode=${mode}&type=${type}&apiKey=${apiKey}`

  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Geoapify Routing: ${res.status} ${err}`)
  }
  const data = await res.json()

  const coords = []
  if (data.features && data.features[0] && data.features[0].geometry) {
    const lines = data.features[0].geometry.coordinates
    for (const line of lines) {
      for (const [lon, lat] of line) coords.push([lat, lon])
    }
  }

  const props = data.features?.[0]?.properties || {}
  return {
    coords,
    distance: props.distance ?? 0,
    time: props.time ?? 0,
  }
}

/**
 * @param {string} apiKey - Geoapify API key
 * @param {Array<[number, number]>} waypoints - Array of [lat, lon] (at least 2)
 * @param {object} options - { mode: 'drive'|'truck'|..., type: 'short'|'balanced' }
 * @returns {Promise<{ coords: Array<[number, number]>, distance: number, time: number }>}
 */
export async function getRouteWaypoints(apiKey, waypoints, options = {}) {
  if (!apiKey || waypoints.length < 2) {
    return { coords: [], distance: 0, time: 0 }
  }

  if (waypoints.length <= MAX_WAYPOINTS_PER_REQUEST) {
    return fetchRouteChunk(apiKey, waypoints, options)
  }

  // Long routes: split into chunks with 1-point overlap to keep continuity.
  let allCoords = []
  let totalDistance = 0
  let totalTime = 0
  let start = 0
  while (start < waypoints.length - 1) {
    const end = Math.min(start + MAX_WAYPOINTS_PER_REQUEST - 1, waypoints.length - 1)
    const chunk = waypoints.slice(start, end + 1)
    if (chunk.length < 2) break
    const part = await fetchRouteChunk(apiKey, chunk, options)
    totalDistance += part.distance
    totalTime += part.time
    if (allCoords.length > 0 && part.coords.length > 0) {
      allCoords = [...allCoords, ...part.coords.slice(1)]
    } else {
      allCoords = [...allCoords, ...part.coords]
    }
    if (end === waypoints.length - 1) break
    start = end
  }

  return { coords: allCoords, distance: totalDistance, time: totalTime }
}
