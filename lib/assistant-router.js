export const ASSISTANT_MODES = {
  PLAN_TRIP: "PLAN_TRIP",
  TRAVEL_QA: "TRAVEL_QA",
}

export const INTENTS = {
  PLAN_TRIP: "plan_trip",
  TRAVEL_QA: "travel_qa",
  MIXED: "mixed",
  UNKNOWN: "unknown",
}

const PLAN_KEYWORDS = [
  "plan my trip",
  "plan trip",
  "itinerary",
  "book",
  "booking",
  "hotels",
  "flights",
  "schedule",
  "budget plan",
  "change day",
  "move activity",
  "add places",
  "days",
]

const QA_KEYWORDS = [
  "visa",
  "passport",
  "police",
  "emergency number",
  "safety",
  "laws",
  "rules",
  "currency",
  "sim",
  "weather",
  "tipping",
  "culture",
]

export const initialPlanTripState = {
  step: "IDLE",
  context: {
    origin: "",
    destinations: [],
    startDate: "",
    endDate: "",
    tripDuration: undefined,
    travelersCount: undefined,
    tripStyle: "",
    budgetLevel: undefined,
    preferences: [],
    selectedPlaces: [],
  },
}

export const initialTravelQaState = {
  lastCountry: "",
  lastCity: "",
  lastTopic: "",
  nationality: "",
}

export function planTripReducer(state, action) {
  switch (action.type) {
    case "MERGE_CONTEXT":
      return {
        ...state,
        context: {
          ...state.context,
          ...action.payload,
          destinations: action.payload?.destinations ?? state.context.destinations,
          selectedPlaces: action.payload?.selectedPlaces ?? state.context.selectedPlaces,
        },
      }
    case "SET_STEP":
      return { ...state, step: action.payload }
    case "RESET":
      return initialPlanTripState
    default:
      return state
  }
}

export function travelQaReducer(state, action) {
  switch (action.type) {
    case "MERGE":
      return { ...state, ...action.payload }
    case "RESET":
      return initialTravelQaState
    default:
      return state
  }
}

function includesAny(text, words) {
  return words.some((w) => text.includes(w))
}

function extractTopic(lower) {
  if (lower.includes("visa") || lower.includes("passport")) return "visa"
  if (lower.includes("police") || lower.includes("emergency")) return "police"
  if (lower.includes("safety")) return "safety"
  if (lower.includes("law") || lower.includes("rules")) return "law"
  if (lower.includes("currency") || lower.includes("money") || lower.includes("cash")) return "currency"
  if (lower.includes("sim") || lower.includes("internet") || lower.includes("data")) return "sim"
  if (lower.includes("weather")) return "weather"
  if (lower.includes("culture") || lower.includes("tipping")) return "culture"
  if (lower.includes("booking") || lower.includes("book") || lower.includes("hotel") || lower.includes("flight")) return "booking"
  if (lower.includes("itinerary") || lower.includes("plan")) return "itinerary"
  return ""
}

function extractWordAfter(prefix, text) {
  const re = new RegExp(`${prefix}\\s+([a-zA-Z\\s]+)`, "i")
  const m = text.match(re)
  return m?.[1]?.trim() ?? ""
}

function extractDates(text) {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/g)
  if (iso && iso.length >= 2) return { startDate: iso[0], endDate: iso[1] }

  const monthMap = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  }

  const toIso = (d) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const normalized = String(text || "").toLowerCase().trim()
  const thisYear = new Date().getFullYear()

  const namedRange = normalized.match(
    /(\d{1,2})\s*([a-z]+)(?:\s*(\d{4}))?\s*(?:to|-)\s*(\d{1,2})\s*([a-z]+)(?:\s*(\d{4}))?/i
  )
  if (namedRange) {
    const d1 = Number(namedRange[1])
    const m1 = monthMap[namedRange[2]]
    const y1 = Number(namedRange[3] || thisYear)
    const d2 = Number(namedRange[4])
    const m2 = monthMap[namedRange[5]]
    const y2 = Number(namedRange[6] || y1)
    if (Number.isInteger(m1) && Number.isInteger(m2)) {
      const start = new Date(y1, m1, d1)
      const end = new Date(y2, m2, d2)
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start) {
        return { startDate: toIso(start), endDate: toIso(end) }
      }
    }
  }

  const nextWeek = normalized.match(/next\s+week(?:\s+for\s+(\d+)\s*(?:day|days|night|nights))?/i)
  if (nextWeek) {
    const days = Math.max(1, Number(nextWeek[1] || 7))
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() + 7)
    const end = new Date(start)
    end.setDate(start.getDate() + days - 1)
    return { startDate: toIso(start), endDate: toIso(end) }
  }

  return {}
}

