"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowRight,
  Camera,
  ChevronDown,
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
  CheckCircle2,
  CheckCircle,
  Coffee,
  Info,
  MapPinned,
  RefreshCcw,
  Search,
  Sparkles,
  Trees,
  Umbrella,
  Users,
  Wallet,
  Heart,
} from "lucide-react"
import {
  buildDestinationImageUrl,
  destinationFallbackImage,
  destinations,
  destinationWeather,
  parisWeather,
  type WeatherEntry,
} from "@/lib/data"
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
const LOCATION_STORAGE_KEY = "WANDERLY_WEATHER_RECENTS_V1"
const AI_ASSISTANT_PENDING_PROMPT_KEY = "WANDERLY_AI_PENDING_PROMPT_V1"
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

type SelectedPlace = {
  id?: string | number
  name?: string
  city?: string
  country?: string
  state?: string
  image?: string
  description?: string
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

type LocationOption = {
  value: string
  label: string
  city: string
  description: string
  kind: "place" | "city"
  place?: SelectedPlace | null
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

function formatRelativeUpdated(observedAt?: number) {
  if (!observedAt) return "Climate averages in use"
  const diffMs = Date.now() - observedAt * 1000
  const minutes = Math.max(1, Math.round(diffMs / 60000))
  if (minutes < 60) return `Updated ${minutes} min${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`
}

function formatTripDateRange(dateRange?: { from?: string; to?: string }) {
  if (!dateRange?.from || !dateRange?.to) return ""
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return ""
  return `${from.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${to.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
}

function getComfortScore(entry: WeatherEntry) {
  const tempComfort = Math.max(0, 1 - Math.abs(entry.avgTemperature - 22) / 15)
  const rainComfort = Math.max(0, 1 - entry.rainfall / 140)
  return tempComfort * 0.72 + rainComfort * 0.28
}

function getTravelReadiness(temp: number, rain: number, condition: string) {
  const lower = condition.toLowerCase()
  if ((temp >= 12 && temp <= 28 && rain <= 35 && !lower.includes("storm")) || lower.includes("pleasant")) {
    return {
      label: "Good for sightseeing",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50",
      summary: "Comfortable weather for walking-heavy plans, parks, and photography.",
    }
  }
  if (temp > 34 || rain > 95 || lower.includes("snow")) {
    return {
      label: "Not ideal",
      tone: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-50",
      summary: "You can still go, but indoor backups and shorter outdoor windows matter more.",
    }
  }
  return {
    label: "Okay with planning",
    tone: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-50",
    summary: "This is workable, but timing your outdoor hours makes a noticeable difference.",
  }
}

function getWeatherTheme(condition: string) {
  const lower = condition.toLowerCase()
  if (lower.includes("rain") || lower.includes("storm")) {
    return {
      overlay: "from-slate-950/72 via-sky-950/58 to-blue-900/48",
      badge: "border-sky-200/25 bg-sky-400/15 text-sky-50",
      section: "from-sky-50 to-slate-50 dark:from-slate-900 dark:to-slate-950",
    }
  }
  if (lower.includes("clear") || lower.includes("sunny") || lower.includes("dry")) {
    return {
      overlay: "from-slate-950/62 via-sky-900/34 to-amber-500/26",
      badge: "border-amber-200/30 bg-amber-300/18 text-amber-50",
      section: "from-amber-50 to-sky-50 dark:from-slate-900 dark:to-slate-950",
    }
  }
  if (lower.includes("snow") || lower.includes("cold")) {
    return {
      overlay: "from-slate-950/72 via-blue-950/56 to-cyan-900/38",
      badge: "border-cyan-200/25 bg-cyan-300/14 text-cyan-50",
      section: "from-cyan-50 to-slate-50 dark:from-slate-900 dark:to-slate-950",
    }
  }
  return {
    overlay: "from-slate-950/66 via-sky-900/40 to-teal-700/26",
    badge: "border-emerald-200/25 bg-emerald-300/14 text-emerald-50",
    section: "from-sky-50 to-white dark:from-slate-900 dark:to-slate-950",
  }
}

function getTodayWindowRecommendation(temp: number, rain: number, condition: string) {
  const lower = condition.toLowerCase()
  if (lower.includes("rain")) return "Late morning to early afternoon is your safest outdoor window."
  if (temp >= 31) return "Go out before 10:30 AM or after 5 PM for a more comfortable experience."
  if (temp <= 7) return "Late morning through mid-afternoon will feel best."
  if (rain >= 70) return "Plan your key outdoor stops around the driest part of the afternoon."
  return "10 AM to 4 PM looks strongest for sightseeing today."
}

function getTripMonths(dateRange?: { from?: string; to?: string }) {
  if (!dateRange?.from || !dateRange?.to) return [] as string[]
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return []
  const months: string[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const label = cursor.toLocaleString("en", { month: "short" })
    if (!months.includes(label)) months.push(label)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

function getMonthTier(entry: WeatherEntry, bestMonths: string[]) {
  if (bestMonths.includes(entry.month)) return "best"
  return getComfortScore(entry) >= 0.52 ? "good" : "tough"
}

function getMonthTierClasses(tier: string) {
  if (tier === "best") return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-50"
  if (tier === "good") return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-50"
  return "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-50"
}

function deriveCrowdLevel(entry: WeatherEntry, bestMonths: string[]) {
  const monthIndex = MONTHS.indexOf(entry.month)
  const peakTravelMonth = [5, 6, 7, 11].includes(monthIndex)
  const score = Math.min(5, Math.max(1, Math.round((getComfortScore(entry) * 3.4) + (peakTravelMonth ? 1.2 : 0.4))))
  return {
    score,
    label: score >= 4 ? "High" : score >= 3 ? "Moderate" : "Low",
    note:
      bestMonths.includes(entry.month) && score >= 4
        ? "Excellent weather, but expect more travelers."
        : score <= 2
          ? "Calmer travel window with lighter crowd pressure."
          : "Balanced planning window.",
  }
}

function buildMonthReason(entry: WeatherEntry, bestMonths: string[]) {
  const tier = getMonthTier(entry, bestMonths)
  if (tier === "best") return `${entry.month} is ideal because the temperature is balanced and the weather friction stays relatively low.`
  if (tier === "good") return `${entry.month} is workable, but rainfall or temperature starts to make timing more important.`
  return `${entry.month} is less comfortable because the mix of rainfall and temperature adds more planning friction.`
}

function getScenarioRecommendation(monthlyWeather: WeatherEntry[], bestMonths: string[], scenario: "budget" | "romantic" | "family" | "photo") {
  const sorted = [...monthlyWeather].sort((a, b) => {
    const comfortDiff = getComfortScore(b) - getComfortScore(a)
    if (scenario === "budget") return comfortDiff + (deriveCrowdLevel(a, bestMonths).score - deriveCrowdLevel(b, bestMonths).score) * 0.18
    if (scenario === "romantic") return comfortDiff + ((/pleasant|mild|clear/i.test(b.weatherCondition) ? 0.15 : 0) - (/pleasant|mild|clear/i.test(a.weatherCondition) ? 0.15 : 0))
    if (scenario === "family") return comfortDiff + ((a.rainfall - b.rainfall) / 250)
    return comfortDiff + ((/clear|pleasant|sunny/i.test(b.weatherCondition) ? 0.16 : 0) - (/clear|pleasant|sunny/i.test(a.weatherCondition) ? 0.16 : 0))
  })
  return sorted.slice(0, 2).map((entry) => entry.month)
}

function WeatherHeroPanel(props: {
  heroImage: string
  selectedLocationTitle: string
  weatherCity: string
  activePlace: SelectedPlace | null
  currentCondition: string
  currentTemp: number
  currentFeelsLike: number
  currentHumidity: number
  currentRain: number
  currentWind: number | null
  weatherTheme: { overlay: string; badge: string }
  readiness: { label: string; summary: string }
  updatedLabel: string
  tripDateRangeLabel: string
  recentLocationOptions: LocationOption[]
  filteredLocationOptions: LocationOption[]
  locationPickerOpen: boolean
  setLocationPickerOpen: (open: boolean) => void
  locationQuery: string
  setLocationQuery: (value: string) => void
  selectLocation: (option: LocationOption) => void
  launchAssistantPrompt: (prompt: string) => void
}) {
  return (
    <section className="relative overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_26px_90px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-950">
      <div className="absolute inset-0">
        <img src={props.heroImage} alt={props.selectedLocationTitle} className="h-full w-full object-cover" />
        <div className={cn("absolute inset-0 bg-gradient-to-br", props.weatherTheme.overlay)} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_26%),radial-gradient(circle_at_80%_16%,rgba(255,255,255,0.14),transparent_20%)]" />
      </div>

      <div className="relative p-5 sm:p-7 lg:p-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge className="border-white/16 bg-white/10 text-white backdrop-blur-md hover:bg-white/10">Weather experience</Badge>
            {props.tripDateRangeLabel ? (
              <Badge className="border-white/16 bg-white/10 text-white backdrop-blur-md hover:bg-white/10">
                Based on your trip · {props.tripDateRangeLabel}
              </Badge>
            ) : null}
            <Badge className="border-white/16 bg-white/10 text-white backdrop-blur-md hover:bg-white/10">
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5 animate-spin [animation-duration:3.8s]" />
              {props.updatedLabel}
            </Badge>
          </div>

          <Popover open={props.locationPickerOpen} onOpenChange={props.setLocationPickerOpen}>
            <PopoverTrigger asChild>
              <button className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/14">
                <MapPinned className="h-4 w-4" />
                {props.selectedLocationTitle}
                <ChevronDown className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] rounded-[24px] border-slate-200 bg-white/98 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950/96">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input value={props.locationQuery} onChange={(event) => props.setLocationQuery(event.target.value)} placeholder="Search city or landmark" className="rounded-2xl border-slate-200 bg-slate-50 pl-10 dark:border-slate-800 dark:bg-slate-900" />
                </div>
                {props.recentLocationOptions.length ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recent</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {props.recentLocationOptions.slice(0, 4).map((option) => (
                        <button key={option.value} onClick={() => props.selectLocation(option)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-sky-200 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {props.filteredLocationOptions.map((option) => (
                    <button key={option.value} onClick={() => props.selectLocation(option)} className="flex w-full items-center justify-between rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-sky-200 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-800">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{option.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {option.kind === "place" ? "Trip place" : "City"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <p className="text-sm font-medium text-white/72">{props.activePlace ? [props.activePlace.city || props.weatherCity, props.activePlace.country].filter(Boolean).join(", ") : props.weatherCity}</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Should you go to {props.selectedLocationTitle} now?</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">
              Wanderly turns live weather and climate data into a travel decision. See the mood right now, your strongest months, and what your trip window really means.
            </p>

            <div className="mt-8 flex flex-wrap items-end gap-4">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] border border-white/14 bg-white/10 backdrop-blur-md">
                {(props.currentCondition.toLowerCase().includes("sun") || props.currentCondition.toLowerCase().includes("clear")) ? <div className="absolute inset-4 rounded-full bg-amber-300/25 blur-2xl animate-pulse" /> : null}
                {(() => {
                  const Icon = getWeatherIcon(props.currentCondition)
                  return <Icon className={cn("relative h-14 w-14 text-white", props.currentCondition.toLowerCase().includes("rain") ? "animate-bounce" : "animate-pulse")} />
                })()}
              </div>
              <div>
                <div className="flex flex-wrap items-end gap-3">
                  <p className="text-6xl font-semibold tracking-[-0.05em] text-white sm:text-7xl">{props.currentTemp}°C</p>
                  <div className="pb-2">
                    <p className="text-lg font-medium capitalize text-white/82">{props.currentCondition}</p>
                    <p className="text-sm text-white/66">Feels like {props.currentFeelsLike}°C</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <span className={cn("inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium backdrop-blur-md", props.weatherTheme.badge)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {props.readiness.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/14 bg-white/10 px-3.5 py-1.5 text-sm text-white/82 backdrop-blur-md">
                    {getTodayWindowRecommendation(props.currentTemp, props.currentRain, props.currentCondition)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: "Feels like", value: `${props.currentFeelsLike}°C`, icon: Thermometer },
              { label: "Humidity", value: `${props.currentHumidity}%`, icon: Droplets },
              { label: "Rain", value: `${props.currentRain} mm`, icon: CloudRain },
              { label: "Wind", value: props.currentWind !== null ? `${props.currentWind} km/h` : "N/A", icon: Wind },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-[24px] border border-white/12 bg-white/10 p-4 text-white backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/70">{item.label}</p>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-semibold">{item.value}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/14 bg-white/10 p-4 backdrop-blur-md">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Plan based on weather</p>
              <p className="mt-2 text-sm leading-6 text-white/78">{props.readiness.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full bg-white text-slate-950 hover:bg-white/90" onClick={() => props.launchAssistantPrompt(`Build a weather-smart itinerary for ${props.selectedLocationTitle}`)}>
                Build itinerary for this weather
              </Button>
              <Button variant="outline" className="rounded-full border-white/16 bg-white/10 text-white hover:bg-white/14 hover:text-white" onClick={() => props.launchAssistantPrompt(`Find indoor places near ${props.selectedLocationTitle}`)}>
                Find indoor places
              </Button>
              <Button variant="outline" className="rounded-full border-white/16 bg-white/10 text-white hover:bg-white/14 hover:text-white" onClick={() => props.launchAssistantPrompt(`Suggest better trip dates for ${props.selectedLocationTitle} based on weather`)}>
                Adjust trip dates
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function WeatherExperience(props: {
  heroImage: string
  selectedLocationTitle: string
  weatherCity: string
  activePlace: SelectedPlace | null
  currentCondition: string
  currentTemp: number
  currentFeelsLike: number
  currentHumidity: number
  currentRain: number
  currentWind: number | null
  weatherTheme: { overlay: string; badge: string; section: string }
  readiness: { label: string; summary: string }
  updatedLabel: string
  tripDateRangeLabel: string
  recentLocationOptions: LocationOption[]
  filteredLocationOptions: LocationOption[]
  locationPickerOpen: boolean
  setLocationPickerOpen: (open: boolean) => void
  locationQuery: string
  setLocationQuery: (value: string) => void
  selectLocation: (option: LocationOption) => void
  launchAssistantPrompt: (prompt: string) => void
  bestMonths: string[]
  chartMode: "overview" | "rainfall" | "crowd"
  setChartMode: (mode: "overview" | "rainfall" | "crowd") => void
  chartData: Array<{ month: string; temperature: number; rainfall: number; crowd: number }>
  monthlyWeather: WeatherEntry[]
  selectedMonthIndex: number
  setSelectedMonthIndex: (index: number) => void
  activeMonth: WeatherEntry
  activeMonthCrowd: { label: string }
  scenarioCards: Array<{ title: string; months: string[]; icon: any; note: string }>
  tripSummary: { avgTemp: number; avgRain: number } | null
  climateMeta: ClimateResponse | null
  climateError: string | null
  liveWeather: LiveWeather | null
  shownPlaces: SelectedPlace[]
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),radial-gradient(circle_at_top_right,rgba(250,204,21,0.08),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f5f7fb_38%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_42%,#020617_100%)]">
      <Navigation />

      <main className="mx-auto w-full max-w-[1560px] px-4 py-6 sm:px-5 lg:px-6 lg:py-8">
        <WeatherHeroPanel
          heroImage={props.heroImage}
          selectedLocationTitle={props.selectedLocationTitle}
          weatherCity={props.weatherCity}
          activePlace={props.activePlace}
          currentCondition={props.currentCondition}
          currentTemp={props.currentTemp}
          currentFeelsLike={props.currentFeelsLike}
          currentHumidity={props.currentHumidity}
          currentRain={props.currentRain}
          currentWind={props.currentWind}
          weatherTheme={props.weatherTheme}
          readiness={props.readiness}
          updatedLabel={props.updatedLabel}
          tripDateRangeLabel={props.tripDateRangeLabel}
          recentLocationOptions={props.recentLocationOptions}
          filteredLocationOptions={props.filteredLocationOptions}
          locationPickerOpen={props.locationPickerOpen}
          setLocationPickerOpen={props.setLocationPickerOpen}
          locationQuery={props.locationQuery}
          setLocationQuery={props.setLocationQuery}
          selectLocation={props.selectLocation}
          launchAssistantPrompt={props.launchAssistantPrompt}
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_390px]">
          <div className="space-y-6">
            <Card className={cn("border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-slate-800", `bg-gradient-to-br ${props.weatherTheme.section}`)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  AI Travel Insight
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {props.bestMonths.slice(0, 2).join(" and ")} are strong windows for {props.selectedLocationTitle}. Conditions are easier on long walks, better for sightseeing flow, and more forgiving for photography-heavy days.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[22px] border border-emerald-200/70 bg-white/80 p-4 dark:border-emerald-900/40 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Good for</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Walking", "Sightseeing", "Photography", props.currentTemp <= 24 ? "Relaxed day plans" : "Morning routes"].map((item) => (
                        <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-amber-200/70 bg-white/80 p-4 dark:border-amber-900/40 dark:bg-slate-900/60">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Avoid</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[props.currentRain >= 90 ? "Rain-heavy days" : null, props.currentTemp <= 8 ? "Cold mornings" : null, props.currentTemp >= 33 ? "Midday heat" : null, "Rigid outdoor schedules"].filter(Boolean).map((item) => (
                        <span key={item} className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{item}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-slate-800">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg">Interactive graph</CardTitle>
                  <p className="text-sm text-muted-foreground">Hover to compare temperature, rainfall, and crowd pressure across the year.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[{ key: "overview", label: "Temperature + Rainfall" }, { key: "rainfall", label: "Rainfall" }, { key: "crowd", label: "Crowd level" }].map((item) => (
                    <button key={item.key} onClick={() => props.setChartMode(item.key as "overview" | "rainfall" | "crowd")} className={cn("rounded-full px-4 py-2 text-sm font-medium transition", props.chartMode === item.key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200")}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer className="h-[340px] w-full" config={{ temperature: { label: "Temperature", color: "#0ea5e9" }, rainfall: { label: "Rainfall", color: "#2563eb" }, crowd: { label: "Crowd", color: "#f59e0b" } }}>
                  <ComposedChart data={props.chartData}>
                    <CartesianGrid vertical={false} strokeDasharray="4 4" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={36} />
                    <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                    {props.chartMode === "overview" ? (
                      <>
                        <Bar dataKey="rainfall" fill="var(--color-rainfall)" fillOpacity={0.24} radius={[8, 8, 0, 0]} />
                        <Line type="monotone" dataKey="temperature" stroke="var(--color-temperature)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-temperature)" }} />
                      </>
                    ) : null}
                    {props.chartMode === "rainfall" ? <Area type="monotone" dataKey="rainfall" stroke="var(--color-rainfall)" fill="var(--color-rainfall)" fillOpacity={0.2} strokeWidth={3} /> : null}
                    {props.chartMode === "crowd" ? <Area type="monotone" dataKey="crowd" stroke="var(--color-crowd)" fill="var(--color-crowd)" fillOpacity={0.24} strokeWidth={3} /> : null}
                  </ComposedChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  Best time to visit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{props.activeMonth.month}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{props.activeMonth.weatherCondition}</p>
                    </div>
                    <Badge className={cn(props.bestMonths.includes(props.activeMonth.month) ? "bg-emerald-600 text-white" : "bg-slate-900 text-white dark:bg-white dark:text-slate-950")}>
                      {props.bestMonths.includes(props.activeMonth.month) ? "Best month" : "Review month"}
                    </Badge>
                  </div>
                  <div className="mt-5 px-1">
                    <Slider value={[props.selectedMonthIndex]} min={0} max={11} step={1} onValueChange={(value) => props.setSelectedMonthIndex(value[0] ?? 0)} />
                  </div>
                  <div className="mt-3 flex justify-between text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                    {MONTHS.map((month) => (
                      <span key={month} className={cn(month === props.activeMonth.month ? "text-slate-900 dark:text-white" : "")}>{month}</span>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                    <span className="font-medium text-foreground">Recommended months</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{props.bestMonths.join(", ")}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {props.bestMonths.slice(0, 2).join(" and ")} stand out because temperature and rainfall stay better balanced for typical travel days.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-lg">When should YOU visit?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {props.scenarioCards.map((scenario) => {
                  const Icon = scenario.icon
                  return (
                    <div key={scenario.title} className="rounded-[20px] border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:shadow-[0_16px_30px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950 dark:text-white">{scenario.title}</p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {scenario.months.join(" · ")}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{scenario.note}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        {props.shownPlaces.length ? (
          <Card className="mt-6 border-slate-200/80 shadow-[0_18px_55px_rgba(15,23,42,0.08)] dark:border-slate-800">
            <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg">Place context</CardTitle>
              <Button variant="outline" className="rounded-full" onClick={() => props.launchAssistantPrompt(`What should I do in ${props.selectedLocationTitle} based on this weather?`)}>
                Ask AI what to do now
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-3">
                {props.shownPlaces.map((dest) => (
                  <div key={String(dest.id || dest.name || "")} className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_40px_rgba(15,23,42,0.10)] dark:border-slate-800 dark:bg-slate-900">
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img src={dest.image || buildDestinationImageUrl({ name: dest.name || props.selectedLocationTitle, city: dest.city || props.weatherCity, country: dest.country, state: dest.state, category: dest.type }) || destinationFallbackImage} alt={dest.name || props.selectedLocationTitle} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                      <div className="absolute inset-x-4 bottom-4">
                        <p className="text-lg font-semibold text-white">{dest.name || "Selected place"}</p>
                        <p className="text-sm text-white/72">{dest.city || props.weatherCity}</p>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{dest.famousFor || dest.description || "A strong weather-aware stop for this destination."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {dest.entryFee === 0 ? "Free entry" : formatCurrency(dest.entryFee ?? 0)}
                        </span>
                        {"avgVisitDuration" in dest && typeof dest.avgVisitDuration === "number" ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            ~{dest.avgVisitDuration} hr visit
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <ChatBubble />
    </div>
  )
}

export default function WeatherPage() {
  const router = useRouter()
  const [selectedCity, setSelectedCity] = useState("Paris")
  const [tripContext, setTripContext] = useState<any>(null)
  const [selectedPlaceKey, setSelectedPlaceKey] = useState("")
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState("")
  const [recentLocations, setRecentLocations] = useState<string[]>([])
  const [liveWeather, setLiveWeather] = useState<LiveWeather | null>(null)
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)
  const [climateWeather, setClimateWeather] = useState<WeatherEntry[] | null>(null)
  const [climateMeta, setClimateMeta] = useState<ClimateResponse | null>(null)
  const [climateLoading, setClimateLoading] = useState(false)
  const [climateError, setClimateError] = useState<string | null>(null)
  const [chartMode, setChartMode] = useState<"overview" | "rainfall" | "crowd">("overview")
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(new Date().getMonth())

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

  useEffect(() => {
    try {
      const recent = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) || "[]")
      if (Array.isArray(recent)) setRecentLocations(recent.filter((item) => typeof item === "string"))
    } catch {
      // ignore malformed local data
    }
  }, [])

  const selectedPlaces = useMemo<SelectedPlace[]>(() => {
    const items = Array.isArray(tripContext?.selectedPlaces)
      ? tripContext.selectedPlaces
      : Array.isArray(tripContext?.selectedDestinations)
        ? tripContext.selectedDestinations
        : []

    return items.filter(Boolean)
  }, [tripContext])

  const placeOptions = useMemo<LocationOption[]>(() => {
    return selectedPlaces.map((place) => ({
      value: placeValueKey(place),
      label: place?.name || place?.city || "Place",
      city: place?.city || selectedCity,
      description: [place?.city || place?.state, place?.country].filter(Boolean).join(", ") || "Trip destination",
      kind: "place",
      place,
    }))
  }, [selectedCity, selectedPlaces])

  const cityOptions = useMemo<LocationOption[]>(() => {
    const uniqueCities = Array.from(new Set([...availableCities, ...destinations.map((item) => item.city).filter(Boolean)]))
    return uniqueCities.slice(0, 120).map((city) => {
      const sample = destinations.find((item) => item.city === city)
      return {
        value: `city:${city}`,
        label: city,
        city,
        description: sample ? [sample.country, sample.region].filter(Boolean).join(" • ") : "Weather overview",
        kind: "city" as const,
        place: null,
      }
    })
  }, [])

  const allLocationOptions = useMemo(() => {
    const deduped = new Map<string, LocationOption>()
    ;[...placeOptions, ...cityOptions].forEach((option) => {
      if (!deduped.has(option.value)) deduped.set(option.value, option)
    })
    return Array.from(deduped.values())
  }, [cityOptions, placeOptions])

  const filteredLocationOptions = useMemo(() => {
    const needle = locationQuery.trim().toLowerCase()
    if (!needle) return allLocationOptions.slice(0, 10)
    return allLocationOptions
      .filter((option) => `${option.label} ${option.description} ${option.city}`.toLowerCase().includes(needle))
      .slice(0, 10)
  }, [allLocationOptions, locationQuery])

  const recentLocationOptions = useMemo(() => {
    return recentLocations
      .map((value) => allLocationOptions.find((option) => option.value === value))
      .filter(Boolean) as LocationOption[]
  }, [allLocationOptions, recentLocations])

  useEffect(() => {
    if (selectedPlaceKey) return
    if (placeOptions.length > 0) {
      setSelectedPlaceKey(placeOptions[0].value)
      return
    }
    setSelectedPlaceKey(`city:${selectedCity}`)
  }, [selectedPlaces])

  const activeSelection = useMemo(
    () => allLocationOptions.find((option) => option.value === selectedPlaceKey) || null,
    [allLocationOptions, selectedPlaceKey]
  )

  const activePlace = activeSelection?.kind === "place" ? activeSelection.place || null : null

  const weatherCity = activeSelection?.city || activePlace?.city || selectedCity

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
  const selectedLocationTitle = activePlace?.name || liveWeather?.placeName || liveWeather?.city || weatherCity
  const currentCondition = liveWeather?.condition || currentWeatherEntry.weatherCondition
  const currentTemp = typeof liveWeather?.tempC === "number" ? liveWeather.tempC : currentWeatherEntry.avgTemperature
  const currentFeelsLike = typeof liveWeather?.feelsLikeC === "number" ? liveWeather.feelsLikeC : currentTemp - 1
  const currentHumidity = typeof liveWeather?.humidity === "number" ? liveWeather.humidity : currentWeatherEntry.humidity
  const currentRain = typeof liveWeather?.rainMm === "number" ? liveWeather.rainMm : currentWeatherEntry.rainfall
  const currentWind = typeof liveWeather?.windKmh === "number" ? liveWeather.windKmh : null
  const readiness = getTravelReadiness(currentTemp, currentRain, currentCondition)
  const weatherTheme = getWeatherTheme(currentCondition)
  const updatedLabel = formatRelativeUpdated(liveWeather?.observedAt)
  const tripDateRangeLabel = formatTripDateRange(tripContext?.dateRange)
  const tripMonths = getTripMonths(tripContext?.dateRange)
  const tripMonthEntries = monthlyWeather.filter((entry) => tripMonths.includes(entry.month))
  const tripSummary =
    tripMonthEntries.length > 0
      ? {
          avgTemp: Math.round(tripMonthEntries.reduce((sum, entry) => sum + entry.avgTemperature, 0) / tripMonthEntries.length),
          avgRain: Math.round(tripMonthEntries.reduce((sum, entry) => sum + entry.rainfall, 0) / tripMonthEntries.length),
        }
      : null
  const activeMonth = monthlyWeather[selectedMonthIndex] || currentWeatherEntry
  const activeMonthCrowd = deriveCrowdLevel(activeMonth, bestMonths)
  const chartData = monthlyWeather.map((entry) => ({
    month: entry.month,
    temperature: entry.avgTemperature,
    rainfall: entry.rainfall,
    crowd: deriveCrowdLevel(entry, bestMonths).score,
  }))
  const scenarioCards = [
    { title: "Budget travel", months: getScenarioRecommendation(monthlyWeather, bestMonths, "budget"), icon: Wallet, note: "Best months for comfort without leaning too hard into peak demand." },
    { title: "Romantic trip", months: getScenarioRecommendation(monthlyWeather, bestMonths, "romantic"), icon: Heart, note: "Great for softer light, milder evenings, and slower scenic plans." },
    { title: "Family trip", months: getScenarioRecommendation(monthlyWeather, bestMonths, "family"), icon: Users, note: "Better for easier pacing, fewer weather disruptions, and longer outdoor blocks." },
    { title: "Photography", months: getScenarioRecommendation(monthlyWeather, bestMonths, "photo"), icon: Camera, note: "Stronger months for clearer conditions and more reliable outdoor shooting windows." },
  ]
  const heroImage =
    activePlace?.image ||
    cityDestinations[0]?.image ||
    buildDestinationImageUrl({
      name: selectedLocationTitle,
      city: weatherCity,
      country: activePlace?.country || cityDestinations[0]?.country,
      state: activePlace?.state || cityDestinations[0]?.state,
      category: activePlace?.type || cityDestinations[0]?.type,
    }) ||
    destinationFallbackImage

  useEffect(() => {
    if (!selectedPlaceKey) return
    setRecentLocations((prev) => {
      const next = [selectedPlaceKey, ...prev.filter((item) => item !== selectedPlaceKey)].slice(0, 6)
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [selectedPlaceKey])

  function selectLocation(option: LocationOption) {
    setSelectedPlaceKey(option.value)
    setSelectedCity(option.city)
    setLocationQuery("")
    setLocationPickerOpen(false)
  }

  function launchAssistantPrompt(prompt: string) {
    localStorage.setItem(AI_ASSISTANT_PENDING_PROMPT_KEY, prompt)
    router.push("/ai-assistant")
  }

  return (
    <WeatherExperience
      heroImage={heroImage}
      selectedLocationTitle={selectedLocationTitle}
      weatherCity={weatherCity}
      activePlace={activePlace}
      currentCondition={currentCondition}
      currentTemp={currentTemp}
      currentFeelsLike={currentFeelsLike}
      currentHumidity={currentHumidity}
      currentRain={currentRain}
      currentWind={currentWind}
      weatherTheme={weatherTheme}
      readiness={readiness}
      updatedLabel={updatedLabel}
      tripDateRangeLabel={tripDateRangeLabel}
      recentLocationOptions={recentLocationOptions}
      filteredLocationOptions={filteredLocationOptions}
      locationPickerOpen={locationPickerOpen}
      setLocationPickerOpen={setLocationPickerOpen}
      locationQuery={locationQuery}
      setLocationQuery={setLocationQuery}
      selectLocation={selectLocation}
      launchAssistantPrompt={launchAssistantPrompt}
      bestMonths={bestMonths}
      chartMode={chartMode}
      setChartMode={setChartMode}
      chartData={chartData}
      monthlyWeather={monthlyWeather}
      selectedMonthIndex={selectedMonthIndex}
      setSelectedMonthIndex={setSelectedMonthIndex}
      activeMonth={activeMonth}
      activeMonthCrowd={activeMonthCrowd}
      scenarioCards={scenarioCards}
      tripSummary={tripSummary}
      climateMeta={climateMeta}
      climateError={climateError}
      liveWeather={liveWeather}
      shownPlaces={shownPlaces}
    />
  )

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
                        ? `${activePlace?.city || weatherCity}${activePlace?.country ? `, ${activePlace?.country}` : ""}`
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
                      ? `12-month sections use ${climateMeta?.startYear}-${climateMeta?.endYear} historical averages from Open-Meteo archive.`
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
