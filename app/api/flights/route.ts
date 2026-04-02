import { NextResponse } from "next/server"
import { amadeusGet, isAmadeusConfigured, resolveAirportCode } from "@/lib/amadeus"
import { getCache, setCache } from "@/lib/api-cache"
import { generateDemoFlights } from "@/lib/demo-inventory"

const FLIGHTS_TTL_MS = 10 * 60 * 1000

type FlightItem = {
  id: string
  airline: string
  from: string
  to: string
  departure: string
  arrival: string
  duration: string
  price: number
  currency: string
  class: string
  stops: number
  durationMinutes: number
  isDemo: boolean
  source: "LIVE" | "DEMO"
}

function toNumber(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapBudgetToTravelClass(budgetLevel: string): string {
  if (budgetLevel === "premium") return "BUSINESS"
  if (budgetLevel === "medium") return "PREMIUM_ECONOMY"
  return "ECONOMY"
}

function isoToTime(iso: string | undefined): string {
  if (!iso) return "--:--"
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function durationMinutes(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  const hours = Number(match?.[1] || 0)
  const mins = Number(match?.[2] || 0)
  return hours * 60 + mins
}

function formatDuration(isoDuration: string): string {
  const mins = durationMinutes(isoDuration)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function inWindow(hour: number, window: string): boolean {
  if (window === "morning") return hour >= 5 && hour < 12
  if (window === "afternoon") return hour >= 12 && hour < 17
  if (window === "evening") return hour >= 17 && hour < 22
  if (window === "night") return hour >= 22 || hour < 5
  return true
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const originCity = (url.searchParams.get("origin") || "").trim()
    const destinationCity = (url.searchParams.get("dest") || "").trim()
    const departDate = (url.searchParams.get("depart") || "").trim()
    const returnDate = (url.searchParams.get("return") || "").trim() || undefined
    const adults = Math.max(1, toNumber(url.searchParams.get("adults"), 1))
    const budgetLevel = (url.searchParams.get("budgetLevel") || "medium").toLowerCase()
    const sort = (url.searchParams.get("sort") || "best").toLowerCase()
    const stopsFilter = (url.searchParams.get("stops") || "all").toLowerCase()
    const airlinesFilter = (url.searchParams.get("airlines") || "")
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean)
    const departureWindow = (url.searchParams.get("departureWindow") || "all").toLowerCase()

    if (!originCity || !destinationCity || !departDate) {
      return NextResponse.json({ error: "origin, dest and depart are required" }, { status: 400 })
    }

    const cacheKey = `flights:${url.searchParams.toString()}`
    const cached = getCache<any>(cacheKey)
    if (cached) return NextResponse.json(cached)

    let flights: FlightItem[] = []
    let mode: "LIVE" | "DEMO" = "LIVE"
    let message = ""
    let resolvedOriginCode: string | null = null
    let resolvedDestinationCode: string | null = null

    if (isAmadeusConfigured()) {
      try {
        resolvedOriginCode = await resolveAirportCode(originCity)
        resolvedDestinationCode = await resolveAirportCode(destinationCity)
        if (!resolvedOriginCode || !resolvedDestinationCode) {
          throw new Error("Could not resolve airport/city IATA codes")
        }

        type FlightOffersResponse = { data: any[] }
        const res = await amadeusGet<FlightOffersResponse>("/v2/shopping/flight-offers", {
          originLocationCode: resolvedOriginCode,
          destinationLocationCode: resolvedDestinationCode,
          departureDate: departDate,
          returnDate,
          adults,
          travelClass: mapBudgetToTravelClass(budgetLevel),
          currencyCode: "USD",
        })

        flights = (res.data || []).map((offer) => {
          const firstItinerary = offer.itineraries?.[0]
          const segments = firstItinerary?.segments || []
          const firstSegment = segments[0]
          const lastSegment = segments[segments.length - 1]
          const totalPrice = Number(offer.price?.grandTotal || offer.price?.total || 0)
          const validating = offer.validatingAirlineCodes?.[0] || firstSegment?.carrierCode || "N/A"
          return {
            id: offer.id,
            airline: validating,
            from: firstSegment?.departure?.iataCode || resolvedOriginCode,
            to: lastSegment?.arrival?.iataCode || resolvedDestinationCode,
            departure: isoToTime(firstSegment?.departure?.at),
            arrival: isoToTime(lastSegment?.arrival?.at),
            duration: formatDuration(firstItinerary?.duration || "PT0M"),
            durationMinutes: durationMinutes(firstItinerary?.duration || "PT0M"),
            price: Number.isFinite(totalPrice) ? totalPrice : 0,
            currency: offer.price?.currency || "USD",
            class: mapBudgetToTravelClass(budgetLevel).replace("_", " "),
            stops: Math.max(0, segments.length - 1),
            isDemo: false,
            source: "LIVE",
          }
        })
      } catch (error: any) {
        mode = "DEMO"
        message = `Live flights not enabled: ${error?.message || "API error"}`
      }
    } else {
      mode = "DEMO"
      message = "Live flights not enabled"
    }

    if (mode === "DEMO") {
      flights = generateDemoFlights(originCity, destinationCity, departDate, adults, budgetLevel, 10).map((f) => ({
        ...f,
        currency: "USD",
        durationMinutes: Number((f.duration.match(/(\d+)h/)?.[1] || 0)) * 60 + Number((f.duration.match(/(\d+)m/)?.[1] || 0)),
      }))
      if (!message) {
        message = "Live flights not enabled. Showing DEMO sample flights only."
      }
    }

    let filtered = flights
    if (stopsFilter !== "all") {
      if (stopsFilter === "0") filtered = filtered.filter((f) => f.stops === 0)
      else if (stopsFilter === "1") filtered = filtered.filter((f) => f.stops === 1)
      else if (stopsFilter === "2+") filtered = filtered.filter((f) => f.stops >= 2)
    }

    if (airlinesFilter.length > 0) {
      filtered = filtered.filter((f) => airlinesFilter.includes(f.airline.toUpperCase()))
    }

    if (departureWindow !== "all") {
      filtered = filtered.filter((f) => {
        const hour = Number(f.departure.split(":")[0] || 0)
        return inWindow(hour, departureWindow)
      })
    }

    if (sort === "cheapest") filtered = filtered.sort((a, b) => a.price - b.price)
    else if (sort === "fastest") filtered = filtered.sort((a, b) => a.durationMinutes - b.durationMinutes)
    else filtered = filtered.sort((a, b) => a.price - b.price + (a.stops - b.stops) * 25)

    const response = {
      mode,
      message,
      isDemo: mode !== "LIVE",
      origin: originCity,
      destination: destinationCity,
      resolvedOriginCode,
      resolvedDestinationCode,
      departDate,
      returnDate: returnDate || null,
      total: filtered.length,
      results: filtered,
    }

    setCache(cacheKey, response, FLIGHTS_TTL_MS)
    return NextResponse.json(response)
  } catch (error: any) {
    const url = new URL(req.url)
    const originCity = (url.searchParams.get("origin") || "").trim()
    const destinationCity = (url.searchParams.get("dest") || "").trim()
    const departDate = (url.searchParams.get("depart") || "").trim()
    const adults = Math.max(1, toNumber(url.searchParams.get("adults"), 1))
    const budgetLevel = (url.searchParams.get("budgetLevel") || "medium").toLowerCase()
    const message = error?.message || "Failed to fetch flights"
    const demo = generateDemoFlights(originCity || "Origin", destinationCity || "Destination", departDate || new Date().toISOString().slice(0, 10), adults, budgetLevel, 10).map((f) => ({
      ...f,
      currency: "USD",
      durationMinutes: Number((f.duration.match(/(\\d+)h/)?.[1] || 0)) * 60 + Number((f.duration.match(/(\\d+)m/)?.[1] || 0)),
    }))

    return NextResponse.json({
      mode: "DEMO",
      isDemo: true,
      message: `Live flights unavailable (${message}). Showing DEMO flights.`,
      origin: originCity,
      destination: destinationCity,
      departDate: departDate || null,
      returnDate: null,
      total: demo.length,
      results: demo,
    })
  }
}
