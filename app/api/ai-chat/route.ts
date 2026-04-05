import Groq from "groq-sdk"
import { NextResponse } from "next/server"

import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency"
import { destinationWeather, destinations, flights, hotels } from "@/lib/data"
import {
  buildBudgetEstimate,
  dedupeSelectedDestinations,
  defaultTripSetupState,
  estimateTravelDistance,
  getTripDuration,
  haversineDistanceKm,
  normalizeSelectedDestination,
} from "@/lib/trip-budget"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }
type Intent =
  | "nearby_places"
  | "destination_discovery"
  | "budget_estimation"
  | "flight_guidance"
  | "hotel_guidance"
  | "weather_guidance"
  | "best_time_guidance"
  | "planning_guidance"
  | "trip_modification"
  | "general_qa"

type NearbyPlace = {
  id: string
  name: string
  subtitle?: string
  whyVisit: string
  travelTime?: string
  bestFor?: string
}

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

const norm = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const PLACE_ALIASES: Record<string, string> = {
  "time square": "Times Square",
  "times square": "Times Square",
  "central park nyc": "Central Park",
  "central park new york": "Central Park",
  "kochi": "Kochi",
  "cochin": "Kochi",
}

const CURATED_NEARBY_PLACES: Record<string, NearbyPlace[]> = {
  "times square": [
    { id: "ts-broadway", name: "Broadway theatres", subtitle: "2-8 minutes away", whyVisit: "The classic Times Square experience for live shows and musicals.", travelTime: "Walk 2-8 min", bestFor: "Evening entertainment" },
    { id: "ts-bryant", name: "Bryant Park", subtitle: "Midtown green space", whyVisit: "A calmer nearby stop for coffee, reading, and skyline views.", travelTime: "Walk 10-12 min", bestFor: "Relaxed break" },
    { id: "ts-rockefeller", name: "Rockefeller Center", subtitle: "Observation deck and plaza", whyVisit: "Great for city views, iconic NYC photos, and seasonal events.", travelTime: "Walk 10 min", bestFor: "Views and landmarks" },
    { id: "ts-topofrock", name: "Top of the Rock", subtitle: "Observation deck", whyVisit: "One of the best skyline viewpoints if you want sweeping Manhattan views.", travelTime: "Walk 10-12 min", bestFor: "Sunset views" },
    { id: "ts-fifth", name: "Fifth Avenue", subtitle: "Shopping and city walk", whyVisit: "Ideal for premium shopping, people-watching, and classic Midtown energy.", travelTime: "Walk 8-12 min", bestFor: "Shopping" },
    { id: "ts-empire", name: "Empire State Building", subtitle: "Iconic skyline stop", whyVisit: "A short ride away if you want another famous observation experience.", travelTime: "Taxi 10-15 min", bestFor: "First-time visitors" },
    { id: "ts-madame", name: "Madame Tussauds New York", subtitle: "Right by Times Square", whyVisit: "Good quick indoor attraction if you want a lighter tourist stop.", travelTime: "Walk 3-5 min", bestFor: "Indoor activity" },
    { id: "ts-hellskitchen", name: "Hell's Kitchen food spots", subtitle: "West of Times Square", whyVisit: "Better food variety than the busiest tourist strip around the square itself.", travelTime: "Walk 10 min", bestFor: "Food and dinner" },
  ],
  "central park": [
    { id: "cp-bethesda", name: "Bethesda Terrace", subtitle: "Central Park highlight", whyVisit: "One of the most photogenic and iconic spots inside the park.", travelTime: "Walk inside park", bestFor: "Photos" },
    { id: "cp-bowbridge", name: "Bow Bridge", subtitle: "Scenic bridge", whyVisit: "A romantic and classic Central Park view, especially in soft light.", travelTime: "Walk inside park", bestFor: "Scenery" },
    { id: "cp-met", name: "The Metropolitan Museum of Art", subtitle: "East side of the park", whyVisit: "Easy pairing if you want culture after your park walk.", travelTime: "Walk 8-12 min", bestFor: "Art and culture" },
    { id: "cp-columbus", name: "Columbus Circle", subtitle: "Southwest corner", whyVisit: "Great for shopping, food, and quick transit connections.", travelTime: "Walk 10-15 min", bestFor: "Food and shopping" },
    { id: "cp-strawberry", name: "Strawberry Fields", subtitle: "Peaceful memorial area", whyVisit: "Good quieter stop if you want a reflective corner of the park.", travelTime: "Walk inside park", bestFor: "Quiet pause" },
    { id: "cp-upperwest", name: "Upper West Side cafes", subtitle: "Neighborhood nearby", whyVisit: "Better neighborhood feel for breakfast, brunch, or slower local time.", travelTime: "Walk 10 min", bestFor: "Local vibe" },
  ],
}

