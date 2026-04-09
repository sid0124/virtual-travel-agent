import { differenceInCalendarDays } from "date-fns"

import { convertUsdToInr, DEFAULT_CURRENCY } from "@/lib/currency"
import { budgetEstimates, destinations, hotels } from "@/lib/data"

export type BudgetPreference = "budget" | "mid-range" | "luxury"
export type TravelStyle = "relaxed" | "balanced" | "fast-paced"

export type SelectedDestination = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
  region?: string
  image?: string
  latitude?: number
  longitude?: number
  entryFee?: number
  destinationKey?: string
  originalName?: string
  sourceType?: string
  sourceItemId?: string
  budget?: {
    min: number
    max: number
    currency: string
  }
}

export type DiscoveryContextState = {
  searchQuery: string
  budgetRange: [number, number]
  selectedInterests: string[]
  selectedRegion: string
  selectedState: string
  selectedType: string
  unescoOnly: boolean
  sortBy: string
  activeFiltersCount: number
}

export type TripSetupState = {
  selectedDestinations: SelectedDestination[]
  dateRange: {
    from?: string
    to?: string
  }
  travelStyle: TravelStyle
  budgetPreference: BudgetPreference
  startingLocation: string
  travelers: number
  discoveryContext: DiscoveryContextState
}

export type RouteStop = {
  name: string
  latitude: number
  longitude: number
}

export type BudgetBreakdown = {
  stay: number
  food: number
  travel: number
  activities: number
}

export type BudgetRange = {
  min: number
  max: number
}

export type BudgetEstimateQuality = "live" | "mixed" | "fallback"

export type BudgetComponentStatus = {
  mode: BudgetEstimateQuality
  source: string
  message: string
}

export type DestinationBudgetDetail = {
  id: string
  name: string
  location: string
  daysAllocated: number
  nightsAllocated: number
  hotelPerNight: number
  hotelCost: number
  foodCost: number
  localTransportCost: number
  activitiesCost: number
  flightEstimate: number
  totalEstimate: number
  pricingSource: string
  averageDailyCost?: number
  hotelSource?: string
  foodSource?: string
  travelSource?: string
}

export type TripBudgetEstimate = {
  totalBudget: number
  totalBudgetRange: BudgetRange
  perDayCost: number
  travelCost: number
  totalDays: number
  totalNights: number
  destinationsCount: number
  totalDistanceKm: number
  routeNames: string[]
  packedWarning: string | null
  breakdown: BudgetBreakdown
  flightCost: number
  intercityTravelCost: number
  localTransportCost: number
  hotelCost: number
  averageHotelPerNight: number
  destinationDetails: DestinationBudgetDetail[]
  pricingNotes: string[]
  currency: string
  activitiesBuffer: number
  estimateQuality: BudgetEstimateQuality
  sourceAttribution: string[]
  componentStatus: {
    flights: BudgetComponentStatus
    hotels: BudgetComponentStatus
    food: BudgetComponentStatus
    localTravel: BudgetComponentStatus
  }
  fetchedAt: string
}

export const TRIP_SETUP_STORAGE_KEY = "WANDERLY_TRIP_SETUP"
export const TRIP_BUDGET_STORAGE_KEY = "WANDERLY_TRIP_BUDGET"

const regionDailyBaselines: Record<
  string,
  Record<BudgetPreference, { total: number; hotel: number; food: number; local: number; activity: number; flight: number }>
