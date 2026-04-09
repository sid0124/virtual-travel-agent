import Groq from "groq-sdk"
import { NextResponse } from "next/server"

import { amadeusGet, isAmadeusConfigured, resolveAirportCode } from "@/lib/amadeus"
import { convertCurrencyValue, DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency"
import { destinationWeather, destinations, flights, hotels } from "@/lib/data"
import { generateDemoFlights } from "@/lib/demo-inventory"
import { isRapidApiConfigured, searchHotels as searchLiveHotels } from "@/lib/rapidapi-hotels"
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
  | "nearby_food"
  | "nearby_places"
  | "destination_discovery"
  | "budget_estimation"
  | "flight_guidance"
  | "hotel_guidance"
  | "weather_guidance"
  | "best_time_guidance"
  | "planning_guidance"
  | "transport_guidance"
  | "lifestyle_guidance"
  | "trip_modification"
  | "flight_search"
  | "support_handoff"
  | "general_qa"

type NearbyPlace = {
  id: string
  name: string
  image?: string
  imageQuery?: string
  city?: string
  state?: string
  country?: string
  category?: string
  subtitle?: string
  whyVisit: string
  travelTime?: string
  distanceKm?: number
  travelMinutes?: number
  travelMode?: "walk" | "drive"
  bestFor?: string
  bestForTags?: string[]
  visitDuration?: string
  whyAdd?: string
}

type ResponseType =
  | "plain_text"
  | "food_guide"
  | "nearby_places"
  | "nearby_place_recommendations"
  | "hotel_recommendations"
  | "map_context"
  | "weather_summary"
  | "budget_breakdown"
  | "itinerary_mini_plan"
  | "itinerary_general"
  | "itinerary_evening"
  | "itinerary_family"
  | "itinerary_quick"
  | "itinerary_romantic"
  | "itinerary_budget"
  | "itinerary_full_day"
  | "flight_guidance"
  | "flight_search_results"
  | "destination_recommendations"
  | "support_issue_summary"

type ResponseContentType =
  | "plain_text"
  | "itinerary"
  | "recommendations"
  | "budget"
  | "hotels"
  | "nearby"
  | "map"
  | "weather"
  | "flights"
  | "support"

type AttachmentCategory = "place_photo" | "itinerary_screenshot" | "payment_screenshot" | "general_image"

type AssistantAttachment = {
  name: string
  type?: string
  size?: number
  category?: AttachmentCategory
}

type SupportIssueSummaryPayload = {
  title: string
  issueType: string
  urgency: "high" | "medium" | "low"
  statusLabel: string
  summary: string
  evidenceNote: string
  recommendedSteps: string[]
  referenceHints: string[]
}

type FoodGuide = {
  placeName: string
  quickAnswer: string
  localInsight: string
  localTips: string[]
  sections: Array<{ title: string; items: string[]; note?: string }>
  nextStepHint: string
}

type PlanningSubtype =
  | "general"
  | "evening"
  | "morning"
  | "half_day"
  | "full_day"
  | "romantic"
  | "family"
  | "budget"
  | "quick"
  | "nearby_add_on"

type PlanningProfile = {
  subtype: PlanningSubtype
  label: string
  durationHours: number
  pace: "easy" | "balanced" | "relaxed" | "efficient"
  audience: "general" | "family" | "couple" | "solo"
  budgetMode: "standard" | "budget"
  timeOfDay?: "morning" | "afternoon" | "evening"
  wantsFoodStop?: boolean
  wantsIndoorBackup?: boolean
  refinementNote?: string
}

type MiniPlan = {
  title: string
  summary: string
  subtitle?: string
  whyThisFits?: string
  addOnSuggestion?: string
  changeSummary?: string
  subtype?: PlanningSubtype
  routeStyle?: string
  durationLabel?: string
  durationDays?: number
  days?: Array<{
    dayNumber: number
    title: string
    summary?: string
    blocks: Array<{ id?: string; timing: string; title: string; detail: string; duration?: string; note?: string; tag?: string }>
  }>
  stops?: Array<{ id?: string; timing: string; title: string; detail: string; duration?: string; note?: string; tag?: string }>
}

type ItineraryMemory = {
  destinationId?: string
  destinationName?: string
  travelerType?: "solo" | "couple" | "family" | "group"
  ageGroup?: "kids" | "teens" | "mixed"
  walkingTolerance?: "low" | "medium" | "high"
  timeWindow?: "morning" | "afternoon" | "evening" | "half_day" | "full_day" | "quick" | null
  tripStage?: "draft" | "refining" | "saved"
  preferences: {
    familyFriendly?: boolean
    nearbyMuseum?: boolean
    kidFriendlyStop?: boolean
    snackStop?: boolean
    lunchStop?: boolean
    dinnerStop?: boolean
    indoorBackup?: boolean
    iconicStop?: boolean
    romantic?: boolean
    budgetFriendly?: boolean
  }
  latestItinerary?: MiniPlan | null
  itineraryVersion?: number
  latestAssistantSuggestions?: string[]
}

type DestinationRecommendationCard = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
  image?: string
  imageQuery?: string
  description?: string
  bestTime?: string
  budget?: { min: number; max: number; currency: string }
  tags: string[]
  whyThisMatches: string
  highlights: string[]
  suggestedDuration?: string
}

type DestinationRecommendationPayload = {
  title: string
  introText: string
  reason: string
  summaryBadge?: string
  cards: DestinationRecommendationCard[]
  filterChips: string[]
  followUpQuestion: string
}

type NearbyPlaceRecommendationPayload = {
  mainDestination: {
    id: string
    name: string
    city?: string
    state?: string
    country?: string
  }
  title: string
  introText: string
  radiusKm: number
  cards: NearbyPlace[]
  nearbyCategories: string[]
  refinementFilters: string[]
  responseActions: string[]
  confirmationPrompt: string
  followUpPrompts: string[]
  groupedHints?: Array<{ label: string; count: number }>
}

type ContextGuardrailPayload = {
  title: string
  introText: string
  currentTripLabel: string
  requestedDestination: {
    id: string
    name: string
    city?: string
    state?: string
    country?: string
  }
  responseActions: string[]
}

type HotelRecommendationCard = {
  id: string
  kind: "hotel" | "area"
  name: string
  location: string
  image?: string
  imageQuery?: string
  city?: string
  state?: string
  country?: string
  reason: string
  budgetLabel: string
  walkingTime: string
  ratingLabel?: string
  tags: string[]
  priceValue?: number
  currency?: string
  sourceDestination?: string
}

type HotelRecommendationPayload = {
  title: string
  introText: string
  summaryBadge?: string
  cards: HotelRecommendationCard[]
  responseActions: string[]
  followUpPrompts: string[]
}

type MapContextPayload = {
  title: string
  introText: string
  areaLabel: string
  destinationName: string
  locationSummary: string
  nearbyHighlights: Array<{ name: string; subtitle: string }>
  hotelHighlights: Array<{ name: string; subtitle: string }>
  responseActions: string[]
}

type FlightSearchParams = {
  origin: string
  destination: string
  departureDate: string
  tripType: "one_way" | "round_trip"
  returnDate?: string
  cabinClass?: string
  adults: number
  budgetLevel: "low" | "medium" | "premium"
}

type FlightRecommendationCard = {
  id: string
  airline: string
  airlineCode?: string
  logoLabel: string
  route: { originCity: string; destinationCity: string; originCode: string; destinationCode: string }
  departureTime: string
  arrivalTime: string
  departureDate: string
  duration: string
  stopCount: number
  stopLabel: string
  price: number
  currency: string
  fareType: string
  baggageNote: string
  cabinClass: string
  badge: string
  matchLabel: string
  explanation: string
  layoverNote?: string
  source: "LIVE" | "DEMO" | "STATIC"
}

type FlightSearchPayload = {
  querySummary: string
  introText: string
  route: { origin: string; destination: string; originCode: string; destinationCode: string }
  departureDate: string
  tripType: "one_way" | "round_trip"
  returnDate?: string
  recommendedOptionId?: string
  bookingReady: boolean
  cards: FlightRecommendationCard[]
  responseActions: string[]
  summaryBadges: string[]
  dataMode: "LIVE" | "DEMO" | "STATIC"
}

type AssistantState = {
  lastIntent?: Intent
  lastResolvedPlaceName?: string
  lastClarificationKey?: string
  lastClarificationMessage?: string
  lastContextGuardrailKey?: string
  lastActionSetKey?: string
  lastPlanSubtype?: PlanningSubtype
  lastPlanPlaceName?: string
  lastPlanStopIds?: string[]
}

type LiveToolingState = {
  usedTools: string[]
  liveDataSources: string[]
  groundingMode: "curated" | "hybrid" | "live"
  notes: string[]
}

type IntentClassifierResult = {
  intent: Intent
  confidence: number
  requiresLiveData: boolean
  reason?: string
}

type TravelCopyResult = {
  shortAnswer: string
  followUpQuestion?: string
}

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim() || ""
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile"
}

function getGroqTimeoutMs() {
  const parsed = Number(process.env.GROQ_TIMEOUT_MS || 18000)
  return Number.isFinite(parsed) && parsed >= 5000 ? parsed : 18000
}

function createGroqClient() {
  const apiKey = getGroqApiKey()
  return apiKey ? new Groq({ apiKey }) : null
}

function extractGroqTextContent(content: unknown): string {
  if (typeof content === "string") return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((item: any) => {
        if (typeof item === "string") return item
        if (typeof item?.text === "string") return item.text
        if (typeof item?.content === "string") return item.content
        return ""
      })
      .filter(Boolean)
      .join("\n")
      .trim()
  }
  if (content && typeof content === "object") {
    if (typeof (content as any).text === "string") return (content as any).text.trim()
    if (typeof (content as any).content === "string") return (content as any).content.trim()
  }
  return ""
}

function truncateForLog(value: unknown, limit = 600) {
  const text =
    typeof value === "string"
      ? value
      : value === undefined
        ? ""
        : JSON.stringify(value)
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function logGroqError(scope: string, error: any, meta: Record<string, unknown> = {}) {
  console.error(`[ai-chat:${scope}] Groq request failed`, {
    ...meta,
    model: getGroqModel(),
    status: error?.status || error?.response?.status || null,
    name: error?.name || null,
    message: error?.message || String(error),
    response: truncateForLog(error?.error || error?.response?.body || error?.response?.data || error?.cause || ""),
  })
}

async function runGroqChatCompletion(input: {
  scope: string
  temperature: number
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
}) {
  const groq = createGroqClient()
  if (!groq) {
    console.error(`[ai-chat:${input.scope}] Missing GROQ_API_KEY. Set process.env.GROQ_API_KEY on the server.`)
    return null
  }

  try {
    const completion = await Promise.race([
      groq.chat.completions.create({
        model: getGroqModel(),
        temperature: input.temperature,
        messages: input.messages,
      }),
      new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error(`Groq request timed out after ${getGroqTimeoutMs()}ms`)), getGroqTimeoutMs())
      }),
    ])

    const text = extractGroqTextContent((completion as any)?.choices?.[0]?.message?.content)
    if (!text) {
      console.error(`[ai-chat:${input.scope}] Groq returned an empty completion`, {
        model: getGroqModel(),
      })
      return null
    }

    return text
  } catch (error: any) {
    logGroqError(input.scope, error, {
      promptPreview: truncateForLog(input.messages.at(-1)?.content || ""),
    })
    return null
  }
}

function parseJsonObject<T>(value: unknown): T | null {
  const text = extractGroqTextContent(value)
  if (!text) return null
  try {
    const trimmed = text.trim()
    const direct = JSON.parse(trimmed) as T
    return direct
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as T
    } catch {
      return null
    }
  }
}

function getAssistantState(context: any): AssistantState {
  return {
    ...(context?.assistantState || {}),
  }
}

function getItineraryMemory(context: any): ItineraryMemory {
  return {
    destinationId: context?.itineraryMemory?.destinationId,
    destinationName: context?.itineraryMemory?.destinationName,
    travelerType: context?.itineraryMemory?.travelerType,
    ageGroup: context?.itineraryMemory?.ageGroup,
    walkingTolerance: context?.itineraryMemory?.walkingTolerance,
    timeWindow: context?.itineraryMemory?.timeWindow ?? null,
    tripStage: context?.itineraryMemory?.tripStage || "draft",
    preferences: {
      ...(context?.itineraryMemory?.preferences || {}),
    },
    latestItinerary: context?.itineraryMemory?.latestItinerary || null,
    itineraryVersion: Number(context?.itineraryMemory?.itineraryVersion || 0) || 0,
    latestAssistantSuggestions: Array.isArray(context?.itineraryMemory?.latestAssistantSuggestions)
      ? context.itineraryMemory.latestAssistantSuggestions
      : [],
  }
}

function findDestinationByName(name?: string | null) {
  const normalized = norm(name)
  if (!normalized) return null

  const regionalMatch = getRegionalDestinationMatch(name)
  if (regionalMatch) return regionalMatch

  const directMatch = destinations.find((item) => {
    return [item.name, item.city, item.state, item.country].filter(Boolean).some((value) => norm(value) === normalized)
  })
  if (directMatch) return normalizeSelectedDestination(directMatch)

  const ranked = rankDestinations(name || "", 1)[0]
  return ranked ? normalizeSelectedDestination(ranked.destination) : null
}

function resolvePlaceFromMemory(context: any) {
  const itineraryMemory = getItineraryMemory(context)
  const destinationName = itineraryMemory.destinationName || context?.assistantState?.lastPlanPlaceName
  if (!destinationName) return null
  const selected = findDestinationByName(destinationName)
  return enrichResolvedPlace(selected)
}

function isPlanningRefinementRequest(message: string, context: any) {
  const value = norm(message)
  const hasPlanContext = Boolean(
    context?.itineraryMemory?.latestItinerary ||
    context?.itineraryMemory?.destinationName ||
    context?.assistantState?.lastPlanPlaceName ||
    context?.selectedDestinations?.length
  )

  if (/(build|create|plan).*(family friendly|family|kid friendly|kid friendly|lower walking|reduce walking|evening|romantic|budget|quick|half day|full day)/.test(value)) {
    return true
  }

  if (!hasPlanContext) return false

  return /(make it|turn this|turn into|refine|update this|update the itinerary|improve this|add (a|an)?\s*(snack|lunch|dinner|museum|kid friendly|kid friendly stop|indoor|iconic)|add nearby museum|add snack stop|add lunch stop|add dinner stop|reduce walking|lower walking|walking effort|family friendly|family friendly|kid friendly|evening plan|romantic|budget friendly|full day|half day|quick plan|save to trip)/.test(value)
}

function mergeItineraryMemory(context: any, latestUserMessage: string, resolvedPlace: any, planningProfile?: PlanningProfile, miniPlan?: MiniPlan | null, latestAssistantSuggestions?: string[]) {
  const value = norm(latestUserMessage)
  const current = getItineraryMemory(context)
  const previousDestinationName = current.destinationName || context?.assistantState?.lastPlanPlaceName
  const nextDestinationName = resolvedPlace?.name || previousDestinationName
  const destinationChanged =
    Boolean(resolvedPlace?.name) &&
    Boolean(previousDestinationName) &&
    norm(previousDestinationName) !== norm(resolvedPlace.name)

  const next: ItineraryMemory = destinationChanged
    ? {
        destinationId: resolvedPlace?.id,
        destinationName: resolvedPlace?.name,
        travelerType: current.travelerType,
        ageGroup: current.ageGroup,
        walkingTolerance: current.walkingTolerance,
        timeWindow: null,
        tripStage: "draft",
        preferences: {},
        latestItinerary: null,
        itineraryVersion: 0,
        latestAssistantSuggestions: [],
      }
    : {
        ...current,
        preferences: { ...(current.preferences || {}) },
      }

  if (resolvedPlace?.id) next.destinationId = resolvedPlace.id
  if (nextDestinationName) next.destinationName = nextDestinationName

  if (/(family|kids|kid friendly|children|stroller)/.test(value)) {
    next.travelerType = "family"
    next.preferences.familyFriendly = true
  } else if (/(couple|romantic|date)/.test(value)) {
    next.travelerType = "couple"
    next.preferences.romantic = true
  } else if (/\bsolo\b/.test(value)) {
    next.travelerType = "solo"
  } else if (/(group|friends)/.test(value)) {
    next.travelerType = "group"
  }

  if (/(kid|kids|children|toddler|young child)/.test(value)) next.ageGroup = "kids"
  if (/(teen|teenager)/.test(value)) next.ageGroup = "teens"

  if (/(lower walking|reduce walking|less walking|easy walking|low walking|walking effort|stroller|accessible|mobility|elderly)/.test(value)) {
    next.walkingTolerance = "low"
  } else if (/(walking intensive|more walking|walk more)/.test(value)) {
    next.walkingTolerance = "high"
  } else if (!next.walkingTolerance) {
    next.walkingTolerance = "medium"
  }

  if (/(evening|tonight|sunset|night)/.test(value)) next.timeWindow = "evening"
  else if (/(morning|sunrise|early)/.test(value)) next.timeWindow = "morning"
  else if (/(half day|half day)/.test(value)) next.timeWindow = "half_day"
  else if (/(full day|whole day)/.test(value)) next.timeWindow = "full_day"
  else if (/(quick|2 hour|2 hour|short plan)/.test(value)) next.timeWindow = "quick"

  if (/add nearby museum|museum/.test(value)) next.preferences.nearbyMuseum = true
  if (/add kid friendly stop|kid friendly stop|kids stop|play area|playground|zoo|aquarium/.test(value)) next.preferences.kidFriendlyStop = true
  if (/add snack stop|snack break|snack stop/.test(value)) next.preferences.snackStop = true
  if (/add lunch stop|lunch break|lunch stop/.test(value)) next.preferences.lunchStop = true
  if (/add dinner stop|dinner stop|dinner plan/.test(value)) next.preferences.dinnerStop = true
  if (/add indoor backup stop|indoor backup|rain backup|weather safe/.test(value)) next.preferences.indoorBackup = true
  if (/add one iconic stop|iconic stop|landmark/.test(value)) next.preferences.iconicStop = true
  if (/budget friendly|budget|cheap|affordable|reduce cost|free stop/.test(value)) next.preferences.budgetFriendly = true

  if (planningProfile?.subtype === "family") next.preferences.familyFriendly = true
  if (planningProfile?.subtype === "romantic") next.preferences.romantic = true
  if (planningProfile?.subtype === "budget") next.preferences.budgetFriendly = true
  if (planningProfile?.subtype === "evening" || planningProfile?.subtype === "morning") next.timeWindow = planningProfile.subtype

  if (miniPlan) {
    next.latestItinerary = miniPlan
    next.tripStage = "refining"
    next.itineraryVersion = (current.itineraryVersion || 0) + 1
  }

  if (latestAssistantSuggestions?.length) {
    next.latestAssistantSuggestions = latestAssistantSuggestions
  }

  return next
}

function buildActionSetKey(actions: string[], suggestions: string[]) {
  return `${actions.map((item) => norm(item)).join("|")}::${suggestions.map((item) => norm(item)).join("|")}`
}

function chooseGroundingMode(tooling: LiveToolingState["usedTools"], liveSources: string[]): LiveToolingState["groundingMode"] {
  if (liveSources.length && tooling.length) return "hybrid"
  if (liveSources.length) return "live"
  return "curated"
}

async function classifyIntentWithGroq(message: string, context: any): Promise<IntentClassifierResult | null> {
  const responseText = await runGroqChatCompletion({
    scope: "intent-classifier",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          "You are an intent classifier for a premium travel SaaS assistant.",
          "Return only one JSON object with keys: intent, confidence, requiresLiveData, reason.",
          "Allowed intents:",
          "nearby_food, nearby_places, destination_discovery, budget_estimation, flight_guidance, hotel_guidance, weather_guidance, best_time_guidance, planning_guidance, transport_guidance, lifestyle_guidance, trip_modification, flight_search, support_handoff, general_qa.",
          "Use requiresLiveData=true for current weather, current prices, live flight guidance, closures, hours, current events, or anything time-sensitive.",
          "Prefer nearby_places for 'near my destination', hotel_guidance for stays, transport_guidance for maps/routes, planning_guidance for itinerary building.",
          "Confidence must be a number between 0 and 1.",
        ].join(" "),
      },
      {
        role: "system",
        content: JSON.stringify({
          latestUserMessage: message,
          tripContext: {
            selectedDestinations: (context?.selectedDestinations || []).map((item: any) => item.name),
            dateRange: context?.dateRange,
            budgetPreference: context?.budgetPreference,
            travelStyle: context?.travelStyle,
            travelers: context?.travelers,
          },
        }),
      },
      {
        role: "user",
        content: message,
      },
    ],
  })

  const parsed = parseJsonObject<IntentClassifierResult>(responseText)
  if (!parsed?.intent) return null
  return {
    intent: parsed.intent,
    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0,
    requiresLiveData: Boolean(parsed.requiresLiveData),
    reason: parsed.reason,
  }
}

function shouldUseLiveGrounding(intent: Intent, message: string, classifier?: IntentClassifierResult | null) {
  if (classifier?.requiresLiveData) return true
  const text = norm(message)
  if (/(today|tonight|right now|currently|current|this week|latest|live|open now|closed today|hours|price now|available now)/.test(text)) {
    return ["weather_guidance", "best_time_guidance", "flight_search", "hotel_guidance", "transport_guidance", "general_qa"].includes(intent)
  }
  return false
}

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
  "fort kochi": "Fort Kochi",
  "dubai marina": "Dubai Marina",
  "kochi": "Kochi",
  "cochin": "Kochi",
  "bali": "Ubud",
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "around",
  "at",
  "best",
  "can",
  "continue",
  "cover",
  "destination",
  "do",
  "else",
  "explore",
  "find",
  "for",
  "from",
  "get",
  "here",
  "i",
  "in",
  "is",
  "it",
  "love",
  "me",
  "more",
  "my",
  "near",
  "nearby",
  "new",
  "of",
  "on",
  "place",
  "places",
  "popular",
  "reach",
  "reaching",
  "show",
  "should",
  "some",
  "spot",
  "spots",
  "suggest",
  "tell",
  "that",
  "the",
  "there",
  "these",
  "this",
  "trip",
  "visit",
  "want",
  "what",
  "which",
  "would",
  "you",
])

