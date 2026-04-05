import { NextResponse } from "next/server"

import { getCache, setCache } from "@/lib/api-cache"
import { budgetEstimates } from "@/lib/data"
import {
  buildBudgetEstimate,
  estimateTravelDistance,
  getTripDuration,
  haversineDistanceKm,
  type BudgetComponentStatus,
  type BudgetEstimateQuality,
  type BudgetPreference,
  type DestinationBudgetDetail,
  type SelectedDestination,
  type TripBudgetEstimate,
  type TripSetupState,
} from "@/lib/trip-budget"

const BUDGET_TTL_MS = 20 * 60 * 1000
const USD_TO_INR = 83

type LegacyBudgetRequest = {
  destination?: string
  days?: number
}

type Coordinate = {
  lat: number
  lon: number
}

type InternalHotelsResponse = {
  mode?: "LIVE" | "DEMO" | "MIXED"
  results?: Array<{ price?: number }>
}

type InternalFlightsResponse = {
  mode?: "LIVE" | "DEMO"
  results?: Array<{ price?: number; currency?: string }>
}

type InternalDistanceResponse = {
  distanceKm?: number
}

type InternalLocationResponse = {
  results?: Array<{ lat?: string; lon?: string }>
}

const foodRangesByBudget: Record<BudgetPreference, [number, number]> = {
  budget: [500, 900],
  "mid-range": [1000, 2200],
  luxury: [3000, 6500],
}

const localTravelRangesByBudget: Record<BudgetPreference, [number, number]> = {
  budget: [250, 650],
  "mid-range": [500, 1200],
  luxury: [1200, 3200],
}

const activityRangesByBudget: Record<BudgetPreference, [number, number]> = {
  budget: [300, 900],
  "mid-range": [800, 2000],
  luxury: [2200, 5000],
}

const flightRateByBudget: Record<BudgetPreference, number> = {
  budget: 3.8,
  "mid-range": 5.7,
  luxury: 8.4,
}

const intercityRateByBudget: Record<BudgetPreference, number> = {
  budget: 10,
  "mid-range": 15,
  luxury: 25,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function roundCurrency(value: number) {
  return Math.max(0, Math.round(value / 100) * 100)
}

function toInrFromUsd(value: number) {
  return roundCurrency(value * USD_TO_INR)
}

function toIsoDate(value?: string) {
  if (!value) return ""
  return value.slice(0, 10)
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
}

function buildBudgetCacheKey(setup: TripSetupState) {
  return JSON.stringify({
    origin: setup.startingLocation.trim().toLowerCase(),
    dates: setup.dateRange,
    travelStyle: setup.travelStyle,
    budgetPreference: setup.budgetPreference,
    destinations: setup.selectedDestinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      city: destination.city,
      country: destination.country,
      latitude: destination.latitude,
      longitude: destination.longitude,
    })),
  })
}

function distributeTripUnits(totalUnits: number, count: number) {
  if (count <= 0) return []
  const base = Math.floor(totalUnits / count)
  const remainder = totalUnits % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

function combineQuality(values: BudgetEstimateQuality[]): BudgetEstimateQuality {
  const unique = new Set(values)
  if (unique.size === 1) {
    return values[0] || "fallback"
  }
  if (unique.has("live")) return "mixed"
  if (unique.has("mixed")) return "mixed"
  return "fallback"
}

function pickHotelPrice(prices: number[], preference: BudgetPreference) {
  const sorted = [...prices].filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b)
  if (!sorted.length) return 0
  if (preference === "budget") {
    return sorted[Math.max(0, Math.floor((sorted.length - 1) * 0.25))]
  }
  if (preference === "luxury") {
    return sorted[Math.max(0, Math.floor((sorted.length - 1) * 0.75))]
  }
  return sorted[Math.floor((sorted.length - 1) * 0.5)]
}

