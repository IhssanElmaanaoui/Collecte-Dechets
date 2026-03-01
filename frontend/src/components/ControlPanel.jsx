const PLACEMENT_LABELS = {
  zone: 'Zone',
  depot: 'Dépôt',
  decharge: 'Décharge',
  point: 'Point',
}

export function ControlPanel({
  placementMode,
  onPlacementModeChange,
  onCancelPlacement,
  hasDepot,
  hasDecharge,
  hasZone,
  children,
}) {
  const isPlacing = placementMode != null

  const setMode = (mode) => {
    onPlacementModeChange(mode === placementMode ? null : mode)
  }

  return (
    <div className="flex flex-col h-full rounded-2xl bg-white backdrop-blur-md border border-slate-200 shadow-xl overflow-hidden">
      {/* Placement controls */}
      <div className="shrink-0 p-4 border-b border-slate-200 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-black">
          Placement sur la carte
        </p>
        <p className="text-[11px] text-black">
          Placez Dépôt / Décharge / Zones / Points sur la carte. Chaque point a un poids par défaut ; cliquez un point pour l&apos;ajuster.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('depot')}
            disabled={isPlacing && placementMode !== 'depot'}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              placementMode === 'depot'
                ? 'bg-emerald-500/30 text-black border-2 border-emerald-400/60'
                : 'bg-white text-black border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Poser dépôt
          </button>
          <button
            type="button"
            onClick={() => setMode('decharge')}
            disabled={isPlacing && placementMode !== 'decharge'}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              placementMode === 'decharge'
                ? 'bg-amber-500/30 text-black border-2 border-amber-400/60'
                : 'bg-white text-black border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Poser décharge
          </button>
          <button
            type="button"
            onClick={() => setMode('zone')}
            disabled={isPlacing && placementMode !== 'zone'}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              placementMode === 'zone'
                ? 'bg-cyan-500/30 text-black border-2 border-cyan-400/60'
                : 'bg-white text-black border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Ajouter zone
          </button>
          <button
            type="button"
            onClick={() => setMode('point')}
            disabled={(isPlacing && placementMode !== 'point') || !hasZone}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              placementMode === 'point'
                ? 'bg-red-500/30 text-black border-2 border-red-400/60'
                : 'bg-white text-black border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            Ajouter point
          </button>
        </div>
        {isPlacing && (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-black">
              Cliquez sur la carte pour placer : <strong className="text-black">{PLACEMENT_LABELS[placementMode]}</strong>
            </p>
            <button
              type="button"
              onClick={onCancelPlacement}
              className="rounded-lg px-2 py-1.5 text-xs font-medium bg-red-500/20 text-black border border-red-400/40 hover:bg-red-500/30 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Level-specific content */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  )
}

export default ControlPanel



