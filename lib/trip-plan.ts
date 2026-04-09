import { addDays, differenceInCalendarDays, format } from "date-fns"

export const TRIP_PLAN_STORAGE_KEY = "wanderly_trip_plan"

export type TripPlace = {
  name: string
  city: string
  country?: string
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
  entryFee?: number
  visitDate?: string
  visitTime?: string
  durationMinutes?: number
  isOptional?: boolean
  source?: string
}

export type TripContextLike = {
  fromLocation?: string
  origin?: string
  routeOrder?: string[]
  dateRange?: { from: string; to: string }
  startDate?: string
  endDate?: string
  tripDays?: number
  travelersCount?: number
  travelers?: number
  budgetLevel?: string
  currency?: string
  preferences?: string[]
  selectedPlaces?: TripPlace[]
  itineraryOrder?: string[]
}

export type HotelBooking = {
  id: string
  name: string
  pricePerNight: number
  currency: string
  address?: string | null
  imageUrl?: string | null
  rating?: number | null
  nights?: number
  checkIn?: string
  checkOut?: string
}

export type FlightBooking = {
  id: string
  airline?: string
  departTime?: string
  arriveTime?: string
  price: number
  currency: string
  stops?: number | string
  duration?: string
  from?: string
  to?: string
}

export type Activity = {
  id: string
  type: "hotel" | "sightseeing" | "food" | "travel" | "free" | "other"
  title: string
  time: string
  locationLabel: string
  cost: number
  currency: string
  durationMinutes?: number
  isOptional?: boolean
  aiNotes?: string
  meta?: {
    placeId?: string
    hotelId?: string
    flightId?: string
    [key: string]: unknown
  }
}

export type DayPlan = {
  dayNumber: number
  date: string
  title: string
  city: string
  activities: Activity[]
}

export type TripPlan = {
  tripContext: TripContextLike
  segments: Array<{ key: string; origin: string; destination: string }>
  bookings: {
    hotelsByCity: Record<string, HotelBooking>
    flightsBySegment: Record<string, FlightBooking>
    skippedHotelsByCity: Record<string, boolean>
    skippedFlightsBySegment: Record<string, boolean>
  }
  itinerary: {
    days: DayPlan[]
  }
  createdAt: number
  updatedAt: number
  lastUpdatedAt: number
}

type BuildTripPlanInput = {
  tripContext: TripContextLike
  orderedRoute: string[]
  segmentDateMap: Record<string, { checkIn: string; checkOut: string; nights: number; departureDate: string }>
  hotelsByCity: Record<string, any>
  flightsBySegment: Record<string, any>
  skippedHotelsByCity?: Record<string, boolean>
  skippedFlightsBySegment?: Record<string, boolean>
}

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ")
}

export function makeSegmentKey(from: string, to: string): string {
  return `${normalizeCity(from)}->${normalizeCity(to)}`
}

function safeNumber(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function getTripDays(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 1
  const days = differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1
  return Math.max(1, days)
}

function foodCostByBudget(level?: string): number {
  const l = (level || "medium").toLowerCase()
  if (l === "low") return 12
  if (l === "premium") return 55
  return 25
}

function normalizeTime(t: unknown, fallback: string): string {
  if (typeof t !== "string") return fallback
  const match = t.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)
  return match ? `${match[1]}:${match[2]}` : fallback
}

function pickPlacesForCity(places: TripPlace[], city: string) {
  return places.filter((p) => (p.city || "").toLowerCase() === city.toLowerCase())
}

function buildHotelsByCity(
  selectedHotelsByCity: BuildTripPlanInput["hotelsByCity"],
  segmentDateMap: BuildTripPlanInput["segmentDateMap"]
): Record<string, HotelBooking> {
  const hotelsByCity: Record<string, HotelBooking> = {}

  for (const [cityKey, hotel] of Object.entries(selectedHotelsByCity)) {
    if (!hotel) continue
    const normalizedCityKey = normalizeCity(cityKey)
    const segmentDates = Object.entries(segmentDateMap).find(([city]) => normalizeCity(city) === normalizedCityKey)?.[1]
    hotelsByCity[normalizedCityKey] = {
      id: String(hotel.id || `${normalizedCityKey}-hotel`),
      name: String(hotel.name || `${cityKey} Hotel`),
      pricePerNight: safeNumber(hotel.pricePerNight ?? hotel.price, 0),
      currency: String(hotel.currency || "INR"),
      address: hotel.address ?? null,
      imageUrl: hotel.imageUrl ?? null,
      rating: typeof hotel.rating === "number" ? hotel.rating : null,
      nights: segmentDates?.nights || 1,
      checkIn: segmentDates?.checkIn,
      checkOut: segmentDates?.checkOut,
    }
  }

  return hotelsByCity
}

