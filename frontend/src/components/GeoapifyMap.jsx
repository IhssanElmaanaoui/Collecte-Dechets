import { useCallback, useState, useEffect, useRef, Fragment } from 'react'
import { MapContainer, TileLayer, Circle, CircleMarker, Polyline, Tooltip, useMapEvents, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER = [33.5899, -7.6039]

const MARKER_STYLE = {
  depot: { color: '#16a34a', fillColor: '#16a34a', radius: 9 },
  decharge: { color: '#ea580c', fillColor: '#ea580c', radius: 9 },
  point: { color: '#dc2626', fillColor: '#dc2626', radius: 8 },
  collecte: { color: '#dc2626', fillColor: '#dc2626', radius: 8 },
}

const ROUTE_ANIMATION_DURATION_MS = 5000

/** Polyline qui se dessine progressivement (animation de trajet). */
function AnimatedPolyline({ positions, color, onComplete }) {
  const [visibleCount, setVisibleCount] = useState(1)
  const startRef = useRef(Date.now())
  const rafRef = useRef(null)

  useEffect(() => {
    if (!positions?.length) return
    setVisibleCount(1)
    startRef.current = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startRef.current
      const progress = Math.min(1, elapsed / ROUTE_ANIMATION_DURATION_MS)
      const eased = 1 - (1 - progress) ** 2
      const count = Math.max(1, Math.round(positions.length * eased))
      setVisibleCount(count)
      if (count < positions.length) {
        rafRef.current = requestAnimationFrame(animate)
      } else if (onComplete) onComplete()
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [positions])

  const visiblePositions = positions?.slice(0, visibleCount) ?? []
  if (visiblePositions.length < 2) return null

  return (
    <Polyline
      positions={visiblePositions}
      pathOptions={{
        color: color || '#2563eb',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  )
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: useCallback((e) => {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }, [onMapClick]),
  })
  return null
}

/** Position d'un point à `radius` mètres au nord du centre (pour la poignée de redimensionnement). */
function edgePosition(center, radius) {
  const [lat, lon] = center
  const metersPerDegreeLat = 111320
  return [lat + (radius || 500) / metersPerDegreeLat, lon]
}

const resizeHandleIcon = L.divIcon({
  className: 'zone-resize-handle',
  html: '<div style="width:14px;height:14px;border:2px solid #0ea5e9;background:#06b6d4;border-radius:50%;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

export function GeoapifyMap({
  apiKey,
  zones = [],
  markers = [],
  routes = [],
  onMapClick,
  onZoneResize,
}) {
  const hasKey = Boolean(apiKey)
  const tileStyle = hasKey ? 'osm-bright' : 'osm'

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={13}
      className="h-full w-full rounded-2xl"
      zoomControl={true}
    >
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}
      {hasKey ? (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.geoapify.com/">Geoapify</a>'
          url={`https://maps.geoapify.com/v1/tile/${tileStyle}/{z}/{x}/{y}.png?apiKey=${apiKey}`}
          maxZoom={20}
        />
      ) : (
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}

      {zones.map((zone, idx) => (
        <Circle
          key={`zone-${idx}`}
          center={zone.center}
          radius={zone.radius}
          pathOptions={{
            color: '#0ea5e9',
            fillColor: '#06b6d4',
            fillOpacity: 0.12,
            weight: 2.5,
          }}
        />
      ))}
      {onZoneResize &&
        zones.map((zone, idx) => (
          <Marker
            key={`zone-handle-${idx}`}
            position={edgePosition(zone.center, zone.radius)}
            icon={resizeHandleIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                onZoneResize(idx, lat, lng)
              },
            }}
          />
        ))}

      {routes.map((route) => (
        <Fragment key={route.id}>
          <Polyline
            positions={route.coords}
            pathOptions={{
              color: route.color || '#2563eb',
              weight: 8,
              opacity: 0.25,
            }}
          />
          <AnimatedPolyline
            positions={route.coords}
            color={route.color || '#2563eb'}
          />
        </Fragment>
      ))}

      {markers.map((m) => {
        const style = MARKER_STYLE[m.type] || MARKER_STYLE.point
        const color = (m.type === 'point' || m.type === 'collecte') && m.routeColor
          ? m.routeColor
          : style.color
        const fillColor = (m.type === 'point' || m.type === 'collecte') && m.routeColor
          ? m.routeColor
          : style.fillColor
        return (
          <CircleMarker
            key={m.id}
            center={m.position}
            radius={style.radius}
            pathOptions={{
              color,
              fillColor,
              fillOpacity: 1,
              weight: 2.5,
            }}
          >
            {m.label && (
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                <span className="font-medium">{m.label}</span>
              </Tooltip>
            )}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

export default GeoapifyMap
