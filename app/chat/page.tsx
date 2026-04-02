"use client"
import { BudgetCard } from "@/components/chat/BudgetCard"
import { WeatherCard } from "@/components/chat/WeatherCard"
import { MessageContent } from "@/components/chat/MessageContent";
import { useState, useRef, useEffect, useReducer, useMemo } from "react"
import { type DateRange } from "react-day-picker"
import { format, differenceInCalendarDays } from "date-fns"
import { useSearchParams, useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Send,
  Sparkles,
  User,
  Plus,
  Mic,
  Award,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn, calculateHaversineDistance } from "@/lib/utils"
import {
  chatSuggestions,
  chatIntents,
  destinations,
  budgetEstimates,
  destinationWeather,
  hotels,
  userProfiles,
  categoryNames,
} from "@/lib/data"
import type { Destination } from "@/lib/data"
import Image from "next/image"
import {
  ASSISTANT_MODES,
  INTENTS,
  initialPlanTripState,
  initialTravelQaState,
  planTripReducer,
  travelQaReducer,
  detectAssistantIntent,
  applyPlanEntityUpdate,
  getMissingPlanField,
  getNextPlanQuestion,
  getQaClarifier,
  shouldStartOver,
} from "@/lib/assistant-router"




function extractCityForWeather(text: string) {
  const lower = text.toLowerCase()
  // examples: "weather in dubai", "dubai weather", "check weather paris"
  const m1 = lower.match(/weather in ([a-z\s]+)$/i)
  if (m1?.[1]) return m1[1].trim()

  const m2 = lower.match(/check weather (in )?([a-z\s]+)$/i)
  if (m2?.[2]) return m2[2].trim()

  const m3 = lower.match(/^([a-z\s]+)\sweather$/i)
  if (m3?.[1]) return m3[1].trim()

  return null
}
function extractBudgetQuery(text: string) {
  const lower = text.toLowerCase()

  const isBudget =
    lower.includes("budget") ||
    lower.includes("cost") ||
    lower.includes("expense") ||
    lower.includes("how much")

  if (!isBudget) return null

  // extract days
  const daysMatch = lower.match(/(\d+)\s*(day|days)/)
  const days = daysMatch ? Number(daysMatch[1]) : 3

  // remove keywords to isolate destination
  const cleaned = lower
    .replace(/(\d+)\s*(day|days)/g, "")
    .replace("budget", "")
    .replace("cost", "")
    .replace("expense", "")
    .replace("how much", "")
    .replace("for", "")
    .replace("in", "")
    .trim()

  const destination = cleaned.length > 0 ? cleaned : null

  return { destination, days }
}



const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Paris": { lat: 48.8566, lng: 2.3522 },
  "London": { lat: 51.5074, lng: -0.1278 },
  "New York": { lat: 40.7128, lng: -74.0060 },
  "Dubai": { lat: 25.2048, lng: 55.2708 },
  "Singapore": { lat: 1.3521, lng: 103.8198 },
  "Tokyo": { lat: 35.6762, lng: 139.6503 },
  "Sydney": { lat: -33.8688, lng: 151.2093 },
  "Agra": { lat: 27.1767, lng: 78.0081 },
  "Beijing": { lat: 39.9042, lng: 116.4074 },
  "Rome": { lat: 41.9028, lng: 12.4964 },
  "Athens": { lat: 37.9838, lng: 23.7275 },
  "Barcelona": { lat: 41.3851, lng: 2.1734 },
  "Cairo": { lat: 30.0444, lng: 31.2357 },
}

function getCityCoords(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  const aliases: Record<string, string> = {
    "new york city": "new york",
    "nyc": "new york",
    "bombay": "mumbai",
    "delhi ncr": "delhi",
  }
  const canonical = aliases[normalized] || normalized
  for (const city in CITY_COORDS) {
    const normalizedCity = city
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (normalizedCity === canonical) return CITY_COORDS[city]
  }
  return null
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number

  cards?: DestinationCard[]
  buttons?: string[]
  slider?: { label: string; min: number; max: number; value: number }
  dataSource?: string

  weather?: {
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
  budget?: {
    destination: string
    days: number
    currency: string
    flight: number
    hotelPerNight: number
    foodPerDay: number
    transportPerDay: number
    activitiesPerDay: number
    entryFeesTotal: number
    total: number
  }
  dateRangePicker?: boolean
  budgetSelector?: boolean
  preferenceSelector?: boolean
  tripStyleSelector?: boolean
  distanceAndBudgetCTA?: boolean
  ctaPayload?: {
    fromCity: string
    toPlace: string
    distanceKm: number
    durationMins?: number
  }
}


type ChatSession = {
  id: string
  title: string
  messages: Message[]
  createdAt: number
}

interface DestinationCard {
  id: string
  name: string
  country: string
  image: string
  price: string
  rating: number
  isUNESCO?: boolean
  visitors?: string
}

function isPlanningOnlyMessage(message: Message) {
  const text = String(message.content || "").toLowerCase().trim()
  const hasPlanningWidget =
    Boolean(message.dateRangePicker) ||
    Boolean(message.budgetSelector) ||
    Boolean(message.preferenceSelector) ||
    Boolean(message.tripStyleSelector) ||
    Boolean(message.distanceAndBudgetCTA)

  if (hasPlanningWidget) return true

  if (message.role !== "assistant") return false

  return (
    text.includes("where are you traveling from") ||
    text.startsWith("you selected:") ||
    text.includes("how many travelers") ||
    text.includes("trip style? relaxed / normal / packed") ||
    text.includes("any preferences? (optional)") ||
    text.includes("your trip starts at:")
  )
}




const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Hello! I'm your AI travel assistant powered by real travel datasets. I can help you discover famous places from our World Famous Places 2024 database, estimate budgets, check weather conditions, and provide personalized recommendations based on TripAdvisor review data. What would you like to explore?",
    timestamp: Date.now()
    ,
    buttons: ["Recommend UNESCO sites", "Find budget destinations", "Check weather in Paris"],
    dataSource: "System: chatIntents dataset",
  },
]

// NLP Intent matching using chatIntents dataset patterns
function matchIntent(message: string): string {
  const lower = message.toLowerCase()
  for (const intent of chatIntents) {
    if (intent.patterns.some((p) => lower.includes(p))) {
      return intent.intent
    }
  }
  return "general"
}

// Search destinations from world_famous_places dataset
function searchDestinations(query: string): Destination[] {
  const lower = query.toLowerCase()
  return destinations.filter(
    (d) =>
      d.name.toLowerCase().includes(lower) ||
      d.country.toLowerCase().includes(lower) ||
      d.city.toLowerCase().includes(lower) ||
      d.region.toLowerCase().includes(lower) ||
      d.type.toLowerCase().includes(lower) ||
      d.interests.some((i) => lower.includes(i))
  )
}

function destToCard(d: Destination): DestinationCard {
  return {
    id: d.id,
    name: d.name,
    country: d.country,
    image: d.image,
    price: `$${d.budget.min}-${d.budget.max}/day`,
    rating: d.rating,
    isUNESCO: d.isUNESCO,
    visitors: `${d.annualVisitors}M/yr`,
  }
}