function buildFlightsBySegment(
  selectedFlightsBySegment: BuildTripPlanInput["flightsBySegment"]
): Record<string, FlightBooking> {
  const flightsBySegment: Record<string, FlightBooking> = {}

  for (const [segmentKey, f] of Object.entries(selectedFlightsBySegment)) {
    if (!f) continue
    flightsBySegment[segmentKey] = {
      id: String(f.id || segmentKey),
      airline: f.airline,
      departTime: normalizeTime(f.departure || f.departTime, "09:00"),
      arriveTime: normalizeTime(f.arrival || f.arriveTime, "11:30"),
      price: safeNumber(f.priceTotal ?? f.price, 0),
      currency: String(f.currency || "INR"),
      stops: typeof f.stops === "number" || typeof f.stops === "string" ? f.stops : undefined,
      duration: typeof f.duration === "string" ? f.duration : undefined,
      from: f.from,
      to: f.to,
    }
  }

  return flightsBySegment
}

function buildDayCitySequence(days: number, orderedRoute: string[], selectedPlaces: TripPlace[]): string[] {
  const routeCities = orderedRoute.slice(1)
  const fallback = selectedPlaces.map((p) => p.city).filter(Boolean)
  const cities = routeCities.length > 0 ? routeCities : fallback
  if (cities.length === 0) return Array.from({ length: days }, () => "Destination")

  return Array.from({ length: days }, (_, idx) => {
    const cityIndex = Math.min(cities.length - 1, Math.floor((idx * cities.length) / days))
    return cities[cityIndex]
  })
}