> = {
  "South Asia": {
    budget: { total: 48, hotel: 18, food: 10, local: 6, activity: 8, flight: 95 },
    "mid-range": { total: 105, hotel: 42, food: 20, local: 10, activity: 16, flight: 150 },
    luxury: { total: 230, hotel: 110, food: 38, local: 18, activity: 30, flight: 280 },
  },
  "Southeast Asia": {
    budget: { total: 55, hotel: 22, food: 12, local: 7, activity: 9, flight: 120 },
    "mid-range": { total: 120, hotel: 48, food: 24, local: 11, activity: 18, flight: 190 },
    luxury: { total: 250, hotel: 120, food: 42, local: 20, activity: 34, flight: 330 },
  },
  "East Asia": {
    budget: { total: 78, hotel: 34, food: 18, local: 10, activity: 12, flight: 180 },
    "mid-range": { total: 165, hotel: 78, food: 32, local: 15, activity: 24, flight: 320 },
    luxury: { total: 340, hotel: 175, food: 55, local: 25, activity: 42, flight: 520 },
  },
  "Middle East": {
    budget: { total: 90, hotel: 40, food: 20, local: 12, activity: 15, flight: 220 },
    "mid-range": { total: 190, hotel: 95, food: 35, local: 18, activity: 28, flight: 360 },
    luxury: { total: 420, hotel: 235, food: 60, local: 32, activity: 48, flight: 650 },
  },
  "Western Europe": {
    budget: { total: 115, hotel: 56, food: 28, local: 14, activity: 18, flight: 320 },
    "mid-range": { total: 235, hotel: 128, food: 48, local: 20, activity: 32, flight: 520 },
    luxury: { total: 470, hotel: 280, food: 78, local: 30, activity: 54, flight: 860 },
  },
  "Southern Europe": {
    budget: { total: 95, hotel: 45, food: 24, local: 12, activity: 16, flight: 280 },
    "mid-range": { total: 205, hotel: 105, food: 44, local: 18, activity: 28, flight: 450 },
    luxury: { total: 415, hotel: 240, food: 70, local: 28, activity: 48, flight: 760 },
  },
  "North America": {
    budget: { total: 130, hotel: 68, food: 34, local: 16, activity: 20, flight: 260 },
    "mid-range": { total: 265, hotel: 150, food: 58, local: 22, activity: 35, flight: 420 },
    luxury: { total: 520, hotel: 320, food: 90, local: 34, activity: 58, flight: 720 },
  },
  Oceania: {
    budget: { total: 120, hotel: 62, food: 28, local: 15, activity: 18, flight: 420 },
    "mid-range": { total: 240, hotel: 132, food: 48, local: 22, activity: 34, flight: 700 },
    luxury: { total: 480, hotel: 295, food: 80, local: 34, activity: 56, flight: 1120 },
  },
  "South America": {
    budget: { total: 72, hotel: 30, food: 16, local: 9, activity: 12, flight: 260 },
    "mid-range": { total: 145, hotel: 72, food: 30, local: 14, activity: 22, flight: 450 },
    luxury: { total: 300, hotel: 165, food: 52, local: 22, activity: 38, flight: 760 },
  },
  Africa: {
    budget: { total: 78, hotel: 33, food: 18, local: 10, activity: 13, flight: 250 },
    "mid-range": { total: 155, hotel: 76, food: 30, local: 15, activity: 24, flight: 430 },
    luxury: { total: 315, hotel: 175, food: 52, local: 24, activity: 40, flight: 730 },
  },
}

const fallbackBaseline = {
  budget: { total: 85, hotel: 35, food: 18, local: 10, activity: 12, flight: 180 },
  "mid-range": { total: 170, hotel: 80, food: 34, local: 16, activity: 25, flight: 320 },
  luxury: { total: 340, hotel: 190, food: 58, local: 26, activity: 40, flight: 560 },
}

const travelStyleMultipliers: Record<TravelStyle, { food: number; local: number; activity: number }> = {
  relaxed: { food: 0.96, local: 0.92, activity: 0.9 },
  balanced: { food: 1, local: 1, activity: 1 },
  "fast-paced": { food: 1.05, local: 1.12, activity: 1.14 },
}

const arrivalFlightMultiplier: Record<BudgetPreference, number> = {
  budget: 0.82,
  "mid-range": 1,
  luxury: 1.28,
}

const locationAliases: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  uae: "united arab emirates",
}

export const defaultTripSetupState: TripSetupState = {
  selectedDestinations: [],
  dateRange: {},
  travelStyle: "balanced",
  budgetPreference: "mid-range",
  startingLocation: "",
  travelers: 1,
  discoveryContext: {
    searchQuery: "",
    budgetRange: [0, 50000],
    selectedInterests: [],
    selectedRegion: "All Regions",
    selectedState: "All States",
    selectedType: "All Types",
    unescoOnly: false,
    sortBy: "popular",
    activeFiltersCount: 0,
  },
}