function extractTripDuration(text) {
  const m = text.match(/(\d+)\s*(day|days|night|nights)\b/i)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function extractTravelers(text) {
  const m = text.match(/(\d+)\s*(traveler|travelers|people|persons|adults)\b/i)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function extractTripStyle(text) {
  const lower = String(text || "").toLowerCase()
  if (lower.includes("relaxed")) return "Relaxed"
  if (lower.includes("normal")) return "Normal"
  if (lower.includes("packed")) return "Packed"
  return ""
}

export function extractEntities(message, knownCities = [], knownCountries = []) {
  const text = String(message || "").trim()
  const lower = text.toLowerCase()
  const topic = extractTopic(lower)
  const origin = extractWordAfter("from", text)
  const destination = extractWordAfter("to", text) || extractWordAfter("visit", text)
  const dates = extractDates(text)
  const tripDuration = extractTripDuration(text)
  const travelers = extractTravelers(text)
  const tripStyle = extractTripStyle(text)

  const cityMatch = knownCities.find((c) => lower.includes(String(c).toLowerCase())) || ""
  const countryMatch = knownCountries.find((c) => lower.includes(String(c).toLowerCase())) || ""

  return {
    destination: destination || cityMatch || "",
    origin: origin || "",
    dates,
    travelers,
    country: countryMatch,
    city: cityMatch,
    topic,
    tripDuration,
    tripStyle,
  }
}

export function detectAssistantIntent(message, options = {}) {
  const text = String(message || "").trim()
  const lower = text.toLowerCase()
  const entities = extractEntities(text, options.knownCities || [], options.knownCountries || [])

  const planHit = includesAny(lower, PLAN_KEYWORDS)
  const qaHit = includesAny(lower, QA_KEYWORDS)

  if (planHit && qaHit) return { intent: INTENTS.MIXED, confidence: 0.92, entities }
  if (planHit) return { intent: INTENTS.PLAN_TRIP, confidence: 0.9, entities }
  if (qaHit) return { intent: INTENTS.TRAVEL_QA, confidence: 0.9, entities }

  if (options.currentMode === ASSISTANT_MODES.PLAN_TRIP) {
    if (entities.travelers || entities.tripDuration || entities.origin || entities.destination || entities.dates?.startDate || entities.tripStyle) {
      return { intent: INTENTS.PLAN_TRIP, confidence: 0.72, entities }
    }
  }

  return { intent: INTENTS.UNKNOWN, confidence: 0.4, entities }
}

export function applyPlanEntityUpdate(context, entities) {
  const patch = {}
  if (entities.origin) patch.origin = entities.origin
  if (entities.destination) patch.destinations = [entities.destination]
  if (entities.dates?.startDate) patch.startDate = entities.dates.startDate
  if (entities.dates?.endDate) patch.endDate = entities.dates.endDate
  if (entities.tripDuration) patch.tripDuration = entities.tripDuration
  if (entities.travelers) patch.travelersCount = entities.travelers
  if (entities.tripStyle) patch.tripStyle = entities.tripStyle
  return { ...context, ...patch }
}

export function getMissingPlanField(context, hasDestinationFromUi = false) {
  const hasDestination = hasDestinationFromUi || (Array.isArray(context?.destinations) && context.destinations.length > 0) || (Array.isArray(context?.selectedPlaces) && context.selectedPlaces.length > 0)
  if (!hasDestination) return "destination"
  if (!String(context?.origin || "").trim()) return "origin"
  const hasDates = Boolean((context?.startDate && context?.endDate) || context?.tripDuration)
  if (!hasDates) return "dates"
  if (!Number(context?.travelersCount || 0)) return "travelersCount"
  if (!String(context?.tripStyle || "").trim()) return "tripStyle"
  return null
}

export function getNextPlanQuestion(missingField) {
  if (missingField === "destination") return "Which destination(s) do you want to visit?"
  if (missingField === "origin") return "Where are you traveling from?"
  if (missingField === "dates") return "When are you traveling? (start date - end date)"
  if (missingField === "travelersCount") return "How many travelers are going?"
  if (missingField === "tripStyle") return "Trip style? Relaxed / Normal / Packed"
  return "Great, I have the required details. I can generate your trip plan now."
}

export function getQaClarifier(intentResult, qaContext = {}) {
  const topic = intentResult?.entities?.topic || qaContext?.lastTopic || ""
  const country = intentResult?.entities?.country || qaContext?.lastCountry || ""
  const city = intentResult?.entities?.city || qaContext?.lastCity || ""

  if (topic === "visa" && !qaContext?.nationality) {
    return "Which nationality/passport do you hold?"
  }
  if (["visa", "police", "safety", "law", "currency", "sim", "weather", "culture"].includes(topic) && !country && !city) {
    return "Which country/city are you asking about?"
  }
  return ""
}

export function shouldStartOver(message) {
  const lower = String(message || "").toLowerCase()
  return lower.includes("start over") || lower.includes("reset trip")
}