function generateItineraryDays(input: BuildTripPlanInput, hotelsByCity: Record<string, HotelBooking>, flightsBySegment: Record<string, FlightBooking>): DayPlan[] {
  const startDate = input.tripContext.startDate ? new Date(input.tripContext.startDate) : new Date()
  const endDate = input.tripContext.endDate ? new Date(input.tripContext.endDate) : startDate
  const daysCount = getTripDays(format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"))
  const places = Array.isArray(input.tripContext.selectedPlaces) ? input.tripContext.selectedPlaces : []
  const dayCities = buildDayCitySequence(daysCount, input.orderedRoute, places)
  const foodCost = foodCostByBudget(input.tripContext.budgetLevel)

  const placeQueues: Record<string, TripPlace[]> = {}
  for (const city of dayCities) {
    if (!placeQueues[city]) {
      placeQueues[city] = pickPlacesForCity(places, city)
    }
  }

  const days: DayPlan[] = []

  for (let i = 0; i < daysCount; i++) {
    const dayNumber = i + 1
    const date = format(addDays(startDate, i), "yyyy-MM-dd")
    const city = dayCities[i]
    const previousCity = i > 0 ? dayCities[i - 1] : null
    const nextCity = i < dayCities.length - 1 ? dayCities[i + 1] : null
    const activities: Activity[] = []

    if (dayNumber === 1) {
      const firstSegmentKey = makeSegmentKey(input.orderedRoute[0] || input.tripContext.fromLocation || "Origin", city)
      const firstFlight = flightsBySegment[firstSegmentKey]
      activities.push({
        id: `d${dayNumber}-travel-arrival`,
        type: "travel",
        title: firstFlight ? `${firstFlight.airline || "Flight"} arrival to ${city}` : `Travel to ${city}`,
        time: firstFlight?.arriveTime || "09:00",
        locationLabel: city,
        cost: 0,
        currency: "INR",
        meta: firstFlight ? { flightId: firstFlight.id } : undefined,
      })

      const cityKey = normalizeCity(city)
      if (hotelsByCity[cityKey]) {
        activities.push({
          id: `d${dayNumber}-hotel-checkin`,
          type: "hotel",
          title: `Hotel check-in: ${hotelsByCity[cityKey].name}`,
          time: "14:00",
          locationLabel: city,
          cost: 0,
          currency: hotelsByCity[cityKey].currency,
          meta: { hotelId: hotelsByCity[cityKey].id },
        })
      }
    }

    if (previousCity && previousCity !== city) {
      const segmentKey = makeSegmentKey(previousCity, city)
      const flight = flightsBySegment[segmentKey]
      activities.push({
        id: `d${dayNumber}-travel-${segmentKey}`,
        type: "travel",
        title: flight ? `${flight.airline || "Flight"} ${previousCity} to ${city}` : `Travel from ${previousCity} to ${city}`,
        time: flight?.departTime || "09:00",
        locationLabel: `${previousCity} -> ${city}`,
        cost: 0,
        currency: flight?.currency || "INR",
        meta: flight ? { flightId: flight.id } : undefined,
      })

      const cityKey = normalizeCity(city)
      if (hotelsByCity[cityKey]) {
        activities.push({
          id: `d${dayNumber}-hotel-checkin-${city}`,
          type: "hotel",
          title: `Hotel check-in: ${hotelsByCity[cityKey].name}`,
          time: "14:00",
          locationLabel: city,
          cost: 0,
          currency: hotelsByCity[cityKey].currency,
          meta: { hotelId: hotelsByCity[cityKey].id },
        })
      }
    }

    const queue = placeQueues[city] || []
    const visitSlots = dayNumber === 1 ? ["16:00"] : ["10:00", "14:00"]

    for (const time of visitSlots) {
      const place = queue.shift()
      if (!place) break
      activities.push({
        id: `d${dayNumber}-place-${place.name}-${time}`,
        type: "sightseeing",
        title: `Visit ${place.name}`,
        time,
        locationLabel: `${place.city}${place.country ? `, ${place.country}` : ""}`,
        cost: safeNumber(place.entryFee, 0),
        currency: "INR",
        meta: { placeId: place.name },
      })
    }

    activities.push({
      id: `d${dayNumber}-food`,
      type: "food",
      title: "Local dinner",
      time: "19:00",
      locationLabel: city,
      cost: foodCost,
      currency: "INR",
    })

    if (dayNumber === daysCount) {
      const cityKey = normalizeCity(city)
      if (hotelsByCity[cityKey]) {
        activities.push({
          id: `d${dayNumber}-hotel-checkout-${city}`,
          type: "hotel",
          title: `Hotel check-out: ${hotelsByCity[cityKey].name}`,
          time: "11:00",
          locationLabel: city,
          cost: 0,
          currency: hotelsByCity[cityKey].currency,
          meta: { hotelId: hotelsByCity[cityKey].id },
        })
      }

      const origin = input.orderedRoute[0] || input.tripContext.fromLocation || "Origin"
      const returnFlight = flightsBySegment[makeSegmentKey(city, origin)]
      if (returnFlight) {
        activities.push({
          id: `d${dayNumber}-return-flight`,
          type: "travel",
          title: `Return flight to ${origin}`,
          time: returnFlight.departTime || "17:00",
          locationLabel: `${city} -> ${origin}`,
          cost: 0,
          currency: returnFlight.currency,
          meta: { flightId: returnFlight.id },
        })
      }
    }

    const titlePlace = activities.find((a) => a.type === "sightseeing")
    const title = titlePlace
      ? dayNumber === 1
        ? `Arrival & ${titlePlace.title.replace("Visit ", "")}`
        : `${city} highlights`
      : dayNumber === daysCount
        ? `Departure from ${city}`
        : `Explore ${city}`

    days.push({
      dayNumber,
      date,
      city,
      title,
      activities,
    })
  }

  return days
}

export function buildTripPlan(input: BuildTripPlanInput): TripPlan {
  const normalizedStartDate = input.tripContext.startDate || input.tripContext.dateRange?.from || ""
  const normalizedEndDate = input.tripContext.endDate || input.tripContext.dateRange?.to || normalizedStartDate
  const normalizedTripContext: TripContextLike = {
    ...input.tripContext,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  }
  const hotelsByCity = buildHotelsByCity(input.hotelsByCity, input.segmentDateMap)
  const flightsBySegment = buildFlightsBySegment(input.flightsBySegment)
  const days = generateItineraryDays({ ...input, tripContext: normalizedTripContext }, hotelsByCity, flightsBySegment)
  const segments = input.orderedRoute.slice(1).map((destination, idx) => ({
    key: makeSegmentKey(input.orderedRoute[idx] || "", destination),
    origin: input.orderedRoute[idx] || "",
    destination,
  }))
  const timestamp = Date.now()

  return {
    tripContext: {
      ...normalizedTripContext,
      routeOrder: input.orderedRoute,
      dateRange: {
        from: normalizedStartDate,
        to: normalizedEndDate,
      },
      travelersCount: normalizedTripContext.travelersCount || normalizedTripContext.travelers || 1,
    },
    segments,
    bookings: {
      hotelsByCity,
      flightsBySegment,
      skippedHotelsByCity: Object.fromEntries(
        Object.entries(input.skippedHotelsByCity || {}).map(([k, v]) => [normalizeCity(k), Boolean(v)])
      ),
      skippedFlightsBySegment: Object.fromEntries(
        Object.entries(input.skippedFlightsBySegment || {}).map(([k, v]) => [k, Boolean(v)])
      ),
    },
    itinerary: {
      days,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUpdatedAt: timestamp,
  }
}

export function readTripPlan(): TripPlan | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(TRIP_PLAN_STORAGE_KEY) || localStorage.getItem("WANDERLY_TRIP_PLAN")
    if (!raw) return null
    return JSON.parse(raw) as TripPlan
  } catch {
    return null
  }
}