export function normalizeSelectedDestination(input: Partial<SelectedDestination>): SelectedDestination | null {
  const id = String(input.id || "").trim()
  const name = String(input.name || "").trim()
  if (!id || !name) return null

  const datasetMatch = destinations.find((destination) => destination.id === id)

  return {
    id,
    name,
    city: input.city || datasetMatch?.city,
    state: input.state || datasetMatch?.state,
    country: input.country || datasetMatch?.country,
    region: input.region || datasetMatch?.region,
    image: input.image || datasetMatch?.image,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : datasetMatch?.latitude,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : datasetMatch?.longitude,
    entryFee: Number.isFinite(Number(input.entryFee)) ? Number(input.entryFee) : datasetMatch?.entryFee,
    destinationKey: input.destinationKey || id,
    originalName: input.originalName || name,
    sourceType: input.sourceType || "destination",
    sourceItemId: input.sourceItemId || id,
    budget: input.budget || datasetMatch?.budget,
  }
}

export function dedupeSelectedDestinations(destinationsList: SelectedDestination[]) {
  const unique = new Map<string, SelectedDestination>()
  for (const destination of destinationsList) {
    unique.set(destination.id, destination)
  }
  return Array.from(unique.values())
}

export function getTripDuration(dateRange: TripSetupState["dateRange"]) {
  if (!dateRange.from || !dateRange.to) {
    return { totalDays: 0, totalNights: 0 }
  }

  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  const diff = differenceInCalendarDays(to, from)

  if (Number.isNaN(diff) || diff < 0) {
    return { totalDays: 0, totalNights: 0 }
  }

  return {
    totalDays: diff + 1,
    totalNights: diff,
  }
}

export function haversineDistanceKm(a: RouteStop, b: RouteStop) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const deltaLat = toRadians(b.latitude - a.latitude)
  const deltaLon = toRadians(b.longitude - a.longitude)
  const lat1 = toRadians(a.latitude)
  const lat2 = toRadians(b.latitude)

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2) * Math.cos(lat1) * Math.cos(lat2)

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine))
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\busa\b/g, "united states")
    .replace(/\buk\b/g, "united kingdom")
    .replace(/\buae\b/g, "united arab emirates")
}

function normalizeLocationValue(value?: string | null) {
  const normalized = normalizeText(value)
  return locationAliases[normalized] || normalized
}

