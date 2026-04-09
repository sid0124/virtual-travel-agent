import { DEFAULT_CURRENCY } from "@/lib/currency"
import { readTripPlan, saveTripPlan, type TripPlan } from "@/lib/trip-plan"
import {
  normalizeChatbotPlace,
  normalizeChatbotPlaces,
  type PlannerDestination,
  type PlannerDestinationSourceType,
} from "@/lib/planner-destination"

export type NormalizedDestination = {
  originalName: string
  label: string
  type: "state" | "city" | "landmark" | "beach" | "district" | "monument"
  city?: string
  state?: string
  country?: string
  destinationKey: string
}

export type ChatRecommendationPayload = {
  type: "recommendations" | "nearby_places"
  places: NormalizedDestination[]
}

export type ChatItineraryPayload = {
  type: "itinerary"
  itinerary: {
    title: string
    destination: NormalizedDestination
    durationDays: number
    days: Array<{
      day: number
      items: Array<{
        time?: string
        activity: string
        category?: string
        locationName?: string
      }>
    }>
  }
}

export type ChatActionablePayload = ChatRecommendationPayload | ChatItineraryPayload

type DayOption = {
  key: string
  dayNumber: number
  date?: string
  label: string
}

type SaveChatItineraryInput = {
  miniPlan: any
  mainDestination: PlannerDestination
  memory: any
  dayOptions: DayOption[]
}

const SUPPORTED_DESTINATION_TYPES = new Set<NormalizedDestination["type"]>([
  "state",
  "city",
  "landmark",
  "beach",
  "district",
  "monument",
])

