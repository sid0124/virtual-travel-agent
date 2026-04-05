import { NextResponse } from "next/server"
import { clampLimit, isRapidApiConfigured, searchHotels } from "@/lib/rapidapi-hotels"
import { convertCurrencyValue, DEFAULT_CURRENCY } from "@/lib/currency"
import { generateDemoHotels } from "@/lib/demo-inventory"

export const runtime = "nodejs"

type HotelReason = "quota_exceeded" | "rate_limited" | "invalid_request" | "unknown"

function toNumber(value: string | null, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeCity(city: string) {
  return city.trim().toLowerCase().replace(/\s+/g, " ")
}

function classifyHotelError(message: string): HotelReason {
  const m = message.toLowerCase()
  if (m.includes("quota") || m.includes("monthly") || m.includes("plan") || m.includes("subscription")) return "quota_exceeded"
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many request")) return "rate_limited"
  if (m.includes("400") || m.includes("invalid") || m.includes("required")) return "invalid_request"
  return "unknown"
}

function buildDemoHotelsPage(city: string, budgetLevel: string, page: number, limit: number) {
  const all = generateDemoHotels(city, undefined, 120, budgetLevel).map((h, idx) => ({
    id: h.id || `demo-${normalizeCity(city)}-${idx + 1}`,
    name: h.name,
    city: h.city,
    country: h.country || "",
    rating: h.rating ?? null,
    reviewCount: h.reviews ?? null,
    pricePerNight: h.price != null ? convertCurrencyValue(h.price, "USD", DEFAULT_CURRENCY, 50) : null,
    currency: DEFAULT_CURRENCY,
    imageUrl: h.image || "/placeholder.svg",
    address: null,
    amenities: h.amenities || ["wifi"],
    distanceKm: null,
    demo: true,
    isDemo: true,
    source: "DEMO" as const,
  }))

  const start = (page - 1) * limit
  const hotels = all.slice(start, start + limit)
  return {
    total: all.length,
    hasMore: start + limit < all.length,
    hotels,
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const city = (searchParams.get("city") || "").trim()
    const checkIn = (searchParams.get("checkIn") || "").trim()
    const checkOut = (searchParams.get("checkOut") || "").trim()
    const adults = Math.max(1, toNumber(searchParams.get("adults"), 1))
    const page = Math.max(1, toNumber(searchParams.get("page"), 1))
    const limit = clampLimit(toNumber(searchParams.get("limit"), 25))
    const widerSearch = ["1", "true", "yes"].includes((searchParams.get("widerSearch") || "").toLowerCase())
    const budgetLevel = (searchParams.get("budgetLevel") || "medium").toLowerCase()

    if (!city) {
      return NextResponse.json({ ok: false, mode: "live", reason: "invalid_request", message: "city is required", hotels: [] }, { status: 400 })
    }

    if (!checkIn || !checkOut) {
      return NextResponse.json({ ok: false, mode: "live", reason: "invalid_request", message: "checkIn and checkOut are required", hotels: [] }, { status: 400 })
    }

    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
      return NextResponse.json({ ok: false, mode: "live", reason: "invalid_request", message: "checkIn/checkOut must be YYYY-MM-DD", hotels: [] }, { status: 400 })
    }

    if (!isRapidApiConfigured()) {
      const demo = buildDemoHotelsPage(city, budgetLevel, page, limit)
      return NextResponse.json({
        ok: false,
        mode: "demo",
        reason: "unknown",
        message: "Live hotel inventory unavailable (API not connected). Showing demo hotels.",
        details: "Missing RAPIDAPI_KEY or RAPIDAPI_HOST",
        city,
        page,
        limit,
        total: demo.total,
        hasMore: demo.hasMore,
        hotels: demo.hotels,
      })
    }

    const response = await searchHotels({
      city,
      checkIn,
      checkOut,
      adults,
      page,
      limit,
      widerSearch,
    })

    if (!response.destination) {
      const demo = buildDemoHotelsPage(city, budgetLevel, page, limit)
      return NextResponse.json({
        ok: false,
        mode: "demo",
        reason: "unknown",
        message: "City not found in live provider. Showing demo hotels.",
        city,
        page,
        limit,
        total: demo.total,
        hasMore: demo.hasMore,
        hotels: demo.hotels,
      })
    }

    return NextResponse.json({
      ok: true,
      mode: "live",
      reason: null,
      message: "Live hotels loaded",
      city,
      page,
      limit,
      total: response.total,
      hasMore: response.hasMore,
      hotels: response.hotels.map((hotel) => ({
        ...hotel,
        pricePerNight:
          typeof hotel.pricePerNight === "number"
            ? convertCurrencyValue(hotel.pricePerNight, hotel.currency || "USD", DEFAULT_CURRENCY, 50)
            : hotel.pricePerNight,
        currency: DEFAULT_CURRENCY,
      })),
    })
  } catch (error: any) {
    const { searchParams } = new URL(req.url)
    const city = (searchParams.get("city") || "Destination").trim()
    const page = Math.max(1, toNumber(searchParams.get("page"), 1))
    const limit = clampLimit(toNumber(searchParams.get("limit"), 25))
    const budgetLevel = (searchParams.get("budgetLevel") || "medium").toLowerCase()
    const details = error?.message || "Unknown provider error"
    const reason = classifyHotelError(details)
    const demo = buildDemoHotelsPage(city, budgetLevel, page, limit)

    return NextResponse.json({
      ok: false,
      mode: "demo",
      reason,
      message:
        reason === "quota_exceeded"
          ? "Live hotel inventory unavailable (RapidAPI quota exceeded). Showing demo hotels."
          : reason === "rate_limited"
            ? "Live hotel inventory unavailable (rate limited). Showing demo hotels."
            : "Live hotel inventory unavailable. Showing demo hotels.",
      details,
      city,
      page,
      limit,
      total: demo.total,
      hasMore: demo.hasMore,
      hotels: demo.hotels,
    })
  }
}