function detectIntent(message: string): Intent {
  const text = norm(message)
  if (/(best places|best place|nearby places|nearby attractions|around|near me|things to do|places near|attractions near|explore near)/.test(text)) return "nearby_places"
  if (/(weather|temperature|rain|snow|climate|forecast)/.test(text)) return "weather_guidance"
  if (/(best time|best month|season to visit|good time to visit)/.test(text)) return "best_time_guidance"
  if (/(budget|cost|price|affordable|estimate|how much)/.test(text)) return "budget_estimation"
  if (/(hotel|stay|accommodation|resort|room)/.test(text)) return "hotel_guidance"
  if (/(flight|fly|airport|airfare|book flight)/.test(text)) return "flight_guidance"
  if (/(remove|change|switch|modify|replace|update|delete)/.test(text)) return "trip_modification"
  if (/(itinerary|plan|route|cover|order|day trip|days|vacation|holiday|trip)/.test(text)) return "planning_guidance"
  if (/(suggest|recommend|discover|where should i go|places like|destination)/.test(text)) return "destination_discovery"
  return "general_qa"
}

function parseBudgetPreference(text: string, fallback = "mid-range") {
  const value = norm(text)
  if (/(luxury|premium|five star|5 star)/.test(value)) return "luxury"
  if (/(budget|cheap|affordable|backpack)/.test(value)) return "budget"
  if (/(mid range|midrange|balanced|standard)/.test(value)) return "mid-range"
  return fallback
}

function parseTravelStyle(text: string, fallback = "balanced") {
  const value = norm(text)
  if (/(relaxed|slow|easy)/.test(value)) return "relaxed"
  if (/(fast paced|packed|busy)/.test(value)) return "fast-paced"
  return fallback
}

function parseTravelers(text: string, fallback = 1) {
  const count = Number(text.match(/(\d+)\s*(traveler|travelers|people|adult|adults)\b/i)?.[1] || fallback)
  return Number.isFinite(count) && count > 0 ? count : fallback
}

function parseDuration(text: string, fallback = 0) {
  const count = Number(text.match(/(\d+)\s*(day|days|night|nights|hour|hours)\b/i)?.[1] || fallback)
  return Number.isFinite(count) && count > 0 ? count : fallback
}

function buildQuickActions(memory: any, intent?: Intent) {
  const firstDestination = memory?.selectedDestinations?.[0]?.name
  const origin = memory?.startingLocation

  if (intent === "nearby_places" && firstDestination) {
    return ["Build 1-day plan", `Best food near ${firstDestination}`, `Hotels near ${firstDestination}`, `Weather in ${firstDestination}`]
  }

  if (firstDestination) {
    return [
      `Estimate ${firstDestination} budget`,
      `Hotels near ${firstDestination}`,
      origin ? `Flights from ${origin}` : "Find flights",
      `Weather in ${firstDestination}`,
      `Best time to visit ${firstDestination}`,
      "Modify my trip",
    ]
  }

  return ["Plan my trip", "Suggest destinations", "Estimate budget", "Find hotels", "Check weather", "Find flights"]
}