export function saveTripPlan(plan: TripPlan): void {
  if (typeof window === "undefined") return
  localStorage.setItem(TRIP_PLAN_STORAGE_KEY, JSON.stringify(plan))
}

export function getTripPlanCostSummary(plan: TripPlan): {
  activityCost: number
  hotelCost: number
  flightCost: number
  totalCost: number
} {
  const activityCost = plan.itinerary.days.reduce(
    (sum, day) => sum + day.activities.reduce((s, a) => s + safeNumber(a.cost, 0), 0),
    0
  )

  const hotelCost = Object.values(plan.bookings.hotelsByCity).reduce((sum, hotel) => {
    const nights = Math.max(1, safeNumber(hotel.nights, 1))
    return sum + safeNumber(hotel.pricePerNight, 0) * nights
  }, 0)

  const flightCost = Object.values(plan.bookings.flightsBySegment).reduce(
    (sum, flight) => sum + safeNumber(flight.price, 0),
    0
  )

  return {
    activityCost,
    hotelCost,
    flightCost,
    totalCost: activityCost + hotelCost + flightCost,
  }
}

export function updateTripPlanDayActivity(plan: TripPlan, dayNumber: number, activityId: string, title: string): TripPlan {
  const days = plan.itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) return day
    return {
      ...day,
      activities: day.activities.map((activity) =>
        activity.id === activityId ? { ...activity, title: title.trim() || activity.title } : activity
      ),
    }
  })

  return {
    ...plan,
    itinerary: { days },
    lastUpdatedAt: Date.now(),
  }
}

export function deleteTripPlanActivity(plan: TripPlan, dayNumber: number, activityId: string): TripPlan {
  const days = plan.itinerary.days.map((day) => {
    if (day.dayNumber !== dayNumber) return day
    return {
      ...day,
      activities: day.activities.filter((activity) => activity.id !== activityId),
    }
  })

  return {
    ...plan,
    itinerary: { days },
    lastUpdatedAt: Date.now(),
  }
}

export type TripEditAction = "add_activity" | "remove_activity" | "update_activity" | "move_activity" | "reorder_activities"

export type TripEditPayload = {
  id?: string | null
  type?: Activity["type"] | string | null
  title?: string | null
  time?: string | null
  locationLabel?: string | null
  cost?: number | null
  currency?: string | null
  meta?: Record<string, unknown> | null
}

export type TripEditChange = {
  action: TripEditAction
  dayNumber: number
  activityId: string | null
  toDayNumber: number | null
  payload: TripEditPayload | null
  rationale?: string
}

export type TripEditRequest = {
  assistant_intent_summary?: string
  assumptions?: string[]
  questions_for_user?: string[]
  changes: TripEditChange[]
  preview?: unknown
  validation_notes?: string[]
}

export type TripEditResult = {
  plan: TripPlan
  validationNotes: string[]
}

export type StructuredOptimizationResponse = {
  analysis?: {
    issues_found?: string[]
    optimization_strategy?: string
  }
  optimized_itinerary?: {
    days?: Array<{
      dayNumber?: number
      day_number?: number
      date?: string
      city?: string
      title?: string
      activities?: Array<{
        id?: string
        type?: string
        title?: string
        time?: string
        locationLabel?: string
        location?: string
        cost?: number
        estimated_cost?: number
        currency?: string
        durationMinutes?: number
        duration_minutes?: number
        isOptional?: boolean
        notes?: string
        aiNotes?: string
        meta?: Record<string, unknown>
      }>
    }>
  }
}

