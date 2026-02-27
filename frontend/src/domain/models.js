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

  construireSolutionInitiale(pointIdsSansDepot) {
    // Stratégie "plus proche voisin" pour un seul camion (généralisation possible)
    const depotId = 0
    const nonVisites = new Set(pointIdsSansDepot)
    const tour = [depotId]
    let courant = depotId

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

    // Retour au dépôt
    tour.push(depotId)
    return [new Tournee(this.camions[0]?.id ?? 1, tour)]
  }

  algorithme2opt(tournee) {
    const pts = [...tournee.points]
    const n = pts.length
    let improved = true

    const distanceTotal = (sequence) => {
      let total = 0
      for (let i = 0; i < sequence.length - 1; i += 1) {
        const { distance } = this.graphe.plusCourtChemin(sequence[i], sequence[i + 1])
        total += distance
      }
      return total
    }

    let bestDistance = distanceTotal(pts)

    while (improved) {
      improved = false
      for (let i = 1; i < n - 2; i += 1) {
        for (let k = i + 1; k < n - 1; k += 1) {
          const nouveau = [
            ...pts.slice(0, i),
            ...pts.slice(i, k + 1).reverse(),
            ...pts.slice(k + 1),
          ]
          const d = distanceTotal(nouveau)
          if (d < bestDistance - 1e-6) {
            bestDistance = d
            for (let idx = 0; idx < n; idx += 1) {
              pts[idx] = nouveau[idx]
            }
            improved = true
          }
        }
      }
    }

    return new Tournee(tournee.camionId, pts)
  }

  optimiser(pointsSansDepot) {
    const solutionInitiale = this.construireSolutionInitiale(pointsSansDepot)
    const ameliorations = solutionInitiale.map((t) => this.algorithme2opt(t))
    return ameliorations
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