function buildSmartTitle(prompt: string, memory: any) {
  const normalized = norm(prompt)
  const destinationNames = Array.isArray(memory?.selectedDestinations)
    ? memory.selectedDestinations.map((item: any) => item.name).filter(Boolean)
    : []

  if (destinationNames.length > 0) {
    const first = destinationNames[0]
    if (/near|around|things to do|best places/.test(normalized)) return `Best places near ${first}`
    if (/budget/.test(normalized)) return `${first} budget planning`
    if (/flight/.test(normalized)) return `${first} flight options`
    if (/hotel|stay/.test(normalized)) return `Hotels near ${first}`
    if (/weather|best time|season/.test(normalized)) return `${first} travel timing`
    return `${first} trip plan`
  }

  const titleWords = prompt.replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" ")
  return titleWords || "New travel chat"
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseDateRange(text: string, existing: any) {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/g)
  if (iso && iso.length >= 2) return { from: iso[0], to: iso[1] }
  const today = new Date()
  const duration = parseDuration(text, 0)
  if (/next week/.test(norm(text))) {
    const start = new Date(today)
    start.setDate(start.getDate() + 7)
    const end = new Date(start)
    end.setDate(start.getDate() + Math.max(duration || 5, 1) - 1)
    return { from: toIsoDate(start), to: toIsoDate(end) }
  }
  if (/next month/.test(norm(text))) {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    const end = new Date(start)
    end.setDate(start.getDate() + Math.max(duration || 5, 1) - 1)
    return { from: toIsoDate(start), to: toIsoDate(end) }
  }
  return existing || {}
}

function scoreDestination(destination: (typeof destinations)[number], query: string) {
  const haystack = norm([destination.name, destination.city, destination.state, destination.country, destination.type, destination.region].filter(Boolean).join(" "))
  const q = norm(query)
  if (!q) return 0
  if (haystack === q) return 140
  if (haystack.includes(q)) return 90
  return q.split(" ").filter(Boolean).reduce((score, token) => score + (haystack.includes(token) ? 16 : 0), 0)
}