function isSameLocation(a?: string | null, b?: string | null) {
  const left = normalizeLocationValue(a)
  const right = normalizeLocationValue(b)
  return Boolean(left && right && left === right)
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getRegionBaseline(destination: SelectedDestination, preference: BudgetPreference) {
  const raw = regionDailyBaselines[destination.region || ""]?.[preference] || fallbackBaseline[preference]
  return {
    total: convertUsdToInr(raw.total),
    hotel: convertUsdToInr(raw.hotel),
    food: convertUsdToInr(raw.food, 10),
    local: convertUsdToInr(raw.local, 10),
    activity: convertUsdToInr(raw.activity, 10),
    flight: convertUsdToInr(raw.flight),
  }
}

function getDestinationDailyBase(destination: SelectedDestination, preference: BudgetPreference) {
  const regional = getRegionBaseline(destination, preference)
  if (!destination.budget) {
    return regional.total
  }

  if (preference === "budget") return destination.budget.min
  if (preference === "luxury") return Math.max(destination.budget.max, destination.budget.max * 1.08)
  return (destination.budget.min + destination.budget.max) / 2
}

function findBudgetEstimateMatch(destination: SelectedDestination) {
  const destinationName = normalizeText(destination.name)
  const city = normalizeLocationValue(destination.city)
  const country = normalizeLocationValue(destination.country)
  const region = normalizeLocationValue(destination.region)

  let bestMatch: (typeof budgetEstimates)[number] | undefined
  let bestScore = -1

  for (const estimate of budgetEstimates) {
    let score = 0
    if (normalizeText(estimate.destination) === destinationName) score += 6
    if (city && normalizeLocationValue(estimate.city) === city) score += 4
    if (country && normalizeLocationValue(estimate.country) === country) score += 3
    if (region && normalizeLocationValue(estimate.region) === region) score += 1

    if (score > bestScore) {
      bestMatch = score > 0 ? estimate : bestMatch
      bestScore = score
    }
  }

  return bestMatch
}

function findMatchingHotels(destination: SelectedDestination) {
  const destinationName = normalizeText(destination.name)
  const city = normalizeLocationValue(destination.city)
  const country = normalizeLocationValue(destination.country)

  let matches = hotels.filter((hotel) => normalizeText(hotel.destination) === destinationName)
  if (matches.length) return matches

  matches = hotels.filter((hotel) => city && normalizeLocationValue(hotel.city) === city)
  if (matches.length) return matches

  if (!country) return []
  return hotels.filter((hotel) => {
    const hotelDestination = destinations.find((item) => normalizeText(item.name) === normalizeText(hotel.destination))
    return hotelDestination ? isSameLocation(hotelDestination.country, country) : false
  })
}

function lookupStartingLocationContext(input: string) {
  const normalizedInput = normalizeText(input)
  if (!normalizedInput) return null

  const exactDestination = destinations.find((destination) => {
    const values = [destination.name, destination.city, destination.state, destination.country]
    return values.some((value) => normalizeText(value) === normalizedInput)
  })

  if (exactDestination) {
    return {
      city: exactDestination.city,
      state: exactDestination.state,
      country: exactDestination.country,
      region: exactDestination.region,
    }
  }

  const partialDestination = destinations.find((destination) => {
    const values = [destination.name, destination.city, destination.state, destination.country]
      .map((value) => normalizeText(value))
      .filter(Boolean)
    return values.some((value) => normalizedInput.includes(value) || value.includes(normalizedInput))
  })

  if (partialDestination) {
    return {
      city: partialDestination.city,
      state: partialDestination.state,
      country: partialDestination.country,
      region: partialDestination.region,
    }
  }

  return {
    city: input.trim(),
    state: undefined,
    country: undefined,
    region: undefined,
  }
}

function getHotelRate(
  destination: SelectedDestination,
  preference: BudgetPreference,
  estimateMatch?: (typeof budgetEstimates)[number]
) {
  const matchingHotels = findMatchingHotels(destination)
  const hotelPrices = matchingHotels.map((hotel) => hotel.price).filter((price) => Number.isFinite(price))
  const hotelAverage = average(hotelPrices)
  const hotelMinimum = hotelPrices.length ? Math.min(...hotelPrices) : 0
  const hotelMaximum = hotelPrices.length ? Math.max(...hotelPrices) : 0

  const dailyBase = getDestinationDailyBase(destination, preference)
  const regional = getRegionBaseline(destination, preference)

  const derivedHotelRate =
    preference === "budget"
      ? dailyBase * 0.38
      : preference === "luxury"
        ? dailyBase * 0.54
        : dailyBase * 0.44

  const referenceHotelRate =
    preference === "budget"
      ? hotelMinimum || estimateMatch?.hotelPricePerNight || hotelAverage
      : preference === "luxury"
        ? hotelMaximum || estimateMatch?.hotelPricePerNight || hotelAverage
        : estimateMatch?.hotelPricePerNight || hotelAverage || hotelMinimum

  const clampedReference = referenceHotelRate
    ? clamp(referenceHotelRate, derivedHotelRate * 0.7, Math.max(derivedHotelRate * 2.4, regional.hotel * 2.2))
    : derivedHotelRate

  const weight = referenceHotelRate ? 0.42 : 0
  const hotelPerNight = Math.round(derivedHotelRate * (1 - weight) + clampedReference * weight)

  let pricingSource = "regional pricing"
  if (hotelPrices.length && estimateMatch) pricingSource = "hotel + destination pricing data"
  else if (hotelPrices.length) pricingSource = "hotel pricing data"
  else if (estimateMatch) pricingSource = "destination pricing data"

  return {
    hotelPerNight: Math.max(18, hotelPerNight),
    pricingSource,
  }
}

function getDailySpendProfile(
  destination: SelectedDestination,
  preference: BudgetPreference,
  style: TravelStyle,
  estimateMatch?: (typeof budgetEstimates)[number]
) {
  const regional = getRegionBaseline(destination, preference)
  const dailyBase = getDestinationDailyBase(destination, preference)
  const styleAdjustments = travelStyleMultipliers[style]

  const fallbackFood =
    preference === "budget"
      ? dailyBase * 0.22
      : preference === "luxury"
        ? dailyBase * 0.2
        : dailyBase * 0.21

  const fallbackActivity =
    preference === "budget"
      ? dailyBase * 0.18
      : preference === "luxury"
        ? dailyBase * 0.16
        : dailyBase * 0.17

  const foodPerDay = Math.round(
    (estimateMatch?.foodCostPerDay || Math.max(regional.food, fallbackFood)) * styleAdjustments.food
  )
  const localTransportPerDay = Math.round(
    (estimateMatch?.localTransportCost || regional.local) * styleAdjustments.local
  )
  const activityPerDay = Math.round(
    (estimateMatch?.activityCostAvg || Math.max(regional.activity, fallbackActivity)) * styleAdjustments.activity
  )

  return {
    foodPerDay,
    localTransportPerDay,
    activityPerDay,
  }
}

function estimateArrivalFlightCost(
  setup: TripSetupState,
  firstDestination: SelectedDestination | undefined,
  firstDestinationEstimate?: (typeof budgetEstimates)[number]
) {
  if (!firstDestination) return 0

  const baseFlight =
    firstDestinationEstimate?.avgFlightCost || getRegionBaseline(firstDestination, setup.budgetPreference).flight
  const multiplier = arrivalFlightMultiplier[setup.budgetPreference]
  const startContext = lookupStartingLocationContext(setup.startingLocation)

  if (!startContext) {
    return Math.round(baseFlight * 0.72 * multiplier)
  }

  if (isSameLocation(startContext.city, firstDestination.city)) {
    return 0
  }

  if (isSameLocation(startContext.state, firstDestination.state) && isSameLocation(startContext.country, firstDestination.country)) {
    return Math.round(convertUsdToInr(28, 10) * multiplier)
  }

  if (isSameLocation(startContext.country, firstDestination.country)) {
    return Math.round(baseFlight * 0.32 * multiplier)
  }

  if (startContext.region && isSameLocation(startContext.region, firstDestination.region)) {
    return Math.round(baseFlight * 0.74 * multiplier)
  }

  return Math.round(baseFlight * multiplier)
}

function estimateLegTransferCost(distanceKm: number, preference: BudgetPreference) {
  if (distanceKm <= 0) return 0

  if (distanceKm < 100) {
    return convertUsdToInr(preference === "budget" ? 12 + distanceKm * 0.08 : preference === "luxury" ? 38 + distanceKm * 0.18 : 22 + distanceKm * 0.12, 10)
  }

  if (distanceKm < 350) {
    return convertUsdToInr(distanceKm * (preference === "budget" ? 0.11 : preference === "luxury" ? 0.28 : 0.18), 10)
  }

  if (distanceKm < 900) {
    return convertUsdToInr(distanceKm * (preference === "budget" ? 0.15 : preference === "luxury" ? 0.36 : 0.24), 10)
  }

  return Math.max(
    convertUsdToInr(preference === "budget" ? 110 : preference === "luxury" ? 320 : 190),
    convertUsdToInr(distanceKm * (preference === "budget" ? 0.14 : preference === "luxury" ? 0.33 : 0.21), 10)
  )
}

function distributeTripUnits(totalUnits: number, count: number) {
  if (count <= 0) return []
  const base = Math.floor(totalUnits / count)
  const remainder = totalUnits % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

function orderRoute(destinationsList: SelectedDestination[]) {
  const routeCandidates = destinationsList.filter(
    (destination) =>
      Number.isFinite(Number(destination.latitude)) &&
      Number.isFinite(Number(destination.longitude))
  )

  if (routeCandidates.length <= 1) {
    return routeCandidates
  }

  const remaining = [...routeCandidates]
  remaining.sort(
    (a, b) =>
      String(a.region || "").localeCompare(String(b.region || "")) || String(a.name).localeCompare(String(b.name))
  )

  const ordered: SelectedDestination[] = []
  const first = remaining.shift()
  if (!first) return ordered
  ordered.push(first)

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1]
    let nextIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    remaining.forEach((candidate, index) => {
      const distance = haversineDistanceKm(
        {
          name: current.name,
          latitude: Number(current.latitude),
          longitude: Number(current.longitude),
        },
        {
          name: candidate.name,
          latitude: Number(candidate.latitude),
          longitude: Number(candidate.longitude),
        }
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nextIndex = index
      }
    })

    ordered.push(remaining.splice(nextIndex, 1)[0])
  }

  return ordered
}

