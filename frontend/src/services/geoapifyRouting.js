/**
 * Fetches road-following route from Geoapify Routing API.
 * Returns polyline coordinates so the map draws routes on streets, not over buildings/forests.
 * Waypoints format: lat,lon (API uses lat,lon separated by |).
 */

const ROUTING_BASE = 'https://api.geoapify.com/v1/routing'

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

  // GeoJSON FeatureCollection: features[0].geometry = MultiLineString
  // coordinates = [ [ [lon, lat], ... ], [ [lon, lat], ... ], ... ]
  const coords = []
  if (data.features && data.features[0] && data.features[0].geometry) {
    const lines = data.features[0].geometry.coordinates
    for (const line of lines) {
      for (const [lon, lat] of line) {
        coords.push([lat, lon])
      }
    }
  }

  const props = data.features?.[0]?.properties || {}
  const distance = props.distance ?? 0
  const time = props.time ?? 0

  return { coords, distance, time }
}