function searchDestinations(query: string, limit = 6) {
  return dedupeSelectedDestinations(
    destinations
      .map((destination) => ({ destination, score: scoreDestination(destination, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.destination.rating - a.destination.rating)
      .slice(0, limit)
      .map((item) => normalizeSelectedDestination(item.destination))
      .filter(Boolean) as any[]
  )
}

function compactDestination(destination: any) {
  const match = destinations.find((item) => item.id === destination.id)
  return {
    id: destination.id,
    name: destination.name,
    city: destination.city,
    state: destination.state,
    country: destination.country,
    image: destination.image || match?.image,
    bestTime: match?.bestTimeToVisit || match?.bestTime,
    description: match?.description,
    budget: destination.budget || match?.budget,
  }
}

function findMentionedDestinations(text: string, existing: any[]) {
  const picked = new Map(existing.map((item: any) => [item.id, item]))
  const normalizedText = norm(text)

  for (const destination of destinations) {
    const candidates = [destination.name, destination.city, destination.state, destination.country].filter(Boolean).map((item) => norm(item))
    if (candidates.some((candidate) => candidate && normalizedText.includes(candidate))) {
      const normalized = normalizeSelectedDestination(destination)
      if (normalized) picked.set(normalized.id, normalized)
    }
  }

  for (const [alias, canonical] of Object.entries(PLACE_ALIASES)) {
    if (!normalizedText.includes(alias)) continue
    const match = destinations.find((destination) => norm(destination.name) === norm(canonical))
    if (match) {
      const normalized = normalizeSelectedDestination(match)
      if (normalized) picked.set(normalized.id, normalized)
    }
  }

  const phrase = text.match(/(?:to|visit|in|near|around)\s+([a-zA-Z\s]+)/i)?.[1]
  if (phrase) {
    for (const destination of searchDestinations(phrase, 6)) picked.set(destination.id, destination)
  }

  return Array.from(picked.values())
}

function resolvePlace(query: string, context: any) {
  const normalizedQuery = norm(query)
  const aliasTarget = PLACE_ALIASES[normalizedQuery]
  const candidates = aliasTarget ? searchDestinations(aliasTarget, 3) : searchDestinations(query, 6)
  const contextMatch = (context?.selectedDestinations || []).find((item: any) => normalizedQuery.includes(norm(item.name)) || norm(item.name).includes(normalizedQuery))
  const selected = contextMatch || candidates[0] || context?.selectedDestinations?.[0]
  const record = destinations.find((item) => item.id === selected?.id)

  if (!selected || !record) return null

  return {
    ...selected,
    city: record.city,
    state: record.state,
    country: record.country,
    latitude: record.latitude,
    longitude: record.longitude,
    description: record.description,
    bestTime: record.bestTimeToVisit || record.bestTime,
  }
}

function buildContext(raw: any, messages: ChatMessage[], latest: string) {
  const transcript = messages.filter((message) => message.role === "user").map((message) => message.content).join(" ")
  const inferredDestinations = dedupeSelectedDestinations(findMentionedDestinations(transcript, raw?.selectedDestinations || []))
  const inferredDuration = parseDuration(transcript, raw?.durationDays || 0)
  const inferredDates = parseDateRange(transcript, raw?.dateRange)
  const startingLocationMatch = transcript.match(/(?:traveling|travelling|flying|going|coming)?\s*from\s+([a-zA-Z][a-zA-Z\s,]{1,40})(?=\s+(?:to|for|on|next|with|budget|in)\b|[.?!,]|$)/i)

  return {
    ...defaultTripSetupState,
    ...raw,
    selectedDestinations: inferredDestinations,
    startingLocation: startingLocationMatch?.[1]?.trim() || raw?.startingLocation || "",
    budgetPreference: parseBudgetPreference(transcript, raw?.budgetPreference || "mid-range"),
    travelStyle: parseTravelStyle(transcript, raw?.travelStyle || "balanced"),
    travelers: parseTravelers(transcript, raw?.travelers || 1),
    dateRange: inferredDates,
    durationDays: inferredDuration,
    latestUserMessage: latest,
  }
}

function findHotels(query: string, budgetPreference: string, limit = 4) {
  const value = norm(query)
  const ranked = hotels
    .filter((hotel) => [hotel.destination, hotel.city, hotel.name].some((item) => norm(item).includes(value)))
    .sort((a, b) => {
      if (budgetPreference === "budget") return a.price - b.price || b.rating - a.rating
      if (budgetPreference === "luxury") return b.rating - a.rating || b.price - a.price
      return b.rating - a.rating || a.price - b.price
    })
    .slice(0, limit)

  return ranked.map((hotel) => ({
    id: hotel.id,
    name: hotel.name,
    destination: hotel.destination,
    city: hotel.city,
    price: hotel.price,
    rating: hotel.rating,
    image: hotel.image,
    amenities: hotel.amenities,
    currency: DEFAULT_CURRENCY,
  }))
}

function estimateFlights(origin: string, destinationQuery: string, limit = 4) {
  const fromNeedle = norm(origin)
  const toNeedle = norm(destinationQuery)
  return flights
    .filter((flight) => {
      const from = norm(flight.from)
      const to = norm(flight.to)
      return (
        (!!fromNeedle && (from.includes(fromNeedle) || fromNeedle.includes(from))) ||
        (!!toNeedle && (to.includes(toNeedle) || toNeedle.includes(to)))
      )
    })
    .slice(0, limit)
    .map((flight) => ({ ...flight, currency: DEFAULT_CURRENCY }))
}

function ensureBudgetReadyContext(context: any) {
  const next = { ...context }
  const hasValidDates = Boolean(next.dateRange?.from && next.dateRange?.to)
  if (!hasValidDates && next.durationDays > 0) {
    const start = new Date()
    const end = new Date(start)
    end.setDate(start.getDate() + Math.max(next.durationDays - 1, 0))
    next.dateRange = { from: toIsoDate(start), to: toIsoDate(end) }
  }
  return next
}

function getWeather(placeName: string, destination: any) {
  const city = destination?.city || placeName
  const monthly = destinationWeather[city] || destinationWeather[destination?.name || ""] || []
  const current = destination?.weather || { temp: monthly[0]?.avgTemperature || 24, condition: monthly[0]?.weatherCondition || "Pleasant" }
  const condition = String(current.condition || "").toLowerCase()
  const packing =
    condition.includes("snow") ? "Pack a warm jacket, gloves, and insulated shoes." :
    condition.includes("rain") ? "Carry a light rain jacket or compact umbrella." :
    current.temp >= 30 ? "Light breathable clothes and sun protection are best." :
    current.temp <= 12 ? "Layer up for cooler mornings and evenings." :
    "Light layers work well for day-to-evening sightseeing."
  const bestHours =
    current.temp >= 30 ? "Outdoor walking is most comfortable early morning or after sunset." :
    condition.includes("rain") ? "Plan flexible indoor options around the wettest part of the day." :
    "Mid-morning to early evening is usually comfortable for sightseeing."
  const comfort =
    condition.includes("snow") ? "Great if you enjoy winter atmosphere, but walking-heavy plans can slow down." :
    condition.includes("rain") ? "Still workable for travel, but keep indoor backups for comfort." :
    current.temp >= 30 ? "Expect heat fatigue during long outdoor stretches." :
    "Comfort is generally good for walking, photos, and local exploration."

  return {
    place: destination?.name || city,
    city,
    temperatureC: current.temp,
    condition: current.condition,
    bestTime: destination?.bestTimeToVisit || destination?.bestTime,
    packing,
    bestHours,
    comfort,
  }
}

function optimizeRoute(context: any) {
  if (!context.selectedDestinations?.length) return null
  const route = estimateTravelDistance(context.selectedDestinations)
  const ordered = route.orderedDestinations.length ? route.orderedDestinations : context.selectedDestinations
  return {
    routeNames: ordered.map((item: any) => item.name),
    totalDistanceKm: route.totalDistanceKm,
  }
}

function updateTripContext(context: any, latest: string) {
  const lower = norm(latest)
  const next = { ...context }
  if (/budget/.test(lower) && /(luxury|premium)/.test(lower)) next.budgetPreference = "luxury"
  else if (/budget/.test(lower) && /(cheap|budget|affordable)/.test(lower)) next.budgetPreference = "budget"
  if (/mid range|midrange/.test(lower)) next.budgetPreference = "mid-range"
  if (/relaxed/.test(lower)) next.travelStyle = "relaxed"
  if (/fast paced|packed/.test(lower)) next.travelStyle = "fast-paced"
  if (/remove\s+/.test(lower) && next.selectedDestinations?.length) {
    const removeName = latest.match(/remove\s+([a-zA-Z\s]+)/i)?.[1]
    if (removeName) next.selectedDestinations = next.selectedDestinations.filter((item: any) => !norm(item.name).includes(norm(removeName)))
  }
  next.dateRange = parseDateRange(latest, next.dateRange)
  next.durationDays = parseDuration(latest, next.durationDays || 0)
  return next
}

function searchNearbyAttractions(place: any, limit = 6): NearbyPlace[] {
  const curated = CURATED_NEARBY_PLACES[norm(place?.name)]
  if (curated?.length) return curated.slice(0, limit)

  if (!Number.isFinite(Number(place?.latitude)) || !Number.isFinite(Number(place?.longitude))) return []

  return destinations
    .filter((destination) => destination.id !== place.id)
    .map((destination) => {
      const distanceKm = haversineDistanceKm(
        { name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude) },
        { name: destination.name, latitude: Number(destination.latitude), longitude: Number(destination.longitude) }
      )
      return { destination, distanceKm }
    })
    .filter((item) => item.distanceKm < 35 || norm(item.destination.city) === norm(place.city))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) => ({
      id: item.destination.id,
      name: item.destination.name,
      subtitle: [item.destination.city, item.destination.country].filter(Boolean).join(", "),
      whyVisit: item.destination.description,
      travelTime: item.distanceKm < 2 ? `Walk ${Math.max(5, Math.round(item.distanceKm * 12))} min` : `${Math.round(item.distanceKm)} km away`,
      bestFor: item.destination.type,
    }))
}

