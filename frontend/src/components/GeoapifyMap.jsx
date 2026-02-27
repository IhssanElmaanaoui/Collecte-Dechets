import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const defaultCenter = [33.5899, -7.6039] // Casablanca

/**
 * zones: [{ center: [lat, lon], radius: number (meters) }]
 * markers: [{ id, position: [lat, lon], label, type: 'depot' | 'collecte' }]
 * routes: [{ id, coords: [[lat, lon], ...], color }]
 */
export function GeoapifyMap({ apiKey, zones = [], markers = [], routes = [] }) {
  const hasKey = Boolean(apiKey)
  const tileStyle = hasKey ? 'osm-bright' : 'osm'

  return (
    <MapContainer
      center={defaultCenter}
      zoom={13}
      className="h-full w-full"
      zoomControl={true}
    >
      {hasKey ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.geoapify.com/">Geoapify</a>'
          url={`https://maps.geoapify.com/v1/tile/${tileStyle}/{z}/{x}/{y}.png?apiKey=${apiKey}`}
          maxZoom={20}
        />
      ) : (
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      {/* Zone(s) : cercle vert comme sur la maquette */}
      {zones.map((zone, idx) => (
        <Circle
          key={`zone-${idx}`}
          center={zone.center}
          radius={zone.radius}
          pathOptions={{
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.08,
            weight: 3,
          }}
        />
      ))}

      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.coords}
          pathOptions={{
            color: route.color || '#2563eb',
            weight: 5,
            opacity: 0.9,
          }}
        />
      ))}

      {/* Points : cercles rouges (collecte) ou verts (dépôt) */}
      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={m.position}
          radius={m.type === 'depot' ? 10 : 9}
          pathOptions={{
            color: m.type === 'depot' ? '#16a34a' : '#dc2626',
            fillColor: m.type === 'depot' ? '#16a34a' : '#dc2626',
            fillOpacity: 1,
            weight: 2,
          }}
        >
          {m.label && (
            <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
              <span className="font-medium">{m.label}</span>
            </Tooltip>
          )}
        </CircleMarker>
      ))}
    </MapContainer>
  )
}

export default GeoapifyMap

