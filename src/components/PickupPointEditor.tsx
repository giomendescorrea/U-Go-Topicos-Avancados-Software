import { useEffect, useMemo, useState } from "react"
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import {
  reverseGeocode,
  searchAddress,
  type MapCoordinate,
} from "../lib/openStreetMap"
import type { PickupPoint } from "../types"

interface Props {
  points: PickupPoint[]
  onChange: (points: PickupPoint[]) => void
  readOnly?: boolean
}

function numberedIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#9333ea;color:white;border:2px solid white;font:600 12px Inter,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.45)">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function MapController({ focus }: { focus: MapCoordinate | null }) {
  const map = useMap()

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() =>
      map.invalidateSize({ pan: false }),
    )
    resizeObserver.observe(map.getContainer())
    const frame = window.requestAnimationFrame(() =>
      map.invalidateSize({ pan: false }),
    )

    return () => {
      resizeObserver.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [map])

  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 16)
  }, [focus, map])

  return null
}

function MapClickHandler({
  onSelect,
}: {
  onSelect: (coordinate: MapCoordinate) => void
}) {
  useMapEvents({
    click: (event) => onSelect(event.latlng),
  })
  return null
}

export default function PickupPointEditor({
  points,
  onChange,
  readOnly = false,
}: Props) {
  const [query, setQuery] = useState("")
  const [focus, setFocus] = useState<MapCoordinate | null>(points[0] ?? null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(
    "Busque um endereço ou clique no mapa para adicionar um ponto.",
  )

  const icons = useMemo(
    () => points.map((_, index) => numberedIcon(index)),
    [points],
  )

  const addPoint = async (coordinate: MapCoordinate, fallbackName?: string) => {
    setLoading(true)
    setMessage("Identificando o endereço...")

    try {
      let usedCoordinateFallback = false
      let result: MapCoordinate & { displayName: string }
      try {
        result = fallbackName
          ? { ...coordinate, displayName: fallbackName }
          : await reverseGeocode(coordinate)
      } catch {
        usedCoordinateFallback = true
        result = {
          ...coordinate,
          displayName: `${coordinate.lat.toFixed(6)}, ${coordinate.lng.toFixed(6)}`,
        }
      }
      const defaultName =
        result.displayName.split(",")[0]?.trim() || `Ponto ${points.length + 1}`
      const point: PickupPoint = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: defaultName,
        address: result.displayName,
        lat: result.lat,
        lng: result.lng,
      }

      onChange([...points, point])
      setFocus(point)
      setQuery("")
      setMessage(
        usedCoordinateFallback
          ? "Ponto adicionado pelas coordenadas. Edite o nome se necessário."
          : "Ponto adicionado. Edite o nome na lista se necessário.",
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar o ponto.",
      )
    } finally {
      setLoading(false)
    }
  }

  const search = async () => {
    if (!query.trim() || loading) return

    setLoading(true)
    setMessage("Buscando endereço...")
    try {
      const result = await searchAddress(query.trim())
      await addPoint(result, result.displayName)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Endereço não encontrado.",
      )
      setLoading(false)
    }
  }

  const updatePoint = (id: string, name: string) => {
    onChange(
      points.map((point) => (point.id === id ? { ...point, name } : point)),
    )
  }

  const removePoint = (id: string) => {
    onChange(points.filter((point) => point.id !== id))
    setMessage("Ponto removido.")
  }

  const movePoint = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= points.length) return
    const reordered = [...points]
    ;[reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ]
    onChange(reordered)
  }

  return (
    <section className="space-y-3 rounded-2xl border border-purple-500/20 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-semibold text-white">
            Pontos de embarque
          </h4>
          <p className="mt-1 text-xs text-purple-300/50">
            {readOnly
              ? "Os pontos serão copiados da rota original."
              : "Adicione os pontos na ordem em que o veículo passará."}
          </p>
        </div>
        <span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-medium text-purple-200">
          {points.length} {points.length === 1 ? "ponto" : "pontos"}
        </span>
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                search()
              }
            }}
            placeholder="Busque uma rua, praça ou referência"
            className="min-w-0 flex-1 rounded-xl border border-purple-500/25 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-purple-300/30 focus:border-purple-500"
          />
          <button
            type="button"
            onClick={search}
            disabled={!query.trim() || loading}
            className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      )}

      <div className="h-72 overflow-hidden rounded-xl border border-purple-500/20">
        <MapContainer
          center={focus ? [focus.lat, focus.lng] : [-15.7801, -47.9292]}
          zoom={focus ? 15 : 4}
          className="h-full w-full"
          zoomControl
        >
          <MapController focus={focus} />
          {!readOnly && (
            <MapClickHandler
              onSelect={(coordinate) => {
                if (!loading) addPoint(coordinate)
              }}
            />
          )}
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            subdomains="abc"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles courtesy of <a href="https://www.hotosm.org/">HOT</a>'
          />
          {points.map((point, index) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              icon={icons[index]}
              eventHandlers={{ click: () => setFocus(point) }}
            >
              <Tooltip permanent direction="top" offset={[0, -16]}>
                {point.name}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {!readOnly && (
        <p
          className={`text-xs ${
            message.includes("não") || message.includes("limite")
              ? "text-red-300"
              : "text-purple-300/55"
          }`}
          aria-live="polite"
        >
          {message}
        </p>
      )}

      {points.length > 0 && (
        <ol className="space-y-2">
          {points.map((point, index) => (
            <li
              key={point.id}
              className="flex items-center gap-3 rounded-xl border border-purple-500/15 bg-[#0d0520]/50 p-3"
            >
              <button
                type="button"
                onClick={() => setFocus(point)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-600 text-xs font-bold text-white"
                title="Centralizar no mapa"
              >
                {index + 1}
              </button>
              <div className="min-w-0 flex-1">
                <input
                  value={point.name}
                  onChange={(event) =>
                    updatePoint(point.id, event.target.value)
                  }
                  readOnly={readOnly}
                  aria-label={`Nome do ponto ${index + 1}`}
                  className={`w-full border-0 bg-transparent p-0 text-sm font-medium text-white focus:ring-0 ${
                    readOnly ? "cursor-default" : ""
                  }`}
                />
                <p className="mt-0.5 truncate text-xs text-purple-300/40">
                  {point.address}
                </p>
              </div>
              {!readOnly && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => movePoint(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 text-purple-300/50 hover:text-white disabled:opacity-20"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => movePoint(index, 1)}
                    disabled={index === points.length - 1}
                    className="p-1.5 text-purple-300/50 hover:text-white disabled:opacity-20"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(point.id)}
                    className="p-1.5 text-red-300/60 hover:text-red-300"
                    title="Remover ponto"
                  >
                    ×
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
