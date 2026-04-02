"use client"

import { CalendarDays, MapPin, Plane } from "lucide-react"
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

export function TravelFlowMap({ route, activeDestination, segments }: TravelFlowMapProps) {
  if (route.length < 2) return null

  return (
    <div className="relative mb-8 overflow-x-auto pb-8 pt-2">
      <div className="flex min-w-max items-center px-4">
        {route.map((city, idx) => {
          const isActive = city === activeDestination
          const isOrigin = idx === 0

          return (
            <div key={`flow-${city}-${idx}`} className="flex items-center">
              <div className="relative flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors",
                    isActive ? "border-primary bg-primary text-primary-foreground shadow-lg" : "border-muted-foreground/30 bg-muted text-muted-foreground",
                    isOrigin && !isActive ? "border-primary/50 bg-primary/10 text-primary" : ""
                  )}
                >
                  {isOrigin ? <MapPin className="h-6 w-6" /> : <Plane className="h-6 w-6" />}
                </div>
                <span className={cn("absolute -bottom-6 whitespace-nowrap text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {city}
                </span>
              </div>

              {idx < route.length - 1 && (
                <div className="mx-2 flex w-36 flex-col items-center">
                  <div className={cn("h-1 w-24 rounded-full", segments[idx] && segments[idx].to === activeDestination ? "bg-primary" : "bg-muted")} />
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Plane className="h-3 w-3" />
                    <span>
                      {segments[idx]?.distanceKm ? `${Math.round(segments[idx].distanceKm)} km` : "Distance n/a"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    <span>
                      {segments[idx]?.departureDate ? segments[idx].departureDate : "Date n/a"}
                    </span>
                    {segments[idx]?.estimatedHours && <span>{`• ${segments[idx].estimatedHours.toFixed(1)}h`}</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