function buildActions(intent: Intent, focusName?: string) {
  if (intent === "nearby_places") return ["Build 1-day plan", focusName ? `Best food near ${focusName}` : "Best food nearby", focusName ? `Hotels near ${focusName}` : "Find hotels", focusName ? `Weather in ${focusName}` : "Check weather"]
  if (intent === "weather_guidance" || intent === "best_time_guidance") return ["Check Weather", "Best Time to Visit", "Find Hotels", "Estimate Budget"]
  if (intent === "budget_estimation") return ["Estimate Budget", "Find Hotels", "Find Flights", "Reduce Total Cost"]
  if (intent === "hotel_guidance") return ["Find Hotels", "Estimate Budget", "Check Weather", "Modify Trip"]
  if (intent === "flight_guidance") return ["Find Flights", "Estimate Budget", "Compare Options", "Modify Trip"]
  if (intent === "planning_guidance") return ["Start Planning", "Estimate Budget", "Find Hotels", "Modify Trip"]
  if (intent === "destination_discovery") return ["View Destinations", "Estimate Budget", "Check Weather", "Start Planning"]
  return ["Plan my trip", "Suggest destinations", "Estimate budget", "Find hotels"]
}

function askForMissing(intent: Intent, context: any, resolvedPlace: any) {
  if (intent === "nearby_places" && !resolvedPlace) return "Which place should I use? For example, Times Square, Central Park, Munnar, or Kochi."
  if (intent === "budget_estimation" && (!context.startingLocation || !context.selectedDestinations.length || (!context.dateRange?.from && !context.durationDays))) {
    return "Where are you traveling from, which destinations are you covering, and how many days or what dates should I use for the budget estimate?"
  }
  if (intent === "hotel_guidance" && !resolvedPlace && !context.selectedDestinations.length) return "For which destination and budget level should I look for hotels?"
  if (intent === "flight_guidance" && (!context.startingLocation || (!resolvedPlace && !context.selectedDestinations.length))) return "What route should I check flights for? Tell me your origin and destination."
  if ((intent === "weather_guidance" || intent === "best_time_guidance") && !resolvedPlace && !context.selectedDestinations.length) return "Which destination should I check weather and travel comfort for?"
  if (intent === "planning_guidance" && (!context.selectedDestinations.length || !context.startingLocation || (!context.durationDays && !context.dateRange?.from))) {
    return "Great choice. Where are you traveling from, how many days are you planning, and which destinations should I include?"
  }
  return ""
}