function regionCostFactor(destination: SelectedDestination) {
  const region = normalizeText(destination.region)
  if (region.includes("south asia")) return 0.82
  if (region.includes("southeast asia")) return 0.92
  if (region.includes("east asia")) return 1.08
  if (region.includes("middle east")) return 1.18
  if (region.includes("western europe")) return 1.45
  if (region.includes("southern europe")) return 1.25
  if (region.includes("north america")) return 1.5
  if (region.includes("oceania")) return 1.42
  if (region.includes("south america")) return 0.98
  if (region.includes("africa")) return 0.9
  return 1
}

function deriveDailySpend(
  fallbackPerDayInr: number,
  range: [number, number],
  destination: SelectedDestination,
  travelStyle: TripSetupState["travelStyle"]
) {
  const regionAdjusted = fallbackPerDayInr * regionCostFactor(destination)
  const styleMultiplier =
    travelStyle === "relaxed" ? 0.94 : travelStyle === "fast-paced" ? 1.12 : 1
  return roundCurrency(clamp(regionAdjusted * styleMultiplier, range[0], range[1]))
}

function getComponentStatus(
  mode: BudgetEstimateQuality,
  source: string,
  message: string
): BudgetComponentStatus {
  return { mode, source, message }
}

async function fetchJson<T>(url: URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url.toString(), { ...init, cache: "no-store" })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function resolveLocationCoordinates(req: Request, query: string) {
  if (!query.trim()) return null
  const url = new URL("/api/locations/search", req.url)
  url.searchParams.set("q", query.trim())
  url.searchParams.set("scope", "city")

  const payload = await fetchJson<InternalLocationResponse>(url)
  const first = payload?.results?.[0]
  if (!first) return null

  const lat = Number(first.lat)
  const lon = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return { lat, lon }
}

async function fetchDrivingDistanceKm(req: Request, from: Coordinate, to: Coordinate) {
  const url = new URL("/api/distance", req.url)
  const payload = await fetchJson<InternalDistanceResponse>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      profile: "driving-car",
    }),
  })

  return Number(payload?.distanceKm || 0)
}

async function fetchFlightCostInr(
  req: Request,
  setup: TripSetupState,
  firstDestination: SelectedDestination | undefined,
  fallbackFlightCostUsd: number
) {
  if (!firstDestination || !setup.startingLocation.trim()) {
    return {
      amount: toInrFromUsd(fallbackFlightCostUsd),
      status: getComponentStatus(
        "fallback",
        "Distance fallback",
        "Starting city missing, so arrival flight uses the fallback estimator."
      ),
    }
  }

  const url = new URL("/api/flights", req.url)
  url.searchParams.set("origin", setup.startingLocation.trim())
  url.searchParams.set("dest", firstDestination.city || firstDestination.name)
  url.searchParams.set("depart", toIsoDate(setup.dateRange.from))
  if (setup.dateRange.to) {
    url.searchParams.set("return", toIsoDate(setup.dateRange.to))
  }
  url.searchParams.set(
    "budgetLevel",
    setup.budgetPreference === "budget"
      ? "low"
      : setup.budgetPreference === "mid-range"
        ? "medium"
        : "premium"
  )
  url.searchParams.set("sort", "cheapest")

  const payload = await fetchJson<InternalFlightsResponse>(url)
  const livePrices =
    payload?.mode === "LIVE"
      ? (payload.results || [])
          .map((item) => Number(item.price || 0))
          .filter((price) => Number.isFinite(price) && price > 0)
      : []

  if (livePrices.length > 0) {
    return {
      amount: toInrFromUsd(Math.min(...livePrices)),
      status: getComponentStatus("live", "Amadeus flight offers", "Flight estimate uses the cheapest live fare found."),
    }
  }

  const originCoords = await resolveLocationCoordinates(req, setup.startingLocation)
  const destinationCoords =
    Number.isFinite(Number(firstDestination.latitude)) && Number.isFinite(Number(firstDestination.longitude))
      ? {
          lat: Number(firstDestination.latitude),
          lon: Number(firstDestination.longitude),
        }
      : await resolveLocationCoordinates(req, firstDestination.city || firstDestination.name)

  if (originCoords && destinationCoords) {
    const distanceKm = haversineDistanceKm(
      { name: "origin", latitude: originCoords.lat, longitude: originCoords.lon },
      { name: firstDestination.name, latitude: destinationCoords.lat, longitude: destinationCoords.lon }
    )
    const multiplier = setup.dateRange.to ? 2 : 1
    const estimate = roundCurrency(
      Math.max(2500, distanceKm * flightRateByBudget[setup.budgetPreference] * multiplier)
    )

    return {
      amount: estimate,
      status: getComponentStatus(
        "fallback",
        "Distance-based fare model",
        "Live flight pricing was unavailable, so the estimate uses route distance and budget preference."
      ),
    }
  }

  return {
    amount: toInrFromUsd(fallbackFlightCostUsd),
    status: getComponentStatus(
      "fallback",
      "Regional fare fallback",
      "Live flight pricing and city geocoding were unavailable, so the estimate uses regional averages."
    ),
  }
}