export function estimateTravelDistance(destinationsList: SelectedDestination[]) {
  const orderedDestinations = orderRoute(destinationsList)
  const routeNames = orderedDestinations.map((destination) => destination.name)

  const totalDistanceKm = orderedDestinations.slice(1).reduce((sum, destination, index) => {
    const previous = orderedDestinations[index]
    return (
      sum +
      haversineDistanceKm(
        {
          name: previous.name,
          latitude: Number(previous.latitude),
          longitude: Number(previous.longitude),
        },
        {
          name: destination.name,
          latitude: Number(destination.latitude),
          longitude: Number(destination.longitude),
        }
      )
    )
  }, 0)

  return {
    orderedDestinations,
    routeNames,
    totalDistanceKm: Math.round(totalDistanceKm),
  }
}

export function buildBudgetEstimate(setup: TripSetupState): TripBudgetEstimate {
  const { totalDays, totalNights } = getTripDuration(setup.dateRange)
  const { orderedDestinations, totalDistanceKm, routeNames } = estimateTravelDistance(setup.selectedDestinations)
  const routeFallback = orderedDestinations.length ? orderedDestinations : setup.selectedDestinations
  const destinationsCount = routeFallback.length

  const allocatedDays = distributeTripUnits(Math.max(totalDays, destinationsCount || 1), Math.max(destinationsCount, 1))
  const allocatedNights = distributeTripUnits(totalNights, Math.max(destinationsCount, 1))

  const destinationDetails = routeFallback.map((destination, index) => {
    const estimateMatch = findBudgetEstimateMatch(destination)
    const { hotelPerNight, pricingSource } = getHotelRate(destination, setup.budgetPreference, estimateMatch)
    const { foodPerDay, localTransportPerDay, activityPerDay } = getDailySpendProfile(
      destination,
      setup.budgetPreference,
      setup.travelStyle,
      estimateMatch
    )

    const daysAllocated = allocatedDays[index] || 0
    const nightsAllocated = allocatedNights[index] || 0
    const hotelCost = hotelPerNight * nightsAllocated
    const foodCost = foodPerDay * daysAllocated
    const localTransportCost = localTransportPerDay * daysAllocated
    const entryFee = Math.max(Number(destination.entryFee || 0), Number(estimateMatch?.entryFee || 0))
    const activitiesCost = activityPerDay * daysAllocated + entryFee

    return {
      id: destination.id,
      name: destination.name,
      location: [destination.city || destination.state, destination.country].filter(Boolean).join(", "),
      daysAllocated,
      nightsAllocated,
      hotelPerNight,
      hotelCost: Math.round(hotelCost),
      foodCost: Math.round(foodCost),
      localTransportCost: Math.round(localTransportCost),
      activitiesCost: Math.round(activitiesCost),
      flightEstimate: 0,
      totalEstimate: Math.round(hotelCost + foodCost + localTransportCost + activitiesCost),
      pricingSource,
    }
  })

  const firstDestinationEstimate = routeFallback.length ? findBudgetEstimateMatch(routeFallback[0]) : undefined
  const arrivalFlightCost = estimateArrivalFlightCost(setup, routeFallback[0], firstDestinationEstimate)

  if (destinationDetails.length) {
    destinationDetails[0] = {
      ...destinationDetails[0],
      flightEstimate: arrivalFlightCost,
      totalEstimate: destinationDetails[0].totalEstimate + arrivalFlightCost,
    }
  }

  const intercityTravelCost = routeFallback.slice(1).reduce((sum, destination, index) => {
    const previous = routeFallback[index]
    if (
      !Number.isFinite(Number(previous.latitude)) ||
      !Number.isFinite(Number(previous.longitude)) ||
      !Number.isFinite(Number(destination.latitude)) ||
      !Number.isFinite(Number(destination.longitude))
    ) {
      return sum
    }

    const legDistance = haversineDistanceKm(
      {
        name: previous.name,
        latitude: Number(previous.latitude),
        longitude: Number(previous.longitude),
      },
      {
        name: destination.name,
        latitude: Number(destination.latitude),
        longitude: Number(destination.longitude),
      }
    )

    return sum + estimateLegTransferCost(legDistance, setup.budgetPreference)
  }, 0)

  const hotelCost = destinationDetails.reduce((sum, item) => sum + item.hotelCost, 0)
  const foodCost = destinationDetails.reduce((sum, item) => sum + item.foodCost, 0)
  const localTransportCost = destinationDetails.reduce((sum, item) => sum + item.localTransportCost, 0)
  const activitiesCost = destinationDetails.reduce((sum, item) => sum + item.activitiesCost, 0)
  const travelCost = Math.round(arrivalFlightCost + intercityTravelCost + localTransportCost)
  const totalBudget = Math.round(hotelCost + foodCost + activitiesCost + travelCost)
  const averageHotelPerNight = Math.round(hotelCost / Math.max(totalNights, 1))

  const pricingNotes = [
    setup.startingLocation.trim()
      ? `Flight estimate starts from ${setup.startingLocation.trim()} and scales by domestic or international routing.`
      : "Flight estimate uses a generic arrival fare because no starting city was entered.",
    "Hotel pricing blends destination budget bands with matching hotel records when available.",
    "Travel cost combines arrival flight, local transfers, and inter-city movement between selected stops.",
  ]

  const packedWarning =
    totalDays > 0 && destinationsCount > 0 && totalDays / destinationsCount < 2
      ? "Trip may be packed for the number of destinations selected."
      : null

  return {
    totalBudget,
    totalBudgetRange: {
      min: Math.round(totalBudget * 0.9),
      max: Math.round(totalBudget * 1.12),
    },
    perDayCost: Math.round(totalBudget / Math.max(totalDays, 1)),
    travelCost,
    totalDays,
    totalNights,
    destinationsCount,
    totalDistanceKm,
    routeNames,
    packedWarning,
    breakdown: {
      stay: Math.round(hotelCost),
      food: Math.round(foodCost),
      travel: Math.round(travelCost),
      activities: Math.round(activitiesCost),
    },
    flightCost: Math.round(arrivalFlightCost),
    intercityTravelCost: Math.round(intercityTravelCost),
    localTransportCost: Math.round(localTransportCost),
    hotelCost: Math.round(hotelCost),
    averageHotelPerNight,
    destinationDetails,
    pricingNotes,
    currency: DEFAULT_CURRENCY,
    activitiesBuffer: 0,
    estimateQuality: "fallback",
    sourceAttribution: ["Static Wanderly pricing dataset"],
    componentStatus: {
      flights: {
        mode: "fallback",
        source: "Regional flight heuristic",
        message: "Flight estimate uses destination and regional baselines.",
      },
      hotels: {
        mode: "fallback",
        source: "Hotel dataset + regional bands",
        message: "Hotel estimate blends hotel records with destination pricing.",
      },
      food: {
        mode: "fallback",
        source: "Destination food ranges",
        message: "Food estimate uses regional and destination spending bands.",
      },
      localTravel: {
        mode: "fallback",
        source: "Distance heuristic",
        message: "Local travel estimate uses route distance and daily transfers.",
      },
    },
    fetchedAt: new Date().toISOString(),
  }
}