const CURATED_NEARBY_PLACES: Record<string, NearbyPlace[]> = {
  "times square": [
    { id: "ts-broadway", name: "Broadway theatres", subtitle: "Theatre district", whyVisit: "The classic Times Square experience for live shows and musicals.", distanceKm: 0.4, travelMinutes: 5, travelMode: "walk", category: "Attraction", bestFor: "Evening entertainment", bestForTags: ["Entertainment", "Landmark", "Night out"], visitDuration: "2-3 hours", whyAdd: "A classic AI pick if you want the full Times Square energy." },
    { id: "ts-bryant", name: "Bryant Park", subtitle: "Midtown green space", whyVisit: "A calmer nearby stop for coffee, reading, and skyline views.", distanceKm: 0.9, travelMinutes: 11, travelMode: "walk", category: "Nature", bestFor: "Relaxed break", bestForTags: ["Nature", "Photos", "Hidden gem"], visitDuration: "45-60 min", whyAdd: "A smart breather between busier Midtown stops." },
    { id: "ts-rockefeller", name: "Rockefeller Center", subtitle: "Observation deck and plaza", whyVisit: "Great for city views, iconic NYC photos, and seasonal events.", distanceKm: 0.8, travelMinutes: 10, travelMode: "walk", category: "Landmark", bestFor: "Views and landmarks", bestForTags: ["Landmark", "Photos", "City"], visitDuration: "1-2 hours", whyAdd: "One of the easiest landmark add-ons from Times Square." },
    { id: "ts-topofrock", name: "Top of the Rock", subtitle: "Observation deck", whyVisit: "One of the best skyline viewpoints if you want sweeping Manhattan views.", distanceKm: 0.9, travelMinutes: 11, travelMode: "walk", category: "Landmark", bestFor: "Sunset views", bestForTags: ["Photos", "Landmark", "Sunset"], visitDuration: "1-2 hours", whyAdd: "A top AI pick for skyline views without leaving Midtown." },
    { id: "ts-fifth", name: "Fifth Avenue", subtitle: "Shopping and city walk", whyVisit: "Ideal for premium shopping, people-watching, and classic Midtown energy.", distanceKm: 0.7, travelMinutes: 9, travelMode: "walk", category: "Shopping", bestFor: "Shopping", bestForTags: ["Shopping", "City", "Walk"], visitDuration: "1-2 hours", whyAdd: "Easy to pair with Times Square if you want a polished city walk." },
    { id: "ts-empire", name: "Empire State Building", subtitle: "Iconic skyline stop", whyVisit: "A short ride away if you want another famous observation experience.", distanceKm: 1.7, travelMinutes: 12, travelMode: "drive", category: "Landmark", bestFor: "First-time visitors", bestForTags: ["Landmark", "Views", "Classic"], visitDuration: "1-2 hours", whyAdd: "A strong classic add-on if you are building a first-timer NYC route." },
    { id: "ts-madame", name: "Madame Tussauds New York", subtitle: "Indoor attraction", whyVisit: "Good quick indoor attraction if you want a lighter tourist stop.", distanceKm: 0.3, travelMinutes: 4, travelMode: "walk", category: "Attraction", bestFor: "Indoor activity", bestForTags: ["Indoor", "Family", "Quick stop"], visitDuration: "45-60 min", whyAdd: "Works well when you want something easy and weather-proof." },
    { id: "ts-hellskitchen", name: "Hell's Kitchen food spots", subtitle: "Restaurant-heavy neighborhood", whyVisit: "Better food variety than the busiest tourist strip around the square itself.", distanceKm: 0.8, travelMinutes: 10, travelMode: "walk", category: "Food", bestFor: "Food and dinner", bestForTags: ["Food", "Local vibe", "Dinner"], visitDuration: "1-2 hours", whyAdd: "A local-favorite detour for better dining than the main square." },
  ],
  "central park": [
    { id: "cp-bethesda", name: "Bethesda Terrace", subtitle: "Central Park landmark", whyVisit: "One of the most photogenic and iconic spots inside the park.", distanceKm: 0.7, travelMinutes: 10, travelMode: "walk", category: "Landmark", bestFor: "Photos", bestForTags: ["Landmark", "Nature", "Photography"], visitDuration: "30-45 min", whyAdd: "A signature Central Park stop that fits almost every first visit." },
    { id: "cp-bowbridge", name: "Bow Bridge", subtitle: "Scenic bridge", whyVisit: "A romantic and classic Central Park view, especially in soft light.", distanceKm: 0.9, travelMinutes: 12, travelMode: "walk", category: "Nature", bestFor: "Scenery", bestForTags: ["Nature", "Photography", "Walk"], visitDuration: "20-30 min", whyAdd: "One of the best quick scenic detours inside the park." },
    { id: "cp-met", name: "The Metropolitan Museum of Art", subtitle: "East side of the park", whyVisit: "Easy pairing if you want culture after your park walk.", distanceKm: 1.2, travelMinutes: 15, travelMode: "walk", category: "Attraction", bestFor: "Art and culture", bestForTags: ["Art", "Culture", "Museum"], visitDuration: "2-3 hours", whyAdd: "A strong culture add-on when you want more than just green space." },
    { id: "cp-columbus", name: "Columbus Circle", subtitle: "Southwest corner of the park", whyVisit: "Great for shopping, food, and quick transit connections.", distanceKm: 1.8, travelMinutes: 20, travelMode: "walk", category: "Shopping", bestFor: "Food and shopping", bestForTags: ["Shopping", "Food", "City"], visitDuration: "45-90 min", whyAdd: "Smart if you want food, shopping, or an easy transition after the park." },
    { id: "cp-strawberry", name: "Strawberry Fields", subtitle: "Peaceful memorial area", whyVisit: "Good quieter stop if you want a reflective corner of the park.", distanceKm: 0.8, travelMinutes: 11, travelMode: "walk", category: "Hidden gem", bestFor: "Quiet pause", bestForTags: ["Hidden gem", "Nature", "Quiet"], visitDuration: "20-30 min", whyAdd: "A gentler stop if you want a calmer side of Central Park." },
    { id: "cp-upperwest", name: "Upper West Side cafes", subtitle: "Neighborhood nearby", whyVisit: "Better neighborhood feel for breakfast, brunch, or slower local time.", distanceKm: 1.4, travelMinutes: 17, travelMode: "walk", category: "Food", bestFor: "Local vibe", bestForTags: ["Food", "Local vibe", "Coffee"], visitDuration: "45-90 min", whyAdd: "Best if you want a local-feeling meal right after the park." },
    { id: "cp-belvedere", name: "Belvedere Castle", subtitle: "Castle overlook inside the park", whyVisit: "A quieter Central Park viewpoint with one of the best elevated perspectives in the area.", distanceKm: 1.1, travelMinutes: 14, travelMode: "walk", category: "Hidden gem", bestFor: "Views", bestForTags: ["Hidden gem", "Photos", "Landmark"], visitDuration: "30-45 min", whyAdd: "A strong AI pick if you want a less obvious but very photogenic stop." },
    { id: "cp-conservatory", name: "Conservatory Garden", subtitle: "Formal garden on the park's north-east side", whyVisit: "A more peaceful garden corner when you want something quieter than the busier central lawns.", distanceKm: 1.9, travelMinutes: 23, travelMode: "walk", category: "Hidden gem", bestFor: "Quiet garden walk", bestForTags: ["Nature", "Hidden gem", "Relaxed"], visitDuration: "30-45 min", whyAdd: "A lovely hidden-gem detour if you prefer slower, quieter stops." },
  ],
}

const FOOD_GUIDANCE: Record<string, Omit<FoodGuide, "placeName">> = {
  "times square": {
    quickAnswer: "Times Square is convenient for food, but the best value and quality usually start once you walk a few blocks away from the busiest tourist strip.",
    localInsight: "Hell's Kitchen is usually the smarter dining move than staying directly in the densest Times Square blocks.",
    localTips: [
      "Expect tourist-heavy pricing right on the square.",
      "A 10-minute walk west usually improves both food quality and value.",
      "Midtown is reliable for late dinners after shows.",
    ],
    sections: [
      { title: "Quick bites", items: ["Pizza slices, bagels, deli sandwiches, burgers, and fast casual counters work best if you are moving between shows or attractions."] },
      { title: "Classic NYC food", items: ["Pizza, bagels, halal platters, hot dogs, and deli-style sandwiches are the easiest iconic choices nearby."] },
      { title: "Better sit-down meals", items: ["Walk toward Hell's Kitchen for broader cuisine variety and a calmer dinner atmosphere."] },
      { title: "Budget-friendly move", items: ["Avoid the blocks closest to the billboards if price matters.", "Lunch specials and casual counters slightly away from the square are usually better value."] },
      { title: "Late-night option", items: ["Midtown stays active later than many neighborhoods, so it is one of the easier areas for a late meal."], note: "Best nearby food zone: Hell's Kitchen." },
    ],
    nextStepHint: "I can turn this into budget food, family-friendly dinner options, dessert spots, or a food + Broadway evening plan.",
  },
  "central park": {
    quickAnswer: "Food inside Central Park is limited for a real meal, so the best move is usually to eat just outside the park based on which side you exit from.",
    localInsight: "The south and west edges are easiest for convenience, while the Upper West Side is usually stronger for a more neighborhood-style meal.",
    localTips: [
      "Exit near Columbus Circle or the south side for the easiest meal options.",
      "For a calmer local feel, head to the Upper West Side instead of eating at the first park-edge tourist spot.",
      "Carry water and a light snack if you are planning a long park walk.",
    ],
    sections: [
      { title: "Fastest option", items: ["Coffee, pastries, sandwiches, and quick casual spots near the south side work best if you are fitting food between sights."] },
      { title: "Sit-down meal", items: ["The Upper West Side is usually the better pick for brunch, lunch, or an easy dinner after the park."] },
      { title: "Family-friendly move", items: ["Choose the west or south edge so you have easier access to transport, restrooms, and simpler dining choices."] },
    ],
    nextStepHint: "I can build a Central Park brunch walk, family lunch plan, or museum + meal route next.",
  },
  "fort kochi": {
    quickAnswer: "Fort Kochi is one of Kerala's best areas for slow heritage-area dining, especially if you want seafood, Kerala flavors, and café stops between sightseeing.",
    localInsight: "Fort Kochi works best when you pair food with walking rather than treating meals as a separate destination.",
    localTips: [
      "Seafood and Kerala meals are the smart local picks.",
      "This area is better for a relaxed lunch or dinner than for rushed grab-and-go eating.",
      "Heat and humidity can make midday less comfortable than late afternoon or evening.",
    ],
    sections: [
      { title: "Best local-style meal", items: ["Kerala seafood, appam-style dinners, fish curries, and regional comfort food are the strongest fit here."] },
      { title: "Cafe and heritage stop", items: ["Use cafes and bakery stops between heritage walks rather than trying to force one big food-only plan."] },
      { title: "Budget move", items: ["Move a little away from the most polished heritage-facing lanes for simpler meals and better pricing."] },
    ],
    nextStepHint: "I can build a Fort Kochi walking-and-food plan, seafood-focused route, or rainy-day heritage afternoon.",
  },
  "dubai marina": {
    quickAnswer: "Dubai Marina is strong for scenic dining and evening energy, but waterfront seating is usually pricier than going one row back from the promenade.",
    localInsight: "Marina Walk and JBR are the convenient food zones here, but the best value often comes from stepping slightly off the most visible waterfront stretch.",
    localTips: [
      "Dinner hours get busy, so reservations help for sit-down meals.",
      "The area is very walkable in cooler months but much less comfortable in peak heat.",
      "A casual coffee or dessert walk often works better than a full waterfront dinner if budget matters.",
    ],
    sections: [
      { title: "Scenic dining", items: ["Waterfront restaurants are best when atmosphere matters more than budget."] },
      { title: "Casual food", items: ["Shawarma, grills, cafés, and quick international spots are easier to find just off the front-row promenade."] },
      { title: "Family-friendly move", items: ["JBR is usually the easier option if you want walkability and more flexible group dining."] },
    ],
    nextStepHint: "I can build a Dubai Marina sunset plan, casual dinner strategy, or couple-friendly evening route.",
  },
}

const CURATED_STAY_AREAS: Record<
  string,
  Array<{
    id: string
    name: string
    location: string
    reason: string
    budgetLabel: string
    walkingTime: string
    tags: string[]
  }>
> = {
  "central park": [
    {
      id: "stay-cp-upperwest",
      name: "Upper West Side",
      location: "West edge of Central Park",
      reason: "Best if you want a calmer neighborhood feel with easy park access, brunch spots, and family-friendly streets.",
      budgetLabel: "Mid-range to premium",
      walkingTime: "8-15 min walk",
      tags: ["Near Central Park", "Family-friendly", "Walkable"],
    },
    {
      id: "stay-cp-columbus",
      name: "Columbus Circle area",
      location: "South-west corner of the park",
      reason: "Strong for first-time visitors who want park access, shopping, and quick subway links in one base.",
      budgetLabel: "Mid-range to premium",
      walkingTime: "5-10 min walk",
      tags: ["Best for sightseeing", "Transit-friendly", "Central"],
    },
    {
      id: "stay-cp-midtown",
      name: "Midtown West",
      location: "South of Central Park",
      reason: "A smart value-to-convenience option if you also want Broadway, Midtown dining, and easier hotel inventory.",
      budgetLabel: "Best value to mid-range",
      walkingTime: "12-18 min walk",
      tags: ["Best value", "City access", "Good hotel supply"],
    },
  ],
  "times square": [
    {
      id: "stay-ts-midtown",
      name: "Midtown West",
      location: "Around Times Square",
      reason: "Best if you want to stay right in the action with easy show access and late-night energy.",
      budgetLabel: "Mid-range to premium",
      walkingTime: "3-10 min walk",
      tags: ["Show access", "Central", "Night out"],
    },
    {
      id: "stay-ts-hellskitchen",
      name: "Hell's Kitchen",
      location: "West of Times Square",
      reason: "A stronger pick for food and a slightly less tourist-heavy feel without losing walkability.",
      budgetLabel: "Best value to mid-range",
      walkingTime: "8-12 min walk",
      tags: ["Food scene", "Best value", "Walkable"],
    },
  ],
  "mumbai": [
    {
      id: "stay-mumbai-colaba",
      name: "Colaba and Fort",
      location: "South Mumbai",
      reason: "Best for first-time sightseeing, heritage landmarks, and easier access to the waterfront icons around South Mumbai.",
      budgetLabel: "Mid-range to premium",
      walkingTime: "Best for core sightseeing access",
      tags: ["First-time stay", "Heritage zone", "Walkable pockets"],
    },
    {
      id: "stay-mumbai-bandra",
      name: "Bandra West",
      location: "Western suburbs",
      reason: "Strong pick if you want better cafes, restaurants, and a more polished neighborhood feel without staying in the business-heavy core.",
      budgetLabel: "Mid-range to premium",
      walkingTime: "Best for dining and lifestyle",
      tags: ["Food scene", "Lifestyle", "Balanced base"],
    },
    {
      id: "stay-mumbai-airport",
      name: "BKC or Airport zone",
      location: "Central Mumbai",
      reason: "Most practical when you want smoother airport access, newer business hotels, and easier transfers across the city.",
      budgetLabel: "Best value to mid-range",
      walkingTime: "Best for transfers",
      tags: ["Airport-friendly", "Practical", "Business hotels"],
    },
  ],
}

function isBroadDestinationPlace(place: any) {
  const descriptor = norm([place?.category, place?.type, place?.description].filter(Boolean).join(" "))
  return /(urban|city|island|hill station|beach|destination|heritage city|metropolitan)/.test(descriptor)
}

function searchNearbyRegionalDestinations(place: any, limit = 6): NearbyPlace[] {
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
    .filter((item) => item.distanceKm >= 20 && item.distanceKm <= 320)
    .filter((item) => norm(item.destination.country) === norm(place.country))
    .filter((item) => norm(item.destination.state) === norm(place.state) || norm(item.destination.region) === norm(place.region))
    .sort((a, b) => {
      const sameStateScore = norm(a.destination.state) === norm(place.state) ? -30 : 0
      const sameStateScoreB = norm(b.destination.state) === norm(place.state) ? -30 : 0
      return (a.distanceKm + sameStateScore) - (b.distanceKm + sameStateScoreB) || b.destination.rating - a.destination.rating
    })
    .slice(0, limit)
    .map((item) => {
      const travelMode = item.distanceKm <= 120 ? "drive" as const : "drive" as const
      const travelMinutes = item.distanceKm <= 120
        ? Math.max(90, Math.round(item.distanceKm * 1.2))
        : Math.max(150, Math.round(item.distanceKm * 0.9))
      const isWeekendTrip = item.distanceKm > 90
      return {
        id: item.destination.id,
        name: item.destination.name,
        image: item.destination.image,
        imageQuery: [item.destination.name, item.destination.city, item.destination.state, item.destination.country, item.destination.category || item.destination.type].filter(Boolean).join(" "),
        city: item.destination.city,
        state: item.destination.state,
        country: item.destination.country,
        category: item.destination.category || item.destination.type,
        subtitle: [item.destination.city, item.destination.country].filter(Boolean).join(", "),
        whyVisit: item.destination.description,
        distanceKm: Math.round(item.distanceKm),
        travelMinutes,
        travelMode,
        travelTime: item.distanceKm < 100 ? `${Math.round(item.distanceKm)} km • about ${Math.max(2, Math.round(item.distanceKm / 45))} hr drive` : `${Math.round(item.distanceKm)} km • easy weekend route`,
        bestFor: isWeekendTrip ? "Weekend getaway" : "Short escape",
        bestForTags: (item.destination.tags || item.destination.interests || []).slice(0, 3),
        visitDuration: isWeekendTrip ? "1-2 days" : "Half day to 1 day",
        whyAdd: isWeekendTrip
          ? `Strong weekend trip from ${place.name} if you want a change of pace.`
          : `Easy add-on escape from ${place.name} without overcomplicating the route.`,
      }
    })
}

function buildGenericStayAreaCards(place: any): HotelRecommendationCard[] {
  const cityLabel = place?.city || place?.name || "the destination"
  return [
    {
      id: `stay-generic-core-${norm(cityLabel) || "destination"}`,
      kind: "area",
      name: `${cityLabel} city center`,
      location: cityLabel,
      imageQuery: [cityLabel, place?.state, place?.country, "city center hotel district"].filter(Boolean).join(" "),
      city: place?.city,
      state: place?.state,
      country: place?.country,
      reason: `Best if you want easy access to the main sights, dining, and simpler local transfers around ${cityLabel}.`,
      budgetLabel: "Mid-range to premium",
      walkingTime: "Best for first-time convenience",
      tags: ["Central stay", "Easy access", "First-time friendly"],
    },
    {
      id: `stay-generic-value-${norm(cityLabel) || "destination"}`,
      kind: "area",
      name: `${cityLabel} value stay zone`,
      location: cityLabel,
      imageQuery: [cityLabel, place?.state, place?.country, "value hotel area"].filter(Boolean).join(" "),
      city: place?.city,
      state: place?.state,
      country: place?.country,
      reason: `A smarter base when you want better value and do not need to stay in the busiest premium pocket.`,
      budgetLabel: "Best value to mid-range",
      walkingTime: "Usually best with a short cab or metro ride",
      tags: ["Best value", "Balanced stay", "Budget-aware"],
    },
  ]
}

function tokenizeSearchQuery(query: string) {
  return norm(query)
    .split(" ")
    .filter((token) => token.length >= 3 && !SEARCH_STOP_WORDS.has(token))
}

function clampNearbyRadiusKm(value: number) {
  return Math.min(20, Math.max(5, Math.round(value)))
}

function extractNearbyRadiusKm(text: string, fallback = 12) {
  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*(km|kms|kilometers?)\b/i)
  if (kmMatch) return clampNearbyRadiusKm(Number(kmMatch[1]))

  const mileMatch = text.match(/(\d+(?:\.\d+)?)\s*(mi|mile|miles)\b/i)
  if (mileMatch) return clampNearbyRadiusKm(Number(mileMatch[1]) * 1.60934)

  return clampNearbyRadiusKm(fallback)
}

function parseNearbyCategoryFilter(text: string) {
  const value = norm(text)
  if (/(food|eat|restaurant|restaurants|brunch|breakfast|dinner|dessert|coffee|cafe)/.test(value)) return "Food"
  if (/(shopping|mall|market|store|stores)/.test(value)) return "Shopping"
  if (/(hidden gem|hidden gems|local spot|quiet spot|secret|less crowded)/.test(value)) return "Hidden gems"
  if (/(attraction|attractions|landmark|museum|park|things to do|sightseeing|photo|photos|scenic)/.test(value)) return "Attractions"
  return ""
}

function buildTravelMeta(distanceKm: number) {
  const roundedDistance = Math.round(distanceKm * 10) / 10
  if (roundedDistance <= 2.2) {
    return {
      distanceKm: roundedDistance,
      travelMode: "walk" as const,
      travelMinutes: Math.max(5, Math.round(roundedDistance * 12)),
    }
  }

  return {
    distanceKm: roundedDistance,
    travelMode: "drive" as const,
    travelMinutes: Math.max(8, Math.round(roundedDistance * 4 + 6)),
  }
}

function formatNearbyTravelSummary(input: {
  distanceKm?: number
  travelMinutes?: number
  travelMode?: "walk" | "drive"
}) {
  if (!Number.isFinite(Number(input.distanceKm))) return "Nearby"
  const distance =
    Number(input.distanceKm) < 10
      ? `${Number(input.distanceKm).toFixed(1)} km`
      : `${Math.round(Number(input.distanceKm))} km`
  if (!Number.isFinite(Number(input.travelMinutes)) || !input.travelMode) return distance
  return `${distance} • ${Math.round(Number(input.travelMinutes))} min ${input.travelMode}`
}

function matchesNearbyCategoryFilter(item: {
  category?: string
  bestFor?: string
  bestForTags?: string[]
  whyVisit?: string
}, categoryFilter: string) {
  if (!categoryFilter) return true
  const haystack = norm([item.category, item.bestFor, ...(item.bestForTags || []), item.whyVisit].filter(Boolean).join(" "))

  if (categoryFilter === "Attractions") return /(attraction|landmark|museum|park|view|culture|nature|photography|city)/.test(haystack)
  if (categoryFilter === "Food") return /(food|cafe|coffee|brunch|dessert|restaurant|dinner)/.test(haystack)
  if (categoryFilter === "Shopping") return /(shopping|market|mall|store)/.test(haystack)
  if (categoryFilter === "Hidden gems") return /(hidden gem|quiet|local vibe|local|relaxed)/.test(haystack)

  return haystack.includes(norm(categoryFilter))
}

function isNearbyPlacesIntent(text: string) {
  return /(nearby attractions|nearby places|popular nearby places|popular places near|show nearby places|show more nearby places|show more places|things to do near|attractions near|explore near|places around|around this destination|around this place|visit after reaching|what should i do after reaching there|what should i visit after reaching|what else can i cover|near\s+[a-z])/i.test(text)
}

function detectIntent(message: string, attachment?: AssistantAttachment | null): Intent {
  const text = norm(message)
  if (isTripContextReviewRequest(text)) return "general_qa"
  if (attachment?.category === "payment_screenshot") return "support_handoff"
  if (/(payment done|payment completed|paid but|money deducted|support|help ticket|booking not confirmed|refund|failed booking|issue with booking)/.test(text)) {
    return "support_handoff"
  }
  if (/(itinerary|plan|route|cover|order|day trip|days|vacation|holiday|trip|make it|turn this|refine|lower walking|reduce walking|walking effort|family friendly|kid friendly|snack stop|lunch stop|dinner stop|museum stop|indoor backup|iconic stop|half day|full day|quick plan)/.test(text)) {
    return "planning_guidance"
  }
  if (/(flight|fly|airport|airfare|book flight|book ticket|book this ticket)/.test(text)) return "flight_search"
  if (/(food|eat|restaurant|restaurants|dining|dinner|lunch|breakfast|brunch|dessert|coffee|cafe|street food|pizza|halal)/.test(text)) return "nearby_food"
  if (isNearbyPlacesIntent(text)) return "nearby_places"
  if (/(suggest|recommend|where should i go|which place|good places|good place|trip ideas|destination|destinations|hill stations|beach destinations|family trip places|romantic places|weekend places|places in india)/.test(text)) return "destination_discovery"
  if (/(map|maps|view on map|open map|map view|walking route|walk route|route from|route to|directions|how far)/.test(text)) return "transport_guidance"
  if (/(weather|temperature|rain|snow|climate|forecast)/.test(text)) return "weather_guidance"
  if (/(best time|best month|season to visit|good time to visit)/.test(text)) return "best_time_guidance"
  if (/(budget|cost|price|affordable|estimate|how much)/.test(text)) return "budget_estimation"
  if (/(hotel|stay|accommodation|resort|room)/.test(text)) return "hotel_guidance"
  if (/(metro|subway|train|bus|taxi|cab|uber|transport|get around)/.test(text)) return "transport_guidance"
  if (/(shopping|nightlife|bar|club|family|kids|couple|solo)/.test(text)) return "lifestyle_guidance"
  if (/(remove|change|switch|modify|replace|update|delete)/.test(text)) return "trip_modification"
  return "general_qa"
}