function toMinutes(time?: string | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER
  const match = String(time).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  if (!match) return Number.MAX_SAFE_INTEGER
  return Number(match[1]) * 60 + Number(match[2])
}

function isValidTime(time?: string | null): boolean {
  if (!time) return false
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time))
}

function placeTokenFromMeta(
  metaPlaceId: unknown,
  title: string,
  selectedPlaces: TripPlace[]
): string {
  const rawMeta = String(metaPlaceId || "").trim()
  if (rawMeta) {
    const byId = selectedPlaces.find((p: any) => String((p as any).id || "").trim() === rawMeta)
    if (byId && (byId as any).id != null) return String((byId as any).id)
    const byName = selectedPlaces.find((p) => p.name.toLowerCase() === rawMeta.toLowerCase())
    if (byName && (byName as any).id != null) return String((byName as any).id)
  }

  const lowered = title.toLowerCase()
  const matchByName = selectedPlaces.find((p) => lowered.includes((p.name || "").toLowerCase()))
  if (matchByName && (matchByName as any).id != null) return String((matchByName as any).id)
  return rawMeta || "place"
}

function canonicalNonBookedId(activity: Activity, dayNumber: number, selectedPlaces: TripPlace[]): string {
  const safeTime = isValidTime(activity.time) ? activity.time : "14:00"
  const placeToken = placeTokenFromMeta(activity.meta?.placeId, activity.title, selectedPlaces)

  if (activity.type === "food") return `d${dayNumber}-food-${safeTime}`
  if (activity.type === "sightseeing" && activity.isOptional) return `d${dayNumber}-optional-${placeToken}-${safeTime}`
  if (activity.type === "sightseeing") return `d${dayNumber}-place-${placeToken}-${safeTime}`
  return activity.id || `d${dayNumber}-${activity.type}-${safeTime}`
}

function sortActivitiesByTime(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    const diff = toMinutes(a.time) - toMinutes(b.time)
    if (diff !== 0) return diff
    return a.id.localeCompare(b.id)
  })
}

function isLockedActivity(activity: Activity): boolean {
  const t = String(activity.type || "").toLowerCase()
  if (t === "travel" || t === "hotel") return true
  return Boolean(activity.meta?.flightId || activity.meta?.hotelId)
}

function findDay(days: DayPlan[], dayNumber: number) {
  return days.find((d) => d.dayNumber === dayNumber) || null
}

function makeActivityFromPayload(dayNumber: number, payload: TripEditPayload | null, fallbackId: string): Activity {
  const type = (payload?.type || "sightseeing") as Activity["type"]
  const title = String(payload?.title || "New activity")
  const time = normalizeTime(payload?.time, "14:00")
  const locationLabel = String(payload?.locationLabel || "New York City")
  const cost = safeNumber(payload?.cost, 0)
  const currency = String(payload?.currency || "INR")
  const id = String(payload?.id || fallbackId || `ai-d${dayNumber}-activity-${time}`)
  const meta =
    payload?.meta && typeof payload.meta === "object"
      ? ({
          ...(payload.meta as Record<string, unknown>),
        } as Activity["meta"])
      : undefined

  return {
    id,
    type,
    title,
    time,
    locationLabel,
    cost,
    currency,
    meta,
  }
}

function patchActivity(existing: Activity, payload: TripEditPayload | null): Activity {
  const next: Activity = { ...existing }
  if (!payload) return next
  if (payload.type != null) next.type = payload.type as Activity["type"]
  if (payload.title != null) next.title = String(payload.title)
  if (payload.time != null) next.time = normalizeTime(payload.time, existing.time || "14:00")
  if (payload.locationLabel != null) next.locationLabel = String(payload.locationLabel)
  if (payload.cost != null) next.cost = safeNumber(payload.cost, existing.cost)
  if (payload.currency != null) next.currency = String(payload.currency)
  if (payload.meta != null && typeof payload.meta === "object") {
    next.meta = payload.meta as Activity["meta"]
  }
  return next
}