async function generateGroqReply(input: {
  userMessage: string
  intent: Intent
  context: any
  resolvedPlace?: any
  grounding: Record<string, any>
}) {
  if (!groq) return null

  const systemPrompt = [
    "You are Wanderly AI Travel Assistant, a production travel copilot inside a travel app.",
    "Answer like a travel consultant, not a generic chatbot.",
    "Stay geographically relevant to the user's request.",
    "Do not suggest unrelated locations.",
    "If nearby attractions are provided in the grounding data, prefer them and do not invent faraway places.",
    "Use the user's trip context when available and avoid repeating already known questions.",
    "Be concise, useful, and structured.",
    "For nearby attraction queries: answer the exact place first, then grounded nearby recommendations, then a helpful next step.",
    "For weather: answer weather + comfort + packing + best hours.",
    "For budget: answer with breakdown + savings tip.",
    "For hotels: recommend areas and selection logic, grounded in provided hotel data.",
    "For flights: mention route, expected range if provided, and booking timing guidance.",
    "If the grounding data is sparse, say that clearly instead of hallucinating.",
  ].join(" ")

  const groundingPrompt = JSON.stringify(
    {
      intent: input.intent,
      resolvedPlace: input.resolvedPlace || null,
      tripContext: {
        startingLocation: input.context.startingLocation,
        selectedDestinations: (input.context.selectedDestinations || []).map((item: any) => item.name),
        dateRange: input.context.dateRange,
        budgetPreference: input.context.budgetPreference,
        travelStyle: input.context.travelStyle,
        travelers: input.context.travelers,
      },
      grounding: input.grounding,
    },
    null,
    2
  )

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.35,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Grounded travel data:\n${groundingPrompt}` },
      { role: "user", content: input.userMessage },
    ],
  })

  return completion.choices?.[0]?.message?.content?.trim() || null
}

function fallbackNearbyReply(place: any, nearbyPlaces: NearbyPlace[]) {
  return [
    `Here are some of the best places to explore around ${place.name}:`,
    "",
    ...nearbyPlaces.map((item, index) => `${index + 1}. ${item.name} - ${item.whyVisit}${item.travelTime ? ` (${item.travelTime})` : ""}`),
    "",
    `If you want, I can also build a short walking plan, suggest food nearby, or find hotels around ${place.name}.`,
  ].join("\n")
}

function fallbackResponse(intent: Intent, input: {
  context: any
  resolvedPlace?: any
  nearbyPlaces?: NearbyPlace[]
  budget?: any
  hotels?: any[]
  flights?: any[]
  weather?: any
  route?: any
}) {
  const firstDestination = input.resolvedPlace || input.context.selectedDestinations?.[0]
  if (intent === "nearby_places" && input.resolvedPlace && input.nearbyPlaces?.length) return fallbackNearbyReply(input.resolvedPlace, input.nearbyPlaces)
  if (intent === "weather_guidance" && input.weather) {
    return `${input.weather.place} is currently around ${input.weather.temperatureC} C with ${String(input.weather.condition).toLowerCase()} conditions.\n\nTravel advice: ${input.weather.comfort}\nPacking: ${input.weather.packing}\nBest sightseeing window: ${input.weather.bestHours}`
  }
  if (intent === "best_time_guidance" && input.resolvedPlace) {
    return `${input.resolvedPlace.name} is usually best visited in ${input.resolvedPlace.bestTime || "the most pleasant local season"}.\n\nIf you want, I can also suggest weather, nearby attractions, or hotel areas for that period.`
  }
  if (intent === "hotel_guidance" && input.hotels?.length && firstDestination) {
    return `For a ${input.context.budgetPreference} stay near ${firstDestination.name}, focus on central, well-connected areas rather than the absolute closest property.\n\nI found some matching stays below if you want to compare convenience and price.`
  }
  if (intent === "flight_guidance" && input.flights?.length && firstDestination) {
    const lowFare = Math.min(...input.flights.map((item) => item.price))
    const highFare = Math.max(...input.flights.map((item) => item.price))
    return `Flight guidance for ${input.context.startingLocation} to ${firstDestination.name}:\n\nTypical visible fares are around ${formatCurrency(lowFare)} to ${formatCurrency(highFare)}. Booking earlier is usually better if your dates are fixed.`
  }
  if (intent === "budget_estimation" && input.budget) {
    return `Estimated total: ${formatCurrency(input.budget.totalBudget, input.budget.currency)}\nFlights: ${formatCurrency(input.budget.flightCost, input.budget.currency)}\nHotels: ${formatCurrency(input.budget.breakdown.stay, input.budget.currency)}\nFood: ${formatCurrency(input.budget.breakdown.food, input.budget.currency)}\nLocal travel: ${formatCurrency(input.budget.localTransportCost, input.budget.currency)}`
  }
  if (intent === "planning_guidance" && input.route) {
    return `Recommended route: ${input.route.routeNames.join(" -> ")}\nSuggested duration: ${input.context.durationDays || getTripDuration(input.context.dateRange).totalDays || input.route.routeNames.length * 2} days\nEstimated route distance: about ${input.route.totalDistanceKm} km.`
  }
  return "I’m having trouble fetching a smart travel response right now. Please try again in a moment."
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages = (Array.isArray(body?.messages) ? body.messages : []) as ChatMessage[]
    const latestUserMessage = messages.filter((message) => message.role === "user").at(-1)?.content || ""
    const intent = detectIntent(latestUserMessage)
    const context = buildContext(body?.tripContext || {}, messages, latestUserMessage)
    const resolvedPlace = resolvePlace(latestUserMessage, context)
    const missing = askForMissing(intent, context, resolvedPlace)

    if (missing) {
      return NextResponse.json({
        intent,
        reply: missing,
        loadingLabel: "Understanding your travel request",
        followUpQuestions: [missing],
        suggestedActions: buildQuickActions(context, intent),
        actionCtas: buildActions(intent, resolvedPlace?.name),
        conversationTitle: buildSmartTitle(latestUserMessage, context),
        memory: {
          startingLocation: context.startingLocation,
          selectedDestinations: context.selectedDestinations,
          dateRange: context.dateRange,
          budgetPreference: context.budgetPreference,
          travelStyle: context.travelStyle,
          travelers: context.travelers,
          durationDays: context.durationDays,
        },
        artifacts: {},
      })
    }

    const route = optimizeRoute(context)
    const budgetContext = ensureBudgetReadyContext(context)
    const weather = (intent === "weather_guidance" || intent === "best_time_guidance") && resolvedPlace ? getWeather(resolvedPlace.name, resolvedPlace) : null
    const nearbyPlaces = intent === "nearby_places" && resolvedPlace ? searchNearbyAttractions(resolvedPlace, 8) : []
    const hotelResults = intent === "hotel_guidance" && (resolvedPlace || context.selectedDestinations?.[0]) ? findHotels((resolvedPlace || context.selectedDestinations[0]).name, context.budgetPreference, 4) : []
    const flightResults = intent === "flight_guidance" && context.startingLocation && (resolvedPlace || context.selectedDestinations?.[0]) ? estimateFlights(context.startingLocation, (resolvedPlace || context.selectedDestinations[0]).name, 4) : []
    const budget = intent === "budget_estimation" ? buildBudgetEstimate(budgetContext) : null
    const destinationSuggestions = intent === "destination_discovery" ? searchDestinations(latestUserMessage, 4).map(compactDestination) : []

    const grounding = {
      nearby_places: nearbyPlaces,
      hotels: hotelResults,
      flights: flightResults,
      weather,
      budget: budget
        ? {
            total: formatCurrency(budget.totalBudget, budget.currency),
            flights: formatCurrency(budget.flightCost, budget.currency),
            hotels: formatCurrency(budget.breakdown.stay, budget.currency),
            food: formatCurrency(budget.breakdown.food, budget.currency),
            localTravel: formatCurrency(budget.localTransportCost, budget.currency),
          }
        : null,
      destinationSuggestions,
      route,
    }

    const groqReply = await generateGroqReply({
      userMessage: latestUserMessage,
      intent,
      context,
      resolvedPlace,
      grounding,
    }).catch((error) => {
      console.error("Groq assistant generation failed:", error)
      return null
    })

    const reply = groqReply || fallbackResponse(intent, {
      context,
      resolvedPlace,
      nearbyPlaces,
      budget: budget || undefined,
      hotels: hotelResults,
      flights: flightResults,
      weather: weather || undefined,
      route,
    })

    const memory = intent === "trip_modification" ? updateTripContext(context, latestUserMessage) : context
    const memoryDestinations = resolvedPlace ? dedupeSelectedDestinations([resolvedPlace, ...(memory.selectedDestinations || [])]) : memory.selectedDestinations

    return NextResponse.json({
      intent,
      reply,
      loadingLabel:
        intent === "nearby_places" ? "Finding nearby attractions"
        : intent === "hotel_guidance" ? "Looking for stay recommendations"
        : intent === "flight_guidance" ? "Checking travel options"
        : intent === "budget_estimation" ? "Estimating your trip budget"
        : intent === "weather_guidance" || intent === "best_time_guidance" ? "Checking local travel conditions"
        : intent === "planning_guidance" ? "Planning your next steps"
        : "Thinking through your trip",
      followUpQuestions: [],
      suggestedActions: buildQuickActions({ ...memory, selectedDestinations: memoryDestinations }, intent),
      actionCtas: buildActions(intent, resolvedPlace?.name),
      conversationTitle: buildSmartTitle(latestUserMessage, { ...memory, selectedDestinations: memoryDestinations }),
      memory: {
        startingLocation: memory.startingLocation,
        selectedDestinations: memoryDestinations,
        dateRange: memory.dateRange,
        budgetPreference: memory.budgetPreference,
        travelStyle: memory.travelStyle,
        travelers: memory.travelers,
        durationDays: memory.durationDays,
      },
      artifacts: {
        nearbyPlaces,
        weather,
        budget,
        hotels: hotelResults,
        flights: flightResults,
        destinations: destinationSuggestions,
        distanceKm: route?.totalDistanceKm || null,
      },
      provider: groqReply ? "groq" : "fallback",
      resolvedPlace,
    })
  } catch (error: any) {
    console.error("AI chat handler error:", error)
    return NextResponse.json(
      { error: "I’m having trouble fetching a smart travel response right now. Please try again in a moment." },
      { status: 500 }
    )
  }
}
