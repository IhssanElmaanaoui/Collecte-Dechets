// Données d'exemple inspirées des fichiers input_niveau*.json du cahier des charges.

import { Camion, Zone, PointCollecte, GrapheRoutier } from './models'

const CENTER_LAT = 33.5899
const CENTER_LON = -7.6039
const SCALE = 0.002

/** Convert abstract (x, y) from PDF model to (lat, lon) for map display and Geoapify. */
export function xyToLatLon(x, y) {
  return [CENTER_LAT + y * SCALE, CENTER_LON + x * SCALE]
}

/** Inverse: (lat, lon) → (x, y) for building graphe from map-placed points. */
export function latLonToXy(lat, lon) {
  const y = (lat - CENTER_LAT) / SCALE
  const x = (lon - CENTER_LON) / SCALE
  return { x, y }
}

/**
 * Build a GrapheRoutier from map state. Depot = id 0, collection points = 1..n, decharge = n+1 (if provided).
 * If no depot or no points, returns null (caller should use buildSampleGraphe).
 */
export function buildGrapheFromMapState(depot, collectionPoints, decharge = null) {
  if (!depot || !Array.isArray(collectionPoints) || collectionPoints.length === 0) return null
  const graphe = new GrapheRoutier()
  const [depotLat, depotLon] = depot
  const { x: dx, y: dy } = latLonToXy(depotLat, depotLon)
  graphe.ajouterSommet(new PointCollecte(0, dx, dy, 'Dépôt'))
  collectionPoints.forEach((p, i) => {
    const id = i + 1
    const { x, y } = latLonToXy(p.lat, p.lon)
    graphe.ajouterSommet(new PointCollecte(id, x, y, p.nom || `Point ${id}`))
  })
  let ids = [0, ...collectionPoints.map((_, i) => i + 1)]
  if (decharge && Array.isArray(decharge) && decharge.length >= 2) {
    const dechargeId = collectionPoints.length + 1
    const { x, y } = latLonToXy(decharge[0], decharge[1])
    graphe.ajouterSommet(new PointCollecte(dechargeId, x, y, 'Décharge'))
    ids = [...ids, dechargeId]
  }
  ids.forEach((id1) => {
    ids.forEach((id2) => {
      if (id1 < id2) graphe.ajouterArete(id1, id2)
    })
  })
  return graphe
}

/** Build default zones (one per collection point) for use with custom graphe. Uses point.poids as volume_estime. */
export function buildZonesFromCollectionPoints(collectionPoints) {
  if (!Array.isArray(collectionPoints) || collectionPoints.length === 0) return []
  return collectionPoints.map((p, i) => {
    const id = i + 1
    const { x, y } = latLonToXy(p.lat, p.lon)
    const volume = typeof p.poids === 'number' ? p.poids : 1000
    return new Zone(id, [id], volume, x, y)
  })
}

export function buildSampleGraphe() {
  const graphe = new GrapheRoutier()

  const depot = new PointCollecte(0, 0, 0, 'Dépôt central')
  const p1 = new PointCollecte(1, 2.5, 3.1, 'Quartier Nord')
  const p2 = new PointCollecte(2, 5.2, 4.8, 'Centre Ville')
  const p3 = new PointCollecte(3, 7.8, 1.2, 'Zone industrielle')
  const p4 = new PointCollecte(4, 4.0, 2.0, 'Point 4')
  const p5 = new PointCollecte(5, 6.0, 5.5, 'Point 5')

  ;[depot, p1, p2, p3, p4, p5].forEach((p) => graphe.ajouterSommet(p))

  graphe.ajouterArete(0, 1)
  graphe.ajouterArete(1, 2, 4.2)
  graphe.ajouterArete(2, 3)
  graphe.ajouterArete(0, 3)
  graphe.ajouterArete(0, 4)
  graphe.ajouterArete(4, 2)
  graphe.ajouterArete(2, 5)
  graphe.ajouterArete(5, 1)

  return graphe
}

export function buildSampleCamionsZones(graphe) {
  const camions = [
    new Camion(1, 6000, 200, [1, 2, 3], { x: 0, y: 0 }),
    new Camion(2, 5000, 180, [2, 3], { x: 0, y: 0 }),
  ]

  const zones = [
    new Zone(1, [1], 1200, 2.5, 3.1),
    new Zone(2, [2], 1800, 5.2, 4.8),
    new Zone(3, [3], 2600, 7.8, 1.2),
  ]

  return { camions, zones }
}

