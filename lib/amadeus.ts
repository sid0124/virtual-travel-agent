import { getCache, setCache } from "@/lib/api-cache"

const AMADEUS_BASE_URL = "https://test.api.amadeus.com"
const TOKEN_CACHE_KEY = "amadeus:oauth_token"

type TokenResponse = {
  access_token: string
  expires_in: number
}

type AmadeusLocation = {
  subType?: "CITY" | "AIRPORT" | string
  iataCode?: string
  name?: string
  address?: {
    cityName?: string
    countryCode?: string
  }
}

export function isAmadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_API_KEY && process.env.AMADEUS_API_SECRET)
}

async function getAccessToken(): Promise<string> {
  const cached = getCache<string>(TOKEN_CACHE_KEY)
  if (cached) return cached

  const apiKey = process.env.AMADEUS_API_KEY
  const apiSecret = process.env.AMADEUS_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error("Amadeus API credentials are missing")
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: apiKey,
    client_secret: apiSecret,
  })

  const res = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Amadeus token request failed: ${errorText}`)
  }

  const json = (await res.json()) as TokenResponse
  const ttl = Math.max(30, (json.expires_in || 1800) - 60) * 1000
  setCache(TOKEN_CACHE_KEY, json.access_token, ttl)
  return json.access_token
}

export async function amadeusGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = await getAccessToken()
  const url = new URL(`${AMADEUS_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Amadeus request failed (${path}): ${errorText}`)
  }

  return (await res.json()) as T
}

function pickBestLocation(locations: AmadeusLocation[], city: string, country?: string): AmadeusLocation | null {
  if (!locations?.length) return null
  const cityLower = city.toLowerCase()
  const countryUpper = normalizeCountryCode(country)

  const exact = locations.find((loc) => {
    const sameCity = (loc.address?.cityName || "").toLowerCase() === cityLower
    const sameCountry = countryUpper ? loc.address?.countryCode?.toUpperCase() === countryUpper : true
    return sameCity && sameCountry && loc.iataCode
  })
  if (exact) return exact

  return locations.find((loc) => Boolean(loc.iataCode)) || null
}

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  uk: "GB",
  "united kingdom": "GB",
  uae: "AE",
  "united arab emirates": "AE",
  india: "IN",
  france: "FR",
  italy: "IT",
  spain: "ES",
  germany: "DE",
  japan: "JP",
  china: "CN",
  australia: "AU",
  canada: "CA",
  brazil: "BR",
  greece: "GR",
  peru: "PE",
  cambodia: "KH",
}

const CITY_IATA_FALLBACK: Record<string, string> = {
  "new york": "NYC",
  "new york city": "NYC",
  london: "LON",
  paris: "PAR",
  tokyo: "TYO",
  rome: "ROM",
  barcelona: "BCN",
  dubai: "DXB",
  mumbai: "BOM",
  delhi: "DEL",
  bengaluru: "BLR",
  bangalore: "BLR",
  agra: "AGR",
  beijing: "BJS",
  sydney: "SYD",
  athens: "ATH",
  "rio de janeiro": "RIO",
  cusco: "CUZ",
  "siem reap": "REP",
}

function normalizeCountryCode(country?: string): string | undefined {
  if (!country) return undefined
  const trimmed = country.trim()
  if (trimmed.length === 2) return trimmed.toUpperCase()
  return COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()]
}

export async function resolveAirportOrCityCode(
  city: string,
  country?: string,
  subType: "CITY,AIRPORT" | "CITY" | "AIRPORT" = "CITY,AIRPORT"
): Promise<string | null> {
  type LocationsResponse = { data: AmadeusLocation[] }
  try {
    const res = await amadeusGet<LocationsResponse>("/v1/reference-data/locations", {
      subType,
      keyword: city,
      view: "LIGHT",
    })
    const best = pickBestLocation(res.data || [], city, country)
    if (best?.iataCode) return best.iataCode
  } catch {
    // fall through to deterministic fallback below
  }

  return CITY_IATA_FALLBACK[city.trim().toLowerCase()] || null
}

export async function resolveCityCode(city: string, country?: string): Promise<string | null> {
  return resolveAirportOrCityCode(city, country, "CITY")
}

export async function resolveAirportCode(city: string, country?: string): Promise<string | null> {
  const code = await resolveAirportOrCityCode(city, country, "AIRPORT")
  if (code) return code
  return resolveAirportOrCityCode(city, country, "CITY,AIRPORT")
}
