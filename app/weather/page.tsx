"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/currency"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSun,
  Snowflake,
  Thermometer,
  Droplets,
  Wind,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react"
import { destinations, destinationWeather, parisWeather, type WeatherEntry } from "@/lib/data"
import { cn } from "@/lib/utils"
import Link from "next/link"

function getWeatherIcon(condition: string) {
  const lower = condition.toLowerCase()
  if (lower.includes("snow")) return Snowflake
  if (lower.includes("rain")) return CloudRain
  if (lower.includes("hot") || lower.includes("sunny") || lower.includes("dry") || lower.includes("clear")) return Sun
  if (lower.includes("warm") || lower.includes("pleasant") || lower.includes("mild")) return CloudSun
  return Cloud
}

function getWeatherIconColor(condition: string) {
  const lower = condition.toLowerCase()
  if (lower.includes("hot") || lower.includes("sunny") || lower.includes("clear")) return "text-chart-4"
  if (lower.includes("rain") || lower.includes("snow")) return "text-chart-1"
  if (lower.includes("warm") || lower.includes("pleasant")) return "text-chart-2"
  return "text-muted-foreground"
}

const availableCities = ["Paris", "New York City", "Beijing", "Dubai", "Rome"]

type SelectedPlace = {
  id?: string | number
  name?: string
  city?: string
  country?: string
  entryFee?: number
  avgVisitDuration?: number
  famousFor?: string
  type?: string
  latitude?: number
  longitude?: number
  lat?: number
  lng?: number
}

type LiveWeather = {
  city: string
  country: string
  placeName?: string
  tempC: number
  feelsLikeC: number
  humidity: number
  windKmh: number
  rainMm: number
  visibilityKm: number | null
  condition: string
  description: string
  icon?: string
  observedAt: number
}

type ClimateResponse = {
  city?: string
  country?: string
  startYear?: number
  endYear?: number
  source?: string
  monthly?: WeatherEntry[]
}

function placeValueKey(place: SelectedPlace) {
  if (place?.id !== undefined && place?.id !== null && String(place.id).trim() !== "") {
    return `id:${String(place.id)}`
  }
  return `${String(place?.name || "").trim()}|${String(place?.city || "").trim()}|${String(place?.country || "").trim()}`.toLowerCase()
}

function placeLatitude(place: SelectedPlace | null) {
  if (!place) return undefined
  const value = place.latitude ?? place.lat
  return typeof value === "number" ? value : Number(value)
}

function placeLongitude(place: SelectedPlace | null) {
  if (!place) return undefined
  const value = place.longitude ?? place.lng
  return typeof value === "number" ? value : Number(value)
}

