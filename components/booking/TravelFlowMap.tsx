"use client"

import { CalendarDays, MapPin, Plane } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type TravelSegment = {
  from: string
  to: string
  distanceKm: number | null
  estimatedHours: number | null
  departureDate?: string
}

type TravelFlowMapProps = {
  route: string[]
  activeDestination: string
  segments: TravelSegment[]
}

function formatTimelineDate(value?: string) {
  if (!value) return "Date to be planned"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Date to be planned"
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function TravelFlowMap({ route, activeDestination, segments }: TravelFlowMapProps) {
  if (route.length < 2) return null

  return (
    <div className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Journey timeline</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">Track the active leg of your trip</p>
          <p className="mt-1 text-sm text-slate-600">Switch destinations above to update the hotels and flights shown for the current segment.</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
          {segments.length} leg{segments.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-3">
          {route.map((city, idx) => {
            const isActive = city === activeDestination
            const isOrigin = idx === 0

            return (
              <div key={`flow-${city}-${idx}`} className="flex items-stretch gap-3">
                <div
                  className={cn(
                    "relative min-w-[180px] rounded-[24px] border p-4",
                    isActive
                      ? "border-sky-300 bg-[linear-gradient(135deg,rgba(224,242,254,0.9)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_14px_35px_rgba(14,165,233,0.10)]"
                      : "border-slate-200/80 bg-white/92 shadow-[0_12px_28px_rgba(148,163,184,0.08)]",
                    isOrigin && !isActive ? "border-sky-200 bg-sky-50/70" : ""
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-2xl border",
                        isActive ? "border-sky-200 bg-white text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600",
                        isOrigin && !isActive ? "border-sky-200 bg-white text-sky-700" : ""
                      )}
                    >
                      {isOrigin ? <MapPin className="h-5 w-5" /> : <Plane className="h-5 w-5" />}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                        isActive ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {isOrigin ? "Origin" : isActive ? "Active stop" : `Stop ${idx}`}
                    </span>
                  </div>

                  <div className="mt-4">
                    <p className="text-lg font-semibold text-slate-950">{city}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isOrigin ? "Starting point for this route" : isActive ? "Currently booking this destination" : "Upcoming destination"}
                    </p>
                  </div>
                </div>

                {idx < route.length - 1 ? (
                  <div className="flex min-w-[210px] items-center">
                    <div
                      className={cn(
                        "w-full rounded-[22px] border p-4",
                        segments[idx] && segments[idx].to === activeDestination ? "border-sky-200 bg-sky-50/80" : "border-slate-200/80 bg-white/90"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Plane className="h-4 w-4 text-sky-600" />
                          <span className="text-sm font-semibold">
                            {segments[idx]?.distanceKm ? `~${Math.round(segments[idx].distanceKm as number).toLocaleString()} km` : "Distance pending"}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {segments[idx]?.estimatedHours ? `~${segments[idx].estimatedHours.toFixed(1)}h` : "Timing soon"}
                        </span>
                      </div>

                      <div className="mt-3 h-px w-full bg-gradient-to-r from-sky-200 via-slate-200 to-sky-200" />

                      <div className="mt-3 flex items-start gap-2 text-sm text-slate-600">
                        <CalendarDays className="mt-0.5 h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-700">{formatTimelineDate(segments[idx]?.departureDate)}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {segments[idx]?.from} to {segments[idx]?.to}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
