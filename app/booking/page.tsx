"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Hotel,
  Plane,
  Star,
  MapPin,
  Wifi,
  Car,
  Utensils,
  Dumbbell,
  Clock,
  ArrowRight,
  Filter,
  Heart,
  ExternalLink,
  AlertCircle,
  CreditCard,
  Calendar,
  User,
  Mail,
  Phone,
  CheckCircle,
  X,
  Smartphone,
  QrCode,
  Banknote,
  Wallet,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { hotels as allHotels, flights as allFlights } from "@/lib/data"
import { cn, calculateHaversineDistance } from "@/lib/utils"
import Link from "next/link"
import { differenceInCalendarDays } from "date-fns"
import { TravelOrderBuilder } from "@/components/booking/TravelOrderBuilder"
import { TravelFlowMap } from "@/components/booking/TravelFlowMap"
import { DestinationSelector } from "@/components/booking/DestinationSelector"
import { useHotelsSearch } from "@/hooks/use-hotels-search"
import { useFlights } from "@/hooks/use-flights"
import { buildTripPlan, makeSegmentKey, normalizeCity, saveTripPlan } from "@/lib/trip-plan"

const BOOKING_HANDOFF_STORAGE_KEY = "WANDERLY_AI_BOOKING_HANDOFF_V1"

type RoutePlace = {
  name: string
  city: string
  country?: string
  lat?: number
  lng?: number
  latitude?: number
  longitude?: number
  visitDate?: string
}

function normalizePlaceKey(name?: string, city?: string, country?: string) {
  return `${String(name || "").trim().toLowerCase()}|${String(city || "").trim().toLowerCase()}|${String(country || "").trim().toLowerCase()}`
}

function deriveDestinationsFromPlaces(places: RoutePlace[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const place of places) {
    const city = String(place?.city || "").trim()
    if (!city) continue
    const key = city.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(city)
  }
  return result
}

function buildBookingTripId(ctx: any): string {
  const from = String(ctx?.fromLocation || ctx?.origin || "").trim().toLowerCase()
  const start = String(ctx?.startDate || ctx?.dateRange?.from || "").trim()
  const end = String(ctx?.endDate || ctx?.dateRange?.to || "").trim()
  const places: RoutePlace[] = Array.isArray(ctx?.selectedPlaces) ? ctx.selectedPlaces : []
  const placeKeys = places.map((p) => normalizePlaceKey(p?.name, p?.city, p?.country)).join("||")
  return `${from}__${start}__${end}__${placeKeys}`
}

function isValidStoredRoute(stored: unknown, origin: string, destinations: string[]) {
  if (!Array.isArray(stored) || stored.length === 0) return false
  const route = stored.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
  if (route.length === 0) return false
  if (origin && route[0] !== origin) return false
  const target = destinations.join("|")
  const given = route.slice(1).join("|")
  return target === given
}

function formatShortDate(value?: string) {
  if (!value) return "Dates pending"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Dates pending"
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatDateRangeLabel(start?: string, end?: string) {
  if (!start || !end) return "Dates pending"
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Dates pending"
  const sameYear = startDate.getFullYear() === endDate.getFullYear()
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })
  const endLabel = endDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  return `${startLabel} - ${endLabel}`
}

function getDurationLabel(start?: string, end?: string) {
  if (!start || !end) return "Dates pending"
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Dates pending"
  const days = Math.max(1, differenceInCalendarDays(endDate, startDate))
  return `${days} day${days === 1 ? "" : "s"}`
}

