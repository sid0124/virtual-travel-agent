"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type WeatherData = {
  city: string
  country: string
  tempC: number
  feelsLikeC: number
  humidity: number
  windKmh: number
  condition: string
  description: string
  icon?: string
}

export function WeatherCard({ w }: { w: WeatherData }) {
  return (
    <Card className="mt-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">
            {w.city}, {w.country}
          </div>
          <div className="text-xs text-muted-foreground capitalize">
            {w.description}
          </div>
        </div>

        <Badge variant="secondary" className="text-sm">
          {w.tempC}°C
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="rounded-md border p-2">
          <div className="text-[11px]">Feels like</div>
          <div className="font-medium text-foreground">{w.feelsLikeC}°C</div>
        </div>

        <div className="rounded-md border p-2">
          <div className="text-[11px]">Humidity</div>
          <div className="font-medium text-foreground">{w.humidity}%</div>
        </div>

        <div className="rounded-md border p-2">
          <div className="text-[11px]">Wind</div>
          <div className="font-medium text-foreground">{w.windKmh} km/h</div>
        </div>
      </div>
    </Card>
  )
}