export function convertBudgetEstimateCurrency(
  estimate: TripBudgetEstimate,
  currency: string,
  exchangeRate: number
): TripBudgetEstimate {
  if (estimate.currency === currency) {
    return estimate
  }

  const convert = (value: number) => Math.round(value * exchangeRate)

  return {
    ...estimate,
    totalBudget: convert(estimate.totalBudget),
    totalBudgetRange: {
      min: convert(estimate.totalBudgetRange.min),
      max: convert(estimate.totalBudgetRange.max),
    },
    perDayCost: convert(estimate.perDayCost),
    travelCost: convert(estimate.travelCost),
    breakdown: {
      stay: convert(estimate.breakdown.stay),
      food: convert(estimate.breakdown.food),
      travel: convert(estimate.breakdown.travel),
      activities: convert(estimate.breakdown.activities),
    },
    flightCost: convert(estimate.flightCost),
    intercityTravelCost: convert(estimate.intercityTravelCost),
    localTransportCost: convert(estimate.localTransportCost),
    hotelCost: convert(estimate.hotelCost),
    averageHotelPerNight: convert(estimate.averageHotelPerNight),
    activitiesBuffer: convert(estimate.activitiesBuffer),
    destinationDetails: estimate.destinationDetails.map((destination) => ({
      ...destination,
      hotelPerNight: convert(destination.hotelPerNight),
      hotelCost: convert(destination.hotelCost),
      foodCost: convert(destination.foodCost),
      localTransportCost: convert(destination.localTransportCost),
      activitiesCost: convert(destination.activitiesCost),
      flightEstimate: convert(destination.flightEstimate),
      totalEstimate: convert(destination.totalEstimate),
      averageDailyCost: destination.averageDailyCost ? convert(destination.averageDailyCost) : undefined,
    })),
    currency,
    sourceAttribution: Array.from(
      new Set([...estimate.sourceAttribution, `Fallback currency conversion at ${exchangeRate} ${currency}/USD`])
    ),
  }
}
