"use client"

import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, GripVertical, MapPin, Route, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type TravelOrderBuilderProps = {
  route: string[]
  isConfirmed: boolean
  onMove: (index: number, direction: "up" | "down") => void
  onConfirm: () => void
}

export function TravelOrderBuilder({ route, isConfirmed, onMove, onConfirm }: TravelOrderBuilderProps) {
  return (
    <Card className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,249,255,0.98)_100%)] shadow-[0_18px_45px_rgba(148,163,184,0.08)]">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Journey route builder</p>
            <CardTitle className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-950">
              <Route className="h-5 w-5 text-sky-600" />
              Plan your travel order
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Reorder your stops before you lock the journey. Wanderly uses this route to surface the most relevant flights and stays for each segment.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
              {Math.max(route.length - 1, 0)} stop{route.length - 1 === 1 ? "" : "s"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-3 py-1",
                isConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {isConfirmed ? "Route confirmed" : "Route draft"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {route.map((city, idx) => {
              const isOrigin = idx === 0

              return (
                <div
                  key={`${city}-${idx}`}
                  className={cn(
                    "relative overflow-hidden rounded-[24px] border p-4 transition",
                    isOrigin
                      ? "border-sky-300 bg-[linear-gradient(135deg,rgba(224,242,254,0.9)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_14px_35px_rgba(14,165,233,0.10)]"
                      : "border-slate-200/80 bg-white/90 shadow-[0_12px_28px_rgba(148,163,184,0.08)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl border",
                          isOrigin ? "border-sky-200 bg-white text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600"
                        )}
                      >
                        {isOrigin ? <MapPin className="h-5 w-5" /> : <GripVertical className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {isOrigin ? "Origin" : `Stop ${idx}`}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{city}</p>
                      </div>
                    </div>

                    {!isOrigin ? (
                      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1">
                        <button
                          type="button"
                          onClick={() => onMove(idx, "up")}
                          disabled={idx <= 1}
                          className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${city} up`}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMove(idx, "down")}
                          disabled={idx === route.length - 1}
                          className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Move ${city} down`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {idx < route.length - 1 ? (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                      <span className="font-medium">Next</span>
                      <ArrowRight className="h-4 w-4 text-sky-600" />
                      <span className="truncate text-slate-700">{route[idx + 1]}</span>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-slate-500">Final stop in your current booking route.</div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-[26px] border border-slate-200/20 bg-slate-950 p-5 text-white shadow-[0_16px_35px_rgba(15,23,42,0.24)]">
            <div className="flex items-center gap-2 text-sky-200">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em]">Booking readiness</p>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">
              {isConfirmed ? "Route locked and ready" : "Finalize your order"}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {isConfirmed
                ? "Your route is confirmed. Wanderly will keep hotel and flight recommendations aligned to this travel sequence."
                : "Confirming the route unlocks segment-aware results, accurate subtotals, and a clearer booking progression."}
            </p>

            <Button
              onClick={onConfirm}
              className={cn(
                "mt-6 w-full rounded-full border-0 text-sm font-medium",
                isConfirmed ? "bg-emerald-500 text-white hover:bg-emerald-500" : "bg-white text-slate-950 hover:bg-slate-100"
              )}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {isConfirmed ? "Route confirmed" : "Confirm route"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