// AI response generator using all datasets
function getAIResponse(userMessage: string): Message {
  const intent = matchIntent(userMessage)
  const lower = userMessage.toLowerCase()

  // UNESCO intent
  if (lower.includes("unesco") || lower.includes("heritage")) {
    const unescoSites = destinations.filter((d) => d.isUNESCO)
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `I found ${unescoSites.length} UNESCO World Heritage Sites in our database. These are globally recognized for their cultural or natural significance:`,
      timestamp: Date.now(),
      cards: unescoSites.slice(0, 4).map(destToCard),
      buttons: ["Show all UNESCO sites", "Filter by region", "Compare entry fees"],
      dataSource: "Dataset: world_famous_places_2024.csv (UNESCO_World_Heritage=Yes)",
    }
  }

  // Destination search by name/region
  if (intent === "destination_search" || lower.includes("recommend") || lower.includes("suggest")) {
    // Check for specific regions
    const regionMatch = destinations.find((d) =>
      lower.includes(d.region.toLowerCase()) || lower.includes(d.country.toLowerCase())
    )

    if (regionMatch) {
      const regionResults = destinations.filter((d) => d.region === regionMatch.region)
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `Here are ${regionResults.length} famous places in ${regionMatch.region} from our dataset:`,
        timestamp: Date.now(),
        cards: regionResults.slice(0, 4).map(destToCard),
        buttons: ["Show hotels nearby", "Check weather", "Plan itinerary"],
        dataSource: `Dataset: world_famous_places_2024.csv (Region=${regionMatch.region})`,
      }
    }

    // General recommendation ranked by popularity (Annual_Visitors_Millions)
    const popular = [...destinations].sort((a, b) => b.annualVisitors - a.annualVisitors)
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "Here are the most visited destinations worldwide, ranked by annual visitors from our dataset:",
      timestamp: Date.now(),
      cards: popular.slice(0, 4).map(destToCard),
      buttons: ["Filter by UNESCO status", "Show budget options", "View by region"],
      dataSource: "Dataset: world_famous_places_2024.csv (sorted by Annual_Visitors_Millions)",
    }
  }

  // Budget intent
  if (intent === "budget_inquiry") {
    // Check if a destination is mentioned
    const matchedDest = destinations.find((d) =>
      lower.includes(d.name.toLowerCase()) || lower.includes(d.city.toLowerCase())
    )

    if (matchedDest) {
      const estimate = budgetEstimates.find(
        (b) => b.destination === matchedDest.name
      )
      if (estimate) {
        const dailyCost = estimate.hotelPricePerNight + estimate.foodCostPerDay + estimate.localTransportCost + estimate.activityCostAvg
        return {
          id: Date.now().toString(),
          role: "assistant",
          content: `Budget breakdown for ${matchedDest.name} (${matchedDest.city}, ${matchedDest.country}):\n\nFlight: ~$${estimate.avgFlightCost}\nHotel: ~$${estimate.hotelPricePerNight}/night\nFood: ~$${estimate.foodCostPerDay}/day\nTransport: ~$${estimate.localTransportCost}/day\nActivities: ~$${estimate.activityCostAvg}/day\nEntry fee: $${estimate.entryFee}\n\nEstimated daily cost (excl. flight): ~$${dailyCost}`,
          timestamp: Date.now(),
          buttons: ["3-day total", "Find cheaper alternatives", "Show hotels"],
          dataSource: "Dataset: budgetEstimates (derived from world_famous_places + regional data)",
        }
      }
    }

    // Budget range filter
    const budgetDests = [...destinations].sort((a, b) => a.budget.min - b.budget.min)
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "Let me help you find budget-friendly destinations. Here are the most affordable places from our dataset, sorted by daily cost:",
      timestamp: Date.now(),
      cards: budgetDests.slice(0, 4).map(destToCard),
      slider: { label: "Max Daily Budget (USD)", min: 30, max: 500, value: 150 },
      dataSource: "Dataset: world_famous_places_2024.csv (sorted by avg_daily_cost)",
    }
  }

  // Weather intent
  if (intent === "weather_check") {
    const matchedDest = destinations.find((d) =>
      lower.includes(d.name.toLowerCase()) || lower.includes(d.city.toLowerCase())
    )

    const city = matchedDest?.city || "Paris"
    const weather = destinationWeather[city]

    if (weather) {
      const bestMonths = weather
        .filter((w) => w.avgTemperature >= 15 && w.avgTemperature <= 30 && w.rainfall < 60)
        .map((w) => w.month)

      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `Weather data for ${city}:\n\nBest months to visit: ${bestMonths.join(", ") || "Check full chart"}\n\nMonthly highlights:\n${weather.slice(0, 4).map((w) => `${w.month}: ${w.avgTemperature}°C, ${w.rainfall}mm rain - ${w.weatherCondition}`).join("\n")}\n\n...and more. Visit the Weather page for full details.`,
        timestamp: Date.now(),
        buttons: ["Full weather chart", "Pack suggestions", "Plan trip around weather"],
        dataSource: `Dataset: destinationWeather[${city}] (historical monthly averages)`,
      }
    }

    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "I have detailed weather data for Paris, New York City, Beijing, Dubai, and Rome. Which city would you like weather information for?",
      timestamp: Date.now(),
      buttons: ["Paris", "New York City", "Dubai", "Beijing"],
      dataSource: "Dataset: destinationWeather (5 cities with 12-month data)",
    }
  }

  // Hotel intent
  if (intent === "hotel_search") {
    const matchedDest = destinations.find((d) =>
      lower.includes(d.name.toLowerCase()) || lower.includes(d.city.toLowerCase())
    )

    const cityHotels = matchedDest
      ? hotels.filter((h) => h.city === matchedDest.city || h.destination === matchedDest.name)
      : hotels

    if (cityHotels.length > 0) {
      return {
        id: Date.now().toString(),
        role: "assistant",
        content: `I found ${cityHotels.length} hotel${cityHotels.length > 1 ? "s" : ""} ${matchedDest ? `near ${matchedDest.name}` : "in our database"}:\n\n${cityHotels.map((h) => `${h.name} (${h.hotelType}) - $${h.price}/night - ${h.rating}/5 (${h.reviews} reviews)`).join("\n")}`,
        timestamp: Date.now(),
        buttons: ["Book now", "Compare prices", "View amenities"],
        dataSource: "Dataset: hotels (matched by destination/city from world_famous_places)",
      }
    }
  }

  // Itinerary intent
  if (intent === "itinerary_request") {
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: "I can create a personalized itinerary! Tell me:\n\n1. Which destination(s) interest you?\n2. How many days?\n3. What's your daily budget?\n\nI'll use our world famous places data to suggest the best attractions and optimal visit durations.",
      timestamp: Date.now(),
      buttons: ["3-day Paris", "5-day Europe tour", "Budget adventure"],
      dataSource: "Dataset: world_famous_places_2024.csv (Average_Visit_Duration_Hours, Entry_Fee_USD)",
    }
  }

  // User profiling
  if (lower.includes("profile") || lower.includes("personal") || lower.includes("my preference")) {
    const sampleUser = userProfiles[0]
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `Based on our TripAdvisor review dataset analysis, here's a sample user profile:\n\nTravel Style: ${sampleUser.travelStyle}\nTop Interests: ${sampleUser.topInterests.join(", ")}\nBudget Range: ${sampleUser.budgetRange}\n\nCategory scores (from ${categoryNames.length} review categories):\n${categoryNames.slice(0, 5).map((cat, i) => `${cat}: ${Object.values(sampleUser.preferences)[i].toFixed(2)}`).join("\n")}\n\nWe use these profiles to personalize destination recommendations.`,
      timestamp: Date.now(),
      buttons: ["See my recommendations", "Update preferences", "How it works"],
      dataSource: "Dataset: tripadvisor_review.csv (982 users x 10 categories)",
    }
  }

  // Specific destination mentioned
  const directMatch = destinations.find((d) =>
    lower.includes(d.name.toLowerCase()) || lower.includes(d.city.toLowerCase())
  )

  if (directMatch) {
    return {
      id: Date.now().toString(),
      role: "assistant",
      content: `${directMatch.name} - ${directMatch.city}, ${directMatch.country}\n\nFamous for: ${directMatch.famousFor}\nType: ${directMatch.type}\nBest time: ${directMatch.bestTime}\nEntry fee: ${directMatch.entryFee === 0 ? "Free" : `$${directMatch.entryFee}`}\nAvg visit: ${directMatch.avgVisitDuration} hours\nAnnual visitors: ${directMatch.annualVisitors}M\nUNESCO: ${directMatch.isUNESCO ? "Yes" : "No"}\nYear built: ${directMatch.yearBuilt}`,
      timestamp: Date.now(),
      cards: [destToCard(directMatch)],
      buttons: ["Check weather", "Find hotels", "Plan itinerary", "Budget estimate"],
      dataSource: "Dataset: world_famous_places_2024.csv (all columns)",
    }
  }

  // Default response
  return {
    id: Date.now().toString(),
    role: "assistant",
    content: "I can help you with:\n\n- Destination discovery (20 world famous places)\n- Budget estimation (14 destinations with cost breakdowns)\n- Weather data (5 cities with monthly details)\n- Hotel recommendations (8 properties)\n- Personalized suggestions (TripAdvisor user profiling)\n\nWhat would you like to explore?",
    timestamp: Date.now(),
    buttons: ["Top destinations", "Budget planner", "Weather check", "My profile"],
    dataSource: "System: All datasets available",
  }
}

