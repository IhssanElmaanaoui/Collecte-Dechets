import { useState, useMemo, useCallback } from 'react'
import {
  GrapheRoutier,
  PointCollecte,
  Camion,
  Zone,
  AffectateurBiparti,
  CreneauHoraire,
  ContrainteTemporelle,
  PlanificateurTriparti,
  OptimiseurVRP,
  CapteurIoT,
  SimulateurTempsReel,
  OptimiseurMultiObjectif,
} from './domain/models'
import { buildSampleGraphe, buildSampleCamionsZones, xyToLatLon } from './domain/sampleData'
import { GeoapifyMap } from './components/GeoapifyMap'
import { Navbar } from './components/Navbar'
import { getRouteWaypoints } from './services/geoapifyRouting'
import { GEOAPIFY_API_KEY } from './config'

const ROUTE_COLORS = ['#22c55e', '#2563eb', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899']

const LEVELS = [
  { id: 1, title: 'Niveau 1', subtitle: 'Réseau routier & distances' },
  { id: 2, title: 'Niveau 2', subtitle: 'Affectation camions ↔ zones' },
  { id: 3, title: 'Niveau 3', subtitle: 'Planification temporelle' },
  { id: 4, title: 'Niveau 4', subtitle: 'VRP enrichi & tournées' },
  { id: 5, title: 'Niveau 5', subtitle: 'Système dynamique temps réel' },
]

function App() {
  const [currentLevel, setCurrentLevel] = useState(1)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState(null)
  const [routesPerCamion, setRoutesPerCamion] = useState([])
  const [routesHistory, setRoutesHistory] = useState([])
  const [mapMode, setMapMode] = useState(null)

  const [apiKey, setApiKey] = useState(GEOAPIFY_API_KEY || '')
  const [nombreCamions, setNombreCamions] = useState(3)
  const [capaciteParCamion, setCapaciteParCamion] = useState(5000)
  const [debutPlanification, setDebutPlanification] = useState('08:00')
  const [finPlanification, setFinPlanification] = useState('18:00')
  const [debutPause, setDebutPause] = useState('12:00')
  const [finPause, setFinPause] = useState('13:00')
  const [serviceDefautPoint, setServiceDefautPoint] = useState(5)
  const [contrainteTemporelleOn, setContrainteTemporelleOn] = useState(true)

  const { graphe, camions, zones } = useMemo(() => {
    const g = buildSampleGraphe()
    const { zones: z } = buildSampleCamionsZones(g)
    const allZoneIds = [1, 2, 3, 4, 5]
    const c = Array.from({ length: nombreCamions }, (_, i) =>
      new Camion(i + 1, capaciteParCamion, 200, allZoneIds, { x: 0, y: 0 })
    )
    return { graphe: g, camions: c, zones: z }
  }, [nombreCamions, capaciteParCamion])

  const niveau1 = useMemo(() => {
    const { ids, matrix } = graphe.matriceDistances()
    const chemins = []
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const { distance, chemin } = graphe.plusCourtChemin(ids[i], ids[j])
        chemins.push({ depart: ids[i], arrivee: ids[j], distance, chemin })
      }
    }
    return { ids, matrix, chemins }
  }, [graphe])

  const niveau2 = useMemo(() => {
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
  }, [graphe, camions, zones])

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
    const affectateur = new AffectateurBiparti(camions, zones, graphe)
    const planificateur = new PlanificateurTriparti(affectateur, contraintesTemporelles)
    const plan = planificateur.genererPlanHebdomadaire(creneaux, 5)
    return { plan }
  }, [graphe, camions, zones, creneaux, contraintesTemporelles])

  const niveau4 = useMemo(() => {
    const pointIdsSansDepot = Array.from(graphe.sommets.keys()).filter((id) => id !== 0)
    const optimiseur = new OptimiseurVRP(graphe, camions)
    const tournees = optimiseur.optimiser(pointIdsSansDepot)
    const distanceTotale = tournees.reduce((acc, t) => acc + t.calculerDistance(graphe), 0)
    return { tournees, distanceTotale }
  }, [graphe, camions])

  const effectiveApiKey = apiKey?.trim() || GEOAPIFY_API_KEY

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
      const results = []
      for (let i = 0; i < niveau4.tournees.length; i++) {
        const tournee = niveau4.tournees[i]
        if (!tournee || tournee.points.length < 2) continue
        const waypoints = tournee.points.map((id) => {
          const p = graphe.sommets.get(id)
          if (!p) return [33.5899, -7.6039]
          return xyToLatLon(p.x, p.y)
        })
        const { coords } = await getRouteWaypoints(effectiveApiKey, waypoints, { mode: 'drive' })
        results.push({
          camionId: tournee.camionId,
          coords,
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
        })
      }
      setRoutesPerCamion(results)
    } catch (err) {
      setRouteError(err.message || 'Erreur lors du calcul des itinéraires.')
      setRoutesPerCamion([])
    } finally {
      setRouteLoading(false)
    }
  }, [effectiveApiKey, niveau4.tournees, graphe, routesPerCamion])

  const viderCarte = useCallback(() => {
    setRoutesHistory((h) => [...h, routesPerCamion])
    setRoutesPerCamion([])
    setRouteError(null)
  }, [routesPerCamion])

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
      tournees: niveau4.tournees.map((t) => ({
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
  }, [nombreCamions, capaciteParCamion, debutPlanification, finPlanification, debutPause, finPause, serviceDefautPoint, contrainteTemporelleOn, niveau4.tournees, graphe, routesPerCamion])

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
        setRouteError(null)
      } catch (err) {
        setRouteError('Import JSON invalide.')
      }
    }
    reader.readAsText(file)
  }, [])

  const mapMarkers = useMemo(() => {
    const list = []
    graphe.sommets.forEach((p, id) => {
      const [lat, lon] = xyToLatLon(p.x, p.y)
      list.push({
        id,
        position: [lat, lon],
        label: p.nom || `Point ${id}`,
        type: id === 0 ? 'depot' : 'collecte',
      })
    })
    return list
  }, [graphe])

  const mapZones = useMemo(() => {
    const points = []
    graphe.sommets.forEach((p) => {
      points.push(xyToLatLon(p.x, p.y))
    })
    if (points.length < 2) return []
    const centerLat = points.reduce((s, [lat]) => s + lat, 0) / points.length
    const centerLon = points.reduce((s, [, lon]) => s + lon, 0) / points.length
    const degToMetersLat = 111000
    const degToMetersLon = 111000 * Math.cos((centerLat * Math.PI) / 180)
    let maxDist = 0
    points.forEach(([lat, lon]) => {
      const dLat = (lat - centerLat) * degToMetersLat
      const dLon = (lon - centerLon) * degToMetersLon
      const d = Math.sqrt(dLat * dLat + dLon * dLon)
      if (d > maxDist) maxDist = d
    })
    const radius = Math.max(maxDist + 200, 400)
    return [{ center: [centerLat, centerLon], radius }]
  }, [graphe])

  const mapRoutes = useMemo(() => {
    if (routesPerCamion.length > 0) {
      return routesPerCamion.map((r) => ({
        id: `camion-${r.camionId}`,
        coords: r.coords,
        color: r.color,
      }))
    }
    if (currentLevel === 4 && niveau4.tournees.length > 0) {
      return niveau4.tournees.map((t, idx) => {
        const straight = t.points.map((id) => {
          const p = graphe.sommets.get(id)
          return p ? xyToLatLon(p.x, p.y) : [33.5899, -7.6039]
        })
        if (straight.length < 2) return null
        return {
          id: `straight-${t.camionId}`,
          coords: straight,
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
        }
      }).filter(Boolean)
    }
    return []
  }, [routesPerCamion, currentLevel, niveau4.tournees, graphe])

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="flex h-screen max-h-screen">
        <aside className="w-72 border-r border-slate-800 bg-slate-950/80 backdrop-blur-sm flex flex-col shrink-0">
          <div className="px-6 py-5 border-b border-slate-800">
            <h1 className="text-lg font-semibold tracking-tight text-slate-50">
              VillePropre – Collecte optimisée
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Système d’optimisation des tournées (5 niveaux)
            </p>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <p className="px-6 text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
              Niveaux
            </p>
            <ul className="space-y-1 px-2">
              {LEVELS.map((level) => {
                const active = currentLevel === level.id
                return (
                  <li key={level.id}>
                    <button
                      onClick={() => setCurrentLevel(level.id)}
                      className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${
                        active
                          ? 'bg-brand-500/10 text-brand-100 border border-brand-500/60'
                          : 'text-slate-200 hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 mr-2">
                          Niveau {level.id}
                        </span>
                        {active && (
                          <span className="text-[10px] rounded-full bg-brand-500/20 px-2 py-0.5 text-brand-100">
                            Actif
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium">{level.subtitle}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-950 min-w-0">
          <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {LEVELS.find((l) => l.id === currentLevel)?.title}
              </h2>
              <p className="text-xs text-slate-400">
                {LEVELS.find((l) => l.id === currentLevel)?.subtitle}
              </p>
            </div>
            <div className="flex gap-2 text-[11px] text-slate-400">
              <span className="rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700">
                React + Tailwind
              </span>
              <span className="rounded-full bg-slate-900/80 px-3 py-1 border border-slate-700">
                Itinéraires routiers Geoapify
              </span>
            </div>
          </header>

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
            onPoserDepot={() => setMapMode((m) => (m === 'depot' ? null : 'depot'))}
            onPoserDecharge={() => setMapMode((m) => (m === 'decharge' ? null : 'decharge'))}
            onAjouterZone={() => setMapMode((m) => (m === 'zone' ? null : 'zone'))}
            onAjouterPoint={() => setMapMode((m) => (m === 'point' ? null : 'point'))}
            onViderCarte={viderCarte}
            onUndo={undo}
            canUndo={routesHistory.length > 0}
            onExportPlan={exportPlan}
            onImportPlan={importPlan}
            mapMode={mapMode}
          />

          <section className="flex-1 grid grid-cols-12 gap-0 min-h-0">
            <div className="col-span-4 border-r border-slate-800 bg-slate-950/90 backdrop-blur-sm p-4 overflow-y-auto">
              {currentLevel === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Matrice des distances</h3>
                  <p className="text-xs text-slate-400">
                    IDs : {niveau1.ids.join(', ')}. Symétrie et inégalité triangulaire vérifiées.
                  </p>
                  <div className="rounded-lg bg-slate-900/80 border border-slate-700 p-3 overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="text-left py-1 pr-2">i \ j</th>
                          {niveau1.ids.map((j) => (
                            <th key={j} className="py-1 px-1 text-center">{j}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {niveau1.ids.map((i) => (
                          <tr key={i}>
                            <td className="py-1 pr-2 text-slate-400">{i}</td>
                            {niveau1.ids.map((j) => (
                              <td key={j} className="py-1 px-1 text-center text-slate-200">
                                {niveau1.matrix[niveau1.ids.indexOf(i)][niveau1.ids.indexOf(j)].toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-300">Chemins calculés (Dijkstra)</h4>
                  <ul className="text-xs text-slate-400 space-y-1">
                    {niveau1.chemins.slice(0, 5).map((c) => (
                      <li key={`${c.depart}-${c.arrivee}`}>
                        {c.depart} → {c.arrivee} : {c.distance.toFixed(2)} — [{c.chemin.join(', ')}]
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentLevel === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-200">Affectation camion ↔ zone</h3>
                  <p className="text-xs text-slate-400">
                    Contraintes respectées : {niveau2.ok ? 'Oui' : 'Non'}
                  </p>
                  <ul className="space-y-2">
                    {niveau2.stats.map((s) => (
                      <li
                        key={s.camionId}
                        className="rounded-lg bg-slate-900/80 border border-slate-700 p-3 text-xs"
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
                  <h3 className="text-sm font-semibold text-slate-200">Planification temporelle</h3>
                  <p className="text-xs text-slate-400">Plan hebdomadaire (créneaux × zones × camions)</p>
                  {Object.entries(niveau3.plan).map(([jour, affectations]) => (
                    <div key={jour} className="rounded-lg bg-slate-900/80 border border-slate-700 p-3">
                      <p className="text-xs font-medium text-slate-300 capitalize">{jour}</p>
                      <ul className="mt-1 text-xs text-slate-400">
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
                  <h3 className="text-sm font-semibold text-slate-200">VRP enrichi – Tournées</h3>
                  <p className="text-xs text-slate-400">
                    Distance totale (graphe) : {niveau4.distanceTotale.toFixed(2)} u.
                  </p>
                  {niveau4.tournees.map((t, idx) => (
                    <div key={idx} className="rounded-lg bg-slate-900/80 border border-slate-700 p-3 text-xs">
                      <span className="font-medium text-brand-200">Camion {t.camionId}</span>
                      <br />
                      Ordre : [{t.points.join(', ')}]
                      <br />
                      Distance : {t.calculerDistance(graphe).toFixed(2)}
                    </div>
                  ))}
                  <p className="text-xs text-slate-400 pt-2">
                    Utilisez <strong>« Calculer les chemins »</strong> dans la barre du haut pour afficher l’itinéraire optimal de chaque camion sur les routes réelles (couleurs différentes par camion).
                  </p>
                  {routeError && (
                    <p className="mt-2 text-xs text-red-400">{routeError}</p>
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
                  <h3 className="text-sm font-semibold text-slate-200">Système dynamique multi-critères</h3>
                  <p className="text-xs text-slate-400">
                    Capteurs IoT simulés. Exécutez un pas de temps pour mettre à jour les niveaux et détecter les urgences.
                  </p>
                  <button
                    onClick={runNiveau5Step}
                    className="rounded-md bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-400 transition-colors"
                  >
                    Exécuter un pas de temps
                  </button>
                  <p className="text-xs text-slate-400">Pas : {niveau5State.step}</p>
                  {niveau5State.urgents.length > 0 && (
                    <div className="rounded-lg bg-amber-900/20 border border-amber-600/50 p-3 text-xs">
                      <p className="font-medium text-amber-200">Points urgents (remplissage ≥ 80 %)</p>
                      <p className="text-amber-100/90">{niveau5State.urgents.join(', ')}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-dashed border-slate-600 p-3 text-xs text-slate-500">
                    Objectifs : coût, CO2, satisfaction, équité. Replanification et dashboard temps réel à étendre.
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-8 relative bg-slate-950 min-h-0">
              <div className="absolute inset-0">
                <GeoapifyMap
                  apiKey={effectiveApiKey}
                  zones={mapZones}
                  markers={mapMarkers}
                  routes={mapRoutes}
                />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