async function fetchHotelRateInr(
  req: Request,
  destination: SelectedDestination,
  setup: TripSetupState,
  fallbackHotelPerNightUsd: number
) {
  const url = new URL("/api/hotels", req.url)
  url.searchParams.set("city", destination.city || destination.name)
  if (destination.country) {
    url.searchParams.set("country", destination.country)
  }
  url.searchParams.set("checkInDate", toIsoDate(setup.dateRange.from))
  url.searchParams.set("checkOutDate", toIsoDate(setup.dateRange.to))
  url.searchParams.set(
    "budgetLevel",
    setup.budgetPreference === "budget"
      ? "low"
      : setup.budgetPreference === "mid-range"
        ? "medium"
        : "premium"
  )
  url.searchParams.set("limit", "18")
  url.searchParams.set("inventoryTarget", "30")

  const payload = await fetchJson<InternalHotelsResponse>(url)
  const usableLiveInventory =
    payload?.mode === "LIVE" || payload?.mode === "MIXED"
      ? (payload.results || [])
          .map((item) => Number(item.price || 0))
          .filter((price) => Number.isFinite(price) && price > 0)
      : []

  if (usableLiveInventory.length > 0) {
    const picked = pickHotelPrice(usableLiveInventory, setup.budgetPreference)
    const quality = payload?.mode === "LIVE" ? "live" : "mixed"
    return {
      amount: toInrFromUsd(picked),
      status: getComponentStatus(
        quality,
        quality === "live" ? "Amadeus hotel offers" : "Mixed hotel inventory",
        quality === "live"
          ? "Hotel estimate uses current hotel offer pricing for the selected city."
          : "Hotel estimate uses live inventory supplemented by fallback inventory."
      ),
    }
  }

  return {
    amount: toInrFromUsd(fallbackHotelPerNightUsd),
    status: getComponentStatus(
      "fallback",
      "Destination hotel fallback",
      "Live hotel pricing was unavailable, so the estimate uses destination-aware hotel averages."
    ),
  }
}

function legacyBudgetLookup(input: LegacyBudgetRequest) {
  const lower = String(input.destination || "").toLowerCase()
  const match =
    budgetEstimates.find((item) => String(item.destination).toLowerCase() === lower) ||
    budgetEstimates.find((item) => String(item.destination).toLowerCase().includes(lower)) ||
    budgetEstimates.find((item) => lower.includes(String(item.destination).toLowerCase()))

  if (!match) return null

  const days = Number(input.days) || 3
  const flight = Number(match.avgFlightCost || 0)
  const hotelPerNight = Number(match.hotelPricePerNight || 0)
  const foodPerDay = Number(match.foodCostPerDay || 0)
  const transportPerDay = Number(match.localTransportCost || 0)
  const activitiesPerDay = Number(match.activityCostAvg || 0)
  const entryFeesTotal = Number(match.entryFee || 0)

  return {
    destination: match.destination,
    days,
    currency: "INR",
    flight,
    hotelPerNight,
    foodPerDay,
    transportPerDay,
    activitiesPerDay,
    entryFeesTotal,
    total:
      flight +
      days * hotelPerNight +
      days * foodPerDay +
      days * transportPerDay +
      days * activitiesPerDay +
      entryFeesTotal,
  }
}