function titleCase(value?: string) {
  if (!value) return "Not set"
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function getBudgetModeLabel(value?: string) {
  if (!value) return "Flexible budget"
  if (value === "low" || value === "budget") return "Budget"
  if (value === "medium" || value === "mid-range") return "Mid-range"
  if (value === "premium" || value === "luxury") return "Premium"
  return titleCase(value)
}

function getTripModeLabel(context: any) {
  const preferences = Array.isArray(context?.preferences) ? context.preferences.map((value: string) => String(value).toLowerCase()) : []
  if (preferences.includes("family")) return "Family trip"
  if (preferences.includes("couple")) return "Couple trip"
  if (preferences.includes("solo")) return "Solo trip"

  const travelers = Number(context?.travelersCount || context?.travelers || 1)
  if (travelers <= 1) return "Solo trip"
  if (travelers === 2) return "Couple trip"
  if (travelers >= 4) return "Group trip"
  return `${travelers} travelers`
}

function getFlightStopsLabel(flight: any) {
  const stops = typeof flight?.stops === "number" ? flight.stops : 0
  if (stops <= 0) return "Nonstop"
  return `${stops} stop${stops === 1 ? "" : "s"}`
}

function parseDurationMinutesLabel(duration?: string) {
  if (!duration) return Number.MAX_SAFE_INTEGER
  const hours = Number(duration.match(/(\d+)h/i)?.[1] || 0)
  const minutes = Number(duration.match(/(\d+)m/i)?.[1] || 0)
  return hours * 60 + minutes
}

function getHotelBadge(hotel: any, index: number) {
  const amenities = new Set((hotel?.amenities || []).map((item: string) => item.toLowerCase()))
  const rating = Number(hotel?.rating || 0)
  if (index === 0) return "Best value"
  if (rating >= 4.7) return "Top rated"
  if (amenities.has("pool") || amenities.has("spa")) return "Luxury pick"
  if (amenities.has("central location")) return "Near city center"
  return "Recommended stay"
}

function getHotelInsight(hotel: any, destination: string, budgetMode: string) {
  const amenities = new Set((hotel?.amenities || []).map((item: string) => item.toLowerCase()))
  if (amenities.has("pool") || amenities.has("spa")) {
    return `Great comfort option in ${destination} with amenities that fit a ${budgetMode.toLowerCase()} trip.`
  }
  if ((hotel?.rating || 0) >= 4.7) {
    return `Strong guest reviews make this one of the most trusted stays for ${destination}.`
  }
  if ((hotel?.distanceKm || 0) > 0) {
    return `Convenient for this stop with about ${hotel.distanceKm} km to the main areas you will be visiting.`
  }
  return `A balanced stay pick for ${destination} with the right mix of location, comfort, and nightly value.`
}

function getHotelPolicyTags(hotel: any) {
  const amenities = new Set((hotel?.amenities || []).map((item: string) => item.toLowerCase()))
  const tags: string[] = []
  if (amenities.has("restaurant") || amenities.has("breakfast")) tags.push("Breakfast friendly")
  if (amenities.has("wifi")) tags.push("Wifi included")
  if (amenities.has("pool")) tags.push("Pool access")
  if (amenities.has("gym") || amenities.has("spa")) tags.push("Wellness option")
  if (tags.length === 0) tags.push("Flexible stay")
  if (tags.length === 1) tags.push("Easy booking")
  return tags.slice(0, 2)
}

function getFlightBadge(flight: any, flights: any[], index: number) {
  const cheapest = Math.min(...flights.map((item) => Number(item?.price || Number.MAX_SAFE_INTEGER)))
  const fastest = Math.min(...flights.map((item) => Number(item?.durationMinutes || parseDurationMinutesLabel(item?.duration))))
  const stops = typeof flight?.stops === "number" ? flight.stops : 0
  const durationMinutes = Number(flight?.durationMinutes || parseDurationMinutesLabel(flight?.duration))

  if (Number(flight?.price || 0) === cheapest) return "Lowest fare"
  if (durationMinutes === fastest) return "Fastest"
  if (stops === 0) return "Fewest stops"
  if (index === 0) return "Best overall"
  return "Good timing"
}

function getFlightInsight(flight: any, origin: string, destination: string, budgetMode: string) {
  const stopLabel = getFlightStopsLabel(flight)
  if (stopLabel === "Nonstop") {
    return `Nonstop timing from ${origin} to ${destination} keeps this segment efficient for your ${budgetMode.toLowerCase()} trip.`
  }
  if ((flight?.stops || 0) === 1) {
    return "A one-stop option that balances price and duration well for this leg."
  }
  return `A workable route for ${origin} to ${destination} with a focus on overall fare value.`
}

// Define payment method type
type PaymentMethod = "upi" | "card" | "netbanking" | "wallet" | "cash"
type PaymentSubMethod = "credit-card" | "debit-card" | "google-pay" | "phonepe" | "paytm" | "other-upi"

// UPI Apps type
type UpiApp = "google-pay" | "phonepe" | "paytm" | "amazon-pay" | "bhim" | "other"

export default function BookingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState("hotels")
  const [sortBy, setSortBy] = useState("recommended")
  const [filterCity, setFilterCity] = useState("All")
  const [favorites, setFavorites] = useState<string[]>([])
  const [showBookingDialog, setShowBookingDialog] = useState(false)
  const [bookingStep, setBookingStep] = useState<"details" | "payment" | "confirmation">("details")
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [aiBookingHandoff, setAiBookingHandoff] = useState<any>(null)
  const [bookingDetails, setBookingDetails] = useState({
    checkIn: "",
    checkOut: "",
    guests: 1,
    rooms: 1,
    travelerName: "",
    email: "",
    phone: "",
  })
  const [paymentDetails, setPaymentDetails] = useState({
    method: "upi" as PaymentMethod,
    subMethod: "google-pay" as PaymentSubMethod,
    cardNumber: "",
    cardHolder: "",
    expiry: "",
    cvv: "",
    upiId: "",
    selectedUpiApp: "google-pay" as UpiApp,
    netBankingBank: "",
    otp: "",
  })
  const [showUpiQr, setShowUpiQr] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    upi: true,
    card: false,
    netbanking: false,
    wallet: false,
    cash: false,
  })

  // Dynamic State
  const [tripContext, setTripContext] = useState<any>(null)
  const [isTripMode, setIsTripMode] = useState(false)
  const [currency, setCurrency] = useState("INR")
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, EUR: 0.93, GBP: 0.79, JPY: 151.0, INR: 83.0 })
  const [isRatesLoading, setIsRatesLoading] = useState(false)

  // Travel Flow State
  const [orderedRoute, setOrderedRoute] = useState<string[]>([])
  const [selectedDestination, setSelectedDestination] = useState("")
  const [selectedHotelsByCity, setSelectedHotelsByCity] = useState<Record<string, any>>({})
  const [selectedFlightsBySegment, setSelectedFlightsBySegment] = useState<Record<string, any>>({})
  const [skippedHotelsByCity, setSkippedHotelsByCity] = useState<Record<string, boolean>>({})
  const [skippedFlightsBySegment, setSkippedFlightsBySegment] = useState<Record<string, boolean>>({})
  const [routeConfirmed, setRouteConfirmed] = useState(false)
  const [hotelMinPrice, setHotelMinPrice] = useState<number | undefined>(undefined)
  const [hotelMaxPrice, setHotelMaxPrice] = useState<number | undefined>(undefined)
  const [hotelMinRating, setHotelMinRating] = useState<number>(0)
  const [hotelAmenities, setHotelAmenities] = useState<string[]>([])
  const [flightSort, setFlightSort] = useState<"best" | "cheapest" | "fastest">("best")
  const [flightStops, setFlightStops] = useState<"all" | "0" | "1" | "2+">("all")
  const [flightDepartureWindow, setFlightDepartureWindow] = useState<"all" | "morning" | "afternoon" | "evening" | "night">("all")
  const [flightAirlineFilter, setFlightAirlineFilter] = useState("all")
  const [geocodedLocations, setGeocodedLocations] = useState<Record<string, { lat: number; lng: number }>>({})

  useEffect(() => {
    // 1. Load Context, route and persisted selections
    const contextStr = localStorage.getItem("WANDERLY_TRIP_CONTEXT")
    const ratesStr = localStorage.getItem("WANDERLY_RATES")
    const storedRouteStr = localStorage.getItem("WANDERLY_ORDERED_ROUTE")
    const storedSelectionsStr = localStorage.getItem("WANDERLY_BOOKING_SELECTIONS")
    const storedRouteConfirmedStr = localStorage.getItem("WANDERLY_ROUTE_CONFIRMED")
    const storedTripId = localStorage.getItem("WANDERLY_BOOKING_TRIP_ID")
    const aiHandoffStr = localStorage.getItem(BOOKING_HANDOFF_STORAGE_KEY)

    let ctx = null
    if (contextStr) {
      const parsed = JSON.parse(contextStr)
      ctx = parsed?.tripContext || parsed
      setTripContext(ctx)
      setIsTripMode(true)
      if (ctx.currency) setCurrency(ctx.currency)

      const places: RoutePlace[] = Array.isArray(ctx.selectedPlaces) ? ctx.selectedPlaces : []
      const destinations = deriveDestinationsFromPlaces(places)
      const origin = String(ctx.fromLocation || ctx.origin || "").trim()
      const contextRoute = [origin, ...destinations].filter(Boolean)
      const currentTripId = buildBookingTripId(ctx)
      const isNewTrip = !storedTripId || storedTripId !== currentTripId
      localStorage.setItem("WANDERLY_BOOKING_TRIP_ID", currentTripId)

      if (isNewTrip && !aiHandoffStr) {
        setSelectedHotelsByCity({})
        setSelectedFlightsBySegment({})
        setSkippedHotelsByCity({})
        setSkippedFlightsBySegment({})
        setRouteConfirmed(false)
        localStorage.removeItem("WANDERLY_BOOKING_SELECTIONS")
        localStorage.removeItem("WANDERLY_ORDERED_ROUTE")
        localStorage.removeItem("WANDERLY_ROUTE_CONFIRMED")
      }

      const restoredRoute = storedRouteStr ? JSON.parse(storedRouteStr) : null
      const nextRoute = !isNewTrip && isValidStoredRoute(restoredRoute, origin, destinations)
        ? restoredRoute
        : contextRoute

      setOrderedRoute(nextRoute)
      setSelectedDestination(nextRoute[1] || "")
      localStorage.setItem("WANDERLY_ORDERED_ROUTE", JSON.stringify(nextRoute))

      const shouldRestoreConfirm = !isNewTrip && storedRouteConfirmedStr === "true"
      setRouteConfirmed(Boolean(shouldRestoreConfirm))
      if (shouldRestoreConfirm) {
        localStorage.setItem("WANDERLY_ROUTE_CONFIRMED", "true")
      }

      if ((!isNewTrip || aiHandoffStr) && storedSelectionsStr) {
        const parsedSelections = JSON.parse(storedSelectionsStr)
        if (parsedSelections?.selectedHotelsByCity || parsedSelections?.selectedFlightsBySegment) {
          setSelectedHotelsByCity(parsedSelections.selectedHotelsByCity || {})
          setSelectedFlightsBySegment(parsedSelections.selectedFlightsBySegment || {})
          setSkippedHotelsByCity(parsedSelections.skippedHotelsByCity || {})
          setSkippedFlightsBySegment(parsedSelections.skippedFlightsBySegment || {})
        } else {
          // Backward compatibility for legacy destination-keyed selection object
          const legacy = parsedSelections as Record<string, { hotel?: any; flight?: any; skipHotel?: boolean; skipFlight?: boolean }>
          const nextHotels: Record<string, any> = {}
          const nextFlights: Record<string, any> = {}
          const nextSkippedHotels: Record<string, boolean> = {}
          const nextSkippedFlights: Record<string, boolean> = {}
          for (const [destination, value] of Object.entries(legacy || {})) {
            const cityKey = normalizeCity(destination)
            if (value?.hotel) nextHotels[cityKey] = value.hotel
            if (value?.skipHotel) nextSkippedHotels[cityKey] = true
            if (value?.flight) {
              const flightOrigin = value.flight.from || ""
              const destinationCity = value.flight.to || destination
              nextFlights[makeSegmentKey(flightOrigin, destinationCity)] = value.flight
            }
            if (value?.skipFlight) {
              nextSkippedFlights[makeSegmentKey("", destination)] = true
            }
          }
          setSelectedHotelsByCity(nextHotels)
          setSelectedFlightsBySegment(nextFlights)
          setSkippedHotelsByCity(nextSkippedHotels)
          setSkippedFlightsBySegment(nextSkippedFlights)
        }
      }
    }

    if (ratesStr) {
      setRates(JSON.parse(ratesStr).data)
    }
  }, [])

  useEffect(() => {
    const requestedTab = searchParams.get("tab")
    if (requestedTab === "flights" || requestedTab === "hotels" || requestedTab === "bundles") {
      setActiveTab(requestedTab)
    }
  }, [searchParams])

  useEffect(() => {
    const handoffStr = localStorage.getItem(BOOKING_HANDOFF_STORAGE_KEY)
    if (!handoffStr) return

    try {
      const parsed = JSON.parse(handoffStr)
      setAiBookingHandoff(parsed)
      if (parsed?.activeTab) setActiveTab(parsed.activeTab)
      if (parsed?.selectedDestination) setSelectedDestination(parsed.selectedDestination)
      if (parsed?.flight) {
        setSelectedItem(parsed.flight)
      }
    } catch {
      setAiBookingHandoff(null)
    }
  }, [])

  useEffect(() => {
    const payload = {
      selectedHotelsByCity,
      selectedFlightsBySegment,
      skippedHotelsByCity,
      skippedFlightsBySegment,
    }
    localStorage.setItem("WANDERLY_BOOKING_SELECTIONS", JSON.stringify(payload))
  }, [selectedHotelsByCity, selectedFlightsBySegment, skippedHotelsByCity, skippedFlightsBySegment])

  const routePlacesByCity = useMemo(() => {
    const map: Record<string, RoutePlace> = {}
    const places: RoutePlace[] = Array.isArray(tripContext?.selectedPlaces) ? tripContext.selectedPlaces : []
    for (const place of places) {
      if (place?.city && !map[place.city]) {
        map[place.city] = place
      }
    }
    return map
  }, [tripContext])

  const routeDestinations = useMemo(() => orderedRoute.slice(1), [orderedRoute])
  const selectedPlacesFromContext = useMemo<RoutePlace[]>(
    () => (Array.isArray(tripContext?.selectedPlaces) ? tripContext.selectedPlaces : []),
    [tripContext]
  )
  const selectedPlacesChipText = useMemo(() => {
    if (!selectedPlacesFromContext.length) return ""
    const top = selectedPlacesFromContext[0]
    const more = selectedPlacesFromContext.length - 1
    const topLabel = `${top.name || top.city}${top.city ? ` (${top.city})` : ""}`
    return more > 0 ? `${topLabel} +${more} more` : topLabel
  }, [selectedPlacesFromContext])
  const tripStartDate = tripContext?.startDate || tripContext?.dateRange?.from
  const tripEndDate = tripContext?.endDate || tripContext?.dateRange?.to

  const selectedSegmentIndex = useMemo(() => {
    const idx = orderedRoute.findIndex((city) => normalizeCity(city) === normalizeCity(selectedDestination))
    return idx > 0 ? idx : 1
  }, [orderedRoute, selectedDestination])

  const currentOrigin = orderedRoute[selectedSegmentIndex - 1] || orderedRoute[0] || ""
  const hasSingleDestination = routeDestinations.length <= 1

  useEffect(() => {
    if (!aiBookingHandoff?.flight || !selectedDestination) return
    const nextKey = makeSegmentKey(aiBookingHandoff.flight.from || currentOrigin || "", selectedDestination)
    setSelectedFlightsBySegment((prev) => (prev[nextKey] ? prev : { ...prev, [nextKey]: aiBookingHandoff.flight }))
  }, [aiBookingHandoff, currentOrigin, selectedDestination])

  useEffect(() => {
    if (isTripMode && hasSingleDestination && orderedRoute.length > 1 && !routeConfirmed) {
      setRouteConfirmed(true)
      localStorage.setItem("WANDERLY_ROUTE_CONFIRMED", "true")
    }
  }, [hasSingleDestination, isTripMode, orderedRoute.length, routeConfirmed])

  useEffect(() => {
    if (orderedRoute.length <= 1) {
      setSelectedDestination("")
      return
    }
    if (!selectedDestination || !orderedRoute.includes(selectedDestination)) {
      setSelectedDestination(orderedRoute[1])
    }
  }, [orderedRoute, selectedDestination])

  const segmentDateMap = useMemo(() => {
    if (!tripStartDate || !tripEndDate || routeDestinations.length === 0) {
      return {} as Record<string, { checkIn: string; checkOut: string; nights: number; departureDate: string }>
    }

    const toISODate = (date: Date) => {
      const year = date.getFullYear()
      const month = `${date.getMonth() + 1}`.padStart(2, "0")
      const day = `${date.getDate()}`.padStart(2, "0")
      return `${year}-${month}-${day}`
    }

    const startDate = new Date(tripStartDate)
    const endDate = new Date(tripEndDate)
    const totalTripDays = Math.max(1, differenceInCalendarDays(endDate, startDate))

    const result: Record<string, { checkIn: string; checkOut: string; nights: number; departureDate: string }> = {}

    const placesWithVisitDate: RoutePlace[] = (selectedPlacesFromContext || [])
      .filter((p: RoutePlace) => p.visitDate)
      .sort((a: RoutePlace, b: RoutePlace) => new Date(a.visitDate || "").getTime() - new Date(b.visitDate || "").getTime())

    const hasVisitDates = placesWithVisitDate.length > 0

    if (hasVisitDates) {
      routeDestinations.forEach((destination, idx) => {
        const currentPlace = placesWithVisitDate.find((p) => p.city === destination)
        const nextDestination = routeDestinations[idx + 1]
        const nextPlace = nextDestination ? placesWithVisitDate.find((p) => p.city === nextDestination) : null

        const checkInDate = currentPlace?.visitDate ? new Date(currentPlace.visitDate) : new Date(startDate)
        const checkOutDate = nextPlace?.visitDate ? new Date(nextPlace.visitDate) : new Date(endDate)
        const nights = Math.max(1, differenceInCalendarDays(checkOutDate, checkInDate))

        result[destination] = {
          checkIn: toISODate(checkInDate),
          checkOut: toISODate(checkOutDate),
          nights,
          departureDate: toISODate(checkInDate),
        }
      })
      return result
    }

    const destinationsCount = routeDestinations.length
    const baseDays = Math.max(1, Math.floor(totalTripDays / destinationsCount))
    const remainder = totalTripDays % destinationsCount

    let rollingDate = new Date(startDate)
    routeDestinations.forEach((destination, idx) => {
      const thisSegmentDays = baseDays + (idx < remainder ? 1 : 0)
      const checkInDate = new Date(rollingDate)
      const checkOutDate = new Date(checkInDate)
      checkOutDate.setDate(checkOutDate.getDate() + thisSegmentDays)

      result[destination] = {
        checkIn: toISODate(checkInDate),
        checkOut: toISODate(checkOutDate),
        nights: Math.max(1, thisSegmentDays),
        departureDate: toISODate(checkInDate),
      }

      rollingDate = new Date(checkOutDate)
    })

    return result
  }, [routeDestinations, selectedPlacesFromContext, tripEndDate, tripStartDate])

  useEffect(() => {
    if (!selectedDestination) return
    const segmentDates = segmentDateMap[selectedDestination]
    if (!segmentDates) return

    setBookingDetails((prev) => ({
      ...prev,
      checkIn: segmentDates.checkIn,
      checkOut: segmentDates.checkOut,
      guests: tripContext?.travelersCount || tripContext?.travelers || prev.guests,
    }))
  }, [selectedDestination, segmentDateMap, tripContext])

  useEffect(() => {
    if (!isTripMode) return
    const budget = (tripContext?.budgetLevel || "medium").toLowerCase()
    if (budget === "low") {
      setSortBy("price-low")
      setFlightSort("cheapest")
    } else if (budget === "premium") {
      setSortBy("rating")
      setFlightSort("fastest")
    } else {
      setSortBy("recommended")
      setFlightSort("best")
    }
  }, [isTripMode, tripContext?.budgetLevel])

  const hotelSortMode = useMemo<"recommended" | "price-lowhigh" | "rating-highlow">(() => {
    if (sortBy === "rating") return "rating-highlow"
    if (sortBy === "price-low" || sortBy === "price-high") return "price-lowhigh"
    return "recommended"
  }, [sortBy])

  const {
    hotels: liveHotels,
    total: totalHotels,
    hasMore: hasMoreHotels,
    page: hotelsPage,
    loadedCount: loadedHotelsCount,
    isLoading: isLoadingHotels,
    isLoadingMore: isLoadingMoreHotels,
    error: hotelsError,
    details: hotelsErrorDetails,
    liveUnavailable: hotelsLiveUnavailable,
    mode: hotelsMode,
    reason: hotelsReason,
    message: hotelsMessage,
    amenitiesAvailable,
    loadMore: loadMoreHotels,
    loadUntil100: loadHotelsUntil100,
    tryWiderSearch,
  } = useHotelsSearch({
    city: selectedDestination,
    checkIn: segmentDateMap[selectedDestination]?.checkIn,
    checkOut: segmentDateMap[selectedDestination]?.checkOut,
    adults: tripContext?.travelersCount || tripContext?.travelers || 1,
    budgetLevel: tripContext?.budgetLevel || "medium",
    sort: hotelSortMode,
    minPrice: hotelMinPrice,
    maxPrice: hotelMaxPrice,
    minRating: hotelMinRating || undefined,
    amenities: hotelAmenities,
    limit: 25,
    enabled: isTripMode && routeConfirmed && Boolean(selectedDestination),
  })

  const selectedAirlines = flightAirlineFilter === "all" ? [] : [flightAirlineFilter]
  const { flights: liveFlights, isLoading: isLoadingFlights, error: flightsError, mode: flightsMode, message: flightsMessage } = useFlights({
    origin: currentOrigin,
    destination: selectedDestination,
    depart: segmentDateMap[selectedDestination]?.departureDate || "",
    returnDate: undefined,
    adults: tripContext?.travelersCount || tripContext?.travelers || 1,
    budgetLevel: tripContext?.budgetLevel || "medium",
    sort: flightSort,
    stops: flightStops,
    airlines: selectedAirlines,
    departureWindow: flightDepartureWindow,
    enabled: isTripMode && routeConfirmed && Boolean(selectedDestination) && Boolean(segmentDateMap[selectedDestination]?.departureDate),
  })

  // Currency utility (rates are stored relative to USD)
  const convertCurrency = (amount: number, fromCurrency = "USD", toCurrency = currency) => {
    const fromRate = rates[fromCurrency] || 1
    const toRate = rates[toCurrency] || 1
    const usdAmount = fromCurrency === "USD" ? amount : amount / fromRate
    return usdAmount * toRate
  }

  const formatPrice = (amount: number, fromCurrency = "USD") => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      convertCurrency(amount, fromCurrency, currency)
    )
  }

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    )
  }

  const selectedDestinationKey = normalizeCity(selectedDestination || "")
  const currentSegmentKey = makeSegmentKey(currentOrigin || "", selectedDestination || "")

  const selectHotelForDestination = (hotel: any) => {
    if (!selectedDestination) return
    const cityKey = normalizeCity(selectedDestination)
    setSelectedHotelsByCity((prev) => ({ ...prev, [cityKey]: hotel }))
    setSkippedHotelsByCity((prev) => ({ ...prev, [cityKey]: false }))
  }

  const selectFlightForDestination = (flight: any) => {
    if (!selectedDestination) return
    const segmentKey = makeSegmentKey(currentOrigin || "", selectedDestination)
    setSelectedFlightsBySegment((prev) => ({ ...prev, [segmentKey]: flight }))
    setSkippedFlightsBySegment((prev) => ({ ...prev, [segmentKey]: false }))
  }

  const handleBookNow = (item: any) => {
    setSelectedItem(item)
    setBookingStep("details")
    setShowBookingDialog(true)
  }

  const handleBookingSubmit = () => {
    if (bookingStep === "details") {
      setBookingStep("payment")
    } else if (bookingStep === "payment") {
      // Simulate payment processing
      console.log("Processing payment:", {
        bookingDetails,
        paymentDetails,
        selectedItem,
        total: (selectedItem?.price * 1.1).toFixed(2)
      })

      setBookingStep("confirmation")

      // Close dialog after 3 seconds
      setTimeout(() => {
        setShowBookingDialog(false)
        setBookingStep("details")
        setShowUpiQr(false)
      }, 3000)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))

    // Set payment method when expanding
    if (!expandedSections[section]) {
      setPaymentDetails(prev => ({
        ...prev,
        method: section
      }))
    }
  }

  // Unique cities from hotels dataset
  const hotelCities = useMemo(() => {
    const cities = [...new Set(allHotels.map((h) => h.city))]
    return ["All", ...cities]
  }, [])

  // --- Travel Flow Helpers ---
  const moveRouteItem = (index: number, direction: "up" | "down") => {
    const newRoute = [...orderedRoute]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newRoute.length) return

    const [removed] = newRoute.splice(index, 1)
    newRoute.splice(targetIndex, 0, removed)
    setOrderedRoute(newRoute)
    if (!newRoute.includes(selectedDestination)) {
      setSelectedDestination(newRoute[1] || "")
    }
    localStorage.setItem("WANDERLY_ORDERED_ROUTE", JSON.stringify(newRoute))
  }

  const handleConfirmRoute = () => {
    setRouteConfirmed(true)
    localStorage.setItem("WANDERLY_ROUTE_CONFIRMED", "true")
    localStorage.setItem("WANDERLY_ORDERED_ROUTE", JSON.stringify(orderedRoute))
    if (!selectedDestination && orderedRoute.length > 1) {
      setSelectedDestination(orderedRoute[1])
    }
  }

  const currentHotelSelection = selectedHotelsByCity[selectedDestinationKey]
  const currentFlightSelection = selectedFlightsBySegment[currentSegmentKey]
  const currentHotelSkipped = Boolean(skippedHotelsByCity[selectedDestinationKey])
  const currentFlightSkipped = Boolean(skippedFlightsBySegment[currentSegmentKey])

  const activeSegment = {
    from: currentOrigin,
    to: selectedDestination,
    ...segmentDateMap[selectedDestination],
  }
  const currentSegmentDateLabel = formatDateRangeLabel(activeSegment.checkIn, activeSegment.checkOut)
  const currentSegmentDepartureLabel = formatShortDate(activeSegment.departureDate)

  useEffect(() => {
    if (!orderedRoute.length) return;
    
    let isMounted = true;

    const fetchCoords = async () => {
      const newCoords = { ...geocodedLocations };
      let changed = false;

      // Ensure we have currentOrigin handled too
      for (const city of orderedRoute) {
        if (!city) continue;
        const normalized = normalizeCity(city);
        if (!newCoords[normalized]) {
          try {
            // General fallback coordinates
            const fallbackApprox: Record<string, {lat: number, lng: number}> = {
              "mumbai": {lat: 19.0760, lng: 72.8777},
              "new york": {lat: 40.7128, lng: -74.0060},
              "london": {lat: 51.5074, lng: -0.1278},
              "paris": {lat: 48.8566, lng: 2.3522},
              "dubai": {lat: 25.2048, lng: 55.2708},
              "singapore": {lat: 1.3521, lng: 103.8198},
            };

            const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
            if (res.ok && isMounted) {
              const data = await res.json();
              if (data.lat !== undefined && data.lng !== undefined) {
                newCoords[normalized] = { lat: data.lat, lng: data.lng };
                changed = true;
              }
            } else if (isMounted) {
              // Fallback
              const lowerCity = normalized;
              if (fallbackApprox[lowerCity]) {
                newCoords[normalized] = fallbackApprox[lowerCity];
                changed = true;
              } else if (routePlacesByCity[city] && routePlacesByCity[city].lat && routePlacesByCity[city].lng) {
                 // Try to use context if we couldn't geocode
                 newCoords[normalized] = { lat: routePlacesByCity[city].lat as number, lng: routePlacesByCity[city].lng as number };
                 changed = true;
              }
            }
          } catch(e) {
            console.error("Failed to geocode", city, e);
          }
        }
      }

      if (changed && isMounted) {
        setGeocodedLocations(newCoords);
      }
    };

    fetchCoords();

    return () => { isMounted = false };
  }, [orderedRoute, geocodedLocations, routePlacesByCity]);

  const flowSegments = useMemo(() => {
    return orderedRoute.slice(1).map((destination, idx) => {
      const from = orderedRoute[idx]
      const fromGeo = geocodedLocations[normalizeCity(from)]
      const toGeo = geocodedLocations[normalizeCity(destination)]

      const fromLat = fromGeo?.lat
      const fromLng = fromGeo?.lng
      const toLat = toGeo?.lat
      const toLng = toGeo?.lng

      const canMeasureDistance = [fromLat, fromLng, toLat, toLng].every((v) => typeof v === "number")
      let distanceKm = canMeasureDistance
        ? calculateHaversineDistance(fromLat as number, fromLng as number, toLat as number, toLng as number)
        : null

      // Fallback distance logic if formula returns null or 0 unexpectedly but places differ
      if ((!distanceKm || distanceKm < 10) && from && destination && normalizeCity(from) !== normalizeCity(destination)) {
        const f = normalizeCity(from);
        const t = normalizeCity(destination);
        if ((f.includes("mumbai") || f.includes("india")) && (t.includes("new york") || t.includes("usa"))) {
          distanceKm = 12530;
        } else if ((t.includes("mumbai") || t.includes("india")) && (f.includes("new york") || f.includes("usa"))) {
          distanceKm = 12530;
        } else if (!distanceKm) {
          // Absolute last generic fallback
          distanceKm = 500;
        }
      }

      const estimatedHours = distanceKm ? distanceKm / 700 : null

      console.log("Start:", { city: from, coords: fromGeo });
      console.log("End:", { city: destination, coords: toGeo });
      console.log("Distance:", distanceKm);

      return {
        from,
        to: destination,
        distanceKm,
        estimatedHours,
        departureDate: segmentDateMap[destination]?.departureDate,
      }
    })
  }, [orderedRoute, geocodedLocations, segmentDateMap])

  const currentNights = selectedDestination ? segmentDateMap[selectedDestination]?.nights || 1 : 1
  const currentSegmentSubtotal =
    convertCurrency((currentHotelSelection?.price || 0) * currentNights, currentHotelSelection?.currency || "INR", currency) +
    convertCurrency(currentFlightSelection?.price || 0, currentFlightSelection?.currency || "INR", currency)

  const totalRouteSubtotal = useMemo(() => {
    const segments = orderedRoute.slice(1).map((to, idx) => ({ from: orderedRoute[idx], to, key: makeSegmentKey(orderedRoute[idx] || "", to) }))
    return segments.reduce((total, segment) => {
      const cityKey = normalizeCity(segment.to)
      const hotel = selectedHotelsByCity[cityKey]
      const flight = selectedFlightsBySegment[segment.key]
      const nights = segmentDateMap[segment.to]?.nights || 1
      const hotelTotal = convertCurrency((hotel?.price || 0) * nights, hotel?.currency || "INR", currency)
      const flightTotal = convertCurrency(flight?.price || 0, flight?.currency || "INR", currency)
      return total + hotelTotal + flightTotal
    }, 0)
  }, [orderedRoute, selectedHotelsByCity, selectedFlightsBySegment, segmentDateMap, convertCurrency])

  const routeSegments = useMemo(
    () => orderedRoute.slice(1).map((to, idx) => ({ from: orderedRoute[idx], to, destinationKey: normalizeCity(to), key: makeSegmentKey(orderedRoute[idx] || "", to) })),
    [orderedRoute]
  )

  const bookingProgress = useMemo(() => {
    const segments = routeSegments
    if (segments.length === 0) {
      return { completed: 0, total: 0, allCompleted: false, firstIncomplete: null as string | null }
    }

    let completed = 0
    let firstIncomplete: string | null = null

    for (const segment of segments) {
      const hotelDone = Boolean(selectedHotelsByCity[segment.destinationKey] || skippedHotelsByCity[segment.destinationKey])
      const flightDone = Boolean(selectedFlightsBySegment[segment.key] || skippedFlightsBySegment[segment.key])
      const done = hotelDone && flightDone
      if (done) completed += 1
      else if (!firstIncomplete) firstIncomplete = segment.to
    }

    return {
      completed,
      total: segments.length,
      allCompleted: completed === segments.length,
      firstIncomplete,
    }
  }, [routeSegments, selectedHotelsByCity, skippedHotelsByCity, selectedFlightsBySegment, skippedFlightsBySegment])

  const bookingProgressPercent = bookingProgress.total > 0 ? Math.round((bookingProgress.completed / bookingProgress.total) * 100) : 0
  const tripDateLabel = formatDateRangeLabel(tripStartDate, tripEndDate)
  const tripDurationLabel = getDurationLabel(tripStartDate, tripEndDate)
  const budgetModeLabel = getBudgetModeLabel(tripContext?.budgetLevel || tripContext?.budgetPreference)
  const tripModeLabel = getTripModeLabel(tripContext)
  const routeHeadline = orderedRoute.filter(Boolean).join(" -> ")
  const activeDestinationName = selectedDestination || tripContext?.selectedPlaces?.[0]?.city || tripContext?.destinations?.[0]?.name || "your trip"

  const segmentCards = useMemo(
    () =>
      routeSegments.map((segment, index) => {
        const hotel = selectedHotelsByCity[segment.destinationKey]
        const flight = selectedFlightsBySegment[segment.key]
        const hotelSkipped = Boolean(skippedHotelsByCity[segment.destinationKey])
        const flightSkipped = Boolean(skippedFlightsBySegment[segment.key])
        const nights = segmentDateMap[segment.to]?.nights || 1
        const subtotal =
          convertCurrency((hotel?.price || hotel?.pricePerNight || 0) * nights, hotel?.currency || "INR", currency) +
          convertCurrency(flight?.price || 0, flight?.currency || "INR", currency)
        const completed = Boolean((hotel || hotelSkipped) && (flight || flightSkipped))

        return {
          id: segment.key,
          index,
          from: segment.from,
          to: segment.to,
          destinationKey: segment.destinationKey,
          hotel,
          flight,
          hotelSkipped,
          flightSkipped,
          nights,
          subtotal,
          completed,
          checkIn: segmentDateMap[segment.to]?.checkIn,
          checkOut: segmentDateMap[segment.to]?.checkOut,
        }
      }),
    [
      routeSegments,
      selectedHotelsByCity,
      selectedFlightsBySegment,
      skippedHotelsByCity,
      skippedFlightsBySegment,
      segmentDateMap,
      convertCurrency,
      currency,
    ]
  )

  const currentSegmentSummary = useMemo(
    () => segmentCards.find((segment) => normalizeCity(segment.to) === normalizeCity(selectedDestination)) || segmentCards[0] || null,
    [segmentCards, selectedDestination]
  )

  const toggleSegmentSkip = (destination: string, field: "hotel" | "flight") => {
    const cityKey = normalizeCity(destination)
    const segmentKey = makeSegmentKey(currentOrigin || "", destination)
    if (field === "hotel") {
      setSkippedHotelsByCity((prev) => ({ ...prev, [cityKey]: !prev[cityKey] }))
      return
    }

    setSkippedFlightsBySegment((prev) => ({ ...prev, [segmentKey]: !prev[segmentKey] }))
  }

  const handleShowItinerary = () => {
    if (!isTripMode || !tripContext) return
    const plan = buildTripPlan({
      tripContext,
      orderedRoute,
      segmentDateMap,
      hotelsByCity: selectedHotelsByCity,
      flightsBySegment: selectedFlightsBySegment,
      skippedHotelsByCity,
      skippedFlightsBySegment,
    })
    saveTripPlan(plan)
    router.push("/itinerary")
  }

  const handleContinueBooking = () => {
    if (bookingProgress.firstIncomplete) {
      setSelectedDestination(bookingProgress.firstIncomplete)
    }
  }

  const hasCurrentSegmentSelection = Boolean(currentHotelSelection || currentFlightSelection)

  const handlePayCurrentSegment = () => {
    if (!selectedDestination || !hasCurrentSegmentSelection) return
    if (!Number.isFinite(currentSegmentSubtotal) || currentSegmentSubtotal <= 0) return

    setSelectedItem({
      id: `segment-${selectedDestinationKey}-${Date.now()}`,
      type: "segment",
      name: `${currentOrigin || "Origin"} -> ${selectedDestination}`,
      price: currentSegmentSubtotal,
      currency,
      hotelName: currentHotelSelection?.name || null,
      flightName: currentFlightSelection ? `${currentFlightSelection.from} -> ${currentFlightSelection.to}` : null,
      nights: currentNights,
    })
    setBookingStep("payment")
    setShowBookingDialog(true)
  }

  useEffect(() => {
    if (!isTripMode || !tripContext || orderedRoute.length <= 1) return
    if (!routeConfirmed) return

    const plan = buildTripPlan({
      tripContext,
      orderedRoute,
      segmentDateMap,
      hotelsByCity: selectedHotelsByCity,
      flightsBySegment: selectedFlightsBySegment,
      skippedHotelsByCity,
      skippedFlightsBySegment,
    })
    saveTripPlan(plan)
  }, [isTripMode, tripContext, orderedRoute, segmentDateMap, selectedHotelsByCity, selectedFlightsBySegment, skippedHotelsByCity, skippedFlightsBySegment, routeConfirmed])

  // Filter and sort hotels using dataset fields
  const filteredHotels = useMemo<any[]>(() => {
    let filtered: any[] = isTripMode ? [...liveHotels] : [...allHotels]
    if (!isTripMode && filterCity !== "All") {
      filtered = filtered.filter((h) => h.city === filterCity)
    }

    if (isTripMode) return filtered

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "reviews":
        filtered.sort((a, b) => b.reviews - a.reviews)
        break
      default:
        filtered.sort((a, b) => b.rating * b.reviews - a.rating * a.reviews)
        break
    }
    return filtered
  }, [sortBy, filterCity, liveHotels, isTripMode])

  const filteredFlights = useMemo(() => {
    if (isTripMode) return liveFlights
    return allFlights
  }, [isTripMode, liveFlights])

  const bundleHotel = currentHotelSelection || filteredHotels[0] || null
  const bundleFlight = currentFlightSelection || filteredFlights[0] || null

  const aiBookingRecommendation = useMemo(() => {
    if (!isTripMode) {
      return {
        title: "AI booking guidance",
        body: "Connect a planned trip to unlock segment-aware hotel and flight recommendations.",
      }
    }

    if (!routeConfirmed) {
      return {
        title: "Confirm the route first",
        body: "Once your travel order is locked, Wanderly can suggest the best stays and flights for each segment.",
      }
    }

    if (!currentHotelSelection && filteredHotels[0]) {
      return {
        title: `Start with a stay in ${activeDestinationName}`,
        body: `${filteredHotels[0].name} is a strong first pick because it balances nightly price, location, and rating for this stop.`,
      }
    }

    if (currentHotelSelection && !currentFlightSelection && filteredFlights[0]) {
      return {
        title: `Lock the ${currentOrigin || "next"} → ${activeDestinationName} flight`,
        body: `${filteredFlights[0].airline} looks like the best next move for this segment based on fare and timing.`,
      }
    }

    if (currentHotelSelection && currentFlightSelection) {
      return {
        title: `${activeDestinationName} is nearly ready`,
        body: "This segment already has both a stay and a flight selected. You can pay now or continue to the next stop.",
      }
    }

    return {
      title: "Keep building your trip",
      body: "Select a stay or a flight to keep your booking momentum going segment by segment.",
    }
  }, [isTripMode, routeConfirmed, currentHotelSelection, currentFlightSelection, filteredHotels, filteredFlights, activeDestinationName, currentOrigin])

  const airlineOptions = useMemo(() => {
    const set = new Set<string>()
    for (const f of filteredFlights) {
      if (f?.airline) set.add(f.airline)
    }
    return Array.from(set)
  }, [filteredFlights])

  const amenityIcons: Record<string, typeof Wifi> = {
    Spa: Dumbbell,
    Pool: Dumbbell,
    Restaurant: Utensils,
    WiFi: Wifi,
    Gym: Dumbbell,
    Bar: Utensils,
    Beach: MapPin,
    Concierge: Hotel,
    Garden: MapPin,
    "Tour Desk": MapPin,
    Rooftop: MapPin,
    "Bicycle Rental": Car,
    Butler: Hotel,
  }

  // Net banking banks list with logos
  const banks = [
    { name: "State Bank of India", code: "SBI", logo: "ðŸ¦" },
    { name: "HDFC Bank", code: "HDFC", logo: "ðŸ¦" },
    { name: "ICICI Bank", code: "ICICI", logo: "ðŸ¦" },
    { name: "Axis Bank", code: "AXIS", logo: "ðŸ¦" },
    { name: "Kotak Mahindra Bank", code: "KOTAK", logo: "ðŸ¦" },
    { name: "Punjab National Bank", code: "PNB", logo: "ðŸ¦" },
    { name: "Bank of Baroda", code: "BOB", logo: "ðŸ¦" },
    { name: "Canara Bank", code: "CANARA", logo: "ðŸ¦" },
    { name: "Union Bank of India", code: "UNION", logo: "ðŸ¦" },
    { name: "IndusInd Bank", code: "INDUS", logo: "ðŸ¦" },
  ]

  // Payment method logos as SVG components
  const PaymentLogos = {
    UPI: () => (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="#6C63FF" />
        <path d="M8 9H16V11H8V9Z" fill="white" />
        <path d="M8 13H16V15H8V13Z" fill="white" />
        <circle cx="12" cy="10" r="1" fill="#6C63FF" />
        <circle cx="12" cy="14" r="1" fill="#6C63FF" />
      </svg>
    ),
    Visa: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#1A1F71" />
        <path d="M15.5 8L12 16H14.5L16.5 10L18 16H20.5L24 8H21.5L19.5 14L18 8H15.5Z" fill="white" />
        <path d="M28 8H30.5L32.5 16H30L29.5 14H26.5L26 16H23.5L25.5 8H28Z" fill="white" />
        <path d="M27 10.5L26 12.5H28L27 10.5Z" fill="white" />
      </svg>
    ),
    Mastercard: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#EB001B" />
        <rect x="20" width="20" height="24" rx="3" fill="#F79E1B" />
        <circle cx="20" cy="12" r="7" fill="white" />
        <circle cx="20" cy="12" r="5" fill="#FF5F00" />
      </svg>
    ),
    RuPay: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#003B70" />
        <path d="M12 8H15L17 12L19 8H22L18 16H16L12 8Z" fill="white" />
        <path d="M24 8H28V10H26V16H24V8Z" fill="white" />
        <path d="M30 8H34V10H32V16H30V8Z" fill="white" />
      </svg>
    ),
    Amex: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#108168" />
        <path d="M12 9H16L14 12L16 15H12L13 13H15L14 12L15 11H13L12 9Z" fill="white" />
        <path d="M18 9H22L21 12L22 15H18L19 13H21L20 12L21 11H19L18 9Z" fill="white" />
        <path d="M24 9H28L27 12L28 15H24L25 13H27L26 12L27 11H25L24 9Z" fill="white" />
      </svg>
    ),
    GooglePay: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#4285F4" />
        <path d="M10 8H30V16H10V8Z" fill="white" />
        <path d="M15 10H25V14H15V10Z" fill="#4285F4" />
        <circle cx="20" cy="12" r="1.5" fill="white" />
      </svg>
    ),
    PhonePe: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#5F259F" />
        <rect x="12" y="8" width="16" height="8" rx="1" fill="white" />
        <rect x="16" y="10" width="8" height="4" rx="0.5" fill="#5F259F" />
      </svg>
    ),
    Paytm: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#002E6E" />
        <rect x="12" y="8" width="16" height="8" rx="1" fill="#00B9F1" />
        <rect x="16" y="10" width="8" height="4" rx="0.5" fill="#002E6E" />
      </svg>
    ),
    AmazonPay: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#FF9900" />
        <path d="M12 9L16 12L12 15V9Z" fill="white" />
        <path d="M16 9H20V15H16V12H18V10H16V9Z" fill="white" />
        <path d="M22 9H24L26 12L28 9H30V15H28V12L26 15H24L22 12V15H20V9H22Z" fill="white" />
      </svg>
    ),
    BHIM: () => (
      <svg className="h-6 w-10" viewBox="0 0 40 24" fill="none">
        <rect width="40" height="24" rx="3" fill="#FF6B6B" />
        <path d="M15 9H19V15H15V9Z" fill="white" />
        <path d="M21 9H25V15H21V9Z" fill="white" />
        <path d="M15 12H25" stroke="white" strokeWidth="2" />
      </svg>
    ),
    NetBanking: () => (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="#10B981" />
        <path d="M8 9H16V11H8V9Z" fill="white" />
        <path d="M8 13H16V15H8V13Z" fill="white" />
        <circle cx="12" cy="10" r="1" fill="#10B981" />
        <circle cx="12" cy="14" r="1" fill="#10B981" />
      </svg>
    ),
    Cash: () => (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="#6B7280" />
        <circle cx="12" cy="12" r="4" fill="white" />
        <path d="M12 10V14" stroke="#6B7280" strokeWidth="2" />
        <path d="M10 12H14" stroke="#6B7280" strokeWidth="2" />
      </svg>
    ),
    Wallet: () => (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="6" width="16" height="12" rx="2" fill="#F59E0B" />
        <rect x="8" y="9" width="8" height="6" rx="1" fill="white" />
        <circle cx="16" cy="12" r="1" fill="#F59E0B" />
      </svg>
    ),
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)]">
      <Navigation />

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pb-[env(safe-area-inset-bottom)]">
        <ChatBubble inline />
      </div>

      <main className="mx-auto w-full max-w-[1780px] px-4 py-6 sm:px-6 xl:px-8">
        <section className="mb-6 overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(240,249,255,0.98)_100%)] shadow-[0_22px_60px_rgba(148,163,184,0.10)]">
          <div className="grid gap-6 p-6 lg:p-8 xl:grid-cols-[1.35fr_0.9fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Wanderly Booking Workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Book your trip</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                Complete your stays and flights with a route-aware booking flow designed for itinerary planning, cost control, and faster decisions.
              </p>

              <div className="mt-5 rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_14px_35px_rgba(148,163,184,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Active journey</p>
                <p className="mt-3 text-xl font-semibold text-slate-950">
                  {isTripMode ? routeHeadline || "Confirm a route to begin booking" : "Explore hotels and flights in demo mode"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50/80 px-3 py-1 text-sky-900">
                    {tripDateLabel}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    {tripDurationLabel}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    {budgetModeLabel}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    {tripModeLabel}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    Focus: {activeDestinationName}
                  </Badge>
                </div>
                {isTripMode && Array.isArray(tripContext?.preferences) && tripContext.preferences.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tripContext.preferences.slice(0, 4).map((pref: string) => (
                      <Badge key={pref} variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 capitalize text-slate-700">
                        {pref}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_14px_35px_rgba(148,163,184,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Booking progress</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{bookingProgressPercent}%</p>
                <p className="mt-2 text-sm text-slate-600">
                  {bookingProgress.total > 0
                    ? `${bookingProgress.completed} of ${bookingProgress.total} route segments ready`
                    : "Confirm a route to start segment-by-segment booking"}
                </p>
                <Progress value={bookingProgressPercent} className="mt-4 h-2.5 bg-slate-100" />
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_14px_35px_rgba(148,163,184,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Projected total</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatPrice(totalRouteSubtotal || tripContext?.estimatedTotal || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-600">Includes selected stay and flight options for your confirmed segments.</p>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_14px_35px_rgba(148,163,184,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current segment</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{currentOrigin || "Origin"} - {activeDestinationName}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {currentSegmentDateLabel} - Departing {currentSegmentDepartureLabel}
                </p>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.9)_0%,rgba(255,255,255,0.95)_100%)] p-5 shadow-[0_14px_35px_rgba(148,163,184,0.08)]">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">AI booking note</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{aiBookingRecommendation.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{aiBookingRecommendation.body}</p>
              </div>
            </div>
          </div>
        </section>

        {aiBookingHandoff?.flight ? (
          <Card className="mb-6 overflow-hidden rounded-[28px] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_18px_40px_rgba(14,165,233,0.10)]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">AI booking handoff</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    {aiBookingHandoff.flight.airline} {aiBookingHandoff.flight.route?.originCode || aiBookingHandoff.flight.from} - {aiBookingHandoff.flight.route?.destinationCode || aiBookingHandoff.flight.to}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {(aiBookingHandoff.flight.departureTime || aiBookingHandoff.flight.departure) || "--:--"} - {(aiBookingHandoff.flight.arrivalTime || aiBookingHandoff.flight.arrival) || "--:--"} / {aiBookingHandoff.flight.duration} / {aiBookingHandoff.flight.stopLabel || getFlightStopsLabel(aiBookingHandoff.flight)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full">{aiBookingHandoff.flight.cabinClass || aiBookingHandoff.flight.class || "Economy"}</Badge>
                    {aiBookingHandoff.flight.fareType ? <Badge variant="outline" className="rounded-full">{aiBookingHandoff.flight.fareType}</Badge> : null}
                    {aiBookingHandoff.flight.baggageNote ? <Badge variant="outline" className="rounded-full">{aiBookingHandoff.flight.baggageNote}</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <p className="text-3xl font-bold text-slate-950">{formatPrice(aiBookingHandoff.flight.price, aiBookingHandoff.flight.currency || "INR")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-2 rounded-full bg-slate-950 hover:bg-slate-800" onClick={() => { setSelectedItem(aiBookingHandoff.flight); setActiveTab("flights"); setBookingStep("details"); setShowBookingDialog(true) }}>
                      Book this ticket
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="rounded-full bg-white" onClick={() => setActiveTab("flights")}>
                      Review flight
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
          <Card className="rounded-[28px] border border-slate-200/80 bg-white/90 shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{isTripMode ? "Active trip summary" : "Demo inventory"}</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {isTripMode ? `${routeDestinations.length} destination stop${routeDestinations.length === 1 ? "" : "s"} across your planned route` : `${allHotels.length} hotels and ${allFlights.length} flights available to explore`}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {isTripMode
                    ? "Hotels and flights are filtered to the route segment you are actively booking."
                    : "Use this page as a demo booking surface, or connect a full trip for a route-aware experience."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                  {isTripMode ? "Segment-aware booking" : "Demo mode"}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                  {isRatesLoading ? "Refreshing currency" : `Currency: ${currency}`}
                </Badge>
                {isTripMode ? (
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                    Focus: {activeDestinationName}
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.95)_0%,rgba(239,246,255,0.95)_100%)] shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
            <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">AI optimizer</p>
                <p className="mt-2 text-lg font-semibold text-slate-950">{aiBookingRecommendation.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{aiBookingRecommendation.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full bg-white" asChild>
                  <Link href="/ai-assistant">Ask AI to optimize</Link>
                </Button>
                <Button variant="outline" className="rounded-full bg-white" onClick={handleShowItinerary} disabled={!isTripMode}>
                  View itinerary
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {isTripMode && orderedRoute.length > 1 && (
          <div className="mb-6">
            <TravelOrderBuilder
              route={orderedRoute}
              isConfirmed={routeConfirmed}
              onMove={moveRouteItem}
              onConfirm={handleConfirmRoute}
            />
          </div>
        )}

        {isTripMode && routeConfirmed && routeDestinations.length > 0 && (
          <section className="mb-8 rounded-[30px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_18px_45px_rgba(148,163,184,0.08)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Journey flow</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Route builder and segment navigation</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Review the travel order, switch to the current stop, and move through your booking one segment at a time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                  {routeConfirmed ? "Route confirmed" : "Route draft"}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                  Active stop: {activeDestinationName}
                </Badge>
              </div>
            </div>

            {!hasSingleDestination && (
              <div className="mt-5">
                <TravelFlowMap
                  route={orderedRoute}
                  activeDestination={selectedDestination}
                  segments={flowSegments}
                />
              </div>
            )}

            <DestinationSelector
              destinations={routeDestinations}
              selectedDestination={selectedDestination}
              onChange={setSelectedDestination}
              currentOrigin={currentOrigin}
              disabled={hasSingleDestination}
              helperText={selectedPlacesChipText ? `Based on your selected places: ${selectedPlacesChipText}` : undefined}
            />
          </section>
        )}

        {isTripMode && routeDestinations.length === 0 && (
          <Card className="mb-8 rounded-[28px] border-dashed border-slate-300 bg-white/88 shadow-[0_14px_35px_rgba(148,163,184,0.06)]">
            <CardContent className="p-8 text-center">
              <p className="text-lg font-semibold text-slate-950">No selected places found yet</p>
              <p className="mt-2 text-sm text-slate-600">Go back to the AI Assistant, pick your destinations, then return here to complete flights and stays.</p>
              <Link href="/ai-assistant">
                <Button className="mt-4 rounded-full bg-slate-950 hover:bg-slate-800">Go to AI Assistant</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {false && (
        <>
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Book Your Stay & Flights</h1>
          <p className="flex items-center gap-2 text-muted-foreground">
            {isRatesLoading && <RefreshCw className="h-3 w-3 animate-spin" />}
            {isTripMode ? (
              <>
                Showing options for {selectedDestination || tripContext?.selectedPlaces?.[0]?.city || tripContext?.destinations?.[0]?.name}
                • {tripStartDate && tripEndDate ? differenceInCalendarDays(new Date(tripEndDate), new Date(tripStartDate)) : 0} days
                â€¢ {tripContext?.travelersCount || tripContext?.travelers || 1} travelers
              </>
            ) : (
              `${allHotels.length} hotels across ${hotelCities.length - 1} cities | ${allFlights.length} flight routes available`
            )}
          </p>
          {isTripMode && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize">{tripContext?.budgetLevel || "medium"} Budget</Badge>
              {tripStartDate && tripEndDate && (
                <Badge variant="outline">{new Date(tripStartDate).toLocaleDateString()} - {new Date(tripEndDate).toLocaleDateString()}</Badge>
              )}
              {tripContext.preferences?.map((pref: string) => (
                <Badge key={pref} variant="secondary" className="capitalize">{pref}</Badge>
              ))}
            </div>
          )}
        </div>

        {aiBookingHandoff?.flight ? (
          <Card className="mb-6 overflow-hidden border-sky-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_18px_40px_rgba(14,165,233,0.10)]">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">AI booking handoff</p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">
                    {aiBookingHandoff.flight.airline} {aiBookingHandoff.flight.route?.originCode || aiBookingHandoff.flight.from} {"->"} {aiBookingHandoff.flight.route?.destinationCode || aiBookingHandoff.flight.to}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {aiBookingHandoff.flight.departureTime || aiBookingHandoff.flight.departure} - {aiBookingHandoff.flight.arrivalTime || aiBookingHandoff.flight.arrival}
                    {" • "}
                    {aiBookingHandoff.flight.duration}
                    {" • "}
                    {aiBookingHandoff.flight.stopLabel || `${aiBookingHandoff.flight.stops || 0} stop${(aiBookingHandoff.flight.stops || 0) === 1 ? "" : "s"}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{aiBookingHandoff.flight.cabinClass || aiBookingHandoff.flight.class || "Economy"}</Badge>
                    {aiBookingHandoff.flight.fareType ? <Badge variant="outline">{aiBookingHandoff.flight.fareType}</Badge> : null}
                    {aiBookingHandoff.flight.baggageNote ? <Badge variant="outline">{aiBookingHandoff.flight.baggageNote}</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 lg:items-end">
                  <p className="text-3xl font-bold text-foreground">{formatPrice(aiBookingHandoff.flight.price, aiBookingHandoff.flight.currency || "INR")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button className="gap-2" onClick={() => { setSelectedItem(aiBookingHandoff.flight); setActiveTab("flights"); setBookingStep("details"); setShowBookingDialog(true) }}>
                      Complete booking
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab("flights")}>
                      Review flight
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mb-8 border-chart-4/30 bg-chart-4/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-chart-4" />
            <div>
              <p className="font-medium text-foreground">{isTripMode ? "Trip Mode Enabled" : "Demo Mode"}</p>
              <p className="text-sm text-muted-foreground">
                {isTripMode
                  ? "Options filtered strictly to your selected route segment and preferences."
                  : "Hotels are matched to destinations from the World Famous Places 2024 dataset. Actual bookings are not processed."}
              </p>
            </div>
          </CardContent>
        </Card>

        {isTripMode && orderedRoute.length > 1 && (
          <TravelOrderBuilder
            route={orderedRoute}
            isConfirmed={routeConfirmed}
            onMove={moveRouteItem}
            onConfirm={handleConfirmRoute}
          />
        )}

        {isTripMode && routeConfirmed && routeDestinations.length > 0 && (
          <>
            {!hasSingleDestination && (
              <TravelFlowMap
                route={orderedRoute}
                activeDestination={selectedDestination}
                segments={flowSegments}
              />
            )}
            <DestinationSelector
              destinations={routeDestinations}
              selectedDestination={selectedDestination}
              onChange={setSelectedDestination}
              currentOrigin={currentOrigin}
              disabled={hasSingleDestination}
              helperText={selectedPlacesChipText ? `Based on your selected places: ${selectedPlacesChipText}` : undefined}
            />
          </>
        )}

        {isTripMode && routeDestinations.length === 0 && (
          <Card className="mb-8 border-dashed">
            <CardContent className="p-6 text-center">
              <p className="font-semibold">No selected places found.</p>
              <p className="text-sm text-muted-foreground">Go back to AI Assistant and select places first.</p>
              <Link href="/chat">
                <Button className="mt-4">Go to AI Assistant</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        </>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="space-y-6">
            {isTripMode && routeConfirmed && segmentCards.length > 0 ? (
              <Card className="rounded-[30px] border border-slate-200/80 bg-white/92 shadow-[0_18px_45px_rgba(148,163,184,0.08)]">
                <CardHeader className="pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Destination booking progress</p>
                      <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Continue booking stop by stop</CardTitle>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Each segment tracks its own stay, flight, subtotal, and completion state.</p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-900">
                      {bookingProgress.completed}/{bookingProgress.total} ready
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {segmentCards.map((segment) => {
                      const isActive = normalizeCity(segment.to) === normalizeCity(selectedDestination)
                      return (
                        <button
                          key={segment.id}
                          type="button"
                          onClick={() => setSelectedDestination(segment.to)}
                          className={cn(
                            "rounded-[24px] border p-4 text-left transition",
                            isActive ? "border-sky-300 bg-sky-50/80 shadow-[0_14px_35px_rgba(14,165,233,0.10)]" : "border-slate-200/80 bg-slate-50/60 hover:border-sky-200 hover:bg-white"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Segment {segment.index + 1}</p>
                              <h3 className="mt-2 text-lg font-semibold text-slate-950">{segment.to}</h3>
                              <p className="mt-1 text-sm text-slate-500">{segment.from} {"→"} {segment.to}</p>
                            </div>
                            <Badge variant="outline" className={cn("rounded-full", segment.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                              {segment.completed ? "Booked" : "Pending"}
                            </Badge>
                          </div>
                          <div className="mt-4 space-y-1 text-sm text-slate-600">
                            <p>{formatDateRangeLabel(segment.checkIn, segment.checkOut)}</p>
                            <p>Hotel: {segment.hotel ? segment.hotel.name : segment.hotelSkipped ? "Skipped" : "Not selected"}</p>
                            <p>Flight: {segment.flight ? `${segment.flight.from} -> ${segment.flight.to}` : segment.flightSkipped ? "Skipped" : "Not selected"}</p>
                          </div>
                          <div className="mt-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-500">{segment.nights} night{segment.nights === 1 ? "" : "s"}</span>
                            <span className="text-base font-semibold text-slate-950">{formatPrice(segment.subtotal)}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isTripMode && !routeConfirmed ? (
              <Card className="rounded-[30px] border border-dashed border-sky-200 bg-white/90 shadow-[0_18px_45px_rgba(148,163,184,0.06)]">
                <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 p-8 text-center">
                  <MapPin className="h-10 w-10 text-sky-600" />
                  <div>
                    <p className="text-xl font-semibold text-slate-950">Confirm your route to unlock booking options</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Once your travel order is locked, Wanderly will surface stay and flight options for the active segment.</p>
                  </div>
                  <Button className="rounded-full bg-slate-950 hover:bg-slate-800" onClick={handleConfirmRoute}>
                    Confirm route and continue
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <Card className="rounded-[30px] border border-slate-200/80 bg-white/94 shadow-[0_18px_45px_rgba(148,163,184,0.08)]">
                  <CardHeader className="pb-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Booking workspace</p>
                        <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                          {isTripMode ? `Hotels and flights for ${activeDestinationName}` : "Compare stays and flights"}
                        </CardTitle>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {isTripMode ? `${currentOrigin || "Origin"} -> ${activeDestinationName} / ${currentSegmentDateLabel}` : "Connect a trip for segment-aware booking, or browse demo inventory below."}
                        </p>
                      </div>

                      <TabsList className="grid w-full max-w-[420px] grid-cols-3 rounded-full bg-slate-100 p-1">
                        <TabsTrigger value="bundles" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Bundle view</TabsTrigger>
                        <TabsTrigger value="hotels" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Hotels</TabsTrigger>
                        <TabsTrigger value="flights" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">Flights</TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4">
                      {(activeTab === "hotels" || activeTab === "bundles") ? (
                        <>
                          {!isTripMode ? (
                            <Select value={filterCity} onValueChange={setFilterCity}>
                              <SelectTrigger className="w-[170px] rounded-full border-slate-200 bg-white">
                                <SelectValue placeholder="Filter city" />
                              </SelectTrigger>
                              <SelectContent>
                                {hotelCities.map((city) => (
                                  <SelectItem key={city} value={city}>{city === "All" ? "All Cities" : city}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : null}
                          <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-[180px] rounded-full border-slate-200 bg-white">
                              <SelectValue placeholder="Sort hotels" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="recommended">Recommended</SelectItem>
                              <SelectItem value="price-low">Price low to high</SelectItem>
                              <SelectItem value="rating">Top rated</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : null}

                      {activeTab === "flights" ? (
                        <>
                          <Select value={flightSort} onValueChange={(v: "best" | "cheapest" | "fastest") => setFlightSort(v)}>
                            <SelectTrigger className="w-[140px] rounded-full border-slate-200 bg-white">
                              <SelectValue placeholder="Sort flights" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="best">Best</SelectItem>
                              <SelectItem value="cheapest">Cheapest</SelectItem>
                              <SelectItem value="fastest">Fastest</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={flightStops} onValueChange={(v: "all" | "0" | "1" | "2+") => setFlightStops(v)}>
                            <SelectTrigger className="w-[130px] rounded-full border-slate-200 bg-white">
                              <SelectValue placeholder="Stops" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All stops</SelectItem>
                              <SelectItem value="0">Nonstop</SelectItem>
                              <SelectItem value="1">1 stop</SelectItem>
                              <SelectItem value="2+">2+ stops</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : null}

                      <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
                        {activeTab === "flights" ? `${filteredFlights.length} flight option${filteredFlights.length === 1 ? "" : "s"}` : `${filteredHotels.length} hotel option${filteredHotels.length === 1 ? "" : "s"}`}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <TabsContent value="bundles" className="mt-0 space-y-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 shadow-none">
                          <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stay recommendation</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">{bundleHotel?.name || `Select a stay in ${activeDestinationName}`}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {bundleHotel ? getHotelInsight(bundleHotel, activeDestinationName, budgetModeLabel) : `No hotel selected yet for ${activeDestinationName}.`}
                            </p>
                            <div className="mt-5 flex items-center justify-between">
                              <p className="text-2xl font-semibold text-slate-950">
                                {bundleHotel ? formatPrice(bundleHotel.pricePerNight || bundleHotel.price || 0, bundleHotel.currency || "USD") : "-"}
                              </p>
                              <Button className="rounded-full" variant={bundleHotel && currentHotelSelection?.id === bundleHotel.id ? "default" : "outline"} onClick={() => bundleHotel ? selectHotelForDestination({ ...bundleHotel, price: bundleHotel.pricePerNight || bundleHotel.price || 0 }) : setActiveTab("hotels")}>
                                {bundleHotel && currentHotelSelection?.id === bundleHotel.id ? "Selected stay" : "Choose stay"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="rounded-[24px] border border-slate-200/80 bg-slate-50/70 shadow-none">
                          <CardContent className="p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Flight recommendation</p>
                            <h3 className="mt-2 text-xl font-semibold text-slate-950">{bundleFlight?.airline || `Select a flight for ${currentOrigin || "this route"}`}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {bundleFlight ? getFlightInsight(bundleFlight, currentOrigin || "Origin", activeDestinationName, budgetModeLabel) : "No flight selected yet for this segment."}
                            </p>
                            <div className="mt-5 flex items-center justify-between">
                              <p className="text-2xl font-semibold text-slate-950">
                                {bundleFlight ? formatPrice(bundleFlight.price, bundleFlight.currency || "INR") : "-"}
                              </p>
                              <Button className="rounded-full" variant={bundleFlight && currentFlightSelection?.id === bundleFlight.id ? "default" : "outline"} onClick={() => bundleFlight ? selectFlightForDestination(bundleFlight) : setActiveTab("flights")}>
                                {bundleFlight && currentFlightSelection?.id === bundleFlight.id ? "Selected flight" : "Choose flight"}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="hotels" className="mt-0">
                      {filteredHotels.length === 0 ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                          <Hotel className="mb-3 h-10 w-10 text-slate-400" />
                          <p className="text-lg font-semibold text-slate-950">No hotel matches yet</p>
                          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Relax your filters or try a wider search to surface more stays.</p>
                        </div>
                      ) : (
                        <div className="grid gap-4 xl:grid-cols-2">
                          {filteredHotels.slice(0, 6).map((hotel, index) => {
                            const imageSrc = String(hotel.imageUrl || hotel.image || "").trim() || "/placeholder.svg"
                            const isSelectedHotel = currentHotelSelection?.id === hotel.id
                            const nightlyPrice = hotel.pricePerNight || hotel.price || 0
                            return (
                              <Card key={hotel.id} className={cn("overflow-hidden rounded-[28px] border transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(148,163,184,0.14)]", isSelectedHotel ? "border-sky-300 shadow-[0_16px_35px_rgba(14,165,233,0.12)]" : "border-slate-200/80 shadow-[0_14px_30px_rgba(148,163,184,0.08)]")}>
                                <div className="relative h-48 overflow-hidden bg-slate-100">
                                  <img src={imageSrc} alt={hotel.name} className="h-full w-full object-cover" loading="lazy" onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith('/placeholder.svg')) img.src = '/placeholder.svg' }} />
                                  <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                                    <Badge className="rounded-full bg-white/92 text-slate-900">{getHotelBadge(hotel, index)}</Badge>
                                    <button onClick={() => toggleFavorite(hotel.id)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-700">
                                      <Heart className={cn("h-4.5 w-4.5", favorites.includes(hotel.id) ? "fill-rose-500 text-rose-500" : "text-slate-700")} />
                                    </button>
                                  </div>
                                </div>
                                <CardContent className="space-y-4 p-5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <h3 className="text-xl font-semibold text-slate-950">{hotel.name}</h3>
                                      <p className="mt-1 text-sm text-slate-500">{hotel.city}{hotel.country ? `, ${hotel.country}` : ""}</p>
                                      <p className="mt-3 text-sm leading-6 text-slate-600">{getHotelInsight(hotel, activeDestinationName, budgetModeLabel)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Rating</p>
                                      <p className="mt-1 flex items-center justify-end gap-1 text-base font-semibold text-slate-950"><Star className="h-4 w-4 fill-amber-400 text-amber-400" />{hotel.rating ?? "N/A"}</p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {(hotel.amenities || []).slice(0, 4).map((amenity: string) => <Badge key={amenity} variant="secondary" className="rounded-full bg-slate-100 text-slate-700 capitalize">{amenity}</Badge>)}
                                  </div>
                                  <div className="flex items-end justify-between border-t border-slate-200 pt-4">
                                    <p className="text-2xl font-semibold text-slate-950">{formatPrice(nightlyPrice, hotel.currency || "USD")}</p>
                                    <div className="flex gap-2">
                                      <Button variant="outline" className="rounded-full bg-white" onClick={() => handleBookNow({ ...hotel, price: nightlyPrice })}>Details</Button>
                                      <Button variant={isSelectedHotel ? "default" : "outline"} className="rounded-full" onClick={() => selectHotelForDestination({ ...hotel, price: nightlyPrice })}>
                                        {isSelectedHotel ? "Selected" : "Select"}
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="flights" className="mt-0">
                      {filteredFlights.length === 0 ? (
                        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
                          <Plane className="mb-3 h-10 w-10 text-slate-400" />
                          <p className="text-lg font-semibold text-slate-950">No flights available for this segment</p>
                          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Try another route segment or adjust your flight filters.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredFlights.slice(0, 6).map((flight, index) => {
                            const isSelectedFlight = currentFlightSelection?.id === flight.id
                            return (
                              <Card key={flight.id} className={cn("rounded-[28px] border transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(148,163,184,0.14)]", isSelectedFlight ? "border-sky-300 shadow-[0_16px_35px_rgba(14,165,233,0.12)]" : "border-slate-200/80 shadow-[0_14px_30px_rgba(148,163,184,0.08)]")}>
                                <CardContent className="p-5">
                                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-lg font-semibold text-slate-950">{flight.airline}</p>
                                        <Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 text-sky-900">{getFlightBadge(flight, filteredFlights, index)}</Badge>
                                        <Badge variant="secondary" className="rounded-full">{flight.class || "Economy"}</Badge>
                                      </div>
                                      <p className="mt-3 text-sm leading-6 text-slate-600">{getFlightInsight(flight, currentOrigin || "Origin", activeDestinationName, budgetModeLabel)}</p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                                      <div className="text-left sm:text-right">
                                        <p className="text-3xl font-semibold tracking-tight text-slate-950">{flight.departure}</p>
                                        <p className="mt-1 text-sm text-slate-500">{flight.from}</p>
                                      </div>
                                      <div className="flex min-w-[150px] flex-col items-center px-3 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{flight.duration}</p>
                                        <div className="mt-2 flex w-full items-center gap-2"><div className="h-px flex-1 bg-slate-300" /><Plane className="h-4 w-4 text-sky-600" /><div className="h-px flex-1 bg-slate-300" /></div>
                                        <p className="mt-2 text-xs text-slate-500">{getFlightStopsLabel(flight)}</p>
                                      </div>
                                      <div className="text-left">
                                        <p className="text-3xl font-semibold tracking-tight text-slate-950">{flight.arrival}</p>
                                        <p className="mt-1 text-sm text-slate-500">{flight.to}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="mt-5 flex items-end justify-between border-t border-slate-200 pt-4">
                                    <p className="text-2xl font-semibold text-slate-950">{formatPrice(flight.price, flight.currency || "INR")}</p>
                                    <div className="flex gap-2">
                                      <Button variant="outline" className="rounded-full bg-white" onClick={() => handleBookNow(flight)}>Details</Button>
                                      <Button variant={isSelectedFlight ? "default" : "outline"} className="rounded-full" onClick={() => selectFlightForDestination(flight)}>
                                        {isSelectedFlight ? "Selected" : "Select"}
                                      </Button>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </TabsContent>
                  </CardContent>
                </Card>
              </Tabs>
            )}
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96)_0%,rgba(239,246,255,0.92)_100%)] shadow-[0_18px_45px_rgba(148,163,184,0.10)]">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Trip summary</p>
                    <CardTitle className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Booking summary</CardTitle>
                  </div>
                  <Badge variant="outline" className="rounded-full border-sky-200 bg-white px-3 py-1 text-sky-900">{bookingProgressPercent}% complete</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[22px] border border-white/80 bg-white/90 p-4">
                  <p className="text-sm font-medium text-slate-500">Current destination</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{activeDestinationName}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <p>Dates: {currentSegmentDateLabel}</p>
                    <p>Budget: {budgetModeLabel}</p>
                    <p>Trip mode: {tripModeLabel}</p>
                  </div>
                </div>
                {currentSegmentSummary ? (
                  <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Active segment</p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">
                          {currentSegmentSummary.from} → {currentSegmentSummary.to}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full",
                          currentSegmentSummary.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"
                        )}
                      >
                        {currentSegmentSummary.completed ? "Ready" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                        {currentSegmentSummary.nights} night{currentSegmentSummary.nights === 1 ? "" : "s"}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                        {currentSegmentSummary.hotel || currentSegmentSummary.hotelSkipped ? "Stay handled" : "Stay pending"}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
                        {currentSegmentSummary.flight || currentSegmentSummary.flightSkipped ? "Flight handled" : "Flight pending"}
                      </Badge>
                    </div>
                  </div>
                ) : null}
                <Progress value={bookingProgressPercent} className="h-2.5 bg-slate-100" />
                <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
                  <p className="text-sm font-medium text-slate-500">Selected hotel</p>
                  <p className="mt-2 font-semibold text-slate-950">{currentHotelSelection?.name || (currentHotelSkipped ? "Skipped for this stop" : "Not selected yet")}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
                  <p className="text-sm font-medium text-slate-500">Selected flight</p>
                  <p className="mt-2 font-semibold text-slate-950">{currentFlightSelection ? `${currentFlightSelection.from} -> ${currentFlightSelection.to}` : currentFlightSkipped ? "Skipped for this leg" : "Not selected yet"}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-white/90 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Segment subtotal</span>
                    <span className="text-lg font-semibold text-slate-950">{formatPrice(currentSegmentSubtotal)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Trip total</span>
                    <span className="text-2xl font-semibold text-slate-950">{formatPrice(totalRouteSubtotal || tripContext?.estimatedTotal || 0)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="rounded-full bg-slate-950 hover:bg-slate-800" onClick={handlePayCurrentSegment} disabled={!hasCurrentSegmentSelection || currentSegmentSubtotal <= 0}>Proceed to payment</Button>
                  <Button variant="outline" className="rounded-full bg-white" onClick={handleContinueBooking} disabled={bookingProgress.allCompleted}>Continue booking</Button>
                  <Button variant="outline" className="rounded-full bg-white" onClick={() => setActiveTab("bundles")}>View selected options</Button>
                  <Button variant="outline" className="rounded-full bg-white" onClick={handleShowItinerary} disabled={!bookingProgress.allCompleted}>Show itinerary</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border border-slate-200/80 bg-white/92 shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
              <CardHeader className="pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Need help?</p>
                <CardTitle className="text-xl font-semibold text-slate-950">AI booking assistant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">Ask Wanderly for cheaper options, better route timing, family-friendly stays, or a smarter booking sequence.</p>
                <div className="rounded-[22px] border border-sky-100 bg-sky-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-950">{aiBookingRecommendation.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{aiBookingRecommendation.body}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full bg-white" asChild>
                    <Link href="/ai-assistant">Open AI assistant</Link>
                  </Button>
                  <Button variant="outline" className="rounded-full bg-white" onClick={() => setActiveTab("bundles")}>View bundle</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {false && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {isTripMode && !routeConfirmed ? (
              <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-xl border border-dashed text-center">
                <MapPin className="h-8 w-8 text-primary" />
                <p className="font-semibold">Confirm your route to unlock destination bookings.</p>
                <p className="text-sm text-muted-foreground">You can reorder places above and confirm your travel sequence.</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <TabsList>
                    <TabsTrigger value="hotels" className="gap-2">
                      <Hotel className="h-4 w-4" />
                      Hotels ({isTripMode ? (totalHotels ?? loadedHotelsCount) : filteredHotels.length})
                    </TabsTrigger>
                    <TabsTrigger value="flights" className="gap-2">
                      <Plane className="h-4 w-4" />
                      Flights ({filteredFlights.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex items-center gap-3">
                    {activeTab === "hotels" && !isTripMode && (
                      <Select value={filterCity} onValueChange={setFilterCity}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder="Filter city" />
                        </SelectTrigger>
                        <SelectContent>
                          {hotelCities.map((city) => (
                            <SelectItem key={city} value={city}>
                              {city === "All" ? "All Cities" : city}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recommended">Recommended</SelectItem>
                        <SelectItem value="price-low">Price lowhigh</SelectItem>
                        <SelectItem value="rating">Rating highlow</SelectItem>
                      </SelectContent>
                    </Select>
                    {activeTab === "hotels" && isTripMode && (
                      <>
                        <Input
                          className="w-24"
                          type="number"
                          placeholder="Min ₹"
                          value={hotelMinPrice ?? ""}
                          onChange={(e) => setHotelMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                        />
                        <Input
                          className="w-24"
                          type="number"
                          placeholder="Max ₹"
                          value={hotelMaxPrice ?? ""}
                          onChange={(e) => setHotelMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                        />
                        <Select value={String(hotelMinRating || 0)} onValueChange={(v) => setHotelMinRating(Number(v))}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Min Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Any Rating</SelectItem>
                            <SelectItem value="3">3.0+</SelectItem>
                            <SelectItem value="4">4.0+</SelectItem>
                            <SelectItem value="4.5">4.5+</SelectItem>
                          </SelectContent>
                        </Select>
                        {amenitiesAvailable.length > 0 && (
                          <div className="flex max-w-[320px] flex-wrap gap-2">
                            {["wifi", "pool", "spa", "breakfast", "gym"]
                              .filter((amenity) => amenitiesAvailable.includes(amenity))
                              .map((amenity) => (
                                <Button
                                  key={amenity}
                                  type="button"
                                  variant={hotelAmenities.includes(amenity) ? "default" : "outline"}
                                  size="sm"
                                  onClick={() =>
                                    setHotelAmenities((prev) =>
                                      prev.includes(amenity)
                                        ? prev.filter((x) => x !== amenity)
                                        : [...prev, amenity]
                                    )
                                  }
                                >
                                  {amenity}
                                </Button>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                    {activeTab === "flights" && isTripMode && (
                      <>
                        <Select value={flightSort} onValueChange={(v: "best" | "cheapest" | "fastest") => setFlightSort(v)}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Sort" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">Best</SelectItem>
                            <SelectItem value="cheapest">Cheapest</SelectItem>
                            <SelectItem value="fastest">Fastest</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={flightStops} onValueChange={(v: "all" | "0" | "1" | "2+") => setFlightStops(v)}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Stops" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stops</SelectItem>
                            <SelectItem value="0">Nonstop</SelectItem>
                            <SelectItem value="1">1 Stop</SelectItem>
                            <SelectItem value="2+">2+ Stops</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={flightDepartureWindow} onValueChange={(v: "all" | "morning" | "afternoon" | "evening" | "night") => setFlightDepartureWindow(v)}>
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Departure" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Time</SelectItem>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                            <SelectItem value="evening">Evening</SelectItem>
                            <SelectItem value="night">Night</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={flightAirlineFilter} onValueChange={setFlightAirlineFilter}>
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Airline" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Airlines</SelectItem>
                            {airlineOptions.map((airline) => (
                              <SelectItem key={airline} value={airline}>
                                {airline}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>

                {isTripMode && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {hotelsMode === "demo" ? "DEMO hotels" : "Live hotels via RapidAPI"}
                    </Badge>
                    {hotelsError && <p className="text-xs text-destructive">{hotelsError}</p>}
                    {hotelsMessage && <p className="text-xs text-muted-foreground">{hotelsMessage}</p>}
                    {hotelsErrorDetails && <p className="text-xs text-muted-foreground">{hotelsErrorDetails}</p>}
                  </div>
                )}
                {isTripMode && hotelsLiveUnavailable && (
                  <Card className="mb-4 border-destructive/40 bg-destructive/5">
                    <CardContent className="p-3 text-sm text-destructive">
                      {hotelsReason === "quota_exceeded"
                        ? "Live hotel inventory unavailable (RapidAPI quota exceeded). Showing demo hotels."
                        : hotelsMessage || "Live hotel inventory unavailable. Showing demo hotels."}
                    </CardContent>
                  </Card>
                )}

                <TabsContent value="hotels" className="mt-0">
                  {isTripMode && isLoadingHotels && filteredHotels.length === 0 ? (
                    <div className="space-y-4">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <Card key={`hotel-skeleton-${idx}`} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            <div className="h-52 w-full animate-pulse bg-muted md:w-64 lg:w-80" />
                            <CardContent className="flex-1 p-6">
                              <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                              <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
                              <div className="mt-6 h-4 w-full animate-pulse rounded bg-muted" />
                              <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-muted" />
                            </CardContent>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : filteredHotels.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                      <Hotel className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">No hotels found for this city</p>
                      <p className="text-sm text-muted-foreground">Try relaxing price/rating/amenity filters for this segment.</p>
                      {isTripMode && (
                        <Button
                          className="mt-3"
                          variant="outline"
                          onClick={async () => {
                            setHotelMinPrice(undefined)
                            setHotelMaxPrice(undefined)
                            setHotelMinRating(0)
                            setHotelAmenities([])
                            await tryWiderSearch()
                          }}
                        >
                          Try wider search
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredHotels.map((hotel) => {
                        const hotelImageSrc = String(hotel.imageUrl || hotel.image || "").trim()
                        return (
                        <Card key={hotel.id} className="overflow-hidden">
                          <div className="flex flex-col md:flex-row">
                            <div className="relative aspect-[4/3] w-full md:aspect-square md:w-64 lg:w-80">
                              {hotelImageSrc ? (
                                <img
                                  src={hotelImageSrc}
                                  alt={hotel.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.currentTarget
                                    if (!img.src.endsWith("/placeholder.svg")) {
                                      img.src = "/placeholder.svg"
                                    }
                                  }}
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-muted">
                                  <Hotel className="h-12 w-12 text-muted-foreground" />
                                </div>
                              )}
                              <button
                                onClick={() => toggleFavorite(hotel.id)}
                                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur transition-colors hover:bg-card"
                                aria-label="Toggle favorite"
                              >
                                <Heart
                                  className={cn(
                                    "h-5 w-5 transition-colors",
                                    favorites.includes(hotel.id) ? "fill-destructive text-destructive" : "text-foreground"
                                  )}
                                />
                              </button>
                              <Badge className="absolute left-3 top-3 bg-card/80 text-foreground backdrop-blur">
                                {hotel.rating ? `${hotel.rating.toFixed(1)}★` : "Hotel"}
                              </Badge>
                            </div>

                            <CardContent className="flex flex-1 flex-col justify-between p-6">
                              <div>
                                <div className="mb-2 flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h3 className="text-xl font-semibold text-foreground">{hotel.name}</h3>
                                      {(hotel.isDemo || hotel.demo || hotel.source === "DEMO") && (
                                        <Badge variant="outline">DEMO</Badge>
                                      )}
                                    </div>
                                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                                      <MapPin className="h-4 w-4" />
                                      {hotel.city}{hotel.country ? `, ${hotel.country}` : ""}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1">
                                    <Star className="h-4 w-4 fill-chart-4 text-chart-4" />
                                    <span className="font-medium text-foreground">{hotel.rating ?? "N/A"}</span>
                                  </div>
                                </div>

                                <p className="mb-4 text-sm text-muted-foreground">
                                  {(hotel.reviewCount || 0).toLocaleString()} reviews
                                </p>

                                <div className="flex flex-wrap gap-2">
                                  {hotel.amenities.map((amenity: string) => {
                                    const label = amenity.charAt(0).toUpperCase() + amenity.slice(1)
                                    const Icon = amenityIcons[label] || Hotel
                                    return (
                                      <Badge key={amenity} variant="secondary" className="gap-1 capitalize">
                                        <Icon className="h-3 w-3" />
                                        {amenity}
                                      </Badge>
                                    )
                                  })}
                                </div>
                              </div>

                              <div className="mt-4 flex items-end justify-between border-t pt-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">
                                    per night
                                    {selectedDestination && segmentDateMap[selectedDestination]?.nights
                                      ? ` • ${segmentDateMap[selectedDestination].nights} night(s)`
                                      : ""}
                                  </p>
                                  <p className="text-2xl font-bold text-foreground">
                                    {formatPrice(hotel.pricePerNight || 0, hotel.currency || "USD")}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="outline" className="gap-2 bg-transparent">
                                    <ExternalLink className="h-4 w-4" />
                                    Details
                                  </Button>
                                  <Button
                                    variant={currentHotelSelection?.id === hotel.id ? "default" : "outline"}
                                    className="gap-2"
                                    onClick={() => selectHotelForDestination({ ...hotel, price: hotel.pricePerNight || 0 })}
                                  >
                                    {currentHotelSelection?.id === hotel.id ? "Hotel Selected" : "Select Hotel"}
                                  </Button>
                                  <Button className="gap-2" onClick={() => handleBookNow({ ...hotel, price: hotel.pricePerNight || 0 })}>
                                    Book Now
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      )})}
                    </div>
                  )}
                  {isTripMode && (
                    <div className="mt-6 flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        Showing {loadedHotelsCount} of {totalHotels ? `${totalHotels}+` : "many"} hotels (page {hotelsPage})
                      </p>
                      {hasMoreHotels && (
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={loadMoreHotels} disabled={isLoadingMoreHotels}>
                            {isLoadingMoreHotels ? "Loading more..." : "Load more hotels"}
                          </Button>
                          <Button variant="secondary" onClick={loadHotelsUntil100} disabled={isLoadingMoreHotels || loadedHotelsCount >= 100}>
                            {isLoadingMoreHotels ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load up to 100"}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="flights" className="mt-0">
                  {isTripMode && isLoadingFlights && filteredFlights.length === 0 ? (
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <Card key={`flight-skeleton-${idx}`}>
                          <CardContent className="p-6">
                            <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
                            <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-muted" />
                            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : filteredFlights.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center">
                      <Plane className="mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="font-medium">Flights unavailable for this route (demo mode).</p>
                      <p className="text-sm text-muted-foreground">Choose another segment from your journey to continue booking.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredFlights.map((flight) => (
                        <Card key={flight.id}>
                          <CardContent className="p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div className="flex items-center gap-6">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                                  <Plane className="h-6 w-6 text-muted-foreground" />
                                </div>

                                <div className="flex items-center gap-8">
                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-foreground">{flight.departure}</p>
                                    <p className="text-sm text-muted-foreground">{flight.from}</p>
                                    {activeSegment?.departureDate && (
                                      <p className="text-xs text-muted-foreground">{activeSegment.departureDate}</p>
                                    )}
                                  </div>

                                  <div className="flex flex-col items-center">
                                    <p className="text-xs text-muted-foreground">{flight.duration}</p>
                                    <div className="flex items-center gap-2">
                                      <div className="h-px w-16 bg-border" />
                                      <Plane className="h-4 w-4 text-primary" />
                                      <div className="h-px w-16 bg-border" />
                                    </div>
                                    <p className="text-xs text-muted-foreground">Direct</p>
                                  </div>

                                  <div className="text-center">
                                    <p className="text-2xl font-bold text-foreground">{flight.arrival}</p>
                                    <p className="text-sm text-muted-foreground">{flight.to}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                <div>
                                  <p className="font-semibold text-foreground">{flight.airline}</p>
                                  <Badge variant="secondary">{flight.class}</Badge>
                                  {flight.isDemo && <Badge variant="outline" className="ml-2">DEMO</Badge>}
                                </div>
                                <p className="text-2xl font-bold text-foreground">{formatPrice(flight.price)}</p>
                                <div className="flex gap-2">
                                  <Button
                                    variant={currentFlightSelection?.id === flight.id ? "default" : "outline"}
                                    className="gap-2"
                                    onClick={() => selectFlightForDestination(flight)}
                                  >
                                    {currentFlightSelection?.id === flight.id ? "Flight Selected" : "Select Flight"}
                                  </Button>
                                  <Button className="gap-2" onClick={() => handleBookNow(flight)}>
                                    Book Now
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {isTripMode && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant={flightsMode === "LIVE" ? "secondary" : "outline"}>
                        {flightsMode === "LIVE" ? "Live flights" : "Demo flights"}
                      </Badge>
                      {flightsMessage && <p className="text-xs text-muted-foreground">{flightsMessage}</p>}
                      {flightsError && <p className="text-xs text-destructive">{flightsError}</p>}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>

          {/* Sticky Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {isTripMode && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Trip Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Current Destination</p>
                      <p className="font-semibold">{selectedDestination || tripContext?.selectedPlaces?.[0]?.city || tripContext?.destinations?.[0]?.name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Dates</p>
                        <p className="text-sm font-semibold">
                          {activeSegment?.checkIn && activeSegment?.checkOut
                            ? `${new Date(activeSegment.checkIn).toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${new Date(activeSegment.checkOut).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                            : tripStartDate && tripEndDate
                              ? `${new Date(tripStartDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${new Date(tripEndDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                              : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Budget</p>
                        <Badge variant="secondary" className="capitalize">{tripContext.budgetLevel}</Badge>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-md border bg-background/60 p-3">
                      <p className="text-sm font-medium text-muted-foreground">Selected Hotel</p>
                      <p className="text-sm font-semibold">
                        {currentHotelSelection?.name || (currentHotelSkipped ? "Skipped" : "Not selected")}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => selectedDestination && toggleSegmentSkip(selectedDestination, "hotel")}
                        disabled={!selectedDestination}
                      >
                        {currentHotelSkipped ? "Unskip Hotel" : "Skip Hotel"}
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-md border bg-background/60 p-3">
                      <p className="text-sm font-medium text-muted-foreground">Selected Flight</p>
                      <p className="text-sm font-semibold">
                        {currentFlightSelection
                          ? `${currentFlightSelection.from} -> ${currentFlightSelection.to}`
                          : (currentFlightSkipped ? "Skipped" : "Not selected")}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => selectedDestination && toggleSegmentSkip(selectedDestination, "flight")}
                        disabled={!selectedDestination}
                      >
                        {currentFlightSkipped ? "Unskip Flight" : "Skip Flight"}
                      </Button>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Segment Subtotal</span>
                        <span className="text-lg font-bold text-primary">{formatPrice(currentSegmentSubtotal)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold">Trip Total</span>
                        <span className="text-xl font-bold text-primary">{formatPrice(totalRouteSubtotal || tripContext?.estimatedTotal || 0)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Calculated in {currency}</p>
                    </div>

                    <div className="rounded-md border bg-background/60 p-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        Progress: {bookingProgress.completed}/{bookingProgress.total} segments booked
                      </p>
                      <div className="mt-3 flex flex-col gap-2">
                        <Button
                          onClick={handlePayCurrentSegment}
                          disabled={!hasCurrentSegmentSelection || currentSegmentSubtotal <= 0}
                          title={!hasCurrentSegmentSelection ? "Select at least a hotel or flight for this segment" : undefined}
                        >
                          Proceed to Payment
                        </Button>
                        <Button
                          onClick={handleShowItinerary}
                          disabled={!bookingProgress.allCompleted}
                          title={!bookingProgress.allCompleted ? "Please select hotel + flight for all segments" : undefined}
                        >
                          Show My Itinerary
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleContinueBooking}
                          disabled={bookingProgress.allCompleted}
                        >
                          Continue booking
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Our AI assistant can help you find better deals or adjust your itinerary.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/chat">
                      Open AI Assistant
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        )}
      </main>

      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {bookingStep === "details" && "Booking Details"}
              {bookingStep === "payment" && "Payment Information"}
              {bookingStep === "confirmation" && "Booking Confirmed!"}
            </DialogTitle>
            <DialogDescription>
              {bookingStep === "details" && "Please fill in your booking details"}
              {bookingStep === "payment" && "Secure payment processing"}
              {bookingStep === "confirmation" && "Your booking has been confirmed"}
            </DialogDescription>
          </DialogHeader>

          {bookingStep === "details" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Check-in Date</Label>
                  <Input
                    id="checkIn"
                    type="date"
                    value={bookingDetails.checkIn}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, checkIn: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Check-out Date</Label>
                  <Input
                    id="checkOut"
                    type="date"
                    value={bookingDetails.checkOut}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, checkOut: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guests">Guests</Label>
                  <Input
                    id="guests"
                    type="number"
                    min="1"
                    value={bookingDetails.guests}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, guests: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rooms">Rooms</Label>
                  <Input
                    id="rooms"
                    type="number"
                    min="1"
                    value={bookingDetails.rooms}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, rooms: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="travelerName">Full Name</Label>
                <Input
                  id="travelerName"
                  value={bookingDetails.travelerName}
                  onChange={(e) => setBookingDetails({ ...bookingDetails, travelerName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={bookingDetails.email}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={bookingDetails.phone}
                    onChange={(e) => setBookingDetails({ ...bookingDetails, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {bookingStep === "payment" && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Select Payment Method</Label>

              {/* UPI Payment Section */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleSection("upi")}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                      <PaymentLogos.UPI />
                    </div>
                    <div>
                      <h4 className="font-semibold">UPI</h4>
                      <p className="text-sm text-muted-foreground">Pay via UPI apps, QR code</p>
                    </div>
                  </div>
                  {expandedSections.upi ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>

                {expandedSections.upi && (
                  <div className="border-t p-4">
                    <div className="mb-4">
                      <h5 className="mb-2 font-medium">Select UPI App</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={paymentDetails.selectedUpiApp === "google-pay" ? "default" : "outline"}
                          onClick={() => setPaymentDetails({ ...paymentDetails, selectedUpiApp: "google-pay" })}
                          className="flex-col h-auto py-3"
                        >
                          <PaymentLogos.GooglePay />
                          <span className="text-xs mt-1">Google Pay</span>
                        </Button>

                        <Button
                          type="button"
                          variant={paymentDetails.selectedUpiApp === "phonepe" ? "default" : "outline"}
                          onClick={() => setPaymentDetails({ ...paymentDetails, selectedUpiApp: "phonepe" })}
                          className="flex-col h-auto py-3"
                        >
                          <PaymentLogos.PhonePe />
                          <span className="text-xs mt-1">PhonePe</span>
                        </Button>

                        <Button
                          type="button"
                          variant={paymentDetails.selectedUpiApp === "paytm" ? "default" : "outline"}
                          onClick={() => setPaymentDetails({ ...paymentDetails, selectedUpiApp: "paytm" })}
                          className="flex-col h-auto py-3"
                        >
                          <PaymentLogos.Paytm />
                          <span className="text-xs mt-1">Paytm</span>
                        </Button>

                        <Button
                          type="button"
                          variant={paymentDetails.selectedUpiApp === "bhim" ? "default" : "outline"}
                          onClick={() => setPaymentDetails({ ...paymentDetails, selectedUpiApp: "bhim" })}
                          className="flex-col h-auto py-3"
                        >
                          <PaymentLogos.BHIM />
                          <span className="text-xs mt-1">BHIM</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="upiId">Enter UPI ID</Label>
                      <Input
                        id="upiId"
                        placeholder="yourname@upi"
                        value={paymentDetails.upiId}
                        onChange={(e) => setPaymentDetails({ ...paymentDetails, upiId: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Example: 9876543210@ybl, username@oksbi</p>
                    </div>

                    <div className="mt-4 flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowUpiQr(true)}
                        className="gap-2"
                      >
                        <QrCode className="h-4 w-4" />
                        Pay via QR Code
                      </Button>

                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          if (!paymentDetails.upiId) {
                            alert("Please enter your UPI ID")
                            return
                          }
                          alert(`Opening ${paymentDetails.selectedUpiApp} app for payment...`)
                        }}
                      >
                        Pay via {paymentDetails.selectedUpiApp === "google-pay" ? "Google Pay" :
                          paymentDetails.selectedUpiApp === "phonepe" ? "PhonePe" :
                            paymentDetails.selectedUpiApp === "paytm" ? "Paytm" :
                              paymentDetails.selectedUpiApp === "bhim" ? "BHIM" : "UPI App"}
                      </Button>
                    </div>

                    {showUpiQr && (
                      <div className="mt-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Scan QR Code to Pay</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowUpiQr(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-col items-center justify-center p-4">
                          <div className="mb-4 h-48 w-48 border-4 border-white bg-white p-2">
                            <div className="flex h-full w-full items-center justify-center bg-gray-100">
                              <QrCode className="h-32 w-32 text-gray-400" />
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Scan this QR code with any UPI app to pay {formatPrice((selectedItem?.price || 0) * 1.1, selectedItem?.currency || "INR")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card Payment Section */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleSection("card")}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Credit/Debit Card</h4>
                      <p className="text-sm text-muted-foreground">Visa, MasterCard, RuPay, Amex</p>
                    </div>
                  </div>
                  {expandedSections.card ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>

                {expandedSections.card && (
                  <div className="border-t p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Button
                        type="button"
                        variant={paymentDetails.subMethod === "credit-card" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentDetails({ ...paymentDetails, subMethod: "credit-card" })}
                      >
                        Credit Card
                      </Button>
                      <Button
                        type="button"
                        variant={paymentDetails.subMethod === "debit-card" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPaymentDetails({ ...paymentDetails, subMethod: "debit-card" })}
                      >
                        Debit Card
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <div className="relative">
                          <Input
                            id="cardNumber"
                            placeholder="1234 5678 9012 3456"
                            value={paymentDetails.cardNumber}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, cardNumber: e.target.value })}
                            className="pl-10"
                          />
                          <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="cardHolder">Card Holder Name</Label>
                          <Input
                            id="cardHolder"
                            placeholder="John Doe"
                            value={paymentDetails.cardHolder}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, cardHolder: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="expiry">Expiry Date</Label>
                            <Input
                              id="expiry"
                              placeholder="MM/YY"
                              value={paymentDetails.expiry}
                              onChange={(e) => setPaymentDetails({ ...paymentDetails, expiry: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cvv">CVV</Label>
                            <Input
                              id="cvv"
                              placeholder="123"
                              type="password"
                              value={paymentDetails.cvv}
                              onChange={(e) => setPaymentDetails({ ...paymentDetails, cvv: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-8 w-12 rounded border bg-gray-50 flex items-center justify-center">
                          <PaymentLogos.Visa />
                        </div>
                        <div className="h-8 w-12 rounded border bg-orange-50 flex items-center justify-center">
                          <PaymentLogos.Mastercard />
                        </div>
                        <div className="h-8 w-12 rounded border bg-blue-50 flex items-center justify-center">
                          <PaymentLogos.RuPay />
                        </div>
                        <div className="h-8 w-12 rounded border bg-green-50 flex items-center justify-center">
                          <PaymentLogos.Amex />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Net Banking Section */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleSection("netbanking")}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                      <PaymentLogos.NetBanking />
                    </div>
                    <div>
                      <h4 className="font-semibold">Net Banking</h4>
                      <p className="text-sm text-muted-foreground">All major Indian banks</p>
                    </div>
                  </div>
                  {expandedSections.netbanking ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>

                {expandedSections.netbanking && (
                  <div className="border-t p-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="netBankingBank">Select Your Bank</Label>
                        <Select
                          value={paymentDetails.netBankingBank}
                          onValueChange={(value) => setPaymentDetails({ ...paymentDetails, netBankingBank: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose your bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {banks.map((bank) => (
                              <SelectItem key={bank.code} value={bank.name}>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{bank.logo}</span>
                                  <span>{bank.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="otp">OTP Verification</Label>
                        <div className="flex gap-2">
                          <Input
                            id="otp"
                            placeholder="Enter 6-digit OTP"
                            value={paymentDetails.otp}
                            onChange={(e) => setPaymentDetails({ ...paymentDetails, otp: e.target.value })}
                            maxLength={6}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (!paymentDetails.netBankingBank) {
                                alert("Please select your bank first")
                                return
                              }
                              alert(`OTP sent to your registered mobile number for ${paymentDetails.netBankingBank}`)
                            }}
                          >
                            Send OTP
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">OTP will be sent to your registered mobile number</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Digital Wallets Section */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleSection("wallet")}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                      <PaymentLogos.Wallet />
                    </div>
                    <div>
                      <h4 className="font-semibold">Digital Wallets</h4>
                      <p className="text-sm text-muted-foreground">Google Pay, PhonePe, Paytm, Amazon Pay</p>
                    </div>
                  </div>
                  {expandedSections.wallet ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>

                {expandedSections.wallet && (
                  <div className="border-t p-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={paymentDetails.subMethod === "google-pay" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentDetails({ ...paymentDetails, subMethod: "google-pay" })
                          alert("Redirecting to Google Pay...")
                        }}
                        className="flex-col h-auto py-4"
                      >
                        <PaymentLogos.GooglePay />
                        <span className="mt-2">Google Pay</span>
                      </Button>

                      <Button
                        type="button"
                        variant={paymentDetails.subMethod === "phonepe" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentDetails({ ...paymentDetails, subMethod: "phonepe" })
                          alert("Redirecting to PhonePe...")
                        }}
                        className="flex-col h-auto py-4"
                      >
                        <PaymentLogos.PhonePe />
                        <span className="mt-2">PhonePe</span>
                      </Button>

                      <Button
                        type="button"
                        variant={paymentDetails.subMethod === "paytm" ? "default" : "outline"}
                        onClick={() => {
                          setPaymentDetails({ ...paymentDetails, subMethod: "paytm" })
                          alert("Redirecting to Paytm...")
                        }}
                        className="flex-col h-auto py-4"
                      >
                        <PaymentLogos.Paytm />
                        <span className="mt-2">Paytm</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => alert("Coming soon")}
                        className="flex-col h-auto py-4"
                      >
                        <PaymentLogos.AmazonPay />
                        <span className="mt-2">Amazon Pay</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cash/COD Section */}
              <div className="rounded-lg border">
                <button
                  type="button"
                  onClick={() => toggleSection("cash")}
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <PaymentLogos.Cash />
                    </div>
                    <div>
                      <h4 className="font-semibold">Cash on Arrival</h4>
                      <p className="text-sm text-muted-foreground">Pay when you check-in</p>
                    </div>
                  </div>
                  {expandedSections.cash ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>

                {expandedSections.cash && (
                  <div className="border-t p-4">
                    <div className="space-y-4">
                      <div className="rounded-lg bg-yellow-50 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-800">Important Note</p>
                            <p className="text-sm text-yellow-700">
                              Cash payment must be made at the hotel reception during check-in.
                              Please carry exact change. A 2% convenience fee will be applied.
                            </p>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          if (confirm("Confirm cash payment? You'll pay at the hotel.")) {
                            alert("Booking confirmed with cash payment option")
                          }
                        }}
                      >
                        Confirm Cash Payment
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="rounded-lg border p-4">
                <h4 className="mb-3 font-semibold">Order Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item</span>
                    <span>{formatPrice(selectedItem?.price || 0, selectedItem?.currency || "USD")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Fee</span>
                    <span>{formatPrice((selectedItem?.price || 0) * 0.05, selectedItem?.currency || "USD")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax (5%)</span>
                    <span>{formatPrice((selectedItem?.price || 0) * 0.05, selectedItem?.currency || "USD")}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-bold">
                    <span>Total Amount</span>
                    <span>{formatPrice((selectedItem?.price || 0) * 1.1, selectedItem?.currency || "USD")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {bookingStep === "confirmation" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
              <h3 className="mb-2 text-xl font-bold">Booking Confirmed!</h3>
              <p className="mb-4 text-muted-foreground">
                Your booking has been successfully processed. A confirmation email has been sent to {bookingDetails.email}.
              </p>
              <div className="rounded-lg border p-4 text-left w-full">
                <h4 className="mb-2 font-semibold">Payment Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span className="font-medium">
                      {paymentDetails.method === "upi" ? "UPI" :
                        paymentDetails.method === "card" ? `${paymentDetails.subMethod === "credit-card" ? "Credit" : "Debit"} Card` :
                          paymentDetails.method === "netbanking" ? "Net Banking" :
                            paymentDetails.method === "wallet" ? "Digital Wallet" : "Cash on Arrival"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transaction ID:</span>
                    <span className="font-mono">TXN{Date.now().toString().slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount Paid:</span>
                    <span className="font-bold">{formatPrice((selectedItem?.price || 0) * 1.1, selectedItem?.currency || "USD")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {bookingStep === "details" && (
              <>
                <Button variant="outline" onClick={() => setShowBookingDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleBookingSubmit}>
                  Continue to Payment
                </Button>
              </>
            )}

            {bookingStep === "payment" && (
              <>
                <Button variant="outline" onClick={() => setBookingStep("details")}>
                  Back
                </Button>
                <Button onClick={handleBookingSubmit}>
                  Complete Payment
                </Button>
              </>
            )}

            {bookingStep === "confirmation" && (
              <Button onClick={() => setShowBookingDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