async function determineIntent(message: string, context: any, attachment?: AssistantAttachment | null) {
  const heuristicIntent = detectIntent(message, attachment)
  const classifiedIntent = await classifyIntentWithGroq(message, context).catch(() => null)
  const deterministicPlanningIntent = isDirectItineraryPlanningRequest(message, context)

  let chosenIntent =
    classifiedIntent && (classifiedIntent.confidence >= 0.58 || heuristicIntent === "general_qa")
      ? classifiedIntent.intent
      : heuristicIntent

  if (deterministicPlanningIntent) {
    chosenIntent = "planning_guidance"
  }
  if (isTripContextReviewRequest(message)) {
    chosenIntent = "general_qa"
  }
  if (isPlanningRefinementRequest(message, context)) {
    chosenIntent = "planning_guidance"
  }

  return {
    intent: chosenIntent,
    heuristicIntent,
    classifiedIntent,
    requiresLiveData: shouldUseLiveGrounding(chosenIntent, message, classifiedIntent),
  }
}

function isImplicitNearbyReference(text: string) {
  const value = norm(text)
  return /(there|this destination|this place|after reaching|after i reach|once i reach|once i reach there|what else can i cover|what should i visit)/.test(value)
}

function extractNearbyFocusPhrase(query: string) {
  return (
    query.match(/(?:places?|attractions?|things to do|spots?)\s+(?:near|around)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|this|today|tomorrow|please|trip|itinerary|hotel|hotels|budget)\b|[?.!,]|$)/i)?.[1]?.trim() ||
    query.match(/(?:near|around)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|this|today|tomorrow|please|trip|itinerary|hotel|hotels|budget)\b|[?.!,]|$)/i)?.[1]?.trim() ||
    ""
  )
}

function inferNearbyMainDestination(query: string, context: any) {
  const normalized = norm(query)
  const focusedDestination =
    (context?.selectedDestinations || []).find((item: any) => item.id === context?.focusDestinationId) ||
    (context?.selectedDestinations || []).find((item: any) => item.id === context?.nearbyPlanner?.mainDestinationId) ||
    ((context?.selectedDestinations || []).length === 1 ? context.selectedDestinations[0] : null)
  const explicitMatches = findExplicitPlaceMentions(query)
  const nearbyFocusPhrase = extractNearbyFocusPhrase(query)
  const mentioned = (context?.selectedDestinations || []).filter((item: any) => normalized.includes(norm(item.name)))

  if (explicitMatches.length === 1) return { place: explicitMatches[0], ambiguous: false, source: "query" as const }

  if (nearbyFocusPhrase) {
    const ranked = rankDestinations(nearbyFocusPhrase, 2)
    const topCandidate = ranked[0]
    const secondCandidate = ranked[1]
    const candidateGap = topCandidate ? topCandidate.score - (secondCandidate?.score || 0) : 0

    if (topCandidate && (topCandidate.score >= 95 || candidateGap >= 20)) {
      return { place: normalizeSelectedDestination(topCandidate.destination), ambiguous: false, source: "query" as const }
    }
  }

  if (mentioned.length === 1) return { place: mentioned[0], ambiguous: false, source: "context-query" as const }
  if (mentioned.length > 1) return { place: null, ambiguous: true, source: "none" as const }

  if (isImplicitNearbyReference(query)) {
    if (focusedDestination) return { place: focusedDestination, ambiguous: false, source: "focus" as const }
    if ((context?.selectedDestinations || []).length > 1) return { place: null, ambiguous: true, source: "none" as const }
  }

  if ((/nearby|near|around|show more places|show more nearby places/.test(normalized) || context?.nearbyPlanner?.mainDestinationId) && focusedDestination) {
    return { place: focusedDestination, ambiguous: false, source: "focus" as const }
  }

  return { place: null, ambiguous: false, source: "none" as const }
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

function parseNumberWord(token?: string | null) {
  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  }
  return map[norm(token)] || 0
}

function parseDuration(text: string, fallback = 0) {
  const normalizedText = String(text || "").replace(/(\d+)\s*-\s*(day|days|night|nights)\b/gi, "$1 $2")
  const digitCount = Number(normalizedText.match(/(\d+)\s*(day|days|night|nights)\b/i)?.[1] || 0)
  if (Number.isFinite(digitCount) && digitCount > 0) return digitCount

  const wordCount = parseNumberWord(normalizedText.match(/\b(one|two|three|four|five|six|seven)\s*(day|days|night|nights)\b/i)?.[1])
  if (wordCount > 0) return wordCount

  if (/\bweekend\b/i.test(normalizedText)) return 2

  const count = Number(fallback)
  return Number.isFinite(count) && count > 0 ? count : fallback
}

function parseBudgetCap(text: string) {
  const directLakh = text.match(/(?:under|within|around|about|budget(?:\s+of)?|for)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|k)\b/i)
  if (directLakh) {
    const raw = Number(directLakh[1])
    const unit = directLakh[2]?.toLowerCase()
    if (!Number.isFinite(raw)) return null
    if (unit === "lakh" || unit === "lakhs") return Math.round(raw * 100000)
    if (unit === "k") return Math.round(raw * 1000)
  }

  const directNumber = text.match(/(?:under|within|around|about|budget(?:\s+of)?|for)\s*(?:rs\.?|inr|₹)?\s*(\d{4,7})\b/i)
  if (directNumber) {
    const value = Number(directNumber[1])
    return Number.isFinite(value) ? value : null
  }

  return null
}

function parseTripGroup(text: string) {
  const value = norm(text)
  if (/(family|kids|children|parents)/.test(value)) return "family"
  if (/(couple|honeymoon|romantic)/.test(value)) return "couple"
  if (/(friends|group|buddies)/.test(value)) return "friends"
  if (/(solo|alone)/.test(value)) return "solo"
  return "general"
}

function parseCountryPreference(text: string) {
  const value = norm(text)
  if (value.includes("india")) return "India"
  const match = destinations.find((destination) => value.includes(norm(destination.country)))
  return match?.country || ""
}

function getDiscoveryContext(raw: any) {
  return {
    ...defaultTripSetupState.discoveryContext,
    ...(raw?.discoveryContext || {}),
  }
}

function parseDiscoveryThemes(text: string) {
  const value = norm(text)
  const themes: string[] = []
  if (/(hill|mountain|cool weather|summer)/.test(value)) themes.push("hills")
  if (/(beach|coast|island)/.test(value)) themes.push("beach")
  if (/(culture|heritage|history|temple|fort|palace)/.test(value)) themes.push("culture")
  if (/(nature|scenic|forest|lake|backwater|waterfall)/.test(value)) themes.push("nature")
  if (/(adventure|trek|wildlife|road trip)/.test(value)) themes.push("adventure")
  return themes
}

function parseSupportIssueType(text: string, attachment?: AssistantAttachment | null) {
  const value = norm(text)
  if (attachment?.category === "payment_screenshot" || /(payment done|payment completed|paid but|charged but|money deducted|payment proof|transaction)/.test(value)) {
    return "payment_not_confirmed"
  }
  if (/(refund|refund status|refund issue|cancellation refund)/.test(value)) return "refund_followup"
  if (/(change booking|modify booking|reschedule|change date|booking issue)/.test(value)) return "booking_change"
  return "general_support"
}

function buildSupportIssueSummary(message: string, attachment: AssistantAttachment | null | undefined, context: any): SupportIssueSummaryPayload {
  const issueType = parseSupportIssueType(message, attachment)
  const destinationName = context?.focusDestinationId
    ? (context?.selectedDestinations || []).find((item: any) => item.id === context.focusDestinationId)?.name
    : context?.selectedDestinations?.[0]?.name
  const title =
    issueType === "payment_not_confirmed"
      ? "Payment completed but booking not confirmed"
      : issueType === "refund_followup"
        ? "Refund follow-up summary"
        : issueType === "booking_change"
          ? "Booking modification help"
          : "Travel support summary"
  const urgency =
    issueType === "payment_not_confirmed" || /urgent|asap|immediately|stuck/.test(norm(message))
      ? "high"
      : issueType === "refund_followup"
        ? "medium"
        : "low"
  const statusLabel =
    issueType === "payment_not_confirmed"
      ? "Needs payment verification"
      : issueType === "refund_followup"
        ? "Needs refund status check"
        : issueType === "booking_change"
          ? "Needs booking review"
          : "Needs support review"

  return {
    title,
    issueType,
    urgency,
    statusLabel,
    summary:
      issueType === "payment_not_confirmed"
        ? `Wanderly flagged a payment-success-but-booking-pending issue${destinationName ? ` for ${destinationName}` : ""}.`
        : issueType === "refund_followup"
          ? "Wanderly prepared a refund follow-up summary so support can check the transaction quickly."
          : issueType === "booking_change"
            ? "Wanderly prepared a concise booking-change summary so the next handoff is faster."
            : "Wanderly prepared a support-ready summary from your request.",
    evidenceNote: attachment
      ? `You attached ${attachment.category?.replace(/_/g, " ") || "a file"} named ${attachment.name}. I treated it as support evidence, but I did not infer any unseen details from the image itself.`
      : "No file was attached, so this summary is based only on your message and trip context.",
    recommendedSteps:
      issueType === "payment_not_confirmed"
        ? [
            "Keep the payment proof, transaction ID, and booking attempt details together in one message.",
            "Ask support to verify whether the payment was captured, pending, or failed at confirmation stage.",
            "Request either booking confirmation or a refund timeline if inventory was not reserved.",
          ]
        : issueType === "refund_followup"
          ? [
              "Share the booking ID, cancellation date, and payment method in one support reply.",
              "Ask support to confirm the current refund stage and expected settlement timeline.",
              "Keep the original payment proof ready in case support requests verification again.",
            ]
          : issueType === "booking_change"
            ? [
                "Share the booking reference and the exact change you want support to make.",
                "Confirm whether date, traveler, or destination changes are flexible before handoff.",
                "Ask support to confirm any fare difference or change fee before processing.",
              ]
            : [
                "Share your booking reference or trip details in the next message for a faster handoff.",
                "Attach supporting proof if the issue involves payment, refunds, or failed confirmations.",
                "Ask support to confirm the next concrete action and timeline.",
              ],
    referenceHints: [
      destinationName ? `Trip focus: ${destinationName}` : "Trip focus not set",
      context?.startingLocation ? `Origin: ${context.startingLocation}` : "Origin not set",
      context?.dateRange?.from ? `Trip date: ${context.dateRange.from}` : "Trip date not set",
      attachment?.name ? `Attachment: ${attachment.name}` : "No attachment",
    ],
  }
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

function parseSingleTravelDate(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso?.[1]) return iso[1]

  const normalized = text.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
  const match = normalized.match(/\b(?:on|for|leaving|departing|departure|travel(?:ling)?|fly(?:ing)?)?\s*(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/i)
  if (!match) return ""

  const monthLookup: Record<string, number> = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
  }

  const day = Number(match[1])
  const month = monthLookup[String(match[2] || "").toLowerCase()]
  const today = new Date()
  let year = Number(match[3] || today.getFullYear())
  if (!match[3]) {
    const candidate = new Date(year, month, day)
    if (candidate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
      year += 1
    }
  }

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return ""
  return toIsoDate(new Date(year, month, day))
}

const FLIGHT_CITY_CODE_MAP: Record<string, string> = {
  mumbai: "BOM",
  paris: "CDG",
  london: "LHR",
  dubai: "DXB",
  delhi: "DEL",
  newdelhi: "DEL",
  "new york": "JFK",
  newyork: "JFK",
  singapore: "SIN",
  bangkok: "BKK",
  rome: "FCO",
  barcelona: "BCN",
  amsterdam: "AMS",
  istanbul: "IST",
  tokyo: "HND",
  sydney: "SYD",
}

function airportCodeForCity(city: string) {
  const key = String(city || "").toLowerCase().replace(/\s+/g, " ").trim()
  return FLIGHT_CITY_CODE_MAP[key] || key.split(" ").map((part) => part[0]).join("").slice(0, 3).toUpperCase() || "AIR"
}

function titleCaseCity(value: string) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

function parseFlightSearchParams(query: string, context: any): FlightSearchParams | null {
  const normalized = query.replace(/\s+/g, " ").trim()
  const explicitFrom = normalized.match(/\bfrom\s+([a-zA-Z][a-zA-Z\s]{1,40}?)\s+to\s+([a-zA-Z][a-zA-Z\s]{1,40}?)(?=\s+(?:on|for|next|this|with|under|in|return|and)\b|[?.!,]|$)/i)
  const implicitRoute = normalized.match(/\b([a-zA-Z][a-zA-Z\s]{1,30}?)\s+to\s+([a-zA-Z][a-zA-Z\s]{1,30}?)(?=\s+(?:on|for|next|this|with|under|in|return|and)\b|[?.!,]|$)/i)
  const routeMatch = explicitFrom || implicitRoute

  const originRaw = explicitFrom?.[1] || implicitRoute?.[1] || context?.startingLocation || ""
  const destinationRaw = routeMatch?.[2] || context?.selectedDestinations?.[0]?.city || context?.selectedDestinations?.[0]?.name || ""
  const departureDate = parseSingleTravelDate(query) || context?.dateRange?.from || ""
  const tripType = /\b(return|round trip|roundtrip|come back)\b/i.test(query) ? "round_trip" : "one_way"
  const cabinClass =
    /\b(business|biz)\b/i.test(query) ? "Business" :
    /\b(premium economy|premium)\b/i.test(query) ? "Premium Economy" :
    /\b(first class|first)\b/i.test(query) ? "First" :
    /\b(economy)\b/i.test(query) ? "Economy" :
    undefined
  const adults = parseTravelers(query, context?.travelers || 1)
  const budgetLevel = context?.budgetPreference === "luxury" ? "premium" : context?.budgetPreference === "budget" ? "low" : "medium"

  const origin = titleCaseCity(originRaw.replace(/\b(i|want|need|travel|fly|flights?|ticket|tickets|suggest|me|to travel)\b/gi, " ").replace(/\s+/g, " ").trim())
  const destination = titleCaseCity(destinationRaw.replace(/\b(flights?|ticket|tickets|please|suggest|me)\b/gi, " ").replace(/\s+/g, " ").trim())

  if (!origin || !destination || !departureDate) return null

  return {
    origin,
    destination,
    departureDate,
    tripType,
    cabinClass,
    adults,
    budgetLevel,
  }
}

function buildFlightCards(params: FlightSearchParams): FlightSearchPayload {
  const generated = generateDemoFlights(
    params.origin,
    params.destination,
    params.departureDate,
    Math.max(1, params.adults || 1),
    params.cabinClass?.toLowerCase().includes("business") ? "premium" : params.budgetLevel,
    6
  )
  const baseCards = generated.map((flight, index) => {
    const badge =
      index === 0 ? "Best overall" :
      index === 1 ? "Lowest fare" :
      index === 2 ? "Fastest" :
      flight.stops === 0 ? "Fewest stops" :
      "Good layover"
    const explanation =
      badge === "Lowest fare" ? "Lowest fare on this route, with a slightly tighter travel window." :
      badge === "Fastest" ? "Shortest overall travel time, usually worth it if your schedule matters more than fare." :
      badge === "Fewest stops" ? "Cleaner routing with less connection risk and easier airport time." :
      "Best balance of fare, timing, and comfort for this search."

    return {
      id: flight.id,
      airline: flight.airline,
      airlineCode: flight.airline.slice(0, 2).toUpperCase(),
      logoLabel: flight.airline.slice(0, 2).toUpperCase(),
      route: {
        originCity: params.origin,
        destinationCity: params.destination,
        originCode: airportCodeForCity(params.origin),
        destinationCode: airportCodeForCity(params.destination),
      },
      departureTime: flight.departure,
      arrivalTime: flight.arrival,
      departureDate: params.departureDate,
      duration: flight.duration,
      stopCount: flight.stops,
      stopLabel: flight.stops === 0 ? "Non-stop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`,
      price: flight.price,
      currency: DEFAULT_CURRENCY,
      fareType: index % 2 === 0 ? "Saver" : "Flex",
      baggageNote: index % 2 === 0 ? "15kg cabin + 20kg check-in" : "7kg cabin included",
      cabinClass: params.cabinClass || flight.class || "Economy",
      badge,
      matchLabel: badge === "Fastest" ? "Shortest route" : badge === "Lowest fare" ? "Best budget fit" : "Strong overall match",
      explanation,
      layoverNote: flight.stops > 0 ? "Connection timing looks manageable for a same-day transfer." : "No layover needed on this routing.",
      source: flight.source,
    } satisfies FlightRecommendationCard
  })

  const cheapest = [...baseCards].sort((a, b) => a.price - b.price)[0]
  const fastest = [...baseCards].sort((a, b) => {
    const aMinutes = Number(a.duration.match(/(\d+)h/)?.[1] || 0) * 60 + Number(a.duration.match(/(\d+)m/)?.[1] || 0)
    const bMinutes = Number(b.duration.match(/(\d+)h/)?.[1] || 0) * 60 + Number(b.duration.match(/(\d+)m/)?.[1] || 0)
    return aMinutes - bMinutes
  })[0]

  return {
    querySummary: `${params.origin} -> ${params.destination} on ${params.departureDate}`,
    introText: `Here are some flight options for ${params.origin} -> ${params.destination} on ${params.departureDate}. I've highlighted a mix of best value, shortest route, and booking-ready picks.`,
    route: {
      origin: params.origin,
      destination: params.destination,
      originCode: airportCodeForCity(params.origin),
      destinationCode: airportCodeForCity(params.destination),
    },
    departureDate: params.departureDate,
    tripType: params.tripType,
    returnDate: params.returnDate,
    recommendedOptionId: baseCards[0]?.id,
    bookingReady: baseCards.length > 0,
    cards: baseCards,
    responseActions: [
      "Compare options",
      "Cheapest flights",
      "Fastest route",
      "Fewer stops",
      "Round-trip options",
      "Morning departures",
    ],
    summaryBadges: [
      cheapest ? `Lowest fare ${formatCurrency(cheapest.price, cheapest.currency)}` : "Best value found",
      fastest ? `Fastest ${fastest.duration}` : "Short travel windows",
      params.tripType === "round_trip" ? "Round-trip search" : "One-way search",
    ],
    dataMode: "DEMO",
  }
}

async function tryBuildLiveFlightCards(params: FlightSearchParams): Promise<FlightSearchPayload | null> {
  if (!isAmadeusConfigured()) return null

  try {
    const originCode = await resolveAirportCode(params.origin)
    const destinationCode = await resolveAirportCode(params.destination)
    if (!originCode || !destinationCode) return null

    type FlightOffersResponse = { data: any[] }
    const response = await amadeusGet<FlightOffersResponse>("/v2/shopping/flight-offers", {
      originLocationCode: originCode,
      destinationLocationCode: destinationCode,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: Math.max(1, params.adults || 1),
      travelClass:
        params.cabinClass?.toUpperCase().includes("BUSINESS") ? "BUSINESS"
        : params.cabinClass?.toUpperCase().includes("PREMIUM") ? "PREMIUM_ECONOMY"
        : "ECONOMY",
      currencyCode: DEFAULT_CURRENCY,
      max: 6,
    })

    const cards: FlightRecommendationCard[] = (response.data || []).slice(0, 6).map((offer, index) => {
      const itinerary = offer.itineraries?.[0]
      const segments = itinerary?.segments || []
      const firstSegment = segments[0]
      const lastSegment = segments[segments.length - 1]
      const totalPrice = Number(offer.price?.grandTotal || offer.price?.total || 0)
      const stopCount = Math.max(0, segments.length - 1)
      const durationMatch = String(itinerary?.duration || "PT0M").match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
      const totalHours = Number(durationMatch?.[1] || 0)
      const totalMinutes = Number(durationMatch?.[2] || 0)
      const duration = `${totalHours}h ${totalMinutes}m`
      const airlineCode = offer.validatingAirlineCodes?.[0] || firstSegment?.carrierCode || "XX"
      const badge =
        index === 0 ? "Best overall"
        : stopCount === 0 ? "Non-stop pick"
        : index === 1 ? "Lowest fare"
        : "Strong flight fit"

      return {
        id: String(offer.id || `live-flight-${index + 1}`),
        airline: airlineCode,
        airlineCode,
        logoLabel: airlineCode,
        route: {
          originCity: params.origin,
          destinationCity: params.destination,
          originCode,
          destinationCode,
        },
        departureTime: firstSegment?.departure?.at ? new Date(firstSegment.departure.at).toISOString().slice(11, 16) : "--:--",
        arrivalTime: lastSegment?.arrival?.at ? new Date(lastSegment.arrival.at).toISOString().slice(11, 16) : "--:--",
        departureDate: params.departureDate,
        duration,
        stopCount,
        stopLabel: stopCount === 0 ? "Non-stop" : `${stopCount} stop${stopCount > 1 ? "s" : ""}`,
        price: convertCurrencyValue(
          Number.isFinite(totalPrice) ? totalPrice : 0,
          offer.price?.currency || "USD",
          DEFAULT_CURRENCY,
          50
        ),
        currency: DEFAULT_CURRENCY,
        fareType: stopCount === 0 ? "Best convenience" : "Balanced fare",
        baggageNote: "Cabin baggage depends on airline fare rules.",
        cabinClass: params.cabinClass || "Economy",
        badge,
        matchLabel: badge === "Lowest fare" ? "Budget-friendly live fare" : badge === "Non-stop pick" ? "Fastest routing" : "Strong live match",
        explanation:
          badge === "Lowest fare"
            ? "One of the cheapest live fares on this route right now."
            : badge === "Non-stop pick"
              ? "Useful if you want the cleanest travel day with fewer connection risks."
              : "Good balance of timing, routing, and fare from the live search snapshot.",
        layoverNote: stopCount > 0 ? "Check layover timing before booking." : undefined,
        source: "LIVE",
      }
    })

    if (!cards.length) return null

    return {
      querySummary: `Live flight options for ${params.origin} to ${params.destination}`,
      introText: `I found live flight options for ${params.origin} to ${params.destination}.`,
      route: {
        origin: params.origin,
        destination: params.destination,
        originCode,
        destinationCode,
      },
      departureDate: params.departureDate,
      tripType: params.tripType,
      returnDate: params.returnDate,
      recommendedOptionId: cards[0]?.id,
      bookingReady: true,
      cards,
      responseActions: ["Book ticket", "Compare options", "Cheapest flights", "Fastest route"],
      summaryBadges: ["Live fare snapshot", `${cards.length} flight options`],
      dataMode: "LIVE",
    }
  } catch {
    return null
  }
}

async function trySearchLiveHotelsForPlace(place: any, context: any) {
  if (!place || !isRapidApiConfigured()) return null
  if (!context?.dateRange?.from || !context?.dateRange?.to) return null

  try {
    const response = await searchLiveHotels({
      city: place.city || place.name,
      checkIn: context.dateRange.from,
      checkOut: context.dateRange.to,
      adults: Math.max(1, Number(context?.travelers) || 1),
      page: 1,
      limit: 4,
      widerSearch: true,
    })

    const normalized = (response.hotels || []).slice(0, 4).map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      destination: place.name,
      city: hotel.city,
      price: typeof hotel.pricePerNight === "number" ? hotel.pricePerNight : 0,
      rating: hotel.rating || 0,
      image: hotel.imageUrl || undefined,
      amenities: hotel.amenities || [],
      currency: hotel.currency || DEFAULT_CURRENCY,
      hotelType: "Hotel",
      latitude: undefined,
      longitude: undefined,
      source: "LIVE",
    }))

    return normalized.length ? normalized : null
  } catch {
    return null
  }
}

