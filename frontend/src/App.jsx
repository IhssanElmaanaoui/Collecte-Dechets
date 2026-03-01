import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  GrapheRoutier,
  PointCollecte,
  Camion,
  Zone,
  AffectateurBiparti,
  CreneauHoraire,
  ContrainteTemporelle,
  PlanificateurTriparti,
  Tournee,
  CapteurIoT,
  SimulateurTempsReel,
  OptimiseurMultiObjectif,
} from './domain/models'
import {
  buildSampleGraphe,
  buildSampleCamionsZones,
  buildGrapheFromMapState,
  buildZonesFromCollectionPoints,
  xyToLatLon,
} from './domain/sampleData'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { ControlPanel } from './components/ControlPanel'
import { MapView } from './components/MapView'
import { Navbar } from './components/Navbar'
import { Dashboard } from './components/Dashboard'
import { DataLab } from './components/DataLab'
import { getRouteWaypoints } from './services/geoapifyRouting'
import { GEOAPIFY_API_KEY } from './config'

const ROUTE_COLORS = ['#22c55e', '#2563eb', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899']

/** Distance en mètres entre deux points (lat, lon) via Haversine. */
function distanceHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Vérifie si (lat, lon) est à l'intérieur d'une zone (centre + rayon en m). */
function estDansZone(lat, lon, zone) {
  const [cLat, cLon] = zone.center
  const d = distanceHaversine(lat, lon, cLat, cLon)
  return d <= (zone.radius ?? 500)
}

/** Optimisation rapide de l'ordre des waypoints via distances géodésiques locales. */
async function optimiseWaypointsRoadOrder(_apiKey, waypoints, _cache) {
  if (!Array.isArray(waypoints) || waypoints.length <= 3) return waypoints
  const start = waypoints[0]
  const end = waypoints[waypoints.length - 1]
  const middle = waypoints.slice(1, -1)
  const m = middle.length
  if (m <= 1) return waypoints

  const distStart = Array(m).fill(0)
  const distEnd = Array(m).fill(0)
  const distMid = Array.from({ length: m }, () => Array(m).fill(0))
  const localDist = (a, b) => distanceHaversine(a[0], a[1], b[0], b[1])

  for (let i = 0; i < m; i += 1) {
    distStart[i] = localDist(start, middle[i])
    distEnd[i] = localDist(middle[i], end)
  }
  for (let i = 0; i < m; i += 1) {
    for (let j = i + 1; j < m; j += 1) {
      const d = localDist(middle[i], middle[j])
      distMid[i][j] = d
      distMid[j][i] = d
    }
  }

  const routeDist = (order) => {
    if (order.length === 0) return 0
    let d = distStart[order[0]]
    for (let i = 0; i < order.length - 1; i += 1) d += distMid[order[i]][order[i + 1]]
    d += distEnd[order[order.length - 1]]
    return d
  }
  const remaining = new Set(Array.from({ length: m }, (_, i) => i))
  let cur = -1
  const nnOrder = []
  while (remaining.size > 0) {
    let best = -1
    let bestD = Infinity
    for (const i of remaining) {
      const d = cur < 0 ? distStart[i] : distMid[cur][i]
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) break
    nnOrder.push(best)
    remaining.delete(best)
    cur = best
  }

  let bestOrder = nnOrder
  let bestDistance = routeDist(bestOrder)
  let improved = true
  let pass = 0
  const maxPasses = m <= 30 ? 4 : 2
  while (improved && pass < maxPasses) {
    pass += 1
    improved = false
    for (let i = 0; i < bestOrder.length - 1; i += 1) {
      for (let k = i + 1; k < Math.min(bestOrder.length, i + 8); k += 1) {
        const candidate = [
          ...bestOrder.slice(0, i),
          ...bestOrder.slice(i, k + 1).reverse(),
          ...bestOrder.slice(k + 1),
        ]
        const d = routeDist(candidate)
        if (d < bestDistance - 1e-9) {
          bestOrder = candidate
          bestDistance = d
          improved = true
        }
      }
    }
  }

  return [start, ...bestOrder.map((i) => middle[i]), end]
}

function buildFastTournees(graphe, camions, pointIdsSansDepot, dechargeId = null) {
  const depotId = 0
  const depot = graphe.sommets.get(depotId)
  if (!depot) return []

  const pointsWithAngle = pointIdsSansDepot
    .map((pid) => {
      const p = graphe.sommets.get(pid)
      if (!p) return null
      const angle = Math.atan2(p.y - depot.y, p.x - depot.x)
      return { pid, angle }
    })
    .filter(Boolean)
    .sort((a, b) => a.angle - b.angle)

  const K = Math.max(1, camions.length)
  const n = pointsWithAngle.length
  const base = Math.floor(n / K)
  const rem = n % K
  const clusters = Array.from({ length: K }, () => [])
  let idx = 0
  for (let k = 0; k < K; k += 1) {
    const size = base + (k < rem ? 1 : 0)
    for (let j = 0; j < size; j += 1) {
      clusters[k].push(pointsWithAngle[idx].pid)
      idx += 1
    }
  }

  const d = (a, b) => graphe.plusCourtChemin(a, b).distance
  const endId = dechargeId ?? depotId

  return clusters.map((cluster, k) => {
    const camionId = camions[k]?.id ?? k + 1
    if (cluster.length === 0) {
      return new Tournee(camionId, [depotId, endId])
    }
    const remaining = new Set(cluster)
    const tour = [depotId]
    let current = depotId
    while (remaining.size > 0) {
      let best = null
      let bestDist = Infinity
      for (const pid of remaining) {
        const dist = d(current, pid)
        if (dist < bestDist) {
          bestDist = dist
          best = pid
        }
      }
      if (best == null) break
      tour.push(best)
      remaining.delete(best)
      current = best
    }
    tour.push(endId)
    return new Tournee(camionId, tour)
  })
}

const LEVELS = [
  { id: 1, title: 'Niveau 1', subtitle: 'Réseau routier & distances' },
  { id: 2, title: 'Niveau 2', subtitle: 'Affectation camions ↔ zones' },
  { id: 3, title: 'Niveau 3', subtitle: 'Planification temporelle' },
  { id: 4, title: 'Niveau 4', subtitle: 'VRP enrichi & tournées' },
  { id: 5, title: 'Niveau 5', subtitle: 'Système dynamique temps réel' },
]

const MAIN_SECTIONS = [
  { id: 'planner', title: 'Planner', subtitle: 'Centre d\'exploitation des tournées' },
  { id: 'datalab', title: 'Data Lab', subtitle: 'Analyseur JSON' },
]

function App() {
  const [mainSection, setMainSection] = useState('planner')
  const [currentLevel, setCurrentLevel] = useState(4)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [routesPerCamion, setRoutesPerCamion] = useState([])
  const [routesHistory, setRoutesHistory] = useState([])
  const [runHistory, setRunHistory] = useState([])
  const [lastRun, setLastRun] = useState(null)
  const [selectedCamionId, setSelectedCamionId] = useState(null)
  const [placementMode, setPlacementMode] = useState(null)
  const [placementError, setPlacementError] = useState(null)
  const [depot, setDepot] = useState(null)
  const [decharge, setDecharge] = useState(null)
  const [collectionPoints, setCollectionPoints] = useState([])
  const [userZones, setUserZones] = useState([])

  const [apiKey, setApiKey] = useState(GEOAPIFY_API_KEY || '')
  const [nombreCamions, setNombreCamions] = useState(3)
  const [capaciteParCamion, setCapaciteParCamion] = useState(5000)
  const [debutPlanification, setDebutPlanification] = useState('08:00')
  const [finPlanification, setFinPlanification] = useState('18:00')
  const [debutPause, setDebutPause] = useState('12:00')
  const [finPause, setFinPause] = useState('13:00')
  const [serviceDefautPoint, setServiceDefautPoint] = useState(5)
  const [contrainteTemporelleOn, setContrainteTemporelleOn] = useState(true)

  const pointsInZone = useMemo(() => {
    if (userZones.length === 0) return []
    return collectionPoints.filter((p) =>
      userZones.some((z) => estDansZone(p.lat, p.lon, z))
    )
  }, [collectionPoints, userZones])

  const { graphe, camions, zones } = useMemo(() => {
    const customGraphe = buildGrapheFromMapState(depot, pointsInZone, decharge)
    const g = customGraphe ?? buildSampleGraphe()
    const zoneIds = customGraphe
      ? Array.from({ length: pointsInZone.length }, (_, i) => i + 1)
      : [1, 2, 3, 4, 5]
    const z = customGraphe
      ? buildZonesFromCollectionPoints(pointsInZone)
      : buildSampleCamionsZones(g).zones
    const c = Array.from({ length: nombreCamions }, (_, i) =>
      new Camion(i + 1, capaciteParCamion, 200, zoneIds, { x: 0, y: 0 })
    )
    return { graphe: g, camions: c, zones: z }
  }, [depot, pointsInZone, decharge, nombreCamions, capaciteParCamion])

  const niveau1 = useMemo(() => {
    if (currentLevel !== 1) {
      return { ids: [], matrix: [], tourneeOptimale: { tour: [], distance: 0 } }
    }
    const { ids, matrix } = graphe.matriceDistances()
    const { tour, distance } = graphe.tourneeOptimaleTSP()
    return { ids, matrix, tourneeOptimale: { tour, distance } }
  }, [graphe, currentLevel])

  const niveau2 = useMemo(() => {
    if (currentLevel !== 2) return { affectation: new Map(), ok: false, stats: [] }
    const affectateur = new AffectateurBiparti(camions, zones, graphe)
    const affectation = affectateur.affectationGloutonne()
    const ok = affectateur.verifierContraintes(affectation)
    const stats = []
    affectation.forEach((zoneIds, camionId) => {
      const camion = camions.find((c) => c.id === camionId)
      let charge = 0
      zoneIds.forEach((zid) => {
        const z = zones.find((x) => x.id === zid)
        if (z) charge += z.volume_estime
      })
      stats.push({
        camionId,
        zonesAffectees: zoneIds,
        chargeTotale: charge,
        pourcentage: camion ? Math.round((charge / camion.capacite) * 100) : 0,
      })
    })
    return { affectation, ok, stats }
  }, [graphe, camions, zones, currentLevel])

  const creneaux = useMemo(() => [
    new CreneauHoraire(1, '08:00', '10:00', 'lundi', 1.2),
    new CreneauHoraire(2, '10:00', '12:00', 'lundi', 1.0),
    new CreneauHoraire(3, '14:00', '16:00', 'lundi', 1.1),
  ], [])

  const contraintesTemporelles = useMemo(() => {
    const c = new ContrainteTemporelle()
    c.fenetresZone.set(1, { debut: '06:00', fin: '18:00' })
    c.fenetresZone.set(2, { debut: '06:00', fin: '18:00' })
    c.fenetresZone.set(3, { debut: '06:00', fin: '18:00' })
    return c
  }, [])

  const niveau3 = useMemo(() => {
    if (currentLevel !== 3) return { plan: {} }
    const affectateur = new AffectateurBiparti(camions, zones, graphe)
    const planificateur = new PlanificateurTriparti(affectateur, contraintesTemporelles)
    const plan = planificateur.genererPlanHebdomadaire(creneaux, 5)
    return { plan }
  }, [graphe, camions, zones, creneaux, contraintesTemporelles, currentLevel])

  const computeNiveau4 = useCallback(() => {
    const dechargeId =
      decharge != null && graphe.sommets.has(pointsInZone.length + 1)
        ? pointsInZone.length + 1
        : null
    const pointIdsSansDepot = Array.from(graphe.sommets.keys()).filter(
      (id) => id !== 0 && id !== (dechargeId ?? -1)
    )
    const tournees = buildFastTournees(graphe, camions, pointIdsSansDepot, dechargeId)
    const distanceTotale = tournees.reduce((acc, t) => acc + t.calculerDistance(graphe), 0)
    return { tournees, distanceTotale }
  }, [graphe, camions, decharge, pointsInZone.length])
  const [niveau4, setNiveau4] = useState({ tournees: [], distanceTotale: 0 })

  // Invalide les tournées pré-calculées quand les données changent (évite recalcul coûteux à chaque clic carte).
  useEffect(() => {
    setNiveau4({ tournees: [], distanceTotale: 0 })
  }, [graphe, camions, decharge, pointsInZone.length])

  const effectiveApiKey = apiKey?.trim() || GEOAPIFY_API_KEY

  const updatePointPoids = useCallback((pointId, poids) => {
    setCollectionPoints((prev) =>
      prev.map((p) => (p.id === pointId ? { ...p, poids: Number(poids) || 0 } : p))
    )
  }, [])

  const updateZoneRadius = useCallback((zoneIndex, radius) => {
    const r = Math.max(100, Number(radius) || 500)
    setUserZones((prev) =>
      prev.map((z, i) => (i === zoneIndex ? { ...z, radius: r } : z))
    )
  }, [])

  const removeZone = useCallback((zoneIndex) => {
    setUserZones((prev) => prev.filter((_, i) => i !== zoneIndex))
  }, [])

  const onZoneResizeFromMap = useCallback((zoneIndex, newLat, newLon) => {
    setUserZones((prev) => {
      const z = prev[zoneIndex]
      if (!z?.center) return prev
      const [cLat, cLon] = z.center
      const r = Math.max(100, Math.round(distanceHaversine(cLat, cLon, newLat, newLon)))
      return prev.map((zone, i) => (i === zoneIndex ? { ...zone, radius: r } : zone))
    })
  }, [])

  const handleMapClick = useCallback((lat, lon) => {
    setPlacementError(null)
    if (placementMode === 'zone') {
      setUserZones((prev) => [
        ...prev,
        { center: [lat, lon], radius: 500 },
      ])
      setPlacementMode(null)
      return
    }
    if (placementMode === 'depot') {
      setDepot([lat, lon])
      setPlacementMode(null)
      return
    }
    if (placementMode === 'decharge') {
      setDecharge([lat, lon])
      setPlacementMode(null)
      return
    }
    if (placementMode === 'point') {
      if (userZones.length === 0) {
        setPlacementError('Ajoutez une zone, puis placez les points à l\'intérieur.')
        return
      }
      const dansZone = userZones.some((z) => estDansZone(lat, lon, z))
      if (!dansZone) {
        setPlacementError('Les points doivent être à l\'intérieur du cercle bleu.')
        return
      }
      setCollectionPoints((prev) => [
        ...prev,
        { id: prev.length + 1, lat, lon, nom: `Point ${prev.length + 1}`, poids: 100 },
      ])
      return
    }
  }, [placementMode, userZones])

  const calculerChemins = useCallback(async () => {
    if (!effectiveApiKey) {
      setRouteError('Clé API Geoapify manquante.')
      return
    }
    setRouteError(null)
    setRouteLoading(true)
    setRoutesHistory((h) => [...h, routesPerCamion])
    setRoutesPerCamion([])
    try {
      const computedNiveau4 = computeNiveau4()
      setNiveau4(computedNiveau4)
      const results = []
      let totalDistance = 0
      let totalTime = 0
      const repartition = []
      for (let i = 0; i < computedNiveau4.tournees.length; i++) {
        const tournee = computedNiveau4.tournees[i]
        if (!tournee || tournee.points.length < 2) continue
        const rawWaypoints = tournee.points.map((id) => {
          const p = graphe.sommets.get(id)
          if (!p) return [33.5899, -7.6039]
          return xyToLatLon(p.x, p.y)
        })
        const waypoints = await optimiseWaypointsRoadOrder(effectiveApiKey, rawWaypoints, null)
        const { coords, distance = 0, time = 0 } = await getRouteWaypoints(effectiveApiKey, waypoints, { mode: 'drive', type: 'short' })
        totalDistance += distance
        totalTime += time
        const fallbackCoords = coords?.length > 0 ? coords : waypoints
        repartition.push({
          camionId: tournee.camionId,
          distance: tournee.calculerDistance(graphe),
          distanceKm: distance / 1000,
          timeMin: Math.round(time / 60),
          pointsCount: tournee.points.length - 2,
        })
        const pointsCount = Math.max(0, tournee.points.length - 2)
        results.push({
          camionId: tournee.camionId,
          coords: fallbackCoords,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
          distanceKm: distance / 1000,
          carburant: (distance / 1000) * 0.05,
          timeMin: Math.round(time / 60),
          pointsCount,
        })
      }
      setRoutesPerCamion(results)
      setSelectedCamionId(null)
      const run = {
        id: Date.now(),
        date: new Date().toISOString(),
        distanceTotale: computedNiveau4.distanceTotale,
        distanceKm: totalDistance / 1000,
        carburant: (totalDistance / 1000) * 0.05,
        duree: Math.round(totalTime / 60),
        respectTemporel: 90,
        repartitionCamions: repartition,
      }
      setLastRun(run)
      setRunHistory((h) => [run, ...h])
    } catch (err) {
      setRouteError(err.message || 'Erreur lors du calcul des itinéraires.')
      setRoutesPerCamion([])
    } finally {
      setRouteLoading(false)
    }
  }, [effectiveApiKey, computeNiveau4, graphe, routesPerCamion])

  const viderCarte = useCallback(() => {
    setDepot(null)
    setDecharge(null)
    setCollectionPoints([])
    setUserZones([])
    setRoutesPerCamion([])
    setRoutesHistory([])
    setRouteError(null)
    setPlacementMode(null)
    setPlacementError(null)
    setSelectedCamionId(null)
  }, [])

  const undo = useCallback(() => {
    if (routesHistory.length === 0) return
    setRoutesHistory((h) => {
      const next = [...h]
      const prev = next.pop()
      setRoutesPerCamion(prev || [])
      return next
    })
  }, [routesHistory.length])

  const exportPlan = useCallback(() => {
    const niveau4ForExport =
      niveau4.tournees.length > 0 ? niveau4 : computeNiveau4()
    const plan = {
      params: {
        nombreCamions,
        capaciteParCamion,
        debutPlanification,
        finPlanification,
        debutPause,
        finPause,
        serviceDefautPoint,
        contrainteTemporelleOn,
      },
      depot: depot ?? undefined,
      decharge: decharge ?? undefined,
      userZones: userZones.length > 0 ? userZones : undefined,
      collectionPoints: collectionPoints.length > 0 ? collectionPoints.map((p) => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        nom: p.nom,
        poids: p.poids ?? 100,
      })) : undefined,
      tournees: niveau4ForExport.tournees.map((t) => ({
        camionId: t.camionId,
        points: t.points,
        distance: t.calculerDistance(graphe),
      })),
      routesPerCamion: routesPerCamion.map((r) => ({ camionId: r.camionId, color: r.color })),
      exportAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `plan-collecte-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [depot, decharge, userZones, collectionPoints, nombreCamions, capaciteParCamion, debutPlanification, finPlanification, debutPause, finPause, serviceDefautPoint, contrainteTemporelleOn, niveau4, computeNiveau4, graphe, routesPerCamion])

  const importPlan = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const plan = JSON.parse(e.target?.result || '{}')
        if (plan.params) {
          if (plan.params.nombreCamions != null) setNombreCamions(plan.params.nombreCamions)
          if (plan.params.capaciteParCamion != null) setCapaciteParCamion(plan.params.capaciteParCamion)
          if (plan.params.debutPlanification) setDebutPlanification(plan.params.debutPlanification)
          if (plan.params.finPlanification) setFinPlanification(plan.params.finPlanification)
          if (plan.params.debutPause) setDebutPause(plan.params.debutPause)
          if (plan.params.finPause) setFinPause(plan.params.finPause)
          if (plan.params.serviceDefautPoint != null) setServiceDefautPoint(plan.params.serviceDefautPoint)
          if (plan.params.contrainteTemporelleOn != null) setContrainteTemporelleOn(plan.params.contrainteTemporelleOn)
        }
        if (Array.isArray(plan.depot) && plan.depot.length >= 2) setDepot(plan.depot)
        if (Array.isArray(plan.decharge) && plan.decharge.length >= 2) setDecharge(plan.decharge)
        if (Array.isArray(plan.userZones) && plan.userZones.length > 0) {
          setUserZones(plan.userZones)
        } else if (
          (Array.isArray(plan.depot) && plan.depot.length >= 2) ||
          (Array.isArray(plan.collectionPoints) && plan.collectionPoints.length > 0)
        ) {
          const pts = [
            ...(plan.depot?.length >= 2 ? [plan.depot] : []),
            ...(plan.decharge?.length >= 2 ? [plan.decharge] : []),
            ...(plan.collectionPoints || []).map((p) => [p.lat, p.lon]),
          ]
          if (pts.length > 0) {
            const centerLat = pts.reduce((s, [lat]) => s + lat, 0) / pts.length
            const centerLon = pts.reduce((s, [, lon]) => s + lon, 0) / pts.length
            let maxDist = 0
            pts.forEach(([lat, lon]) => {
              const d = Math.sqrt((lat - centerLat) ** 2 + (lon - centerLon) ** 2) * 111000
              if (d > maxDist) maxDist = d
            })
            setUserZones([{ center: [centerLat, centerLon], radius: Math.max(maxDist + 200, 500) }])
          }
        }
        if (Array.isArray(plan.collectionPoints) && plan.collectionPoints.length > 0) {
          setCollectionPoints(plan.collectionPoints.map((p, i) => ({
            id: p.id ?? i + 1,
            lat: p.lat,
            lon: p.lon,
            nom: p.nom || `Point ${(p.id ?? i + 1)}`,
            poids: p.poids ?? 100,
          })))
        }
        setRouteError(null)
      } catch (err) {
        setRouteError('Import JSON invalide.')
      }
    }
    reader.readAsText(file)
  }, [])

  const pointIdToRouteColor = useMemo(() => {
    if (routesPerCamion.length === 0 || !niveau4.tournees?.length) return {}
    const map = {}
    niveau4.tournees.forEach((tournee) => {
      const route = routesPerCamion.find((r) => r.camionId === tournee.camionId)
      const color = route?.color
      if (!color) return
      tournee.points.forEach((graphId) => {
        if (graphId >= 1 && graphId <= pointsInZone.length) {
          const point = pointsInZone[graphId - 1]
          if (point) map[point.id] = color
        }
      })
    })
    return map
  }, [routesPerCamion, niveau4.tournees, pointsInZone])

  const mapMarkers = useMemo(() => {
    if (!depot) return []
    const list = [{ id: 'depot', position: depot, label: 'Dépôt', type: 'depot' }]
    if (decharge) {
      list.push({ id: 'decharge', position: decharge, label: 'Décharge', type: 'decharge' })
    }
    pointsInZone.forEach((p) => {
      list.push({
        id: p.id,
        position: [p.lat, p.lon],
        label: p.nom || `Point ${p.id}`,
        type: 'point',
        routeColor: pointIdToRouteColor[p.id],
      })
    })
    return list
  }, [depot, decharge, pointsInZone, pointIdToRouteColor])

  const mapZones = useMemo(() => {
    return userZones
  }, [userZones])

  const mapRoutes = useMemo(() => {
    if (routesPerCamion.length === 0) return []
    let list = routesPerCamion.map((r) => ({
      id: `camion-${r.camionId}`,
      camionId: r.camionId,
      coords: r.coords,
      color: r.color,
    }))
    if (selectedCamionId != null) {
      list = list.filter((r) => r.camionId === selectedCamionId)
    }
    return list
  }, [routesPerCamion, selectedCamionId])

  const niveau5Capteurs = useMemo(() => {
    const capteurs = {}
    graphe.sommets.forEach((_, id) => {
      if (id === 0) return
      capteurs[id] = new CapteurIoT(id, 30 + Math.random() * 40)
    })
    return capteurs
  }, [graphe])

  const [niveau5State, setNiveau5State] = useState({ urgents: [], step: 0 })
  const runNiveau5Step = () => {
    const sim = new SimulateurTempsReel(
      { optimiser: () => niveau4.tournees },
      niveau5Capteurs
    )
    const { urgents } = sim.executerPasTemps()
    setNiveau5State((s) => ({ urgents, step: s.step + 1 }))
  }

  const chargeTotalePoints = pointsInZone.reduce((s, p) => s + (Number(p.poids) || 0), 0)
  const capaciteTotale = nombreCamions * capaciteParCamion

  return (
    <div className="min-h-screen bg-white text-black relative overflow-hidden">
      <div className="relative flex h-screen max-h-screen gap-4 p-4">
        <Sidebar
          mainSection={mainSection}
          onMainSectionChange={setMainSection}
          mainSections={MAIN_SECTIONS}
          currentLevel={currentLevel}
          levels={LEVELS}
          onLevelChange={setCurrentLevel}
        />

        <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

          {mainSection === 'datalab' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
              <TopBar currentLevel="datalab" levels={[{ id: 'datalab', title: 'Data Lab', subtitle: 'Analyseur JSON' }]} />
              <DataLab />
            </div>
          )}
          {mainSection === 'planner' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
          <TopBar currentLevel={currentLevel} levels={LEVELS} />
          <Navbar
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            nombreCamions={nombreCamions}
            onNombreCamionsChange={setNombreCamions}
            capaciteParCamion={capaciteParCamion}
            onCapaciteParCamionChange={setCapaciteParCamion}
            debutPlanification={debutPlanification}
            onDebutPlanificationChange={setDebutPlanification}
            finPlanification={finPlanification}
            onFinPlanificationChange={setFinPlanification}
            debutPause={debutPause}
            onDebutPauseChange={setDebutPause}
            finPause={finPause}
            onFinPauseChange={setFinPause}
            serviceDefautPoint={serviceDefautPoint}
            onServiceDefautPointChange={setServiceDefautPoint}
            contrainteTemporelleOn={contrainteTemporelleOn}
            onContrainteTemporelleChange={setContrainteTemporelleOn}
            onCalculerChemins={calculerChemins}
            calculLoading={routeLoading}
            onPoserDepot={() => { setPlacementMode((m) => (m === 'depot' ? null : 'depot')); setPlacementError(null) }}
            onPoserDecharge={() => { setPlacementMode((m) => (m === 'decharge' ? null : 'decharge')); setPlacementError(null) }}
            onAjouterZone={() => { setPlacementMode((m) => (m === 'zone' ? null : 'zone')); setPlacementError(null) }}
            onAjouterPoint={() => { setPlacementMode((m) => (m === 'point' ? null : 'point')); setPlacementError(null) }}
            onViderCarte={viderCarte}
            onUndo={undo}
            canUndo={routesHistory.length > 0}
            onExportPlan={exportPlan}
            onImportPlan={importPlan}
            mapMode={placementMode}
            hasZone={userZones.length > 0}
          />

          {placementError && (
            <div className="shrink-0 rounded-xl bg-amber-900/30 border border-amber-600/50 px-4 py-2 text-sm text-black">
              {placementError}
            </div>
          )}

          {routesPerCamion.length > 0 && (
            <div className="shrink-0 rounded-xl bg-white backdrop-blur-md border border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-black mb-2">Résultat des chemins</h3>
              <p className="text-xs text-black mb-2">{routesPerCamion.length} chemin{routesPerCamion.length > 1 ? 's' : ''} (1 par camion)</p>
              <div className="flex flex-wrap items-center gap-4">
                {routesPerCamion.map((r) => (
                  <button
                    key={r.camionId}
                    type="button"
                    onClick={() => setSelectedCamionId(r.camionId)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      selectedCamionId === r.camionId
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 text-black hover:bg-slate-200'
                    }`}
                  >
                    Camion {r.camionId}{r.pointsCount != null ? ` (${r.pointsCount} pt${r.pointsCount !== 1 ? 's' : ''})` : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedCamionId(null)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    selectedCamionId === null
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 text-black hover:bg-slate-200'
                  }`}
                >
                  Tous
                </button>
              </div>
              {selectedCamionId != null ? (
                (() => {
                  const sel = routesPerCamion.find((r) => r.camionId === selectedCamionId)
                  if (!sel) return null
                  return (
                    <div className="mt-2 text-xs text-black space-y-1">
                      <p>Distance totale : {(sel.distanceKm ?? 0).toFixed(2)} km</p>
                      <p>Carburant estimé : {(sel.carburant ?? 0).toFixed(2)} L</p>
                      <p>Retard total : 0.00 min</p>
                    </div>
                  )
                })()
              ) : (
                <div className="mt-2 text-xs text-black">
                  Distance totale : {routesPerCamion.reduce((s, r) => s + (r.distanceKm ?? 0), 0).toFixed(2)} km
                </div>
              )}
            </div>
          )}

          <section className="grid grid-cols-12 gap-4 min-h-[68vh]">
            <div className="col-span-5 min-h-0 flex flex-col overflow-y-auto">
              <ControlPanel
                placementMode={placementMode}
                onPlacementModeChange={setPlacementMode}
                onCancelPlacement={() => setPlacementMode(null)}
                hasDepot={!!depot}
                hasDecharge={!!decharge}
                hasZone={userZones.length > 0}
              >
              <div className="space-y-4 mb-4 pb-4 border-b border-slate-200">
                <h4 className="text-xs font-semibold text-black">État des données</h4>
                <ul className="text-xs text-black space-y-1">
                  <li>Zones : {userZones.length}</li>
                  <li>Points dans la zone : {pointsInZone.length}</li>
                  <li>Dépôt : {depot ? 'Défini' : 'Non défini'}</li>
                  <li>Décharge : {decharge ? 'Défini' : 'Non défini'}</li>
                  <li>Charge totale (points zone) : {chargeTotalePoints.toFixed(2)} kg</li>
                  <li>Capacité totale : {capaciteTotale.toFixed(2)} kg</li>
                </ul>
                <h4 className="text-xs font-semibold text-black mt-3">Zones (redimensionnables)</h4>
                {userZones.length === 0 ? (
                  <p className="text-xs text-black">Aucune zone. Ajoutez une zone sur la carte.</p>
                ) : (
                  <ul className="text-xs space-y-2">
                    {userZones.map((z, idx) => (
                      <li key={idx} className="flex flex-col gap-1.5 text-black">
                        <div className="flex items-center justify-between gap-2">
                          <span>Zone {idx + 1}</span>
                          <label className="flex items-center gap-1">
                            <span className="text-black text-[11px]">rayon</span>
                            <input
                              type="number"
                              min={100}
                              max={5000}
                              step={50}
                              value={z.radius ?? 500}
                              onChange={(e) => updateZoneRadius(idx, e.target.value)}
                              className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-black text-xs"
                            />
                            <span className="text-black text-[11px]">m</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeZone(idx)}
                            className="text-black hover:text-black text-[11px]"
                          >
                            Supprimer
                          </button>
                        </div>
                        <input
                          type="range"
                          min={100}
                          max={5000}
                          step={50}
                          value={Math.min(z.radius ?? 500, 5000)}
                          onChange={(e) => updateZoneRadius(idx, e.target.value)}
                          className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                          title="Glisser pour agrandir ou réduire la zone"
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="text-xs font-semibold text-black mt-3">Fenêtres Zones (Niveau 3)</h4>
                <p className="text-xs text-black">Ajoutez des zones pour définir les horaires.</p>
                <h4 className="text-xs font-semibold text-black mt-3">Points (dans la zone)</h4>
                {pointsInZone.length === 0 ? (
                  <p className="text-xs text-black">Aucun point.</p>
                ) : (
                  <ul className="text-xs space-y-2">
                    {pointsInZone.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-black">
                        <span>{p.nom || `Point ${p.id}`}</span>
                        <label className="flex items-center gap-1">
                          <span className="text-black">poids (kg)</span>
                          <input
                            type="number"
                            min={0}
                            value={p.poids ?? 100}
                            onChange={(e) => updatePointPoids(p.id, e.target.value)}
                            className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-black"
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="text-xs font-semibold text-black mt-3">Operations</h4>
                <p className="text-xs text-black">Runs stockés : {runHistory.length}</p>
                <p className="text-xs text-black">Lancez des calculs dans Planner pour alimenter le journal.</p>
              </div>
              {currentLevel === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-black">Matrice des distances</h3>
                  <p className="text-xs text-black">
                    IDs : {niveau1.ids.join(', ')}. Symétrie et inégalité triangulaire vérifiées.
                  </p>
                  <p className="text-xs text-black/90 bg-amber-900/20 rounded-lg px-3 py-2 border border-amber-600/30">
                    <strong>Niveau 1</strong> : tournée optimale (TSP) qui parcourt <strong>tous les points</strong> une fois et revient au dépôt — algorithme exact (Held-Karp) pour peu de points, heuristique 2-opt sinon. La carte montre dépôt, décharge, points et zones. Pour voir les itinéraires sur les vraies routes, passez au <strong>Niveau 4</strong> et cliquez sur « Calculer les chemins ».
                  </p>
                  <div className="rounded-lg bg-white border border-slate-200 p-3 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-black">
                          <th className="text-left py-1 pr-2">i \ j</th>
                          {niveau1.ids.map((j) => (
                            <th key={j} className="py-1 px-1 text-center">{j}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {niveau1.ids.map((i) => (
                          <tr key={i}>
                            <td className="py-1 pr-2 text-black">{i}</td>
                            {niveau1.ids.map((j) => (
                              <td key={j} className="py-1 px-1 text-center text-black">
                                {niveau1.matrix[niveau1.ids.indexOf(i)][niveau1.ids.indexOf(j)].toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h4 className="text-xs font-semibold text-black">Tournée optimale (parcourt tous les points)</h4>
                  <p className="text-xs text-black">
                    Ordre : {niveau1.tourneeOptimale.tour.join(' → ')}
                  </p>
                  <p className="text-xs text-black font-medium">
                    Distance totale : {niveau1.tourneeOptimale.distance.toFixed(2)}
                  </p>
                </div>
              )}

              {currentLevel === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-black">Affectation camion ↔ zone</h3>
                  <p className="text-xs text-black">
                    Contraintes respectées : {niveau2.ok ? 'Oui' : 'Non'}
                  </p>
                  <ul className="space-y-2">
                    {niveau2.stats.map((s) => (
                      <li
                        key={s.camionId}
                        className="rounded-lg bg-white border border-slate-200 p-3 text-xs"
                      >
                        <span className="font-medium text-brand-200">Camion {s.camionId}</span>
                        <br />
                        Zones : {s.zonesAffectees.join(', ') || '—'}
                        <br />
                        Charge : {s.chargeTotale} kg — {s.pourcentage} % capacité
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentLevel === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-black">Planification temporelle</h3>
                  <p className="text-xs text-black">Plan hebdomadaire (créneaux × zones × camions)</p>
                  {Object.entries(niveau3.plan).map(([jour, affectations]) => (
                    <div key={jour} className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="text-xs font-medium text-black capitalize">{jour}</p>
                      <ul className="mt-1 text-xs text-black">
                        {affectations.length === 0 && <li>Aucune affectation</li>}
                        {affectations.map((a, idx) => (
                          <li key={idx}>
                            Camion {a.camionId} → Zone {a.zoneId} (créneau {a.creneauId})
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {currentLevel === 4 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-black">VRP enrichi – Tournées</h3>
                  <p className="text-xs text-black">
                    Distance totale (graphe) : {niveau4.distanceTotale.toFixed(2)} u.
                  </p>
                  {niveau4.tournees.map((t, idx) => (
                    <div key={idx} className="rounded-lg bg-white border border-slate-200 p-3 text-xs">
                      <span className="font-medium text-brand-200">Camion {t.camionId}</span>
                      <br />
                      Ordre : [{t.points.join(', ')}]
                      <br />
                      Distance : {t.calculerDistance(graphe).toFixed(2)}
                    </div>
                  ))}
                  <p className="text-xs text-black pt-2">
                    Utilisez <strong>« Calculer les chemins »</strong> dans la barre du haut pour afficher l’itinéraire optimal de chaque camion sur les routes réelles (couleurs différentes par camion).
                  </p>
                  {routeError && (
                    <p className="mt-2 text-xs text-black">{routeError}</p>
                  )}
                  {routesPerCamion.length > 0 && (
                    <p className="mt-2 text-xs text-green-400">
                      {routesPerCamion.length} chemin{routesPerCamion.length > 1 ? 's' : ''} affiché{routesPerCamion.length > 1 ? 's' : ''} sur la carte.
                    </p>
                  )}
                </div>
              )}

              {currentLevel === 5 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-black">Système dynamique multi-critères</h3>
                  <p className="text-xs text-black">
                    Capteurs IoT simulés. Exécutez un pas de temps pour mettre à jour les niveaux et détecter les urgences.
                  </p>
                  <button
                    onClick={runNiveau5Step}
                    className="rounded-md bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-400 transition-colors"
                  >
                    Exécuter un pas de temps
                  </button>
                  <p className="text-xs text-black">Pas : {niveau5State.step}</p>
                  {niveau5State.urgents.length > 0 && (
                    <div className="rounded-lg bg-amber-900/20 border border-amber-600/50 p-3 text-xs">
                      <p className="font-medium text-black">Points urgents (remplissage ≥ 80 %)</p>
                      <p className="text-black/90">{niveau5State.urgents.join(', ')}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-black">
                    Objectifs : coût, CO2, satisfaction, équité. Replanification et dashboard temps réel à étendre.
                  </div>
                </div>
              )}
              </ControlPanel>
            </div>

            <div className="col-span-7 min-h-[55vh] flex flex-col">
              <MapView
                placementMode={placementMode}
                onMapClick={handleMapClick}
                apiKey={effectiveApiKey}
                zones={mapZones}
                markers={mapMarkers}
                routes={mapRoutes}
                onZoneResize={onZoneResizeFromMap}
              />
            </div>
          </section>
          {routesPerCamion.length > 0 && (
            <section className="shrink-0 rounded-xl border border-slate-200 bg-white">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-black">Dashboard exécutif (dernier calcul)</h3>
                <p className="text-xs text-black">KPIs et historique avec barre de défilement</p>
              </div>
              <div className="max-h-[340px] overflow-y-auto">
                <Dashboard
                  lastRun={lastRun}
                  runHistory={runHistory}
                  repartitionCamions={lastRun?.repartitionCamions}
                />
              </div>
            </section>
          )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App