export function applyTripEdits(plan: TripPlan, request: TripEditRequest): TripEditResult {
  const notes: string[] = []
  const days: DayPlan[] = plan.itinerary.days.map((d) => ({ ...d, activities: [...d.activities] }))

  for (const change of request.changes || []) {
    const sourceDay = findDay(days, change.dayNumber)
    if (!sourceDay) {
      notes.push(`Skipped ${change.action}: day ${change.dayNumber} not found.`)
      continue
    }

    if (change.action === "reorder_activities") {
      sourceDay.activities = sortActivitiesByTime(sourceDay.activities)
      continue
    }

    if (change.action === "add_activity") {
      const fallbackId = `ai-d${sourceDay.dayNumber}-activity-${Date.now()}`
      sourceDay.activities.push(makeActivityFromPayload(sourceDay.dayNumber, change.payload, fallbackId))
      sourceDay.activities = sortActivitiesByTime(sourceDay.activities)
      continue
    }

    if (!change.activityId) {
      notes.push(`Skipped ${change.action}: activityId missing for day ${change.dayNumber}.`)
      continue
    }

    const idx = sourceDay.activities.findIndex((a) => a.id === change.activityId)
    if (idx < 0) {
      notes.push(`Skipped ${change.action}: activity ${change.activityId} not found on day ${change.dayNumber}.`)
      continue
    }

    const activity = sourceDay.activities[idx]
    const locked = isLockedActivity(activity)

    if (change.action === "remove_activity") {
      if (locked) {
        notes.push(`Skipped remove_activity: ${change.activityId} is locked.`)
        continue
      }
      sourceDay.activities.splice(idx, 1)
      continue
    }

    if (change.action === "update_activity") {
      if (locked) {
        notes.push(`Skipped update_activity: ${change.activityId} is locked.`)
        continue
      }
      sourceDay.activities[idx] = patchActivity(activity, change.payload)
      sourceDay.activities = sortActivitiesByTime(sourceDay.activities)
      continue
    }

    if (change.action === "move_activity") {
      const destinationDayNumber = change.toDayNumber ?? change.dayNumber
      const destinationDay = findDay(days, destinationDayNumber)
      if (!destinationDay) {
        notes.push(`Skipped move_activity: destination day ${destinationDayNumber} not found.`)
        continue
      }
      if (locked && destinationDayNumber !== change.dayNumber) {
        notes.push(`Skipped move_activity: ${change.activityId} is locked and cannot move across days.`)
        continue
      }

      const [removed] = sourceDay.activities.splice(idx, 1)
      const moved = locked ? removed : patchActivity(removed, change.payload)
      destinationDay.activities.push(moved)
      sourceDay.activities = sortActivitiesByTime(sourceDay.activities)
      destinationDay.activities = sortActivitiesByTime(destinationDay.activities)
    }
  }

  const nextPlan: TripPlan = {
    ...plan,
    itinerary: { days },
    lastUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  }

  return { plan: nextPlan, validationNotes: notes }
}

