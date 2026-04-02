import { NextResponse } from "next/server"
import { amadeusGet, isAmadeusConfigured, resolveCityCode } from "@/lib/amadeus"
import { getCache, setCache } from "@/lib/api-cache"
import { generateDemoHotels } from "@/lib/demo-inventory"

const HOTELS_TTL_MS = 15 * 60 * 1000

type LiveHotel = {
  id: string
  name: string
  city: string
  country?: string
  rating: number
  reviews: number
  price: number
  amenities: string[]
  hotelType: string
  image: string
  isDemo: boolean
  source: "LIVE" | "DEMO"
}

function toNumber(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function scoreHotel(h: LiveHotel): number {
  return h.rating * 1000 - h.price + h.reviews * 0.05
}

function normalizeHotels(
  offers: any[],
  city: string,
  country?: string
): LiveHotel[] {
  return offers.map((item, idx) => {
    const firstOffer = item.offers?.[0]
    const firstRoom = firstOffer?.room
    const price = Number(firstOffer?.price?.total || 0)
    const rating = Number(item.hotel?.rating || 4.0)
    const amenities = Array.isArray(item.hotel?.amenities) ? item.hotel.amenities : []
    return {
      id: item.hotel?.hotelId || `live-${city}-${idx}`,
      name: item.hotel?.name || `${city} Hotel`,
      city,
      country,
      rating: Number.isFinite(rating) ? rating : 4.0,
      reviews: 150 + (idx % 500),
      price: Number.isFinite(price) && price > 0 ? price : 120 + (idx % 200),
      amenities,
      hotelType: firstRoom?.typeEstimated?.category || "Hotel",
      image: "/placeholder.svg",
      isDemo: false,
      source: "LIVE",
    }
  })
}

function applyFilters(hotels: LiveHotel[], searchParams: URLSearchParams): LiveHotel[] {
  const minPrice = toNumber(searchParams.get("minPrice"), 0)
  const maxPrice = toNumber(searchParams.get("maxPrice"), Number.MAX_SAFE_INTEGER)
  const minRating = toNumber(searchParams.get("minRating"), 0)
  const amenities = (searchParams.get("amenities") || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  const sort = searchParams.get("sort") || "recommended"

  let filtered = hotels.filter((h) => h.price >= minPrice && h.price <= maxPrice && h.rating >= minRating)
  if (amenities.length > 0) {
    filtered = filtered.filter((h) => {
      const hotelAmenitySet = new Set((h.amenities || []).map((a) => a.toLowerCase()))
      return amenities.every((a) => hotelAmenitySet.has(a))
    })
  }

  if (sort === "price-low") filtered = filtered.sort((a, b) => a.price - b.price)
  else if (sort === "price-high") filtered = filtered.sort((a, b) => b.price - a.price)
  else if (sort === "rating") filtered = filtered.sort((a, b) => b.rating - a.rating)
  else filtered = filtered.sort((a, b) => scoreHotel(b) - scoreHotel(a))

  return filtered
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const city = (url.searchParams.get("city") || "").trim()
    const country = (url.searchParams.get("country") || "").trim() || undefined
    const checkInDate = url.searchParams.get("checkInDate") || undefined
    const checkOutDate = url.searchParams.get("checkOutDate") || undefined
    const adults = toNumber(url.searchParams.get("adults"), 1)
    const budgetLevel = (url.searchParams.get("budgetLevel") || "medium").toLowerCase()
    const page = Math.max(1, toNumber(url.searchParams.get("page"), 1))
    const limit = Math.min(50, Math.max(10, toNumber(url.searchParams.get("limit"), 20)))
    const inventoryTarget = Math.max(100, toNumber(url.searchParams.get("inventoryTarget"), 120))

    if (!city) {
      return NextResponse.json({ error: "city is required" }, { status: 400 })
    }

    const cacheKey = `hotels:${url.searchParams.toString()}`
    const cached = getCache<any>(cacheKey)
    if (cached) return NextResponse.json(cached)

    let hotels: LiveHotel[] = []
    let mode: "LIVE" | "DEMO" | "MIXED" = "LIVE"
    let message = ""
    let resolvedCityCode: string | null = null

    if (isAmadeusConfigured()) {
      try {
        resolvedCityCode = await resolveCityCode(city, country)
        if (resolvedCityCode) {
          type HotelsByCity = { data: Array<{ hotelId: string }> }
          const hotelIdSet = new Set<string>()
          let offset = 0
          const pageLimit = 200

          for (let attempt = 0; attempt < 6 && hotelIdSet.size < 260; attempt++) {
            const listRes = await amadeusGet<HotelsByCity>("/v1/reference-data/locations/hotels/by-city", {
              cityCode: resolvedCityCode,
              radius: 70,
              radiusUnit: "KM",
              hotelSource: "ALL",
              "page[limit]": pageLimit,
              "page[offset]": offset,
            })
            const batch = listRes.data || []
            for (const h of batch) {
              if (h.hotelId) hotelIdSet.add(h.hotelId)
            }
            if (batch.length < pageLimit) break
            offset += pageLimit
          }

          const hotelIds = Array.from(hotelIdSet).slice(0, 240)
          const offerChunks: any[] = []
          for (let i = 0; i < hotelIds.length; i += 20) {
            const chunk = hotelIds.slice(i, i + 20)
            type HotelOffers = { data: any[] }
            const offers = await amadeusGet<HotelOffers>("/v3/shopping/hotel-offers", {
              hotelIds: chunk.join(","),
              adults,
              roomQuantity: 1,
              checkInDate,
              checkOutDate,
              bestRateOnly: "true",
            })
            offerChunks.push(...(offers.data || []))
          }
          hotels = normalizeHotels(offerChunks, city, country)
        } else {
          mode = "DEMO"
          message = "Demo inventory (city code not found in live provider)"
        }
      } catch (error: any) {
        mode = "DEMO"
        message = `Live hotel inventory unavailable: ${error?.message || "API error"}`
      }
    } else {
      mode = "DEMO"
      message = "Demo inventory (API not connected)"
    }

    if (hotels.length < inventoryTarget) {
      const topUpCount = Math.max(0, inventoryTarget - hotels.length)
      const demoTopUp = generateDemoHotels(city, country, topUpCount, budgetLevel).map((h) => ({
        ...h,
      }))
      hotels = [...hotels, ...demoTopUp]
      if (mode === "LIVE") {
        mode = "MIXED"
        message = "Live inventory supplemented with demo inventory to maintain at least 100 hotels."
      } else if (!message) {
        message = "Demo inventory (API not connected)"
      }
    }

    const filtered = applyFilters(hotels, url.searchParams)
    const start = (page - 1) * limit
    const paged = filtered.slice(start, start + limit)
    const response = {
      city,
      resolvedCityCode,
      country: country || null,
      mode,
      message,
      isDemo: mode !== "LIVE",
      total: filtered.length,
      page,
      limit,
      hasMore: start + limit < filtered.length,
      results: paged,
    }

    setCache(cacheKey, response, HOTELS_TTL_MS)
    return NextResponse.json(response)
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch hotels" }, { status: 500 })
  }
}
