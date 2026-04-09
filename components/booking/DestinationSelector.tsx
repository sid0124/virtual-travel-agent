"use client"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

type DestinationSelectorProps = {
  destinations: string[]
  selectedDestination: string
  onChange: (destination: string) => void
  currentOrigin: string
  disabled?: boolean
  helperText?: string
}

export function DestinationSelector({
  destinations,
  selectedDestination,
  onChange,
  currentOrigin,
  disabled = false,
  helperText,
}: DestinationSelectorProps) {
  if (destinations.length === 0) return null

  return (
    <div className="mt-5 rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Booking focus</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">Choose the destination you want to book right now</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {helperText || "Switch the active stop to update the hotel and flight recommendations shown in the booking workspace."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
            Origin: {currentOrigin}
          </Badge>
          <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
            {destinations.length} destination{destinations.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="flex flex-wrap gap-2">
          {destinations.map((destination) => {
            const isActive = destination === selectedDestination

            return (
              <button
                key={destination}
                type="button"
                onClick={() => onChange(destination)}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "border-sky-300 bg-sky-50 text-sky-900 shadow-[0_10px_24px_rgba(14,165,233,0.12)]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-800",
                  disabled ? "cursor-not-allowed opacity-60" : ""
                )}
              >
                {destination}
              </button>
            )
          })}
        </div>

        <Select value={selectedDestination} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full rounded-full border-slate-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((destination) => (
              <SelectItem key={destination} value={destination}>
                {destination}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Badge variant="outline" className="mt-4 rounded-full border-sky-200 bg-white px-3 py-1 text-sky-800">
        Route: {currentOrigin} → {selectedDestination}
      </Badge>
    </div>
  )
}
