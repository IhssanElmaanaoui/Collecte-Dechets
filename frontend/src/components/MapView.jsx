import { GeoapifyMap } from './GeoapifyMap'

export function MapView({
  placementMode,
  onMapClick,
  apiKey,
  markers,
  zones,
  routes,
  onZoneResize,
}) {
  return (
    <div className="h-full w-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-white ring-2 ring-white/5">
      <GeoapifyMap
        apiKey={apiKey}
        zones={zones}
        markers={markers}
        routes={routes}
        onMapClick={placementMode ? onMapClick : undefined}
        onZoneResize={onZoneResize}
      />
    </div>
  )
}

export default MapView


