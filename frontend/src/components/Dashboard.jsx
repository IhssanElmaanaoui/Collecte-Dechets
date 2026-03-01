/**
 * Dashboard exécutif : KPIs dernière exécution, répartition par camion, historique des runs.
 */
export function Dashboard({ lastRun, runHistory, repartitionCamions }) {
  const hasRun = lastRun != null
  const lastDate = hasRun ? new Date(lastRun.date).toLocaleString('fr-FR') : null

  // Calculate weekly benchmarks from run history
  const weeklyBenchmarks = (() => {
    if (!runHistory || runHistory.length === 0) return []
    
    const weeks = {}
    runHistory.forEach((run) => {
      const date = new Date(run.date)
      const weekNumber = getWeekNumber(date)
      const yearWeek = `${date.getFullYear()}-W${weekNumber}`
      
      if (!weeks[yearWeek]) {
        weeks[yearWeek] = { distance: 0, count: 0, weekNumber }
      }
      weeks[yearWeek].distance += run.distanceKm || (run.distanceTotale || 0) / 1000
      weeks[yearWeek].count += 1
    })
    
    return Object.entries(weeks)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 4)
      .reverse()
      .map(([key, data], idx) => ({
        label: `S${idx + 1}`,
        distance: data.distance.toFixed(2),
        week: key,
      }))
  })()

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  }

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-black">Suivi multi-critère</h2>
      <p className="text-sm text-black">
        Dernière exécution : {hasRun ? lastDate : 'Aucune simulation exécutée'}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white border border-slate-300 p-4">
          <p className="text-xs text-black uppercase">Distance totale</p>
          <p className="text-lg font-semibold text-black mt-1">
            {hasRun ? `${lastRun.distanceTotale?.toFixed(2) ?? '—'} u.` : 'En attente de run'}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-300 p-4">
          <p className="text-xs text-black uppercase">Carburant total</p>
          <p className="text-lg font-semibold text-black mt-1">
            {hasRun && lastRun.carburant != null ? `${lastRun.carburant.toFixed(1)} L` : 'En attente de run'}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-300 p-4">
          <p className="text-xs text-black uppercase">Durée totale</p>
          <p className="text-lg font-semibold text-black mt-1">
            {hasRun && lastRun.duree != null ? `${lastRun.duree} min` : 'En attente de run'}
          </p>
        </div>
        <div className="rounded-xl bg-white border border-slate-300 p-4">
          <p className="text-xs text-black uppercase">Respect temporel</p>
          <p className="text-lg font-semibold text-black mt-1">Cible: 92%</p>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-black mb-2">Benchmark hebdomadaire (JSON seed)</h3>
        <div className="rounded-xl bg-white border border-slate-300 p-4">
          {weeklyBenchmarks.length > 0 ? (
            <div className="flex gap-4 text-sm">
              {weeklyBenchmarks.map((week, idx) => (
                <div key={idx} className="flex-1 text-center">
                  <p className="text-black">{week.label}</p>
                  <p className="text-lg font-semibold text-black">{week.distance} km</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              {['268.20', '255.40', '249.60', '244.70'].map((km, idx) => (
                <div key={idx} className="flex-1 text-center">
                  <p className="text-black">S{idx + 1}</p>
                  <p className="text-lg font-semibold text-black">{km} km</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-black mb-2">Répartition par camion (dernier run)</h3>
        <div className="rounded-xl bg-white border border-slate-300 overflow-hidden">
          {repartitionCamions?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-black border-b border-slate-300">
                  <th className="text-left py-2 px-3">Camion</th>
                  <th className="text-right py-2 px-3">Distance</th>
                  <th className="text-right py-2 px-3">Points</th>
                </tr>
              </thead>
              <tbody>
                {repartitionCamions.map((r) => (
                  <tr key={r.camionId} className="border-b border-slate-200 text-black">
                    <td className="py-2 px-3">{r.camionId}</td>
                    <td className="text-right py-2 px-3">{r.distance?.toFixed(2) ?? '—'}</td>
                    <td className="text-right py-2 px-3">{r.pointsCount ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-sm text-black">Lancez un calcul dans Planner pour alimenter ce tableau.</p>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-black mb-2">Historique récent</h3>
        <div className="rounded-xl bg-white border border-slate-300 overflow-hidden">
          {runHistory?.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {runHistory.slice(0, 10).map((run) => (
                <li key={run.id} className="px-4 py-2 text-sm text-black flex justify-between">
                  <span>{new Date(run.date).toLocaleString('fr-FR')}</span>
                  <span>Distance: {run.distanceTotale?.toFixed(2) ?? '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-4 text-sm text-black">Aucun historique disponible.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export default Dashboard