async function tryGetLiveWeather(placeName: string, destination: any) {
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return null

  const safeCity = destination?.city || placeName
  const lat = Number(destination?.latitude)
  const lon = Number(destination?.longitude)
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon)
  if (!safeCity && !hasCoords) return null

  try {
    const url = hasCoords
      ? `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(safeCity)}&appid=${apiKey}&units=metric`

    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const currentTemp = Math.round(Number(data?.main?.temp || 0))
    const condition = String(data?.weather?.[0]?.main || "Pleasant")

    return {
      place: destination?.name || data?.name || safeCity,
      city: data?.name || safeCity,
      temperatureC: currentTemp,
      condition,
      bestTime: destination?.bestTimeToVisit || destination?.bestTime,
      packing:
        currentTemp >= 30
          ? "Light layers and sun protection are the safest call."
          : /rain/i.test(condition)
            ? "Carry a compact umbrella or light rain layer."
            : currentTemp <= 12
              ? "A light jacket will help, especially in the morning and evening."
              : "Light layers should work well through the day.",
      bestHours:
        currentTemp >= 30
          ? "Plan outdoor walking earlier in the day or closer to sunset."
          : /rain/i.test(condition)
            ? "Keep indoor backup stops ready around the wettest window."
            : "Mid-morning through early evening should feel comfortable.",
      comfort:
        currentTemp >= 30
          ? "Expect a warmer sightseeing day, especially for longer outdoor walks."
          : /rain/i.test(condition)
            ? "Still workable, but it is smarter to keep the plan flexible."
            : "Conditions look comfortable for regular sightseeing.",
      source: "LIVE",
      observedAt: Date.now(),
    }
  } catch {
    return null
  }
}

async function generateGroqTravelCopy(input: {
  userMessage: string
  intent: Intent
  context: any
  resolvedPlace?: any
  grounding: Record<string, any>
}): Promise<TravelCopyResult | null> {
  const responseText = await runGroqChatCompletion({
    scope: "travel-copy",
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: [
          "You are Wanderly AI Travel Expert, a premium in-product travel copilot.",
          "Return only one JSON object with keys shortAnswer and followUpQuestion.",
          "shortAnswer must be 1-2 sentences, warm, confident, concise, and grounded in the provided travel data.",
          "Never say you are an AI model, never mention Google Maps, Booking.com, Expedia, or generic web searching.",
          "If live data is unavailable, describe the answer as strong typical options or a curated travel recommendation without sounding weak.",
          "Prefer product-style microcopy over generic chatbot phrasing.",
          "followUpQuestion should be empty if no follow-up is needed.",
        ].join(" "),
      },
      {
        role: "system",
        content: JSON.stringify({
          intent: input.intent,
          resolvedPlace: input.resolvedPlace ? compactDestination(input.resolvedPlace) : null,
          tripContext: {
            selectedDestinations: (input.context?.selectedDestinations || []).map((item: any) => item.name),
            dateRange: input.context?.dateRange,
            budgetPreference: input.context?.budgetPreference,
            travelStyle: input.context?.travelStyle,
            travelers: input.context?.travelers,
          },
          grounding: input.grounding,
        }),
      },
      {
        role: "user",
        content: input.userMessage,
      },
    ],
  })

  if (!responseText) return null
  const parsed = parseJsonObject<TravelCopyResult>(responseText)
  if (parsed?.shortAnswer) return parsed
  return {
    shortAnswer: responseText.split(/\n+/).join(" ").trim(),
    followUpQuestion: "",
  }
}

function scoreDestination(destination: (typeof destinations)[number], query: string) {
  const haystack = norm([destination.name, destination.city, destination.state, destination.country, destination.type, destination.region].filter(Boolean).join(" "))
  const q = norm(query)
  const tokens = tokenizeSearchQuery(query)
  if (!q || !tokens.length) return 0
  if (haystack === q) return 180
  if (q.length >= 5 && haystack.includes(q)) return 120
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? (token.length >= 6 ? 26 : 18) : 0), 0)
}

function slugifyPlaceKey(value: string) {
  return norm(value).replace(/\s+/g, "-")
}

function getRegionalDestinationMatch(label?: string | null) {
  const normalizedLabel = norm(label)
  if (!normalizedLabel || normalizedLabel.length < 3) return null

  const byState = destinations.filter((destination) => norm(destination.state) === normalizedLabel)
  if (byState.length >= 2) {
    const averageLatitude = byState.reduce((sum, item) => sum + Number(item.latitude || 0), 0) / byState.length
    const averageLongitude = byState.reduce((sum, item) => sum + Number(item.longitude || 0), 0) / byState.length
    const budgets = byState
      .map((item) => item.budget || { min: 0, max: 0, currency: DEFAULT_CURRENCY })
      .filter((item) => Number.isFinite(Number(item.min)) && Number.isFinite(Number(item.max)))
    const bestTime = byState.map((item) => item.bestTime || item.bestTimeToVisit).filter(Boolean)[0] || ""
    const topTypes = Array.from(new Set(byState.map((item) => item.category || item.type).filter(Boolean))).slice(0, 3)
    const topInterests = Array.from(new Set(byState.flatMap((item) => item.tags || item.interests || []))).slice(0, 4)

    return {
      id: `region-state-${slugifyPlaceKey(label || normalizedLabel)}`,
      name: titleCaseCity(label || normalizedLabel),
      city: titleCaseCity(label || normalizedLabel),
      state: titleCaseCity(label || normalizedLabel),
      country: byState[0]?.country || "",
      region: byState[0]?.region || "",
      image: byState[0]?.image,
      description: `${titleCaseCity(label || normalizedLabel)} is a strong travel base for ${topTypes.map((item) => String(item).toLowerCase()).join(", ")} with easy access to ${byState.slice(0, 3).map((item) => item.name).join(", ")} and other local highlights.`,
      category: /beach/i.test(topTypes.join(" ")) ? "Beach destination" : "Destination region",
      type: "Travel region",
      bestTime,
      budget: budgets.length
        ? {
            min: Math.min(...budgets.map((item) => Number(item.min || 0))),
            max: Math.max(...budgets.map((item) => Number(item.max || 0))),
            currency: budgets[0]?.currency || DEFAULT_CURRENCY,
          }
        : { min: 0, max: 0, currency: DEFAULT_CURRENCY },
      interests: topInterests,
      latitude: Number.isFinite(averageLatitude) ? averageLatitude : byState[0]?.latitude,
      longitude: Number.isFinite(averageLongitude) ? averageLongitude : byState[0]?.longitude,
      planningCandidates: byState
        .slice()
        .sort((left, right) => right.rating - left.rating || right.annualVisitors - left.annualVisitors)
        .slice(0, 8),
    }
  }

  return null
}

