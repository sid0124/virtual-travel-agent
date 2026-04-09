"use client"

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CloudSun,
  Compass,
  Copy,
  Download,
  Hotel,
  MapPinned,
  Menu,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plane,
  Pin,
  Route,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react"

import { MessageContent } from "@/components/chat/MessageContent"
import { Navigation } from "@/components/navigation"
import { useTripPlanning } from "@/components/trip-planning-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { usePlaceImage } from "@/hooks/use-place-image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { DEFAULT_CURRENCY, formatCurrency } from "@/lib/currency"
import {
  hydrateDestinationPageFromChatSelection,
  normalizePlaceSelection,
  saveChatItinerary,
  type ChatActionablePayload,
} from "@/lib/chat-planner"
import { buildDestinationImageUrl, destinationFallbackImage } from "@/lib/data"
import { normalizeChatbotPlaces } from "@/lib/planner-destination"
import { isUnavailablePlaceholderImage } from "@/lib/place-images"
import { makeSegmentKey, normalizeCity, readTripPlan, saveTripPlan, type TripPlan } from "@/lib/trip-plan"
import { dedupeSelectedDestinations, defaultTripSetupState, type DiscoveryContextState } from "@/lib/trip-budget"
import { cn } from "@/lib/utils"

type Role = "user" | "assistant"
type AttachmentCategory = "place_photo" | "itinerary_screenshot" | "payment_screenshot" | "general_image"

type PendingAttachment = {
  id: string
  name: string
  type: string
  size: number
  category: AttachmentCategory
  previewUrl?: string
}