export function applyStructuredOptimizationResponse(
  plan: TripPlan,
  response: StructuredOptimizationResponse
): TripEditResult {
  const notes: string[] = []
  const incomingDays = Array.isArray(response?.optimized_itinerary?.days) ? response.optimized_itinerary!.days! : []
  const selectedPlaces = Array.isArray(plan.tripContext.selectedPlaces) ? plan.tripContext.selectedPlaces : []
  const existingDays = plan.itinerary.days

  if (incomingDays.length === 0) {
    notes.push("No optimized_itinerary.days provided; kept existing itinerary.")
    return { plan, validationNotes: notes }
  }

  const originalBookedByKey = new Map<string, Activity>()
  const originalBookedTravelByFlightId = new Map<string, Activity>()
  const originalBookedHotelByHotelId = new Map<string, Activity[]>()

  for (const day of existingDays) {
    for (const act of day.activities) {
      if (act.meta?.flightId) {
        originalBookedByKey.set(`flight:${act.meta.flightId}`, act)
        originalBookedTravelByFlightId.set(act.meta.flightId, act)
      }
      if (act.meta?.hotelId) {
        const key = String(act.meta.hotelId)
        const list = originalBookedHotelByHotelId.get(key) || []
        list.push(act)
        originalBookedHotelByHotelId.set(key, list)
      }
    }
  }

  const nextDays: DayPlan[] = existingDays.map((existingDay) => {
    const incomingDay =
      incomingDays.find((d) => Number(d.dayNumber ?? d.day_number) === existingDay.dayNumber) ||
      incomingDays.find((d) => String(d.date || "") === existingDay.date)

    if (!incomingDay) {
      notes.push(`Day ${existingDay.dayNumber} missing in optimized JSON; kept original day.`)
      return { ...existingDay, activities: sortActivitiesByTime(existingDay.activities) }
    }

    const rawActivities = Array.isArray(incomingDay.activities) ? incomingDay.activities : []
    const rebuilt: Activity[] = []

    for (const raw of rawActivities) {
      const typeRaw = String(raw?.type || "other").toLowerCase()
      const normalizedType: Activity["type"] =
        typeRaw === "travel" || typeRaw === "hotel" || typeRaw === "sightseeing" || typeRaw === "food" || typeRaw === "free" || typeRaw === "other"
          ? (typeRaw as Activity["type"])
          : "other"

      const time = normalizeTime(raw?.time, "14:00")
      const durationMinutes = safeNumber(raw?.durationMinutes ?? raw?.duration_minutes, normalizedType === "food" ? 90 : normalizedType === "hotel" ? 30 : 90)
      const baseActivity: Activity = {
        id: String(raw?.id || ""),
        type: normalizedType,
        title: String(raw?.title || "Untitled activity"),
        time,
        locationLabel: String(raw?.locationLabel || raw?.location || existingDay.city),
        cost: safeNumber(raw?.cost ?? raw?.estimated_cost, 0),
        currency: String(raw?.currency || "INR"),
        durationMinutes,
        isOptional: Boolean(raw?.isOptional),
        aiNotes: String(raw?.aiNotes || raw?.notes || ""),
        meta: raw?.meta && typeof raw.meta === "object" ? ({ ...raw.meta } as Activity["meta"]) : {},
      }

      if (baseActivity.meta?.flightId) {
        const flightId = String(baseActivity.meta.flightId)
        const original = originalBookedTravelByFlightId.get(flightId)
        if (!original) {
          notes.push(`Skipped travel activity with unknown flightId ${flightId}.`)
          continue
        }
        rebuilt.push({
          ...baseActivity,
          id: original.id,
          title: original.title,
          time: original.time,
          locationLabel: baseActivity.locationLabel || original.locationLabel,
          cost: original.cost,
          currency: original.currency || baseActivity.currency,
          meta: { ...(original.meta || {}) },
          isOptional: false,
        })
        continue
      }

      if (baseActivity.meta?.hotelId) {
        const hotelId = String(baseActivity.meta.hotelId)
        const originals = originalBookedHotelByHotelId.get(hotelId) || []
        const fallback = originals.find((a) => a.id.toLowerCase().includes("checkout"))
          ? originals.find((a) => a.id.toLowerCase().includes("checkout"))
          : originals[0]
        if (!fallback) {
          notes.push(`Skipped hotel activity with unknown hotelId ${hotelId}.`)
          continue
        }
        rebuilt.push({
          ...baseActivity,
          id: fallback.id,
          title: fallback.title,
          time: isValidTime(baseActivity.time) ? baseActivity.time : fallback.time,
          cost: fallback.cost,
          currency: fallback.currency || baseActivity.currency,
          meta: { ...(fallback.meta || {}) },
          isOptional: false,
        })
        continue
      }

      const withCanonicalId: Activity = {
        ...baseActivity,
        id: canonicalNonBookedId(baseActivity, existingDay.dayNumber, selectedPlaces),
      }
      rebuilt.push(withCanonicalId)
    }

    for (const original of existingDay.activities) {
      if (!original.meta?.flightId && !original.meta?.hotelId) continue
      const exists = rebuilt.some((a) => {
        if (original.meta?.flightId && a.meta?.flightId) return String(a.meta.flightId) === String(original.meta.flightId)
        if (original.meta?.hotelId && a.meta?.hotelId) return String(a.meta.hotelId) === String(original.meta.hotelId) && a.id === original.id
        return false
      })
      if (!exists) {
        rebuilt.push({ ...original })
        notes.push(`Reinserted missing booked activity ${original.id} on day ${existingDay.dayNumber}.`)
      }
    }

    return {
      ...existingDay,
      title: String(incomingDay.title || existingDay.title),
      city: String(incomingDay.city || existingDay.city),
      activities: sortActivitiesByTime(rebuilt),
    }
  })

  const nextPlan: TripPlan = {
    ...plan,
    itinerary: { days: nextDays },
    updatedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  }

  return { plan: nextPlan, validationNotes: notes }
}
