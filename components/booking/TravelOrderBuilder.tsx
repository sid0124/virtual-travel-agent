"use client"

import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, MapPin, Route } from "lucide-react"
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
    <Card className="mb-8 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Route className="h-5 w-5 text-primary" />
          Plan your travel order
        </CardTitle>
        <p className="text-sm text-muted-foreground">Where do you want to travel first? Arrange your journey.</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {route.map((city, idx) => (
            <div key={`${city}-${idx}`} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-sm",
                  idx === 0 ? "border-primary bg-primary/10" : ""
                )}
              >
                {idx === 0 ? (
                  <MapPin className="h-4 w-4 text-primary" />
                ) : (
                  <span className="px-1 text-xs font-bold text-muted-foreground">{idx}</span>
                )}
                <span className="font-medium">{city}</span>

                {idx > 0 && (
                  <div className="ml-2 flex items-center gap-1 border-l pl-2">
                    <button
                      onClick={() => onMove(idx, "up")}
                      disabled={idx <= 1}
                      className="hover:text-primary disabled:opacity-30"
                      aria-label={`Move ${city} up`}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onMove(idx, "down")}
                      disabled={idx === route.length - 1}
                      className="hover:text-primary disabled:opacity-30"
                      aria-label={`Move ${city} down`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {idx < route.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end">
          <Button onClick={onConfirm} className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {isConfirmed ? "Route Confirmed" : "Confirm Route"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