type SelectionSummaryPayload = {
  title: string
  modeLabel: string
  tripLabel: string
  focusLabel: string
  datesLabel: string
  budgetLabel: string
  travelStyleLabel: string
  originLabel: string
  travelersLabel: string
  selectedPlaces: Array<{ id: string; name: string; location: string }>
  activeFilters: string[]
  filterSummary: string
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

type TravelArtifacts = {
  foodGuide?: any
  localTips?: string[]
  miniPlan?: any
  nearbyPlaces?: any[]
  nearbyPlaceRecommendations?: any
  contextGuardrail?: any
  hotelRecommendations?: any
  mapContext?: any
  destinations?: any[]
  destinationRecommendations?: any
  flightSearchResults?: any
  budget?: any
  hotels?: any[]
  flights?: any[]
  weather?: any
  distanceKm?: number | null
  selectionSummary?: SelectionSummaryPayload
  supportIssueSummary?: SupportIssueSummaryPayload
}

type TravelMessage = {
  id: string
  role: Role
  content: string
  payload?: ChatActionablePayload
  messageType?: "plain_text" | "itinerary" | "recommendations" | "budget" | "hotels" | "nearby" | "map" | "weather" | "flights" | "support"
  responseType?:
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
    | "selection_summary"
    | "support_issue_summary"
  artifacts?: TravelArtifacts
  followUpQuestions?: string[]
  suggestedActions?: string[]
  actionCtas?: string[]
}

type ChatMode = "connected" | "fresh"

type ChatSession = {
  id: string
  title: string
  preview: string
  createdAt: string
  updatedAt: string
  messages: TravelMessage[]
  memory: any
  mode: ChatMode
  titleLocked?: boolean
  pinned?: boolean
}

type NearbyDayOption = {
  key: string
  dayNumber: number
  date?: string
  label: string
}

type NearbyScheduleDraft = {
  placeId: string
  dayKey: string
  time: string
  durationMinutes: number
  isOptional: boolean
}

type NearbyPlannerDialogState = {
  items: any[]
  mainDestination: any
  dayOptions: NearbyDayOption[]
  drafts: NearbyScheduleDraft[]
  prompt: string
  autoArranged: boolean
}

const CHAT_STORAGE_KEY = "WANDERLY_AI_CHAT_SESSIONS_V2"
const ACTIVE_CHAT_STORAGE_KEY = "WANDERLY_AI_ACTIVE_CHAT_ID_V2"
const BOOKING_HANDOFF_STORAGE_KEY = "WANDERLY_AI_BOOKING_HANDOFF_V1"
const PENDING_PROMPT_STORAGE_KEY = "WANDERLY_AI_PENDING_PROMPT_V1"
const SUPPORT_HANDOFF_STORAGE_KEY = "WANDERLY_AI_SUPPORT_HANDOFF_V1"

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function formatMoney(value: number, currency = DEFAULT_CURRENCY) {
  return formatCurrency(value, currency)
}

function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(1, Math.round(diff / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function formatDisplayDate(value?: string) {
  if (!value) return "Flexible date"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

function formatShortDate(value?: string) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function formatPlannerTimeValue(value?: string) {
  if (!value) return "Flexible"
  const [hoursText, minutesText] = String(value).split(":")
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const suffix = hours >= 12 ? "PM" : "AM"
  const normalizedHours = hours % 12 || 12
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`
}

function parsePlannerTimeToMinutes(value?: string) {
  if (!value) return null
  const [hoursText, minutesText] = String(value).split(":")
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function formatDurationLabel(minutes?: number | null) {
  const safe = Number(minutes)
  if (!Number.isFinite(safe) || safe <= 0) return "Flexible stay"
  if (safe < 60) return `${safe} min`
  if (safe % 60 === 0) return `${safe / 60} hr`
  return `${Math.floor(safe / 60)} hr ${safe % 60} min`
}

function normalizeMessageType(input?: string | null, responseType?: TravelMessage["responseType"]): TravelMessage["messageType"] {
  if (input === "itinerary" || input === "recommendations" || input === "budget" || input === "hotels" || input === "nearby" || input === "map" || input === "weather" || input === "flights" || input === "support" || input === "plain_text") {
    return input
  }
  if (!responseType) return "plain_text"
  if (String(responseType).startsWith("itinerary")) return "itinerary"
  if (responseType === "destination_recommendations") return "recommendations"
  if (responseType === "budget_breakdown") return "budget"
  if (responseType === "hotel_recommendations") return "hotels"
  if (responseType === "nearby_place_recommendations" || responseType === "nearby_places" || responseType === "food_guide") return "nearby"
  if (responseType === "map_context") return "map"
  if (responseType === "weather_summary") return "weather"
  if (responseType === "flight_search_results" || responseType === "flight_guidance") return "flights"
  if (responseType === "support_issue_summary") return "support"
  return "plain_text"
}

const DEFAULT_PLANNER_TIME_OPTIONS = ["08:00", "09:00", "10:30", "13:00", "16:00", "18:00"]
const DEFAULT_DURATION_OPTIONS = [30, 45, 60, 90, 120, 0]

function formatConnectedDateRange(dateRange?: { from?: string; to?: string }) {
  if (!dateRange?.from || !dateRange?.to) return "Dates not set yet"
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "Dates not set yet"
  const sameYear = from.getFullYear() === to.getFullYear()
  const fromText = from.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) })
  const toText = to.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
  return `${fromText} - ${toText}`
}

function getTripLengthLabel(dateRange?: { from?: string; to?: string }) {
  if (!dateRange?.from || !dateRange?.to) return "Dates not set yet"
  const from = new Date(dateRange.from)
  const to = new Date(dateRange.to)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "Dates not set yet"
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1)
  const nights = Math.max(0, days - 1)
  return `${days} day${days === 1 ? "" : "s"}${nights > 0 ? ` · ${nights} night${nights === 1 ? "" : "s"}` : ""}`
}

function dedupeMemoryDestinations(items: any[]) {
  return dedupeSelectedDestinations(Array.isArray(items) ? items : [])
}

function getPlannerSelectionIds(items: any[]) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .flatMap((item) => [item?.id, item?.sourceItemId, item?.destinationKey])
        .filter(Boolean)
        .map((item) => String(item))
    )
  )
}

function buildRecommendationCardsFromPayload(payload?: ChatActionablePayload | null) {
  if (!payload || payload.type !== "recommendations") return []
  return payload.places.map((place) => ({
    id: place.destinationKey,
    name: place.label,
    city: place.city,
    state: place.state,
    country: place.country,
    type: place.type,
    category: place.type,
    originalName: place.originalName,
    destinationKey: place.destinationKey,
    sourceType: place.type,
    sourceItemId: place.destinationKey,
    whyThisMatches: `${place.label} is a strong match for the trip style in this chat.`,
    highlights: [place.type, place.state, place.country].filter(Boolean),
    tags: [place.type, place.state, place.country].filter(Boolean),
  }))
}

function getFocusedDestination(memory: any) {
  const items = dedupeMemoryDestinations(memory?.selectedDestinations || [])
  if (!items.length) return null
  return items.find((item: any) => item.id === memory?.focusDestinationId) || items[0]
}

function formatLocationLabel(item: any) {
  return [item?.city || item?.state, item?.country].filter(Boolean).join(", ")
}

function getDestinationImageCandidates(item: any) {
  const generated = buildDestinationImageUrl({
    name: item?.name || "Destination",
    state: item?.state,
    city: item?.city,
    country: item?.country,
    category: item?.category || item?.type,
  })

  return Array.from(
    new Set(
      [item?.image, item?.imageFallback, generated, destinationFallbackImage]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  )
}

function deriveDestinationBadge(item: any, index: number) {
  const reason = String(item?.whyThisMatches || "")
  const haystack = `${reason} ${(item?.tags || []).join(" ")} ${(item?.highlights || []).join(" ")} ${item?.description || ""}`.toLowerCase()

  if (index === 0) return "Best overall match"
  if (/family/.test(haystack)) return "Family favorite"
  if (/photo|scenic/.test(haystack)) return "Great for photography"
  if (/culture|heritage|history/.test(haystack)) return "Culture-rich pick"
  if (/beach|coast|island/.test(haystack)) return "Relaxed coastal pick"
  if (/nature|wildlife|hill|mountain/.test(haystack)) return "Scenic escape"
  return "AI recommended"
}

function buildDestinationInsight(item: any) {
  if (item?.whyThisMatches && item?.budget?.max) {
    return `Recommended because it fits ${String(item.whyThisMatches).toLowerCase()} within about ${formatMoney(item.budget.max, item.budget.currency)}.`
  }
  if (item?.whyThisMatches) {
    return `Recommended because it works well as a ${String(item.whyThisMatches).toLowerCase()}.`
  }
  if (item?.suggestedDuration) {
    return `Easy ${item.suggestedDuration} trip with a comfortable sightseeing pace.`
  }
  return "A polished AI-picked destination card with a balanced mix of comfort, value, and sightseeing appeal."
}

function buildNearbyPlaceInsight(item: any) {
  if (item?.whyAdd) return item.whyAdd
  if (item?.travelTime) return `Easy add-on stop at roughly ${item.travelTime.toLowerCase()}.`
  return "A smart nearby stop that layers well into your day plan."
}

function getNearbyStepLabel(index: number, total: number) {
  if (index === 0) return "Start here"
  if (index === total - 1) return "Finish at"
  return "Continue to"
}

function getNearbyEffortLabel(item: any) {
  const travelMinutes = Number(item?.travelMinutes)
  const mode = normalizeText(item?.travelMode)
  if (Number.isFinite(travelMinutes) && travelMinutes <= 12) return "Easy stop"
  if (Number.isFinite(travelMinutes) && travelMinutes <= 24) return "Moderate walk"
  if (mode.includes("drive") || mode.includes("taxi") || mode.includes("cab")) return "Best with taxi"
  return "Longer detour"
}

function getNearbyBestTimeLabel(item: any) {
  const haystack = normalizeText(
    `${item?.bestTime || ""} ${item?.category || ""} ${(item?.tags || []).join(" ")} ${(item?.bestForTags || []).join(" ")} ${item?.description || ""}`
  )

  if (/museum|gallery|culture|heritage|history/.test(haystack)) return "Best late morning"
  if (/food|market|shopping|night/.test(haystack)) return "Best afternoon"
  if (/view|bridge|park|nature|photo|photography|sunrise|sunset/.test(haystack)) return "Best early morning"
  return "Best mid-morning"
}

function getSuggestedPlannerTime(item: any) {
  const label = getNearbyBestTimeLabel(item).toLowerCase()
  if (label.includes("sunset") || label.includes("evening")) return "18:00"
  if (label.includes("afternoon")) return "13:00"
  if (label.includes("late morning") || label.includes("mid-morning")) return "10:30"
  return "09:00"
}

function getPlannerTimeOptions(item: any, currentTime?: string) {
  return Array.from(new Set([getSuggestedPlannerTime(item), currentTime, ...DEFAULT_PLANNER_TIME_OPTIONS].filter(Boolean) as string[]))
}

function getNearbyDurationRecommendation(item: any) {
  const suggested = suggestNearbyDurationMinutes(item)
  if (suggested <= 45) return "Recommended visit: 30-45 min"
  if (suggested <= 60) return "Recommended visit: about 1 hour"
  if (suggested <= 120) return "Recommended visit: 1-2 hours"
  return "Recommended visit: keep this as a flexible longer stop"
}

function getNearbyScheduleHelperText(item: any) {
  const label = getNearbyBestTimeLabel(item).toLowerCase()
  if (label.includes("early morning")) return "Best visited early morning for lighter crowds and easier photos."
  if (label.includes("late morning")) return "Late morning works well here and keeps the pace comfortable."
  if (label.includes("afternoon")) return "This stop fits best after lunch or as part of a slower afternoon route."
  if (label.includes("evening") || label.includes("sunset")) return "This stop is strongest later in the day when the atmosphere improves."
  return "This stop fits smoothly into a half-day route with nearby highlights."
}

function getNearbyRouteFitMessage(item: any, draft: NearbyScheduleDraft, dayOptions: NearbyDayOption[], conflicts: string[]) {
  const itemConflict = conflicts.find((note) => note.includes(item.name))
  if (itemConflict) return itemConflict

  const dayLabel = dayOptions.find((option) => option.key === draft.dayKey)?.label || "your selected day"
  if (draft.isOptional) return `Saved as a lighter optional detour on ${dayLabel}.`
  return `This fits neatly into ${dayLabel} as a ${getNearbyEffortLabel(item).toLowerCase()}.`
}

function getNearbyBestForLabel(item: any) {
  return item?.bestForTags?.[0] || item?.tags?.[0] || item?.category || "Sightseeing"
}

function suggestNearbyDurationMinutes(item: any) {
  const durationText = normalizeText(item?.visitDuration || item?.duration || "")
  if (!durationText) return 60
  if (durationText.includes("30")) return 30
  if (durationText.includes("45")) return 45
  if (durationText.includes("90")) return 90
  if (durationText.includes("2 hour") || durationText.includes("120")) return 120
  if (durationText.includes("3 hour") || durationText.includes("180")) return 180
  return 60
}

function getNearbyDayOptions(memory: any) {
  const from = memory?.dateRange?.from
  const to = memory?.dateRange?.to || from

  if (from && to) {
    const start = new Date(from)
    const end = new Date(to)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
      return Array.from({ length: totalDays }, (_, index) => {
        const date = new Date(start.getTime() + index * 86400000)
        const iso = date.toISOString().slice(0, 10)
        return {
          key: iso,
          dayNumber: index + 1,
          date: iso,
          label: `${formatShortDate(iso)} · Day ${index + 1}`,
        }
      })
    }
  }

  return Array.from({ length: 3 }, (_, index) => ({
    key: `day-${index + 1}`,
    dayNumber: index + 1,
    label: `Day ${index + 1}`,
  }))
}

function getNearbyRouteEfficiencyLabel(items: any[]) {
  if (!items.length) return "Flexible route"
  const totalTravelMinutes = items.reduce((sum, item) => sum + (Number(item?.travelMinutes) || 0), 0)
  const average = totalTravelMinutes / Math.max(items.length, 1)
  if (average <= 12) return "Efficient walking route"
  if (average <= 22) return "Moderate walking route"
  return "Best with mixed transit"
}

function buildNearbyAutoSchedule(items: any[], dayOptions: NearbyDayOption[]) {
  const sorted = [...items].sort((left, right) => {
    const leftDistance = Number(left?.distanceKm) || Number.MAX_SAFE_INTEGER
    const rightDistance = Number(right?.distanceKm) || Number.MAX_SAFE_INTEGER
    return leftDistance - rightDistance
  })

  const defaultDay = dayOptions[0]?.key || "day-1"
  let currentMinutes = 9 * 60

  return sorted.map((item) => {
    const durationMinutes = suggestNearbyDurationMinutes(item)
    const draft: NearbyScheduleDraft = {
      placeId: item.id,
      dayKey: defaultDay,
      time: `${String(Math.floor(currentMinutes / 60)).padStart(2, "0")}:${String(currentMinutes % 60).padStart(2, "0")}`,
      durationMinutes,
      isOptional: false,
    }
    currentMinutes += durationMinutes + Math.max(20, Number(item?.travelMinutes) || 15)
    return draft
  })
}

function findNearbyScheduleConflicts(items: any[], drafts: NearbyScheduleDraft[], dayOptions: NearbyDayOption[]) {
  const itemLookup = new Map(items.map((item) => [item.id, item]))
  const dayLookup = new Map(dayOptions.map((option) => [option.key, option]))
  const notes: string[] = []

  for (let index = 0; index < drafts.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < drafts.length; nextIndex += 1) {
      const current = drafts[index]
      const next = drafts[nextIndex]
      if (current.dayKey !== next.dayKey) continue
      const currentStart = parsePlannerTimeToMinutes(current.time)
      const nextStart = parsePlannerTimeToMinutes(next.time)
      if (currentStart == null || nextStart == null) continue
      const currentEnd = currentStart + Math.max(30, Number(current.durationMinutes) || 60)
      const nextEnd = nextStart + Math.max(30, Number(next.durationMinutes) || 60)
      if (currentStart < nextEnd && nextStart < currentEnd) {
        const currentItem = itemLookup.get(current.placeId)
        const nextItem = itemLookup.get(next.placeId)
        const dayLabel = dayLookup.get(current.dayKey)?.label || "the same day"
        notes.push(`${currentItem?.name || "Stop"} overlaps with ${nextItem?.name || "another stop"} on ${dayLabel}.`)
      }
    }
  }

  return notes
}

function buildNearbyPlannerDrafts(items: any[], dayOptions: NearbyDayOption[], options?: { autoArrange?: boolean; defaultOptional?: boolean; preferredDayKey?: string }) {
  const autoDrafts = options?.autoArrange ? buildNearbyAutoSchedule(items, dayOptions) : null
  const preferredDayKey = options?.preferredDayKey || dayOptions[0]?.key || "day-1"

  return items.map((item, index) => {
    const autoDraft = autoDrafts?.find((draft) => draft.placeId === item.id)
    return {
      placeId: item.id,
      dayKey: autoDraft?.dayKey || preferredDayKey,
      time: autoDraft?.time || (index === 0 ? "09:00" : "11:00"),
      durationMinutes: autoDraft?.durationMinutes || suggestNearbyDurationMinutes(item),
      isOptional: Boolean(options?.defaultOptional),
    }
  })
}

function createAssistantTripPlanBase(memory: any, mainDestination: any, dayOptions: NearbyDayOption[]): TripPlan {
  const timestamp = Date.now()
  const normalizedDestination = mainDestination?.city || mainDestination?.name || memory?.selectedDestinations?.[0]?.city || memory?.selectedDestinations?.[0]?.name || "Destination"
  const days = dayOptions.map((option) => ({
    dayNumber: option.dayNumber,
    date: option.date || "",
    title: option.dayNumber === 1 ? `Arrival & ${normalizedDestination}` : `Explore ${normalizedDestination}`,
    city: normalizedDestination,
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
            lat: item.lat,
            lng: item.lng,
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

function buildStayInsight(item: any) {
  if (item?.reason) return item.reason
  if (item?.walkingTime) return `${item.walkingTime} from your main destination.`
  return "A polished stay pick with a good mix of comfort, location, and convenience."
}

function buildStayCardBadge(item: any, index: number) {
  if (item?.tags?.[0]) return item.tags[0]
  if (item?.kind === "area") return index === 0 ? "AI stay area" : "Recommended area"
  return index === 0 ? "AI stay pick" : "Strong stay fit"
}

function buildStayVisualItem(item: any) {
  return {
    name: item?.name,
    city: item?.location || item?.sourceDestination,
    state: item?.state,
    country: item?.country,
    category: item?.kind === "area" ? "Stay area" : "Hotel",
    image: item?.image,
    imageQuery: item?.imageQuery,
    tags: item?.tags,
  }
}

function getCompactTags(item: any) {
  return Array.from(new Set([item?.category, ...(item?.tags || []), ...(item?.highlights || []), ...(item?.bestForTags || [])].filter(Boolean))).slice(0, 3)
}

function formatNearbyTravelValue(item: any) {
  if (item?.travelTime) return item.travelTime
  if (!Number.isFinite(Number(item?.distanceKm))) return "Nearby"
  const distance = Number(item.distanceKm) < 10 ? `${Number(item.distanceKm).toFixed(1)} km` : `${Math.round(Number(item.distanceKm))} km`
  if (!Number.isFinite(Number(item?.travelMinutes)) || !item?.travelMode) return distance
  return `${distance} • ${Math.round(Number(item.travelMinutes))} min ${item.travelMode}`
}

function deriveNearbyBadge(item: any, index: number) {
  if (index < 3) return `AI pick ${index + 1}`
  if (/hidden gem/i.test(`${item?.category} ${(item?.bestForTags || []).join(" ")}`)) return "Hidden gem"
  if (/food/i.test(`${item?.category} ${(item?.bestForTags || []).join(" ")}`)) return "Food stop"
  if (/shopping/i.test(`${item?.category} ${(item?.bestForTags || []).join(" ")}`)) return "Shopping"
  return "Nearby pick"
}

function buildPlaceMeta(item: any, kind: "destination" | "nearby") {
  if (kind === "nearby") {
    return [
      {
        label: "From stop",
        value: formatNearbyTravelValue(item),
        icon: MapPinned,
        accent: "text-amber-500",
      },
      {
        label: "Visit",
        value: item.visitDuration || "1-2 hours",
        icon: Clock3,
        accent: "text-amber-500",
      },
      {
        label: "Type",
        value: item.category || item.bestForTags?.[0] || item.bestFor || "Nearby pick",
        icon: Pin,
        accent: "text-amber-500",
      },
    ]
  }

  const budgetLabel = item.budget
    ? `${formatMoney(item.budget.min, item.budget.currency)} - ${formatMoney(item.budget.max, item.budget.currency)}`
    : "Flexible"

  return [
    { label: "Best time", value: item.bestTime || "Flexible", icon: CalendarDays, accent: "text-sky-600" },
    { label: "Budget", value: budgetLabel, icon: Wallet, accent: "text-sky-600" },
    { label: "Trip", value: item.suggestedDuration || "3-4 days", icon: Clock3, accent: "text-sky-600" },
  ]
}

function RecommendationImage({
  item,
  badge,
  subtitle,
  isSelected,
  isSaved,
  stateLabel,
}: {
  item: any
  badge: string
  subtitle?: string
  isSelected?: boolean
  isSaved?: boolean
  stateLabel?: string
}) {
  const fallbackCandidates = useMemo(() => getDestinationImageCandidates(item), [item])
  const fallbackSrc = fallbackCandidates[0] || destinationFallbackImage
  const { src: resolvedSrc, isLoading: isImageLoading, resolved } = usePlaceImage({
    id: item?.id,
    name: item?.name,
    city: item?.city,
    state: item?.state,
    country: item?.country,
    category: item?.category || item?.type,
    tags: item?.tags || item?.bestForTags || item?.highlights,
    imageQuery: item?.imageQuery,
    image: item?.image || fallbackSrc,
    imageFallback: item?.imageFallback || destinationFallbackImage,
  })
  const imageCandidates = useMemo(
    () =>
      Array.from(
        new Set(
          [resolvedSrc, ...fallbackCandidates, destinationFallbackImage]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      ),
    [fallbackCandidates, resolvedSrc]
  )
  const [srcIndex, setSrcIndex] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const activeSrc = imageCandidates[srcIndex] || fallbackSrc
  const showPreviewFallback = Boolean(resolved?.placeholder || isUnavailablePlaceholderImage(activeSrc))
  const imageCandidateKey = imageCandidates.join("|")

  useEffect(() => {
    setLoaded(false)
    setSrcIndex(0)
  }, [imageCandidateKey])

  return (
    <div className="relative aspect-[16/10] overflow-hidden">
      <div className={cn("absolute inset-0 bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_38%,#f8fafc_100%)] transition-opacity duration-300", loaded ? "opacity-0" : "opacity-100")}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.75),transparent_36%),linear-gradient(180deg,rgba(14,165,233,0.2),rgba(15,23,42,0.08))]" />
        <div className="absolute inset-x-5 top-5 flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-full bg-white/70" />
          <Skeleton className="h-9 w-9 rounded-full bg-white/70" />
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <Skeleton className="h-6 w-40 rounded-full bg-white/70" />
          <Skeleton className="mt-3 h-4 w-52 rounded-full bg-white/60" />
        </div>
      </div>

      <img
        src={activeSrc}
        alt={item?.name || "Destination image"}
        className={cn(
          "h-full w-full object-cover transition duration-700",
          loaded ? "scale-100 opacity-100" : "scale-[1.03] opacity-0",
          isImageLoading && "blur-[1px]"
        )}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true)
          setSrcIndex((current) => {
            const next = current + 1
            return next < imageCandidates.length ? next : current
          })
        }}
      />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.02)_36%,rgba(15,23,42,0.84)_100%)]" />
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">
        <HoverCard openDelay={120}>
          <HoverCardTrigger asChild>
            <button className="inline-flex max-w-[75%] items-center rounded-full border border-white/25 bg-white/88 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 backdrop-blur">
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
              {badge}
            </button>
          </HoverCardTrigger>
          <HoverCardContent align="start" className="w-72 rounded-2xl border-sky-100 bg-white/95 text-sm text-slate-600 shadow-[0_18px_50px_rgba(14,165,233,0.12)]">
            <p className="font-semibold text-slate-950">{item?.name || "Destination"}</p>
            <p className="mt-2 leading-6">{subtitle || buildDestinationInsight(item)}</p>
          </HoverCardContent>
        </HoverCard>

        {isSelected ? (
          <span className="inline-flex items-center rounded-full border border-emerald-300/70 bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-emerald-950/20">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            {stateLabel || "Added to trip"}
          </span>
        ) : isSaved ? (
          <span className="inline-flex items-center rounded-full border border-sky-200/70 bg-white/92 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800 shadow-lg shadow-slate-950/10">
            Saved
          </span>
        ) : (
          <span className="sr-only">Recommended destination</span>
        )}
      </div>

      <div className="absolute inset-x-4 bottom-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-sm text-white/82">
            <MapPinned className="h-4 w-4 shrink-0" />
            <p className="line-clamp-1">{formatLocationLabel(item) || "Travel recommendation"}</p>
          </div>
          {showPreviewFallback ? (
            <span className="shrink-0 rounded-full border border-white/20 bg-white/14 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur">
              Preview unavailable
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RecommendationCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_20px_50px_rgba(148,163,184,0.10)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#dbeafe_0%,#e0f2fe_38%,#f8fafc_100%)]">
        <Skeleton className="absolute inset-0 rounded-none bg-white/15" />
        <div className="absolute inset-x-5 top-5 flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-full bg-white/65" />
          <Skeleton className="h-9 w-9 rounded-full bg-white/65" />
        </div>
        <div className="absolute inset-x-5 bottom-5">
          <Skeleton className="h-6 w-40 rounded-full bg-white/65" />
          <Skeleton className="mt-3 h-4 w-52 rounded-full bg-white/55" />
        </div>
      </div>
      <div className="space-y-4 p-5">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16 rounded-[20px]" />
          <Skeleton className="h-16 rounded-[20px]" />
          <Skeleton className="h-16 rounded-[20px]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="h-11 w-28 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isContextEmpty(memory: any) {
  return !(
    memory?.startingLocation ||
    memory?.dateRange?.from ||
    memory?.dateRange?.to ||
    memory?.selectedDestinations?.length ||
    memory?.discoveryContext?.activeFiltersCount ||
    (typeof memory?.travelers === "number" && memory.travelers > defaultTripSetupState.travelers) ||
    (memory?.budgetPreference && memory.budgetPreference !== defaultTripSetupState.budgetPreference) ||
    (memory?.travelStyle && memory.travelStyle !== defaultTripSetupState.travelStyle)
  )
}

function buildSmartTitle(prompt: string, memory: any) {
  const normalized = normalizeText(prompt)
  const destinationNames = Array.isArray(memory?.selectedDestinations)
    ? memory.selectedDestinations.map((item: any) => item.name).filter(Boolean)
    : []

  if (destinationNames.length > 0) {
    const first = destinationNames[0]
    if (/budget/.test(normalized)) return `${first} budget trip`
    if (/flight/.test(normalized)) return `${first} flight options`
    if (/hotel/.test(normalized)) return `${first} hotel plan`
    if (/weather|best time/.test(normalized)) return `${first} travel timing`
    return `${first} trip plan`
  }

  const titleWords = prompt.replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ")
  return titleWords || "New travel chat"
}

function createSession(mode: ChatMode, memory: any): ChatSession {
  const now = new Date().toISOString()
  return {
    id: createId(),
    title: mode === "connected" ? "Trip-connected chat" : "Fresh travel chat",
    preview: mode === "connected" ? "Using your current trip details" : "Independent travel exploration",
    createdAt: now,
    updatedAt: now,
    messages: [],
    memory: mode === "connected" ? memory : { ...defaultTripSetupState },
    mode,
    titleLocked: false,
    pinned: false,
  }
}

function mergeMemory(base: any, next: any) {
  return {
    ...base,
    ...next,
    dateRange: {
      from: next?.dateRange?.from || base?.dateRange?.from,
      to: next?.dateRange?.to || base?.dateRange?.to,
    },
    selectedDestinations:
      Array.isArray(next?.selectedDestinations) && next.selectedDestinations.length > 0
        ? next.selectedDestinations
        : base?.selectedDestinations || [],
    discoveryContext: {
      ...getDiscoveryContext(base),
      ...(next?.discoveryContext || {}),
    },
  }
}

function getModeLabel(mode: ChatMode) {
  return mode === "connected" ? "Connected to current trip" : "Fresh travel chat"
}

function getModeDescription(mode: ChatMode) {
  return mode === "connected"
    ? "Using your selected destinations, dates, budget, and travel details."
    : "No trip context linked. Ask about any place independently."
}

function isGenericTitle(title?: string | null) {
  const normalized = normalizeText(title)
  return !normalized || normalized === "trip connected chat" || normalized === "fresh travel chat" || normalized === "new travel chat"
}

function getConnectedTripName(memory: any, fallbackTitle?: string | null) {
  const destinations = dedupeMemoryDestinations(memory?.selectedDestinations || [])
  const focused = getFocusedDestination(memory)

  if (fallbackTitle && !isGenericTitle(fallbackTitle)) return fallbackTitle
  if (focused?.name) return `${focused.name} trip`
  if (destinations.length === 1) return `${destinations[0].name} trip`
  if (destinations.length > 1) return `${destinations[0].name} + ${destinations.length - 1} more`
  return "Connected trip"
}

function getDiscoveryContext(memory: any): DiscoveryContextState {
  return {
    ...defaultTripSetupState.discoveryContext,
    ...(memory?.discoveryContext || {}),
  }
}

function buildDiscoveryFilterChips(discoveryContext: DiscoveryContextState) {
  const chips: string[] = []
  if (discoveryContext.searchQuery) chips.push(`Search: ${discoveryContext.searchQuery}`)
  if (discoveryContext.selectedRegion !== "All Regions") chips.push(discoveryContext.selectedRegion)
  if (discoveryContext.selectedState !== "All States") chips.push(discoveryContext.selectedState)
  if (discoveryContext.selectedType !== "All Types") chips.push(discoveryContext.selectedType)
  if (discoveryContext.unescoOnly) chips.push("UNESCO only")
  if (discoveryContext.selectedInterests.length) {
    chips.push(...discoveryContext.selectedInterests.slice(0, 3).map((interest) => `${interest} focus`))
  }
  if (discoveryContext.budgetRange[0] > 0 || discoveryContext.budgetRange[1] < 50000) {
    chips.push(`${formatMoney(discoveryContext.budgetRange[0])} - ${formatMoney(discoveryContext.budgetRange[1])}`)
  }
  return chips.slice(0, 6)
}

function buildSelectionSummary(memory: any, mode: ChatMode, fallbackTitle?: string | null): SelectionSummaryPayload {
  const discoveryContext = getDiscoveryContext(memory)
  const selectedPlaces = dedupeMemoryDestinations(memory?.selectedDestinations || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    location: formatLocationLabel(item) || item.category || "Destination",
  }))
  const filterChips = buildDiscoveryFilterChips(discoveryContext)

  return {
    title: "Connected trip context",
    modeLabel: getModeLabel(mode),
    tripLabel: getConnectedTripName(memory, fallbackTitle),
    focusLabel: getFocusedDestination(memory)?.name || "Full trip context",
    datesLabel: formatConnectedDateRange(memory?.dateRange),
    budgetLabel: memory?.budgetPreference || "Not set",
    travelStyleLabel: memory?.travelStyle || "Not set",
    originLabel: memory?.startingLocation || "Origin not set",
    travelersLabel: `${memory?.travelers || 1} traveler${memory?.travelers === 1 ? "" : "s"}`,
    selectedPlaces,
    activeFilters: filterChips,
    filterSummary:
      filterChips.length > 0
        ? `Using ${filterChips.length} discovery signal${filterChips.length === 1 ? "" : "s"} from Destinations filters and selections.`
        : "No active discovery filters linked yet.",
  }
}

function buildQuickActions(memory: any) {
  const firstDestination = getFocusedDestination(memory)?.name || memory?.selectedDestinations?.[0]?.name
  const latestItinerary = memory?.itineraryMemory?.latestItinerary
  const familyFriendly = memory?.itineraryMemory?.preferences?.familyFriendly

  if (firstDestination && latestItinerary) {
    return [
      familyFriendly ? "Add kid-friendly stop" : "Make it family-friendly",
      "Add snack stop",
      memory?.itineraryMemory?.walkingTolerance === "low" ? "Add lunch break" : "Reduce walking",
      "Save to trip",
      `Build itinerary for ${firstDestination}`,
      `Best places near ${firstDestination}`,
    ]
  }

  if (firstDestination) {
    return [
      "Review trip context",
      "Estimate budget",
      "Find hotels",
      `Best places near ${firstDestination}`,
      `Build itinerary for ${firstDestination}`,
      "Weather during my trip",
    ]
  }

  return [
    "Suggest destinations",
    "Review trip context",
    "Estimate budget",
    "Find hotels",
    "Build itinerary",
  ]
}

const HIDDEN_CHAT_ACTIONS = new Set(
  [
    "save as separate trip idea",
    "compare with my current trip",
    "connect this chat to my trip",
    "disconnect from trip",
    "use planned trip context",
    "use this answer in my current trip",
    "continue as fresh chat",
    "answer in fresh chat mode",
    "start fresh chat",
  ].map((value) => normalizeText(value))
)

function slugifyActionLabel(value?: string | null) {
  return normalizeText(value)
    .replace(/\b(check|find|view|show|open)\b/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function dedupeActionLabels(labels: string[], limit = 5) {
  const seen = new Set<string>()
  const unique: string[] = []

  for (const label of labels) {
    if (HIDDEN_CHAT_ACTIONS.has(normalizeText(label))) continue
    const normalized = slugifyActionLabel(label)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    unique.push(label)
    if (unique.length >= limit) break
  }

  return unique
}

function mergeItineraryMemory(memory: any, patch: any) {
  const current = memory?.itineraryMemory || {}
  return {
    ...memory,
    itineraryMemory: {
      ...current,
      ...patch,
      preferences: {
        ...(current?.preferences || {}),
        ...(patch?.preferences || {}),
      },
      latestAssistantSuggestions:
        patch?.latestAssistantSuggestions || current?.latestAssistantSuggestions || [],
    },
  }
}

function classifyAttachmentCategory(file: File): AttachmentCategory {
  const haystack = `${file.name} ${file.type}`.toLowerCase()
  if (/(payment|receipt|upi|transaction|invoice|bank|proof)/.test(haystack)) return "payment_screenshot"
  if (/(itinerary|plan|trip|booking|schedule|route)/.test(haystack)) return "itinerary_screenshot"
  if (/(place|destination|photo|landmark|image|museum|park)/.test(haystack)) return "place_photo"
  return "general_image"
}

function SidebarChatItem({
  session,
  active,
  onSelect,
  onPin,
  onDuplicate,
  onRename,
  onDelete,
}: {
  session: ChatSession
  active: boolean
  onSelect: () => void
  onPin: () => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        "group rounded-[20px] border transition-all",
        active
          ? "border-sky-200 bg-sky-50/80 shadow-[0_14px_30px_rgba(59,130,246,0.10)]"
          : "border-slate-200/80 bg-white/88 hover:border-slate-300 hover:bg-white"
      )}
    >
      <div className="p-3">
        <button onClick={onSelect} className="min-w-0 w-full text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {session.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : null}
              <p className={cn("truncate text-sm font-semibold", active ? "text-sky-950" : "text-slate-900")}>
                {session.title}
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-slate-400">{formatRelativeTime(session.updatedAt)}</span>
          </div>
          <p className="mt-1 line-clamp-2 pr-2 text-xs text-slate-500">{session.preview}</p>
        </button>
      </div>
    </div>
  )
}

function ContextCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: "default" | "accent"
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]",
        tone === "accent"
          ? "border-sky-200 bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_100%)]"
          : "border-slate-200/80 bg-white/90"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-sm text-slate-600">{value}</p>
    </div>
  )
}

function ConnectedTripOverview({
  memory,
  tripName,
  onConnectToggle,
  onViewFullTrip,
  onChangeTrip,
}: {
  memory: any
  tripName: string
  onConnectToggle: () => void
  onViewFullTrip: () => void
  onChangeTrip: () => void
}) {
  const destinations = dedupeMemoryDestinations(memory?.selectedDestinations || [])
  const focused = getFocusedDestination(memory)
  const discoveryContext = getDiscoveryContext(memory)
  const filterChips = buildDiscoveryFilterChips(discoveryContext)
  const dateLabel = formatConnectedDateRange(memory?.dateRange)
  const durationLabel = getTripLengthLabel(memory?.dateRange)
  const summaryChips = [
    dateLabel,
    dateLabel !== "Dates not set yet" && durationLabel !== "Dates not set yet" ? durationLabel : null,
    memory?.budgetPreference ? `Budget: ${memory.budgetPreference}` : "Budget not set",
    `${destinations.length} stop${destinations.length === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[]

  return (
    <div className="mt-4 rounded-[24px] border border-sky-200/80 bg-[linear-gradient(135deg,#fbfdff_0%,#eef7ff_100%)] p-3.5 shadow-[0_14px_35px_rgba(56,189,248,0.08)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-200 bg-white/92 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
              Connected trip
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              {focused?.name ? `Using ${focused.name} trip context` : `Using ${tripName} context`}
            </span>
          </div>

          <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-950">{tripName}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {summaryChips.map((chip) => (
                  <span key={chip} className="rounded-full border border-sky-100 bg-white/92 px-3 py-1.5 text-xs font-semibold text-sky-900">
                    {chip}
                  </span>
                ))}
              </div>
              {filterChips.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {filterChips.map((chip) => (
                    <span key={chip} className="rounded-full border border-amber-100 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900">
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onViewFullTrip}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Focus: {focused?.name || "Entire trip"}
          </button>
          <button
            onClick={onViewFullTrip}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            View full trip
          </button>
          <button
            onClick={onChangeTrip}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Change
          </button>
          <button
            onClick={onConnectToggle}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  )
}

function SelectionSummaryCard({ summary }: { summary: SelectionSummaryPayload }) {
  return (
    <div className="rounded-[26px] border border-sky-200/80 bg-[linear-gradient(135deg,#fbfdff_0%,#eef7ff_100%)] p-5 shadow-[0_18px_45px_rgba(59,130,246,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Selection summary</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{summary.tripLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.filterSummary}</p>
        </div>
        <span className="rounded-full border border-sky-100 bg-white/92 px-3 py-1.5 text-xs font-semibold text-sky-900">
          {summary.modeLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[20px] border border-slate-200/80 bg-white/92 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Focus</p>
          <p className="mt-2 font-semibold text-slate-950">{summary.focusLabel}</p>
        </div>
        <div className="rounded-[20px] border border-slate-200/80 bg-white/92 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dates</p>
          <p className="mt-2 font-semibold text-slate-950">{summary.datesLabel}</p>
        </div>
        <div className="rounded-[20px] border border-slate-200/80 bg-white/92 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trip setup</p>
          <p className="mt-2 font-semibold text-slate-950">{summary.originLabel}</p>
          <p className="mt-1 text-sm text-slate-500">{summary.travelersLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-950">Selected places</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {summary.selectedPlaces.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {summary.selectedPlaces.length ? summary.selectedPlaces.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-slate-200/80 bg-slate-50/85 px-3.5 py-3">
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">{item.location}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No selected places linked yet.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
            <p className="text-sm font-semibold text-slate-950">Travel profile</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-900">Budget:</span> {summary.budgetLabel}</p>
              <p><span className="font-semibold text-slate-900">Style:</span> {summary.travelStyleLabel}</p>
            </div>
          </div>
          <div className="rounded-[22px] border border-amber-100 bg-amber-50/80 p-4">
            <p className="text-sm font-semibold text-slate-950">Discovery signals</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.activeFilters.length ? summary.activeFilters.map((chip) => (
                <span key={chip} className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900">
                  {chip}
                </span>
              )) : <p className="text-sm text-slate-500">No active destination filters captured yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SupportIssueSummaryCard({ summary }: { summary: SupportIssueSummaryPayload }) {
  const urgencyStyles =
    summary.urgency === "high"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : summary.urgency === "medium"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"

  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#fff8f5_100%)] p-5 shadow-[0_18px_45px_rgba(148,163,184,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Support handoff</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{summary.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", urgencyStyles)}>
            {summary.urgency} priority
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
            {summary.statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[22px] border border-slate-200/80 bg-white/92 p-4">
          <p className="text-sm font-semibold text-slate-950">What Wanderly understood</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{summary.evidenceNote}</p>
        </div>
        <div className="rounded-[22px] border border-slate-200/80 bg-white/92 p-4">
          <p className="text-sm font-semibold text-slate-950">Useful reference details</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.referenceHints.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-slate-200/80 bg-white/92 p-4">
        <p className="text-sm font-semibold text-slate-950">Recommended next steps</p>
        <div className="mt-3 grid gap-2">
          {summary.recommendedSteps.map((step, index) => (
            <div key={step} className="flex items-start gap-3 rounded-[18px] bg-slate-50/85 px-3.5 py-3">
              <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <p className="text-sm leading-6 text-slate-700">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function BudgetCard({ budget }: { budget: any }) {
  if (!budget) return null

  return (
    <div className="rounded-[24px] border border-emerald-200/70 bg-[linear-gradient(135deg,#fbfffd_0%,#eefcf4_100%)] p-5 shadow-[0_18px_40px_rgba(16,185,129,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Budget estimate</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{formatMoney(budget.totalBudget, budget.currency)}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {budget.totalDays} days | {budget.destinationsCount} destination{budget.destinationsCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3">
          <p className="text-xs text-slate-500">Per day</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">{formatMoney(budget.perDayCost, budget.currency)}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Stay</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.stay, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Food</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.food, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Travel</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.travel, budget.currency)}</p></div>
        <div className="rounded-2xl bg-white/80 p-3"><p className="text-xs text-slate-500">Activities</p><p className="mt-1 font-semibold">{formatMoney(budget.breakdown.activities, budget.currency)}</p></div>
      </div>
    </div>
  )
}

function WeatherCard({ weather }: { weather: any }) {
  if (!weather) return null

  return (
    <div className="rounded-[24px] border border-sky-200/80 bg-[linear-gradient(135deg,#fbfdff_0%,#eef7ff_100%)] p-5 shadow-[0_18px_40px_rgba(59,130,246,0.08)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Weather guidance</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">{weather.place}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {weather.temperatureC} C | {weather.condition}
          </p>
        </div>
        {weather.bestTime ? (
          <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3">
            <p className="text-xs text-slate-500">Best season</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{weather.bestTime}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Travel comfort</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.comfort}</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Packing tip</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.packing}</p>
        </div>
        <div className="rounded-2xl bg-white/85 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Best hours</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{weather.bestHours}</p>
        </div>
      </div>
    </div>
  )
}

function NearbyPlacesCard({ placeName, items }: { placeName?: string; items: any[] }) {
  if (!items?.length) return null

  return (
    <div className="rounded-[24px] border border-amber-200/70 bg-[linear-gradient(135deg,#fffdf7_0%,#fff7ed_100%)] p-5 shadow-[0_18px_40px_rgba(245,158,11,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Nearby attractions</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {placeName ? `Best places around ${placeName}` : "Best nearby places"}
          </h3>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item, index) => (
          <div key={item.id || `${item.name}-${index}`} className="rounded-2xl border border-white/70 bg-white/90 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.subtitle || item.bestFor || "Nearby stop"}</p>
              </div>
              {item.travelTime ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800">{item.travelTime}</span>
              ) : null}
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">{item.whyVisit}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function NearbyPlacePlannerCard({
  recommendation,
  selectedIds,
  scheduledIds,
  optionalIds,
  dayOptions,
  onSelect,
  onViewDetails,
  onAsk,
  onFilter,
  onPrimaryAction,
  onOpenScheduler,
}: {
  recommendation: any
  selectedIds: string[]
  scheduledIds: string[]
  optionalIds: string[]
  dayOptions: NearbyDayOption[]
  onSelect: (mainDestination: any, place: any) => void
  onViewDetails: (item: any, kind: "nearby") => void
  onAsk: (prompt: string) => void
  onFilter: (chip: string) => void
  onPrimaryAction: (action: string) => void
  onOpenScheduler: (
    items: any[],
    options?: { autoArrange?: boolean; defaultOptional?: boolean; preferredDayKey?: string; prompt?: string }
  ) => void
}) {
  const items = recommendation?.cards || []
  if (!items.length) return null

  const mainDestination = recommendation?.mainDestination
  const hasSelections = selectedIds.length > 0
  const selectedItems = items.filter((item: any) => selectedIds.includes(item.id))
  const routeEfficiency = getNearbyRouteEfficiencyLabel(selectedItems.length ? selectedItems : items.slice(0, 3))
  const primaryDay = dayOptions[0]

  return (
    <div className="space-y-5 rounded-[30px] border border-sky-200/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,249,255,0.98)_38%,rgba(232,250,247,0.94)_100%)] p-5 shadow-[0_22px_55px_rgba(56,189,248,0.10)] ring-1 ring-white/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Nearby route planner</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {recommendation?.title || (mainDestination?.name ? `Top attractions near ${mainDestination.name}` : "Popular nearby places")}
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {recommendation?.introText || `These stops pair well for an easy ${mainDestination?.name || "nearby"} half-day plan.`}
          </p>
          <p className="mt-1 text-sm text-slate-500">Select the places you want, and I&apos;ll help schedule them into your itinerary.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Number.isFinite(Number(recommendation?.radiusKm)) ? (
            <div className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{recommendation.radiusKm} km</span> search radius
            </div>
          ) : null}
          <div className="rounded-2xl border border-emerald-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">{routeEfficiency}</span>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">{selectedIds.length}</span> selected
          </div>
          {recommendation?.groupedHints?.length ? recommendation.groupedHints.map((hint: any) => (
            <div key={hint.label} className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{hint.count}</span> {hint.label}
            </div>
          )) : null}
        </div>
      </div>

      {recommendation?.refinementFilters?.length ? (
        <div className="flex flex-wrap gap-2">
          {recommendation.refinementFilters.map((chip: string) => (
            <button
              key={chip}
              onClick={() => onFilter(chip)}
              className="rounded-full border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative space-y-4">
        <div className="absolute bottom-4 left-[1.05rem] top-4 hidden w-px bg-[linear-gradient(180deg,rgba(125,211,252,0.1)_0%,rgba(56,189,248,0.45)_22%,rgba(45,212,191,0.22)_100%)] sm:block" />
        {items.map((item: any, index: number) => {
          const isSelected = selectedIds.includes(item.id)
          const isScheduled = scheduledIds.includes(item.id)
          const isOptional = optionalIds.includes(item.id)
          const badge = getNearbyStepLabel(index, items.length)
          const summary = buildNearbyPlaceInsight(item)
          const matchLine = formatNearbyTravelValue(item)
          const bestTime = getNearbyBestTimeLabel(item)
          const durationMinutes = suggestNearbyDurationMinutes(item)
          const quickDayLabel = primaryDay ? `Day ${primaryDay.dayNumber}` : "Day 1"

          return (
            <div
              key={item.id}
              className={cn(
                "relative overflow-hidden rounded-[26px] border bg-white/88 p-3 shadow-[0_20px_45px_rgba(15,23,42,0.08)] transition-all",
                isSelected
                  ? "border-sky-300 bg-[linear-gradient(135deg,rgba(240,249,255,0.96)_0%,rgba(236,253,250,0.96)_100%)] shadow-[0_24px_55px_rgba(56,189,248,0.16)]"
                  : "border-white/75 hover:border-sky-200 hover:bg-white"
              )}
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
                <div className="overflow-hidden rounded-[22px] border border-white/80 bg-slate-100 shadow-[0_16px_35px_rgba(15,23,42,0.08)]">
                  <RecommendationImage
                    item={item}
                    badge={deriveNearbyBadge(item, index)}
                    subtitle={summary}
                    isSelected={isSelected || isScheduled}
                    isSaved={isOptional}
                    stateLabel={isScheduled ? "Scheduled" : isSelected ? "Selected" : isOptional ? "Optional" : undefined}
                  />
                </div>

                <div className="flex flex-col gap-4 px-1 py-1">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800">
                          {badge}
                        </span>
                        {isScheduled ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                            Added to itinerary
                          </span>
                        ) : null}
                        {isOptional ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                            Optional stop
                          </span>
                        ) : null}
                      </div>
                      <h4 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-slate-950">{item.name}</h4>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{summary}</p>
                    </div>

                    <label
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition",
                        isSelected
                          ? "border-sky-300 bg-sky-50 text-sky-900"
                          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"
                      )}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => onSelect(mainDestination, item)} />
                      {isSelected ? "Selected" : "Select place"}
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">Distance</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{matchLine}</p>
                    </div>
                    <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-700">Visit time</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{formatDurationLabel(durationMinutes)}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Effort</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{getNearbyEffortLabel(item)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best slot</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">{bestTime}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[getNearbyBestForLabel(item), ...(getCompactTags(item) || [])].filter(Boolean).slice(0, 4).map((tag: string, tagIndex: number) => (
                      <span
                        key={`${item.id}-${tag}-${tagIndex}`}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-medium",
                          tagIndex === 0 ? "bg-sky-100 text-sky-800" : "border border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => onOpenScheduler([item], {
                        preferredDayKey: primaryDay?.key,
                        prompt: `Add ${item.name} to your itinerary`,
                      })}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Add to {quickDayLabel}
                    </button>
                    <button
                      onClick={() => onOpenScheduler([item], {
                        preferredDayKey: primaryDay?.key,
                        defaultOptional: true,
                        prompt: `Save ${item.name} as an optional stop`,
                      })}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      Save as optional
                    </button>
                    <button
                      onClick={() => onViewDetails(item, "nearby")}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      View details
                    </button>
                    <button
                      onClick={() => onAsk(`Tell me more about ${item.name} and why it works well near ${mainDestination?.name || "this destination"}`)}
                      className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300"
                    >
                      Ask AI
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-[24px] border border-sky-100 bg-white/75 p-4 shadow-[0_16px_35px_rgba(148,163,184,0.08)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {hasSelections
                ? `${selectedIds.length} place${selectedIds.length === 1 ? "" : "s"} selected for itinerary planning`
                : "Select one or more stops to start building your nearby route"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              You can assign them manually, let Wanderly auto-arrange the route, or save them as optional stops.
            </p>
          </div>
          {recommendation?.confirmationPrompt ? <p className="text-sm font-medium text-slate-600">{recommendation.confirmationPrompt}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onPrimaryAction("Plan trip with selected places")}
            disabled={!selectedItems.length}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Plan Trip
          </button>
          <button
            onClick={() => onOpenScheduler(selectedItems, { prompt: "Add selected places to your itinerary" })}
            disabled={!selectedItems.length}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add selected to itinerary
          </button>
          <button
            onClick={() => onOpenScheduler(selectedItems.length ? selectedItems : items.slice(0, 3), {
              autoArrange: true,
              prompt: "Auto-arrange your nearby route",
            })}
            disabled={!items.length}
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 transition hover:border-sky-300"
          >
            Auto-arrange route
          </button>
          <button
            onClick={() => onOpenScheduler(selectedItems.length ? selectedItems : items.slice(0, 3), {
              defaultOptional: true,
              prompt: "Save these as optional stops",
            })}
            disabled={!items.length}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Save as optional stops
          </button>
          <button
            onClick={() => onPrimaryAction("Show more places")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Show more nearby places
          </button>
          <button
            onClick={() => onPrimaryAction("Need food spots nearby")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Best food on this route
          </button>
          <button
            onClick={() => onPrimaryAction("Want budget estimate")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Estimate extra budget
          </button>
        </div>

        {recommendation?.followUpPrompts?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {recommendation.followUpPrompts.map((prompt: string) => (
              <button
                key={prompt}
                onClick={() => onPrimaryAction(prompt)}
                className="rounded-full border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function NearbyItineraryPlannerDialog({
  state,
  onClose,
  onDraftChange,
  onToggleOptional,
  onConfirm,
  onAutoArrange,
}: {
  state: NearbyPlannerDialogState | null
  onClose: () => void
  onDraftChange: (placeId: string, field: "dayKey" | "time" | "durationMinutes", value: string | number) => void
  onToggleOptional: (placeId: string) => void
  onConfirm: (mode?: "optional") => void
  onAutoArrange: () => void
}) {
  const items = state?.items || []
  const drafts = state?.drafts || []
  const dayOptions = state?.dayOptions || []
  const draftLookup = new Map(drafts.map((draft) => [draft.placeId, draft]))
  const scheduleConflicts = state ? findNearbyScheduleConflicts(items, drafts, dayOptions) : []
  const routeEfficiency = getNearbyRouteEfficiencyLabel(items)
  const confirmedCount = drafts.filter((draft) => !draft.isOptional).length
  const optionalCount = drafts.filter((draft) => draft.isOptional).length

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-sky-100 bg-[linear-gradient(180deg,#fbfdff_0%,#f7fbff_44%,#eefbf7_100%)] p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)] sm:max-w-5xl">
        {state ? (
          <div className="p-6 sm:p-7">
            <DialogHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-800">
                  Nearby itinerary planner
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                  {routeEfficiency}
                </span>
              </div>
              <DialogTitle className="text-2xl tracking-[-0.02em] text-slate-950">{state.prompt}</DialogTitle>
              <DialogDescription className="max-w-3xl text-sm leading-6 text-slate-600">
                Place each stop on your trip timeline with a suggested slot, visit length, and clear confirmed or optional status.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_340px]">
              <div className="space-y-4">
                {items.map((item, index) => {
                  const draft = draftLookup.get(item.id)
                  if (!draft) return null
                  const suggestedTime = getSuggestedPlannerTime(item)
                  const timeOptions = getPlannerTimeOptions(item, draft.time)
                  const dayLabel = dayOptions.find((option) => option.key === draft.dayKey)?.label || "Day 1"
                  const routeFitMessage = getNearbyRouteFitMessage(item, draft, dayOptions, scheduleConflicts)
                  const hasConflict = scheduleConflicts.some((note) => note.includes(item.name))

                  return (
                    <div key={item.id} className="rounded-[28px] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,251,255,0.96)_100%)] p-4 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
                      <div className="flex flex-col gap-5 lg:flex-row">
                        <div className="w-full max-w-[220px] overflow-hidden rounded-[20px] border border-slate-100 bg-slate-100 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
                          <RecommendationImage
                            item={item}
                            badge={getNearbyStepLabel(index, items.length)}
                            subtitle={buildNearbyPlaceInsight(item)}
                            isSelected={!draft.isOptional}
                            isSaved={draft.isOptional}
                            stateLabel={draft.isOptional ? "Optional" : "Planned"}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Stop preview</p>
                              <h4 className="mt-2 text-lg font-semibold text-slate-950">{item.name}</h4>
                              <p className="mt-1 text-sm leading-6 text-slate-600">{buildNearbyPlaceInsight(item)}</p>
                            </div>
                            <div className="inline-flex rounded-[18px] border border-slate-200 bg-slate-50/90 p-1 shadow-inner">
                              <button
                                onClick={() => draft.isOptional && onToggleOptional(item.id)}
                                className={cn(
                                  "rounded-[14px] px-3.5 py-2 text-sm font-medium transition",
                                  !draft.isOptional
                                    ? "bg-white text-slate-950 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Confirmed stop
                              </button>
                              <button
                                onClick={() => !draft.isOptional && onToggleOptional(item.id)}
                                className={cn(
                                  "rounded-[14px] px-3.5 py-2 text-sm font-medium transition",
                                  draft.isOptional
                                    ? "bg-white text-slate-950 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700"
                                )}
                              >
                                Optional stop
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                            <div className="rounded-[24px] border border-sky-100 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-4 shadow-[0_14px_32px_rgba(148,163,184,0.08)]">
                              <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                                  <CalendarDays className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">Schedule this stop</p>
                                  <p className="text-xs text-slate-500">Choose the day, time, and visit window that fit your trip best.</p>
                                </div>
                              </div>

                              <div className="mt-5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium text-slate-700">Day</p>
                                  <p className="text-xs text-slate-500">Trip-aware day options</p>
                                </div>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {dayOptions.map((option) => (
                                    <button
                                      key={`${item.id}-${option.key}`}
                                      onClick={() => onDraftChange(item.id, "dayKey", option.key)}
                                      className={cn(
                                        "rounded-[18px] border px-3 py-3 text-left transition",
                                        draft.dayKey === option.key
                                          ? "border-sky-300 bg-sky-50 text-sky-950 shadow-[0_10px_24px_rgba(56,189,248,0.12)]"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/60"
                                      )}
                                    >
                                      <p className="text-sm font-semibold">{option.label}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {draft.dayKey === option.key ? "Selected for this stop" : "Add this stop here"}
                                      </p>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-700">Time</p>
                                    <p className="text-xs text-sky-700">Suggested: {formatPlannerTimeValue(suggestedTime)}</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {timeOptions.map((timeValue) => (
                                      <button
                                        key={`${item.id}-${timeValue}`}
                                        onClick={() => onDraftChange(item.id, "time", timeValue)}
                                        className={cn(
                                          "rounded-full border px-3 py-2 text-sm font-medium transition",
                                          draft.time === timeValue
                                            ? "border-sky-300 bg-sky-50 text-sky-900 shadow-[0_8px_18px_rgba(56,189,248,0.12)]"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50/70"
                                        )}
                                      >
                                        {formatPlannerTimeValue(timeValue)}
                                      </button>
                                    ))}
                                  </div>
                                  <label className="mt-3 block">
                                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Custom time</span>
                                    <Input
                                      type="time"
                                      value={draft.time}
                                      onChange={(event) => onDraftChange(item.id, "time", event.target.value)}
                                      className="mt-2 h-11 rounded-2xl border-slate-200 bg-white"
                                    />
                                  </label>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-slate-700">Visit duration</p>
                                    <p className="text-xs text-teal-700">{getNearbyDurationRecommendation(item)}</p>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {DEFAULT_DURATION_OPTIONS.map((value) => (
                                      <button
                                        key={`${item.id}-duration-${value}`}
                                        onClick={() => onDraftChange(item.id, "durationMinutes", value)}
                                        className={cn(
                                          "rounded-full border px-3 py-2 text-sm font-medium transition",
                                          Number(draft.durationMinutes) === value
                                            ? "border-teal-300 bg-teal-50 text-teal-900 shadow-[0_8px_18px_rgba(45,212,191,0.12)]"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/60"
                                        )}
                                      >
                                        {value === 0 ? "Flexible" : formatDurationLabel(value)}
                                      </button>
                                    ))}
                                  </div>
                                  <p className="mt-3 text-xs leading-5 text-slate-500">
                                    {draft.durationMinutes === 0
                                      ? "Good if you want to keep this as a flexible scenic stop."
                                      : `${formatDurationLabel(draft.durationMinutes)} gives this stop enough time without slowing the route.`}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="rounded-[24px] border border-amber-100 bg-[linear-gradient(180deg,#fffdf8_0%,#fff7ed_100%)] p-4 shadow-[0_14px_30px_rgba(245,158,11,0.10)]">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                                    <CloudSun className="h-4 w-4" />
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">Best slot suggestion</p>
                                    <p className="text-xs text-slate-500">{getNearbyBestTimeLabel(item)}</p>
                                  </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-700">{getNearbyScheduleHelperText(item)}</p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <span className="rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-sky-800">
                                    {formatNearbyTravelValue(item)}
                                  </span>
                                  <span className="rounded-full border border-teal-100 bg-white px-3 py-1.5 text-xs font-medium text-teal-800">
                                    {getNearbyEffortLabel(item)}
                                  </span>
                                  <span className="rounded-full border border-amber-100 bg-white px-3 py-1.5 text-xs font-medium text-amber-800">
                                    {getNearbyBestForLabel(item)}
                                  </span>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  "rounded-[24px] border p-4 shadow-[0_14px_30px_rgba(148,163,184,0.08)]",
                                  hasConflict
                                    ? "border-amber-200 bg-amber-50/90"
                                    : "border-emerald-100 bg-emerald-50/85"
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-2xl",
                                      hasConflict ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                    )}
                                  >
                                    {hasConflict ? <Clock3 className="h-4 w-4" /> : <Route className="h-4 w-4" />}
                                  </span>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">{hasConflict ? "Timing awareness" : "Route fit"}</p>
                                    <p className="text-xs text-slate-500">{hasConflict ? "This stop may need a small adjustment" : "This stop fits your route well"}</p>
                                  </div>
                                </div>
                                <p className={cn("mt-3 text-sm leading-6", hasConflict ? "text-amber-900" : "text-emerald-900")}>
                                  {routeFitMessage}
                                </p>
                                <div className="mt-4 rounded-[18px] border border-white/70 bg-white/80 px-3 py-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Planned stop</p>
                                  <p className="mt-2 text-sm font-semibold text-slate-950">{dayLabel}</p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {formatPlannerTimeValue(draft.time)} · {formatDurationLabel(draft.durationMinutes)}
                                  </p>
                                  <p className="mt-1 text-xs font-medium text-slate-500">
                                    Status: {draft.isOptional ? "Optional stop" : "Confirmed stop"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-4 xl:border-l xl:border-slate-200/80 xl:pl-6">
                <div className="rounded-[24px] border border-sky-100 bg-white/92 p-5 shadow-[0_16px_40px_rgba(148,163,184,0.10)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Plan summary</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Review your stop placement before it goes into the itinerary. This preview updates live as you refine timing.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confirmed</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{confirmedCount} stop{confirmedCount === 1 ? "" : "s"}</p>
                    </div>
                    <div className="rounded-[18px] border border-slate-100 bg-slate-50/80 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Optional</p>
                      <p className="mt-2 text-lg font-semibold text-slate-950">{optionalCount} stop{optionalCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {items.map((item) => {
                      const draft = draftLookup.get(item.id)
                      const dayLabel = dayOptions.find((option) => option.key === draft?.dayKey)?.label || "Day 1"
                      return (
                        <div key={`summary-${item.id}`} className="rounded-[20px] border border-slate-100 bg-slate-50/85 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Planned stop</p>
                          <p className="mt-2 font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {dayLabel}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{formatPlannerTimeValue(draft?.time)} · {formatDurationLabel(draft?.durationMinutes)}</p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Status: {draft?.isOptional ? "Optional stop" : "Confirmed stop"}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {scheduleConflicts.length ? (
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-4 shadow-[0_16px_32px_rgba(245,158,11,0.10)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800">Timing check</p>
                    <div className="mt-3 space-y-2">
                      {scheduleConflicts.map((note) => (
                        <p key={note} className="text-sm leading-6 text-amber-900">{note}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/85 p-4 shadow-[0_16px_32px_rgba(16,185,129,0.08)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">Smart suggestions</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">
                    Let Wanderly place these stops in the best route order, or keep lighter stops as optional until the plan is final.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={onAutoArrange}
                      className="rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-sm font-medium text-emerald-800 transition hover:border-emerald-300"
                    >
                      Auto-arrange selected places
                    </button>
                    <button
                      onClick={() => onConfirm("optional")}
                      className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      Save as optional stops
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 flex-col gap-2 border-t border-slate-200/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button variant="outline" onClick={onClose} className="rounded-full border-slate-200 bg-white">
                Cancel
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => onConfirm("optional")} className="rounded-full border-slate-200 bg-white">
                  Save as optional stops
                </Button>
                <Button onClick={() => onConfirm()} className="rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800">
                  Confirm and add
                </Button>
              </div>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function HotelRecommendationsCard({
  payload,
  selectedId,
  savedIds,
  comparedIds,
  onSelect,
  onSave,
  onCompare,
  onViewDetails,
  onBook,
  onAsk,
  onAction,
}: {
  payload: any
  selectedId?: string
  savedIds: string[]
  comparedIds: string[]
  onSelect: (item: any) => void
  onSave: (item: any) => void
  onCompare: (item: any) => void
  onViewDetails: (item: any) => void
  onBook: (item: any) => void
  onAsk: (prompt: string) => void
  onAction: (action: string) => void
}) {
  const items = payload?.cards || []
  if (!items.length) return null

  return (
    <div className="space-y-4 rounded-[28px] border border-sky-200/70 bg-[linear-gradient(180deg,#fbfdff_0%,#eff6ff_100%)] p-5 shadow-[0_20px_50px_rgba(59,130,246,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Stay concierge</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{payload?.title || "Recommended stays"}</h3>
          {payload?.introText ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{payload.introText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {payload?.summaryBadge ? (
            <div className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700">
              {payload.summaryBadge}
            </div>
          ) : null}
          <div className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-950">{items.length}</span> stay option{items.length === 1 ? "" : "s"}
          </div>
          {comparedIds.length ? (
            <div className="rounded-2xl border border-sky-100 bg-white/90 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-950">{comparedIds.length}</span> in compare
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item: any, index: number) => {
          const isSelected = selectedId === item.id
          const isSaved = savedIds.includes(item.id)
          const isCompared = comparedIds.includes(item.id)

          return (
            <div
              key={item.id}
              className={cn(
                "group flex h-full flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] shadow-[0_16px_40px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(14,165,233,0.12)]",
                isSelected
                  ? "border-emerald-300 bg-[linear-gradient(180deg,rgba(240,253,250,0.99)_0%,rgba(248,250,252,0.97)_100%)] ring-2 ring-emerald-100/90"
                  : "border-slate-200/80 hover:border-sky-200/80"
              )}
            >
              <RecommendationImage
                item={buildStayVisualItem(item)}
                badge={buildStayCardBadge(item, index)}
                subtitle={buildStayInsight(item)}
                isSelected={isSelected}
                isSaved={isSaved}
                stateLabel="Added to budget"
              />

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">{item.name}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{item.location || item.sourceDestination || "Stay option"}</p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                    item.kind === "hotel" ? "bg-sky-50 text-sky-800" : "bg-violet-50 text-violet-800"
                  )}>
                    {item.kind === "hotel" ? "Hotel" : "Area pick"}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{item.reason}</p>

                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <Wallet className="h-3.5 w-3.5 text-sky-600" />
                      Budget
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{item.budgetLabel || "Flexible"}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <Clock3 className="h-3.5 w-3.5 text-emerald-600" />
                      Access
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{item.walkingTime || "Easy access"}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      Fit
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{item.ratingLabel || item.tags?.[0] || "Strong fit"}</p>
                  </div>
                </div>

                {item.tags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto space-y-2.5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onSelect(item)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        isSelected ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-950 text-white hover:bg-slate-800"
                      )}
                    >
                      {isSelected ? "Added to budget" : "Add stay to budget"}
                    </button>
                    <button
                      onClick={() => onBook(item)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Book stay
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onViewDetails(item)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      View details
                    </button>
                    <button
                      onClick={() => onCompare(item)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm transition",
                        isCompared
                          ? "border-sky-200 bg-sky-50 text-sky-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {isCompared ? "Compared" : "Compare"}
                    </button>
                    <button
                      onClick={() => onSave(item)}
                      className={cn(
                        "rounded-full border px-3 py-2 text-sm transition",
                        isSaved
                          ? "border-violet-200 bg-violet-50 text-violet-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {isSaved ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-sky-200/70 pt-4">
        <div className="flex flex-wrap gap-2">
          {(payload?.responseActions || []).map((action: string, index: number) => (
            <button
              key={action}
              onClick={() => onAction(action)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                index === 0 ? "bg-sky-600 text-white hover:bg-sky-700" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {action}
            </button>
          ))}
        </div>

        {selectedId ? (
          <p className="mt-3 text-sm text-slate-600">Your selected stay is ready to carry into budget or booking.</p>
        ) : null}

        {payload?.followUpPrompts?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {payload.followUpPrompts.map((prompt: string) => (
              <button
                key={prompt}
                onClick={() => onAsk(prompt)}
                className="rounded-full border border-sky-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-sky-300 hover:bg-sky-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MapContextCard({
  payload,
  onAction,
}: {
  payload: any
  onAction: (action: string) => void
}) {
  if (!payload) return null

  return (
    <div className="space-y-4 rounded-[28px] border border-indigo-200/70 bg-[linear-gradient(180deg,#fafcff_0%,#eef2ff_100%)] p-5 shadow-[0_20px_50px_rgba(99,102,241,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-700">Map context</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{payload?.title || "Location view"}</h3>
          {payload?.introText ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{payload.introText}</p> : null}
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-3 text-sm text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700">Area</p>
          <p className="mt-2 font-semibold text-slate-950">{payload.areaLabel || "Destination area"}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(129,140,248,0.20),transparent_26%),linear-gradient(135deg,#eff6ff_0%,#f8fafc_46%,#eef2ff_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.12)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="relative flex h-full min-h-[280px] flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-800">
                <MapPinned className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
                Destination pin
              </span>
              <span className="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                <Route className="mr-1.5 h-3.5 w-3.5 text-sky-600" />
                Walkable context
              </span>
            </div>

            <div className="max-w-lg">
              <p className="text-sm font-medium text-slate-600">{payload.areaLabel}</p>
              <h4 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{payload.destinationName}</h4>
              <p className="mt-3 text-sm leading-7 text-slate-700">{payload.locationSummary}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(payload?.nearbyHighlights || []).slice(0, 3).map((item: any) => (
                <span key={item.name} className="rounded-full border border-white/80 bg-white/92 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_14px_30px_rgba(99,102,241,0.08)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <Compass className="h-3.5 w-3.5 text-indigo-600" />
              Nearby highlights
            </div>
            <div className="mt-3 space-y-3">
              {(payload?.nearbyHighlights || []).map((item: any) => (
                <div key={item.name} className="rounded-[18px] bg-slate-50/90 px-3.5 py-3">
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          {payload?.hotelHighlights?.length ? (
            <div className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_14px_30px_rgba(59,130,246,0.08)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Hotel className="h-3.5 w-3.5 text-sky-600" />
                Stays nearby
              </div>
              <div className="mt-3 space-y-3">
                {payload.hotelHighlights.map((item: any) => (
                  <div key={item.name} className="rounded-[18px] bg-slate-50/90 px-3.5 py-3">
                    <p className="font-semibold text-slate-950">{item.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(payload?.responseActions || []).map((action: string, index: number) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              index === 0 ? "bg-indigo-600 text-white hover:bg-indigo-700" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

function ContextGuardrailCard({
  guardrail,
  onAction,
}: {
  guardrail: any
  onAction: (action: string) => void
}) {
  if (!guardrail) return null

  return (
    <div className="rounded-[28px] border border-orange-200/80 bg-[linear-gradient(180deg,#fffaf4_0%,#fff5eb_100%)] p-5 shadow-[0_20px_50px_rgba(249,115,22,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">{guardrail.title || "Different destination detected"}</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{guardrail.requestedDestination?.name || "Different destination"}</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{guardrail.introText}</p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-white/90 px-4 py-3 text-sm text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700">Current trip</p>
          <p className="mt-2 font-semibold text-slate-950">{guardrail.currentTripLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-white/80 bg-white/90 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Option 1</p>
          <p className="mt-2 font-semibold text-slate-950">Continue with current trip</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Keep this chat focused on your active destination and nearby planning.</p>
        </div>
        <div className="rounded-[22px] border border-white/80 bg-white/90 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Option 2</p>
          <p className="mt-2 font-semibold text-slate-950">Explore separately</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Start a new trip flow for {guardrail.requestedDestination?.name || "this place"} without changing your current plan.</p>
        </div>
        <div className="rounded-[22px] border border-white/80 bg-white/90 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Option 3</p>
          <p className="mt-2 font-semibold text-slate-950">Add as new destination</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Keep your trip and add this place as another destination in the same plan.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(guardrail?.responseActions || []).map((action: string, index: number) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              index === 0 ? "bg-slate-950 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

function FoodGuideCard({ guide }: { guide: any }) {
  if (!guide) return null

  return (
    <div className="rounded-[24px] border border-rose-200/70 bg-[linear-gradient(135deg,#fff8f6_0%,#fff1ec_100%)] p-5 shadow-[0_18px_40px_rgba(251,113,133,0.08)]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Food guide</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">{guide.placeName}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{guide.quickAnswer}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(guide.sections || []).map((section: any) => (
          <div key={section.title} className="rounded-2xl border border-white/70 bg-white/90 p-4">
            <p className="text-sm font-semibold text-slate-950">{section.title}</p>
            <div className="mt-2 text-sm leading-6 text-slate-700">
              {(section.items || []).map((item: string) => (
                <p key={item}>• {item}</p>
              ))}
              {section.note ? <p className="mt-2 text-xs font-medium text-rose-700">{section.note}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LocalTipsCard({ tips }: { tips: string[] }) {
  if (!tips?.length) return null

  return (
    <div className="rounded-[24px] border border-violet-200/70 bg-[linear-gradient(135deg,#fbfaff_0%,#f4f0ff_100%)] p-5 shadow-[0_18px_40px_rgba(139,92,246,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Local tips</p>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
        {tips.map((tip) => (
          <p key={tip}>• {tip}</p>
        ))}
      </div>
    </div>
  )
}

function getMiniPlanTheme(plan: any) {
  const subtype = String(plan?.subtype || "general")

  if (subtype === "evening" || subtype === "morning" || subtype === "nearby_add_on") {
    return {
      eyebrow: subtype === "morning" ? "Morning plan" : subtype === "nearby_add_on" ? "Next-stop route" : "Evening plan",
      container: "border-amber-200/80 bg-[linear-gradient(135deg,#fffaf1_0%,#fff1dc_52%,#fff8f0_100%)] shadow-[0_20px_48px_rgba(245,158,11,0.12)]",
      accent: "text-amber-800",
      badge: "bg-amber-100 text-amber-900",
      chip: "border-amber-200 bg-white/92 text-amber-900",
      line: "from-amber-300 via-amber-200 to-amber-100",
      meta: "bg-white/82 border-amber-100/80",
    }
  }
  if (subtype === "romantic") {
    return {
      eyebrow: "Romantic route",
      container: "border-rose-200/80 bg-[linear-gradient(135deg,#fff8fb_0%,#ffeaf2_52%,#fff7fa_100%)] shadow-[0_20px_48px_rgba(244,114,182,0.11)]",
      accent: "text-rose-800",
      badge: "bg-rose-100 text-rose-900",
      chip: "border-rose-200 bg-white/92 text-rose-900",
      line: "from-rose-300 via-rose-200 to-rose-100",
      meta: "bg-white/82 border-rose-100/80",
    }
  }
  if (subtype === "family") {
    return {
      eyebrow: "Family route",
      container: "border-teal-200/80 bg-[linear-gradient(135deg,#f2fdfa_0%,#e6fffb_52%,#f5fffd_100%)] shadow-[0_20px_48px_rgba(20,184,166,0.10)]",
      accent: "text-teal-800",
      badge: "bg-teal-100 text-teal-900",
      chip: "border-teal-200 bg-white/92 text-teal-900",
      line: "from-teal-300 via-teal-200 to-teal-100",
      meta: "bg-white/82 border-teal-100/80",
    }
  }
  if (subtype === "budget") {
    return {
      eyebrow: "Value plan",
      container: "border-emerald-200/80 bg-[linear-gradient(135deg,#f3fff8_0%,#e8fff4_52%,#f8fffb_100%)] shadow-[0_20px_48px_rgba(16,185,129,0.10)]",
      accent: "text-emerald-800",
      badge: "bg-emerald-100 text-emerald-900",
      chip: "border-emerald-200 bg-white/92 text-emerald-900",
      line: "from-emerald-300 via-emerald-200 to-emerald-100",
      meta: "bg-white/82 border-emerald-100/80",
    }
  }
  if (subtype === "quick" || subtype === "half_day") {
    return {
      eyebrow: subtype === "half_day" ? "Half-day plan" : "Quick route",
      container: "border-slate-200/90 bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_45%,#f8fafc_100%)] shadow-[0_20px_48px_rgba(51,65,85,0.10)]",
      accent: "text-slate-800",
      badge: "bg-slate-100 text-slate-900",
      chip: "border-slate-200 bg-white/92 text-slate-900",
      line: "from-slate-300 via-slate-200 to-slate-100",
      meta: "bg-white/82 border-slate-200/80",
    }
  }
  if (subtype === "full_day") {
    return {
      eyebrow: "Full-day plan",
      container: "border-indigo-200/80 bg-[linear-gradient(135deg,#f7f8ff_0%,#eef1ff_52%,#fafbff_100%)] shadow-[0_20px_48px_rgba(99,102,241,0.10)]",
      accent: "text-indigo-800",
      badge: "bg-indigo-100 text-indigo-900",
      chip: "border-indigo-200 bg-white/92 text-indigo-900",
      line: "from-indigo-300 via-indigo-200 to-indigo-100",
      meta: "bg-white/82 border-indigo-100/80",
    }
  }

  return {
    eyebrow: "Mini plan",
    container: "border-sky-200/70 bg-[linear-gradient(135deg,#f8fcff_0%,#eef8ff_100%)] shadow-[0_18px_40px_rgba(56,189,248,0.08)]",
    accent: "text-sky-800",
    badge: "bg-sky-100 text-sky-900",
    chip: "border-sky-200 bg-white/92 text-sky-900",
    line: "from-sky-300 via-sky-200 to-sky-100",
    meta: "bg-white/82 border-sky-100/80",
  }
}

function MiniPlanCard({ plan }: { plan: any }) {
  const planStops = Array.isArray(plan?.stops) ? plan.stops : []
  const planDays = Array.isArray(plan?.days) ? plan.days : []
  if (!planStops.length && !planDays.length) return null
  const theme = getMiniPlanTheme(plan)

  return (
    <div className={cn("overflow-hidden rounded-[26px] border p-5", theme.container)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className={cn("text-xs font-semibold uppercase tracking-[0.22em]", theme.accent)}>{theme.eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-slate-950">{plan.title}</h3>
          {plan.subtitle ? <p className="mt-2 text-sm font-medium text-slate-500">{plan.subtitle}</p> : null}
          {plan.summary ? <p className="mt-3 text-sm leading-6 text-slate-700">{plan.summary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {plan.durationLabel ? <span className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", theme.badge)}>{plan.durationLabel}</span> : null}
          {plan.routeStyle ? <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize", theme.chip)}>{plan.routeStyle}</span> : null}
          {planDays.length ? <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", theme.chip)}>{planDays.length} days</span> : null}
          {planStops.length ? <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", theme.chip)}>{planStops.length} stops</span> : null}
        </div>
      </div>

      {(plan.changeSummary || plan.whyThisFits || plan.addOnSuggestion) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {plan.changeSummary ? (
            <div className={cn("rounded-[20px] border p-4", theme.meta)}>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme.accent)}>What changed</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{plan.changeSummary}</p>
            </div>
          ) : null}
          {plan.whyThisFits ? (
            <div className={cn("rounded-[20px] border p-4", theme.meta)}>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme.accent)}>Why this fits</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{plan.whyThisFits}</p>
            </div>
          ) : null}
          {plan.addOnSuggestion ? (
            <div className={cn("rounded-[20px] border p-4", theme.meta)}>
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em]", theme.accent)}>Good next move</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{plan.addOnSuggestion}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {planDays.length ? (
        <div className="mt-5 space-y-5">
          {planDays.map((day: any) => (
            <div key={`day-${day.dayNumber}`} className="rounded-[24px] border border-white/80 bg-white/92 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 border-b border-slate-200/70 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", theme.accent)}>Day {day.dayNumber}</p>
                  <h4 className="mt-2 text-lg font-semibold text-slate-950">{day.title}</h4>
                  {day.summary ? <p className="mt-2 text-sm leading-6 text-slate-700">{day.summary}</p> : null}
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {(day.blocks || []).map((block: any, index: number) => (
                  <div key={`${block.id || block.title}-${index}`} className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", theme.badge)}>
                        {block.timing}
                      </span>
                      {block.tag ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                          {block.tag}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 font-semibold text-slate-950">{block.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{block.detail}</p>
                    {(block.duration || block.note) ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        {block.duration ? (
                          <div className="rounded-[16px] border border-slate-200/80 bg-white px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Visit</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{block.duration}</p>
                          </div>
                        ) : null}
                        {block.note ? (
                          <div className="rounded-[16px] border border-slate-200/80 bg-white px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Best slot</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">{block.note}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="mt-5 space-y-4">
        {planStops.map((stop: any, index: number) => (
          <div key={`${stop.id || stop.title}-${index}`} className="grid gap-3 md:grid-cols-[auto,1fr] md:items-start">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm", theme.badge)}>
                  {index + 1}
                </span>
                {index < planStops.length - 1 ? <div className={cn("mt-2 h-14 w-px bg-gradient-to-b", theme.line)} /> : null}
              </div>
            </div>
            <div className="rounded-[22px] border border-white/80 bg-white/92 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", theme.badge)}>
                      {stop.timing}
                    </span>
                    {stop.tag ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {stop.tag}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-slate-950">{stop.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{stop.detail}</p>
                </div>
                <div className="grid min-w-[190px] gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {stop.duration ? (
                    <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Visit</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{stop.duration}</p>
                    </div>
                  ) : null}
                  {stop.note ? (
                    <div className="rounded-[18px] border border-slate-200/80 bg-slate-50/90 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Best slot</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{stop.note}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

function ResponseActions({
  actions,
  onAction,
}: {
  actions: string[]
  onAction: (action: string) => void
}) {
  const visibleActions = dedupeActionLabels(actions, 4)
  if (!visibleActions.length) return null

  const [primary, ...secondary] = visibleActions

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={() => onAction(primary)}
        className="rounded-full bg-sky-600 px-3.5 py-2 text-sm font-medium text-white shadow-[0_10px_24px_rgba(37,99,235,0.16)] transition hover:bg-sky-700"
      >
        {primary}
      </button>
      {secondary.map((action) => (
        <button
          key={action}
          onClick={() => onAction(action)}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {action}
        </button>
      ))}
    </div>
  )
}

function TravelOptions({
  title,
  items,
  type,
}: {
  title: string
  items: any[]
  type: "hotel" | "flight"
}) {
  if (!items?.length) return null

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.08)]">
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{type === "hotel" ? item.name : `${item.from} to ${item.to}`}</p>
              <p className="text-sm text-slate-500">
                {type === "hotel"
                  ? `${item.destination} | ${item.rating}/5 rating`
                  : `${item.airline} | ${item.departure} - ${item.arrival} | ${item.duration}`}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-950">{formatMoney(item.price, item.currency || DEFAULT_CURRENCY)}</p>
              <p className="text-xs text-slate-500">{type === "hotel" ? "per night" : "from"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlaceDetailsDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: { item: any; kind: "destination" | "nearby"; summary: string; matchLine: string } | null
}) {
  if (!detail) return null

  const { item, kind, summary, matchLine } = detail
  const meta = buildPlaceMeta(item, kind)
  const tags = getCompactTags(item)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden rounded-[30px] border-slate-200 bg-white p-0 sm:max-w-3xl">
        <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[260px] bg-slate-100">
            <RecommendationImage
              item={item}
              badge={kind === "nearby" ? deriveNearbyBadge(item, 0) : deriveDestinationBadge(item, 0)}
              subtitle={summary}
              isSelected={false}
              isSaved={false}
              stateLabel="Added to trip"
            />
          </div>
          <div className="space-y-5 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{kind === "nearby" ? "Place details" : "Destination details"}</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{item.name}</h3>
              <p className="mt-2 text-sm text-slate-500">{formatLocationLabel(item) || item.category || "Travel recommendation"}</p>
              <p className="mt-4 text-sm leading-7 text-slate-600">{item.description || item.whyVisit || summary}</p>
            </div>

            <div className="rounded-[22px] bg-sky-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">AI match reason</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{matchLine || summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {meta.map((entry) => {
                const Icon = entry.icon
                return (
                  <div key={entry.label} className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Icon className={cn("h-3.5 w-3.5", entry.accent)} />
                      {entry.label}
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">{entry.value}</p>
                  </div>
                )
              })}
            </div>

            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-[20px] bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Nearby attractions</p>
                <p className="mt-2 leading-6">{kind === "nearby" ? "Easy to pair with your current route and nearby sightseeing." : `I can suggest nearby places around ${item.name} next.`}</p>
              </div>
              <div className="rounded-[20px] bg-slate-50 p-4">
                <p className="font-semibold text-slate-950">Stay and budget hint</p>
                <p className="mt-2 leading-6">{kind === "nearby" ? "Works best as a short stop without needing a separate stay." : "A good fit if you want a polished destination card before moving to hotels and budgeting."}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PlaceRecommendationCard({
  item,
  kind,
  badge,
  summary,
  matchLine,
  isSelected,
  isSaved,
  isCompared,
  primaryLabel,
  selectedLabel,
  saveLabel,
  savedLabel,
  compareLabel,
  comparedLabel,
  onPrimary,
  onSave,
  onCompare,
  onViewDetails,
  onAskAi,
  onSimilar,
}: {
  item: any
  kind: "destination" | "nearby"
  badge: string
  summary: string
  matchLine: string
  isSelected: boolean
  isSaved: boolean
  isCompared?: boolean
  primaryLabel: string
  selectedLabel: string
  saveLabel: string
  savedLabel: string
  compareLabel?: string
  comparedLabel?: string
  onPrimary: () => void
  onSave?: () => void
  onCompare?: () => void
  onViewDetails: () => void
  onAskAi: () => void
  onSimilar?: () => void
}) {
  const tags = getCompactTags(item)
  const meta = buildPlaceMeta(item, kind)

  return (
    <div
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.97)_100%)] shadow-[0_16px_40px_rgba(15,23,42,0.07)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(14,165,233,0.12)]",
        isSelected
          ? "border-emerald-300 bg-[linear-gradient(180deg,rgba(240,253,250,0.99)_0%,rgba(248,250,252,0.97)_100%)] ring-2 ring-emerald-100/90"
          : "border-slate-200/80 hover:border-sky-200/80"
      )}
    >
      <RecommendationImage
        item={item}
        badge={badge}
        subtitle={summary}
        isSelected={isSelected}
        isSaved={isSaved}
        stateLabel={selectedLabel}
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">{item.name}</p>
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">{formatLocationLabel(item) || item.category || item.subtitle || "Travel recommendation"}</p>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
            kind === "nearby" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"
          )}>
            {matchLine}
          </span>
        </div>

        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{item.description || item.whyVisit || summary}</p>
        <p className="mt-3 line-clamp-2 rounded-[18px] bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-600">{summary}</p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {meta.map((entry) => {
            const Icon = entry.icon
            return (
              <div key={entry.label} className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <Icon className={cn("h-3.5 w-3.5", entry.accent)} />
                  {entry.label}
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{entry.value}</p>
              </div>
            )
          })}
        </div>

        {tags.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {kind === "nearby" ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              onClick={onPrimary}
              className={cn(
                "inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition",
                isSelected
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-[linear-gradient(135deg,#f59e0b_0%,#d97706_100%)] text-white shadow-[0_14px_28px_rgba(217,119,6,0.26)] hover:shadow-[0_18px_34px_rgba(217,119,6,0.30)]"
              )}
            >
              {isSelected ? (
                <>
                  <CheckCircle2 className="mr-2 h-4.5 w-4.5" />
                  {selectedLabel}
                </>
              ) : primaryLabel}
            </button>
            <button
              onClick={onViewDetails}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              View details
            </button>
            <button
              onClick={onAskAi}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              Ask AI
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={onPrimary}
                className={cn(
                  "inline-flex flex-1 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition",
                  isSelected
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                    : "bg-[linear-gradient(135deg,#0284c7_0%,#0369a1_100%)] text-white shadow-[0_14px_28px_rgba(2,132,199,0.26)] hover:shadow-[0_18px_34px_rgba(2,132,199,0.30)]"
                )}
              >
                {isSelected ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4.5 w-4.5" />
                    {selectedLabel}
                  </>
                ) : primaryLabel}
              </button>
              {onSave ? (
                <button
                  onClick={onSave}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border px-3.5 py-3 text-sm font-medium transition",
                    isSaved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {isSaved ? savedLabel : saveLabel}
                </button>
              ) : null}
              {onCompare ? (
                <button
                  onClick={onCompare}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border px-3.5 py-3 text-sm font-medium transition",
                    isCompared ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {isCompared ? comparedLabel || "Compared" : compareLabel || "Compare"}
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                onClick={onViewDetails}
                className="text-sm font-medium text-sky-700 transition hover:text-sky-800"
              >
                View details
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-2xl border-slate-200 bg-white/98 p-1.5">
                  <DropdownMenuItem onClick={onViewDetails} className="rounded-xl px-3 py-2 text-sm">View details</DropdownMenuItem>
                  <DropdownMenuItem onClick={onAskAi} className="rounded-xl px-3 py-2 text-sm">Ask AI</DropdownMenuItem>
                  {onSimilar ? <DropdownMenuItem onClick={onSimilar} className="rounded-xl px-3 py-2 text-sm">Similar picks</DropdownMenuItem> : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function FlightSearchResults({
  payload,
  selectedId,
  savedIds,
  comparedIds,
  onSelect,
  onSave,
  onCompare,
  onBook,
  onAsk,
  onAction,
}: {
  payload: any
  selectedId?: string
  savedIds: string[]
  comparedIds: string[]
  onSelect: (flight: any) => void
  onSave: (flight: any) => void
  onCompare: (flight: any) => void
  onBook: (flight: any, payload: any) => void
  onAsk: (prompt: string) => void
  onAction: (action: string) => void
}) {
  const items = payload?.cards || []
  if (!items.length) return null

  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_20px_50px_rgba(148,163,184,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Flight search</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">{payload?.querySummary || "Flight options"}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{payload?.introText}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(payload?.summaryBadges || []).map((badge: string) => (
            <span key={badge} className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900">
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
        {items.map((flight: any) => {
          const isSelected = selectedId === flight.id
          const isSaved = savedIds.includes(flight.id)
          const isCompared = comparedIds.includes(flight.id)

          return (
            <div
              key={flight.id}
              className={cn(
                "group flex h-full flex-col rounded-[28px] border bg-white/98 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(2,132,199,0.14)]",
                isSelected ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200/80 hover:border-sky-200"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0f172a_0%,#0ea5e9_100%)] text-sm font-semibold text-white shadow-[0_14px_30px_rgba(14,165,233,0.20)]">
                    {flight.logoLabel || flight.airline?.slice(0, 2)?.toUpperCase() || "FL"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-950">{flight.airline}</p>
                    <p className="text-sm text-slate-500">{flight.cabinClass} • {flight.fareType}</p>
                  </div>
                </div>
                <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800">
                  {flight.badge}
                </span>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">{flight.departureTime}</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">{flight.route?.originCode} • {flight.route?.originCity}</p>
                  </div>
                  <div className="flex min-w-[140px] flex-col items-center px-2 text-center">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{flight.duration}</p>
                    <div className="mt-2 flex w-full items-center gap-2">
                      <div className="h-px flex-1 bg-slate-300" />
                      <Plane className="h-4 w-4 text-sky-600" />
                      <div className="h-px flex-1 bg-slate-300" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-500">{flight.stopLabel}</p>
                  </div>
                  <div className="min-w-0 text-right">
                    <p className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">{flight.arrivalTime}</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">{flight.route?.destinationCode} • {flight.route?.destinationCity}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-[20px] border border-slate-200/80 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatDisplayDate(flight.departureDate)}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Baggage</p>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-950">{flight.baggageNote}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fit</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{flight.matchLabel}</p>
                </div>
                <div className="rounded-[20px] border border-slate-200/80 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Price</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{formatMoney(flight.price, flight.currency || DEFAULT_CURRENCY)}</p>
                </div>
              </div>

              <p className="mt-4 rounded-[20px] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{flight.explanation}</p>
              {flight.layoverNote ? <p className="mt-2 text-xs font-medium text-slate-500">{flight.layoverNote}</p> : null}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => onSelect(flight)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition",
                    isSelected
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-[linear-gradient(135deg,#0284c7_0%,#0369a1_100%)] text-white shadow-[0_16px_30px_rgba(2,132,199,0.28)] hover:shadow-[0_20px_36px_rgba(2,132,199,0.34)]"
                  )}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4.5 w-4.5" />
                      Selected
                    </>
                  ) : "Select flight"}
                </button>
                <button
                  onClick={() => onBook(flight, payload)}
                  className="rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Book ticket
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => onSave(flight)}
                  className={cn(
                    "rounded-full border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition",
                    isSaved ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {isSaved ? "Saved" : "Save option"}
                </button>
                <button
                  onClick={() => onCompare(flight)}
                  className={cn(
                    "rounded-full border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition",
                    isCompared ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {isCompared ? "Compared" : "Compare"}
                </button>
                <button
                  onClick={() => onAsk(`Explain why ${flight.airline} on ${payload?.querySummary} is a strong pick`)}
                  className="rounded-full border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-300"
                >
                  View details
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
        {(payload?.responseActions || []).map((action: string, index: number) => (
          <button
            key={action}
            onClick={() => onAction(action)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              index === 0 ? "bg-sky-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.20)] hover:bg-sky-700" : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            )}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

function DestinationSuggestions({
  recommendation,
  mode,
  selectedIds,
  savedIds,
  comparedIds,
  onSelect,
  onSave,
  onCompare,
  onViewDetails,
  onAsk,
  onFilter,
  onPrimaryAction,
}: {
  recommendation: any
  mode: ChatMode
  selectedIds: string[]
  savedIds: string[]
  comparedIds: string[]
  onSelect: (item: any) => void
  onSave: (item: any) => void
  onCompare: (item: any) => void
  onViewDetails: (item: any, kind: "destination") => void
  onAsk: (prompt: string) => void
  onFilter: (chip: string) => void
  onPrimaryAction: (action: string) => void
}) {
  const items = recommendation?.cards || recommendation?.destinations || []
  if (!items?.length) return null

  const compareReady = selectedIds.length + comparedIds.filter((id) => !selectedIds.includes(id)).length >= 2
  const primaryCta = mode === "connected" ? "Start plan with selected places" : "Start trip with selected places"

  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_20px_50px_rgba(148,163,184,0.10)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Destination suggestions</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {recommendation?.title || "Strong destination matches for your trip"}
          </h3>
          {recommendation?.reason ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{recommendation.reason}</p> : null}
        </div>
        {recommendation?.summaryBadge ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50/90 px-4 py-3 text-sm font-medium text-sky-900">
            {recommendation.summaryBadge}
          </div>
        ) : null}
      </div>

      {recommendation?.filterChips?.length ? (
        <div className="flex flex-wrap gap-2">
          {recommendation.filterChips.map((chip: string) => (
            <button
              key={chip}
              onClick={() => onFilter(chip)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
            >
              {chip}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item: any, index: number) => {
          const isSelected = selectedIds.includes(item.id)
          const isSaved = savedIds.includes(item.id)
          const isCompared = comparedIds.includes(item.id)
          const heroBadge = deriveDestinationBadge(item, index)
          const summary = buildDestinationInsight(item)
          const matchLine = item.whyThisMatches || "Strong match"

          return (
            <PlaceRecommendationCard
              key={item.id}
              item={item}
              kind="destination"
              badge={heroBadge}
              summary={summary}
              matchLine={matchLine}
              isSelected={isSelected}
              isSaved={isSaved}
              isCompared={isCompared}
              primaryLabel={mode === "connected" ? "Add to trip" : "Add to shortlist"}
              selectedLabel="Added to trip"
              saveLabel="Save"
              savedLabel="Saved"
              compareLabel="Compare"
              comparedLabel="Compared"
              onPrimary={() => onSelect(item)}
              onSave={() => onSave(item)}
              onCompare={() => onCompare(item)}
              onViewDetails={() => onViewDetails(item, "destination")}
              onAskAi={() => onAsk(`Why is ${item.name} a strong match for this trip?`)}
              onSimilar={() => onAsk(`Show more places like ${item.name}`)}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
        <button
          onClick={() => onPrimaryAction(primaryCta)}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {primaryCta}
        </button>
        {compareReady ? (
          <button
            onClick={() => onPrimaryAction("Compare selected places")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
          >
            Compare selected places
          </button>
        ) : null}
        <button
          onClick={() => onPrimaryAction("Estimate budget")}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          Estimate budget
        </button>
        <button
          onClick={() => onPrimaryAction(mode === "connected" ? "Find hotels for selected places" : "Find family-friendly hotels")}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300"
        >
          Find hotels
        </button>
      </div>

      {recommendation?.followUpQuestion ? (
        <p className="text-sm text-slate-600">{recommendation.followUpQuestion}</p>
      ) : null}
    </div>
  )
}

export default function AiAssistantPage() {
  const router = useRouter()
  const { tripSetup, addDestination, setTripSetup, hydrated } = useTripPlanning()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("Thinking through your trip")
  const [placeDetail, setPlaceDetail] = useState<{ item: any; kind: "destination" | "nearby"; summary: string; matchLine: string } | null>(null)
  const [destinationsDialogOpen, setDestinationsDialogOpen] = useState(false)
  const [newChatDialogOpen, setNewChatDialogOpen] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState("")
  const [renameValue, setRenameValue] = useState("")
  const [deleteSessionId, setDeleteSessionId] = useState("")
  const [nearbyPlannerDialog, setNearbyPlannerDialog] = useState<NearbyPlannerDialogState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef(0)
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null)

  const appMemory = useMemo(
    () => ({
      ...tripSetup,
      selectedDestinations: Array.isArray(tripSetup?.selectedDestinations) ? tripSetup.selectedDestinations : [],
    }),
    [tripSetup]
  )

  useEffect(() => {
    if (!hydrated) return

    try {
      const storedSessions = window.localStorage.getItem(CHAT_STORAGE_KEY)
      const parsedSessions = storedSessions
        ? (JSON.parse(storedSessions) as ChatSession[]).map((session) => ({
            ...session,
            mode: session.mode || (!isContextEmpty(session.memory) ? "connected" : "fresh"),
            titleLocked: Boolean(session.titleLocked),
          }))
        : []
      const activeId = window.localStorage.getItem(ACTIVE_CHAT_STORAGE_KEY) || ""

      if (parsedSessions.length > 0) {
        setSessions(parsedSessions)
        setActiveSessionId(
          parsedSessions.some((session) => session.id === activeId) ? activeId : parsedSessions[0].id
        )
      } else {
        const initial = createSession(isContextEmpty(appMemory) ? "fresh" : "connected", appMemory)
        setSessions([initial])
        setActiveSessionId(initial.id)
      }
    } catch {
      const initial = createSession(isContextEmpty(appMemory) ? "fresh" : "connected", appMemory)
      setSessions([initial])
      setActiveSessionId(initial.id)
    }
  }, [appMemory, hydrated])

  useEffect(() => {
    if (!hydrated || sessions.length === 0) return
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions))
  }, [hydrated, sessions])

  useEffect(() => {
    if (!hydrated || !activeSessionId) return
    window.localStorage.setItem(ACTIVE_CHAT_STORAGE_KEY, activeSessionId)
  }, [activeSessionId, hydrated])

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || sessions[0] || null,
    [activeSessionId, sessions]
  )

  const currentMemory = useMemo(
    () =>
      activeSession?.mode === "connected"
        ? mergeMemory(appMemory, activeSession?.memory || {})
        : mergeMemory(defaultTripSetupState, activeSession?.memory || {}),
    [activeSession?.memory, activeSession?.mode, appMemory]
  )

  const filteredSessions = useMemo(() => {
    const query = normalizeText(searchQuery)
    const matched = !query
      ? sessions
      : sessions.filter((session) => normalizeText(`${session.title} ${session.preview}`).includes(query))

    return [...matched].sort((left, right) => {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })
  }, [searchQuery, sessions])

  const quickActions = useMemo(
    () => buildQuickActions(activeSession?.mode === "connected" ? currentMemory : activeSession?.memory || defaultTripSetupState),
    [activeSession?.memory, activeSession?.mode, currentMemory]
  )
  const nearbyDayOptions = useMemo(() => getNearbyDayOptions(currentMemory), [currentMemory])
  const hasTripContext = !isContextEmpty(appMemory)
  const chatUsesTripContext = activeSession?.mode === "connected"
  const chatHasLinkedContext = chatUsesTripContext && !isContextEmpty(currentMemory)
  const focusedDestination = getFocusedDestination(currentMemory)
  const discoveryContext = useMemo(() => getDiscoveryContext(currentMemory), [currentMemory])
  const connectedTripName = getConnectedTripName(currentMemory, activeSession?.title)
  const showOnboarding = !activeSession?.messages.length
  const visibleQuickActions = quickActions.slice(0, 4)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [activeSession?.messages, isLoading])

  useEffect(() => {
    setNearbyPlannerDialog(null)
  }, [activeSessionId])

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl)
      }
    }
  }, [pendingAttachment])

  function clearPendingAttachment() {
    setPendingAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setPendingAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl)
      }
      return {
        id: createId(),
        name: file.name,
        type: file.type || "image/*",
        size: file.size,
        category: classifyAttachmentCategory(file),
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }
    })
  }

  useEffect(() => {
    if (!activeSession) return
    if (activeSession.mode !== "connected") return
    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSession.id
          ? { ...session, memory: mergeMemory(session.memory, appMemory) }
          : session
      )
    )
  }, [appMemory, activeSession?.id])

  useEffect(() => {
    if (!hydrated || !activeSession || isLoading) return
    const pendingPrompt = window.localStorage.getItem(PENDING_PROMPT_STORAGE_KEY)
    if (!pendingPrompt) return
    window.localStorage.removeItem(PENDING_PROMPT_STORAGE_KEY)
    sendMessage(pendingPrompt)
  }, [activeSession, hydrated, isLoading])

  function patchSession(sessionId: string, updater: (session: ChatSession) => ChatSession) {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(session) : session)))
  }

  function startNewChat(mode: ChatMode) {
    const next = createSession(mode, appMemory)
    setSessions((prev) => [next, ...prev])
    setActiveSessionId(next.id)
    setInput("")
    setSidebarOpen(false)
    setNewChatDialogOpen(false)
  }

  function createNewChat() {
    setNewChatDialogOpen(true)
  }

  function connectActiveChatToTrip() {
    if (!activeSession) return
    patchSession(activeSession.id, (session) => ({
      ...session,
      mode: "connected",
      memory: {
        ...mergeMemory(appMemory, session.memory || {}),
        focusDestinationId: getFocusedDestination(mergeMemory(appMemory, session.memory || {}))?.id,
      },
      updatedAt: new Date().toISOString(),
    }))
  }

  function disconnectActiveChatFromTrip() {
    if (!activeSession) return
    patchSession(activeSession.id, (session) => ({
      ...session,
      mode: "fresh",
      memory: { ...defaultTripSetupState },
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateActiveSessionMemory(updater: (memory: any) => any) {
    if (!activeSession) return
    patchSession(activeSession.id, (session) => ({
      ...session,
      memory: updater(session.memory || {}),
      updatedAt: new Date().toISOString(),
    }))
  }

  async function persistPlannerSelectionsAndOpenDestinations(rawPlaces: any[], sourceLabel: string) {
    const normalizedPlaces = normalizeChatbotPlaces(rawPlaces)
    if (!normalizedPlaces.length) {
      addAssistantNote(`Select at least one place before using ${sourceLabel}.`)
      return
    }

    try {
      const response = await fetch("/api/selection", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedPlaces: normalizedPlaces,
        }),
      })

      if (!response.ok) {
        const details = await response.text().catch(() => "")
        console.error("[ai-chat] Failed to persist planner selections", response.status, details)
        addAssistantNote("I couldn't carry those places into the destination planner just yet. Please try again.")
        return
      }
      await hydrateDestinationPageFromChatSelection().catch(() => null)

      setTripSetup((prev) => ({
        ...prev,
        selectedDestinations: normalizedPlaces,
      }))

      updateActiveSessionMemory((memory) => ({
        ...memory,
        selectedDestinations: dedupeSelectedDestinations([
          ...normalizedPlaces,
          ...((memory?.selectedDestinations || []).filter(
            (item: any) => !normalizedPlaces.some((candidate) => candidate.id === item?.id)
          ) || []),
        ]),
        focusDestinationId: normalizedPlaces[0]?.id || memory?.focusDestinationId,
      }))

      router.push("/destinations")
    } catch (error) {
      console.error("[ai-chat] Planner selection handoff failed", error)
      addAssistantNote("I couldn't open the destination planner with those places. Please try again.")
    }
  }

  function handleDestinationSelect(destination: any) {
    if (!activeSession) return
    const normalizedDestination = normalizePlaceSelection(destination)
    if (!normalizedDestination) {
      addAssistantNote("I couldn't map that place into a planner-friendly destination yet.")
      return
    }

    updateActiveSessionMemory((memory) => ({
      ...memory,
      selectedDestinations: dedupeSelectedDestinations([...(memory?.selectedDestinations || []), normalizedDestination]),
      destinationSuggestionSelectionIds: Array.from(
        new Set([
          ...(memory?.destinationSuggestionSelectionIds || []),
          destination?.id,
          normalizedDestination.id,
          normalizedDestination.sourceItemId,
        ].filter(Boolean))
      ),
      focusDestinationId: normalizedDestination.id,
    }))

    if (activeSession.mode === "connected") {
      addDestination(normalizedDestination)
    }

    const destinationLabel =
      normalizedDestination.originalName && normalizedDestination.originalName !== normalizedDestination.name
        ? `${normalizedDestination.originalName} will plan as ${normalizedDestination.name}`
        : normalizedDestination.name

    addAssistantNote(
      activeSession.mode === "connected"
        ? `${destinationLabel} is now added to this chat and your current trip context.`
        : `${destinationLabel} is selected in this chat. I can now compare it, estimate budget, or start a trip around it.`
    )
  }

  function handleDestinationSave(destination: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      savedDestinationIds: Array.from(new Set([...(memory?.savedDestinationIds || []), destination.id])),
    }))
    addAssistantNote(`${destination.name} is saved as a trip idea for later.`)
  }

  function handleDestinationCompare(destination: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      comparedDestinationIds: Array.from(new Set([...(memory?.comparedDestinationIds || []), destination.id])),
    }))
    addAssistantNote(`Added ${destination.name} to your comparison shortlist.`)
  }

  function handleFlightSelect(flight: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      selectedFlightId: flight.id,
    }))
    addAssistantNote(`${flight.airline} ${flight.route?.originCode} -> ${flight.route?.destinationCode} is selected. You can compare it or move straight to booking.`)
  }

  function handleFlightSave(flight: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      savedFlightIds: Array.from(new Set([...(memory?.savedFlightIds || []), flight.id])),
    }))
    addAssistantNote(`${flight.airline} is saved as a flight option for later.`)
  }

  function handleFlightCompare(flight: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      comparedFlightIds: Array.from(new Set([...(memory?.comparedFlightIds || []), flight.id])),
    }))
    addAssistantNote(`${flight.airline} is added to your flight comparison shortlist.`)
  }

  function handleFlightBooking(flight: any, payload: any) {
    if (typeof window === "undefined") return

    const departureDate = flight.departureDate || payload?.departureDate
    const bookingTripContext = {
      fromLocation: flight.route?.originCity || payload?.route?.origin,
      origin: flight.route?.originCity || payload?.route?.origin,
      startDate: departureDate,
      endDate: departureDate,
      dateRange: { from: departureDate, to: departureDate },
      travelers: currentMemory?.travelers || 1,
      travelersCount: currentMemory?.travelers || 1,
      budgetLevel: currentMemory?.budgetPreference === "luxury" ? "premium" : currentMemory?.budgetPreference === "budget" ? "low" : "medium",
      selectedPlaces: [
        {
          name: flight.route?.destinationCity || payload?.route?.destination,
          city: flight.route?.destinationCity || payload?.route?.destination,
          country: "",
          visitDate: departureDate,
        },
      ],
      destinations: [
        {
          name: flight.route?.destinationCity || payload?.route?.destination,
          city: flight.route?.destinationCity || payload?.route?.destination,
        },
      ],
    }

    const route = [flight.route?.originCity || payload?.route?.origin, flight.route?.destinationCity || payload?.route?.destination].filter(Boolean)
    const segmentKey = makeSegmentKey(
      flight.route?.originCity || payload?.route?.origin || "",
      flight.route?.destinationCity || payload?.route?.destination || ""
    )
    const bookingSelections = {
      selectedHotelsByCity: {},
      selectedFlightsBySegment: {
        [segmentKey]: {
          ...flight,
          from: flight.route?.originCity || payload?.route?.origin,
          to: flight.route?.destinationCity || payload?.route?.destination,
          departure: flight.departureTime || flight.departure,
          arrival: flight.arrivalTime || flight.arrival,
          class: flight.cabinClass || flight.class,
        },
      },
      skippedHotelsByCity: {},
      skippedFlightsBySegment: {},
    }

    window.localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify({ tripContext: bookingTripContext }))
    window.localStorage.setItem("WANDERLY_ORDERED_ROUTE", JSON.stringify(route))
    window.localStorage.setItem("WANDERLY_ROUTE_CONFIRMED", "true")
    window.localStorage.setItem("WANDERLY_BOOKING_SELECTIONS", JSON.stringify(bookingSelections))
    window.localStorage.setItem(
      BOOKING_HANDOFF_STORAGE_KEY,
      JSON.stringify({
        source: "ai-assistant",
        createdAt: new Date().toISOString(),
        activeTab: "flights",
        selectedDestination: flight.route?.destinationCity || payload?.route?.destination,
        flight,
        payload,
      })
    )

    updateActiveSessionMemory((memory) => ({
      ...memory,
      selectedFlightId: flight.id,
      bookingReadyFlightId: flight.id,
    }))

    router.push(`/booking?tab=flights&origin=${encodeURIComponent(flight.route?.originCity || payload?.route?.origin || "")}&destination=${encodeURIComponent(flight.route?.destinationCity || payload?.route?.destination || "")}&depart=${encodeURIComponent(departureDate || "")}`)
  }

  function handleHotelSelect(stay: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      stayPlanner: {
        ...(memory?.stayPlanner || {}),
        selectedStayId: stay.id,
        selectedStay: stay,
        destinationName: focusedDestination?.name || memory?.selectedDestinations?.[0]?.name || stay.sourceDestination || stay.location,
      },
    }))
    addAssistantNote(`${stay.name} is now your selected stay option. You can carry it into budget or booking next.`)
  }

  function handleHotelSave(stay: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      stayPlanner: {
        ...(memory?.stayPlanner || {}),
        savedStayIds: Array.from(new Set([...(memory?.stayPlanner?.savedStayIds || []), stay.id])),
      },
    }))
    addAssistantNote(`${stay.name} is saved to your stay shortlist.`)
  }

  function handleHotelCompare(stay: any) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      stayPlanner: {
        ...(memory?.stayPlanner || {}),
        comparedStayIds: Array.from(new Set([...(memory?.stayPlanner?.comparedStayIds || []), stay.id])),
      },
    }))
    addAssistantNote(`${stay.name} is added to your stay comparison set.`)
  }

  function openHotelDetails(stay: any) {
    const destinationName = focusedDestination?.name || currentMemory?.stayPlanner?.destinationName || currentMemory?.selectedDestinations?.[0]?.name || stay.sourceDestination || stay.location
    updateActiveSessionMemory((memory) => ({
      ...memory,
      stayPlanner: {
        ...(memory?.stayPlanner || {}),
        selectedStayId: stay.id,
        selectedStay: stay,
        destinationName,
      },
    }))
    router.push(`/booking?tab=hotels&destination=${encodeURIComponent(destinationName || "")}`)
  }

  function handleHotelBooking(stay: any) {
    if (typeof window === "undefined") return

    const destinationName = focusedDestination?.name || currentMemory?.stayPlanner?.destinationName || currentMemory?.selectedDestinations?.[0]?.name || stay.sourceDestination || stay.location || stay.name
    const normalizedDestination = normalizeCity(destinationName || "")
    const startDate = currentMemory?.dateRange?.from || ""
    const endDate = currentMemory?.dateRange?.to || startDate
    const bookingTripContext = {
      fromLocation: currentMemory?.startingLocation || "",
      origin: currentMemory?.startingLocation || "",
      startDate,
      endDate,
      dateRange: { from: startDate, to: endDate },
      travelers: currentMemory?.travelers || 1,
      travelersCount: currentMemory?.travelers || 1,
      budgetLevel: currentMemory?.budgetPreference === "luxury" ? "premium" : currentMemory?.budgetPreference === "budget" ? "low" : "medium",
      selectedPlaces: [
        {
          name: destinationName,
          city: destinationName,
          country: "",
          visitDate: startDate,
        },
      ],
      destinations: [
        {
          name: destinationName,
          city: destinationName,
        },
      ],
    }

    const selectedStay =
      stay.kind === "hotel"
        ? {
            ...stay,
            city: destinationName,
            destination: destinationName,
            price: stay.priceValue || 0,
            rating: Number(String(stay.ratingLabel || "").split("/")[0] || 0) || undefined,
            amenities: stay.tags || [],
          }
        : null

    window.localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify({ tripContext: bookingTripContext }))
    window.localStorage.setItem("WANDERLY_ORDERED_ROUTE", JSON.stringify([destinationName].filter(Boolean)))
    window.localStorage.setItem(
      "WANDERLY_BOOKING_SELECTIONS",
      JSON.stringify({
        selectedHotelsByCity: selectedStay && normalizedDestination ? { [normalizedDestination]: selectedStay } : {},
        selectedFlightsBySegment: {},
        skippedHotelsByCity: {},
        skippedFlightsBySegment: {},
      })
    )
    window.localStorage.setItem(
      BOOKING_HANDOFF_STORAGE_KEY,
      JSON.stringify({
        source: "ai-assistant",
        createdAt: new Date().toISOString(),
        activeTab: "hotels",
        selectedDestination: destinationName,
        hotel: selectedStay,
      })
    )

    updateActiveSessionMemory((memory) => ({
      ...memory,
      stayPlanner: {
        ...(memory?.stayPlanner || {}),
        selectedStayId: stay.id,
        selectedStay: stay,
        bookingReadyStayId: stay.id,
        destinationName,
      },
    }))

    router.push(`/booking?tab=hotels&destination=${encodeURIComponent(destinationName || "")}`)
  }

  function handleRecommendationFilter(chip: string) {
    sendMessage(`Show destination recommendations filtered by ${chip}`)
  }

  function openPlaceDetails(item: any, kind: "destination" | "nearby") {
    setPlaceDetail({
      item,
      kind,
      summary: kind === "nearby" ? buildNearbyPlaceInsight(item) : buildDestinationInsight(item),
      matchLine: kind === "nearby" ? item.whyAdd || "Easy add-on" : item.whyThisMatches || "Strong match",
    })
  }

  function setFocusDestination(destinationId?: string) {
    updateActiveSessionMemory((memory) => ({
      ...memory,
      focusDestinationId: destinationId,
    }))
  }

  function getLatestNearbyRecommendation() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.nearbyPlaceRecommendations?.cards?.length)?.artifacts?.nearbyPlaceRecommendations
  }

  function getLatestFlightSearch() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.flightSearchResults?.cards?.length)?.artifacts?.flightSearchResults
  }

  function getLatestHotelRecommendation() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.hotelRecommendations?.cards?.length)?.artifacts?.hotelRecommendations
  }

  function getLatestMapContext() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.mapContext)?.artifacts?.mapContext
  }

  function getLatestContextGuardrail() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.contextGuardrail)?.artifacts?.contextGuardrail
  }

  function getLatestMiniPlan() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.miniPlan)?.artifacts?.miniPlan
  }

  function getLatestSupportIssueSummary() {
    return [...(activeSession?.messages || [])]
      .reverse()
      .find((message) => message.artifacts?.supportIssueSummary)?.artifacts?.supportIssueSummary
  }

  function saveLatestMiniPlanToTrip() {
    const miniPlan = getLatestMiniPlan()
    const mainDestination = focusedDestination || currentMemory?.selectedDestinations?.[0]
    if (!miniPlan || !mainDestination) {
      addAssistantNote("I need an itinerary and destination in context before I can save it to your trip.")
      return
    }
    saveChatItinerary({
      miniPlan,
      mainDestination,
      memory: currentMemory,
      dayOptions:
        nearbyDayOptions?.length
          ? nearbyDayOptions
          : [{ key: "day-1", dayNumber: 1, label: "Day 1" }],
    })
    updateActiveSessionMemory((memory) =>
      mergeItineraryMemory(memory, {
        tripStage: "saved",
        latestItinerary: miniPlan,
      })
    )
    addAssistantNote(`Saved your latest ${mainDestination.name} itinerary to the trip plan. You can keep refining it or open the itinerary page next.`)
  }

  function openNearbySchedulePlanner(
    items: any[],
    options?: { autoArrange?: boolean; defaultOptional?: boolean; preferredDayKey?: string; prompt?: string }
  ) {
    const uniqueItems = Array.from(new Map((items || []).filter(Boolean).map((item) => [item.id, item])).values())
    if (!uniqueItems.length) return

    const latestNearbyRecommendation = getLatestNearbyRecommendation()
    const mainDestination =
      latestNearbyRecommendation?.mainDestination ||
      focusedDestination ||
      currentMemory?.selectedDestinations?.[0] ||
      null
    const prompt =
      options?.prompt ||
      (uniqueItems.length === 1
        ? `Add ${uniqueItems[0].name} to your itinerary`
        : `Place ${uniqueItems.length} selected stops into your itinerary`)

    setNearbyPlannerDialog({
      items: uniqueItems,
      mainDestination,
      dayOptions: nearbyDayOptions,
      drafts: buildNearbyPlannerDrafts(uniqueItems, nearbyDayOptions, options),
      prompt,
      autoArranged: Boolean(options?.autoArrange),
    })
  }

  function updateNearbyPlannerDraft(placeId: string, field: "dayKey" | "time" | "durationMinutes", value: string | number) {
    setNearbyPlannerDialog((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        drafts: prev.drafts.map((draft) => (draft.placeId === placeId ? { ...draft, [field]: value } : draft)),
      }
    })
  }

  function toggleNearbyPlannerOptional(placeId: string) {
    setNearbyPlannerDialog((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        drafts: prev.drafts.map((draft) => (draft.placeId === placeId ? { ...draft, isOptional: !draft.isOptional } : draft)),
      }
    })
  }

  function autoArrangeNearbyPlanner() {
    setNearbyPlannerDialog((prev) => {
      if (!prev) return prev
      const autoDrafts = buildNearbyAutoSchedule(prev.items, prev.dayOptions)
      return {
        ...prev,
        autoArranged: true,
        drafts: prev.items.map((item) => {
          const existing = prev.drafts.find((draft) => draft.placeId === item.id)
          const autoDraft = autoDrafts.find((draft) => draft.placeId === item.id)
          return {
            placeId: item.id,
            dayKey: autoDraft?.dayKey || existing?.dayKey || prev.dayOptions[0]?.key || "day-1",
            time: autoDraft?.time || existing?.time || "09:00",
            durationMinutes: autoDraft?.durationMinutes || existing?.durationMinutes || suggestNearbyDurationMinutes(item),
            isOptional: existing?.isOptional || false,
          }
        }),
      }
    })
  }

  function confirmNearbyPlanner(mode?: "optional") {
    if (!nearbyPlannerDialog) return

    const nextPlan = readTripPlan() || createAssistantTripPlanBase(currentMemory, nearbyPlannerDialog.mainDestination, nearbyPlannerDialog.dayOptions)
    const dayLookup = new Map(nearbyPlannerDialog.dayOptions.map((option) => [option.key, option]))
    const baseDays = createAssistantTripPlanBase(currentMemory, nearbyPlannerDialog.mainDestination, nearbyPlannerDialog.dayOptions).itinerary.days
    const draftLookup = new Map(
      nearbyPlannerDialog.drafts.map((draft) => [
        draft.placeId,
        {
          ...draft,
          isOptional: mode === "optional" ? true : draft.isOptional,
        },
      ])
    )

    const nextDays = baseDays.map((baseDay) => {
      const existingDay = nextPlan.itinerary.days.find((day) => day.dayNumber === baseDay.dayNumber)
      return existingDay
        ? {
            ...existingDay,
            date: existingDay.date || baseDay.date,
            city: existingDay.city || baseDay.city,
            activities: [...existingDay.activities],
          }
        : baseDay
    })

    for (const item of nearbyPlannerDialog.items) {
      const draft = draftLookup.get(item.id)
      if (!draft) continue
      const chosenDay = dayLookup.get(draft.dayKey) || nearbyPlannerDialog.dayOptions[0]
      if (!chosenDay) continue

      const targetIndex = nextDays.findIndex((day) => day.dayNumber === chosenDay.dayNumber)
      if (targetIndex === -1) continue

      const day = nextDays[targetIndex]
      const activityId = `ai-nearby-${item.id}-${chosenDay.dayNumber}`
      const activity = {
        id: activityId,
        type: "sightseeing" as const,
        title: draft.isOptional ? `Optional stop: ${item.name}` : `Visit ${item.name}`,
        time: draft.time,
        locationLabel: item.location || item.city || nearbyPlannerDialog.mainDestination?.name || day.city,
        cost: 0,
        currency: DEFAULT_CURRENCY,
        durationMinutes: draft.durationMinutes,
        isOptional: draft.isOptional,
        aiNotes: "Added from AI nearby recommendations",
        meta: {
          placeId: item.id,
          sourceDestinationId: nearbyPlannerDialog.mainDestination?.id,
          sourceDestinationName: nearbyPlannerDialog.mainDestination?.name,
          travelTime: item.travelTime,
          distanceKm: item.distanceKm,
          bestTime: getNearbyBestTimeLabel(item),
          addedFrom: "ai-nearby-recommendations",
        },
      }

      const existingIndex = day.activities.findIndex((existing) => existing.id === activityId)
      if (existingIndex >= 0) {
        day.activities[existingIndex] = activity
      } else {
        day.activities.push(activity)
        day.activities.sort((left, right) => {
          const leftMinutes = parsePlannerTimeToMinutes(left.time) ?? 0
          const rightMinutes = parsePlannerTimeToMinutes(right.time) ?? 0
          return leftMinutes - rightMinutes
        })
      }
    }

    const persistedPlan: TripPlan = {
      ...nextPlan,
      itinerary: { days: nextDays },
      updatedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }

    saveTripPlan(persistedPlan)

    const selectedPlaceIds = nearbyPlannerDialog.items.map((item) => item.id)
    updateActiveSessionMemory((memory) => ({
      ...memory,
      nearbyPlanner: {
        ...(memory?.nearbyPlanner || {}),
        mainDestinationId: nearbyPlannerDialog.mainDestination?.id || memory?.nearbyPlanner?.mainDestinationId,
        mainDestinationName: nearbyPlannerDialog.mainDestination?.name || memory?.nearbyPlanner?.mainDestinationName,
        selectedPlaceIds: Array.from(new Set([...(memory?.nearbyPlanner?.selectedPlaceIds || []), ...selectedPlaceIds])),
        scheduledPlaceIds: Array.from(
          new Set([
            ...(memory?.nearbyPlanner?.scheduledPlaceIds || []),
            ...nearbyPlannerDialog.drafts.filter((draft) => !(mode === "optional" || draft.isOptional)).map((draft) => draft.placeId),
          ])
        ),
        optionalPlaceIds: Array.from(
          new Set([
            ...(memory?.nearbyPlanner?.optionalPlaceIds || []),
            ...nearbyPlannerDialog.drafts.filter((draft) => mode === "optional" || draft.isOptional).map((draft) => draft.placeId),
          ])
        ),
        addedToItineraryAt: new Date().toISOString(),
        confirmationPending: false,
      },
    }))

    const confirmedSummary = nearbyPlannerDialog.items
      .map((item) => {
        const draft = draftLookup.get(item.id)
        const dayLabel = nearbyPlannerDialog.dayOptions.find((option) => option.key === draft?.dayKey)?.label || "Day 1"
        return `${item.name} on ${dayLabel} at ${formatPlannerTimeValue(draft?.time)}`
      })
      .join(", ")

    addAssistantNote(
      mode === "optional"
        ? `Saved ${nearbyPlannerDialog.items.length} nearby stop${nearbyPlannerDialog.items.length === 1 ? "" : "s"} as optional for later: ${confirmedSummary}.`
        : `Added ${nearbyPlannerDialog.items.length} nearby stop${nearbyPlannerDialog.items.length === 1 ? "" : "s"} to your itinerary: ${confirmedSummary}.`
    )
    setNearbyPlannerDialog(null)
  }

  function handleNearbyPlaceSelect(mainDestination: any, place: any) {
    updateActiveSessionMemory((memory) => {
      const existingIds = Array.isArray(memory?.nearbyPlanner?.selectedPlaceIds) ? memory.nearbyPlanner.selectedPlaceIds : []
      const nextSelected = existingIds.includes(place.id)
        ? existingIds.filter((id: string) => id !== place.id)
        : [...existingIds, place.id]
      return {
        ...memory,
        nearbyPlanner: {
          ...(memory?.nearbyPlanner || {}),
          mainDestinationId: mainDestination?.id || memory?.nearbyPlanner?.mainDestinationId,
          mainDestinationName: mainDestination?.name || memory?.nearbyPlanner?.mainDestinationName,
          shownPlaceIds: Array.from(new Set([...(memory?.nearbyPlanner?.shownPlaceIds || []), place.id])),
          selectedPlaceIds: nextSelected,
          confirmationPending: nextSelected.length > 0,
        },
      }
    })
  }

  function handleNearbyRecommendationFilter(chip: string) {
    const mainDestinationName = currentMemory?.nearbyPlanner?.mainDestinationName || currentMemory?.selectedDestinations?.[0]?.name
    if (!mainDestinationName) {
      sendMessage(`Show ${chip} nearby places`)
      return
    }

    if (chip === "Food") {
      sendMessage(`Best food spots near ${mainDestinationName}`)
      return
    }

    if (chip === "Shopping") {
      sendMessage(`Show shopping spots near ${mainDestinationName}`)
      return
    }

    if (chip === "Hidden gems") {
      sendMessage(`Show hidden gems near ${mainDestinationName}`)
      return
    }

    sendMessage(`Show attractions near ${mainDestinationName}`)
  }

  async function sendMessage(prompt?: string, options?: { memoryOverride?: any }) {
    if (!activeSession) return
    if (isLoading) return
    const requestMemory = options?.memoryOverride || currentMemory
    const typedContent = String(prompt ?? input).trim()
    const attachmentLabel =
      pendingAttachment?.category === "payment_screenshot"
        ? "payment screenshot"
        : pendingAttachment?.category === "itinerary_screenshot"
          ? "itinerary screenshot"
          : pendingAttachment?.category === "place_photo"
            ? "place photo"
            : pendingAttachment
              ? "image"
              : ""
    const content = typedContent || (pendingAttachment ? `Please review this ${attachmentLabel}.` : "")
    if (!content) return

    const userMessage: TravelMessage = {
      id: createId(),
      role: "user",
      content: pendingAttachment ? `${content}\n\nAttachment: ${pendingAttachment.name}` : content,
    }
    const nextMessages = [...activeSession.messages, userMessage]
    const optimisticTitle =
      !activeSession.titleLocked && isGenericTitle(activeSession.title) ? buildSmartTitle(content, requestMemory) : activeSession.title

    patchSession(activeSession.id, (session) => ({
      ...session,
      title: optimisticTitle,
      preview: content,
      updatedAt: new Date().toISOString(),
      memory: requestMemory,
      messages: nextMessages,
    }))

    setInput("")
    const attachmentForRequest = pendingAttachment
      ? {
          name: pendingAttachment.name,
          type: pendingAttachment.type,
          size: pendingAttachment.size,
          category: pendingAttachment.category,
        }
      : null
    clearPendingAttachment()
    setIsLoading(true)
    const requestId = ++requestSequenceRef.current
    activeRequestRef.current = requestId
    setLoadingLabel(
      /food|restaurant|eat|dining|dessert|cafe/i.test(content)
        ? "Finding better food areas..."
        : /budget/i.test(content)
          ? "Estimating your travel cost..."
          : /map|walking route|walk route|route|directions/i.test(content)
            ? "Building your map view..."
          : /hotel|stay|accommodation/i.test(content)
            ? "Looking at nearby stay options..."
            : /flight/i.test(content)
              ? "Checking flight options..."
              : /weather|best time/i.test(content)
                ? "Checking local travel conditions..."
                : /plan|itinerary|day/i.test(content)
                  ? "Building your trip suggestions..."
                  : /nearby attractions|nearby places|what else can i cover|after reaching/i.test(content)
                    ? "Curating nearby places..."
                  : /destination|suggest/i.test(content)
                    ? "Curating destination ideas..."
                    : "Thinking through your trip..."
    )

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          tripContext: requestMemory,
          appTripContext: appMemory,
          chatMode: activeSession.mode,
          attachment: attachmentForRequest,
        }),
      })

      const rawBody = await response.text()
      let data: any
      try {
        data = rawBody ? JSON.parse(rawBody) : {}
      } catch {
        console.error("AI chat returned non-JSON response", {
          status: response.status,
          body: rawBody,
        })
        throw new Error(rawBody || "Invalid assistant response")
      }
      if (!response.ok || data?.success === false) {
        console.error("AI chat request failed", {
          status: response.status,
          body: data,
        })
        throw new Error(data?.error || "Failed to get assistant response")
      }
      if (requestId !== activeRequestRef.current) return

      const assistantReply = typeof data?.reply === "string" && data.reply.trim()
        ? data.reply
        : "I hit a snag while preparing that travel answer. Please try again."

      const assistantMessage: TravelMessage = {
        id: createId(),
        role: "assistant",
        content: assistantReply,
        payload: data.payload,
        messageType: normalizeMessageType(data.type, data.responseType),
        responseType: data.responseType,
        artifacts: data.artifacts,
        followUpQuestions: data.followUpQuestions,
        suggestedActions: data.suggestedActions,
        actionCtas: data.actionCtas,
      }

      patchSession(activeSession.id, (session) => ({
        ...session,
        title: session.titleLocked ? session.title : data.conversationTitle || session.title || optimisticTitle,
        preview: assistantReply,
        updatedAt: new Date().toISOString(),
        memory:
          session.mode === "connected"
            ? mergeMemory(requestMemory, data.memory || {})
            : mergeMemory(requestMemory, data.memory || {}),
        messages: [...nextMessages, assistantMessage],
      }))

      setLoadingLabel(data.loadingLabel || loadingLabel)
    } catch (error: any) {
      if (requestId !== activeRequestRef.current) return
      console.error("AI chat sendMessage error", error)
      patchSession(activeSession.id, (session) => ({
        ...session,
        preview: error?.message || "Something went wrong",
        updatedAt: new Date().toISOString(),
        messages: [
          ...nextMessages,
          {
            id: createId(),
            role: "assistant",
            content: error?.message || "I hit a snag while planning your trip. Please try again.",
            actionCtas: ["Retry last request"],
          },
        ],
      }))
    } finally {
      if (requestId === activeRequestRef.current) {
        activeRequestRef.current = 0
        setIsLoading(false)
      }
    }
  }

  function startRename(session: ChatSession) {
    setRenameSessionId(session.id)
    setRenameValue(session.title)
  }

  function saveRename() {
    const title = renameValue.trim()
    if (!title || !renameSessionId) return
    patchSession(renameSessionId, (session) => ({
      ...session,
      title,
      titleLocked: true,
      updatedAt: new Date().toISOString(),
    }))
    setRenameSessionId("")
    setRenameValue("")
  }

  function togglePinSession(sessionId: string) {
    patchSession(sessionId, (session) => ({
      ...session,
      pinned: !session.pinned,
      updatedAt: new Date().toISOString(),
    }))
  }

  function duplicateSession(sessionId: string) {
    const source = sessions.find((session) => session.id === sessionId)
    if (!source) return

    const duplicate: ChatSession = {
      ...source,
      id: createId(),
      title: source.titleLocked ? `${source.title} copy` : source.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      messages: source.messages.map((message) => ({ ...message, id: createId() })),
    }

    setSessions((prev) => [duplicate, ...prev])
    setActiveSessionId(duplicate.id)
    setSidebarOpen(false)
  }

  function exportSession(session: ChatSession) {
    if (typeof window === "undefined") return

    const summary = [
      `Title: ${session.title}`,
      `Mode: ${getModeLabel(session.mode)}`,
      `Updated: ${new Date(session.updatedAt).toLocaleString()}`,
      session.memory?.startingLocation ? `Origin: ${session.memory.startingLocation}` : "",
      session.memory?.selectedDestinations?.length
        ? `Destinations: ${session.memory.selectedDestinations.map((item: any) => item.name).join(", ")}`
        : "",
      session.memory?.dateRange?.from && session.memory?.dateRange?.to
        ? `Dates: ${session.memory.dateRange.from} to ${session.memory.dateRange.to}`
        : "",
      session.memory?.budgetPreference ? `Budget: ${session.memory.budgetPreference}` : "",
      "",
      ...session.messages.map((message) => `${message.role === "user" ? "Traveler" : "Wanderly AI"}: ${message.content}`),
    ]
      .filter(Boolean)
      .join("\n")

    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${session.title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-") || "wanderly-trip"}.txt`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  function continueFromContext() {
    if (!activeSession || activeSession.mode !== "connected") {
      connectActiveChatToTrip()
    }
    const destinationNames = currentMemory.selectedDestinations?.map((item: any) => item.name).filter(Boolean) || []
    const prompt = focusedDestination?.name
      ? `Use my connected trip context and focus this chat on ${focusedDestination.name}`
      : destinationNames.length
      ? `Plan my trip from ${currentMemory.startingLocation || "my city"} to ${destinationNames.slice(0, 3).join(", ")}${destinationNames.length > 3 ? " and the rest of my connected trip" : ""}`
      : "Plan my trip using my selected Wanderly context"
    sendMessage(prompt)
  }

  function addAssistantNote(note: string) {
    if (!activeSession) return
    patchSession(activeSession.id, (session) => ({
      ...session,
      preview: note,
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, { id: createId(), role: "assistant", content: note }],
    }))
  }

  function handleAction(action: string) {
    if (!activeSession) return
    if (isLoading) return

    const normalized = normalizeText(action)
    const lastUserPrompt = [...activeSession.messages].reverse().find((message) => message.role === "user")?.content
    const recommendationSelectionIds = Array.isArray(currentMemory?.destinationSuggestionSelectionIds)
      ? currentMemory.destinationSuggestionSelectionIds.map((item: any) => String(item))
      : []
    const selectedRecommendationDestinations =
      recommendationSelectionIds.length > 0
        ? (currentMemory?.selectedDestinations || []).filter((item: any) =>
            recommendationSelectionIds.includes(String(item?.id)) ||
            recommendationSelectionIds.includes(String(item?.sourceItemId)) ||
            recommendationSelectionIds.includes(String(item?.destinationKey))
          )
        : currentMemory?.selectedDestinations || []
    const selectedNames = selectedRecommendationDestinations.map((item: any) => item.name).filter(Boolean)
    const nearbyRecommendation = getLatestNearbyRecommendation()
    const latestFlightSearch = getLatestFlightSearch()
    const latestHotelRecommendation = getLatestHotelRecommendation()
    const latestMapContext = getLatestMapContext()
    const latestContextGuardrail = getLatestContextGuardrail()
    const latestSupportIssueSummary = getLatestSupportIssueSummary()
    const nearbyPlanner = currentMemory?.nearbyPlanner || {}
    const stayPlanner = currentMemory?.stayPlanner || {}
    const nearbySelectedItems = (nearbyRecommendation?.cards || []).filter((item: any) => (nearbyPlanner?.selectedPlaceIds || []).includes(item.id))
    const selectedFlight = latestFlightSearch?.cards?.find((item: any) => item.id === currentMemory?.selectedFlightId) || latestFlightSearch?.cards?.[0]
    const selectedStay = latestHotelRecommendation?.cards?.find((item: any) => item.id === stayPlanner?.selectedStayId) || stayPlanner?.selectedStay || latestHotelRecommendation?.cards?.[0]
    const comparedStayItems = (latestHotelRecommendation?.cards || []).filter((item: any) => (stayPlanner?.comparedStayIds || []).includes(item.id))
    const destinationName =
      latestMapContext?.destinationName ||
      stayPlanner?.destinationName ||
      nearbyPlanner?.mainDestinationName ||
      focusedDestination?.name ||
      currentMemory?.selectedDestinations?.[0]?.name
    const buildItineraryMemoryOverride = (patch: any = {}) =>
      mergeItineraryMemory(currentMemory, {
        destinationId: focusedDestination?.id || currentMemory?.itineraryMemory?.destinationId,
        destinationName: destinationName || currentMemory?.itineraryMemory?.destinationName,
        tripStage: "refining",
        ...patch,
      })
    const sendItineraryRefinement = (promptText: string, patch: any = {}) => {
      const memoryOverride = buildItineraryMemoryOverride(patch)
      updateActiveSessionMemory(() => memoryOverride)
      sendMessage(promptText, { memoryOverride })
    }
    if (normalized === "connect this chat to my trip" || normalized === "use this answer in my current trip") {
      connectActiveChatToTrip()
      addAssistantNote("This chat is now connected to your current trip. I’ll use your active trip details in the next replies.")
      return
    }
    if (normalized === "disconnect from trip" || normalized === "continue as fresh chat" || normalized === "answer in fresh chat mode") {
      disconnectActiveChatFromTrip()
      addAssistantNote("This conversation is now a fresh travel chat. I won’t use your current trip unless you ask me to.")
      return
    }
    if (normalized === "save as separate trip idea") {
      startNewChat("fresh")
      if (lastUserPrompt) setInput(lastUserPrompt)
      return
    }
    if (normalized === "review trip context" || normalized === "show trip context") {
      const destinationSummary = (currentMemory?.selectedDestinations || []).map((item: any) => item.name).filter(Boolean).join(", ")
      const reviewPrompt =
        activeSession.mode === "connected" || destinationSummary
          ? `Summarize the destinations, dates, travelers, budget, and travel style you currently have in memory${destinationSummary ? ` for ${destinationSummary}` : ""}, then tell me what is missing and the best next step.`
          : "Summarize the travel context you currently have in memory and tell me what information is still missing."
      sendMessage(reviewPrompt)
      return
    }
    if (normalized.startsWith("switch this conversation to ")) {
      disconnectActiveChatFromTrip()
      addAssistantNote(`This conversation is now treated as a fresh chat focused on ${action.replace(/^Switch this conversation to\s+/i, "")}.`)
      return
    }
    if (normalized === "stay in current trip") {
      const placeName = focusedDestination?.name || currentMemory?.selectedDestinations?.[0]?.name
      sendMessage(placeName ? `Show popular nearby places around ${placeName}` : "Continue with my current trip")
      return
    }
    if (normalized === "retry last request") {
      if (lastUserPrompt) {
        sendMessage(lastUserPrompt)
      }
      return
    }
    if (normalized === "copy support summary" && latestSupportIssueSummary) {
      const payload = [
        latestSupportIssueSummary.title,
        latestSupportIssueSummary.summary,
        ...latestSupportIssueSummary.recommendedSteps.map((step: string, index: number) => `${index + 1}. ${step}`),
      ].join("\n")
      navigator.clipboard?.writeText(payload).catch(() => {})
      addAssistantNote("Copied the support summary so you can paste it into a ticket or chat with support.")
      return
    }
    if ((normalized === "open booking help" || normalized === "draft support ticket") && latestSupportIssueSummary) {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(SUPPORT_HANDOFF_STORAGE_KEY, JSON.stringify(latestSupportIssueSummary))
      }
      addAssistantNote("I saved the support handoff summary for you. Opening booking so you can continue from the product flow.")
      router.push("/booking")
      return
    }
    if (normalized === "start new trip") {
      disconnectActiveChatFromTrip()
      const placeName = latestContextGuardrail?.requestedDestination?.name
      setInput(placeName ? `Plan a new trip to ${placeName}` : lastUserPrompt || "")
      addAssistantNote(placeName ? `Ready to start a new trip for ${placeName}. Tell me dates, budget, or ask for nearby places.` : "This chat is now ready for a new trip.")
      return
    }
    if (normalized.endsWith("as new destination") && latestContextGuardrail?.requestedDestination) {
      const destination = latestContextGuardrail.requestedDestination
      updateActiveSessionMemory((memory) => ({
        ...memory,
        selectedDestinations: dedupeSelectedDestinations([...(memory?.selectedDestinations || []), destination]),
        focusDestinationId: destination.id,
      }))

      if (activeSession.mode === "connected") {
        addDestination(destination)
      }

      addAssistantNote(`${destination.name} is now added to your trip. I can show nearby places, build an itinerary, or estimate the budget next.`)
      return
    }
    if (normalized === "compare selected places" && nearbySelectedItems.length >= 2) {
      sendMessage(`Compare ${nearbySelectedItems.map((item: any) => item.name).join(" and ")} for family fit, travel time, and sightseeing value`)
      return
    }
    if (normalized === "compare selected places" && selectedNames.length >= 2) {
      sendMessage(`Compare ${selectedNames.join(" and ")} for budget, weather, and family fit`)
      return
    }
    if ((normalized === "add selected to itinerary" || normalized === "add all to trip") && nearbyRecommendation?.cards?.length) {
      const itemsToPlan =
        normalized === "add all to trip"
          ? nearbyRecommendation.cards
          : nearbySelectedItems.length
            ? nearbySelectedItems
            : nearbyRecommendation.cards.slice(0, 3)
      openNearbySchedulePlanner(itemsToPlan, {
        prompt:
          normalized === "add all to trip"
            ? "Add these nearby places to your itinerary"
            : "Add selected places to your itinerary",
      })
      return
    }
    if (normalized === "customize selection") {
      addAssistantNote("Tap Add to trip on any card you want to keep, and I’ll build the rest around your picks.")
      return
    }
    if (normalized === "view stays") {
      router.push(`/booking?tab=hotels&destination=${encodeURIComponent(destinationName || "")}`)
      return
    }
    if (normalized === "add stay to budget") {
      if (selectedStay) {
        handleHotelSelect(selectedStay)
      }
      router.push("/budget")
      return
    }
    if (normalized === "compare stays") {
      const stayNames =
        comparedStayItems.length >= 2
          ? comparedStayItems.slice(0, 3).map((item: any) => item.name).join(" and ")
          : (latestHotelRecommendation?.cards || []).slice(0, 2).map((item: any) => item.name).join(" and ")
      sendMessage(stayNames ? `Compare ${stayNames} for value, walking access, and overall trip fit` : action)
      return
    }
    if (normalized === "book stay") {
      if (selectedStay) {
        handleHotelBooking(selectedStay)
        return
      }
      router.push(`/booking?tab=hotels&destination=${encodeURIComponent(destinationName || "")}`)
      return
    }
    if ((normalized === "start plan with selected places" || normalized === "start trip with selected places") && selectedNames.length) {
      persistPlannerSelectionsAndOpenDestinations(selectedRecommendationDestinations, "Plan Trip")
      return
    }
    if ((normalized === "start plan with selected places" || normalized === "start trip with selected places") && !selectedNames.length) {
      addAssistantNote("Select at least one suggested place before starting the trip planner.")
      return
    }
    if (normalized === "plan trip with selected places") {
      const itemsToPlan = nearbySelectedItems.length ? nearbySelectedItems : []
      if (!itemsToPlan.length) {
        addAssistantNote("Select at least one nearby place before starting the trip planner.")
        return
      }
      persistPlannerSelectionsAndOpenDestinations(itemsToPlan, "Plan Trip")
      return
    }
    if (normalized === "find hotels for selected places" && selectedNames.length) {
      sendMessage(`Find family-friendly hotels for ${selectedNames.join(", ")}`)
      return
    }
    if (normalized === "suggest more nearby places" || normalized === "show more places") {
      const placeName = nearbyPlanner?.mainDestinationName || currentMemory?.selectedDestinations?.[0]?.name
      sendMessage(placeName ? `Show more nearby places around ${placeName}` : action)
      return
    }
    if (normalized === "arrange in best route" || normalized === "arrange selected in best route") {
      const itemsToArrange = nearbySelectedItems.length ? nearbySelectedItems : nearbyRecommendation?.cards?.slice(0, 3) || []
      if (itemsToArrange.length) {
        openNearbySchedulePlanner(itemsToArrange, {
          autoArrange: true,
          prompt: "Auto-arrange your nearby route",
        })
        return
      }
      const names = selectedNames.join(", ")
      sendMessage(names ? `Arrange ${names} in the best route` : action)
      return
    }
    if (normalized === "save as optional stops" && nearbyRecommendation?.cards?.length) {
      const itemsToPlan = nearbySelectedItems.length ? nearbySelectedItems : nearbyRecommendation.cards.slice(0, 3)
      openNearbySchedulePlanner(itemsToPlan, {
        defaultOptional: true,
        prompt: "Save these as optional stops",
      })
      return
    }
    if (normalized === "estimate added budget" && nearbySelectedItems.length) {
      sendMessage(`Estimate the added budget for ${nearbySelectedItems.map((item: any) => item.name).join(", ")}`)
      return
    }
    if (normalized === "build day plan" || normalized === "build itinerary" || normalized === "want a 1 day plan for these places") {
      const placeName = nearbyPlanner?.mainDestinationName || currentMemory?.selectedDestinations?.[0]?.name
      const pickedNames = nearbySelectedItems.map((item: any) => item.name).join(", ")
      sendMessage(
        pickedNames
          ? `Build a 1-day itinerary for ${pickedNames} around ${placeName || "this destination"}`
          : placeName
            ? `Build a 1-day itinerary around ${placeName}`
            : action
      )
      return
    }
    if (normalized === "need food spots nearby") {
      const placeName = nearbyPlanner?.mainDestinationName || currentMemory?.selectedDestinations?.[0]?.name
      sendMessage(placeName ? `Best food spots near ${placeName}` : "Best food spots nearby")
      return
    }
    if (normalized === "view on map" || normalized === "open map view") {
      sendMessage(destinationName ? `View ${destinationName} on map` : action)
      return
    }
    if (normalized === "nearby places") {
      sendMessage(destinationName ? `Best places near ${destinationName}` : action)
      return
    }
    if (normalized === "hotels on map") {
      sendMessage(destinationName ? `Show hotels on map near ${destinationName}` : action)
      return
    }
    if (normalized === "build walking plan") {
      sendMessage(destinationName ? `Build a walking plan around ${destinationName}` : action)
      return
    }
    if (normalized === "want budget estimate" || normalized === "want budget estimate?") {
      const pickedNames = nearbySelectedItems.map((item: any) => item.name).join(", ")
      if (pickedNames) {
        sendMessage(`Estimate the added budget for visiting ${pickedNames}`)
        return
      }
      if (chatUsesTripContext) {
        sendMessage(`Estimate budget for my connected trip${focusedDestination?.name ? ` around ${focusedDestination.name}` : ""}`)
        return
      }
    }
    if (chatUsesTripContext && normalized === "estimate budget") {
      sendMessage(`Estimate budget for my connected trip${focusedDestination?.name ? ` focused on ${focusedDestination.name}` : ""}`)
      return
    }
    if (chatUsesTripContext && normalized === "find hotels") {
      sendMessage(`Find hotels for my connected trip${focusedDestination?.name ? ` around ${focusedDestination.name}` : ""}`)
      return
    }
    if (chatUsesTripContext && normalized === "more budget options") {
      sendMessage(`Show more budget-friendly planning options for my connected trip${focusedDestination?.name ? ` around ${focusedDestination.name}` : ""}`)
      return
    }
    if (chatUsesTripContext && normalized === "more luxury options") {
      sendMessage(`Show more premium planning options for my connected trip${focusedDestination?.name ? ` around ${focusedDestination.name}` : ""}`)
      return
    }
    if (normalized === "compare options" && latestFlightSearch?.cards?.length) {
      const options = latestFlightSearch.cards.slice(0, 3).map((item: any) => `${item.airline} ${item.route?.originCode}-${item.route?.destinationCode}`).join(", ")
      sendMessage(`Compare these flight options for price, stops, and duration: ${options}`)
      return
    }
    if (normalized === "cheapest flights" && latestFlightSearch?.route) {
      sendMessage(`Show the cheapest flights for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination} on ${latestFlightSearch.departureDate}`)
      return
    }
    if (normalized === "fastest route" && latestFlightSearch?.route) {
      sendMessage(`Show the fastest flight options for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination} on ${latestFlightSearch.departureDate}`)
      return
    }
    if (normalized === "fewer stops" && latestFlightSearch?.route) {
      sendMessage(`Show flights with fewer stops for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination} on ${latestFlightSearch.departureDate}`)
      return
    }
    if (normalized === "round trip options" && latestFlightSearch?.route) {
      sendMessage(`Show round-trip flight options for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination}`)
      return
    }
    if (normalized === "morning departures" && latestFlightSearch?.route) {
      sendMessage(`Show morning departure flights for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination} on ${latestFlightSearch.departureDate}`)
      return
    }
    if (normalized === "nearby airports" && latestFlightSearch?.route) {
      sendMessage(`Check nearby airport alternatives for ${latestFlightSearch.route.origin} to ${latestFlightSearch.route.destination}`)
      return
    }
    if (normalized === "book ticket" && selectedFlight) {
      handleFlightBooking(selectedFlight, latestFlightSearch)
      return
    }
    if (normalized === "turn this into evening plan") {
      sendItineraryRefinement(
        destinationName ? `Turn this into an evening plan for ${destinationName}` : action,
        { timeWindow: "evening" }
      )
      return
    }
    if (normalized === "make it family friendly") {
      sendItineraryRefinement(
        destinationName ? `Make this itinerary more family-friendly for ${destinationName}` : action,
        { travelerType: "family", preferences: { familyFriendly: true } }
      )
      return
    }
    if (normalized === "add kid friendly stop") {
      sendItineraryRefinement(
        destinationName ? `Add a kid-friendly stop to this itinerary around ${destinationName}` : action,
        { travelerType: "family", preferences: { familyFriendly: true, kidFriendlyStop: true } }
      )
      return
    }
    if (normalized === "add snack stop") {
      sendItineraryRefinement(
        destinationName ? `Add a snack stop to this itinerary around ${destinationName}` : action,
        { preferences: { snackStop: true } }
      )
      return
    }
    if (normalized === "add lunch break") {
      sendItineraryRefinement(
        destinationName ? `Add a lunch break to this itinerary around ${destinationName}` : action,
        { preferences: { lunchStop: true } }
      )
      return
    }
    if (normalized === "add dinner stop") {
      sendItineraryRefinement(
        destinationName ? `Add a dinner stop to this itinerary around ${destinationName}` : action,
        { preferences: { dinnerStop: true } }
      )
      return
    }
    if (normalized === "make it more romantic" || normalized === "turn into evening date" || normalized === "make this romantic") {
      sendItineraryRefinement(
        destinationName ? `Make this itinerary more romantic around ${destinationName}` : action,
        { travelerType: "couple", timeWindow: "evening", preferences: { romantic: true, dinnerStop: true } }
      )
      return
    }
    if (normalized === "shorten to 2 hours") {
      sendItineraryRefinement(
        destinationName ? `Shorten this itinerary to a quick 2-hour plan around ${destinationName}` : action,
        { timeWindow: "quick" }
      )
      return
    }
    if (normalized === "reduce walking" || normalized === "lower walking effort" || normalized === "reduce walking more") {
      sendItineraryRefinement(
        destinationName ? `Reduce walking and make this itinerary easier around ${destinationName}` : action,
        { walkingTolerance: "low" }
      )
      return
    }
    if (normalized === "extend to half day" || normalized === "turn into half day plan" || normalized === "shorten to half day") {
      sendItineraryRefinement(
        destinationName ? `Turn this itinerary into a half-day plan for ${destinationName}` : action,
        { timeWindow: "half_day" }
      )
      return
    }
    if (normalized === "add indoor backup stop") {
      sendItineraryRefinement(
        destinationName ? `Add an indoor backup stop to this itinerary around ${destinationName}` : action,
        { preferences: { indoorBackup: true } }
      )
      return
    }
    if (normalized === "add lunch stop") {
      sendItineraryRefinement(
        destinationName ? `Add a lunch stop to this itinerary around ${destinationName}` : action,
        { preferences: { lunchStop: true } }
      )
      return
    }
    if (normalized === "add nearby museum") {
      sendItineraryRefinement(
        destinationName ? `Add a nearby museum stop to this itinerary around ${destinationName}` : action,
        { preferences: { nearbyMuseum: true } }
      )
      return
    }
    if (normalized === "add free stop" || normalized === "reduce cost further") {
      sendItineraryRefinement(
        destinationName ? `Make this itinerary more budget-friendly around ${destinationName}` : action,
        { preferences: { budgetFriendly: true } }
      )
      return
    }
    if (normalized === "add one iconic stop") {
      sendItineraryRefinement(
        destinationName ? `Add one iconic stop to this itinerary around ${destinationName}` : action,
        { preferences: { iconicStop: true } }
      )
      return
    }
    if (normalized === "save to trip") {
      saveLatestMiniPlanToTrip()
      return
    }
    sendMessage(action)
  }

  function deleteSession() {
    if (!deleteSessionId) return
    const remaining = sessions.filter((session) => session.id !== deleteSessionId)
    if (remaining.length === 0) {
      const next = createSession(isContextEmpty(appMemory) ? "fresh" : "connected", appMemory)
      setSessions([next])
      setActiveSessionId(next.id)
    } else {
      setSessions(remaining)
      if (activeSessionId === deleteSessionId) {
        setActiveSessionId(remaining[0].id)
      }
    }
    setDeleteSessionId("")
  }

  if (!hydrated || !activeSession) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#f5f7fb_100%)]">
        <Navigation />
        <main className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-5 xl:px-6 2xl:px-8">
          <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-10 shadow-[0_20px_60px_rgba(148,163,184,0.08)]">
            <p className="text-sm text-slate-500">Loading Wanderly AI Assistant...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.10),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(148,163,184,0.10),_transparent_28%),linear-gradient(180deg,#f8fbfd_0%,#f5f7fb_100%)]">
      <Navigation />

      <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[292px_minmax(0,1fr)]">
          <aside
            className={cn(
              "rounded-[26px] border border-slate-200/80 bg-white/86 p-4 shadow-[0_18px_45px_rgba(148,163,184,0.08)] backdrop-blur-xl lg:sticky lg:top-24 lg:block lg:h-[calc(100vh-6.75rem)]",
              "fixed inset-y-0 left-0 z-40 w-[292px] max-w-[85vw] transition-transform duration-300 lg:static lg:w-auto",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Chats</p>
                <button onClick={() => setSidebarOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Button onClick={createNewChat} className="mt-4 rounded-full bg-sky-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.18)] hover:bg-sky-700">
                <Sparkles className="mr-2 h-4 w-4" />
                New chat
              </Button>

              <div className="mt-4 rounded-full border border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Search className="h-4 w-4" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search chats"
                    className="w-full bg-transparent outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Recent chats</p>
                <div className="space-y-2">
                  {filteredSessions.map((session) => (
                    <SidebarChatItem
                      key={session.id}
                      session={session}
                      active={session.id === activeSessionId}
                      onSelect={() => {
                        setActiveSessionId(session.id)
                        setSidebarOpen(false)
                      }}
                      onPin={() => togglePinSession(session.id)}
                      onDuplicate={() => duplicateSession(session.id)}
                      onRename={() => startRename(session)}
                      onDelete={() => setDeleteSessionId(session.id)}
                    />
                  ))}
                  {filteredSessions.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                      No chats match your search.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="flex h-[calc(100vh-6.75rem)] min-h-[680px] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/78 shadow-[0_20px_60px_rgba(148,163,184,0.08)] backdrop-blur-xl">
              <div className="border-b border-slate-200/70 px-4 py-3 sm:px-6">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Button variant="outline" className="rounded-full border-slate-200 bg-white/90 lg:hidden" onClick={() => setSidebarOpen(true)}>
                      <Menu className="h-4 w-4" />
                    </Button>
                    {chatHasLinkedContext ? (
                      <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-sky-200 bg-sky-50/85 px-3 py-1.5 text-sm text-sky-900">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-sky-700" />
                        <span className="truncate">
                          Connected to {connectedTripName}
                          {focusedDestination?.name ? ` | ${focusedDestination.name}` : ""}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white/90 text-sm"
                      disabled={!chatUsesTripContext && !hasTripContext}
                      onClick={() => (chatUsesTripContext ? disconnectActiveChatFromTrip() : connectActiveChatToTrip())}
                    >
                      {chatUsesTripContext ? "Disconnect" : "Connect trip"}
                    </Button>
                    <button
                      onClick={() => exportSession(activeSession)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Export chat"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
                {chatHasLinkedContext ? (
                  <ConnectedTripOverview
                    memory={currentMemory}
                    tripName={connectedTripName}
                    onConnectToggle={disconnectActiveChatFromTrip}
                    onViewFullTrip={() => setDestinationsDialogOpen(true)}
                    onChangeTrip={() => router.push("/destinations")}
                  />
                ) : null}
                {showOnboarding ? (
                  <div className="flex min-h-full items-center justify-center py-10">
                    <div className="w-full max-w-2xl text-center">
                      {chatHasLinkedContext ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/85 px-3 py-1.5 text-sm text-sky-900">
                          <CheckCircle2 className="h-4 w-4 text-sky-700" />
                          {focusedDestination?.name ? `Ask about ${focusedDestination.name}` : `Ask about ${connectedTripName}`}
                        </div>
                      ) : null}
                      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        {chatHasLinkedContext ? "Your trip is ready for planning" : "How can Wanderly help?"}
                      </h2>
                      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                        {chatHasLinkedContext
                          ? "Ask about hotels, budgets, places, weather, or itinerary ideas without leaving the chat."
                          : "Plan destinations, estimate costs, find hotels, and build a better itinerary in one conversation."}
                      </p>
                      {chatHasLinkedContext && discoveryContext.activeFiltersCount > 0 ? (
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          {buildDiscoveryFilterChips(discoveryContext).map((chip) => (
                            <span key={chip} className="rounded-full border border-amber-100 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-900">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                        {visibleQuickActions.map((action) => (
                          <button
                            key={action}
                            onClick={() => (normalizeText(action) === "review trip context" ? handleAction(action) : setInput(action))}
                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                      {hasTripContext && !chatUsesTripContext ? (
                        <button
                          onClick={connectActiveChatToTrip}
                          className="mt-6 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-100"
                        >
                          Use planned trip context
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {activeSession.messages.map((message) => (
                      <div key={message.id} className="space-y-3">
                        {(() => {
                          const responseActions = dedupeActionLabels(message.actionCtas || [], 4)
                          const followUpActions = dedupeActionLabels(
                            (message.suggestedActions || []).filter((action) => !responseActions.some((existing) => slugifyActionLabel(existing) === slugifyActionLabel(action))),
                            2
                          )
                          const inlinePlannerOwnsActions = Boolean(message.artifacts?.nearbyPlaceRecommendations?.cards?.length)
                          const hasStructuredArtifacts =
                            message.role === "assistant" &&
                            Boolean(
                              message.artifacts?.contextGuardrail ||
                              message.artifacts?.hotelRecommendations?.cards?.length ||
                              message.artifacts?.mapContext ||
                              message.artifacts?.nearbyPlaceRecommendations?.cards?.length ||
                              message.artifacts?.flightSearchResults?.cards?.length ||
                              message.artifacts?.destinationRecommendations?.cards?.length ||
                              message.artifacts?.selectionSummary ||
                              message.artifacts?.supportIssueSummary ||
                              message.artifacts?.budget ||
                              message.artifacts?.miniPlan ||
                              message.artifacts?.weather ||
                              message.artifacts?.foodGuide
                            )

                          return (
                            <>
                              <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                                <div
                                  className={cn(
                                    message.role === "assistant" && hasStructuredArtifacts
                                      ? "max-w-[44rem] rounded-[22px] px-4 py-3 text-[15px] leading-6 shadow-sm sm:px-5"
                                      : "max-w-[82%] rounded-[22px] px-4 py-3 text-[15px] leading-7 shadow-sm sm:px-5",
                                    message.role === "user"
                                      ? "bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_100%)] text-slate-900 shadow-[0_12px_24px_rgba(59,130,246,0.10)]"
                                      : "border border-slate-200/80 bg-white text-slate-700 shadow-[0_12px_24px_rgba(148,163,184,0.08)]"
                                  )}
                                >
                                  <MessageContent content={message.content} />
                                </div>
                              </div>

                              {message.artifacts?.distanceKm ? (
                                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                                  <Route className="h-4 w-4" />
                                  Total travel distance: ~{message.artifacts.distanceKm} km
                                </div>
                              ) : null}

                              {message.artifacts?.contextGuardrail ? (
                                <div className="mt-4">
                                  <ContextGuardrailCard
                                    guardrail={message.artifacts.contextGuardrail}
                                    onAction={handleAction}
                                  />
                                </div>
                              ) : null}

                              {message.artifacts?.selectionSummary ? (
                                <div className="mt-4">
                                  <SelectionSummaryCard summary={message.artifacts.selectionSummary} />
                                </div>
                              ) : null}

                              {message.artifacts?.supportIssueSummary ? (
                                <div className="mt-4">
                                  <SupportIssueSummaryCard summary={message.artifacts.supportIssueSummary} />
                                </div>
                              ) : null}

                              {message.artifacts?.hotelRecommendations?.cards?.length ? (
                                <div className="mt-4">
                                  <HotelRecommendationsCard
                                    payload={message.artifacts.hotelRecommendations}
                                    selectedId={currentMemory?.stayPlanner?.selectedStayId}
                                    savedIds={currentMemory?.stayPlanner?.savedStayIds || []}
                                    comparedIds={currentMemory?.stayPlanner?.comparedStayIds || []}
                                    onSelect={handleHotelSelect}
                                    onSave={handleHotelSave}
                                    onCompare={handleHotelCompare}
                                    onViewDetails={openHotelDetails}
                                    onBook={handleHotelBooking}
                                    onAsk={handleAction}
                                    onAction={handleAction}
                                  />
                                </div>
                              ) : null}

                              {message.artifacts?.mapContext ? (
                                <div className="mt-4">
                                  <MapContextCard
                                    payload={message.artifacts.mapContext}
                                    onAction={handleAction}
                                  />
                                </div>
                              ) : null}

                              {message.artifacts?.nearbyPlaceRecommendations?.cards?.length ? (
                                <div className="mt-4">
                                  <NearbyPlacePlannerCard
                                    recommendation={message.artifacts.nearbyPlaceRecommendations}
                                    selectedIds={currentMemory?.nearbyPlanner?.selectedPlaceIds || []}
                                    scheduledIds={currentMemory?.nearbyPlanner?.scheduledPlaceIds || []}
                                    optionalIds={currentMemory?.nearbyPlanner?.optionalPlaceIds || []}
                                    dayOptions={nearbyDayOptions}
                                    onSelect={handleNearbyPlaceSelect}
                                    onViewDetails={openPlaceDetails}
                                    onAsk={handleAction}
                                    onFilter={handleNearbyRecommendationFilter}
                                    onPrimaryAction={handleAction}
                                    onOpenScheduler={openNearbySchedulePlanner}
                                  />
                                </div>
                              ) : null}
                              {message.artifacts?.nearbyPlaces?.length && !message.artifacts?.nearbyPlaceRecommendations?.cards?.length ? (
                                <div className="mt-4">
                                  <NearbyPlacesCard
                                    placeName={message.artifacts?.weather?.place || currentMemory?.selectedDestinations?.[0]?.name}
                                    items={message.artifacts.nearbyPlaces}
                                  />
                                </div>
                              ) : null}
                              {message.artifacts?.foodGuide ? <div className="mt-4"><FoodGuideCard guide={message.artifacts.foodGuide} /></div> : null}
                              {message.artifacts?.localTips?.length ? <div className="mt-4"><LocalTipsCard tips={message.artifacts.localTips} /></div> : null}
                              {message.artifacts?.miniPlan && normalizeMessageType(message.messageType, message.responseType) === "itinerary" && !message.artifacts?.nearbyPlaceRecommendations?.cards?.length ? <div className="mt-4"><MiniPlanCard plan={message.artifacts.miniPlan} /></div> : null}
                              {message.artifacts?.weather ? <div className="mt-4"><WeatherCard weather={message.artifacts.weather} /></div> : null}
                              {message.artifacts?.budget ? <div className="mt-4"><BudgetCard budget={message.artifacts.budget} /></div> : null}
                              {message.artifacts?.flightSearchResults?.cards?.length ? (
                                <div className="mt-4">
                                  <FlightSearchResults
                                    payload={message.artifacts.flightSearchResults}
                                    selectedId={currentMemory?.selectedFlightId}
                                    savedIds={currentMemory?.savedFlightIds || []}
                                    comparedIds={currentMemory?.comparedFlightIds || []}
                                    onSelect={handleFlightSelect}
                                    onSave={handleFlightSave}
                                    onCompare={handleFlightCompare}
                                    onBook={handleFlightBooking}
                                    onAsk={handleAction}
                                    onAction={handleAction}
                                  />
                                </div>
                              ) : null}
                              {normalizeMessageType(message.messageType, message.responseType) === "recommendations" && (message.artifacts?.destinationRecommendations?.cards?.length || message.artifacts?.destinations?.length || (message.payload?.type === "recommendations" && message.payload.places.length > 0)) ? (
                                <div className="mt-4">
                                  {(() => {
                                    const payloadCards = buildRecommendationCardsFromPayload(message.payload)
                                    const recommendationCards =
                                      message.artifacts?.destinationRecommendations?.cards ||
                                      message.artifacts?.destinations ||
                                      payloadCards

                                    return (
                                  <DestinationSuggestions
                                    recommendation={
                                      message.artifacts?.destinationRecommendations || {
                                        cards: recommendationCards,
                                      }
                                    }
                                    mode={activeSession.mode}
                                    selectedIds={Array.from(
                                      new Set([
                                        ...(currentMemory?.destinationSuggestionSelectionIds || []),
                                        ...getPlannerSelectionIds(currentMemory?.selectedDestinations || []),
                                      ])
                                    )}
                                    savedIds={currentMemory?.savedDestinationIds || []}
                                    comparedIds={currentMemory?.comparedDestinationIds || []}
                                    onSelect={handleDestinationSelect}
                                    onSave={handleDestinationSave}
                                    onCompare={handleDestinationCompare}
                                    onViewDetails={openPlaceDetails}
                                    onAsk={handleAction}
                                    onFilter={handleRecommendationFilter}
                                    onPrimaryAction={handleAction}
                                  />
                                    )
                                  })()}
                                </div>
                              ) : null}
                              {message.artifacts?.hotels?.length && !message.artifacts?.hotelRecommendations?.cards?.length ? <div className="mt-4"><TravelOptions title="Best hotel matches" items={message.artifacts.hotels} type="hotel" /></div> : null}
                              {message.artifacts?.flights?.length ? <div className="mt-4"><TravelOptions title="Flight options" items={message.artifacts.flights} type="flight" /></div> : null}

                              {responseActions.length && !inlinePlannerOwnsActions ? <ResponseActions actions={responseActions} onAction={handleAction} /> : null}

                              {followUpActions.length && !responseActions.length && !inlinePlannerOwnsActions ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {followUpActions.map((action) => (
                                    <button
                                      key={action}
                                      onClick={() => handleAction(action)}
                                      disabled={isLoading}
                                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {action}
                                    </button>
                                  ))}
                                </div>
                              ) : null}

                              {message.followUpQuestions?.length && !responseActions.length && !followUpActions.length && !inlinePlannerOwnsActions ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {message.followUpQuestions.slice(0, 2).map((question) => (
                                    <button key={question} onClick={() => setInput(question)} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                                      {question}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    ))}

                    {isLoading ? (
                      <div className="flex justify-start">
                        <div className="w-full max-w-[760px] rounded-[22px] border border-slate-200/80 bg-white px-4 py-3 shadow-[0_12px_24px_rgba(148,163,184,0.08)] sm:px-5">
                          <p className="text-sm font-medium text-slate-700">{loadingLabel}</p>
                          <div className="mt-2 flex items-center gap-1">
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.24s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.12s]" />
                            <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                          </div>
                          {/destination|suggest|nearby|stay|hotel|map/i.test(loadingLabel) ? (
                            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              <RecommendationCardSkeleton />
                              <RecommendationCardSkeleton />
                              <RecommendationCardSkeleton />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                </div>
              </div>

              <div className="border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.70)_0%,rgba(255,255,255,0.95)_100%)] px-3 py-3 backdrop-blur-xl sm:px-6">
                <div className="mx-auto w-full max-w-5xl">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {visibleQuickActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleAction(action)}
                        disabled={isLoading}
                        className="rounded-full border border-slate-200 bg-white/95 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:bg-sky-50/70 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {action}
                      </button>
                    ))}
                  </div>

                  {pendingAttachment ? (
                    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[22px] border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_10px_22px_rgba(148,163,184,0.08)]">
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
                        {pendingAttachment.category.replace(/_/g, " ")}
                      </span>
                      <span className="truncate text-sm font-medium text-slate-700">{pendingAttachment.name}</span>
                      <span className="text-xs text-slate-500">{Math.max(1, Math.round(pendingAttachment.size / 1024))} KB</span>
                      <button
                        onClick={clearPendingAttachment}
                        className="ml-auto rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2 rounded-[28px] border border-slate-200/80 bg-white px-3 py-2 shadow-[0_14px_32px_rgba(148,163,184,0.08)]">
                    <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100">
                      <Mic className="h-5 w-5" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAttachmentChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
                      aria-label="Attach screenshot"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <textarea
                      rows={1}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault()
                          sendMessage()
                        }
                      }}
                      placeholder={
                        chatUsesTripContext
                          ? focusedDestination?.name
                            ? `Ask about ${focusedDestination.name}...`
                            : `Ask about your ${connectedTripName}...`
                          : "Ask about your trip..."
                      }
                      className="min-h-[56px] flex-1 resize-none bg-transparent px-2 py-3 text-[15px] leading-7 text-slate-800 outline-none placeholder:text-slate-400"
                    />
                    <button
                      onClick={() => sendMessage()}
                      disabled={isLoading || (!input.trim() && !pendingAttachment)}
                      className="mb-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      <ArrowUp className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <NearbyItineraryPlannerDialog
        state={nearbyPlannerDialog}
        onClose={() => setNearbyPlannerDialog(null)}
        onDraftChange={updateNearbyPlannerDraft}
        onToggleOptional={toggleNearbyPlannerOptional}
        onAutoArrange={autoArrangeNearbyPlanner}
        onConfirm={confirmNearbyPlanner}
      />

      <Dialog open={Boolean(renameSessionId)} onOpenChange={(open) => !open && setRenameSessionId("")}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Rename chat</DialogTitle>
            <DialogDescription>Choose a clearer name for this travel conversation.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            className="h-11 rounded-2xl border border-slate-200 px-4 outline-none focus:border-sky-400"
            placeholder="Kerala budget trip"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-full bg-transparent" onClick={() => setRenameSessionId("")}>
              Cancel
            </Button>
            <Button className="rounded-full bg-sky-600 hover:bg-sky-700" onClick={saveRename}>
              Save name
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newChatDialogOpen} onOpenChange={setNewChatDialogOpen}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Start a new travel chat</DialogTitle>
            <DialogDescription>Choose how you want this new conversation to handle trip context.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              onClick={() => startNewChat("connected")}
              className="rounded-[22px] border border-slate-200 bg-[linear-gradient(135deg,#f8fcff_0%,#eef7ff_100%)] p-5 text-left transition hover:border-sky-200 hover:bg-sky-50/80"
            >
              <p className="text-base font-semibold text-slate-950">Continue with planned trip</p>
              <p className="mt-2 text-sm text-slate-600">Use your selected destinations, dates, budget, and travel details.</p>
            </button>
            <button
              onClick={() => startNewChat("fresh")}
              className="rounded-[22px] border border-slate-200 bg-white p-5 text-left transition hover:border-slate-300 hover:bg-slate-50/80"
            >
              <p className="text-base font-semibold text-slate-950">Fresh chat</p>
              <p className="mt-2 text-sm text-slate-600">Ask about any destination without linking it to your current plan.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <PlaceDetailsDialog
        open={Boolean(placeDetail)}
        onOpenChange={(open) => !open && setPlaceDetail(null)}
        detail={placeDetail}
      />

      <Dialog open={destinationsDialogOpen} onOpenChange={setDestinationsDialogOpen}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Connected trip details</DialogTitle>
            <DialogDescription>
              Review the trip linked to this chat, adjust focus, or open the full planning flow.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trip</p>
              <p className="mt-2 font-semibold text-slate-950">{connectedTripName}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Dates</p>
              <p className="mt-2 font-semibold text-slate-950">{formatConnectedDateRange(currentMemory?.dateRange)}</p>
              <p className="mt-1 text-sm text-slate-500">{getTripLengthLabel(currentMemory?.dateRange)}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Budget</p>
              <p className="mt-2 font-semibold text-slate-950">{currentMemory?.budgetPreference || "Not set"}</p>
              <p className="mt-1 text-sm text-slate-500">{currentMemory?.travelStyle || "Style not set"}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Trip setup</p>
              <p className="mt-2 font-semibold text-slate-950">{currentMemory?.startingLocation || "Origin not set"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {dedupeMemoryDestinations(currentMemory?.selectedDestinations || []).length} destination{dedupeMemoryDestinations(currentMemory?.selectedDestinations || []).length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-sky-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-950">Focus this chat</p>
                <p className="mt-1 text-sm text-slate-600">
                  {focusedDestination?.name ? `Currently using ${focusedDestination.name} for more specific answers.` : "Currently using the full trip context."}
                </p>
              </div>
              <span className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-900">
                {focusedDestination?.name ? `Focused on ${focusedDestination.name}` : "Full trip context"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setFocusDestination(undefined)
                setDestinationsDialogOpen(false)
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                !currentMemory?.focusDestinationId ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              Use full trip context
            </button>
            {dedupeMemoryDestinations(currentMemory?.selectedDestinations || []).map((destination: any) => (
              <button
                key={destination.id}
                onClick={() => {
                  setFocusDestination(destination.id)
                  setDestinationsDialogOpen(false)
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  currentMemory?.focusDestinationId === destination.id
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                )}
              >
                {destination.name}
              </button>
            ))}
          </div>
          <div className="max-h-[360px] overflow-y-auto rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {dedupeMemoryDestinations(currentMemory?.selectedDestinations || []).map((destination: any) => (
                <div key={destination.id} className="rounded-2xl border border-white/80 bg-white px-4 py-3">
                  <p className="font-semibold text-slate-950">{destination.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{formatLocationLabel(destination) || "Destination details"}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full bg-transparent"
              onClick={() => {
                setDestinationsDialogOpen(false)
                router.push("/destinations")
              }}
            >
              Change trip
            </Button>
            <Button
              className="rounded-full bg-sky-600 hover:bg-sky-700"
              onClick={() => {
                setDestinationsDialogOpen(false)
                router.push("/itinerary")
              }}
            >
              Open itinerary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteSessionId)} onOpenChange={(open) => !open && setDeleteSessionId("")}>
        <DialogContent className="rounded-[28px] border-slate-200 bg-white">
          <DialogHeader>
            <DialogTitle>Delete chat?</DialogTitle>
            <DialogDescription>Are you sure you want to delete this chat? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full bg-transparent" onClick={() => setDeleteSessionId("")}>
              Cancel
            </Button>
            <Button className="rounded-full bg-red-600 hover:bg-red-700" onClick={deleteSession}>
              Delete chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {sidebarOpen ? <button className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close chat sidebar" /> : null}

    </div>
  )
}
