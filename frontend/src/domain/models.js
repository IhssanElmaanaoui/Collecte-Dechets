// Domain models for the 5 niveaux described in the PDF.
// Pure frontend (no backend) implementations, designed to be used by React components.

// ---------- Niveau 1 : Graphe routier ----------

export class PointCollecte {
  constructor(id_point, x, y, nom = '') {
    this.id = id_point
    this.x = x
    this.y = y
    this.nom = nom
  }

  distanceVers(autrePoint) {
    const dx = this.x - autrePoint.x
    const dy = this.y - autrePoint.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}

export class GrapheRoutier {
  constructor() {
    this.sommets = new Map() // id -> PointCollecte
    this.aretes = new Map() // "id1-id2" -> distance
  }

  ajouterSommet(point) {
    this.sommets.set(point.id, point)
  }

  _key(id1, id2) {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`
  }

  ajouterArete(id1, id2, distance = null) {
    const p1 = this.sommets.get(id1)
    const p2 = this.sommets.get(id2)
    if (!p1 || !p2) return
    const d = distance ?? p1.distanceVers(p2)
    const key = this._key(id1, id2)
    this.aretes.set(key, d)
  }

  voisins(id) {
    const res = []
    for (const [key, d] of this.aretes.entries()) {
      const [a, b] = key.split('-').map(Number)
      if (a === id) res.push({ id: b, distance: d })
      else if (b === id) res.push({ id: a, distance: d })
    }
    return res
  }

  plusCourtChemin(depart, arrivee) {
    // Dijkstra classique, retourne { distance, chemin }
    const distances = new Map()
    const precedent = new Map()
    const visite = new Set()

    for (const id of this.sommets.keys()) {
      distances.set(id, Infinity)
    }
    distances.set(depart, 0)

    const getMinNonVisite = () => {
      let minId = null
      let minDist = Infinity
      for (const [id, d] of distances.entries()) {
        if (!visite.has(id) && d < minDist) {
          minDist = d
          minId = id
        }
      }
      return minId
    }

    let courant = getMinNonVisite()
    while (courant !== null) {
      if (courant === arrivee) break
      visite.add(courant)
      for (const { id: v, distance } of this.voisins(courant)) {
        if (visite.has(v)) continue
        const nv = distances.get(courant) + distance
        if (nv < distances.get(v)) {
          distances.set(v, nv)
          precedent.set(v, courant)
        }
      }
      courant = getMinNonVisite()
    }

    const distance = distances.get(arrivee)
    if (!isFinite(distance)) {
      return { distance: Infinity, chemin: [] }
    }

    const chemin = []
    let cur = arrivee
    while (cur !== undefined) {
      chemin.unshift(cur)
      cur = precedent.get(cur)
    }

    return { distance, chemin }
  }

  matriceDistances() {
    const ids = Array.from(this.sommets.keys()).sort((a, b) => a - b)
    const n = ids.length
    const matrix = Array.from({ length: n }, () => Array(n).fill(0))
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        if (i === j) {
          matrix[i][j] = 0
        } else {
          const { distance } = this.plusCourtChemin(ids[i], ids[j])
          matrix[i][j] = distance
        }
      }
    }
    return { ids, matrix }
  }

  /**
   * Tournée optimale (TSP) qui parcourt tous les points une fois et revient au dépôt.
   * Pour n ≤ 16 : Held-Karp (exact). Sinon : plus proche voisin + 2-opt (heuristique).
   * Retourne { tour: number[], distance: number } (tour inclut le dépôt en tête et en queue).
   */
  tourneeOptimaleTSP() {
    const ids = Array.from(this.sommets.keys()).sort((a, b) => a - b)
    const n = ids.length
    if (n <= 1) return { tour: ids.length ? [ids[0], ids[0]] : [], distance: 0 }

    const dist = (i, j) => {
      if (i === j) return 0
      const { distance } = this.plusCourtChemin(ids[i], ids[j])
      return distance
    }

    const MAX_EXACT = 8
    if (n <= MAX_EXACT) {
      return this._heldKarpTSP(ids, n, dist)
    }
    return this._heuristiqueTSP(ids, n, dist)
  }

  _heldKarpTSP(ids, n, dist) {
    const full = (1 << n) - 1
    const key = (mask, i) => `${mask},${i}`
    const dp = new Map()
    const prev = new Map()
    dp.set(key(1 << 0, 0), 0)
    for (let mask = 1; mask <= full; mask += 1) {
      if (!(mask & 1)) continue
      for (let i = 0; i < n; i += 1) {
        if (!(mask & (1 << i))) continue
        if (mask === (1 << 0) && i === 0) continue
        let best = Infinity
        let bestJ = -1
        const maskSansI = mask ^ (1 << i)
        for (let j = 0; j < n; j += 1) {
          if (!(maskSansI & (1 << j))) continue
          const d = dp.get(key(maskSansI, j)) + dist(j, i)
          if (d < best) {
            best = d
            bestJ = j
          }
        }
        if (bestJ >= 0 && isFinite(best)) {
          dp.set(key(mask, i), best)
          prev.set(key(mask, i), bestJ)
        }
      }
    }
    let total = Infinity
    let last = -1
    for (let i = 1; i < n; i += 1) {
      const d = dp.get(key(full, i)) + dist(i, 0)
      if (d < total) {
        total = d
        last = i
      }
    }
    if (last < 0) return { tour: [ids[0], ids[0]], distance: 0 }
    const path = [last]
    let mask = full
    let cur = last
    while (true) {
      const p = prev.get(key(mask, cur))
      if (p === undefined) break
      mask = mask ^ (1 << cur)
      path.push(p)
      cur = p
    }
    path.reverse()
    const tour = [ids[0], ...path.map((idx) => ids[idx]), ids[0]]
    return { tour, distance: total }
  }

  _heuristiqueTSP(ids, n, dist) {
    const depotIdx = 0
    const nonDepot = Array.from({ length: n }, (_, i) => i).filter((i) => i !== depotIdx)
    let tour = [depotIdx]
    let rest = new Set(nonDepot)
    let cur = depotIdx
    while (rest.size > 0) {
      let best = -1
      let bestD = Infinity
      for (const i of rest) {
        const d = dist(cur, i)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      if (best < 0) break
      tour.push(best)
      rest.delete(best)
      cur = best
    }
    tour.push(depotIdx)
    tour = this._twoOptTSP(tour, dist)
    const distance = this._tourDistance(tour, dist)
    return { tour: tour.map((i) => ids[i]), distance }
  }

  _tourDistance(tourIndices, dist) {
    let d = 0
    for (let i = 0; i < tourIndices.length - 1; i += 1) {
      d += dist(tourIndices[i], tourIndices[i + 1])
    }
    return d
  }

  _twoOptTSP(tourIndices, dist) {
    const n = tourIndices.length
    let improved = true
    let tour = [...tourIndices]
    while (improved) {
      improved = false
      for (let i = 1; i < n - 2; i += 1) {
        for (let k = i + 1; k < n - 1; k += 1) {
          const rev = [...tour.slice(0, i), ...tour.slice(i, k + 1).reverse(), ...tour.slice(k + 1)]
          if (this._tourDistance(rev, dist) < this._tourDistance(tour, dist) - 1e-9) {
            tour = rev
            improved = true
          }
        }
      }
    }
    return tour
  }
}

// ---------- Niveau 2 : Affectation Camion ↔ Zone ----------

export class Camion {
  constructor(id_camion, capacite, cout_fixe, zones_accessibles = [], position_initiale = { x: 0, y: 0 }) {
    this.id = id_camion
    this.capacite = capacite
    this.cout_fixe = cout_fixe
    this.zones_accessibles = zones_accessibles
    this.charge_actuelle = 0
    this.position_initiale = position_initiale
  }
}

export class Zone {
  constructor(id_zone, points, volume_estime, centre_x, centre_y) {
    this.id = id_zone
    this.points = points
    this.volume_estime = volume_estime
    this.centre = { x: centre_x, y: centre_y }
  }
}

export class AffectateurBiparti {
  constructor(camions, zones, graphe) {
    this.camions = camions
    this.zones = zones
    this.graphe = graphe
  }

  calculerCoutAffectation(camionId, zoneId) {
    const camion = this.camions.find((c) => c.id === camionId)
    const zone = this.zones.find((z) => z.id === zoneId)
    if (!camion || !zone) return Infinity

    // Coût = distance centre_zone ↔ dépôt (id 0) + coût fixe pondéré par volume
    const depotId = 0
    const centrePointId = zone.points[0] ?? depotId
    const { distance } = this.graphe.plusCourtChemin(depotId, centrePointId)
    const coutVolume = zone.volume_estime / Math.max(camion.capacite, 1)
    return distance + camion.cout_fixe * 0.01 + coutVolume
  }

  affectationGloutonne() {
    const affectation = new Map() // camionId -> array zoneIds
    for (const camion of this.camions) {
      affectation.set(camion.id, [])
    }

    // Zones triées par volume décroissant (prioriser grosses zones)
    const zonesTriees = [...this.zones].sort((a, b) => b.volume_estime - a.volume_estime)

    for (const zone of zonesTriees) {
      let meilleurCamion = null
      let meilleurCout = Infinity

      for (const camion of this.camions) {
        if (camion.zones_accessibles.length && !camion.zones_accessibles.includes(zone.id)) {
          continue
        }

        const chargeApres = camion.charge_actuelle + zone.volume_estime
        if (chargeApres > camion.capacite) continue

        const cout = this.calculerCoutAffectation(camion.id, zone.id)
        if (cout < meilleurCout) {
          meilleurCout = cout
          meilleurCamion = camion
        }
      }

      if (meilleurCamion) {
        meilleurCamion.charge_actuelle += zone.volume_estime
        affectation.get(meilleurCamion.id).push(zone.id)
      }
    }

    return affectation
  }

  verifierContraintes(affectation) {
    for (const camion of this.camions) {
      const zonesIds = affectation.get(camion.id) ?? []
      let totalVolume = 0
      for (const zid of zonesIds) {
        const zone = this.zones.find((z) => z.id === zid)
        if (!zone) continue
        if (camion.zones_accessibles.length && !camion.zones_accessibles.includes(zone.id)) {
          return false
        }
        totalVolume += zone.volume_estime
      }
      if (totalVolume > camion.capacite) return false
    }
    return true
  }

  equilibrageCharges(affectation) {
    // Stratégie très simple : retourne l’affectation telle quelle mais permet
    // d’ajouter des règles d’équilibrage plus poussées si besoin.
    return affectation
  }
}

// ---------- Niveau 3 : Planification temporelle ----------

export class CreneauHoraire {
  constructor(id_creneau, debut, fin, jour, cout_congestion = 1.0) {
    this.id = id_creneau
    this.debut = debut
    this.fin = fin
    this.jour = jour
    this.cout_congestion = cout_congestion
  }

  dureeHeures() {
    const [h1, m1] = this.debut.split(':').map(Number)
    const [h2, m2] = this.fin.split(':').map(Number)
    return (h2 * 60 + m2 - (h1 * 60 + m1)) / 60
  }
}

export class ContrainteTemporelle {
  constructor() {
    this.fenetresZone = new Map() // zoneId -> { debut, fin }
    this.pausesCamion = new Map() // camionId -> [ { debut, fin } ]
    this.congestion = new Map() // `${zoneId}-${creneauId}` -> niveau
  }

  estRealisable(camionId, zoneId, creneau) {
    // Vérifie fenêtre de la zone
    const fenetre = this.fenetresZone.get(zoneId)
    if (fenetre) {
      if (!(creneau.debut >= fenetre.debut && creneau.fin <= fenetre.fin)) {
        return false
      }
    }

    // Vérifie chevauchement avec les pauses du camion (approche simplifiée)
    const pauses = this.pausesCamion.get(camionId) || []
    for (const p of pauses) {
      if (!(creneau.fin <= p.debut || creneau.debut >= p.fin)) {
        return false
      }
    }
    return true
  }

  calculerPenalite(camionId, zoneId, creneau) {
    const key = `${zoneId}-${creneau.id}`
    const niveau = this.congestion.get(key) ?? 1.0
    return niveau * creneau.dureeHeures()
  }
}

export class PlanificateurTriparti {
  constructor(affectateur, contraintes) {
    this.affectateur = affectateur
    this.contraintes = contraintes
  }

  genererPlanHebdomadaire(creneaux, horizonJours = 5) {
    // Plan très simple: pour chaque zone affectée à un camion, on lui assigne
    // le premier créneau réalisable du jour correspondant.
    const affectation = this.affectateur.affectationGloutonne()
    const plan = {}

    for (const c of creneaux) {
      if (!plan[c.jour]) plan[c.jour] = []
    }

    for (const camion of this.affectateur.camions) {
      const zonesIds = affectation.get(camion.id) ?? []
      for (const zoneId of zonesIds) {
        const creneau = creneaux.find((c) =>
          this.contraintes.estRealisable(camion.id, zoneId, c),
        )
        if (!creneau) continue
        plan[creneau.jour].push({
          camionId: camion.id,
          zoneId,
          creneauId: creneau.id,
        })
      }
    }

    return plan
  }
}

// ---------- Niveau 4 : VRP enrichi ----------

export class Tournee {
  constructor(camionId, points = []) {
    this.camionId = camionId
    this.points = points // liste ordonnée d’IDs de points (incluant dépôt 0)
  }

  calculerDistance(graphe) {
    let total = 0
    for (let i = 0; i < this.points.length - 1; i += 1) {
      const { distance } = graphe.plusCourtChemin(this.points[i], this.points[i + 1])
      total += distance
    }
    return total
  }
}

export class OptimiseurVRP {
  constructor(graphe, camions) {
    this.graphe = graphe
    this.camions = camions
  }

  _distanceTotal(sequence) {
    let total = 0
    for (let i = 0; i < sequence.length - 1; i += 1) {
      const { distance } = this.graphe.plusCourtChemin(sequence[i], sequence[i + 1])
      total += distance
    }
    return total
  }

  _getPointCoords(pointId) {
    const p = this.graphe.sommets.get(pointId)
    return p ? { x: p.x, y: p.y } : null
  }

  /**
   * Paradigme 1 : Clustering Sweep — tri par angle autour du dépôt, segments contigus.
   * phaseOffset : angle de départ (en indice) pour la première frontière (0 = équilibré par défaut).
   * Retourne K clusters compacts (un par camion).
   */
  _sweepClustering(depotId, pointIds, K, phaseOffset = 0) {
    const depot = this._getPointCoords(depotId)
    if (!depot || pointIds.length === 0) return [pointIds]
    const withAngle = pointIds.map((pid) => {
      const c = this._getPointCoords(pid)
      if (!c) return { pid, angle: 0 }
      const angle = Math.atan2(c.y - depot.y, c.x - depot.x)
      return { pid, angle }
    })
    withAngle.sort((a, b) => a.angle - b.angle)
    const n = withAngle.length
    const clusters = Array.from({ length: K }, () => [])
    const baseSize = Math.floor(n / K)
    const remainder = n % K
    let idx = (phaseOffset % n + n) % n
    for (let k = 0; k < K; k += 1) {
      const count = baseSize + (k < remainder ? 1 : 0)
      for (let j = 0; j < count; j += 1) {
        clusters[k].push(withAngle[idx % n].pid)
        idx += 1
      }
    }
    return clusters
  }

  /**
   * Paradigme 1 : Clarke-Wright Savings — heuristique classique VRP (EcoRoute / CVRP).
   * s(i,j) = d(depot,i) + d(depot,j) - d(i,j) ; fusion des routes par économies décroissantes.
   */
  _clarkeWrightClustering(depotId, pointIds, K) {
    if (pointIds.length === 0 || K <= 0) return [pointIds]
    if (K === 1) return [pointIds]

    const d = (a, b) => this.graphe.plusCourtChemin(a, b).distance
    const savings = []
    for (let i = 0; i < pointIds.length; i += 1) {
      for (let j = i + 1; j < pointIds.length; j += 1) {
        const pi = pointIds[i]
        const pj = pointIds[j]
        const s = d(depotId, pi) + d(depotId, pj) - d(pi, pj)
        savings.push({ i: pi, j: pj, s })
      }
    }
    savings.sort((a, b) => b.s - a.s)

    const routeOf = new Map()
    const routes = []
    pointIds.forEach((pid) => {
      const route = { points: [pid] }
      routes.push(route)
      routeOf.set(pid, route)
    })

    let nRoutes = routes.length
    for (const { i, j } of savings) {
      if (nRoutes <= K) break
      const ri = routeOf.get(i)
      const rj = routeOf.get(j)
      if (!ri || !rj || ri === rj) continue

      const seqI = [...ri.points]
      const seqJ = [...rj.points]
      const idxI = seqI.indexOf(i)
      const idxJ = seqJ.indexOf(j)
      if (idxI < 0 || idxJ < 0) continue

      const partI = idxI === 0 ? [...seqI].reverse() : seqI
      const partJ = idxJ === seqJ.length - 1 ? [...seqJ].reverse() : seqJ
      const merged = [...partI, ...partJ]

      const newRoute = { points: merged }
      routes.splice(routes.indexOf(ri), 1)
      routes.splice(routes.indexOf(rj), 1)
      routes.push(newRoute)
      merged.forEach((p) => routeOf.set(p, newRoute))
      nRoutes = routes.length
    }

    while (routes.length > K) {
      let bestA = 0
      let bestB = 1
      let bestS = -Infinity
      for (let a = 0; a < routes.length; a += 1) {
        for (let b = a + 1; b < routes.length; b += 1) {
          const ra = routes[a].points
          const rb = routes[b].points
          if (ra.length === 0 || rb.length === 0) continue
          const i = ra[ra.length - 1]
          const j = rb[0]
          const s = d(depotId, i) + d(depotId, j) - d(i, j)
          if (s > bestS) {
            bestS = s
            bestA = a
            bestB = b
          }
        }
      }
      const ra = routes[bestA].points
      const rb = routes[bestB].points
      const merged = { points: [...ra, ...rb] }
      routes.splice(Math.max(bestA, bestB), 1)
      routes.splice(Math.min(bestA, bestB), 1)
      routes.push(merged)
      merged.points.forEach((p) => routeOf.set(p, merged))
    }

    while (routes.length < K) {
      routes.push({ points: [] })
    }
    return routes.slice(0, K).map((r) => r.points)
  }

  /**
   * Paradigme 1 : Clustering K-means géographique — K = nombre de camions.
   * Initialisation K-means++ (centroïdes éloignés) pour clusters compacts.
   */
  _kMeansClustering(depotId, pointIds, K) {
    const depot = this._getPointCoords(depotId)
    if (!depot || pointIds.length === 0 || K <= 0) return [pointIds]
    if (K === 1) return [pointIds]

    const points = pointIds.map((pid) => {
      const c = this._getPointCoords(pid)
      return { pid, x: c?.x ?? 0, y: c?.y ?? 0 }
    })

    const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

    // K-means++ : premier centroïde = point le plus éloigné du dépôt, puis choisir les suivants avec proba ∝ D²
    const centroids = []
    const first = points.reduce((best, p) =>
      dist2(p, depot) > dist2(best, depot) ? p : best
    )
    centroids.push({ x: first.x, y: first.y })
    for (let k = 1; k < K; k += 1) {
      const D2 = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))))
      const bestIdx = D2.reduce((best, d, i) => (d > D2[best] ? i : best), 0)
      centroids.push({ x: points[bestIdx].x, y: points[bestIdx].y })
    }

    let assignments = points.map(() => 0)
    for (let iter = 0; iter < 80; iter += 1) {
      const newAssignments = points.map((pt) => {
        let bestK = 0
        let bestD = Infinity
        for (let k = 0; k < K; k += 1) {
          const c = centroids[k]
          const d = (pt.x - c.x) ** 2 + (pt.y - c.y) ** 2
          if (d < bestD) {
            bestD = d
            bestK = k
          }
        }
        return bestK
      })
      let changed = false
      for (let i = 0; i < points.length; i += 1) {
        if (newAssignments[i] !== assignments[i]) changed = true
      }
      assignments = newAssignments
      if (!changed) break

      // Mise à jour des centroïdes
      const sums = Array.from({ length: K }, () => ({ x: 0, y: 0, count: 0 }))
      points.forEach((pt, i) => {
        const k = assignments[i]
        sums[k].x += pt.x
        sums[k].y += pt.y
        sums[k].count += 1
      })
      for (let k = 0; k < K; k += 1) {
        if (sums[k].count > 0) {
          centroids[k].x = sums[k].x / sums[k].count
          centroids[k].y = sums[k].y / sums[k].count
        }
      }
    }

    const clusters = Array.from({ length: K }, () => [])
    points.forEach((pt, i) => clusters[assignments[i]].push(pt.pid))
    return clusters
  }

  /**
   * Paradigme 2 : Nearest Neighbor — tournée initiale gloutonne par cluster.
   */
  _nearestNeighborTour(depotId, pointIdsSansDepot, dechargeId = null, firstPoint = null) {
    const nonVisites = new Set(pointIdsSansDepot)
    const tour = [depotId]
    let courant = depotId
    if (firstPoint != null && nonVisites.has(firstPoint)) {
      tour.push(firstPoint)
      nonVisites.delete(firstPoint)
      courant = firstPoint
    }
    while (nonVisites.size > 0) {
      let meilleur = null
      let meilleurDist = Infinity
      for (const pid of nonVisites) {
        const { distance } = this.graphe.plusCourtChemin(courant, pid)
        if (distance < meilleurDist) {
          meilleurDist = distance
          meilleur = pid
        }
      }
      if (meilleur === null) break
      tour.push(meilleur)
      nonVisites.delete(meilleur)
      courant = meilleur
    }
    if (dechargeId != null) {
      tour.push(dechargeId)
      return tour
    }
    tour.push(depotId)
    return tour
  }

  /**
   * Cheapest Insertion : insertion au meilleur coût (heuristique TSP type EcoRoute).
   */
  _cheapestInsertionTour(depotId, pointIds, dechargeId) {
    if (pointIds.length === 0) {
      return dechargeId != null ? [depotId, dechargeId] : [depotId, depotId]
    }
    const d = (a, b) => this.graphe.plusCourtChemin(a, b).distance
    const first = pointIds.reduce((best, p) => (d(depotId, p) < d(depotId, best) ? p : best))
    let tour = dechargeId != null ? [depotId, first] : [depotId, first, depotId]
    let rest = new Set(pointIds.filter((p) => p !== first))

    while (rest.size > 0) {
      let bestP = null
      let bestPos = -1
      let bestAdd = Infinity
      for (const p of rest) {
        for (let i = 0; i < tour.length - 1; i += 1) {
          const add = d(tour[i], p) + d(p, tour[i + 1]) - d(tour[i], tour[i + 1])
          if (add < bestAdd - 1e-9) {
            bestAdd = add
            bestP = p
            bestPos = i + 1
          }
        }
      }
      if (bestP === null) break
      tour.splice(bestPos, 0, bestP)
      rest.delete(bestP)
    }

    if (dechargeId != null) {
      tour.push(dechargeId)
    }
    return tour
  }

  _construireTourneeCluster(depotId, clusterPoints, dechargeId, camionId) {
    if (clusterPoints.length === 0) {
      const tour = dechargeId != null ? [depotId, dechargeId] : [depotId, depotId]
      return new Tournee(camionId, tour)
    }
    let bestTour = this._nearestNeighborTour(depotId, clusterPoints, dechargeId)
    let bestDist = this._distanceTotal(bestTour)

    const ciTour = this._cheapestInsertionTour(depotId, clusterPoints, dechargeId)
    if (this._distanceTotal(ciTour) < bestDist - 1e-9) {
      bestTour = ciTour
      bestDist = this._distanceTotal(ciTour)
    }

    const sortedByDist = [...clusterPoints].sort((a, b) => {
      const da = this.graphe.plusCourtChemin(depotId, a).distance
      const db = this.graphe.plusCourtChemin(depotId, b).distance
      return da - db
    })
    for (const first of sortedByDist.slice(0, Math.min(5, clusterPoints.length))) {
      const tour = this._nearestNeighborTour(depotId, clusterPoints, dechargeId, first)
      const dist = this._distanceTotal(tour)
      if (dist < bestDist - 1e-9) {
        bestDist = dist
        bestTour = tour
      }
    }
    return new Tournee(camionId, bestTour)
  }

  /**
   * Paradigme 3 : Recherche locale — 2-opt et Or-opt.
   */
  algorithme2opt(tournee, dechargeId = null) {
    const pts = [...tournee.points]
    const n = pts.length
    const lastIdx = n - 1
    const dechargeIdx =
      dechargeId != null && n >= 1
        ? (pts[lastIdx] === dechargeId ? lastIdx : n >= 2 && pts[lastIdx - 1] === dechargeId ? lastIdx - 1 : -1)
        : -1
    const iMax = dechargeIdx >= 0 ? dechargeIdx - 2 : n - 2
    const kMax = dechargeIdx >= 0 ? dechargeIdx - 1 : n - 1
    let improved = true
    let bestDistance = this._distanceTotal(pts)

    while (improved) {
      improved = false
      for (let i = 1; i < iMax; i += 1) {
        for (let k = i + 1; k < kMax; k += 1) {
          const nouveau = [
            ...pts.slice(0, i),
            ...pts.slice(i, k + 1).reverse(),
            ...pts.slice(k + 1),
          ]
          const d = this._distanceTotal(nouveau)
          if (d < bestDistance - 1e-9) {
            bestDistance = d
            for (let idx = 0; idx < n; idx += 1) pts[idx] = nouveau[idx]
            improved = true
          }
        }
      }
    }
    return new Tournee(tournee.camionId, pts)
  }

  orOpt(tournee, segmentLen = 3, dechargeId = null) {
    let pts = [...tournee.points]
    const n = pts.length
    if (n <= 3) return new Tournee(tournee.camionId, pts)
    const dechargeAtEnd = dechargeId != null && n >= 1 && pts[n - 1] === dechargeId
    const dechargeBeforeDepot = dechargeId != null && n >= 2 && pts[n - 2] === dechargeId
    const middleEnd = dechargeAtEnd ? n - 1 : dechargeBeforeDepot ? n - 2 : n - 1
    const tail = dechargeAtEnd ? [pts[n - 1]] : dechargeBeforeDepot ? [pts[n - 2], pts[n - 1]] : [pts[n - 1]]
    let improved = true
    while (improved) {
      improved = false
      const middle = pts.slice(1, middleEnd)
      const k = middle.length
      for (let len = 1; len <= Math.min(segmentLen, k - 1); len += 1) {
        for (let i = 0; i + len <= k; i += 1) {
          const seg = middle.slice(i, i + len)
          const without = [...middle.slice(0, i), ...middle.slice(i + len)]
          for (let j = 0; j <= without.length; j += 1) {
            if (j === i) continue
            const newMiddle = [...without.slice(0, j), ...seg, ...without.slice(j)]
            const newPts = [pts[0], ...newMiddle, ...tail]
            if (this._distanceTotal(newPts) < this._distanceTotal(pts) - 1e-9) {
              pts = newPts
              improved = true
              break
            }
          }
          if (improved) break
        }
        if (improved) break
      }
    }
    return new Tournee(tournee.camionId, pts)
  }

  /**
   * 3-opt : suppression de 3 arêtes et recombinaison (supprime zigzags et croisements résistants au 2-opt).
   * Trois segments A, B, C ; on teste les 8 combinaisons (chaque segment peut être inversé).
   */
  threeOpt(tournee, dechargeId = null) {
    let pts = [...tournee.points]
    const n = pts.length
    const dechargeAtEnd = dechargeId != null && n >= 1 && pts[n - 1] === dechargeId
    const dechargeBeforeDepot = dechargeId != null && n >= 2 && pts[n - 2] === dechargeId
    const middleEnd = dechargeAtEnd ? n - 1 : dechargeBeforeDepot ? n - 2 : n - 1
    const tail = dechargeAtEnd ? [pts[n - 1]] : dechargeBeforeDepot ? [pts[n - 2], pts[n - 1]] : [pts[n - 1]]
    const middle = pts.slice(1, middleEnd)
    const L = middle.length
    if (L < 3) return new Tournee(tournee.camionId, pts)

    const eps = 1e-9
    const rev = (arr) => [...arr].reverse()
    let improved = true
    while (improved) {
      improved = false
      for (let i = 0; i < L - 2 && !improved; i += 1) {
        for (let j = i + 1; j < L - 1 && !improved; j += 1) {
          for (let k = j + 1; k < L && !improved; k += 1) {
            const A = middle.slice(0, i + 1)
            const B = middle.slice(i + 1, j + 1)
            const C = middle.slice(j + 1)
            const currentDist = this._distanceTotal(pts)
            const candidates = [
              [...A, ...B, ...C],
              [...A, ...B, ...rev(C)],
              [...A, ...rev(B), ...C],
              [...A, ...rev(B), ...rev(C)],
              [...rev(A), ...B, ...C],
              [...rev(A), ...B, ...rev(C)],
              [...rev(A), ...rev(B), ...C],
              [...rev(A), ...rev(B), ...rev(C)],
            ]
            for (const newMiddle of candidates) {
              const newPts = [pts[0], ...newMiddle, ...tail]
              if (this._distanceTotal(newPts) < currentDist - eps) {
                pts = newPts
                improved = true
                break
              }
            }
          }
        }
      }
    }
    return new Tournee(tournee.camionId, pts)
  }

  /**
   * Chaîne d'optimisation locale agressive : 2-opt → Or-opt → 2-opt → 3-opt → 2-opt.
   */
  _optimiserLocaleAgressive(tournee, dechargeId) {
    let t = tournee
    t = this.algorithme2opt(t, dechargeId)
    t = this.orOpt(t, 3, dechargeId)
    t = this.algorithme2opt(t, dechargeId)
    t = this.threeOpt(t, dechargeId)
    t = this.algorithme2opt(t, dechargeId)
    return t
  }

  /**
   * Paradigme 4 : Objectif global — affiner en déplaçant des points entre tournées
   * si la distance totale diminue (échange 1-1 ou relocalisation).
   */
  _refinementInterRoutes(tournees, dechargeId) {
    const depotId = 0
    const eps = 1e-9

    const pointsWithoutDepotDecharge = (pts) =>
      pts.filter((p) => p !== depotId && p !== dechargeId)

    const buildTour = (middle) => {
      if (dechargeId != null) return [depotId, ...middle, dechargeId]
      return [depotId, ...middle, depotId]
    }

    let current = tournees.map((t) => new Tournee(t.camionId, [...t.points]))
    let improved = true

    while (improved) {
      improved = false
      const totalBefore = current.reduce((s, t) => s + this._distanceTotal(t.points), 0)

      for (let fromIdx = 0; fromIdx < current.length && !improved; fromIdx += 1) {
        const fromTour = current[fromIdx]
        const fromMiddle = pointsWithoutDepotDecharge(fromTour.points)
        if (fromMiddle.length === 0) continue

        for (const pid of fromMiddle) {
          const newFromMiddle = fromMiddle.filter((p) => p !== pid)
          const newFromPoints = buildTour(newFromMiddle)
          if (newFromPoints.length < 3) continue

          for (let toIdx = 0; toIdx < current.length && !improved; toIdx += 1) {
            if (fromIdx === toIdx) continue
            const toTour = current[toIdx]
            const toMiddle = pointsWithoutDepotDecharge(toTour.points)

            let bestToPoints = null
            let bestTotal = Infinity

            for (let pos = 0; pos <= toMiddle.length; pos += 1) {
              const newToMiddle = [...toMiddle.slice(0, pos), pid, ...toMiddle.slice(pos)]
              const newToPoints = buildTour(newToMiddle)

              const newCurrent = current.map((t, i) => {
                if (i === fromIdx) return new Tournee(t.camionId, newFromPoints)
                if (i === toIdx) return new Tournee(t.camionId, newToPoints)
                return t
              })
              const total = newCurrent.reduce((s, t) => s + this._distanceTotal(t.points), 0)
              if (total < bestTotal - eps) {
                bestTotal = total
                bestToPoints = newToPoints
              }
            }

            if (bestToPoints && bestTotal < totalBefore - eps) {
              current = current.map((t, i) => {
                if (i === fromIdx) return new Tournee(t.camionId, newFromPoints)
                if (i === toIdx) return new Tournee(t.camionId, bestToPoints)
                return t
              })
              improved = true
              break
            }
          }
        }
      }
    }
    return current
  }

  /**
   * Optimisation principale : clustering (Sweep ou K-means) + NN + 2-opt + Or-opt.
   * Objectif global : minimiser Σ distance(camion_i).
   */
  optimiser(pointsSansDepot, dechargeId = null) {
    const nbCamions = this.camions.length
    const depotId = 0

    if (pointsSansDepot.length === 0) {
      return Array.from({ length: nbCamions }, (_, k) => {
        const camionId = this.camions[k]?.id ?? k + 1
        const tour = dechargeId != null ? [depotId, dechargeId] : [depotId, depotId]
        return new Tournee(camionId, tour)
      })
    }

    if (nbCamions <= 1) {
      const camionId = this.camions[0]?.id ?? 1
      let t = this._construireTourneeCluster(depotId, pointsSansDepot, dechargeId, camionId)
      t = this._optimiserLocaleAgressive(t, dechargeId)
      return [t]
    }

    const buildTournees = (clusters) => {
      const tournees = []
      for (let k = 0; k < nbCamions; k += 1) {
        const camionId = this.camions[k]?.id ?? k + 1
        let t = this._construireTourneeCluster(depotId, clusters[k] || [], dechargeId, camionId)
        t = this._optimiserLocaleAgressive(t, dechargeId)
        tournees.push(t)
      }
      return tournees
    }

    const totalDist = (tournees) =>
      tournees.reduce((s, t) => s + t.calculerDistance(this.graphe), 0)

    // Sweep : essayer plusieurs décalages de phase (frontière angulaire) pour minimiser la distance totale
    let bestTournees = buildTournees(this._sweepClustering(depotId, pointsSansDepot, nbCamions, 0))
    let bestTotal = totalDist(bestTournees)
    for (let phase = 1; phase < nbCamions; phase += 1) {
      const clusters = this._sweepClustering(depotId, pointsSansDepot, nbCamions, phase)
      const tournees = buildTournees(clusters)
      const total = totalDist(tournees)
      if (total < bestTotal - 1e-9) {
        bestTotal = total
        bestTournees = tournees
      }
    }

    // K-means géographique (clusters compacts)
    const kmeansTournees = buildTournees(this._kMeansClustering(depotId, pointsSansDepot, nbCamions))
    const kmeansTotal = totalDist(kmeansTournees)
    if (kmeansTotal < bestTotal - 1e-9) {
      bestTournees = kmeansTournees
      bestTotal = kmeansTotal
    }

    // Clarke-Wright Savings (heuristique EcoRoute / CVRP classique)
    const cwClusters = this._clarkeWrightClustering(depotId, pointsSansDepot, nbCamions)
    const cwTournees = buildTournees(cwClusters)
    const cwTotal = totalDist(cwTournees)
    if (cwTotal < bestTotal - 1e-9) {
      bestTournees = cwTournees
      bestTotal = cwTotal
    }

    // Paradigme optimisation globale : relocalisation + échange 2-opt entre tournées
    for (let pass = 0; pass < 2; pass += 1) {
      bestTournees = this._refinementInterRoutes(bestTournees, dechargeId)
      bestTournees = this._exchange2OptInterRoutes(bestTournees, dechargeId)
      bestTournees = bestTournees.map((t) => this._optimiserLocaleAgressive(t, dechargeId))
    }

    // Garantie : chaque point dans exactement une tournée, chaque camion a son propre ensemble de points
    bestTournees = this._garantirPartitionUnique(bestTournees, pointsSansDepot, depotId, dechargeId)

    return bestTournees
  }

  /**
   * Garantit que chaque point de collecte est dans exactement une tournée (un seul camion).
   * Corrige les doublons ou points manquants pour que chaque camion ait son chemin et ses points distincts.
   */
  _garantirPartitionUnique(tournees, pointIdsSansDepot, depotId, dechargeId) {
    const setPoints = new Set(pointIdsSansDepot)
    const pointToTournee = new Map()
    const seenInTours = new Set()

    tournees.forEach((t) => {
      const middle = t.points.filter((p) => p !== depotId && p !== dechargeId)
      middle.forEach((pid) => {
        if (setPoints.has(pid)) {
          if (pointToTournee.has(pid)) {
            seenInTours.add(pid)
          } else {
            pointToTournee.set(pid, t.camionId)
          }
        }
      })
    })

    const duplicates = [...seenInTours]
    const missing = pointIdsSansDepot.filter((pid) => !pointToTournee.has(pid))

    if (duplicates.length === 0 && missing.length === 0) {
      return tournees
    }

    const buildTour = (middle) => {
      if (dechargeId != null) return [depotId, ...middle, dechargeId]
      return [depotId, ...middle, depotId]
    }

    const result = tournees.map((t) => ({
      camionId: t.camionId,
      middle: t.points.filter((p) => p !== depotId && p !== dechargeId),
    }))

    duplicates.forEach((pid) => {
      const camionIds = result
        .map((r, idx) => ({ idx, camionId: r.camionId, middle: r.middle }))
        .filter((r) => r.middle.includes(pid))
      if (camionIds.length > 1) {
        const keepIdx = camionIds[0].idx
        camionIds.slice(1).forEach(({ idx }) => {
          result[idx].middle = result[idx].middle.filter((p) => p !== pid)
        })
      }
    })

    missing.forEach((pid) => {
      let bestIdx = 0
      let bestAdd = Infinity
      const d = (a, b) => this.graphe.plusCourtChemin(a, b).distance
      for (let idx = 0; idx < result.length; idx += 1) {
        const mid = result[idx].middle
        if (mid.length === 0) {
          const add = d(depotId, pid) + (dechargeId != null ? d(pid, dechargeId) : d(pid, depotId))
          if (add < bestAdd) {
            bestAdd = add
            bestIdx = idx
          }
          continue
        }
        let minAdd = Infinity
        for (let pos = 0; pos <= mid.length; pos += 1) {
          const prev = pos === 0 ? depotId : mid[pos - 1]
          const next = pos === mid.length ? (dechargeId ?? depotId) : mid[pos]
          const add = d(prev, pid) + d(pid, next) - d(prev, next)
          if (add < minAdd) minAdd = add
        }
        if (minAdd < bestAdd) {
          bestAdd = minAdd
          bestIdx = idx
        }
      }
      const mid = result[bestIdx].middle
      let bestPos = 0
      let bestIns = Infinity
      for (let pos = 0; pos <= mid.length; pos += 1) {
        const prev = pos === 0 ? depotId : mid[pos - 1]
        const next = pos === mid.length ? (dechargeId ?? depotId) : mid[pos]
        const add = d(prev, pid) + d(pid, next) - d(prev, next)
        if (add < bestIns) {
          bestIns = add
          bestPos = pos
        }
      }
      result[bestIdx].middle = [...mid.slice(0, bestPos), pid, ...mid.slice(bestPos)]
    })

    return result.map((r) => new Tournee(r.camionId, buildTour(r.middle)))
  }

  /**
   * Échange 2-opt entre tournées : swap deux points de deux camions différents si la distance totale diminue.
   */
  _exchange2OptInterRoutes(tournees, dechargeId) {
    const depotId = 0
    const eps = 1e-9

    const pointsWithoutDepotDecharge = (pts) =>
      pts.filter((p) => p !== depotId && p !== dechargeId)

    const buildTour = (middle) => {
      if (dechargeId != null) return [depotId, ...middle, dechargeId]
      return [depotId, ...middle, depotId]
    }

    let current = tournees.map((t) => new Tournee(t.camionId, [...t.points]))
    let improved = true

    while (improved) {
      improved = false
      const totalBefore = current.reduce((s, t) => s + this._distanceTotal(t.points), 0)

      for (let a = 0; a < current.length && !improved; a += 1) {
        const fromMiddle = pointsWithoutDepotDecharge(current[a].points)
        for (let b = a + 1; b < current.length && !improved; b += 1) {
          const toMiddle = pointsWithoutDepotDecharge(current[b].points)
          if (fromMiddle.length === 0 || toMiddle.length === 0) continue

          for (const pi of fromMiddle) {
            for (const pj of toMiddle) {
              const newFromMiddle = fromMiddle.map((p) => (p === pi ? pj : p))
              const newToMiddle = toMiddle.map((p) => (p === pj ? pi : p))

              const newFromPoints = buildTour(newFromMiddle)
              const newToPoints = buildTour(newToMiddle)

              const newCurrent = current.map((t, i) => {
                if (i === a) return new Tournee(t.camionId, newFromPoints)
                if (i === b) return new Tournee(t.camionId, newToPoints)
                return t
              })
              const total = newCurrent.reduce((s, t) => s + this._distanceTotal(t.points), 0)
              if (total < totalBefore - eps) {
                current = newCurrent
                improved = true
                break
              }
            }
            if (improved) break
          }
        }
      }
    }
    return current
  }
}

// ---------- Niveau 5 : Système dynamique multi-critères ----------

export class CapteurIoT {
  constructor(pointId, taux_remplissage = 0) {
    this.pointId = pointId
    this.historique = [] // { t, niveau }
    this.seuilAlerte = 80
    this.taux_remplissage = taux_remplissage
  }

  lireNiveau() {
    // Simule un niveau avec une tendance légère à la hausse + bruit
    const dernier =
      this.historique.length > 0
        ? this.historique[this.historique.length - 1].niveau
        : this.taux_remplissage
    const variation = Math.random() * 10 - 2 // -2 à +8
    const niveau = Math.min(100, Math.max(0, dernier + variation))
    const t = Date.now()
    this.historique.push({ t, niveau })
    return niveau
  }

  detecterUrgence() {
    const dernier = this.historique[this.historique.length - 1]
    if (!dernier) return false
    return dernier.niveau >= this.seuilAlerte
  }
}

export class SimulateurTempsReel {
  constructor(optimiseur, capteurs) {
    this.optimiseur = optimiseur
    this.capteurs = capteurs // pointId -> CapteurIoT
    this.evenements = []
  }

  executerPasTemps() {
    const urgents = []
    for (const [pid, capteur] of Object.entries(this.capteurs)) {
      capteur.lireNiveau()
      if (capteur.detecterUrgence()) urgents.push(Number(pid))
    }
    if (urgents.length > 0) {
      this.evenements.push({
        type: 'urgence',
        points: urgents,
        t: Date.now(),
      })
    }
    return { urgents, evenements: this.evenements }
  }
}

export class OptimiseurMultiObjectif {
  constructor(objectifs, poids) {
    this.objectifs = objectifs
    this.poids = poids
  }

  evaluerSolution(scores) {
    // scores: { cout, co2, satisfaction, equite }
    const noms = ['cout', 'co2', 'satisfaction', 'equite']
    let total = 0
    noms.forEach((nom, idx) => {
      const s = scores[nom] ?? 0
      const w = this.poids[idx] ?? 1
      const signed =
        nom === 'satisfaction' || nom === 'equite'
          ? -s // maximiser → minimiser -score
          : s
      total += signed * w
    })
    return total
  }
}

