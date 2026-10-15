import { useEffect, useState } from "react"
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import {
  getDrivingRoute,
  searchAddress,
  type MapCoordinate,
} from "../lib/openStreetMap"
import type { PickupPoint } from "../types"

const originIcon = L.divIcon({
  className: "",
  html: `<div style="background:#9333ea;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

const destIcon = L.divIcon({
  className: "",
  html: `<div style="background:#c026d3;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function pickupIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#7e22ce;color:white;border:2px solid white;font:600 11px Inter,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.45)">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
    }
  }, [map, positions])

  return null
}

function SyncMapSize() {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    const invalidateSize = () => map.invalidateSize({ pan: false })
    const animationFrame = window.requestAnimationFrame(invalidateSize)
    const resizeObserver = new ResizeObserver(invalidateSize)
    resizeObserver.observe(container)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
    }
  }, [map])

  return null
}

interface Props {
  origin: string
  destination: string
  pickupPoints?: PickupPoint[]
}

type Status = "loading" | "ok" | "error"
const EMPTY_PICKUP_POINTS: PickupPoint[] = []

function distanceInKm(a: MapCoordinate, b: MapCoordinate) {
  const earthRadius = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = toRadians(b.lat - a.lat)
  const longitudeDelta = toRadians(b.lng - a.lng)
  const latitudeA = toRadians(a.lat)
  const latitudeB = toRadians(b.lat)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) *
      Math.cos(latitudeB) *
      Math.sin(longitudeDelta / 2) ** 2
  return (
    earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  )
}

function plausiblePickupPoints(
  origin: MapCoordinate,
  destination: MapCoordinate,
  points: PickupPoint[],
) {
  const directDistance = distanceInKm(origin, destination)
  return points.filter((point) => {
    const detour =
      distanceInKm(origin, point) + distanceInKm(point, destination)
    return detour <= directDistance * 5 + 100
  })
}

export default function RouteMap({
  origin,
  destination,
  pickupPoints = EMPTY_PICKUP_POINTS,
}: Props) {
  const [status, setStatus] = useState<Status>("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [routePoints, setRoutePoints] = useState<[number, number][]>([])
  const [originCoord, setOriginCoord] = useState<MapCoordinate | null>(null)
  const [destCoord, setDestCoord] = useState<MapCoordinate | null>(null)
  const [visiblePickupPoints, setVisiblePickupPoints] =
    useState<PickupPoint[]>(pickupPoints)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setErrorMsg("")
    setRoutePoints([])
    setOriginCoord(null)
    setDestCoord(null)
    setVisiblePickupPoints([])

    const load = async () => {
      try {
        const from = await searchAddress(origin)
        if (cancelled) return

        const to = await searchAddress(destination)
        if (cancelled) return

        setOriginCoord(from)
        setDestCoord(to)
        const routePickupPoints = plausiblePickupPoints(from, to, pickupPoints)
        setVisiblePickupPoints(routePickupPoints)

        const points = await getDrivingRoute([from, ...routePickupPoints, to])
        if (cancelled) return

        setRoutePoints(points)
        setStatus("ok")
      } catch (error) {
        if (!cancelled) {
          setErrorMsg(
            error instanceof Error ? error.message : "Erro ao carregar a rota.",
          )
          setStatus("error")
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [origin, destination, pickupPoints, retryCount])

  const center: [number, number] = originCoord
    ? [originCoord.lat, originCoord.lng]
    : [-15.7801, -47.9292]

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={5}
        style={{ width: "100%", height: "100%" }}
        zoomControl
      >
        <SyncMapSize />
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          subdomains="abc"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of <a href="https://www.hotosm.org/">HOT</a>'
        />
        {routePoints.length > 0 && (
          <>
            <Polyline
              positions={routePoints}
              pathOptions={{ color: "#9333ea", weight: 5, opacity: 0.85 }}
            />
            <FitBounds positions={routePoints} />
          </>
        )}
        {originCoord && (
          <Marker
            position={[originCoord.lat, originCoord.lng]}
            icon={originIcon}
          >
            <Popup>{origin}</Popup>
          </Marker>
        )}
        {visiblePickupPoints.map((point, index) => (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={pickupIcon(index)}
          >
            <Tooltip permanent direction="top" offset={[0, -14]}>
              {point.name}
            </Tooltip>
            <Popup>
              <strong>{point.name}</strong>
              <br />
              {point.address}
            </Popup>
          </Marker>
        ))}
        {destCoord && (
          <Marker position={[destCoord.lat, destCoord.lng]} icon={destIcon}>
            <Popup>{destination}</Popup>
          </Marker>
        )}
      </MapContainer>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white"
            style={{
              background: "rgba(13,5,32,0.85)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            Calculando rota...
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#0d0520]/70 px-4">
          <div
            className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-red-500/30 px-5 py-4 text-center text-sm text-red-200"
            style={{
              background: "rgba(13,5,32,0.94)",
              backdropFilter: "blur(6px)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              className="h-5 w-5 shrink-0 text-red-300"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="rounded-lg border border-purple-400/30 bg-purple-500/15 px-3 py-1.5 font-medium text-purple-100 transition-colors hover:bg-purple-500/25"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
