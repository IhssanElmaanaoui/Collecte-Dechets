import { useRef } from 'react'

const ROUTE_COLORS = ['#22c55e', '#2563eb', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899']

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
}) {
  const fileInputRef = useRef(null)

  return (
    <nav className="bg-slate-900/95 border-b border-slate-700 px-3 py-2 flex flex-col gap-2 shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Clé API Geoapify</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="apiKey"
            className="w-36 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100 placeholder:text-slate-500"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Nb camions</span>
          <input
            type="number"
            min={1}
            max={20}
            value={nombreCamions}
            onChange={(e) => onNombreCamionsChange(Number(e.target.value) || 1)}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Capacité/camion (kg)</span>
          <input
            type="number"
            min={100}
            step={100}
            value={capaciteParCamion}
            onChange={(e) => onCapaciteParCamionChange(Number(e.target.value) || 1000)}
            className="w-20 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <button
          type="button"
          onClick={onCalculerChemins}
          disabled={calculLoading}
          className="rounded bg-brand-500 px-3 py-1.5 font-medium text-white hover:bg-brand-400 disabled:opacity-50 whitespace-nowrap"
        >
          {calculLoading ? 'Calcul…' : 'Calculer les chemins'}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Début planif.</span>
          <input
            type="time"
            value={debutPlanification}
            onChange={(e) => onDebutPlanificationChange(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Fin planif.</span>
          <input
            type="time"
            value={finPlanification}
            onChange={(e) => onFinPlanificationChange(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Début pause</span>
          <input
            type="time"
            value={debutPause}
            onChange={(e) => onDebutPauseChange(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Fin pause</span>
          <input
            type="time"
            value={finPause}
            onChange={(e) => onFinPauseChange(e.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-slate-400 whitespace-nowrap">Service défaut/point (min)</span>
          <input
            type="number"
            min={0}
            max={60}
            value={serviceDefautPoint}
            onChange={(e) => onServiceDefautPointChange(Number(e.target.value) || 0)}
            className="w-14 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-400 whitespace-nowrap">Contrainte temporelle</span>
          <input
            type="checkbox"
            checked={contrainteTemporelleOn}
            onChange={(e) => onContrainteTemporelleChange(e.target.checked)}
            className="rounded border-slate-600"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={onPoserDepot}
          className={`rounded px-2 py-1.5 border whitespace-nowrap ${mapMode === 'depot' ? 'border-brand-500 bg-brand-500/20 text-brand-200' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >
          Poser dépôt
        </button>
        <button
          type="button"
          onClick={onPoserDecharge}
          className={`rounded px-2 py-1.5 border whitespace-nowrap ${mapMode === 'decharge' ? 'border-brand-500 bg-brand-500/20 text-brand-200' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >
          Poser décharge
        </button>
        <button
          type="button"
          onClick={onAjouterZone}
          className={`rounded px-2 py-1.5 border whitespace-nowrap ${mapMode === 'zone' ? 'border-brand-500 bg-brand-500/20 text-brand-200' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >
          Ajouter zone
        </button>
        <button
          type="button"
          onClick={onAjouterPoint}
          className={`rounded px-2 py-1.5 border whitespace-nowrap ${mapMode === 'point' ? 'border-brand-500 bg-brand-500/20 text-brand-200' : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >
          Ajouter point
        </button>
        <button
          type="button"
          onClick={onViderCarte}
          className="rounded px-2 py-1.5 border border-red-900/60 bg-slate-800 text-red-200 hover:bg-red-900/20 whitespace-nowrap"
        >
          Vider la carte
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded px-2 py-1.5 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={onExportPlan}
          className="rounded px-2 py-1.5 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 whitespace-nowrap"
        >
          Export plan JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded px-2 py-1.5 border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 whitespace-nowrap"
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