function extractDestinationAnchorPhrases(query: string) {
  const directPhrases = [
    query.match(/(?:plan|create|build|design)\s+(?:a\s+)?(?:\d+\s*[- ]?(?:day|days|night|nights)\s+)?(?:trip|itinerary|vacation|holiday)\s+(?:to|for|in)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|please|and|that)\b|[?.!,]|$)/i)?.[1],
    query.match(/(?:\d+\s*[- ]?(?:day|days|night|nights)|weekend)\s+(?:trip|itinerary|vacation|holiday)\s+(?:to|for|in)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|please|and|that)\b|[?.!,]|$)/i)?.[1],
    query.match(/(?:trip|itinerary|vacation|holiday)\s+(?:to|for|in)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|please|and|that)\b|[?.!,]|$)/i)?.[1],
    query.match(/(?:to|for|in)\s+([a-zA-Z][a-zA-Z\s,'-]{1,60}?)(?=\s+(?:for|with|under|on|please|and|that)\b|[?.!,]|$)/i)?.[1],
  ]

  return Array.from(new Set(directPhrases.map((item) => item?.trim()).filter(Boolean))) as string[]
}

function isDestinationDiscoveryPrompt(message: string) {
  const text = norm(message)
  return /(where should i go|which destination|suggest destinations|recommend destinations|trip ideas|best destination|best places in india|best places to visit)/.test(text)
}

function isDirectItineraryPlanningRequest(message: string, context: any) {
  const text = norm(message)
  if (/(hotel|stay|accommodation|budget|cost|price|weather|temperature|flight|airport|nearby places|best places near|things to do near)/.test(text)) {
    return false
  }
  if (isDestinationDiscoveryPrompt(message)) return false

  const hasPlanningLanguage = /(itinerary|plan|trip|vacation|holiday|weekend)/.test(text)
  if (!hasPlanningLanguage) return false

  const explicitMatches = findExplicitPlaceMentions(message)
  const regionalMatch = extractDestinationAnchorPhrases(message)
    .map((phrase) => getRegionalDestinationMatch(phrase))
    .find(Boolean)
  const hasLockedDestination = Boolean(
    explicitMatches.length === 1 ||
    regionalMatch ||
    getFocusedContextPlace(context) ||
    resolvePlaceFromMemory(context)
  )
  const hasDuration = parseDuration(message, 0) > 0 || /\bweekend\b/.test(text)
  const hasDirectPlanningPhrase =
    /(plan|create|build|design)\b/.test(text) ||
    /\bitinerary\b/.test(text) ||
    /\btrip to\b/.test(text) ||
    /\btrip for\b/.test(text) ||
    /\bweekend trip\b/.test(text)

  return hasLockedDestination && (hasDirectPlanningPhrase || hasDuration)
}

function rankDestinations(query: string, limit = 6) {
  return destinations
    .map((destination) => ({ destination, score: scoreDestination(destination, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.destination.rating - a.destination.rating)
    .slice(0, limit)
}

function findExplicitPlaceMentions(query: string) {
  const normalizedQuery = norm(query)
  if (!normalizedQuery) return []

  const aliasHits = Object.entries(PLACE_ALIASES)
    .filter(([alias]) => normalizedQuery.includes(alias))
    .map(([, canonical]) => canonical)

  const exactNameOrCityMatches = destinations.filter((destination) => {
    const candidates = [destination.name, destination.city].filter(Boolean).map((value) => norm(value))
    return candidates.some((candidate) => candidate.length >= 4 && normalizedQuery.includes(candidate))
  })

  const scoredMatches = rankDestinations(query, 6)
    .filter((item) => item.score >= 80)
    .map((item) => item.destination)

  const combined = Array.from(
    new Map(
      [...aliasHits, ...exactNameOrCityMatches.map((item) => item.name), ...scoredMatches.map((item) => item.name)]
        .map((name) => {
          const match = destinations.find((destination) => norm(destination.name) === norm(name))
          return match ? [match.id, normalizeSelectedDestination(match)] : null
        })
        .filter(Boolean) as [string, any][]
    ).values()
  )

  return combined
}

function searchDestinations(query: string, limit = 6) {
  return dedupeSelectedDestinations(
    rankDestinations(query, limit)
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
    imageQuery: [destination.name, destination.city, destination.state, destination.country, destination.category || match?.category || match?.type].filter(Boolean).join(" "),
    bestTime: match?.bestTimeToVisit || match?.bestTime,
    description: match?.description,
    budget: destination.budget || match?.budget,
  }
}

function scoreRecommendationFit(destination: (typeof destinations)[number], input: {
  query: string
  budgetCap: number | null
  group: string
  countryPreference: string
  themes: string[]
}) {
  let score = scoreDestination(destination, input.query)
  const tags = (destination.tags || destination.interests || []).map((tag) => norm(tag))
  const type = norm(destination.type)
  const description = norm(destination.description)

  if (input.countryPreference && norm(destination.country) === norm(input.countryPreference)) score += 80
  if (input.budgetCap) {
    if (destination.budget.max <= input.budgetCap) score += 70
    else if (destination.budget.min <= input.budgetCap * 1.2) score += 28
    else score -= 30
  }

  if (input.group === "family" && /(family|lake|nature|hill|beach|palace|culture|wildlife|relaxed)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 34
  if (input.group === "couple" && /(romance|lake|scenic|beach|palace|sunset)/.test(`${tags.join(" ")} ${description}`)) score += 30
  if (input.group === "solo" && /(culture|city|cafe|heritage|backpacking|wellness)/.test(`${tags.join(" ")} ${description}`)) score += 24

  for (const theme of input.themes) {
    if (theme === "hills" && /(hill|mountain|cool)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 26
    if (theme === "beach" && /(beach|coast|island)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 26
    if (theme === "culture" && /(culture|heritage|history|fort|palace|temple)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 26
    if (theme === "nature" && /(nature|forest|waterfall|lake|backwater|scenic)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 26
    if (theme === "adventure" && /(adventure|trek|wildlife|road trip|snow)/.test(`${tags.join(" ")} ${type} ${description}`)) score += 26
  }

  if (destination.rating >= 4.7) score += 12
  return score
}

function buildDestinationMatchReason(destination: (typeof destinations)[number], input: {
  budgetCap: number | null
  group: string
  themes: string[]
}) {
  const descriptor = `${norm(destination.type)} ${(destination.tags || []).map((tag) => norm(tag)).join(" ")} ${norm(destination.description)}`
  if (input.group === "family" && /family|lake|nature|hill|beach|palace|culture|wildlife/.test(descriptor)) return "Great for families"
  if (input.budgetCap && destination.budget.max <= input.budgetCap * 0.45) return "Best value"
  if (input.themes.includes("hills") && /hill|mountain|cool/.test(descriptor)) return "Cool-weather escape"
  if (input.themes.includes("beach") && /beach|coast|island/.test(descriptor)) return "Relaxed beach pick"
  if (input.themes.includes("culture") && /culture|heritage|history|fort|palace|temple/.test(descriptor)) return "Strong culture pick"
  return "Strong overall match"
}

function buildDestinationHighlights(destination: (typeof destinations)[number], input: {
  budgetCap: number | null
  group: string
}) {
  const highlights: string[] = []
  if (input.group === "family") highlights.push("Comfortable family pace")
  if (input.budgetCap && destination.budget.max <= input.budgetCap * 0.45) highlights.push("Good value for budget")
  if (/Oct|Nov|Dec|Jan|Feb|Mar/i.test(destination.bestTimeToVisit || destination.bestTime)) highlights.push("Best in popular travel season")
  if (/(nature|hill|beach|culture|wildlife)/i.test(destination.type)) highlights.push(`Known for ${destination.type.toLowerCase()}`)
  if (destination.rating >= 4.7) highlights.push("Premium-feel favorite")
  return highlights.slice(0, 3)
}

function buildSuggestedDuration(destination: (typeof destinations)[number], input: { group: string }) {
  if (/hill|beach|nature|wildlife/i.test(destination.type)) return input.group === "family" ? "4-5 days" : "3-4 days"
  if (/culture|heritage|city|spiritual/i.test(destination.type)) return "3-4 days"
  return "4 days"
}

function buildDestinationRecommendations(query: string, context: any) {
  const discoveryContext = getDiscoveryContext(context)
  const discoveryTranscript = [
    query,
    discoveryContext.searchQuery,
    discoveryContext.selectedRegion !== "All Regions" ? discoveryContext.selectedRegion : "",
    discoveryContext.selectedState !== "All States" ? discoveryContext.selectedState : "",
    discoveryContext.selectedType !== "All Types" ? discoveryContext.selectedType : "",
    ...(discoveryContext.selectedInterests || []),
    discoveryContext.unescoOnly ? "unesco" : "",
  ].filter(Boolean).join(" ")
  const budgetCap = parseBudgetCap(discoveryTranscript) || (discoveryContext.budgetRange?.[1] && discoveryContext.budgetRange[1] < 50000 ? discoveryContext.budgetRange[1] : null)
  const group = parseTripGroup(query)
  const countryPreference = parseCountryPreference(discoveryTranscript) || (context?.selectedDestinations?.[0]?.country || "")
  const themes = Array.from(new Set([
    ...parseDiscoveryThemes(discoveryTranscript),
    ...(discoveryContext.selectedInterests || []).map((interest: string) => norm(interest)),
  ]))

  const ranked = destinations
    .filter((destination) => !countryPreference || norm(destination.country) === norm(countryPreference))
    .filter((destination) => discoveryContext.selectedRegion === "All Regions" || norm(destination.region) === norm(discoveryContext.selectedRegion))
    .filter((destination) => discoveryContext.selectedState === "All States" || norm(destination.state) === norm(discoveryContext.selectedState))
    .filter((destination) => discoveryContext.selectedType === "All Types" || norm(destination.type) === norm(discoveryContext.selectedType) || norm(destination.category) === norm(discoveryContext.selectedType))
    .filter((destination) => !discoveryContext.unescoOnly || destination.isUNESCO || (destination.tags || []).some((tag) => norm(tag) === "unesco"))
    .map((destination) => ({
      destination,
      score:
        scoreRecommendationFit(destination, { query: discoveryTranscript, budgetCap, group, countryPreference, themes }) +
        (discoveryContext.searchQuery && norm(`${destination.name} ${destination.city} ${destination.description} ${(destination.tags || []).join(" ")}`).includes(norm(discoveryContext.searchQuery)) ? 24 : 0) +
        ((discoveryContext.selectedInterests || []).some((interest: string) => norm(`${destination.type} ${destination.description} ${(destination.tags || []).join(" ")} ${(destination.interests || []).join(" ")}`).includes(norm(interest))) ? 18 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.destination.rating - a.destination.rating)
    .slice(0, 6)
  const rankedResults = ranked.length
    ? ranked
    : destinations
        .map((destination) => ({
          destination,
          score: scoreRecommendationFit(destination, { query: discoveryTranscript || query, budgetCap, group, countryPreference, themes }),
        }))
        .sort((a, b) => b.score - a.score || b.destination.rating - a.destination.rating)
        .slice(0, 6)

  const cards: DestinationRecommendationCard[] = rankedResults.map(({ destination }) => ({
    id: destination.id,
    name: destination.name,
    city: destination.city,
    state: destination.state,
    country: destination.country,
    image: destination.image,
    imageQuery: [destination.name, destination.city, destination.state, destination.country, destination.category || destination.type].filter(Boolean).join(" "),
    description: destination.description,
    bestTime: destination.bestTimeToVisit || destination.bestTime,
    budget: destination.budget,
    tags: (destination.tags || destination.interests || []).slice(0, 4),
    whyThisMatches: buildDestinationMatchReason(destination, { budgetCap, group, themes }),
    highlights: buildDestinationHighlights(destination, { budgetCap, group }),
    suggestedDuration: buildSuggestedDuration(destination, { group }),
  }))

  const introCountry = countryPreference || (discoveryContext.selectedRegion !== "All Regions" ? discoveryContext.selectedRegion : "your chosen region")
  const budgetText = budgetCap ? `around ${formatCurrency(budgetCap, DEFAULT_CURRENCY)}` : "your budget"
  const groupText =
    group === "family" ? "for a family trip" :
    group === "couple" ? "for a couple-friendly getaway" :
    group === "friends" ? "for a friends trip" :
    group === "solo" ? "for a solo trip" :
    "for this trip"

  return {
    title: `Recommended places in ${introCountry}`,
    introText: `Based on ${groupText} in ${introCountry} with ${budgetText}, here are some strong destination options that balance travel value, comfort, and sightseeing appeal.`,
    reason:
      discoveryContext.activeFiltersCount > 0
        ? "I used your active Destinations filters and selected-place context to narrow these recommendations before ranking them."
        : "I prioritized places that fit the likely pace, budget comfort, and travel style implied by your request instead of asking more questions first.",
    cards,
    filterChips: [
      group === "family" ? "Family-friendly" : "Best value",
      budgetCap && budgetCap <= 50000 ? "Under ₹50k" : "Under ₹1 lakh",
      discoveryContext.selectedType !== "All Types" ? discoveryContext.selectedType : "Hill stations",
      discoveryContext.unescoOnly ? "UNESCO places" : "Beach places",
      discoveryContext.selectedInterests?.[0] ? `${discoveryContext.selectedInterests[0]} focus` : "Cultural cities",
      discoveryContext.selectedRegion !== "All Regions" ? discoveryContext.selectedRegion : "Nature escapes",
    ],
    followUpQuestion:
      group === "family"
        ? "Would you prefer hill stations, beaches, or cultural cities for this family trip?"
        : "Would you like hill stations, beaches, cultural cities, or more budget-friendly picks next?",
    summaryBadge: budgetCap ? `${formatCurrency(budgetCap, DEFAULT_CURRENCY)} planning range` : undefined,
  } satisfies DestinationRecommendationPayload
}

function renderDestinationDiscoveryReply(payload: DestinationRecommendationPayload) {
  return [
    `**Quick answer**`,
    payload.introText,
    "",
    `**Best destination fits**`,
    ...payload.cards.map((card) => `- **${card.name}**: ${card.whyThisMatches}. ${card.highlights.join(", ")}.`),
    "",
    `**Next step**`,
    payload.followUpQuestion,
  ].join("\n")
}

function renderFlightSearchReply(payload: FlightSearchPayload) {
  return [
    `**Quick answer**`,
    payload.introText,
    "",
    `**Recommended flights**`,
    ...payload.cards.map((card) => `- **${card.airline}** ${card.route.originCode} -> ${card.route.destinationCode} | ${card.departureTime} - ${card.arrivalTime} | ${card.duration} | ${formatCurrency(card.price, card.currency)}. ${card.explanation}`),
    "",
    `**Next step**`,
    `Select a flight below to compare it, save it, or move straight to booking.`,
  ].join("\n")
}

function findMentionedDestinations(text: string, existing: any[]) {
  const picked = new Map(existing.map((item: any) => [item.id, item]))
  const normalizedText = norm(text)
  const regionalMatch = extractDestinationAnchorPhrases(text)
    .map((phrase) => getRegionalDestinationMatch(phrase))
    .find(Boolean)

  if (regionalMatch) {
    picked.set(regionalMatch.id, regionalMatch)
  }

  for (const destination of destinations) {
    const candidates = [destination.name, destination.city].filter(Boolean).map((item) => norm(item))
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

function enrichResolvedPlace(selected: any) {
  const record = destinations.find((item) => item.id === selected?.id)
  if (!selected) return null
  if (!record) return selected

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

function getFocusedContextPlace(context: any) {
  const focusId = context?.focusDestinationId || context?.nearbyPlanner?.mainDestinationId
  if (focusId) {
    const focused = (context?.selectedDestinations || []).find((item: any) => item.id === focusId)
    if (focused) return focused
    const datasetMatch = destinations.find((item) => item.id === focusId)
    if (datasetMatch) return normalizeSelectedDestination(datasetMatch)
  }

  if ((context?.selectedDestinations || []).length === 1) return context.selectedDestinations[0]
  return null
}

function resolvePlace(query: string, context: any) {
  const normalizedQuery = norm(query)
  const focusedContextPlace = getFocusedContextPlace(context)
  const itineraryMemoryPlace = resolvePlaceFromMemory(context)
  const explicitMatches = findExplicitPlaceMentions(query)
  const contextNamedMatch = (context?.selectedDestinations || []).find((item: any) => normalizedQuery.includes(norm(item.name)))
  const regionalMatch = extractDestinationAnchorPhrases(query)
    .map((phrase) => getRegionalDestinationMatch(phrase))
    .find(Boolean)

  if (contextNamedMatch) {
    const place = enrichResolvedPlace(contextNamedMatch)
    return place ? { place, source: "context-query" as const } : { place: null, source: "none" as const }
  }

  if (explicitMatches.length === 1) {
    const place = enrichResolvedPlace(explicitMatches[0])
    return place ? { place, source: "query" as const } : { place: null, source: "none" as const }
  }

  if (regionalMatch) {
    const place = enrichResolvedPlace(regionalMatch)
    return place ? { place, source: "query" as const } : { place: null, source: "none" as const }
  }

  const extractedPhrase =
    query.match(/(?:near|around|in|at)\s+([a-zA-Z\s]+)/i)?.[1]?.trim() ||
    query.match(/(?:food|restaurants|hotels|weather|budget|flights?)\s+(?:near|for|in)\s+([a-zA-Z\s]+)/i)?.[1]?.trim() ||
    query.trim()
  const aliasTarget = PLACE_ALIASES[norm(extractedPhrase)] || PLACE_ALIASES[normalizedQuery]
  const rankedCandidates = aliasTarget ? rankDestinations(aliasTarget, 3) : rankDestinations(extractedPhrase, 3)
  const topCandidate = rankedCandidates[0]
  const secondCandidate = rankedCandidates[1]
  const candidateGap = topCandidate ? topCandidate.score - (secondCandidate?.score || 0) : 0
  const confidentQueryMatch =
    Boolean(aliasTarget) ||
    Boolean(
      topCandidate &&
      (
        topCandidate.score >= 120 ||
        (topCandidate.score >= 95 && candidateGap >= 28 && tokenizeSearchQuery(extractedPhrase).length <= 3)
      )
    )
  const selected = confidentQueryMatch && topCandidate
    ? normalizeSelectedDestination(topCandidate.destination)
    : focusedContextPlace || itineraryMemoryPlace
  const place = enrichResolvedPlace(selected)

  if (place && confidentQueryMatch) return { place, source: "query" as const }
  if (place && focusedContextPlace) return { place, source: "context" as const }
  if (place && itineraryMemoryPlace) return { place, source: "context" as const }
  return { place: null, source: "none" as const }
}

function resolveActiveFocusDestinationId(latest: string, candidates: any[], fallbackFocusId?: string, nearbyPlanner?: any) {
  const resolved = resolvePlace(latest, {
    selectedDestinations: candidates,
    focusDestinationId: fallbackFocusId,
    nearbyPlanner,
  })

  return resolved.place?.id || fallbackFocusId || nearbyPlanner?.mainDestinationId || ""
}

function buildContext(raw: any, messages: ChatMessage[], latest: string) {
  const transcript = messages.filter((message) => message.role === "user").map((message) => message.content).join(" ")
  const discoveryContext = getDiscoveryContext(raw)
  const inferredDestinations = dedupeSelectedDestinations(findMentionedDestinations(transcript, raw?.selectedDestinations || []))
  const focusDestinationId = resolveActiveFocusDestinationId(
    latest,
    inferredDestinations,
    raw?.focusDestinationId,
    raw?.nearbyPlanner
  )
  const orderedDestinations = focusDestinationId
    ? [
        ...inferredDestinations.filter((item: any) => item.id === focusDestinationId),
        ...inferredDestinations.filter((item: any) => item.id !== focusDestinationId),
      ]
    : inferredDestinations
  const inferredDuration = parseDuration(transcript, raw?.durationDays || 0)
  const inferredDates = parseDateRange(transcript, raw?.dateRange)
  const startingLocationMatch = transcript.match(/(?:traveling|travelling|flying|going|coming)?\s*from\s+([a-zA-Z][a-zA-Z\s,]{1,40})(?=\s+(?:to|for|on|next|with|budget|in)\b|[.?!,]|$)/i)
  const flightParams = parseFlightSearchParams(latest, raw || {})
  const nearbyRadiusKm = extractNearbyRadiusKm(latest || transcript, raw?.nearbyPlanner?.radiusKm || 12)
  const enrichedDates =
    !inferredDates?.from && flightParams?.departureDate
      ? { from: flightParams.departureDate, to: flightParams.departureDate }
      : inferredDates

  return {
    ...defaultTripSetupState,
    ...raw,
    focusDestinationId: focusDestinationId || raw?.focusDestinationId || raw?.nearbyPlanner?.mainDestinationId,
    selectedDestinations: orderedDestinations,
    startingLocation: startingLocationMatch?.[1]?.trim() || flightParams?.origin || raw?.startingLocation || "",
    budgetPreference: parseBudgetPreference(transcript, raw?.budgetPreference || "mid-range"),
    travelStyle: parseTravelStyle(transcript, raw?.travelStyle || "balanced"),
    travelers: parseTravelers(transcript, raw?.travelers || 1),
    dateRange: enrichedDates,
    durationDays: inferredDuration,
    discoveryContext,
    nearbyPlanner: {
      ...(raw?.nearbyPlanner || {}),
      radiusKm: nearbyRadiusKm,
    },
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

function estimateWalkingTimeLabel(place: any, hotel: any) {
  const placeLat = Number(place?.latitude)
  const placeLng = Number(place?.longitude)
  const hotelLat = Number(hotel?.latitude)
  const hotelLng = Number(hotel?.longitude)

  if (Number.isFinite(placeLat) && Number.isFinite(placeLng) && Number.isFinite(hotelLat) && Number.isFinite(hotelLng)) {
    const distanceKm = haversineDistanceKm(
      { name: place.name, latitude: placeLat, longitude: placeLng },
      { name: hotel.name, latitude: hotelLat, longitude: hotelLng }
    )

    if (distanceKm <= 2.5) return `${Math.max(5, Math.round(distanceKm * 12))} min walk`
    return `${Math.max(10, Math.round(distanceKm * 4 + 6))} min drive`
  }

  return "Easy access"
}

function buildHotelReasonTag(hotel: any, budgetPreference: string) {
  if (budgetPreference === "budget") return "Best value"
  if (budgetPreference === "luxury") return "Premium stay"
  if ((hotel?.rating || 0) >= 4.6) return "Strong overall pick"
  return "Good fit"
}

function buildHotelRecommendations(
  place: any,
  context: any,
  hotelResults: any[],
  options: { liveSnapshot?: boolean } = {}
): HotelRecommendationPayload {
  const matchedCityHotels = hotelResults.length
    ? hotelResults
    : hotels
        .filter((hotel) => norm(hotel.city) === norm(place.city))
        .sort((a, b) => b.rating - a.rating || a.price - b.price)
        .slice(0, 3)

  const hotelCards: HotelRecommendationCard[] = matchedCityHotels.slice(0, 3).map((hotel) => ({
    id: hotel.id,
    kind: "hotel",
    name: hotel.name,
    location: hotel.city,
    image: hotel.image,
    imageQuery: [hotel.name, hotel.city, place?.state, place?.country, "hotel"].filter(Boolean).join(" "),
    city: hotel.city,
    state: place?.state,
    country: place?.country,
    reason: `${hotel.hotelType || "Stay"} pick with ${hotel.amenities?.slice(0, 2).join(" and ") || "solid access"} for this trip.`,
    budgetLabel: `${formatCurrency(hotel.price, hotel.currency || DEFAULT_CURRENCY)} / night`,
    walkingTime: estimateWalkingTimeLabel(place, hotel),
    ratingLabel: hotel.rating ? `${hotel.rating}/5 rating` : undefined,
    tags: [
      buildHotelReasonTag(hotel, context?.budgetPreference || "mid-range"),
      place?.name ? `Near ${place.name}` : "Great location",
      context?.budgetPreference === "budget" ? "Budget-aware" : context?.budgetPreference === "luxury" ? "Premium" : "Mid-range",
    ],
    priceValue: hotel.price,
    currency: hotel.currency || DEFAULT_CURRENCY,
    sourceDestination: hotel.destination,
  }))

  const areaCards: HotelRecommendationCard[] = (CURATED_STAY_AREAS[norm(place?.name)] || []).map((area) => ({
    ...area,
    kind: "area",
    imageQuery: [area.name, place?.name, place?.city, place?.state, place?.country, "area"].filter(Boolean).join(" "),
    city: place?.city,
    state: place?.state,
    country: place?.country,
  }))

  const cards = [...hotelCards, ...areaCards]
  const finalCards = (cards.length ? cards : buildGenericStayAreaCards(place)).slice(0, 5)
  const hasTripTiming = Boolean(context?.dateRange?.from && context?.dateRange?.to)
  const dateSummary =
    hasTripTiming
      ? "These fit your trip timing."
      : "These are strong stay options based on your destination and budget."

  return {
    title: `Stay options near ${place.name}`,
    introText: options.liveSnapshot
      ? `I found live stay options near ${place.name} that fit your trip timing.`
      : `Here are some strong stay options near ${place.name} for your trip. ${dateSummary}`,
    summaryBadge: options.liveSnapshot
      ? "Live pricing snapshot"
      : context?.budgetPreference ? `${String(context.budgetPreference).replace("-", " ")} stay focus` : undefined,
    cards: finalCards,
    responseActions: ["View stays", "Add stay to budget", "Compare stays", "Book stay"],
    followUpPrompts: ["View on map", "Build itinerary", "Estimate budget"],
  }
}

function buildMapContextPayload(
  place: any,
  nearbyPlaces: NearbyPlace[],
  hotelPayload?: HotelRecommendationPayload | null
): MapContextPayload {
  const nearbyHighlights = nearbyPlaces.slice(0, 3).map((item) => ({
    name: item.name,
    subtitle: formatNearbyTravelSummary(item),
  }))

  const hotelHighlights = (hotelPayload?.cards || []).slice(0, 2).map((item) => ({
    name: item.name,
    subtitle: item.kind === "hotel" ? `${item.budgetLabel} • ${item.walkingTime}` : `${item.location} • ${item.walkingTime}`,
  }))

  return {
    title: `Map view for ${place.name}`,
    introText: `Here is the location context for ${place.name}.`,
    areaLabel: [place.city || place.state, place.country].filter(Boolean).join(", ") || "Destination area",
    destinationName: place.name,
    locationSummary: place.description || `A strong base area around ${place.name} with easy access to nearby highlights.`,
    nearbyHighlights,
    hotelHighlights,
    responseActions: ["Open map view", "Nearby places", "Hotels on map", "Build walking plan"],
  }
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

function searchNearbyAttractions(
  place: any,
  options: {
    limit?: number
    radiusKm?: number
    categoryFilter?: string
    excludeIds?: string[]
  } = {}
): NearbyPlace[] {
  const limit = options.limit ?? 6
  const radiusKm = clampNearbyRadiusKm(options.radiusKm ?? 12)
  const categoryFilter = options.categoryFilter || ""
  const excludeIds = new Set(options.excludeIds || [])
  const curated = CURATED_NEARBY_PLACES[norm(place?.name)]
  if (curated?.length) {
    const curatedMatches = curated
      .filter((item) => !excludeIds.has(item.id))
      .filter((item) => matchesNearbyCategoryFilter(item, categoryFilter))
      .slice(0, limit)
      .map((item) => ({
        ...item,
        image: destinations.find((destination) => destination.id === item.id)?.image,
        imageQuery: [item.name, place?.name, place?.city, place?.state, place?.country, item.category || item.bestFor].filter(Boolean).join(" "),
        city: place?.city,
        state: place?.state,
        country: place?.country,
        travelTime: formatNearbyTravelSummary(item),
      }))

    if (curatedMatches.length) return curatedMatches
  }

  if (!Number.isFinite(Number(place?.latitude)) || !Number.isFinite(Number(place?.longitude))) return []

  const rankedMatches = destinations
    .filter((destination) => destination.id !== place.id)
    .map((destination) => {
      const distanceKm = haversineDistanceKm(
        { name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude) },
        { name: destination.name, latitude: Number(destination.latitude), longitude: Number(destination.longitude) }
      )
      return { destination, distanceKm }
    })
    .filter((item) => !excludeIds.has(item.destination.id))
    .filter((item) => item.distanceKm <= radiusKm || (norm(item.destination.city) === norm(place.city) && item.distanceKm <= Math.max(radiusKm, 20)))
    .filter((item) => matchesNearbyCategoryFilter({
      category: item.destination.category || item.destination.type,
      bestFor: item.destination.type,
      bestForTags: item.destination.tags || item.destination.interests || [],
      whyVisit: item.destination.description,
    }, categoryFilter))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((item) => ({
      ...buildTravelMeta(item.distanceKm),
      id: item.destination.id,
      name: item.destination.name,
      image: item.destination.image,
      imageQuery: [item.destination.name, item.destination.city, item.destination.state, item.destination.country, item.destination.category || item.destination.type].filter(Boolean).join(" "),
      city: item.destination.city,
      state: item.destination.state,
      country: item.destination.country,
      category: item.destination.category || item.destination.type,
      subtitle: [item.destination.city, item.destination.country].filter(Boolean).join(", "),
      whyVisit: item.destination.description,
      travelTime: formatNearbyTravelSummary(buildTravelMeta(item.distanceKm)),
      bestFor: item.destination.category || item.destination.type,
      bestForTags: (item.destination.tags || item.destination.interests || []).slice(0, 3),
      visitDuration: /park|museum|heritage|wildlife|fort/i.test(item.destination.type) ? "2-3 hours" : "1-2 hours",
      whyAdd:
        item.distanceKm <= 5
          ? "Great quick stop on the way."
          : item.distanceKm <= 12
            ? "Popular half-day outing from your base."
            : "Worth adding if you want a fuller day around this destination.",
    }))

  if (rankedMatches.length) return rankedMatches

  if (isBroadDestinationPlace(place)) {
    const regionalMatches = searchNearbyRegionalDestinations(place, limit)
      .filter((item) => !excludeIds.has(item.id))
      .filter((item) => matchesNearbyCategoryFilter(item, categoryFilter))
    if (regionalMatches.length) return regionalMatches
  }

  if (radiusKm < 20) {
    return searchNearbyAttractions(place, {
      ...options,
      radiusKm: 20,
    })
  }

  return []
}

function buildNearbyPlaceRecommendations(place: any, context: any, nearbyPlaces: NearbyPlace[]): NearbyPlaceRecommendationPayload {
  const radiusKm = clampNearbyRadiusKm(context?.nearbyPlanner?.radiusKm || 12)
  const categoryFilter = parseNearbyCategoryFilter(context?.latestUserMessage || "")
  const hasRegionalEscapes = nearbyPlaces.some((item) => Number(item.distanceKm || 0) >= 20)
  const nearbyCategories = ["Attractions", "Food", "Shopping", "Hidden gems"]
  const groupedHints = [
    { label: "AI picks", count: Math.min(3, nearbyPlaces.length) },
    { label: "Walkable", count: nearbyPlaces.filter((item) => item.travelMode === "walk").length },
    { label: `Within ${radiusKm} km`, count: nearbyPlaces.filter((item) => (item.distanceKm ?? 999) <= radiusKm).length },
    ...(hasRegionalEscapes ? [{ label: "Weekend-ready", count: nearbyPlaces.filter((item) => Number(item.distanceKm || 0) >= 60).length }] : []),
  ].filter((item) => item.count > 0)

  return {
    mainDestination: {
      id: place.id,
      name: place.name,
      city: place.city,
      state: place.state,
      country: place.country,
    },
    title: categoryFilter
      ? `${categoryFilter} near ${place.name}`
      : hasRegionalEscapes
        ? `Best getaways near ${place.name}`
        : `Top attractions near ${place.name}`,
    introText: hasRegionalEscapes
      ? `Here are some of the strongest short-trip escapes and nearby places around ${place.name}.`
      : `I found some great places near ${place.name} you might love.`,
    radiusKm,
    cards: nearbyPlaces,
    nearbyCategories,
    refinementFilters: nearbyCategories,
    responseActions: [
      "Add all to trip",
      "Customize selection",
      "Show more places",
      "Build itinerary",
    ],
    confirmationPrompt: hasRegionalEscapes
      ? "Would you like me to turn any of these into a weekend-friendly plan?"
      : "Would you like to add any of these to your itinerary?",
    followUpPrompts: [
      "Want a 1-day plan for these places?",
      "Need food spots nearby?",
      "Want budget estimate?",
    ],
    groupedHints,
  }
}

function renderNearbyRecommendationReply(payload: NearbyPlaceRecommendationPayload) {
  return payload.introText
}

function renderHotelRecommendationReply(payload: HotelRecommendationPayload) {
  return payload.introText
}

function renderMapContextReply(payload: MapContextPayload) {
  return payload.introText
}

function buildFoodGuide(place: any): FoodGuide {
  const key = norm(place?.name)
  const curated = FOOD_GUIDANCE[key]
  if (curated) return { placeName: place.name, ...curated }

  return {
    placeName: place.name,
    quickAnswer: `${place.name} is easiest to handle if you use the landmark for orientation, then move slightly away from the busiest strip for better value or atmosphere.`,
    localInsight: "The best travel move is usually to eat just outside the most obvious tourist-facing pocket instead of at the first visible venue.",
    localTips: [
      "Choose local specialties before defaulting to generic menus.",
      "If price matters, walk a little away from the landmark edge.",
      "Match your meal stop to your next sightseeing area so you do not waste time on transfers.",
    ],
    sections: [
      { title: "Best strategy", items: ["Start with convenience if you are short on time, then improve quality by moving one zone outward."] },
      { title: "Budget move", items: ["Lunch and simpler local spots are often better value than prime-view dinner locations."] },
      { title: "Travel-agent tip", items: ["Pick food based on your route, not just on map proximity."] },
    ],
    nextStepHint: `I can narrow this into budget food, family-friendly picks, dessert spots, or a food + walking plan around ${place.name}.`,
  }
}

function formatPlanDurationLabel(minutes?: number | null) {
  const safe = Number(minutes)
  if (!Number.isFinite(safe) || safe <= 0) return "Flexible stay"
  if (safe < 60) return `${safe} min`
  if (safe % 60 === 0) return `${safe / 60} hr`
  return `${Math.floor(safe / 60)} hr ${safe % 60} min`
}

function getPlanningEffortLabel(item: any) {
  const travelMinutes = Number(item?.travelMinutes)
  const mode = norm(item?.travelMode)
  if (Number.isFinite(travelMinutes) && travelMinutes <= 12) return "Easy stop"
  if (Number.isFinite(travelMinutes) && travelMinutes <= 24) return "Moderate walk"
  if (mode.includes("drive") || mode.includes("taxi") || mode.includes("cab")) return "Best with taxi"
  return "Longer detour"
}

function getPlanningBestTimeLabel(item: any) {
  const haystack = norm(
    `${item?.bestTime || ""} ${item?.category || ""} ${(item?.tags || []).join(" ")} ${(item?.bestForTags || []).join(" ")} ${item?.description || ""}`
  )

  if (/museum|gallery|culture|heritage|history/.test(haystack)) return "Best late morning"
  if (/food|market|shopping|night/.test(haystack)) return "Best afternoon"
  if (/view|bridge|park|nature|photo|photography|sunrise|sunset/.test(haystack)) return "Best early morning"
  return "Best mid-morning"
}

function suggestPlanningDurationMinutes(item: any) {
  const durationText = norm(item?.visitDuration || item?.duration || "")
  if (!durationText) return 60
  if (durationText.includes("30")) return 30
  if (durationText.includes("45")) return 45
  if (durationText.includes("90")) return 90
  if (durationText.includes("2 hour") || durationText.includes("120")) return 120
  if (durationText.includes("3 hour") || durationText.includes("180")) return 180
  return 60
}

function detectPlanningProfile(query: string, context: any, assistantState?: AssistantState): PlanningProfile {
  const value = norm(query)
  const itineraryMemory = getItineraryMemory(context)
  const samePlaceAsPreviousPlan =
    assistantState?.lastPlanPlaceName &&
    context?.selectedDestinations?.some((item: any) => norm(item.name) === norm(assistantState.lastPlanPlaceName))

  const previousSubtype = assistantState?.lastPlanSubtype
  const subtype: PlanningSubtype =
    /(what else can i cover|after central park|after reaching|after i visit|nearby add on|what else nearby)/.test(value) ? "nearby_add_on" :
    /(romantic|date night|date|couple)/.test(value) ? "romantic" :
    /(family|kids|kid friendly|children)/.test(value) ? "family" :
    /(budget|cheap|affordable|low cost|free)/.test(value) ? "budget" :
    /(quick|2 hour|2-hour|short stop|fast plan|short plan)/.test(value) ? "quick" :
    /(full day|full-day|whole day)/.test(value) ? "full_day" :
    /(half day|half-day)/.test(value) ? "half_day" :
    /(evening|tonight|sunset|night)/.test(value) ? "evening" :
    /(morning|sunrise|early)/.test(value) ? "morning" :
    itineraryMemory.timeWindow === "evening" ? "evening" :
    itineraryMemory.timeWindow === "morning" ? "morning" :
    itineraryMemory.timeWindow === "half_day" ? "half_day" :
    itineraryMemory.timeWindow === "full_day" ? "full_day" :
    itineraryMemory.timeWindow === "quick" ? "quick" :
    itineraryMemory.preferences?.familyFriendly ? "family" :
    itineraryMemory.preferences?.romantic ? "romantic" :
    itineraryMemory.preferences?.budgetFriendly ? "budget" :
    "general"

  const labelMap: Record<PlanningSubtype, string> = {
    general: "General itinerary",
    evening: "Evening plan",
    morning: "Morning plan",
    half_day: "Half-day plan",
    full_day: "Full-day plan",
    romantic: "Romantic plan",
    family: "Family-friendly plan",
    budget: "Budget plan",
    quick: "Quick plan",
    nearby_add_on: "Nearby add-on plan",
  }

  const durationHours =
    subtype === "quick" ? 2
    : subtype === "evening" || subtype === "morning" || subtype === "romantic" || subtype === "nearby_add_on" ? 3
    : subtype === "half_day" || subtype === "family" || subtype === "budget" ? 4
    : subtype === "full_day" ? 8
    : 5

  const profile: PlanningProfile = {
    subtype,
    label: labelMap[subtype],
    durationHours,
    pace:
      subtype === "family" || subtype === "romantic" ? "relaxed"
      : subtype === "quick" || subtype === "nearby_add_on" ? "efficient"
      : subtype === "evening" ? "easy"
      : "balanced",
    audience:
      subtype === "family" ? "family"
      : subtype === "romantic" ? "couple"
      : itineraryMemory.travelerType === "family" ? "family"
      : itineraryMemory.travelerType === "couple" ? "couple"
      : parseTripGroup(query) === "solo" ? "solo"
      : "general",
    budgetMode: subtype === "budget" ? "budget" : "standard",
    timeOfDay:
      subtype === "evening" || subtype === "romantic" ? "evening"
      : subtype === "morning" ? "morning"
      : undefined,
    wantsFoodStop:
      /(dinner|food|dessert|snack|lunch|brunch)/.test(value) ||
      subtype === "evening" ||
      subtype === "romantic" ||
      subtype === "family" ||
      Boolean(
        itineraryMemory.preferences?.snackStop ||
        itineraryMemory.preferences?.lunchStop ||
        itineraryMemory.preferences?.dinnerStop
      ),
    wantsIndoorBackup: /(indoor|rain|weather)/.test(value) || Boolean(itineraryMemory.preferences?.indoorBackup),
    refinementNote:
      samePlaceAsPreviousPlan && previousSubtype && previousSubtype !== subtype
        ? `Here's a more ${labelMap[subtype].toLowerCase()} version of your previous ${labelMap[previousSubtype].toLowerCase()}.`
        : undefined,
  }

  return profile
}

function buildPlanningCandidateHaystack(item: NearbyPlace) {
  return norm([
    item.name,
    item.category,
    item.bestFor,
    ...(item.bestForTags || []),
    item.subtitle,
    item.whyVisit,
    item.whyAdd,
  ].filter(Boolean).join(" "))
}

function scorePlanningCandidate(item: NearbyPlace, profile: PlanningProfile, previousStopIds: string[] = [], itineraryMemory?: ItineraryMemory) {
  const haystack = buildPlanningCandidateHaystack(item)
  const distanceScore = Number.isFinite(Number(item.distanceKm)) ? Math.max(0, 30 - Number(item.distanceKm) * 2.2) : 8
  const easyWalkScore = Number.isFinite(Number(item.travelMinutes)) ? Math.max(0, 20 - Number(item.travelMinutes)) : 6
  let score = distanceScore + easyWalkScore

  if (/landmark|iconic|bridge|terrace|castle|museum|view/.test(haystack)) score += 14
  if (/park|nature|photography|scenic|view|lake|bridge|sunset/.test(haystack)) score += profile.subtype === "evening" || profile.subtype === "romantic" || profile.subtype === "morning" ? 18 : 6
  if (/museum|culture|history|heritage/.test(haystack)) score += profile.subtype === "full_day" || profile.subtype === "general" ? 14 : -2
  if (/food|cafe|dessert|restaurant|market/.test(haystack)) score += profile.wantsFoodStop ? 16 : 2
  if (/family|kids|zoo|carousel|play/.test(haystack)) score += profile.subtype === "family" ? 22 : 0
  if (/quiet|romantic|scenic|lake|bridge/.test(haystack)) score += profile.subtype === "romantic" ? 22 : 0
  if (/budget|free|public|walk/.test(haystack)) score += profile.subtype === "budget" ? 18 : 0
  if (/night|lights|evening/.test(haystack)) score += profile.subtype === "evening" ? 16 : 0
  if (/sunrise|morning/.test(haystack)) score += profile.subtype === "morning" ? 16 : 0
  if (profile.subtype === "quick" || profile.subtype === "nearby_add_on") score += easyWalkScore * 0.8
  if (profile.subtype === "full_day" && suggestPlanningDurationMinutes(item) >= 90) score += 10
  if ((profile.subtype === "quick" || profile.subtype === "family") && suggestPlanningDurationMinutes(item) >= 120) score -= 10
  if (profile.subtype === "budget" && /museum/.test(haystack)) score -= 6
  if (itineraryMemory?.walkingTolerance === "low") {
    score += easyWalkScore * 1.25
    if (Number(item.travelMinutes || 0) > 20) score -= 18
  }
  if (itineraryMemory?.preferences?.nearbyMuseum && /museum|gallery|history|heritage/.test(haystack)) score += 24
  if (itineraryMemory?.preferences?.kidFriendlyStop && /family|kids|zoo|aquarium|garden|play|science/.test(haystack)) score += 26
  if ((itineraryMemory?.preferences?.snackStop || itineraryMemory?.preferences?.lunchStop || itineraryMemory?.preferences?.dinnerStop) && /food|cafe|dessert|market|restaurant/.test(haystack)) score += 24
  if (itineraryMemory?.preferences?.indoorBackup && /museum|gallery|indoor|shopping/.test(haystack)) score += 18
  if (itineraryMemory?.preferences?.iconicStop && /landmark|iconic|fort|bridge|view|palace/.test(haystack)) score += 20
  if (previousStopIds.includes(item.id)) score -= profile.subtype === "general" ? 6 : 16

  return score
}

function buildPreferenceChangeSummary(place: any, profile: PlanningProfile, itineraryMemory?: ItineraryMemory) {
  const changes: string[] = []
  if (profile.subtype === "family" || itineraryMemory?.preferences?.familyFriendly) changes.push("more family-friendly")
  if (itineraryMemory?.walkingTolerance === "low") changes.push("lower walking")
  if (profile.subtype === "evening") changes.push("an evening flow")
  if (profile.subtype === "budget" || itineraryMemory?.preferences?.budgetFriendly) changes.push("more budget-friendly")
  if (itineraryMemory?.preferences?.nearbyMuseum) changes.push("a nearby museum stop")
  if (itineraryMemory?.preferences?.kidFriendlyStop) changes.push("a kid-friendly stop")
  if (itineraryMemory?.preferences?.snackStop) changes.push("a snack break")
  if (itineraryMemory?.preferences?.lunchStop) changes.push("a lunch break")
  if (itineraryMemory?.preferences?.dinnerStop) changes.push("a dinner stop")
  if (itineraryMemory?.preferences?.indoorBackup) changes.push("an indoor backup")
  if (itineraryMemory?.preferences?.iconicStop) changes.push("an iconic stop")

  const uniqueChanges = Array.from(new Set(changes))
  if (!uniqueChanges.length) return ""
  if (uniqueChanges.length === 1) return `Updated for ${uniqueChanges[0]}.`
  if (uniqueChanges.length === 2) return `Updated for ${uniqueChanges[0]} and ${uniqueChanges[1]}.`
  return `Updated for ${uniqueChanges.slice(0, -1).join(", ")}, and ${uniqueChanges.at(-1)}.`
}

function getPlanStopCount(profile: PlanningProfile) {
  if (profile.subtype === "quick" || profile.subtype === "nearby_add_on") return 2
  if (profile.subtype === "evening" || profile.subtype === "morning" || profile.subtype === "romantic") return 3
  if (profile.subtype === "full_day") return 5
  if (profile.subtype === "family" || profile.subtype === "budget" || profile.subtype === "half_day") return 4
  return 4
}

function getPlanTimingLabel(profile: PlanningProfile, index: number, total: number) {
  if (profile.subtype === "evening" || profile.subtype === "romantic") {
    return index === 0 ? "Golden hour" : index === total - 1 ? "Wrap up" : "After that"
  }
  if (profile.subtype === "morning") {
    return index === 0 ? "Start fresh" : index === total - 1 ? "Late morning" : "Next"
  }
  if (profile.subtype === "quick" || profile.subtype === "nearby_add_on") {
    return index === 0 ? "First stop" : "Then"
  }
  if (profile.subtype === "family") {
    return index === 0 ? "Easy start" : index === total - 1 ? "Finish gently" : "Then"
  }
  return index === 0 ? "Start" : index === total - 1 ? "Finish" : "Then"
}

function buildPlanTitle(place: any, profile: PlanningProfile) {
  if (profile.subtype === "general") return `${place.name} mini-plan`
  if (profile.subtype === "evening") return `${place.name} evening plan`
  if (profile.subtype === "morning") return `${place.name} morning plan`
  if (profile.subtype === "half_day") return `${place.name} half-day route`
  if (profile.subtype === "full_day") return `${place.name} full-day route`
  if (profile.subtype === "romantic") return `${place.name} romantic route`
  if (profile.subtype === "family") return `${place.name} family-friendly route`
  if (profile.subtype === "budget") return `${place.name} budget route`
  if (profile.subtype === "quick") return `${place.name} quick 2-hour plan`
  return `What to cover after ${place.name}`
}

function buildPlanSummary(place: any, profile: PlanningProfile) {
  if (profile.refinementNote) return profile.refinementNote
  if (profile.subtype === "evening") return `A relaxed evening route around ${place.name} built for atmosphere, lighter pacing, and an easy finish to the day.`
  if (profile.subtype === "morning") return `A fresh morning route around ${place.name} with quieter stops, easy flow, and good early-day energy.`
  if (profile.subtype === "half_day") return `A practical half-day route around ${place.name} with enough variety without turning into a full-day push.`
  if (profile.subtype === "full_day") return `A fuller day plan around ${place.name} with longer stops, stronger variety, and room for a break.`
  if (profile.subtype === "romantic") return `A scenic, slower-paced route around ${place.name} that works well for views, atmosphere, and a softer finish.`
  if (profile.subtype === "family") return `An easy-paced route around ${place.name} with comfortable walking and memorable stops that work better for families.`
  if (profile.subtype === "budget") return `A value-aware route around ${place.name} focused on high-impact stops without pushing expensive add-ons.`
  if (profile.subtype === "quick") return `A short, high-impact route around ${place.name} for when you only have a couple of hours.`
  if (profile.subtype === "nearby_add_on") return `A short add-on route that works well after ${place.name} if you still want to cover one or two strong nearby stops.`
  return `A balanced first-visit route around ${place.name} with iconic stops and practical pacing.`
}

function buildWhyThisPlanFits(profile: PlanningProfile) {
  if (profile.subtype === "evening") return "This plan fits the evening best because it leans into scenic, lower-effort stops and leaves room for dinner or dessert nearby."
  if (profile.subtype === "morning") return "This plan works well in the morning because it prioritizes calmer, walkable stops before the area gets busier."
  if (profile.subtype === "full_day") return "This plan fits a full day because it mixes longer anchor stops with enough variety to keep the route interesting."
  if (profile.subtype === "romantic") return "This plan fits a romantic outing because it focuses on scenic viewpoints, quieter pacing, and a softer finish."
  if (profile.subtype === "family") return "This plan fits families because it keeps the walking more manageable and avoids a rushed sequence."
  if (profile.subtype === "budget") return "This plan fits a budget-minded visit because it favors high-value, lower-cost stops and keeps the route practical."
  if (profile.subtype === "quick") return "This plan fits a short visit because it keeps the stop count tight and focuses on the strongest low-effort highlights."
  if (profile.subtype === "nearby_add_on") return "This plan fits as an add-on because it only adds nearby, easy-to-layer stops after your main destination."
  return "This plan fits a general visit because it balances iconic highlights, practical order, and a comfortable sightseeing pace."
}

function buildPlanAddOnSuggestion(place: any, profile: PlanningProfile) {
  if (profile.subtype === "evening" || profile.subtype === "romantic") return `Add a dinner or dessert stop near ${place.name} to round this out naturally.`
  if (profile.subtype === "family") return `Add a snack or short rest stop if you want to keep the pace lighter.`
  if (profile.subtype === "full_day") return `Add one indoor backup stop in case you want a weather-safe middle block.`
  if (profile.subtype === "budget") return `Keep the route value-friendly by pairing it with a casual food stop instead of a premium add-on.`
  if (profile.subtype === "quick") return `If you get more time, the easiest extension is one food or museum stop nearby.`
  return `If you want, I can refine this into an evening, family-friendly, romantic, or lower-walking version.`
}

function mapDestinationToPlanningCandidate(destination: any, anchorPlace: any): NearbyPlace {
  const anchorLat = Number(anchorPlace?.latitude)
  const anchorLng = Number(anchorPlace?.longitude)
  const itemLat = Number(destination?.latitude)
  const itemLng = Number(destination?.longitude)
  const distanceKm =
    Number.isFinite(anchorLat) && Number.isFinite(anchorLng) && Number.isFinite(itemLat) && Number.isFinite(itemLng)
      ? haversineDistanceKm(
          { name: anchorPlace.name, latitude: anchorLat, longitude: anchorLng },
          { name: destination.name, latitude: itemLat, longitude: itemLng }
        )
      : 4
  const travelMeta = buildTravelMeta(Math.max(1.2, Math.min(distanceKm, 24)))

  return {
    id: destination.id,
    name: destination.name,
    image: destination.image,
    imageQuery: [destination.name, destination.city, destination.state, destination.country, destination.category || destination.type].filter(Boolean).join(" "),
    city: destination.city,
    state: destination.state,
    country: destination.country,
    category: destination.category || destination.type,
    subtitle: [destination.city, destination.state].filter(Boolean).join(", "),
    whyVisit: destination.description,
    travelTime: formatNearbyTravelSummary(travelMeta),
    distanceKm: travelMeta.distanceKm,
    travelMinutes: travelMeta.travelMinutes,
    travelMode: travelMeta.travelMode,
    bestFor: destination.category || destination.type,
    bestForTags: (destination.tags || destination.interests || []).slice(0, 3),
    visitDuration: /fort|heritage|museum|church|market|wildlife|waterfall/i.test(`${destination.category || ""} ${destination.type || ""} ${destination.description || ""}`)
      ? "2-3 hours"
      : "1-2 hours",
    whyAdd: `A strong ${anchorPlace.name} stop if you want a more practical day flow without leaving the destination context.`,
  }
}

function searchPlanningCandidates(place: any, profile: PlanningProfile, context: any) {
  const curated = CURATED_NEARBY_PLACES[norm(place?.name)]
  if (curated?.length) {
    return curated.map((item) => ({
      ...item,
      imageQuery: [item.name, place?.name, place?.city, place?.state, place?.country, item.category || item.bestFor].filter(Boolean).join(" "),
      city: item.city || place?.city,
      state: item.state || place?.state,
      country: item.country || place?.country,
      travelTime: item.travelTime || formatNearbyTravelSummary(item),
    }))
  }

  if (Array.isArray(place?.planningCandidates) && place.planningCandidates.length) {
    return place.planningCandidates.map((item: any) => mapDestinationToPlanningCandidate(item, place))
  }

  if (Number.isFinite(Number(place?.latitude)) && Number.isFinite(Number(place?.longitude))) {
    const localMatches = destinations
      .filter((destination) => destination.id !== place.id)
      .map((destination) => ({
        destination,
        distanceKm: haversineDistanceKm(
          { name: place.name, latitude: Number(place.latitude), longitude: Number(place.longitude) },
          { name: destination.name, latitude: Number(destination.latitude), longitude: Number(destination.longitude) }
        ),
      }))
      .filter((item) => item.distanceKm <= 28 || norm(item.destination.city) === norm(place.city))
      .sort((left, right) => left.distanceKm - right.distanceKm || right.destination.rating - left.destination.rating)
      .slice(0, Math.max(8, (context?.durationDays || 1) * 3))
      .map((item) => mapDestinationToPlanningCandidate(item.destination, place))

    if (localMatches.length) return localMatches
  }

  const stateMatches = destinations
    .filter((destination) => destination.id !== place.id)
    .filter((destination) => norm(destination.state) === norm(place.state || place.name))
    .slice(0, 8)
    .map((destination) => mapDestinationToPlanningCandidate(destination, place))

  if (stateMatches.length) return stateMatches

  return searchNearbyAttractions(place, {
    limit: Math.max(6, getPlanStopCount(profile) + 2),
    radiusKm: 18,
  })
}

function buildGenericItineraryBlock(place: any, profile: PlanningProfile, dayNumber: number, timing: string) {
  const descriptor = norm(`${place?.category || ""} ${place?.type || ""} ${place?.description || ""} ${(place?.interests || []).join(" ")}`)

  if (timing === "Morning") {
    return {
      timing,
      title: /beach|coast|island/.test(descriptor) ? "Slow beachside start" : "Start with the core sights",
      detail: /beach|coast|island/.test(descriptor)
        ? `Begin day ${dayNumber} with a slower coastal stretch so the rest of the ${place.name} plan stays easy and balanced.`
        : `Use the morning for the signature part of ${place.name} while the pace and weather are usually better.`,
      duration: "1-2 hours",
      note: "Best early",
      tag: profile.pace === "relaxed" ? "Easy pace" : "Best first stop",
    }
  }

  if (timing === "Afternoon") {
    return {
      timing,
      title: /heritage|history|fort|church|museum/.test(descriptor) ? "Culture and local lunch" : "Main sightseeing block",
      detail: /heritage|history|fort|church|museum/.test(descriptor)
        ? `Keep the afternoon for one of ${place.name}'s stronger culture or heritage anchors, with lunch nearby to avoid extra transfers.`
        : `Use the middle of the day for the most substantial sightseeing block, then keep the route compact.`,
      duration: "2 hours",
      note: "Best mid-day",
      tag: "Core visit",
    }
  }

  return {
    timing,
    title: /nightlife|beach|food/.test(descriptor) ? "Sunset and dinner wrap-up" : "Relaxed evening finish",
    detail: /nightlife|beach|food/.test(descriptor)
      ? `Finish with a sunset-facing or food-led stop so the ${place.name} itinerary feels complete without becoming rushed.`
      : `Leave room for a lighter walk, market stop, or café so the day ends cleanly.`,
    duration: "1-2 hours",
    note: "Best toward sunset",
    tag: "Evening close",
  }
}

function buildMultiDayMiniPlan(place: any, profile: PlanningProfile, context: any, assistantState?: AssistantState): MiniPlan | null {
  const requestedDays = Math.min(5, Math.max(2, parseDuration(context?.latestUserMessage || "", context?.durationDays || 0)))
  if (requestedDays < 2) return null

  const itineraryMemory = getItineraryMemory(context)
  const previousStopIds =
    assistantState?.lastPlanPlaceName && norm(assistantState.lastPlanPlaceName) === norm(place.name)
      ? assistantState?.lastPlanStopIds || []
      : []
  const rankedCandidates = searchPlanningCandidates(place, profile, context)
    .map((item: NearbyPlace) => ({
      item,
      score: scorePlanningCandidate(item, profile, previousStopIds, itineraryMemory),
    }))
    .sort((left: { item: NearbyPlace; score: number }, right: { item: NearbyPlace; score: number }) => right.score - left.score || (left.item.distanceKm || 999) - (right.item.distanceKm || 999))

  const usedIds = new Set<string>()
  const timings = ["Morning", "Afternoon", "Evening"]
  const days = Array.from({ length: requestedDays }, (_, index) => ({
    dayNumber: index + 1,
    title: index === 0 ? `Arrival and core ${place.name} highlights` : `More of ${place.name} at an easy pace`,
    summary:
      index === 0
        ? `This day focuses on the easiest high-value stops so you get a clean start in ${place.name}.`
        : `This day layers in a few more local highlights without making the route feel rushed.`,
    blocks: timings.map((timing) => {
      const nextCandidate = rankedCandidates.find((entry: { item: NearbyPlace; score: number }) => !usedIds.has(entry.item.id))
      if (nextCandidate) {
        usedIds.add(nextCandidate.item.id)
        return {
          id: nextCandidate.item.id,
          timing,
          title: nextCandidate.item.name,
          detail:
            timing === "Morning"
              ? `${nextCandidate.item.whyVisit} Start here so the day's route stays smoother.`
              : timing === "Afternoon"
                ? `${nextCandidate.item.whyVisit} This fits well in the middle of the day with ${nextCandidate.item.travelTime?.toLowerCase() || "easy transfers"}.`
                : `${nextCandidate.item.whyVisit} It works well as a lighter close to the day.`,
          duration: nextCandidate.item.visitDuration,
          note: nextCandidate.item.travelTime,
          tag: getPlanningEffortLabel(nextCandidate.item),
        }
      }

      return buildGenericItineraryBlock(place, profile, index + 1, timing)
    }),
  }))

  return {
    title: `${requestedDays}-day ${place.name} itinerary`,
    summary: `Here’s a balanced ${requestedDays}-day plan for ${place.name}, built to stay focused on this destination instead of drifting into broad discovery.`,
    subtitle: `${requestedDays} days · ${profile.pace} pace`,
    whyThisFits: buildWhyThisPlanFits(profile),
    addOnSuggestion: buildPlanAddOnSuggestion(place, profile),
    changeSummary: buildPreferenceChangeSummary(place, profile, itineraryMemory),
    subtype: profile.subtype,
    routeStyle: getPlanningTheme(profile),
    durationLabel: `${requestedDays} days`,
    durationDays: requestedDays,
    days,
    stops: [],
  }
}

function getPlanningTheme(profile: PlanningProfile) {
  if (profile.subtype === "evening") return "evening"
  if (profile.subtype === "romantic") return "romantic"
  if (profile.subtype === "family") return "family"
  if (profile.subtype === "budget") return "budget"
  if (profile.subtype === "quick" || profile.subtype === "nearby_add_on") return "quick"
  return "general"
}

function buildPlanningStops(place: any, candidates: NearbyPlace[], profile: PlanningProfile) {
  const total = candidates.length

  return candidates.map((item, index) => ({
    id: item.id,
    timing: getPlanTimingLabel(profile, index, total),
    title: item.name,
    detail:
      profile.subtype === "evening"
        ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} Works well as the light softens and the pace relaxes.`
        : profile.subtype === "morning"
          ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} A strong early stop before the area gets busier.`
          : profile.subtype === "family"
            ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} This keeps the route easier and more family-friendly.`
            : profile.subtype === "romantic"
              ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} It adds atmosphere and a calmer scenic moment to the route.`
              : profile.subtype === "budget"
                ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} It adds value without making the route feel expensive or heavy.`
                : profile.subtype === "quick" || profile.subtype === "nearby_add_on"
                  ? `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""} High impact with lower effort, so it works well in a shorter window.`
                  : `${item.whyVisit}${item.travelTime ? ` ${item.travelTime}.` : ""}`,
    duration: item.visitDuration || formatPlanDurationLabel(suggestPlanningDurationMinutes(item)),
    note: getPlanningBestTimeLabel(item),
    tag: getPlanningEffortLabel(item),
  }))
}

function applyPreferenceStops(
  baseStops: MiniPlan["stops"] = [],
  place: any,
  rankedCandidates: NearbyPlace[],
  profile: PlanningProfile,
  itineraryMemory?: ItineraryMemory
) {
  const nextStops = [...baseStops]

  const insertRankedStop = (
    test: RegExp,
    createDetail: (title: string) => string,
    preferredIndex: number
  ) => {
    const candidate = rankedCandidates.find((item) => test.test(buildPlanningCandidateHaystack(item)) && !nextStops.some((stop) => stop.id === item.id))
    if (!candidate) return
    nextStops.splice(Math.min(preferredIndex, nextStops.length), 0, {
      id: candidate.id,
      timing: preferredIndex <= 1 ? "Then" : "After that",
      title: candidate.name,
      detail: createDetail(candidate.name),
      duration: candidate.visitDuration || formatPlanDurationLabel(suggestPlanningDurationMinutes(candidate)),
      note: getPlanningBestTimeLabel(candidate),
      tag: getPlanningEffortLabel(candidate),
    })
  }

  if (itineraryMemory?.preferences?.nearbyMuseum) {
    insertRankedStop(
      /museum|gallery|history|heritage/,
      (title) => `${title} adds a cultural indoor stop without breaking the flow of your ${place.name} route.`,
      Math.min(1, nextStops.length)
    )
  }

  if (itineraryMemory?.preferences?.kidFriendlyStop) {
    insertRankedStop(
      /family|kids|zoo|aquarium|garden|play|science/,
      (title) => `${title} gives the route a more kid-friendly break while keeping the pace manageable.`,
      Math.min(1, nextStops.length)
    )
  }

  const mealLabel =
    itineraryMemory?.preferences?.dinnerStop ? "Dinner stop" :
    itineraryMemory?.preferences?.lunchStop ? "Lunch break" :
    itineraryMemory?.preferences?.snackStop ? "Snack break" :
    ""
  if (mealLabel && !nextStops.some((stop) => /snack break|lunch break|dinner stop/i.test(stop.title))) {
    const insertAt = Math.min(Math.max(1, Math.floor(nextStops.length / 2)), nextStops.length)
    nextStops.splice(insertAt, 0, {
      id: `meal-stop-${norm(place?.name)}-${norm(mealLabel)}`,
      timing: "Pause",
      title: mealLabel,
      detail:
        profile.subtype === "family"
          ? `I placed a ${mealLabel.toLowerCase()} near the middle of the route so the plan stays easier for families and lower-energy travelers.`
          : `I added a ${mealLabel.toLowerCase()} between nearby stops so the route feels more comfortable and less rushed.`,
      duration: "30-45 min",
      note: profile.subtype === "evening" ? "Best after your second stop" : "Best mid-route",
      tag: itineraryMemory?.walkingTolerance === "low" ? "Easy reset" : "Comfort stop",
    })
  }

  if (itineraryMemory?.walkingTolerance === "low" && nextStops.length > 4) {
    return nextStops.slice(0, 4).map((stop) => ({
      ...stop,
      tag: stop.tag === "Moderate walk" || stop.tag === "Longer detour" ? "Easy stop" : stop.tag,
    }))
  }

  return nextStops
}

function buildMiniPlan(intent: Intent, place: any, foodGuide?: FoodGuide | null, options?: {
  query?: string
  context?: any
  assistantState?: AssistantState
}): MiniPlan | null {
  if (!place) return null

  if (intent === "nearby_food") {
    return {
      title: `${place.name} food mini-plan`,
      summary: "A simple traveler-friendly sequence so you can eat well without overthinking the area.",
      stops: [
        { timing: "Start", title: "Use the landmark as your anchor", detail: `Begin around ${place.name}, but do not commit to the first obvious tourist-facing option.` },
        { timing: "Next", title: "Move toward the better food zone", detail: foodGuide?.localInsight || "Walk a little away from the busiest strip for stronger value and atmosphere." },
        { timing: "Finish", title: "Pair food with one nearby stop", detail: "Add dessert, a short walk, or an evening attraction so the meal fits naturally into your outing." },
      ],
    }
  }

  if (intent === "planning_guidance" || intent === "nearby_places") {
    const profile = detectPlanningProfile(options?.query || "", options?.context || {}, options?.assistantState)
    const multiDayPlan = intent === "planning_guidance" ? buildMultiDayMiniPlan(place, profile, options?.context || {}, options?.assistantState) : null
    if (multiDayPlan) return multiDayPlan
    const itineraryMemory = getItineraryMemory(options?.context || {})
    const previousStopIds =
      options?.assistantState?.lastPlanPlaceName && norm(options.assistantState.lastPlanPlaceName) === norm(place.name)
        ? options?.assistantState?.lastPlanStopIds || []
        : []
    const rankedCandidates = searchPlanningCandidates(place, profile, options?.context || {})
      .map((item: NearbyPlace) => ({
        item,
        score: scorePlanningCandidate(item, profile, previousStopIds, itineraryMemory),
      }))
      .sort((left: { item: NearbyPlace; score: number }, right: { item: NearbyPlace; score: number }) => right.score - left.score || (left.item.distanceKm || 999) - (right.item.distanceKm || 999))

    const chosenCandidates = rankedCandidates
      .slice(0, Math.max(getPlanStopCount(profile) + 2, 5))
      .filter((entry: { item: NearbyPlace; score: number }, index: number, list: Array<{ item: NearbyPlace; score: number }>) =>
        index < getPlanStopCount(profile) ||
        !list.slice(0, getPlanStopCount(profile)).some((picked: { item: NearbyPlace; score: number }) => picked.item.id === entry.item.id)
      )
      .slice(0, getPlanStopCount(profile))
      .map((entry: { item: NearbyPlace; score: number }) => entry.item)

    const reorderedCandidates =
      profile.subtype === "evening" || profile.subtype === "romantic"
        ? [...chosenCandidates].sort((left, right) => Number(left.distanceKm || 0) - Number(right.distanceKm || 0)).reverse()
        : chosenCandidates
    const planStops = applyPreferenceStops(
      buildPlanningStops(place, reorderedCandidates, profile),
      place,
      rankedCandidates.map((entry: { item: NearbyPlace; score: number }) => entry.item),
      profile,
      itineraryMemory
    )
    const changeSummary = buildPreferenceChangeSummary(place, profile, itineraryMemory)

    return {
      title: buildPlanTitle(place, profile),
      summary: buildPlanSummary(place, profile),
      subtitle: `${profile.label} · ${profile.durationHours} hour${profile.durationHours === 1 ? "" : "s"} · ${profile.pace} pace`,
      whyThisFits: buildWhyThisPlanFits(profile),
      addOnSuggestion: buildPlanAddOnSuggestion(place, profile),
      changeSummary,
      subtype: profile.subtype,
      routeStyle: getPlanningTheme(profile),
      durationLabel: `${profile.durationHours} hour${profile.durationHours === 1 ? "" : "s"}`,
      stops: planStops,
      days: [],
    }
  }

  return null
}

function buildActions(intent: Intent, focusName?: string, hasNearbySelection = false, planningProfile?: PlanningProfile, itineraryMemory?: ItineraryMemory) {
  if (intent === "nearby_food") {
    return [
      focusName ? `Budget food near ${focusName}` : "Budget food nearby",
      focusName ? `Best dessert spots near ${focusName}` : "Best dessert spots nearby",
      focusName ? `Family-friendly restaurants near ${focusName}` : "Family-friendly restaurants nearby",
      focusName ? `Late-night food near ${focusName}` : "Late-night food nearby",
      focusName ? `Food + walking plan near ${focusName}` : "Food + walking plan",
      focusName ? `Hotels near ${focusName}` : "Hotels nearby",
    ]
  }
  if (intent === "nearby_places") {
    return hasNearbySelection
      ? ["Add all to trip", "Build itinerary", "Show more places"]
      : ["Add all to trip", "Customize selection", "Show more places", "Build itinerary"]
  }
  if (intent === "weather_guidance" || intent === "best_time_guidance") return ["Best Time to Visit", "Indoor places nearby", "Find Hotels", "Modify dates"]
  if (intent === "budget_estimation") return ["View budget breakdown", "Find cheaper hotels", "Check flights", "Build itinerary"]
  if (intent === "hotel_guidance") return ["View stays", "Add stay to budget", "Compare stays", "Book stay"]
  if (intent === "flight_search") return ["Book ticket", "Compare options", "Cheapest flights", "Fastest route"]
  if (intent === "support_handoff") return ["Copy support summary", "Open booking help", "Draft support ticket"]
  if (intent === "planning_guidance") {
    if (planningProfile?.subtype === "evening") return ["Add dinner stop", "Make it more romantic", "Shorten to 2 hours", "Add nearby dessert spot"]
    if (planningProfile?.subtype === "romantic") return ["Add dinner stop", "Make it more scenic", "Turn into evening date", "Save to trip"]
    if (planningProfile?.subtype === "family") return ["Add kid-friendly stop", "Reduce walking more", "Add lunch break", "Save to trip"]
    if (planningProfile?.subtype === "budget") return ["Reduce cost further", "Add free stop", "Find cheap food nearby", "Turn into quick plan"]
    if (planningProfile?.subtype === "quick") return ["Extend to half-day", "Reduce walking", "Add one iconic stop", "Save to trip"]
    if (planningProfile?.subtype === "full_day") return ["Add indoor backup stop", "Add lunch stop", "Shorten to half-day", "Save to trip"]
    if (planningProfile?.subtype === "nearby_add_on") return ["Add nearby museum", "Turn into half-day plan", "Find food nearby", "Save to trip"]
    if (itineraryMemory?.latestItinerary) return ["Make it family-friendly", "Add snack stop", "Add nearby museum", "Save to trip"]
    return ["Make it family-friendly", "Turn this into evening plan", "Add nearby museum", "Reduce walking"]
  }
  if (intent === "transport_guidance") return ["Open map view", "Nearby places", "Hotels on map", "Build walking plan"]
  if (intent === "lifestyle_guidance") return ["Family-friendly picks", "Couple-friendly plan", "Nightlife nearby", "Shopping nearby"]
  if (intent === "destination_discovery") return ["Start plan with selected places", "Compare selected places", "Estimate Budget", "Find hotels for selected places"]
  return ["Plan my trip", "Suggest destinations", "Estimate budget", "Find hotels"]
}

function buildPromptSuggestions(intent: Intent, focusName?: string, hasNearbySelection = false, planningProfile?: PlanningProfile, itineraryMemory?: ItineraryMemory) {
  if (intent === "nearby_food") return [focusName ? `Food + walking plan near ${focusName}` : "Food + walking plan", focusName ? `Hotels near ${focusName}` : "Hotels nearby", focusName ? `Late-night food near ${focusName}` : "Late-night food nearby"]
  if (intent === "nearby_places") {
    return hasNearbySelection
      ? ["Want a 1-day plan for these places?", "Need food spots nearby?", "Want budget estimate?"]
      : ["Want a 1-day plan for these places?", "Need food spots nearby?", "Want budget estimate?"]
  }
  if (intent === "weather_guidance") return [focusName ? `Food near ${focusName}` : "Food nearby", "Check travel comfort"]
  if (intent === "budget_estimation") return ["View budget breakdown", "Find cheaper hotels"]
  if (intent === "hotel_guidance") return ["View on map", "Estimate budget"]
  if (intent === "flight_search") return ["Round-trip options", "Morning departures", "Nearby airports"]
  if (intent === "support_handoff") return ["Copy support summary", "Open booking help"]
  if (intent === "planning_guidance") {
    if (planningProfile?.subtype === "evening") return ["Make this romantic", "Add dinner stop"]
    if (planningProfile?.subtype === "family") return ["Add kid-friendly stop", "Reduce walking more"]
    if (planningProfile?.subtype === "budget") return ["Add free stop", "Turn into quick plan"]
    if (planningProfile?.subtype === "quick") return ["Extend to half-day", "Add one iconic stop"]
    if (itineraryMemory?.latestItinerary) return ["Add snack stop", "Reduce walking", "Save to trip"]
    return ["Turn this into evening plan", "Make it family-friendly"]
  }
  if (intent === "transport_guidance") return ["Nearby places", "Hotels on map"]
  if (intent === "destination_discovery") return ["Compare selected places", "More budget options", "More luxury options"]
  return []
}

function responseTypeForIntent(intent: Intent, planningProfile?: PlanningProfile): ResponseType {
  if (intent === "nearby_food") return "food_guide"
  if (intent === "nearby_places") return "nearby_place_recommendations"
  if (intent === "hotel_guidance") return "hotel_recommendations"
  if (intent === "transport_guidance") return "map_context"
  if (intent === "weather_guidance" || intent === "best_time_guidance") return "weather_summary"
  if (intent === "budget_estimation") return "budget_breakdown"
  if (intent === "planning_guidance") {
    if (planningProfile?.subtype === "evening" || planningProfile?.subtype === "morning" || planningProfile?.subtype === "nearby_add_on") return "itinerary_evening"
    if (planningProfile?.subtype === "family") return "itinerary_family"
    if (planningProfile?.subtype === "quick" || planningProfile?.subtype === "half_day") return "itinerary_quick"
    if (planningProfile?.subtype === "romantic") return "itinerary_romantic"
    if (planningProfile?.subtype === "budget") return "itinerary_budget"
    if (planningProfile?.subtype === "full_day") return "itinerary_full_day"
    return "itinerary_general"
  }
  if (intent === "flight_search") return "flight_search_results"
  if (intent === "destination_discovery") return "destination_recommendations"
  if (intent === "support_handoff") return "support_issue_summary"
  return "plain_text"
}

function responseContentTypeForIntent(intent: Intent): ResponseContentType {
  if (intent === "planning_guidance") return "itinerary"
  if (intent === "destination_discovery") return "recommendations"
  if (intent === "budget_estimation") return "budget"
  if (intent === "hotel_guidance") return "hotels"
  if (intent === "nearby_places" || intent === "nearby_food") return "nearby"
  if (intent === "transport_guidance") return "map"
  if (intent === "weather_guidance" || intent === "best_time_guidance") return "weather"
  if (intent === "flight_search") return "flights"
  if (intent === "support_handoff") return "support"
  return "plain_text"
}

function placeMatchesTripContext(place: any, tripContext: any) {
  if (!place || !tripContext?.selectedDestinations?.length) return false
  const placeName = norm(place.name)
  const placeCity = norm(place.city)

  return tripContext.selectedDestinations.some((destination: any) => {
    const destinationLat = Number(destination.latitude)
    const destinationLng = Number(destination.longitude)
    const placeLat = Number(place.latitude)
    const placeLng = Number(place.longitude)
    const isNearbySameTrip =
      Number.isFinite(placeLat) &&
      Number.isFinite(placeLng) &&
      Number.isFinite(destinationLat) &&
      Number.isFinite(destinationLng) &&
      haversineDistanceKm(
        { name: place.name, latitude: placeLat, longitude: placeLng },
        { name: destination.name, latitude: destinationLat, longitude: destinationLng }
      ) <= 25

    return (
      norm(destination.name) === placeName ||
      (placeCity && norm(destination.city) === placeCity && norm(destination.country) === norm(place.country)) ||
      isNearbySameTrip
    )
  })
}

function buildContextGuardrailReply(place: any, tripContext: any) {
  const currentTripName =
    tripContext?.selectedDestinations?.map((destination: any) => destination.name).filter(Boolean).join(", ") || "your current trip"

  return {
    reply: "Different destination detected. Choose how you'd like to continue below.",
    suggestedActions: [],
    actionCtas: [],
    artifacts: {
      contextGuardrail: {
        title: "Different destination detected",
        introText: `${place.name} is outside your current ${currentTripName} trip.`,
        currentTripLabel: currentTripName,
        requestedDestination: compactDestination(place),
        responseActions: ["Stay in current trip", "Start new trip", `Add ${place.name} as new destination`],
      } satisfies ContextGuardrailPayload,
    },
  }
}

function withModeActions(chatMode: "connected" | "fresh", actions: string[], suggestions: string[]) {
  if (chatMode === "connected") {
    return {
      actionCtas: Array.from(new Set([...actions, "Disconnect from trip"])),
      suggestedActions: suggestions,
    }
  }

  return {
    actionCtas: Array.from(new Set([...actions, "Connect this chat to my trip"])),
    suggestedActions: Array.from(new Set([...suggestions, "Save as separate trip idea", "Compare with my current trip"])),
  }
}

function variationForClarification(message: string, attempt = 0) {
  if (!attempt) return message

  if (/which destination/i.test(message)) {
    return "Tell me the destination you want me to use, and I’ll take it from there."
  }
  if (/what departure date/i.test(message)) {
    return "I have the route. Share the departure date and I’ll pull the best flight guidance next."
  }
  if (/where are you traveling from/i.test(message)) {
    return "Share your origin, trip dates, and destination set, and I’ll calculate it properly."
  }
  return `One detail is still missing: ${message}`
}

function askForMissing(intent: Intent, context: any, resolvedPlace: any) {
  if (intent === "nearby_food" && !resolvedPlace) return "Which place should I use for the food search? For example, Times Square, Central Park, Dubai Marina, Munnar, Kochi, or Goa."
  if (intent === "nearby_places" && !resolvedPlace) {
    if ((context?.selectedDestinations || []).length > 1 && isImplicitNearbyReference(context?.latestUserMessage || "")) {
      const names = context.selectedDestinations.map((item: any) => item.name).slice(0, 2).join(" or ")
      return `Do you want places near ${names} or a new destination?`
    }
    return "Which destination should I use for nearby suggestions?"
  }
  if (intent === "budget_estimation" && (!context.startingLocation || !context.selectedDestinations.length || (!context.dateRange?.from && !context.durationDays))) {
    return "Where are you traveling from, which destinations are you covering, and how many days or what dates should I use for the budget estimate?"
  }
  if (intent === "hotel_guidance" && !resolvedPlace && !context.selectedDestinations.length) return "For which destination and budget level should I look for hotels?"
  if (intent === "transport_guidance" && !resolvedPlace && !context.selectedDestinations.length) return "Which destination should I map out for you?"
  if (intent === "flight_search") {
    const flightQuery = parseFlightSearchParams(context?.latestUserMessage || "", context)
    if (!flightQuery?.origin || !flightQuery?.destination) return "Tell me the route you want, for example Mumbai to Paris."
    if (!flightQuery?.departureDate) return `I have ${flightQuery.origin} to ${flightQuery.destination}. What departure date should I use?`
  }
  if ((intent === "weather_guidance" || intent === "best_time_guidance") && !resolvedPlace && !context.selectedDestinations.length) return "Which destination should I check weather and travel comfort for?"
  if (intent === "planning_guidance" && !resolvedPlace && !context.selectedDestinations.length) {
    return "Which destination should I use for this itinerary?"
  }
  if ((intent === "transport_guidance" || intent === "lifestyle_guidance") && !resolvedPlace && !context.selectedDestinations.length) return "Which destination or area should I focus on?"
  return ""
}

async function generateGroqReply(input: {
  userMessage: string
  intent: Intent
  context: any
  resolvedPlace?: any
  grounding: Record<string, any>
  recentMessages?: ChatMessage[]
}) {
  const systemPrompt = [
    "You are Wanderly AI Travel Expert.",
    "You are a travel planning assistant for a premium travel application.",
    "Answer like a fast, trustworthy travel concierge, not a generic chatbot.",
    "Prioritize relevance, practicality, and next-step usefulness.",
    "Avoid filler, repetition, weak disclaimers, and unrelated suggestions.",
    "Do not repeat the same clarification if it was already asked.",
    "Use the user's trip context naturally when available, and do not re-ask for details already known.",
    "Keep answers concise by default: direct answer first, then the most useful travel guidance.",
    "If the grounding data is sparse, stay helpful and product-style instead of sounding defensive.",
    "Never tell the user to use Google Maps, Booking.com, Expedia, or to just search online.",
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

  return runGroqChatCompletion({
    scope: "assistant-reply",
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "system", content: `Grounded travel data:\n${groundingPrompt}` },
      ...((input.recentMessages || []).slice(-6).map((message) => ({
        role: message.role,
        content: message.content,
      })) as ChatMessage[]),
      { role: "user", content: input.userMessage },
    ],
  })
}

function renderFoodReply(foodGuide: FoodGuide) {
  return [
    `**Quick answer**`,
    foodGuide.quickAnswer,
    "",
    `**Best options by type**`,
    ...foodGuide.sections.flatMap((section) => [
      `- **${section.title}**: ${section.items.join(" ")}`,
      ...(section.note ? [`  Note: ${section.note}`] : []),
    ]),
    "",
    `**Local insight**`,
    foodGuide.localInsight,
    "",
    `**Suggested next step**`,
    foodGuide.nextStepHint,
  ].join("\n")
}

function renderNearbyReply(place: any, nearbyPlaces: NearbyPlace[]) {
  return [
    `**Quick answer**`,
    `Here are the strongest nearby places around ${place.name} for a practical sightseeing sequence.`,
    "",
    `**Best nearby picks**`,
    ...nearbyPlaces.map((item) => `- **${item.name}**: ${item.whyVisit}${item.travelTime ? ` (${item.travelTime})` : ""}`),
    "",
    `**Local insight**`,
    `Keep your route in the same neighborhood cluster so you spend more time exploring and less time transferring.`,
    "",
    `**Suggested next step**`,
    `I can turn this into a walking plan, food + attractions route, or evening itinerary.`,
  ].join("\n")
}

function fallbackNearbyReply(place: any, nearbyPlaces: NearbyPlace[]) {
  const isRegionalSet = nearbyPlaces.some((item) => Number(item.distanceKm || 0) >= 20)
  return [
    isRegionalSet
      ? `Here are some of the best places near ${place.name} for a short trip or weekend escape:`
      : `Here are some of the best places to explore around ${place.name}:`,
    "",
    ...nearbyPlaces.map((item, index) => `${index + 1}. ${item.name} - ${item.whyVisit}${item.travelTime ? ` (${item.travelTime})` : ""}`),
    "",
    isRegionalSet
      ? `If you want, I can narrow these into family-friendly, budget-friendly, or weekend-ready options next.`
      : `If you want, I can also build a short walking plan, suggest food nearby, or find hotels around ${place.name}.`,
  ].join("\n")
}

function buildPlanningReply(place: any, plan: MiniPlan | null, itineraryMemory: ItineraryMemory, latestUserMessage: string) {
  if (!place || !plan) return ""

  const summaryLabel = (plan.changeSummary || "")
    .replace(/^Updated for\s+/i, "")
    .replace(/\.$/, "")
    .trim()
  const looksLikeRefinement =
    Boolean(itineraryMemory.latestItinerary || itineraryMemory.itineraryVersion) ||
    isPlanningRefinementRequest(latestUserMessage, {
      itineraryMemory,
      assistantState: { lastPlanPlaceName: itineraryMemory.destinationName },
      selectedDestinations: itineraryMemory.destinationName ? [{ name: itineraryMemory.destinationName }] : [],
    })

  if (looksLikeRefinement && summaryLabel) {
    return `Done - I updated your ${plan.durationDays || ""}${plan.durationDays ? "-day " : ""}${place.name} itinerary for ${summaryLabel}.`
  }

  if (looksLikeRefinement) {
    return `Done - I refreshed your ${place.name} itinerary and kept the latest planning context in place.`
  }

  if (plan.durationDays && plan.durationDays >= 2) {
    return `Here’s a balanced ${plan.durationDays}-day itinerary for ${place.name}.`
  }

  return `Here’s a ${plan.title.toLowerCase()} for ${place.name}.`
}

function isTripContextReviewRequest(message: string) {
  return /(review trip context|show trip context|summari[sz]e my trip context|what do you know about my trip|review my trip|summari[sz]e .*currently have in memory|travel context you currently have in memory|what is missing and the best next step)/.test(norm(message))
}

function buildTripContextReviewReply(context: any) {
  const destinations = (context?.selectedDestinations || []).map((item: any) => item.name).filter(Boolean)
  const dateSummary =
    context?.dateRange?.from && context?.dateRange?.to
      ? `${context.dateRange.from} to ${context.dateRange.to}`
      : context?.durationDays
        ? `${context.durationDays} day${context.durationDays === 1 ? "" : "s"}`
        : "dates not set yet"
  const travelerCount = Number(context?.travelers || 1)
  const travelerSummary = `${travelerCount} traveler${travelerCount === 1 ? "" : "s"}`
  const budgetSummary = context?.budgetPreference || "budget not set"
  const styleSummary = context?.travelStyle || "balanced"

  if (!destinations.length) {
    return "I do not have a destination locked in yet. Tell me where you want to go, and I can review the plan context, estimate budget, or suggest stays from there."
  }

  return [
    `Here is the trip context I am using right now:`,
    ``,
    `- Destination${destinations.length === 1 ? "" : "s"}: ${destinations.join(", ")}`,
    `- Timing: ${dateSummary}`,
    `- Travelers: ${travelerSummary}`,
    `- Budget: ${budgetSummary}`,
    `- Travel style: ${styleSummary}`,
    ``,
    `The smartest next step is usually to lock stays, budget, or a day plan around ${destinations[0]}.`,
  ].join("\n")
}

function fallbackResponse(intent: Intent, input: {
  context: any
  resolvedPlace?: any
  foodGuide?: FoodGuide | null
  miniPlan?: MiniPlan | null
  nearbyPlaces?: NearbyPlace[]
  budget?: any
  hotels?: any[]
  flights?: any[]
  weather?: any
  route?: any
  flightSearch?: FlightSearchPayload | null
  supportIssueSummary?: SupportIssueSummaryPayload | null
  latestUserMessage?: string
}) {
  const firstDestination = input.resolvedPlace || input.context.selectedDestinations?.[0]
  if (isTripContextReviewRequest(input.latestUserMessage || "")) {
    return buildTripContextReviewReply(input.context)
  }
  if (intent === "nearby_places" && input.resolvedPlace && input.nearbyPlaces?.length) return fallbackNearbyReply(input.resolvedPlace, input.nearbyPlaces)
  if (intent === "weather_guidance" && input.weather) {
    return `${input.weather.place} is currently around ${input.weather.temperatureC} C with ${String(input.weather.condition).toLowerCase()} conditions.\n\nTravel advice: ${input.weather.comfort}\nPacking: ${input.weather.packing}\nBest sightseeing window: ${input.weather.bestHours}`
  }
  if (intent === "best_time_guidance" && input.resolvedPlace) {
    return `${input.resolvedPlace.name} is usually best visited in ${input.resolvedPlace.bestTime || "the most pleasant local season"}.\n\nIf you want, I can also suggest weather, nearby attractions, or hotel areas for that period.`
  }
  if (intent === "hotel_guidance" && firstDestination) {
    return `Here are some strong stay options near ${firstDestination.name} for your trip.`
  }
  if (intent === "transport_guidance" && firstDestination) {
    return `Here is the location context for ${firstDestination.name}.`
  }
  if (intent === "flight_search" && input.flightSearch?.cards?.length) {
    return renderFlightSearchReply(input.flightSearch)
  }
  if (intent === "budget_estimation" && input.budget) {
    return `Estimated total: ${formatCurrency(input.budget.totalBudget, input.budget.currency)}\nFlights: ${formatCurrency(input.budget.flightCost, input.budget.currency)}\nHotels: ${formatCurrency(input.budget.breakdown.stay, input.budget.currency)}\nFood: ${formatCurrency(input.budget.breakdown.food, input.budget.currency)}\nLocal travel: ${formatCurrency(input.budget.localTransportCost, input.budget.currency)}`
  }
  if (intent === "planning_guidance" && input.route) {
    if (input.miniPlan?.summary) {
      return input.miniPlan.summary
    }
    return `Recommended route: ${input.route.routeNames.join(" -> ")}\nSuggested duration: ${input.context.durationDays || getTripDuration(input.context.dateRange).totalDays || input.route.routeNames.length * 2} days\nEstimated route distance: about ${input.route.totalDistanceKm} km.`
  }
  if (intent === "support_handoff" && input.supportIssueSummary) {
    return `${input.supportIssueSummary.title}\n\n${input.supportIssueSummary.summary}`
  }
  return "I’m having trouble fetching a smart travel response right now. Please try again in a moment."
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages = (Array.isArray(body?.messages) ? body.messages : []) as ChatMessage[]
    const chatMode = body?.chatMode === "fresh" ? "fresh" : "connected"
    const appTripContext = body?.appTripContext || {}
    const attachment = body?.attachment as AssistantAttachment | null | undefined
    const latestUserMessage = messages.filter((message) => message.role === "user").at(-1)?.content || ""
    const context = buildContext(body?.tripContext || {}, messages, latestUserMessage)
    const assistantState = getAssistantState(context)
    const intentResult = await determineIntent(latestUserMessage, context, attachment)
    const intent = intentResult.intent
    const planningProfile = intent === "planning_guidance" ? detectPlanningProfile(latestUserMessage, context, assistantState) : undefined
    const flightParams = intent === "flight_search" ? parseFlightSearchParams(latestUserMessage, context) : null
    const directPlaceResolution = resolvePlace(latestUserMessage, context)
    const liveTooling: LiveToolingState = {
      usedTools: [],
      liveDataSources: [],
      groundingMode: "curated",
      notes: [],
    }
    const inferredNearbyFocus =
      intent === "nearby_places"
        ? inferNearbyMainDestination(latestUserMessage, context)
        : { place: null, ambiguous: false, source: "none" as const }
    const hasDirectDestinationResolution =
      Boolean(directPlaceResolution.place) &&
      (directPlaceResolution.source === "query" || directPlaceResolution.source === "context-query")
    const nearbyResolution = inferredNearbyFocus.place
      ? { place: enrichResolvedPlace(inferredNearbyFocus.place), source: inferredNearbyFocus.source === "query" ? "query" as const : inferredNearbyFocus.source === "context-query" ? "context-query" as const : "context" as const }
      : { place: null, source: "none" as const }
    const resolvedPlaceResult =
      intent === "nearby_places" && hasDirectDestinationResolution
        ? directPlaceResolution
        : nearbyResolution.place
          ? nearbyResolution
          : directPlaceResolution
    const resolvedPlace = resolvedPlaceResult.place
    const explicitPlace =
      resolvedPlaceResult.source === "query" || resolvedPlaceResult.source === "context-query"
        ? resolvedPlace
        : null
    const hasTripDestinations = Array.isArray(appTripContext?.selectedDestinations) && appTripContext.selectedDestinations.length > 0
    const hasNearbySelection = Array.isArray(context?.nearbyPlanner?.selectedPlaceIds) && context.nearbyPlanner.selectedPlaceIds.length > 0
    const nearbyRadiusKm = clampNearbyRadiusKm(context?.nearbyPlanner?.radiusKm || 12)
    const nearbyCategoryFilter = parseNearbyCategoryFilter(latestUserMessage)
    const wantsMoreNearbyResults = /show more places|show more nearby places|more nearby places|more places/.test(norm(latestUserMessage))
    const placeMismatchKey = explicitPlace ? `guardrail:${explicitPlace.id || norm(explicitPlace.name)}` : ""
    const repeatedGuardrail = Boolean(placeMismatchKey && assistantState.lastContextGuardrailKey === placeMismatchKey)
    const placeMismatch =
      chatMode === "connected" &&
      explicitPlace &&
      hasTripDestinations &&
      !placeMatchesTripContext(explicitPlace, appTripContext) &&
      !["budget_estimation", "trip_modification", "flight_search", "hotel_guidance"].includes(intent)
    const shouldSuppressNearbyClarification = intent === "nearby_places" && hasDirectDestinationResolution
    const clarificationKey = inferredNearbyFocus.ambiguous && !shouldSuppressNearbyClarification
      ? `ambiguous-nearby:${(context?.selectedDestinations || []).map((item: any) => item.id || norm(item.name)).slice(0, 2).join("|")}`
      : `missing:${intent}:${resolvedPlace?.id || "none"}`
    const baseMissing = inferredNearbyFocus.ambiguous && !shouldSuppressNearbyClarification
      ? `Do you want places near ${(context?.selectedDestinations || []).map((item: any) => item.name).slice(0, 2).join(" or ")} or a new destination?`
      : askForMissing(intent, context, resolvedPlace)
    const missing =
      baseMissing
        ? variationForClarification(baseMissing, assistantState.lastClarificationKey === clarificationKey ? 1 : 0)
        : ""

    if (placeMismatch && !repeatedGuardrail) {
      const guardrail = buildContextGuardrailReply(explicitPlace, appTripContext)
      return NextResponse.json({
        intent,
        reply: guardrail.reply,
        loadingLabel: "Checking your trip context...",
        followUpQuestions: [],
        suggestedActions: guardrail.suggestedActions,
        actionCtas: guardrail.actionCtas,
        type: responseContentTypeForIntent(intent),
        responseType: "plain_text",
        conversationTitle: buildSmartTitle(latestUserMessage, context),
        memory: {
          startingLocation: context.startingLocation,
          selectedDestinations: context.selectedDestinations,
          focusDestinationId: context.focusDestinationId,
          dateRange: context.dateRange,
          budgetPreference: context.budgetPreference,
          travelStyle: context.travelStyle,
          travelers: context.travelers,
          durationDays: context.durationDays,
          discoveryContext: context.discoveryContext,
          nearbyPlanner: context.nearbyPlanner,
          itineraryMemory: getItineraryMemory(context),
          assistantState: {
            ...assistantState,
            lastIntent: intent,
            lastResolvedPlaceName: explicitPlace?.name || assistantState.lastResolvedPlaceName,
            lastContextGuardrailKey: placeMismatchKey,
          },
        },
        artifacts: guardrail.artifacts,
      })
    }

    if (attachment?.category === "itinerary_screenshot" && !resolvedPlace && !context.selectedDestinations.length) {
      return NextResponse.json({
        intent,
        reply: "I can use an itinerary screenshot as planning reference, but I cannot reliably extract every stop or date from the image alone here. Tell me the destination or paste the key dates and places, and I’ll turn it into a cleaner Wanderly plan.",
        loadingLabel: "Reviewing your trip reference...",
        followUpQuestions: [],
        suggestedActions: ["Build itinerary", "Estimate budget"],
        actionCtas: ["Review trip context"],
        type: responseContentTypeForIntent(intent),
        responseType: "plain_text",
        conversationTitle: buildSmartTitle(latestUserMessage, context),
        memory: {
          startingLocation: context.startingLocation,
          selectedDestinations: context.selectedDestinations,
          focusDestinationId: context.focusDestinationId,
          dateRange: context.dateRange,
          budgetPreference: context.budgetPreference,
          travelStyle: context.travelStyle,
          travelers: context.travelers,
          durationDays: context.durationDays,
          discoveryContext: context.discoveryContext,
          nearbyPlanner: context.nearbyPlanner,
          itineraryMemory: getItineraryMemory(context),
          assistantState: {
            ...assistantState,
            lastIntent: intent,
          },
        },
        artifacts: {},
      })
    }

    if (attachment?.category === "place_photo" && !resolvedPlace) {
      return NextResponse.json({
        intent,
        reply: "I can help use this place photo in your planning flow, but I should not guess the exact landmark from filename or metadata alone. Tell me where it was taken or what you want to compare, and I’ll connect it to destinations, nearby places, hotels, or itinerary ideas.",
        loadingLabel: "Reviewing your travel photo...",
        followUpQuestions: [],
        suggestedActions: ["Suggest destinations", "Review trip context"],
        actionCtas: ["Connect this chat to my trip"],
        type: responseContentTypeForIntent(intent),
        responseType: "plain_text",
        conversationTitle: buildSmartTitle(latestUserMessage, context),
        memory: {
          startingLocation: context.startingLocation,
          selectedDestinations: context.selectedDestinations,
          focusDestinationId: context.focusDestinationId,
          dateRange: context.dateRange,
          budgetPreference: context.budgetPreference,
          travelStyle: context.travelStyle,
          travelers: context.travelers,
          durationDays: context.durationDays,
          discoveryContext: context.discoveryContext,
          nearbyPlanner: context.nearbyPlanner,
          itineraryMemory: getItineraryMemory(context),
          assistantState: {
            ...assistantState,
            lastIntent: intent,
          },
        },
        artifacts: {},
      })
    }

    if (missing) {
      const itineraryMemory = getItineraryMemory(context)
      const pendingItineraryMemory = mergeItineraryMemory(context, latestUserMessage, resolvedPlace, planningProfile, null, itineraryMemory.latestAssistantSuggestions)
      const modeActions = withModeActions(
        chatMode,
        buildActions(intent, resolvedPlace?.name, hasNearbySelection, planningProfile, itineraryMemory),
        buildPromptSuggestions(intent, resolvedPlace?.name, hasNearbySelection, planningProfile, itineraryMemory)
      )
      const actionSetKey = buildActionSetKey(modeActions.actionCtas, modeActions.suggestedActions)
      const suppressRepeatedActionRow = assistantState.lastActionSetKey === actionSetKey
      return NextResponse.json({
        intent,
        reply: missing,
        loadingLabel: "Understanding your travel request",
        followUpQuestions: [missing],
        suggestedActions: suppressRepeatedActionRow ? [] : modeActions.suggestedActions,
        actionCtas: suppressRepeatedActionRow ? [] : modeActions.actionCtas,
        type: responseContentTypeForIntent(intent),
        responseType: responseTypeForIntent(intent, planningProfile),
        conversationTitle: buildSmartTitle(latestUserMessage, context),
        memory: {
          startingLocation: context.startingLocation,
          selectedDestinations: context.selectedDestinations,
          focusDestinationId: resolvedPlace?.id || context.focusDestinationId,
          dateRange: context.dateRange,
          budgetPreference: context.budgetPreference,
          travelStyle: context.travelStyle,
          travelers: context.travelers,
          durationDays: context.durationDays,
          discoveryContext: context.discoveryContext,
          nearbyPlanner: context.nearbyPlanner,
          itineraryMemory: pendingItineraryMemory,
          assistantState: {
            ...assistantState,
            lastIntent: intent,
            lastClarificationKey: clarificationKey,
            lastClarificationMessage: missing,
            lastResolvedPlaceName: resolvedPlace?.name || assistantState.lastResolvedPlaceName,
            lastActionSetKey: suppressRepeatedActionRow ? assistantState.lastActionSetKey : actionSetKey,
          },
        },
        artifacts: {},
      })
    }

    const route = optimizeRoute(context)
    const itineraryMemory = getItineraryMemory(context)
    const budgetContext = ensureBudgetReadyContext(context)
    const planningPlace = resolvedPlace || context.selectedDestinations?.[0] || null
    const liveWeather =
      (intent === "weather_guidance" || intent === "best_time_guidance") && resolvedPlace && intentResult.requiresLiveData
        ? await tryGetLiveWeather(resolvedPlace.name, resolvedPlace)
        : null
    if (liveWeather) {
      liveTooling.usedTools.push("getWeather")
      liveTooling.liveDataSources.push("openweather")
    }
    const weather = (intent === "weather_guidance" || intent === "best_time_guidance") && resolvedPlace
      ? liveWeather || getWeather(resolvedPlace.name, resolvedPlace)
      : null
    const nearbyPlaces = intent === "nearby_places" && resolvedPlace
      ? searchNearbyAttractions(resolvedPlace, {
          limit: wantsMoreNearbyResults ? 10 : 8,
          radiusKm: nearbyRadiusKm,
          categoryFilter: nearbyCategoryFilter,
          excludeIds: wantsMoreNearbyResults ? context?.nearbyPlanner?.shownPlaceIds || [] : [],
        })
      : []
    if (intent === "nearby_places" && resolvedPlace) {
      liveTooling.usedTools.push("searchNearbyPlaces")
    }
    const nearbyPlaceRecommendations =
      intent === "nearby_places" && resolvedPlace && nearbyPlaces.length
        ? buildNearbyPlaceRecommendations(resolvedPlace, context, nearbyPlaces)
        : null
    const liveHotelResults =
      intent === "hotel_guidance" && planningPlace && intentResult.requiresLiveData
        ? await trySearchLiveHotelsForPlace(planningPlace, context)
        : null
    if (liveHotelResults?.length) {
      liveTooling.usedTools.push("searchHotels")
      liveTooling.liveDataSources.push("rapidapi-hotels")
    }
    const hotelResults = intent === "hotel_guidance" && planningPlace
      ? liveHotelResults || findHotels(planningPlace.name, context.budgetPreference, 4)
      : []
    const hotelRecommendations =
      intent === "hotel_guidance" && planningPlace
        ? buildHotelRecommendations(planningPlace, context, hotelResults, { liveSnapshot: Boolean(liveHotelResults?.length) })
        : null
    const liveFlightSearch =
      intent === "flight_search" && flightParams && intentResult.requiresLiveData
        ? await tryBuildLiveFlightCards(flightParams)
        : null
    if (liveFlightSearch?.cards?.length) {
      liveTooling.usedTools.push("searchFlights")
      liveTooling.liveDataSources.push("amadeus")
    }
    const flightSearch = intent === "flight_search" && flightParams ? liveFlightSearch || buildFlightCards(flightParams) : null
    const mapNearbyPlaces =
      intent === "transport_guidance" && planningPlace
        ? searchNearbyAttractions(planningPlace, {
            limit: 3,
            radiusKm: nearbyRadiusKm,
          })
        : []
    if (intent === "transport_guidance" && planningPlace) {
      liveTooling.usedTools.push("getMapContext")
    }
    const mapHotelRecommendations =
      intent === "transport_guidance" && planningPlace
        ? buildHotelRecommendations(planningPlace, context, liveHotelResults?.slice(0, 2) || findHotels(planningPlace.name, context.budgetPreference, 2), {
            liveSnapshot: Boolean(liveHotelResults?.length),
          })
        : hotelRecommendations
    const mapContext =
      intent === "transport_guidance" && planningPlace
        ? buildMapContextPayload(planningPlace, mapNearbyPlaces, mapHotelRecommendations)
        : null
    const flightResults = flightSearch?.cards || []
    const budget = intent === "budget_estimation" ? buildBudgetEstimate(budgetContext) : null
    const destinationRecommendation =
      intent === "destination_discovery"
        ? buildDestinationRecommendations(latestUserMessage, context)
        : null
    const destinationSuggestions = destinationRecommendation?.cards || []
    const supportIssueSummary =
      intent === "support_handoff"
        ? buildSupportIssueSummary(latestUserMessage, attachment, context)
        : null
    const foodGuide = intent === "nearby_food" && resolvedPlace ? buildFoodGuide(resolvedPlace) : null
    const miniPlan =
      (intent === "nearby_food" || intent === "planning_guidance" || intent === "nearby_places") && resolvedPlace
        ? buildMiniPlan(intent, resolvedPlace, foodGuide, {
            query: latestUserMessage,
            context,
            assistantState,
          })
        : null

    const grounding = {
      intentSource: intentResult.classifiedIntent ? "groq+heuristic" : "heuristic",
      requiresLiveData: intentResult.requiresLiveData,
      planningProfile,
      foodGuide,
      nearby_places: nearbyPlaces,
      hotels: hotelResults,
      flights: flightResults,
      flightSearch,
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
      destinationRecommendation,
      supportIssueSummary,
      nearbyPlaceRecommendations,
      hotelRecommendations,
      mapContext,
      route,
      miniPlan,
      tooling: liveTooling,
    }

    const groqTravelCopy = await generateGroqTravelCopy({
      userMessage: latestUserMessage,
      intent,
      context,
      resolvedPlace,
      grounding,
    }).catch((error) => {
      console.error("Groq travel copy generation failed:", error)
      return null
    })

    const needsFreeformGroqReply =
      responseTypeForIntent(intent, planningProfile) === "plain_text" ||
      (!groqTravelCopy?.shortAnswer && !nearbyPlaceRecommendations && !hotelRecommendations && !mapContext && !flightSearch && !destinationRecommendation && !foodGuide && !budget && !weather && !miniPlan)

    const groqReply = needsFreeformGroqReply
      ? await generateGroqReply({
          userMessage: latestUserMessage,
          intent,
          context,
          resolvedPlace,
          grounding,
          recentMessages: messages,
        }).catch((error) => {
          console.error("Groq assistant generation failed:", error)
          return null
        })
      : null

    if (nearbyPlaceRecommendations && groqTravelCopy?.shortAnswer) {
      nearbyPlaceRecommendations.introText = groqTravelCopy.shortAnswer
    }
    if (hotelRecommendations && groqTravelCopy?.shortAnswer) {
      hotelRecommendations.introText = groqTravelCopy.shortAnswer
    }
    if (mapContext && groqTravelCopy?.shortAnswer) {
      mapContext.introText = groqTravelCopy.shortAnswer
    }
    if (destinationRecommendation && groqTravelCopy?.shortAnswer) {
      destinationRecommendation.introText = groqTravelCopy.shortAnswer
    }
    if (flightSearch && groqTravelCopy?.shortAnswer) {
      flightSearch.introText = groqTravelCopy.shortAnswer
    }

    const reply = intent === "nearby_food" && foodGuide
      ? renderFoodReply(foodGuide)
      : intent === "nearby_places" && nearbyPlaceRecommendations
        ? renderNearbyRecommendationReply(nearbyPlaceRecommendations)
      : intent === "hotel_guidance" && hotelRecommendations
        ? renderHotelRecommendationReply(hotelRecommendations)
      : intent === "transport_guidance" && mapContext
        ? renderMapContextReply(mapContext)
      : intent === "flight_search" && flightSearch
        ? renderFlightSearchReply(flightSearch)
      : intent === "destination_discovery" && destinationRecommendation
        ? renderDestinationDiscoveryReply(destinationRecommendation)
      : intent === "planning_guidance" && miniPlan
        ? buildPlanningReply(resolvedPlace, miniPlan, itineraryMemory, latestUserMessage)
        : intent === "support_handoff" && supportIssueSummary
          ? `${supportIssueSummary.title}\n\n${supportIssueSummary.summary}`
        : groqTravelCopy?.shortAnswer || groqReply || fallbackResponse(intent, {
      context,
      resolvedPlace,
      foodGuide,
      miniPlan,
      nearbyPlaces,
      budget: budget || undefined,
      hotels: hotelResults,
      flights: flightResults,
      flightSearch,
      supportIssueSummary,
      weather: weather || undefined,
      route,
      latestUserMessage,
    })

    const memory = intent === "trip_modification" ? updateTripContext(context, latestUserMessage) : context
    const shouldPersistResolvedPlace = Boolean(resolvedPlace && !(chatMode === "connected" && explicitPlace && placeMismatch))
    const memoryDestinations = shouldPersistResolvedPlace
      ? dedupeSelectedDestinations([resolvedPlace, ...(memory.selectedDestinations || [])])
      : memory.selectedDestinations
    const nearbyPlannerMemory =
      intent === "nearby_places" && resolvedPlace
        ? {
            ...(memory?.nearbyPlanner || {}),
            mainDestinationId: resolvedPlace.id,
            mainDestinationName: resolvedPlace.name,
            radiusKm: nearbyRadiusKm,
            shownPlaceIds: Array.from(new Set([...(memory?.nearbyPlanner?.shownPlaceIds || []), ...nearbyPlaces.map((item) => item.id)])),
          }
        : memory?.nearbyPlanner
    const resolvedFocusDestinationId =
      shouldPersistResolvedPlace && resolvedPlace?.id
        ? resolvedPlace.id
        : nearbyPlannerMemory?.mainDestinationId || memory.focusDestinationId || context.focusDestinationId
    if (intentResult.requiresLiveData && liveTooling.liveDataSources.length === 0) {
      liveTooling.notes.push("Live travel data was unavailable for this request, so Wanderly used curated trip guidance.")
    }
    liveTooling.groundingMode = chooseGroundingMode(liveTooling.usedTools, liveTooling.liveDataSources)
    const modeActions = withModeActions(
      chatMode,
      buildActions(intent, resolvedPlace?.name, hasNearbySelection, planningProfile, itineraryMemory),
      buildPromptSuggestions(intent, resolvedPlace?.name, hasNearbySelection, planningProfile, itineraryMemory)
    )
    const shouldOwnInlineActions = ["nearby_places", "hotel_guidance", "transport_guidance"].includes(intent)
    const actionSetKey = buildActionSetKey(
      shouldOwnInlineActions ? [] : modeActions.actionCtas,
      shouldOwnInlineActions ? [] : modeActions.suggestedActions
    )
    const suppressRepeatedActionRow = assistantState.lastActionSetKey === actionSetKey
    const responseActions = shouldOwnInlineActions || suppressRepeatedActionRow ? [] : modeActions.actionCtas
    const responseSuggestions = shouldOwnInlineActions || suppressRepeatedActionRow ? [] : modeActions.suggestedActions
    const nextItineraryMemory = mergeItineraryMemory(
      memory,
      latestUserMessage,
      resolvedPlace || memoryDestinations?.[0],
      planningProfile,
      miniPlan,
      responseSuggestions
    )

    return NextResponse.json({
      success: true,
      intent,
      reply,
      loadingLabel:
        intent === "nearby_food" ? "Finding better food areas..."
        : intent === "nearby_places" ? "Curating nearby places..."
        : intent === "destination_discovery" ? "Curating destination ideas..."
        : intent === "hotel_guidance" ? "Looking at nearby stay options..."
        : intent === "transport_guidance" ? "Building your map view..."
        : intent === "flight_search" ? `Searching flights for ${flightSearch?.route.origin || "your route"} -> ${flightSearch?.route.destination || "your destination"}...`
        : intent === "budget_estimation" ? "Estimating your travel cost..."
        : intent === "support_handoff" ? "Preparing your support handoff..."
        : intent === "weather_guidance" || intent === "best_time_guidance" ? "Checking local travel conditions..."
        : intent === "planning_guidance"
          ? planningProfile?.subtype === "evening" || planningProfile?.subtype === "romantic"
            ? "Designing your evening route..."
            : planningProfile?.subtype === "family"
              ? "Building a family-friendly route..."
              : planningProfile?.subtype === "budget"
                ? "Shaping a better-value itinerary..."
                : planningProfile?.subtype === "quick"
                  ? "Building a quick-stop route..."
                  : "Building your trip suggestions..."
        : "Thinking through your trip...",
      followUpQuestions:
        responseTypeForIntent(intent, planningProfile) === "plain_text" && groqTravelCopy?.followUpQuestion
          ? [groqTravelCopy.followUpQuestion]
          : [],
      suggestedActions: responseSuggestions,
      actionCtas: responseActions,
      type: responseContentTypeForIntent(intent),
      responseType: responseTypeForIntent(intent, planningProfile),
      conversationTitle: buildSmartTitle(latestUserMessage, { ...memory, selectedDestinations: memoryDestinations }),
      memory: {
        startingLocation: memory.startingLocation,
        selectedDestinations: memoryDestinations,
        focusDestinationId: resolvedFocusDestinationId,
        dateRange: memory.dateRange,
        budgetPreference: memory.budgetPreference,
        travelStyle: memory.travelStyle,
        travelers: memory.travelers,
        durationDays: memory.durationDays,
        discoveryContext: memory.discoveryContext,
        nearbyPlanner: nearbyPlannerMemory,
        itineraryMemory: nextItineraryMemory,
        assistantState: {
          ...assistantState,
          lastIntent: intent,
          lastResolvedPlaceName: resolvedPlace?.name || assistantState.lastResolvedPlaceName,
          lastClarificationKey: "",
          lastClarificationMessage: "",
          lastContextGuardrailKey: placeMismatch && explicitPlace ? placeMismatchKey : "",
          lastActionSetKey: suppressRepeatedActionRow ? assistantState.lastActionSetKey : actionSetKey,
          lastPlanSubtype: intent === "planning_guidance" ? miniPlan?.subtype || assistantState.lastPlanSubtype : assistantState.lastPlanSubtype,
          lastPlanPlaceName:
            intent === "planning_guidance" && resolvedPlace?.name
              ? resolvedPlace.name
              : assistantState.lastPlanPlaceName,
          lastPlanStopIds:
            intent === "planning_guidance" && miniPlan?.stops?.length
              ? miniPlan.stops.map((stop) => stop.id).filter((value): value is string => Boolean(value)).slice(0, 6)
              : assistantState.lastPlanStopIds,
        },
      },
      artifacts: {
        foodGuide,
        localTips: foodGuide?.localTips || [],
        miniPlan,
        nearbyPlaces,
        nearbyPlaceRecommendations,
        hotelRecommendations,
        mapContext,
        weather,
        budget,
        hotels: hotelResults,
        flights: flightResults,
        flightSearchResults: flightSearch,
        destinations: destinationSuggestions,
        destinationRecommendations: destinationRecommendation,
        supportIssueSummary,
        distanceKm: intent === "planning_guidance" || intent === "budget_estimation" ? route?.totalDistanceKm || null : null,
      },
      provider: groqTravelCopy?.shortAnswer || groqReply ? "groq" : "fallback",
      tooling: liveTooling,
      intentSource: intentResult.classifiedIntent ? "groq+heuristic" : "heuristic",
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