async function buildTripBudget(req: Request, setup: TripSetupState): Promise<TripBudgetEstimate> {
  const fallback = buildBudgetEstimate(setup)
  const { totalDays, totalNights } = getTripDuration(setup.dateRange)
  const routePreview = estimateTravelDistance(setup.selectedDestinations)
  const orderedDestinations = routePreview.orderedDestinations.length
    ? routePreview.orderedDestinations
    : setup.selectedDestinations
  const allocatedDays = distributeTripUnits(Math.max(totalDays, orderedDestinations.length || 1), Math.max(orderedDestinations.length, 1))
  const allocatedNights = distributeTripUnits(totalNights, Math.max(orderedDestinations.length, 1))
  const fallbackDetailsById = new Map(fallback.destinationDetails.map((item) => [item.id, item]))

  const hotelResults = await Promise.all(
    orderedDestinations.map(async (destination) => {
      const fallbackDetail = fallbackDetailsById.get(destination.id)
      return fetchHotelRateInr(req, destination, setup, fallbackDetail?.hotelPerNight || 0)
    })
  )

  const destinationDetails: DestinationBudgetDetail[] = orderedDestinations.map((destination, index) => {
    const fallbackDetail = fallbackDetailsById.get(destination.id)
    const daysAllocated = allocatedDays[index] || 0
    const nightsAllocated = allocatedNights[index] || 0
    const hotelPerNight = hotelResults[index]?.amount || toInrFromUsd(fallbackDetail?.hotelPerNight || 0)
    const fallbackFoodPerDayInr =
      daysAllocated > 0 ? toInrFromUsd((fallbackDetail?.foodCost || 0) / Math.max(daysAllocated, 1)) : 0
    const fallbackLocalPerDayInr =
      daysAllocated > 0 ? toInrFromUsd((fallbackDetail?.localTransportCost || 0) / Math.max(daysAllocated, 1)) : 0
    const fallbackActivityPerDayInr =
      daysAllocated > 0 ? toInrFromUsd((fallbackDetail?.activitiesCost || 0) / Math.max(daysAllocated, 1)) : 0

    const foodPerDay = deriveDailySpend(
      fallbackFoodPerDayInr || foodRangesByBudget[setup.budgetPreference][0],
      foodRangesByBudget[setup.budgetPreference],
      destination,
      setup.travelStyle
    )
    const localPerDay = deriveDailySpend(
      fallbackLocalPerDayInr || localTravelRangesByBudget[setup.budgetPreference][0],
      localTravelRangesByBudget[setup.budgetPreference],
      destination,
      setup.travelStyle
    )
    const activitiesPerDay = deriveDailySpend(
      fallbackActivityPerDayInr || activityRangesByBudget[setup.budgetPreference][0],
      activityRangesByBudget[setup.budgetPreference],
      destination,
      setup.travelStyle
    )
    const entryFeeInr = roundCurrency(Number(destination.entryFee || 0) * USD_TO_INR)

    const hotelCost = roundCurrency(hotelPerNight * nightsAllocated)
    const foodCost = roundCurrency(foodPerDay * daysAllocated)
    const localTransportCost = roundCurrency(localPerDay * daysAllocated)
    const activitiesCost = roundCurrency(activitiesPerDay * daysAllocated + entryFeeInr)

    return {
      id: destination.id,
      name: destination.name,
      location: [destination.city || destination.state, destination.country].filter(Boolean).join(", "),
      daysAllocated,
      nightsAllocated,
      hotelPerNight,
      hotelCost,
      foodCost,
      localTransportCost,
      activitiesCost,
      flightEstimate: 0,
      totalEstimate: hotelCost + foodCost + localTransportCost + activitiesCost,
      pricingSource: hotelResults[index]?.status.source || "Destination pricing model",
      averageDailyCost: roundCurrency((hotelCost + foodCost + localTransportCost + activitiesCost) / Math.max(daysAllocated, 1)),
      hotelSource: hotelResults[index]?.status.message,
      foodSource: "Food estimate uses destination-aware daily dining ranges.",
      travelSource: "Local transport estimate uses route distance and city transfers.",
    }
  })

  const flightResult = await fetchFlightCostInr(
    req,
    setup,
    orderedDestinations[0],
    fallback.flightCost
  )

  if (destinationDetails.length > 0) {
    destinationDetails[0] = {
      ...destinationDetails[0],
      flightEstimate: flightResult.amount,
      totalEstimate: destinationDetails[0].totalEstimate + flightResult.amount,
    }
  }

  let intercityDistanceKm = 0
  let liveLegCount = 0
  const routeLegs = orderedDestinations.slice(1)

  for (let index = 1; index < orderedDestinations.length; index += 1) {
    const destination = orderedDestinations[index]
    const previous = orderedDestinations[index - 1]
    if (!previous) continue

    const from =
      Number.isFinite(Number(previous.latitude)) && Number.isFinite(Number(previous.longitude))
        ? {
            lat: Number(previous.latitude),
            lon: Number(previous.longitude),
          }
        : null
    const to =
      Number.isFinite(Number(destination.latitude)) && Number.isFinite(Number(destination.longitude))
        ? {
            lat: Number(destination.latitude),
            lon: Number(destination.longitude),
          }
        : null

    if (from && to) {
      const liveDistance = await fetchDrivingDistanceKm(req, from, to)
      if (liveDistance > 0) {
        intercityDistanceKm += liveDistance
        liveLegCount += 1
        continue
      }

      intercityDistanceKm +=
        haversineDistanceKm(
          { name: previous.name, latitude: from.lat, longitude: from.lon },
          { name: destination.name, latitude: to.lat, longitude: to.lon }
        ) * 1.18
    }
  }

  const hotelCost = destinationDetails.reduce((sum, item) => sum + item.hotelCost, 0)
  const foodCost = destinationDetails.reduce((sum, item) => sum + item.foodCost, 0)
  const localTransportCost = destinationDetails.reduce((sum, item) => sum + item.localTransportCost, 0)
  const destinationActivitiesCost = destinationDetails.reduce((sum, item) => sum + item.activitiesCost, 0)
  const intercityTravelCost = roundCurrency(intercityDistanceKm * intercityRateByBudget[setup.budgetPreference])

  const bufferRateBase = setup.travelStyle === "relaxed" ? 0.1 : setup.travelStyle === "fast-paced" ? 0.18 : 0.14
  const bufferRate =
    setup.budgetPreference === "luxury"
      ? clamp(bufferRateBase + 0.02, 0.1, 0.2)
      : setup.budgetPreference === "budget"
        ? clamp(bufferRateBase - 0.01, 0.1, 0.2)
        : clamp(bufferRateBase, 0.1, 0.2)
  const activitiesBuffer = roundCurrency(
    (flightResult.amount + hotelCost + foodCost + localTransportCost + intercityTravelCost) * bufferRate
  )

  const travelCost = roundCurrency(flightResult.amount + localTransportCost + intercityTravelCost)
  const totalBudget = roundCurrency(hotelCost + foodCost + travelCost + destinationActivitiesCost + activitiesBuffer)

  const hotelsQuality = combineQuality(hotelResults.map((item) => item.status.mode))
  const localTravelQuality =
    routeLegs.length === 0 ? "fallback" : liveLegCount === routeLegs.length ? "live" : liveLegCount > 0 ? "mixed" : "fallback"
  const estimateQuality = combineQuality([flightResult.status.mode, hotelsQuality, localTravelQuality, "fallback"])
  const variance = estimateQuality === "live" ? 0.08 : estimateQuality === "mixed" ? 0.13 : 0.2

  const componentStatus = {
    flights: flightResult.status,
    hotels: getComponentStatus(
      hotelsQuality,
      hotelsQuality === "live"
        ? "Amadeus hotel offers"
        : hotelsQuality === "mixed"
          ? "Mixed live hotel inventory"
          : "Destination hotel averages",
      hotelsQuality === "live"
        ? "Hotel estimate uses live hotel pricing across selected destinations."
        : hotelsQuality === "mixed"
          ? "Some destinations used live hotel pricing while others used fallback averages."
          : "Hotel estimate uses destination-aware fallback pricing."
    ),
    food: getComponentStatus(
      "fallback",
      "Destination dining ranges",
      "Food estimate uses destination popularity, region, and budget preference to set daily spend."
    ),
    localTravel: getComponentStatus(
      localTravelQuality,
      localTravelQuality === "live" ? "OpenRouteService + heuristics" : "Distance heuristics",
      localTravelQuality === "live"
        ? "Inter-city travel distance uses live routing data."
        : localTravelQuality === "mixed"
          ? "Some route legs used live driving distance, and the rest used great-circle fallback."
          : "Local travel uses destination transfers and route-distance heuristics."
    ),
  }

  const sourceAttribution = Array.from(
    new Set([
      componentStatus.flights.source,
      componentStatus.hotels.source,
      componentStatus.food.source,
      componentStatus.localTravel.source,
    ])
  )

  return {
    totalBudget,
    totalBudgetRange: {
      min: roundCurrency(totalBudget * (1 - variance)),
      max: roundCurrency(totalBudget * (1 + variance * 1.08)),
    },
    perDayCost: roundCurrency(totalBudget / Math.max(totalDays, 1)),
    travelCost,
    totalDays,
    totalNights,
    destinationsCount: destinationDetails.length,
    totalDistanceKm: Math.round(routePreview.totalDistanceKm),
    routeNames: routePreview.routeNames,
    packedWarning:
      totalDays > 0 && destinationDetails.length > 0 && totalDays / destinationDetails.length < 2
        ? "Trip may feel packed for the number of destinations selected."
        : null,
    breakdown: {
      stay: hotelCost,
      food: foodCost,
      travel: travelCost,
      activities: destinationActivitiesCost + activitiesBuffer,
    },
    flightCost: flightResult.amount,
    intercityTravelCost,
    localTransportCost,
    hotelCost,
    averageHotelPerNight: roundCurrency(hotelCost / Math.max(totalNights, 1)),
    destinationDetails,
    pricingNotes: [
      `Flight estimate uses ${componentStatus.flights.source.toLowerCase()}.`,
      `Hotel estimate uses ${componentStatus.hotels.source.toLowerCase()}.`,
      `Activities include destination-level spend plus a ${Math.round(bufferRate * 100)}% contingency buffer.`,
      setup.startingLocation.trim()
        ? `Route starts from ${setup.startingLocation.trim()} and continues across ${destinationDetails.length} stop${destinationDetails.length === 1 ? "" : "s"}.`
        : "Add a starting city to make the arrival flight estimate more precise.",
    ],
    currency: "INR",
    activitiesBuffer,
    estimateQuality,
    sourceAttribution,
    componentStatus,
    fetchedAt: new Date().toISOString(),
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LegacyBudgetRequest | TripSetupState

    if ("destination" in body) {
      const legacyResponse = legacyBudgetLookup(body)
      if (!legacyResponse) {
        return NextResponse.json({ error: "Budget data not available" }, { status: 404 })
      }
      return NextResponse.json(legacyResponse)
    }

    const setup = body as TripSetupState
    if (!setup?.selectedDestinations?.length) {
      return NextResponse.json({ error: "Missing destinations" }, { status: 400 })
    }
    if (!setup?.dateRange?.from || !setup?.dateRange?.to) {
      return NextResponse.json({ error: "Missing travel dates" }, { status: 400 })
    }

    const cacheKey = `budget:${buildBudgetCacheKey(setup)}`
    const cached = getCache<TripBudgetEstimate>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const estimate = await buildTripBudget(req, setup)
    setCache(cacheKey, estimate, BUDGET_TTL_MS)

    return NextResponse.json(estimate)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Budget API error" }, { status: 500 })
  }
}
