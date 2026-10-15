import RouteMap from "./RouteMap"
import type { Route } from "../types"

interface Props {
  route: Route
  onClose: () => void
}

export default function RouteMapModal({ route, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-purple-500/20"
        style={{ background: "#0d0520", height: "min(720px, 90vh)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-purple-500/10">
          <div>
            <h3
              className="text-base font-semibold text-white"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              {route.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs text-purple-300/50">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  className="w-3.5 h-3.5 text-purple-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                  />
                </svg>
                {route.origin}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-3 h-3 text-purple-400/40 shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
              <span className="flex items-center gap-1 text-xs text-purple-300/50">
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-3.5 h-3.5 text-fuchsia-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.54 22.351l.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                    clipRule="evenodd"
                  />
                </svg>
                {route.destination}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-purple-300/40 hover:text-white transition-colors ml-4 mt-0.5"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Route info strip */}
        <div
          className="flex items-center gap-6 px-5 py-2.5 border-b border-purple-500/10 text-xs text-purple-300/50"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <span>
            🕐 {route.departureTime} / {route.returnTime}
          </span>
          <span>
            💺 {route.occupiedSeats}/{route.seats} vagas
          </span>
          {route.price > 0 && <span>💰 R$ {route.price}/mês</span>}
          <span>{route.days.join(", ")}</span>
        </div>

        {/* Map */}
        <div className="min-h-0 flex-1">
          <RouteMap
            origin={route.origin}
            destination={route.destination}
            pickupPoints={route.pickupPoints}
          />
        </div>
      </div>
    </div>
  )
}