export default function WeatherPage() {
  const [selectedCity, setSelectedCity] = useState("Paris")
  const [tripContext, setTripContext] = useState<any>(null)
  const [selectedPlaceKey, setSelectedPlaceKey] = useState("")
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [climateWeather, setClimateWeather] = useState<WeatherEntry[] | null>(null)
  const [climateMeta, setClimateMeta] = useState<ClimateResponse | null>(null)
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateError, setClimateError] = useState<string | null>(null)

  useEffect(() => {
    const contextStr = localStorage.getItem("WANDERLY_TRIP_CONTEXT")
    if (!contextStr) return
    try {
      const raw = JSON.parse(contextStr)
      setTripContext(raw?.tripContext || raw)
    } catch {
      // ignore malformed local data
    }
  }, [])

  const selectedPlaces = useMemo<SelectedPlace[]>(() => {
    if (!Array.isArray(tripContext?.selectedPlaces)) return []
    return tripContext.selectedPlaces
  }, [tripContext])

  const placeOptions = useMemo(() => {
    return selectedPlaces.map((place) => ({
      value: placeValueKey(place),
      label: `${place?.name || "Place"}${place?.city ? ` - ${place.city}` : ""}`,
      place,
    }))
  }, [selectedPlaces])

  useEffect(() => {
    if (!placeOptions.length) return
    if (selectedPlaceKey && placeOptions.some((option) => option.value === selectedPlaceKey)) return
    setSelectedPlaceKey(placeOptions[0].value)
  }, [placeOptions, selectedPlaceKey])

  const activePlace = useMemo(() => {
    if (!placeOptions.length) return null
    return placeOptions.find((option) => option.value === selectedPlaceKey)?.place || placeOptions[0].place
  }, [placeOptions, selectedPlaceKey])

  const weatherCity = activePlace?.city || selectedCity

  const monthlyWeather = useMemo(() => {
    if (Array.isArray(climateWeather) && climateWeather.length === 12) return climateWeather
    return destinationWeather[weatherCity] || parisWeather
  }, [weatherCity, climateWeather])

  const currentMonth = new Date().toLocaleString("en", { month: "short" })
  const currentWeatherEntry =
    monthlyWeather.find((w) => w.month === currentMonth) || monthlyWeather[0]

  useEffect(() => {
    let cancelled = false
    const loadClimateWeather = async () => {
      setClimateLoading(true)
      setClimateError(null)
      try {
        const res = await fetch("/api/weather/climate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: weatherCity,
            placeName: activePlace?.name,
            lat: placeLatitude(activePlace),
            lon: placeLongitude(activePlace),
          }),
        })
        const data = (await res.json()) as ClimateResponse & { error?: string }
        if (!res.ok) throw new Error(data?.error || "Failed to fetch climate data.")
        if (!cancelled) {
          setClimateWeather(Array.isArray(data?.monthly) ? data.monthly : null)
          setClimateMeta(data)
        }
      } catch (e: any) {
        if (!cancelled) {
          setClimateWeather(null)
          setClimateMeta(null)
          setClimateError(e?.message || "Failed to fetch climate data.")
        }
      } finally {
        if (!cancelled) setClimateLoading(false)
      }
    }

    const loadLiveWeather = async () => {
      setLiveLoading(true)
      setLiveError(null)
      try {
        const res = await fetch("/api/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: weatherCity,
            placeName: activePlace?.name,
            lat: placeLatitude(activePlace),
            lon: placeLongitude(activePlace),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to fetch live weather.")
        if (!cancelled) setLiveWeather(data)
      } catch (e: any) {
        if (!cancelled) {
          setLiveWeather(null)
          setLiveError(e?.message || "Failed to fetch live weather.")
        }
      } finally {
        if (!cancelled) setLiveLoading(false)
      }
    }
    loadLiveWeather()
    loadClimateWeather()
    return () => {
      cancelled = true
    }
  }, [weatherCity, activePlace])

  const bestMonths = useMemo(() => {
    if (!monthlyWeather.length) return []
    const rainValues = monthlyWeather.map((m) => m.rainfall).sort((a, b) => a - b)
    const rainP75 = rainValues[Math.min(rainValues.length - 1, Math.floor(rainValues.length * 0.75))]
    const rainScale = Math.max(40, rainP75 || 0)

    const scored = monthlyWeather.map((entry) => {
      const tempComfort = Math.max(0, 1 - Math.abs(entry.avgTemperature - 22) / 14)
      const rainComfort = Math.max(0, 1 - entry.rainfall / (rainScale + 20))
      const score = tempComfort * 0.7 + rainComfort * 0.3
      return { month: entry.month, score }
    })

    const thresholdMonths = scored
      .filter((m) => m.score >= 0.62)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.month)

    if (thresholdMonths.length > 0) return thresholdMonths.slice(0, 5)
    return scored.sort((a, b) => b.score - a.score).slice(0, 4).map((m) => m.month)
  }, [monthlyWeather])

  const cityDestinations = destinations.filter((d) => d.city === weatherCity)
  const shownPlaces = activePlace ? [activePlace] : cityDestinations
  const selectedLocationTitle = activePlace?.name || liveWeather?.city || weatherCity
  const currentCondition = liveWeather?.condition || currentWeatherEntry.weatherCondition
  const currentTemp = typeof liveWeather?.tempC === "number" ? liveWeather.tempC : currentWeatherEntry.avgTemperature
  const currentHumidity = typeof liveWeather?.humidity === "number" ? liveWeather.humidity : currentWeatherEntry.humidity
  const currentRain = typeof liveWeather?.rainMm === "number" ? liveWeather.rainMm : currentWeatherEntry.rainfall
  const currentWind = typeof liveWeather?.windKmh === "number" ? liveWeather.windKmh : null

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">Weather & Best Time to Visit</h1>
            <p className="text-muted-foreground">Live weather + historical data for planning your trip</p>
          </div>
          <Select
            value={placeOptions.length > 0 ? selectedPlaceKey : selectedCity}
            onValueChange={(value) => {
              if (placeOptions.length > 0) {
                setSelectedPlaceKey(value)
                return
              }
              setSelectedCity(value)
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {placeOptions.length > 0
                ? placeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))
                : availableCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-primary/20 to-accent/20 p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="mb-2 text-muted-foreground">
                      Current Conditions {liveWeather?.observedAt ? "(Live)" : `(${currentMonth})`}
                    </p>
                    <h2 className="mb-1 text-4xl font-bold text-foreground">{selectedLocationTitle}</h2>
                    <p className="text-muted-foreground">
                      {activePlace
                        ? `${activePlace.city || weatherCity}${activePlace.country ? `, ${activePlace.country}` : ""}`
                        : cityDestinations.length > 0
                          ? `${cityDestinations.length} famous place${cityDestinations.length > 1 ? "s" : ""} here`
                          : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {(() => {
                      const Icon = getWeatherIcon(currentCondition)
                      return <Icon className={cn("h-20 w-20", getWeatherIconColor(currentCondition))} />
                    })()}
                    <div>
                      <p className="text-6xl font-bold text-foreground">{currentTemp}°</p>
                      <p className="text-muted-foreground capitalize">{liveWeather?.description || currentCondition}</p>
                      {liveLoading && <p className="text-xs text-muted-foreground">Updating live weather...</p>}
                      {liveError && <p className="text-xs text-destructive">{liveError}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-4">
                    <Thermometer className="h-5 w-5 text-chart-5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Temperature</p>
                      <p className="font-semibold text-foreground">{currentTemp}°C</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-4">
                    <Droplets className="h-5 w-5 text-chart-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Humidity</p>
                      <p className="font-semibold text-foreground">{currentHumidity}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-4">
                    <Wind className="h-5 w-5 text-chart-2" />
                    <div>
                      <p className="text-sm text-muted-foreground">Wind</p>
                      <p className="font-semibold text-foreground">{currentWind !== null ? `${currentWind} km/h` : "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-4">
                    <CloudRain className="h-5 w-5 text-chart-2" />
                    <div>
                      <p className="text-sm text-muted-foreground">Rain</p>
                      <p className="font-semibold text-foreground">{currentRain} mm</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">12-Month Weather Overview</CardTitle>
                {(climateLoading || climateMeta?.startYear) && (
                  <p className="text-sm text-muted-foreground">
                    {climateLoading
                      ? "Updating monthly climate averages..."
                      : `Monthly averages from ${climateMeta?.startYear}-${climateMeta?.endYear}`}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6">
                  {monthlyWeather.map((entry) => {
                    const Icon = getWeatherIcon(entry.weatherCondition)
                    const isBest = bestMonths.includes(entry.month)
                    return (
                      <div
                        key={entry.month}
                        className={cn(
                          "rounded-xl p-4 text-center transition-colors",
                          isBest ? "bg-chart-3/10 ring-1 ring-chart-3/30" : "bg-secondary/50 hover:bg-secondary"
                        )}
                      >
                        <p className="mb-2 text-sm font-medium text-foreground">{entry.month}</p>
                        <Icon className={cn("mx-auto mb-2 h-7 w-7", getWeatherIconColor(entry.weatherCondition))} />
                        <p className="text-lg font-bold text-foreground">{entry.avgTemperature}°</p>
                        <p className="text-xs text-muted-foreground">{entry.rainfall}mm</p>
                        {isBest && <Badge className="mt-1 bg-chart-3 text-xs text-chart-3-foreground">Best</Badge>}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Temperature ({weatherCity})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 overflow-x-auto pb-4">
                  {monthlyWeather.map((entry) => {
                    const barHeight = Math.max((entry.avgTemperature + 5) * 4, 8)
                    return (
                      <div key={entry.month} className="flex flex-col items-center gap-2">
                        <div
                          className={cn(
                            "w-10 rounded-t-lg transition-all hover:opacity-80",
                            entry.avgTemperature > 25 ? "bg-chart-5/80" : entry.avgTemperature > 15 ? "bg-primary/80" : "bg-chart-2/80"
                          )}
                          style={{ height: `${barHeight}px` }}
                          title={`${entry.month}: ${entry.avgTemperature}°C - ${entry.weatherCondition}`}
                        />
                        <p className="text-sm font-medium text-foreground">{entry.avgTemperature}°</p>
                        <p className="text-xs text-muted-foreground">{entry.month}</p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {shownPlaces.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {activePlace ? "Selected Place" : `Famous Places in ${weatherCity}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {shownPlaces.map((dest) => (
                      <div key={String(dest.id || dest.name || "")} className="flex items-center justify-between rounded-lg border p-4">
                        <div>
                          <p className="font-medium text-foreground">{dest.name || "Selected place"}</p>
                          {"famousFor" in dest && dest.famousFor ? (
                            <p className="text-sm text-muted-foreground">{dest.famousFor}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">{dest.city || weatherCity}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Entry: {dest.entryFee === 0 ? "Free" : formatCurrency(dest.entryFee ?? 0)}
                            {"avgVisitDuration" in dest && typeof dest.avgVisitDuration === "number"
                              ? ` | Visit: ~${dest.avgVisitDuration}h`
                              : ""}
                          </p>
                        </div>
                        {"type" in dest && dest.type ? <Badge variant="secondary">{dest.type}</Badge> : null}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Best Time to Visit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bestMonths.length > 0 ? (
                  <div className="rounded-lg bg-chart-3/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-chart-3" />
                      <span className="font-medium text-foreground">Recommended Months</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{bestMonths.join(", ")}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Comfortable temperatures (15-30°C) with low rainfall</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-chart-4/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Info className="h-5 w-5 text-chart-4" />
                      <span className="font-medium text-foreground">Year-round destination</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Check monthly details for the best conditions</p>
                  </div>
                )}

                <div className="space-y-2">
                  {monthlyWeather
                    .filter((_, i) => i % 3 === 0)
                    .map((entry) => (
                      <div key={entry.month} className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <span className="text-sm text-foreground">{entry.month}</span>
                          <p className="text-xs text-muted-foreground">{entry.avgTemperature}°C</p>
                        </div>
                        <Badge
                          variant={bestMonths.includes(entry.month) ? "default" : "secondary"}
                          className={bestMonths.includes(entry.month) ? "bg-chart-3 text-chart-3-foreground" : ""}
                        >
                          {entry.weatherCondition.split(" ")[0]}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-chart-4" />
                  Travel Advisory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {monthlyWeather.some((w) => w.avgTemperature > 35) && (
                  <div className="rounded-lg border border-chart-5/30 bg-chart-5/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-chart-5" />
                      <span className="text-sm font-medium text-foreground">Extreme Heat Warning</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Some months exceed 35°C. Pack sun protection and stay hydrated.</p>
                  </div>
                )}
                {monthlyWeather.some((w) => w.rainfall > 100) && (
                  <div className="rounded-lg border border-chart-1/30 bg-chart-1/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <CloudRain className="h-4 w-4 text-chart-1" />
                      <span className="text-sm font-medium text-foreground">Heavy Rainfall</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Monsoon/rainy season brings heavy rainfall. Pack waterproof gear.</p>
                  </div>
                )}
                <div className="rounded-lg border border-chart-3/30 bg-chart-3/5 p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-chart-3" />
                    <span className="text-sm font-medium text-foreground">Data Source</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {liveWeather?.observedAt
                      ? `Live weather from OpenWeather for ${selectedLocationTitle}.`
                      : `Live weather fallback unavailable; showing monthly climate for ${weatherCity}.`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {climateMeta?.startYear
                      ? `12-month sections use ${climateMeta.startYear}-${climateMeta.endYear} historical averages from Open-Meteo archive.`
                      : climateError
                        ? `Climate API unavailable (${climateError}). Using local fallback monthly data.`
                        : `Using bundled monthly climate fallback for ${weatherCity}.`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-4">
                <Link href="/itinerary" className="block">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Calendar className="h-4 w-4" />
                    Plan Itinerary
                  </Button>
                </Link>
                <Link href="/chat" className="block">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Cloud className="h-4 w-4" />
                    Ask AI About Weather
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <ChatBubble />
    </div>
  )
}