async function streamGroqResponse(
  history: { role: "user" | "assistant"; content: string }[],
  onToken: (t: string) => void,
  signal: AbortSignal,
  meta?: {
    mode?: string
    intent?: string
    planTripContext?: any
    qaContext?: any
  }
) {

  const res = await fetch("/api/chat", {
    signal,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      mode: meta?.mode || "TRAVEL_QA",
      intent: meta?.intent || "unknown",
      planTripContext: meta?.planTripContext || {},
      qaContext: meta?.qaContext || {},
    }),
  });

  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "API error");
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE messages separated by \n\n
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;

      const json = line.replace("data: ", "");
      const payload = JSON.parse(json);

      if (payload.type === "token" && payload.token) onToken(payload.token);
      if (payload.type === "error") throw new Error(payload.message || "Stream error");
    }
  }
}



export default function ChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const destinationParam = searchParams.get("destination")
  const forceStartPlan = searchParams.get("startPlan") === "1"

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const [assistantMode, setAssistantMode] = useState<"PLAN_TRIP" | "TRAVEL_QA">(
    searchParams.get("mode") === "plan" ? "PLAN_TRIP" : "TRAVEL_QA"
  )
  const [planState, dispatchPlan] = useReducer(planTripReducer, initialPlanTripState)
  const [qaState, dispatchQa] = useReducer(travelQaReducer, initialTravelQaState)

  const saveTripPlan = async (data: any) => {
    try {
      await fetch("/api/trip-plan", {
        method: "POST",
        body: JSON.stringify(data),
      })
    } catch { }
  }

  const geocodeOriginCity = async (city: string) => {
    const local = getCityCoords(city)
    if (local) return { lat: local.lat, lon: local.lng, name: city }

    // Fallback from known dataset cities if not in CITY_COORDS
    const normalizedInput = String(city || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    const matchedDatasetCity = destinations.find((d) => {
      const dc = String(d.city || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
      return dc === normalizedInput
    })
    if (matchedDatasetCity) {
      return {
        lat: Number(matchedDatasetCity.latitude),
        lon: Number(matchedDatasetCity.longitude),
        name: matchedDatasetCity.city || city,
      }
    }

    try {
      const res = await fetch(`/api/locations/search?q=${encodeURIComponent(city)}&scope=city`)
      const data = await res.json()
      const first = Array.isArray(data?.results) ? data.results[0] : null
      if (first) {
        const lat = Number(first.lat)
        const lon = Number(first.lon)
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          return { lat, lon, name: first.name || city }
        }
      }
      const fallback = getCityCoords(city)
      if (fallback) return { lat: fallback.lat, lon: fallback.lng, name: city }
      return null
    } catch {
      const fallback = getCityCoords(city)
      if (fallback) return { lat: fallback.lat, lon: fallback.lng, name: city }
      return null
    }
  }

  const resolveDestinationForDistance = (raw: any) => {
    const directLat = Number(raw?.latitude ?? raw?.lat)
    const directLon = Number(raw?.longitude ?? raw?.lng ?? raw?.lon)
    if (Number.isFinite(directLat) && Number.isFinite(directLon)) {
      return {
        name: String(raw?.name || raw?.city || "Destination"),
        lat: directLat,
        lon: directLon,
      }
    }

    const token = String(raw?.name ?? raw?.id ?? raw ?? "").trim().toLowerCase()
    const cityToken = String(raw?.city ?? "").trim().toLowerCase()

    const matched = destinations.find((d) => {
      const id = String(d.id).trim().toLowerCase()
      const name = String(d.name).trim().toLowerCase()
      const city = String(d.city).trim().toLowerCase()
      return token === id || token === name || token === city || cityToken === city
    })

    if (!matched) return null
    return {
      name: matched.name,
      lat: Number(matched.latitude),
      lon: Number(matched.longitude),
    }
  }

  const fetchRouteDistance = async (
    from: { lat: number; lon: number },
    to: { lat: number; lon: number }
  ) => {
    try {
      const res = await fetch("/api/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          profile: "driving-car",
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const km = Number(data?.distanceKm)
      const mins = Number(data?.durationMins)
      if (!Number.isFinite(km) || !Number.isFinite(mins)) return null
      return {
        distanceKm: Math.max(1, Math.round(km)),
        durationMins: Math.max(1, Math.round(mins)),
      }
    } catch {
      return null
    }
  }

  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [datePickerMessageId, setDatePickerMessageId] = useState<string | null>(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [preferencesInput, setPreferencesInput] = useState("")
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([])
  const sidebarScrollRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const PLAN_CTX_KEY = "wanderly_plan_trip_context_v2"
  const QA_CTX_KEY = "wanderly_qa_context_v2"
  const QA_COPILOT_BUTTONS = [
    "Visa checklist by nationality",
    "Safety + local laws brief",
    "Best time + weather window",
    "Budget split by category",
  ]
  const QA_QUICK_PROMPTS: Record<string, string> = {
    "Visa checklist by nationality":
      "Create a professional visa checklist. Ask for missing nationality and destination first, then provide documents, fees, processing time, and common rejection reasons.",
    "Safety + local laws brief":
      "Give a professional travel safety brief with local laws, scams to avoid, transport safety, emergency numbers, and neighborhood cautions for my destination.",
    "Best time + weather window":
      "Give the best travel window by month with weather, crowd level, and price trend, then recommend top 2 windows with pros/cons.",
    "Budget split by category":
      "Provide a realistic travel budget split (flight, stay, food, local transport, activities, buffer) with low/medium/premium options and money-saving tips.",
  }

  const abortControllerRef = useRef<AbortController | null>(null)
  const lastUserMessageRef = useRef<string | null>(null)
  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      const el = chatScrollRef.current
      if (!el) return
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      })
    })
  }

  useEffect(() => {
    scrollToBottom(false)
  }, [messages])

  const visibleMessages = useMemo(() => {
    if (assistantMode !== ASSISTANT_MODES.TRAVEL_QA) return messages
    return messages.filter((m) => !isPlanningOnlyMessage(m))
  }, [assistantMode, messages])

  useEffect(() => {
    if (!destinationParam) return
    setAssistantMode("PLAN_TRIP")
    dispatchPlan({ type: "MERGE_CONTEXT", payload: { destinations: [destinationParam] } })
  }, [destinationParam])

  useEffect(() => {
    try {
      const rawPlan = localStorage.getItem(PLAN_CTX_KEY)
      if (rawPlan) {
        dispatchPlan({ type: "MERGE_CONTEXT", payload: JSON.parse(rawPlan) })
      }
      const rawQa = localStorage.getItem(QA_CTX_KEY)
      if (rawQa) {
        dispatchQa({ type: "MERGE", payload: JSON.parse(rawQa) })
      }
    } catch {
      // ignore malformed local data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(PLAN_CTX_KEY, JSON.stringify(planState.context))
  }, [planState.context])

  useEffect(() => {
    localStorage.setItem(QA_CTX_KEY, JSON.stringify(qaState))
  }, [qaState])


  // Load sessions once
  useEffect(() => {
    const saved = localStorage.getItem("travelgpt_sessions");
    if (saved) {
      const parsed: ChatSession[] = JSON.parse(saved);

      // If storage is empty/corrupt, create a new session
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const id = Date.now().toString();
        const first: ChatSession = {
          id,
          title: "New Trip",
          messages: initialMessages,
          createdAt: Date.now(),
        };
        setSessions([first]);
        setActiveSessionId(id);
        setMessages(initialMessages);
        return;
      }

      setSessions(parsed);
      const savedActive = localStorage.getItem("travelgpt_active_session")
      const active =
        parsed.find((s) => s.id === savedActive) ?? parsed[0]

      setActiveSessionId(active.id)
      setMessages(active.messages)



    }
    else {
      // create first session if none exist
      const id = Date.now().toString();
      const first: ChatSession = {
        id,
        title: "New Trip",
        messages: initialMessages,
        createdAt: Date.now(),
      };
      setSessions([first]);
      setActiveSessionId(id);
      setMessages(initialMessages);
    }
  }, []);

  // Persist sessions
  useEffect(() => {
    localStorage.setItem("travelgpt_sessions", JSON.stringify(sessions));
  }, [sessions]);
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem("travelgpt_active_session", activeSessionId)
    }
  }, [activeSessionId])


  const createNewChat = () => {
    const id = Date.now().toString();
    const newSession: ChatSession = {
      id,
      title: "New Trip",
      messages: initialMessages,
      createdAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(id);
    setMessages(initialMessages);
  };

  const appendAssistantMessage = (
    message: Message,
    opts?: { dedupeByContent?: boolean; sanitizePlanning?: boolean }
  ) => {
    const dedupeByContent = Boolean(opts?.dedupeByContent)
    const sanitizePlanning = Boolean(opts?.sanitizePlanning)
    setMessages((prev) => {
      const base = sanitizePlanning ? prev.filter((m) => !isPlanningOnlyMessage(m)) : prev
      if (dedupeByContent) {
        const last = base[base.length - 1]
        if (last?.role === "assistant" && last.content === message.content) return base
      }
      return [...base, message]
    })

    if (!activeSessionId) return
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== activeSessionId) return s
        const base = sanitizePlanning ? s.messages.filter((m) => !isPlanningOnlyMessage(m)) : s.messages
        if (dedupeByContent) {
          const last = base[base.length - 1]
          if (last?.role === "assistant" && last.content === message.content) return s
        }
        return { ...s, messages: [...base, message] }
      })
    )
  }

  const handleAssistantModeToggle = () => {
    if (assistantMode === ASSISTANT_MODES.PLAN_TRIP) {
      setAssistantMode("TRAVEL_QA")
      appendAssistantMessage(
        {
          id: `${Date.now()}-qa-copilot`,
          role: "assistant",
          content:
            "Travel Copilot is active. I can provide structured answers for visas, safety, weather windows, and budget planning with practical next steps.",
          timestamp: Date.now(),
          buttons: QA_COPILOT_BUTTONS,
          dataSource: "System: Travel Copilot mode",
        },
        { dedupeByContent: true, sanitizePlanning: true }
      )
      scrollToBottom(true)
      return
    }
    setAssistantMode("PLAN_TRIP")
  }

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    lastUserMessageRef.current = content;

    // Ensure session
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: "New Trip",
        messages: initialMessages,
        createdAt: Date.now(),
      };
      setSessions((p) => [newSession, ...p]);
      setActiveSessionId(sessionId);
      setMessages(initialMessages);
    }

    // User message
    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content: content.trim(),
      timestamp: Date.now(),
    };

    const sourceMessages =
      assistantMode === ASSISTANT_MODES.TRAVEL_QA
        ? messages.filter((m) => !isPlanningOnlyMessage(m))
        : messages

    const withUser = [
      ...sourceMessages.map((m) => (m.tripStyleSelector ? { ...m, tripStyleSelector: false } : m)),
      userMessage,
    ];
    setMessages(withUser);
    setInput("");

    // Create assistant placeholder
    // 3) CREATE ASSISTANT PLACEHOLDER (IMPORTANT)
    const assistantId = (Date.now() + 1).toString();

    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    const withAssistant = [...withUser, assistantMessage];
    setMessages(withAssistant);

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, messages: withAssistant } : s
      )
    );


    const updateAssistant = (updater: (m: Message) => Message) => {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? updater(m) : m)))
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map((m) => (m.id === assistantId ? updater(m as Message) : m)) as Message[] }
            : s
        )
      )
    }

    if (shouldStartOver(content)) {
      dispatchPlan({ type: "RESET" })
      dispatchQa({ type: "RESET" })
      setAssistantMode("TRAVEL_QA")
      updateAssistant((m) => ({
        ...m,
        content: "Trip planning context reset. You are now in Travel Q&A mode.",
      }))
      return
    }

    const intentResult = detectAssistantIntent(content, {
      currentMode: assistantMode,
      knownCities: destinations.map((d) => d.city),
      knownCountries: destinations.map((d) => d.country),
    })

    if (intentResult.entities.topic || intentResult.entities.country || intentResult.entities.city) {
      dispatchQa({
        type: "MERGE",
        payload: {
          lastTopic: intentResult.entities.topic || qaState.lastTopic,
          lastCountry: intentResult.entities.country || qaState.lastCountry,
          lastCity: intentResult.entities.city || qaState.lastCity,
        },
      })
    }

    const isPlanIntent = intentResult.intent === INTENTS.PLAN_TRIP
    const isQaIntent = intentResult.intent === INTENTS.TRAVEL_QA
    const isMixed = intentResult.intent === INTENTS.MIXED
    const isPlanStepInput =
      assistantMode === ASSISTANT_MODES.PLAN_TRIP &&
      (planState.step === "ORIGIN" || planState.step === "TRAVELERS" || planState.step === "DATES" || planState.step === "TRIP_STYLE")
    const treatAsPlan = isPlanIntent || (assistantMode === ASSISTANT_MODES.PLAN_TRIP && !isQaIntent && !isMixed)

    if (intentResult.intent === INTENTS.UNKNOWN && !isPlanStepInput) {
      updateAssistant((m) => ({
        ...m,
        content: "Are you trying to plan an itinerary, or do you have a travel question (visa/safety/etc.)?",
      }))
      return
    }

    if (treatAsPlan) {
      setAssistantMode("PLAN_TRIP")

      let nextContext = applyPlanEntityUpdate(planState.context, intentResult.entities)
      if (planState.step === "ORIGIN" && !nextContext.origin) nextContext = { ...nextContext, origin: content.trim() }
      if (planState.step === "TRAVELERS" && !nextContext.travelersCount) {
        const count = parseInt(content.trim())
        if (!Number.isNaN(count) && count > 0) nextContext = { ...nextContext, travelersCount: count }
      }
      dispatchPlan({ type: "MERGE_CONTEXT", payload: nextContext })

      const hasDestinationFromUi = Array.isArray(nextContext.selectedPlaces) && nextContext.selectedPlaces.length > 0
      const missing = getMissingPlanField(nextContext, hasDestinationFromUi)

      if (!missing && content.toLowerCase().includes("generate itinerary")) {
        saveTripPlan(nextContext)
        localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify(nextContext))
        updateAssistant((m) => ({
          ...m,
          content: "Generating itinerary with your saved trip details. Opening itinerary now.",
        }))
        router.push("/itinerary")
        return
      }

      if (missing === "dates") {
        dispatchPlan({ type: "SET_STEP", payload: "DATES" })
        setDateRange(undefined)
        setDatePickerMessageId(assistantId)
        setDatePickerOpen(false)
        updateAssistant((m) => ({
          ...m,
          content: getNextPlanQuestion("dates"),
          dateRangePicker: true,
        }))
        return
      }

      if (missing) {
        dispatchPlan({
          type: "SET_STEP",
          payload:
            missing === "origin"
              ? "ORIGIN"
              : missing === "travelersCount"
                ? "TRAVELERS"
                : missing === "tripStyle"
                  ? "TRIP_STYLE"
                  : "IDLE",
        })
        updateAssistant((m) => ({
          ...m,
          content: getNextPlanQuestion(missing),
          tripStyleSelector: missing === "tripStyle",
        }))
        return
      }

      dispatchPlan({ type: "SET_STEP", payload: "COMPLETE" })
      const style = String(nextContext.tripStyle || "Normal")
      const budgetLevel = style === "Relaxed" ? "low" : style === "Packed" ? "premium" : "medium"
      const finalizedContext = { ...nextContext, tripStyle: style, budgetLevel }
      dispatchPlan({ type: "MERGE_CONTEXT", payload: finalizedContext })

      const originGeo = await geocodeOriginCity(finalizedContext.origin || "")
      if (!originGeo) {
        dispatchPlan({ type: "SET_STEP", payload: "ORIGIN" })
        updateAssistant((m) => ({
          ...m,
          content:
            "I could not find that origin city. Please enter your departure city again (example: Delhi, Mumbai, New York).",
        }))
        return
      }

      const selectedPlaces = Array.isArray(finalizedContext.selectedPlaces) ? finalizedContext.selectedPlaces : []
      const destinationInputs =
        selectedPlaces.length > 0 ? selectedPlaces : (Array.isArray(finalizedContext.destinations) ? finalizedContext.destinations : [])

      const distances = await Promise.all(
        destinationInputs.map(async (place: any) => {
          const resolved = resolveDestinationForDistance(place)
          if (!resolved) return null
          const route = await fetchRouteDistance(
            { lat: originGeo.lat, lon: originGeo.lon },
            { lat: resolved.lat, lon: resolved.lon }
          )
          const fallbackKm = Math.round(calculateHaversineDistance(originGeo.lat, originGeo.lon, resolved.lat, resolved.lon))
          return {
            name: resolved.name,
            distanceKm: route?.distanceKm ?? fallbackKm,
            durationMins: route?.durationMins,
            isRouteBased: Boolean(route),
          }
        })
      )
      const filteredDistances = distances.filter(Boolean)
      let finalDistances = filteredDistances
      if (finalDistances.length === 0) {
        try {
          const selRes = await fetch("/api/selection")
          const selData = await selRes.json()
          const latestSelected = Array.isArray(selData?.selectedPlaces) ? selData.selectedPlaces : []
          finalDistances = (
            await Promise.all(
              latestSelected.map(async (place: any) => {
              const resolved = resolveDestinationForDistance(place)
              if (!resolved) return null
              const route = await fetchRouteDistance(
                { lat: originGeo.lat, lon: originGeo.lon },
                { lat: resolved.lat, lon: resolved.lon }
              )
              const fallbackKm = Math.round(calculateHaversineDistance(originGeo.lat, originGeo.lon, resolved.lat, resolved.lon))
              return {
                name: resolved.name,
                distanceKm: route?.distanceKm ?? fallbackKm,
                durationMins: route?.durationMins,
                isRouteBased: Boolean(route),
              }
            })
            )
          )
            .filter(Boolean)
          if (finalDistances.length > 0) {
            dispatchPlan({ type: "MERGE_CONTEXT", payload: { selectedPlaces: latestSelected } })
          }
        } catch {
          // keep fallback message if selection refresh fails
        }
      }

      const summaryText =
        `You're traveling from ${finalizedContext.origin}, dates ${format(new Date(finalizedContext.startDate), "dd MMM")}–${format(new Date(finalizedContext.endDate), "dd MMM")}, ${finalizedContext.travelersCount} travelers, style ${style}. Now calculating distance and budget...`

      const distanceText =
        finalDistances.length > 0
          ? `✅ Distance estimates:\n\n${finalDistances
              .map((d: any) =>
                `${finalizedContext.origin} → ${d.name}: ${d.distanceKm} km${d?.durationMins ? ` (~${d.durationMins} mins)` : ""}`
              )
              .join("\n")}`
          : "✅ Distance estimates:\n\nDistance data unavailable for selected destination coordinates."

      const contextWithDistances = { ...finalizedContext, distanceEstimates: finalDistances }
      saveTripPlan(contextWithDistances)
      localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify(contextWithDistances))
      updateAssistant((m) => ({
        ...m,
        content: `${summaryText}\n\n${distanceText}`,
        buttons: ["Look estimated budget"],
      }))
      return
    }

    const clarifier = getQaClarifier(intentResult, qaState)
    if (clarifier) {
      setAssistantMode("TRAVEL_QA")
      if (assistantMode === ASSISTANT_MODES.PLAN_TRIP) {
        const hasDestinationFromUi = Array.isArray(planState.context.selectedPlaces) && planState.context.selectedPlaces.length > 0
        const missing = getMissingPlanField(planState.context, hasDestinationFromUi)
        const followUp = missing ? getNextPlanQuestion(missing) : "We are ready to generate your itinerary."
        updateAssistant((m) => ({ ...m, content: `${clarifier}\n\nNext for your trip plan: ${followUp}` }))
        setAssistantMode("PLAN_TRIP")
      } else {
        updateAssistant((m) => ({ ...m, content: clarifier }))
      }
      return
    }

    const city = extractCityForWeather(content)
    if (city) {
      setAssistantMode("TRAVEL_QA")
      setIsTyping(true)
      try {
        const res = await fetch("/api/weather", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Weather API failed")
        updateAssistant((m) => ({
          ...m,
          content: `Here is the current weather for **${data.city}**:`,
          weather: data,
        }))
      } catch (e: any) {
        updateAssistant((m) => ({ ...m, content: `Weather error: ${e.message}` }))
      } finally {
        setIsTyping(false)
        scrollToBottom(true)
      }
      return
    }

    const budgetQuery = extractBudgetQuery(content)
    if (budgetQuery && isQaIntent) {
      setAssistantMode("TRAVEL_QA")
      setIsTyping(true)
      try {
        const res = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(budgetQuery),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        updateAssistant((m) => ({
          ...m,
          content: `Here is an estimated budget for **${data.destination}**:`,
          budget: data,
        }))
      } catch (e: any) {
        updateAssistant((m) => ({ ...m, content: `${e.message}` }))
      } finally {
        setIsTyping(false)
      }
      return
    }

    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    setIsTyping(true)
    setAssistantMode("TRAVEL_QA")

    try {
      const history = withUser.map((m) => ({ role: m.role, content: m.content }))
      let generated = ""
      await streamGroqResponse(
        history,
        (token) => {
          generated += token
          updateAssistant((m) => ({ ...m, content: m.content + token }))
          scrollToBottom(false)
        },
        abortControllerRef.current.signal,
        {
          mode: "TRAVEL_QA",
          intent: intentResult.intent,
          planTripContext: planState.context,
          qaContext: qaState,
        }
      )

      if (isMixed || (assistantMode === ASSISTANT_MODES.PLAN_TRIP && isQaIntent)) {
        const nextContext = applyPlanEntityUpdate(planState.context, intentResult.entities)
        dispatchPlan({ type: "MERGE_CONTEXT", payload: nextContext })
        const hasDestinationFromUi = Array.isArray(nextContext.selectedPlaces) && nextContext.selectedPlaces.length > 0
        const missing = getMissingPlanField(nextContext, hasDestinationFromUi)
        const followUp = missing ? getNextPlanQuestion(missing) : "We are ready to generate your itinerary."
        updateAssistant((m) => ({
          ...m,
          content: `${generated.trim()}\n\nNext for your trip plan: ${followUp}`,
        }))
        setAssistantMode("PLAN_TRIP")
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        updateAssistant((m) => ({ ...m, content: `${e.message || "Something went wrong"}` }))
      }
    } finally {
      setIsTyping(false)
      abortControllerRef.current = null
      scrollToBottom(true)
    }
  };


  const handleConfirmDates = () => {
    if (!dateRange?.from || !dateRange?.to) return
    if (!activeSessionId) return

    // Extract dates for type safety
    const startDate = dateRange.from
    const endDate = dateRange.to

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content: `Travel dates: ${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`,
      timestamp: Date.now(),
    }

    const botMessage: Message = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      content: "How many travelers?",
      timestamp: Date.now(),
    }

    dispatchPlan({
      type: "MERGE_CONTEXT",
      payload: {
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        tripDuration: differenceInCalendarDays(endDate, startDate) + 1,
      },
    })
    dispatchPlan({ type: "SET_STEP", payload: "TRAVELERS" })
    setAssistantMode("PLAN_TRIP")

    setMessages((prev) => {
      const next = prev.map((m) =>
        m.id === datePickerMessageId ? { ...m, dateRangePicker: false } : m
      )
      return [...next, userMessage, botMessage]
    })

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
            ...s,
            messages: [
              ...s.messages.map((m) =>
                m.id === datePickerMessageId ? { ...m, dateRangePicker: false } : m
              ),
              userMessage,
              botMessage,
            ],
          }
          : s
      )
    )

    setDatePickerMessageId(null)
    setDatePickerOpen(false)
    scrollToBottom(true)
  }

  const handleSelectBudget = (level: "low" | "medium" | "premium") => {
    const budgetLabels = {
      low: "Low Budget",
      medium: "Medium Budget",
      premium: "Premium"
    }

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content: `Budget: ${budgetLabels[level]}`,
      timestamp: Date.now(),
    }

    const botMsg: Message = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      content: "Any preferences? (Optional)",
      timestamp: Date.now(),
      preferenceSelector: true,
    }

    dispatchPlan({ type: "MERGE_CONTEXT", payload: { budgetLevel: level } })
    dispatchPlan({ type: "SET_STEP", payload: "PREFERENCES" })
    setMessages(prev => {
      // Disable selector on previous message
      const next = prev.map(m => m.budgetSelector ? { ...m, budgetSelector: false } : m)
      return [...next, userMsg, botMsg]
    })
    scrollToBottom(true)
  }

  const handleConfirmPreferences = async (prefs: string[], custom?: string) => {
    const allPrefs = [...prefs]
    if (custom?.trim()) allPrefs.push(custom.trim())

    const content = allPrefs.length > 0
      ? `Preferences: ${allPrefs.join(", ")}`
      : "Skipped preferences"

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      content: content,
      timestamp: Date.now(),
    }

    const botMsg: Message = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      content: "Awesome! I have all your details. I'm now generating your perfect itinerary...",
      timestamp: Date.now(),
    }

    const updatedTripData = { ...planState.context, preferences: allPrefs }
    dispatchPlan({ type: "MERGE_CONTEXT", payload: { preferences: allPrefs } })
    dispatchPlan({ type: "SET_STEP", payload: "COMPLETE" })

    // Use user-selected places first; only then fallback to origin-city match, then dataset first item.
    const selectedPlaces = Array.isArray(updatedTripData.selectedPlaces) ? updatedTripData.selectedPlaces : []
    const selectedStart = selectedPlaces[0]
    const resolvedStart = resolveDestinationForDistance(selectedStart)
    const fallbackDest = destinations[0]

    const toPlaceName = resolvedStart?.name || selectedStart?.name || fallbackDest.name

    // Compute distance
    const fromCoords = getCityCoords(updatedTripData.origin || "")
    const hasSelectedCoords = Number.isFinite(resolvedStart?.lat) && Number.isFinite(resolvedStart?.lon)
    const toCoords = hasSelectedCoords
      ? { lat: Number(resolvedStart?.lat), lng: Number(resolvedStart?.lon) }
      : { lat: fallbackDest.latitude, lng: fallbackDest.longitude }

    let distanceKm = 0
    let durationMins = 0
    if (fromCoords) {
      const route = await fetchRouteDistance(
        { lat: fromCoords.lat, lon: fromCoords.lng },
        { lat: toCoords.lat, lon: toCoords.lng }
      )
      distanceKm = route?.distanceKm ?? calculateHaversineDistance(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng)
      durationMins = route?.durationMins ?? (Math.round(distanceKm / 800 * 60) + 120)
    }

    const ctaMsg: Message = {
      id: `${Date.now()}-cta`,
      role: "assistant",
      content: `Your trip starts at: ${toPlaceName}.`,
      timestamp: Date.now() + 100,
      distanceAndBudgetCTA: true,
      ctaPayload: {
        fromCity: updatedTripData.origin || "Your location",
        toPlace: toPlaceName,
        distanceKm: distanceKm,
        durationMins: durationMins || (Math.round(distanceKm / 800 * 60) + 120)
      }
    }

    setMessages(prev => {
      const next = prev.map(m => m.preferenceSelector ? { ...m, preferenceSelector: false } : m)
      return [...next, userMsg, botMsg, ctaMsg]
    })

    // Save to DB with full data
    saveTripPlan(updatedTripData)

    scrollToBottom(true)
  }

  const handleNavigateToBudget = async () => {
    let existingContext: any = {}
    try {
      const raw = localStorage.getItem("WANDERLY_TRIP_CONTEXT")
      if (raw) {
        const parsed = JSON.parse(raw)
        existingContext = parsed?.tripContext || parsed || {}
      }
    } catch {
      existingContext = {}
    }
    const nextContext = { ...existingContext, ...planState.context }
    localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify(nextContext))
    await saveTripPlan(nextContext)
    router.push("/budget")
  }

  const handleMessageButtonClick = (btn: string) => {
    if (btn === "Look estimated budget" || btn === "Show estimated budget") {
      void handleNavigateToBudget()
      return
    }
    if (assistantMode === ASSISTANT_MODES.TRAVEL_QA && QA_QUICK_PROMPTS[btn]) {
      void handleSend(QA_QUICK_PROMPTS[btn])
      return
    }
    void handleSend(btn)
  }

  const handleSliderChange = (value: number[]) => {
    const budgetDests = destinations.filter((d) => d.budget.min <= value[0])
    handleSend(`Show destinations with budget under $${value[0]} per day (found ${budgetDests.length} matches)`)
  }

  // Check for selected places from Destinations page
  const selectionCheckedRef = useRef<string | null>(null)
  useEffect(() => {
    // Never run planning-selection prompts while in Q&A mode.
    if (assistantMode !== ASSISTANT_MODES.PLAN_TRIP) return
    if (!activeSessionId) return
    let cancelled = false
    const checkKey = `${activeSessionId}:${forceStartPlan ? "forced" : "normal"}`
    if (selectionCheckedRef.current === checkKey) return
    selectionCheckedRef.current = checkKey

    const checkSelection = async () => {
      try {
        const res = await fetch("/api/selection")
        const data = await res.json()
        const selectedPlaces = Array.isArray(data?.selectedPlaces) ? data.selectedPlaces : []
        const selectedIds = Array.isArray(data?.selectedIds) ? data.selectedIds : []
        const hasSelectedPlaces = selectedPlaces.length > 0
        const hasSelectedIds = selectedIds.length > 0
        const hasAnySelection = hasSelectedPlaces || hasSelectedIds

        if (forceStartPlan || hasAnySelection) {
          if (cancelled) return
          const names = selectedPlaces.map((p: any) => p.name).join(", ")
          const content = hasSelectedPlaces
            ? `You selected: ${names}. Where are you traveling from?`
            : "Where are you traveling from?"

          const selectionMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content,
            timestamp: Date.now(),
          }

          setMessages((prev) => {
            const alreadyAsked = prev.some(
              (m) => m.role === "assistant" && m.content === selectionMessage.content
            )
            if (!forceStartPlan && alreadyAsked) return prev
            return [...prev, selectionMessage]
          })

          setAssistantMode("PLAN_TRIP")
          dispatchPlan({ type: "RESET" })
          dispatchPlan({ type: "SET_STEP", payload: "ORIGIN" })

          const destinationSeeds = hasSelectedPlaces
            ? selectedPlaces.map((p: any) => p.name)
            : selectedIds.map((id: any) => String(id))

          dispatchPlan({
            type: "MERGE_CONTEXT",
            payload: {
              selectedPlaces,
              destinations: destinationSeeds,
            },
          })

          setSessions((prev) =>
            prev.map((s) => {
              if (s.id !== activeSessionId) return s
              const alreadyAsked = s.messages.some(
                (m) => m.role === "assistant" && m.content === selectionMessage.content
              )
              if (!forceStartPlan && alreadyAsked) return s
              return { ...s, messages: [...s.messages, selectionMessage] }
            })
          )
        }
      } catch {
        if (forceStartPlan) {
          if (cancelled) return
          const fallbackMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: "Where are you traveling from?",
            timestamp: Date.now(),
          }
          setMessages((prev) => [...prev, fallbackMessage])
          setAssistantMode("PLAN_TRIP")
          dispatchPlan({ type: "RESET" })
          dispatchPlan({ type: "SET_STEP", payload: "ORIGIN" })
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSessionId ? { ...s, messages: [...s.messages, fallbackMessage] } : s
            )
          )
        }
      } finally {
        if (forceStartPlan) {
          router.replace("/chat?mode=plan")
        }
      }
    }

    checkSelection()
    return () => {
      cancelled = true
    }
  }, [activeSessionId, forceStartPlan, assistantMode, router]) // Depend on activeSessionId to ensure we update the right session

  return (
    <div className="flex h-screen flex-col bg-background">
      <Navigation />

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-64 flex-shrink-0 border-r bg-card lg:block">
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <Button className="w-full gap-2 bg-transparent" variant="outline" onClick={createNewChat}
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-4">

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Datasets Loaded</p>
                  <div className="space-y-1 text-xs">
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">World Famous Places (20)</div>
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">TripAdvisor Reviews (982)</div>
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">Budget Estimates (14)</div>
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">Weather Data (5 cities)</div>
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">Hotels (8 properties)</div>
                    <div className="rounded bg-secondary/50 px-2 py-1 text-muted-foreground">Chat Intents (6 intents)</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center gap-2">
                      {editingSessionId === session.id ? (
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => {
                            setSessions((prev) =>
                              prev.map((s) =>
                                s.id === session.id ? { ...s, title: editingTitle || s.title } : s
                              )
                            )
                            setEditingSessionId(null)
                          }}
                          className="w-full rounded border px-2 py-1 text-sm"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setActiveSessionId(session.id)
                            setMessages(session.messages)
                          }}
                          className={`flex-1 text-left px-3 py-2 rounded-md text-sm
          ${session.id === activeSessionId ? "bg-accent" : "hover:bg-muted"}
        `}
                        >
                          {session.title}
                        </button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingSessionId(session.id)
                          setEditingTitle(session.title)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSessions((prev) => prev.filter((s) => s.id !== session.id))

                          if (session.id === activeSessionId) {
                            const remaining = sessions.filter((s) => s.id !== session.id)
                            if (remaining.length > 0) {
                              setActiveSessionId(remaining[0].id)
                              setMessages(remaining[0].messages)
                            } else {
                              createNewChat()
                            }
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                    </div>
                  ))}

                </div>

              </div>
            </div>

            <div className="border-t p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-foreground">Travel Explorer</p>
                  <p className="text-xs text-muted-foreground">Dataset Mode</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col">
          <div className="border-b bg-card px-4 py-3">
            <div className="mx-auto flex max-w-3xl items-center justify-between">
              <div className="text-sm font-medium text-foreground">
                {assistantMode === ASSISTANT_MODES.PLAN_TRIP ? "Planning your trip" : "Travel Q&A"}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAssistantModeToggle}
              >
                {assistantMode === ASSISTANT_MODES.PLAN_TRIP ? "Switch to Q&A" : "Switch to Planning"}
              </Button>
            </div>
          </div>
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto max-w-3xl space-y-6">
              {visibleMessages.length === 1 && (
                <div className="mb-8 text-center">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h1 className="mb-2 text-2xl font-bold text-foreground">Ready when you are.</h1>
                  <p className="text-muted-foreground">Ask me about destinations, budgets, weather, or hotels</p>
                </div>
              )}

              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex gap-4", message.role === "user" && "flex-row-reverse")}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-secondary"
                    )}
                  >
                    {message.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>

                  <div className={cn("flex max-w-[80%] flex-col gap-3", message.role === "user" && "items-end")}>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3",
                        message.role === "assistant" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
                      )}
                    >
                      <MessageContent content={message.content} />
                    </div>
                    {/* Budget Card */}
                    {message.budget && message.role === "assistant" && (
                      <BudgetCard b={message.budget} />
                    )}

                    {/* Weather Card */}
                    {message.weather && message.role === "assistant" && (
                      <WeatherCard w={message.weather} />
                    )}


                    {/* Data source indicator */}
                    {message.dataSource && message.role === "assistant" && (
                      <p className="text-xs text-muted-foreground italic">{message.dataSource}</p>
                    )}

                    {/* Destination Cards */}
                    {message.cards && (
                      <div className="flex flex-wrap gap-3">
                        {message.cards.map((card) => (
                          <Card key={card.id} className="w-48 overflow-hidden">
                            <div className="relative aspect-[4/3]">
                              <Image src={card.image || "/placeholder.svg"} alt={card.name} fill className="object-cover" />
                              {card.isUNESCO && (
                                <Badge className="absolute left-2 top-2 gap-1 bg-chart-3 text-xs text-chart-3-foreground">
                                  <Award className="h-3 w-3" />
                                  UNESCO
                                </Badge>
                              )}
                            </div>
                            <CardContent className="p-3">
                              <h4 className="font-medium text-foreground">{card.name}</h4>
                              <p className="text-xs text-muted-foreground">{card.country}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs font-medium text-primary">{card.price}</span>
                                <Badge variant="secondary" className="text-xs">{card.rating}</Badge>
                              </div>
                              {card.visitors && (
                                <p className="mt-1 text-xs text-muted-foreground">{card.visitors} visitors</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {message.buttons && (
                      <div className="flex flex-wrap gap-2">
                        {message.buttons.map((btn) => (
                          <Button
                            key={btn}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleMessageButtonClick(btn)
                            }}
                          >
                            {btn}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* SLIDER (Budget) */}
                    {message.slider && (
                      <Card className="w-full max-w-sm p-4">
                        <p className="mb-4 text-sm font-medium text-foreground">{message.slider.label}</p>
                        <Slider
                          defaultValue={[message.slider.value]}
                          min={message.slider.min}
                          max={message.slider.max}
                          step={10}
                          onValueCommit={handleSliderChange}
                        />
                        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                          <span>${message.slider.min}</span>
                          <span>${message.slider.max}</span>
                        </div>
                      </Card>
                    )}
                    {message.dateRangePicker && (
                      <Card className="w-full max-w-lg p-5 border shadow-lg">
                        <div className="flex flex-col gap-4">
                          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="lg"
                                className="justify-start gap-3 h-14 text-base font-medium border-2 hover:bg-accent/5 hover:border-primary transition-colors"
                              >
                                <span className="text-xl">📅</span>
                                <span className="flex-1 text-left">
                                  {dateRange?.from && dateRange?.to
                                    ? `${format(dateRange.from, "dd MMM yyyy")} – ${format(dateRange.to, "dd MMM yyyy")}`
                                    : "Pick start and end dates"}
                                </span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0 border-2 shadow-xl"
                              align="start"
                            >
                              <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
                                captionLayout="dropdown"
                                startMonth={new Date()}
                                endMonth={new Date(new Date().getFullYear() + 3, 11)}
                                disabled={{ before: new Date() }}
                                autoFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <div className="flex justify-end">
                            <Button
                              size="lg"
                              onClick={handleConfirmDates}
                              disabled={!dateRange?.from || !dateRange?.to}
                              className="bg-primary hover:bg-primary/90 text-base font-semibold px-8 h-12 disabled:opacity-50"
                            >
                              ✓ Confirm Dates
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}

                    {message.budgetSelector && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {(["low", "medium", "premium"] as const).map((level) => (
                          <Button
                            key={level}
                            variant="outline"
                            className="bg-background hover:bg-primary hover:text-primary-foreground border-2 h-12 px-6 text-base font-medium capitalize"
                            onClick={() => handleSelectBudget(level)}
                          >
                            {level === "low" ? "Low Budget" : level === "medium" ? "Medium Budget" : "Premium"}
                          </Button>
                        ))}
                      </div>
                    )}

                    {message.preferenceSelector && (
                      <Card className="w-full max-w-lg p-5 border shadow-lg mt-2">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap gap-2">
                            {[
                              "Family Trip", "Couple Trip", "Friends Trip", "Solo",
                              "Adventure", "Relaxation", "Shopping", "Food & Culture"
                            ].map((pref) => (
                              <Badge
                                key={pref}
                                variant={selectedPrefs.includes(pref) ? "default" : "outline"}
                                className="cursor-pointer px-3 py-1.5 text-sm transition-all hover:scale-105"
                                onClick={() => {
                                  setSelectedPrefs(prev =>
                                    prev.includes(pref)
                                      ? prev.filter(p => p !== pref)
                                      : [...prev, pref]
                                  )
                                }}
                              >
                                {pref}
                              </Badge>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Other preferences..."
                              className="min-h-[44px] max-h-32 flex-1"
                              value={preferencesInput}
                              onChange={(e) => setPreferencesInput(e.target.value)}
                            />
                          </div>

                          <div className="flex justify-between items-center">
                            <Button variant="ghost" onClick={() => handleConfirmPreferences([], "")}>
                              Skip
                            </Button>
                            <Button
                              onClick={() => {
                                handleConfirmPreferences(selectedPrefs, preferencesInput)
                                setPreferencesInput("")
                                setSelectedPrefs([])
                              }}
                              className="bg-primary px-8"
                            >
                              Confirm
                            </Button>
                          </div>
                        </div>
                      </Card>
                    )}

                    {message.tripStyleSelector && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        {(["Relaxed", "Normal", "Packed"] as const).map((style) => (
                          <Button
                            key={style}
                            variant="outline"
                            className="bg-background hover:bg-primary hover:text-primary-foreground border-2 h-12 px-6 text-base font-medium"
                            onClick={() => handleSend(style)}
                          >
                            {style}
                          </Button>
                        ))}
                      </div>
                    )}

                    {message.distanceAndBudgetCTA && message.ctaPayload && (
                      <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <Card className="w-full max-w-lg overflow-hidden border-2 shadow-sm">
                          <div className="bg-primary/5 p-4 border-b">
                            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                              <span>Travel Distance</span>
                              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase">Calculated</span>
                            </div>
                          </div>
                          <div className="p-5 flex flex-col gap-4">
                            <div className="flex items-start gap-4">
                              <div className="relative flex flex-col items-center gap-1 mt-1">
                                <div className="w-3 h-3 rounded-full bg-primary" />
                                <div className="w-0.5 h-10 border-l-2 border-dashed border-primary/30" />
                                <div className="w-3 h-3 rounded-full border-2 border-primary bg-background" />
                              </div>
                              <div className="flex flex-col gap-6 flex-1">
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">From</span>
                                  <span className="text-lg font-extrabold leading-tight line-clamp-1">{message.ctaPayload.fromCity}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">To</span>
                                  <span className="text-lg font-extrabold leading-tight line-clamp-1">{message.ctaPayload.toPlace}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-3xl font-black text-primary tracking-tighter">
                                  {message.ctaPayload.distanceKm.toLocaleString()}
                                  <span className="text-sm font-medium ml-1 uppercase">km</span>
                                </span>
                                {message.ctaPayload.durationMins && (
                                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap bg-accent/10 px-2 py-1 rounded">
                                    ⏱️ ~{Math.floor(message.ctaPayload.durationMins / 60)}h {message.ctaPayload.durationMins % 60}m
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-6 h-14 text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all group rounded-xl"
                            onClick={handleNavigateToBudget}
                          >
                            Show estimated budget
                            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                          </Button>
                          <Button
                            variant="outline"
                            className="border-2 font-bold h-14 px-6 text-lg hover:bg-accent/5 transition-all rounded-xl"
                            onClick={() => router.push("/itinerary")}
                          >
                            Open itinerary
                          </Button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl bg-secondary px-4 py-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}

              {visibleMessages.length === 1 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {chatSuggestions.slice(0, 4).map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-secondary"
                    >
                      <p className="text-sm text-foreground">{suggestion}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t bg-card p-4">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-center gap-2 rounded-2xl border bg-background p-2">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <Plus className="h-5 w-5" />
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(input);
                    }
                  }}
                  placeholder={assistantMode === ASSISTANT_MODES.PLAN_TRIP
                    ? "Plan your trip... (e.g., 'I am traveling from Mumbai')"
                    : "Ask your Travel Copilot... (e.g., 'Visa checklist for Indian passport to Japan')"}
                  className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent focus-visible:ring-0"
                />

                <Button variant="ghost" size="icon" className="shrink-0">
                  <Mic className="h-5 w-5" />
                </Button>
                {isTyping ? (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => abortControllerRef.current?.abort()}
                    className="shrink-0"
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim()}
                    className="shrink-0"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                )}

              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Powered by World Famous Places 2024 + TripAdvisor Reviews datasets
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