function normalizeText(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function normalizeDestinationType(type?: string): NormalizedDestination["type"] {
  const value = normalizeText(type || "")
  if (SUPPORTED_DESTINATION_TYPES.has(value as NormalizedDestination["type"])) {
    return value as NormalizedDestination["type"]
  }
  if (value === "attraction") return "landmark"
  if (value === "destination" || value === "region") return "city"
  return "city"
}

function blockTime(timing: string | undefined, index: number, subtype?: string) {
  const normalizedTiming = normalizeText(timing || "")
  if (normalizedTiming.includes("morning")) return "09:00"
  if (normalizedTiming.includes("afternoon")) return "13:00"
  if (normalizedTiming.includes("evening")) return "18:00"
  if (normalizedTiming.includes("night")) return "20:00"
  if (/^\d{1,2}:\d{2}$/.test(String(timing || ""))) return String(timing)
  const slots =
    subtype === "evening" || subtype === "romantic"
      ? ["17:30", "18:30", "19:45", "21:00", "22:00"]
      : ["09:00", "10:30", "12:00", "14:00", "16:00", "18:00"]
  return slots[index] || slots[slots.length - 1]
}

function durationMinutes(durationText?: string) {
  const value = String(durationText || "")
  if (/\b30\b/.test(value)) return 30
  if (/\b45\b/.test(value)) return 45
  if (/\b90\b/.test(value)) return 90
  if (/\b2\b/.test(value) && /hour|hr/.test(value)) return 120
  if (/\b3\b/.test(value) && /hour|hr/.test(value)) return 180
  return 60
}

function buildNormalizedDestination(destination: PlannerDestination): NormalizedDestination {
  return {
    originalName: destination.originalName || destination.name,
    label: destination.name,
    type: normalizeDestinationType(destination.sourceType),
    city: destination.city,
    state: destination.state,
    country: destination.country,
    destinationKey: destination.destinationKey || destination.id,
  }
}

function createBaseTripPlan(memory: any, mainDestination: PlannerDestination, dayOptions: DayOption[]): TripPlan {
  const timestamp = Date.now()
  const cityLabel = mainDestination.city || mainDestination.name
  const days = dayOptions.map((option) => ({
    dayNumber: option.dayNumber,
    date: option.date || "",
    title: option.dayNumber === 1 ? `Arrival & ${cityLabel}` : `Explore ${cityLabel}`,
    city: cityLabel,
    activities: [],
  }))

  return {
    tripContext: {
      ...memory,
      startDate: memory?.dateRange?.from || dayOptions[0]?.date || "",
      endDate: memory?.dateRange?.to || dayOptions[dayOptions.length - 1]?.date || memory?.dateRange?.from || "",
      dateRange: {
        from: memory?.dateRange?.from || dayOptions[0]?.date || "",
        to: memory?.dateRange?.to || dayOptions[dayOptions.length - 1]?.date || memory?.dateRange?.from || "",
      },
      selectedPlaces: Array.isArray(memory?.selectedDestinations)
        ? memory.selectedDestinations.map((item: any) => ({
            name: item.name,
            city: item.city || item.name,
            country: item.country,
            latitude: item.latitude,
            longitude: item.longitude,
          }))
        : [],
    },
    segments: [],
    bookings: {
      hotelsByCity: {},
      flightsBySegment: {},
      skippedHotelsByCity: {},
      skippedFlightsBySegment: {},
    },
    itinerary: {
      days,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    lastUpdatedAt: timestamp,
  }
}

export function resolveDestinationKey(place: any) {
  return normalizePlaceSelection(place)?.destinationKey || ""
}

export function normalizePlaceSelection(place?: any): PlannerDestination | null {
  return normalizeChatbotPlace(place)
}

export async function hydrateDestinationPageFromChatSelection() {
  const response = await fetch("/api/selection", { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to hydrate destination page selection (${response.status})`)
  }
  return response.json()
}

export function buildChatRecommendationPayload(
  type: ChatRecommendationPayload["type"],
  places: any[]
): ChatRecommendationPayload {
  return {
    type,
    places: normalizeChatbotPlaces(places).map(buildNormalizedDestination),
  }
}

export function buildChatItineraryPayload(miniPlan: any, destination: any): ChatItineraryPayload | null {
  const normalizedDestination = normalizePlaceSelection(destination)
  if (!miniPlan || !normalizedDestination) return null

  const days =
    Array.isArray(miniPlan.days) && miniPlan.days.length > 0
      ? miniPlan.days.map((day: any, dayIndex: number) => ({
          day: Number(day.dayNumber) || dayIndex + 1,
          items: (day.blocks || []).map((block: any, blockIndex: number) => ({
            time: blockTime(block?.timing, blockIndex, miniPlan?.subtype),
            activity: String(block?.title || "Activity"),
            category: /food|cafe|snack|lunch|dinner|dessert/i.test(`${block?.title} ${block?.detail} ${block?.tag}`) ? "food" : block?.tag || "sightseeing",
            locationName: normalizedDestination.name,
          })),
        }))
      : [
          {
            day: 1,
            items: (miniPlan.stops || []).map((stop: any, index: number) => ({
              time: blockTime(stop?.timing, index, miniPlan?.subtype),
              activity: String(stop?.title || "Activity"),
              category: /food|cafe|snack|lunch|dinner|dessert/i.test(`${stop?.title} ${stop?.detail} ${stop?.tag}`) ? "food" : stop?.tag || "sightseeing",
              locationName: normalizedDestination.name,
            })),
          },
        ]

  return {
    type: "itinerary",
    itinerary: {
      title: String(miniPlan.title || `${normalizedDestination.name} itinerary`),
      destination: buildNormalizedDestination(normalizedDestination),
      durationDays: Math.max(1, Number(miniPlan.durationDays) || days.length || 1),
      days,
    },
  }
}

export function saveChatItinerary(input: SaveChatItineraryInput) {
  const { miniPlan, mainDestination, memory, dayOptions } = input
  const existingPlan = readTripPlan()
  const basePlan =
    existingPlan ||
    createBaseTripPlan(
      memory,
      mainDestination,
      dayOptions?.length ? dayOptions : [{ key: "day-1", dayNumber: 1, label: "Day 1" }]
    )
  const subtype = normalizeText(miniPlan?.subtype)
  const cityLabel = mainDestination.city || mainDestination.name

  let nextDays = basePlan.itinerary.days
  if (Array.isArray(miniPlan.days) && miniPlan.days.length > 0) {
    nextDays = miniPlan.days.map((day: any, dayIndex: number) => {
      const existingDay = basePlan.itinerary.days.find((item) => item.dayNumber === day.dayNumber)
      const baseDay = existingDay || basePlan.itinerary.days[dayIndex] || {
        dayNumber: day.dayNumber || dayIndex + 1,
        date: dayOptions?.[dayIndex]?.date || "",
        title: day.title || `Explore ${cityLabel}`,
        city: cityLabel,
        activities: [],
      }

      return {
        ...baseDay,
        dayNumber: day.dayNumber || dayIndex + 1,
        title: day.title || baseDay.title,
        city: cityLabel,
        activities: (day.blocks || []).map((block: any, blockIndex: number) => ({
          id: `ai-mini-plan-${normalizeText(mainDestination.name)}-${day.dayNumber || dayIndex + 1}-${blockIndex + 1}`,
          type: /food|cafe|snack|lunch|dinner|dessert/i.test(`${block?.title} ${block?.detail} ${block?.tag}`) ? "food" as const : "sightseeing" as const,
          title: block.title,
          time: blockTime(block?.timing, blockIndex, subtype),
          locationLabel: cityLabel,
          cost: 0,
          currency: DEFAULT_CURRENCY,
          durationMinutes: durationMinutes(block?.duration),
          aiNotes: [block?.detail, block?.note].filter(Boolean).join(" "),
          meta: {
            placeId: block?.id,
            source: "ai-chat-mini-plan",
            timingLabel: block?.timing,
            tag: block?.tag,
          },
        })),
      }
    })
  } else {
    const firstDay = basePlan.itinerary.days[0] || {
      dayNumber: 1,
      date: memory?.dateRange?.from || "",
      title: miniPlan.title,
      city: cityLabel,
      activities: [],
    }
    firstDay.title = miniPlan.title || firstDay.title
    firstDay.city = cityLabel
    firstDay.activities = (miniPlan.stops || []).map((stop: any, index: number) => ({
      id: `ai-mini-plan-${normalizeText(mainDestination.name)}-1-${index + 1}`,
      type: /food|cafe|snack|lunch|dinner|dessert/i.test(`${stop?.title} ${stop?.detail} ${stop?.tag}`) ? "food" as const : "sightseeing" as const,
      title: stop.title,
      time: blockTime(stop?.timing, index, subtype),
      locationLabel: cityLabel,
      cost: 0,
      currency: DEFAULT_CURRENCY,
      durationMinutes: durationMinutes(stop?.duration),
      aiNotes: [stop?.detail, stop?.note].filter(Boolean).join(" "),
      meta: {
        placeId: stop?.id,
        source: "ai-chat-mini-plan",
        timingLabel: stop?.timing,
        tag: stop?.tag,
      },
    }))
    nextDays = [firstDay, ...basePlan.itinerary.days.slice(1)]
  }

  const nextPlan: TripPlan = {
    ...basePlan,
    tripContext: {
      ...basePlan.tripContext,
      selectedPlaces: Array.isArray(memory?.selectedDestinations)
        ? memory.selectedDestinations.map((item: any) => ({
            name: item.name,
            city: item.city || item.name,
            country: item.country,
            latitude: item.latitude,
            longitude: item.longitude,
          }))
        : basePlan.tripContext.selectedPlaces,
    },
    itinerary: {
      days: nextDays,
    },
    updatedAt: Date.now(),
    lastUpdatedAt: Date.now(),
  }

  saveTripPlan(nextPlan)
  return nextPlan
}
