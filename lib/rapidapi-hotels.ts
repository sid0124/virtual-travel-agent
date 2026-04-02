import { getCache, setCache } from "@/lib/api-cache"

const DESTINATION_TTL_MS = 24 * 60 * 60 * 1000
const SEARCH_TTL_MS = 10 * 60 * 1000
const PROVIDER_PAGE_SIZE = 20

export type RapidDestination = {
  destId: string
  searchType: string
  city: string
  country: string
}

export type NormalizedHotel = {
  id: string
  name: string
  city: string
  country: string
  rating: number | null
  reviewCount: number | null
  pricePerNight: number | null
  currency: string
  imageUrl: string | null
  address: string | null
  amenities: string[]
  distanceKm: number | null
}

type RapidDestinationItem = {
  dest_id?: string | number
  search_type?: string
  city_name?: string
  name?: string
  country?: string
  cc1?: string
  nr_hotels?: number
}

type RapidHotelItem = {
  hotel_id?: string | number
  accessibilityLabel?: string
  property?: {
    id?: string | number
    name?: string
    wishlistName?: string
    countryCode?: string
    reviewScore?: number
    reviewCount?: number
    currency?: string
    photoUrls?: string[]
    priceBreakdown?: {
      grossPrice?: {
        value?: number
        currency?: string
      }
    }
  }
}

type RapidSearchResponse = {
  data?: {
    hotels?: RapidHotelItem[]
    meta?: Array<{ title?: string }>
  }
}

function getRapidApiHeaders() {
  const key = process.env.RAPIDAPI_KEY
  const host = process.env.RAPIDAPI_HOST
  if (!key || !host) {
    return null
  }
  return {
    key,
    host,
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": host,
    },
  }
}

function regionNameFromCode(code: string | undefined): string {
  if (!code) return ""
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase())
    return name || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function normalizeCityName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
}

function cityAliases(city: string): string[] {
  const normalized = normalizeCityName(city)
  const aliases = new Set<string>([city.trim()])

  const known: Record<string, string[]> = {
    "new york city": ["New York", "NYC", "Manhattan"],
    nyc: ["New York City", "New York"],
    "los angeles": ["LA", "Los Angeles, California"],
    la: ["Los Angeles"],
    "san francisco": ["SF", "San Francisco Bay Area"],
    sf: ["San Francisco"],
    "washington dc": ["Washington", "Washington, D.C.", "DC"],
    dc: ["Washington, D.C.", "Washington DC"],
  }

  ;(known[normalized] || []).forEach((v) => aliases.add(v))
  if (normalized.endsWith(" city")) aliases.add(city.replace(/\s+city$/i, ""))
  if (normalized.includes(",")) aliases.add(city.split(",")[0].trim())

  const tokens = city.trim().split(/\s+/)
  if (tokens.length > 1) aliases.add(tokens[0])

  return Array.from(aliases).filter(Boolean)
}

function buildDestinationCacheKey(city: string, widerSearch: boolean) {
  return `rapidapi:hotel-destination:${normalizeCityName(city)}:${widerSearch ? "w1" : "w0"}`
}

function buildSearchCacheKey(input: {
  city: string
  checkIn: string
  checkOut: string
  adults: number
  page: number
  limit: number
  widerSearch: boolean
}) {
  return `rapidapi:hotel-search:${normalizeCityName(input.city)}:${input.checkIn}:${input.checkOut}:${input.adults}:${input.page}:${input.limit}:${input.widerSearch ? "w1" : "w0"}`
}

async function rapidGetJson<T>(path: string, params: URLSearchParams): Promise<T> {
  const config = getRapidApiHeaders()
  if (!config) {
    throw new Error("RapidAPI credentials are missing")
  }

  const url = `https://${config.host}${path}?${params.toString()}`
  const res = await fetch(url, {
    method: "GET",
    headers: config.headers,
    cache: "no-store",
  })

  const body = await res.text()
  let parsed: any = null
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    throw new Error(`Provider returned invalid JSON (${res.status})`)
  }

  if (!res.ok) {
    const message = parsed?.message || parsed?.error || `RapidAPI request failed (${res.status})`
    throw new Error(String(message))
  }

  return parsed as T
}

export async function resolveDestination(city: string, widerSearch: boolean): Promise<RapidDestination | null> {
  const cacheKey = buildDestinationCacheKey(city, widerSearch)
  const cached = getCache<RapidDestination>(cacheKey)
  if (cached) return cached

  const queries = widerSearch ? cityAliases(city) : [city.trim()]

  for (const query of queries) {
    const params = new URLSearchParams({ query })
    const payload = await rapidGetJson<{ data?: RapidDestinationItem[] }>("/api/v1/hotels/searchDestination", params)
    const candidates = (payload.data || []).filter((d) => d.dest_id && d.search_type)

    const cityMatch = candidates.find((d) => (d.search_type || "").toLowerCase() === "city")
    const best = cityMatch || candidates[0]
    if (!best) continue

    const destination: RapidDestination = {
      destId: String(best.dest_id),
      searchType: best.search_type || "city",
      city: best.city_name || best.name || city,
      country: best.country || regionNameFromCode(best.cc1) || "",
    }

    setCache(cacheKey, destination, DESTINATION_TTL_MS)
    return destination
  }

  return null
}

