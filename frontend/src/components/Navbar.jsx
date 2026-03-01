import { useRef } from 'react'

export function Navbar({
  apiKey,
  onApiKeyChange,
  nombreCamions,
  onNombreCamionsChange,
  capaciteParCamion,
  onCapaciteParCamionChange,
  debutPlanification,
  onDebutPlanificationChange,
  finPlanification,
  onFinPlanificationChange,
  debutPause,
  onDebutPauseChange,
  finPause,
  onFinPauseChange,
  serviceDefautPoint,
  onServiceDefautPointChange,
  contrainteTemporelleOn,
  onContrainteTemporelleChange,
  onCalculerChemins,
  calculLoading,
  onPoserDepot,
  onPoserDecharge,
  onAjouterZone,
  onAjouterPoint,
  onViderCarte,
  onUndo,
  canUndo,
  onExportPlan,
  onImportPlan,
  mapMode,
  hasZone = false,
}) {
  const fileInputRef = useRef(null)

  return (
    <nav className="rounded-xl bg-white backdrop-blur-md border border-slate-200 shadow-lg px-4 py-3 flex flex-col gap-3 shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Clé API Geoapify</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="apiKey"
            className="w-36 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black placeholder:text-black focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Nb camions</span>
          <input
            type="number"
            min={1}
            max={20}
            value={nombreCamions}
            onChange={(e) => onNombreCamionsChange(Number(e.target.value) || 1)}
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Capacité/camion (kg)</span>
          <input
            type="number"
            min={100}
            step={100}
            value={capaciteParCamion}
            onChange={(e) => onCapaciteParCamionChange(Number(e.target.value) || 1000)}
            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <button
          type="button"
          onClick={onCalculerChemins}
          disabled={calculLoading}
          className="rounded-xl bg-indigo-500 px-3 py-1.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-50 whitespace-nowrap transition-colors"
        >
          {calculLoading ? 'Calcul…' : 'Calculer les chemins'}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Début planif.</span>
          <input
            type="time"
            value={debutPlanification}
            onChange={(e) => onDebutPlanificationChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Fin planif.</span>
          <input
            type="time"
            value={finPlanification}
            onChange={(e) => onFinPlanificationChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Début pause</span>
          <input
            type="time"
            value={debutPause}
            onChange={(e) => onDebutPauseChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Fin pause</span>
          <input
            type="time"
            value={finPause}
            onChange={(e) => onFinPauseChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-black whitespace-nowrap">Service défaut/point (min)</span>
          <input
            type="number"
            min={0}
            max={60}
            value={serviceDefautPoint}
            onChange={(e) => onServiceDefautPointChange(Number(e.target.value) || 0)}
            className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-black"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-black whitespace-nowrap">Contrainte temporelle</span>
          <input
            type="checkbox"
            checked={contrainteTemporelleOn}
            onChange={(e) => onContrainteTemporelleChange(e.target.checked)}
            className="rounded border-slate-300"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onPoserDepot}
          className={`rounded-xl px-2 py-1.5 border whitespace-nowrap transition-colors ${mapMode === 'depot' ? 'border-emerald-400/60 bg-emerald-500/20 text-black' : 'border-slate-200 bg-white text-black hover:bg-slate-50'}`}
        >
          Poser dépôt
        </button>
        <button
          type="button"
          onClick={onPoserDecharge}
          className={`rounded-xl px-2 py-1.5 border whitespace-nowrap transition-colors ${mapMode === 'decharge' ? 'border-amber-400/60 bg-amber-500/20 text-black' : 'border-slate-200 bg-white text-black hover:bg-slate-50'}`}
        >
          Poser décharge
        </button>
        <button
          type="button"
          onClick={onAjouterZone}
          className={`rounded-xl px-2 py-1.5 border whitespace-nowrap transition-colors ${mapMode === 'zone' ? 'border-cyan-400/60 bg-cyan-500/20 text-black' : 'border-slate-200 bg-white text-black hover:bg-slate-50'}`}
        >
          Ajouter zone
        </button>
        <button
          type="button"
          onClick={onAjouterPoint}
          disabled={!hasZone}
          className={`rounded-xl px-2 py-1.5 border whitespace-nowrap transition-colors ${mapMode === 'point' ? 'border-red-400/60 bg-red-500/20 text-black' : 'border-slate-200 bg-white text-black hover:bg-slate-50'} ${!hasZone ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Ajouter point
        </button>
        <button
          type="button"
          onClick={onViderCarte}
          className="rounded-xl px-2 py-1.5 border border-red-400/40 bg-red-500/10 text-black hover:bg-red-500/20 whitespace-nowrap transition-colors"
        >
          Vider la carte
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded-xl px-2 py-1.5 border border-slate-200 bg-white text-black hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap transition-colors"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onExportPlan}
          className="rounded-xl px-2 py-1.5 border border-slate-200 bg-white text-black hover:bg-slate-50 whitespace-nowrap transition-colors"
        >
          Export plan JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-xl px-2 py-1.5 border border-slate-200 bg-white text-black hover:bg-slate-50 whitespace-nowrap transition-colors"
        >
          Import plan JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportPlan(file)
            e.target.value = ''
          }}
        />
      </div>
    </nav>
  )
}

export default Navbar