function parseTotal(meta: Array<{ title?: string }> | undefined): number | null {
  if (!meta || !meta[0]?.title) return null
  const match = meta[0].title.match(/([\d,]+)\s+properties/i)
  if (!match) return null
  const value = Number(match[1].replace(/,/g, ""))
  return Number.isFinite(value) ? value : null
}

function extractDistanceKm(label: string | undefined): number | null {
  if (!label) return null
  const kmMatch = label.match(/([\d.]+)\s*km from downtown/i)
  if (kmMatch) {
    const km = Number(kmMatch[1])
    return Number.isFinite(km) ? km : null
  }

  const meterMatch = label.match(/([\d.]+)\s*m from downtown/i)
  if (meterMatch) {
    const meters = Number(meterMatch[1])
    if (!Number.isFinite(meters)) return null
    return Number((meters / 1000).toFixed(2))
  }

  return null
}

function extractAmenities(label: string | undefined): string[] {
  if (!label) return []
  const l = label.toLowerCase()
  const found: string[] = []
  const rules: Array<[string, string]> = [
    ["wifi", "wifi"],
    ["wi-fi", "wifi"],
    ["pool", "pool"],
    ["spa", "spa"],
    ["breakfast", "breakfast"],
    ["gym", "gym"],
    ["fitness", "gym"],
  ]

  for (const [needle, mapped] of rules) {
    if (l.includes(needle) && !found.includes(mapped)) found.push(mapped)
  }

  return found
}

function normalizeHotel(item: RapidHotelItem, fallbackCity: string, fallbackCountry: string): NormalizedHotel {
  const p = item.property || {}
  const price = p.priceBreakdown?.grossPrice?.value
  const currency = p.priceBreakdown?.grossPrice?.currency || p.currency || "USD"

  return {
    id: String(item.hotel_id || p.id || `${fallbackCity}-${(p.name || "hotel").replace(/\s+/g, "-").toLowerCase()}`),
    name: p.name || "Hotel",
    city: p.wishlistName || fallbackCity,
    country: regionNameFromCode(p.countryCode) || fallbackCountry || "",
    rating: typeof p.reviewScore === "number" ? p.reviewScore : null,
    reviewCount: typeof p.reviewCount === "number" ? p.reviewCount : null,
    pricePerNight: typeof price === "number" ? price : null,
    currency,
    imageUrl: Array.isArray(p.photoUrls) && p.photoUrls.length > 0 ? p.photoUrls[0] : null,
    address: null,
    amenities: extractAmenities(item.accessibilityLabel),
    distanceKm: extractDistanceKm(item.accessibilityLabel),
  }
}

export async function searchHotels(input: {
  city: string
  checkIn: string
  checkOut: string
  adults: number
  page: number
  limit: number
  widerSearch: boolean
}) {
  const cacheKey = buildSearchCacheKey(input)
  const cached = getCache<{ destination: RapidDestination | null; hotels: NormalizedHotel[]; total: number | null; hasMore: boolean }>(cacheKey)
  if (cached) return cached

  const destination = await resolveDestination(input.city, input.widerSearch)
  if (!destination) {
    return { destination: null, hotels: [], total: null, hasMore: false }
  }

  const offset = (input.page - 1) * input.limit
  const firstProviderPage = Math.floor(offset / PROVIDER_PAGE_SIZE) + 1
  const lastNeededIndex = offset + input.limit
  const lastProviderPage = Math.ceil(lastNeededIndex / PROVIDER_PAGE_SIZE)

  const providerPages: RapidHotelItem[] = []
  let total: number | null = null

  for (let page = firstProviderPage; page <= lastProviderPage; page++) {
    const params = new URLSearchParams({
      dest_id: destination.destId,
      search_type: destination.searchType,
      arrival_date: input.checkIn,
      departure_date: input.checkOut,
      adults: String(Math.max(1, input.adults)),
      room_qty: "1",
      page_number: String(page),
      units: "metric",
      temperature_unit: "c",
      languagecode: "en-us",
      currency_code: "USD",
    })

    const payload = await rapidGetJson<RapidSearchResponse>("/api/v1/hotels/searchHotels", params)
    const batch = payload.data?.hotels || []
    providerPages.push(...batch)

    if (total == null) {
      total = parseTotal(payload.data?.meta)
    }

    if (batch.length < PROVIDER_PAGE_SIZE) break
  }

  const startIndex = offset - (firstProviderPage - 1) * PROVIDER_PAGE_SIZE
  const selected = providerPages.slice(startIndex, startIndex + input.limit)
  const normalized = selected.map((item) => normalizeHotel(item, destination.city || input.city, destination.country))

  const hasMore =
    total != null
      ? offset + normalized.length < total
      : providerPages.length >= startIndex + input.limit && normalized.length === input.limit

  const result = { destination, hotels: normalized, total, hasMore }
  setCache(cacheKey, result, SEARCH_TTL_MS)

  return result
}

export function isRapidApiConfigured() {
  return Boolean(process.env.RAPIDAPI_KEY && process.env.RAPIDAPI_HOST)
}

export function clampLimit(limit: number) {
  return Math.max(10, Math.min(50, limit))
}
