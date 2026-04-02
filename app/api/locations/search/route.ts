import { NextResponse } from "next/server"

export const runtime = "nodejs"

type LocationResult = {
  id: number
  name: string
  country: string
  countryCode: string
  state?: string
  lat: string
  lon: string
  population?: number
  kind: "country" | "city" | "place"
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreGeoapifyRow(row: any, query: string, country: string): number {
  const q = normalizeText(query)
  const name = normalizeText(row?.name || row?.formatted || "")
  const city = normalizeText(row?.city || row?.town || row?.village || row?.hamlet || "")
  const state = normalizeText(row?.state || "")
  const countryName = normalizeText(row?.country || "")
  const countryCode = normalizeText(row?.country_code || "")
  const target = normalizeText([name, city, state, countryName].join(" "))

  let score = 0
  if (name === q) score += 60
  if (name.startsWith(q)) score += 35
  if (name.includes(q)) score += 20
  if (target.includes(q)) score += 12

  const tokens = q.split(" ").filter(Boolean)
  for (const token of tokens) {
    if (name.includes(token)) score += 6
    else if (target.includes(token)) score += 3
  }

  if (country) {
    const c = normalizeText(country)
    if (countryCode === c) score += 30
    else score -= 8
  }

  // Landmark-specific disambiguation:
  // "Marine Drive" should prefer Mumbai, India unless user selected another country.
  if (q.includes("marine drive")) {
    if (city.includes("mumbai")) score += 200
    if (state.includes("maharashtra")) score += 120
    if (countryCode === "in") score += 40
  }

  const importance = Number(row?.rank?.importance)
  if (Number.isFinite(importance)) score += Math.max(0, Math.min(25, importance * 25))

  const rankPopularity = Number(row?.rank?.popularity)
  if (Number.isFinite(rankPopularity)) score += Math.max(0, Math.min(15, rankPopularity))

  return score
}

function scoreResult(row: LocationResult, query: string, country: string): number {
  const q = normalizeText(query)
  const name = normalizeText(row.name)
  const state = normalizeText(row.state || "")
  const countryName = normalizeText(row.country || "")
  const countryCode = normalizeText(row.countryCode || "")
  const target = normalizeText([name, state, countryName].join(" "))
  const requestedCountry = normalizeText(country)

  let score = 0
  if (name === q) score += 120
  if (name.startsWith(q)) score += 60
  if (name.includes(q)) score += 40
  if (target.includes(q)) score += 25

  const tokens = q.split(" ").filter(Boolean)
  for (const token of tokens) {
    if (name.includes(token)) score += 8
    else if (target.includes(token)) score += 4
  }

  if (requestedCountry) {
    if (countryCode === requestedCountry) score += 35
    else score -= 12
  } else if (countryCode === "in" || countryName.includes("india")) {
    // Default bias to India when user did not force country filter.
    score += 20
  }

  if (q.includes("marine drive")) {
    if (name.includes("marine drive")) score += 90
    if (state.includes("mumbai")) score += 150
  }
  if (q.includes("golden temple")) {
    if (name.includes("golden temple") || name.includes("harmandir")) score += 140
    if (state.includes("amritsar")) score += 90
  }
  if (q.includes("red fort") || q.includes("lal qila")) {
    if (name.includes("red fort") || name.includes("lal qila")) score += 150
    if (state.includes("delhi")) score += 120
  }

  const pop = typeof row.population === "number" ? row.population : 0
  score += Math.min(15, Math.log10(Math.max(1, pop)))

  return score
}

function dedupResults(items: LocationResult[]): LocationResult[] {
  const seen = new Set<string>()
  const out: LocationResult[] = []
  for (const item of items) {
    const key = `${normalizeText(item.name)}|${normalizeText(item.state || "")}|${normalizeText(item.country)}|${item.lat}|${item.lon}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function classifyGeoNamesKind(row: any): "country" | "city" | "place" {
  const featureClass = String(row?.fcl || row?.featureClass || "").toUpperCase()
  const featureCode = String(row?.fcode || row?.featureCode || "").toUpperCase()
  const pop = Number(row?.population || 0)

  if (featureCode === "PCLI" || featureCode.startsWith("PCL")) return "country"
  if (featureClass === "P") {
    // Keep city scope strict: capitals/admin seats are cities; generic populated places
    // must have meaningful population to avoid villages/localities.
    const isAdminCity = ["PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"].includes(featureCode)
    if (isAdminCity) return "city"
    if (featureCode === "PPL" && pop >= 30000) return "city"
    return "place"
  }
  return "place"
}

function classifyGeoapifyKind(row: any): "country" | "city" | "place" {
  const resultType = String(row?.result_type || row?.rank?.match_type || "").toLowerCase()
  if (resultType === "country") return "country"
  if (["city", "town", "municipality"].includes(resultType)) {
    return "city"
  }
  return "place"
}

function classifyNominatimKind(row: any): "country" | "city" | "place" {
  const addresstype = String(row?.addresstype || "").toLowerCase()
  const type = String(row?.type || "").toLowerCase()

  if (addresstype === "country" || type === "country") return "country"
  if (["city", "town", "municipality"].includes(addresstype)) return "city"
  if (["city", "town", "municipality"].includes(type)) return "city"
  return "place"
}

function getLandmarkOverrides(query: string, country: string): LocationResult[] {
  const q = normalizeText(query)
  const c = normalizeText(country)
  const wantsIndia = c === "" || c === "in"
  if (wantsIndia) {
    if (q.includes("marine drive")) {
      return [
        {
          id: 800000001,
          name: "Marine Drive",
          country: "India",
          countryCode: "IN",
          state: "Mumbai, Maharashtra",
          lat: "18.9430",
          lon: "72.8238",
          kind: "place",
        },
      ]
    }
    if (q.includes("golden temple")) {
      return [
        {
          id: 800000002,
          name: "Golden Temple",
          country: "India",
          countryCode: "IN",
          state: "Amritsar, Punjab",
          lat: "31.6200",
          lon: "74.8765",
          kind: "place",
        },
      ]
    }
    if (q.includes("red fort") || q.includes("lal qila")) {
      return [
        {
          id: 800000003,
          name: "Red Fort",
          country: "India",
          countryCode: "IN",
          state: "Delhi",
          lat: "28.6562",
          lon: "77.2410",
          kind: "place",
        },
      ]
    }
  }
  return []
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const country = searchParams.get("country")?.trim() || ""
    const scope = (searchParams.get("scope")?.trim() || "city").toLowerCase()
    const validScope = scope === "country" || scope === "city" || scope === "place" ? scope : "city"

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const username = process.env.GEONAMES_USERNAME
    const geoapifyKey = process.env.GEOAPIFY_API_KEY

    if (!username && !geoapifyKey) {
      return NextResponse.json(
        { error: "Missing GEONAMES_USERNAME and GEOAPIFY_API_KEY in environment." },
        { status: 500 }
      )
    }

    const buildUrl = (onlyPopulatedPlaces: boolean) => {
      if (!username) return ""
      return (
        `https://secure.geonames.org/searchJSON?` +
        `q=${encodeURIComponent(q)}` +
        `${country ? `&country=${encodeURIComponent(country)}` : ""}` +
        `${onlyPopulatedPlaces ? "&featureClass=P" : ""}` +
        `&maxRows=20` +
        `&username=${encodeURIComponent(username)}`
      )
    }

    const parseResults = (data: any) =>
      ((data?.geonames || []) as any[]).map((p: any) => ({
        id: Number(p.geonameId),
        name: String(p.name),
        country: String(p.countryName || ""),
        countryCode: String(p.countryCode || ""),
        state: p.adminName1 ? String(p.adminName1) : undefined,
        lat: String(p.lat),
        lon: String(p.lng),
        population: typeof p.population === "number" ? p.population : undefined,
        kind: classifyGeoNamesKind(p),
      }))

    const geonamesResults: LocationResult[] = []
    if (username) {
      try {
        let r = await fetch(buildUrl(true), { cache: "no-store" })
        let data = await r.json()
        geonamesResults.push(...parseResults(data))

        r = await fetch(buildUrl(false), { cache: "no-store" })
        data = await r.json()
        geonamesResults.push(...parseResults(data))
      } catch {
        // ignore source failure
      }
    }

    const geoapifyResults: LocationResult[] = []
    if (geoapifyKey) {
      try {
        const geoUrl =
          `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}` +
          `&format=json&limit=30&apiKey=${encodeURIComponent(geoapifyKey)}`

        const r = await fetch(geoUrl, { cache: "no-store" })
        const data = await r.json()
        const rows = Array.isArray(data?.results) ? data.results : []
        const wantedCountry = country.toLowerCase()

        geoapifyResults.push(
          ...rows
            .filter((row: any) => {
              if (!wantedCountry) return true
              const code = String(row?.country_code || "").toLowerCase()
              return code === wantedCountry
            })
            .sort((a: any, b: any) => scoreGeoapifyRow(b, q, country) - scoreGeoapifyRow(a, q, country))
            .map((row: any, idx: number) => ({
              id: Number(`9${idx}${Date.now().toString().slice(-6)}`),
              name: String(
                row?.name ||
                  row?.city ||
                  row?.town ||
                  row?.village ||
                  row?.hamlet ||
                  row?.suburb ||
                  q
              ),
              country: String(row?.country || ""),
              countryCode: String(row?.country_code || "").toUpperCase(),
              state: String(row?.city || row?.town || row?.village || row?.state || "") || undefined,
              lat: String(row?.lat ?? ""),
              lon: String(row?.lon ?? ""),
              population: undefined,
              kind: classifyGeoapifyKind(row),
            }))
            .filter((row: any) => row.name && row.lat && row.lon)
        )
      } catch {
        // ignore source failure
      }
    }

    const nominatimResults: LocationResult[] = []
    try {
      const countryCode = country ? country.toLowerCase() : "in"
      const nominatimUrl =
        "https://nominatim.openstreetmap.org/search?" +
        new URLSearchParams({
          q,
          format: "jsonv2",
          addressdetails: "1",
          limit: "30",
          countrycodes: countryCode,
        })

      const r = await fetch(nominatimUrl, {
        cache: "no-store",
        headers: { "User-Agent": "wanderly-app/1.0 (travel search)" },
      })
      const rows = (await r.json()) as any[]
      const safeRows = Array.isArray(rows) ? rows : []
      nominatimResults.push(
        ...safeRows.map((row: any, idx: number) => {
          const addr = row?.address || {}
          return {
            id: Number(`7${idx}${Date.now().toString().slice(-6)}`),
            name: String(
              addr?.attraction ||
                addr?.tourism ||
                addr?.amenity ||
                row?.name ||
                row?.display_name?.split(",")?.[0] ||
                q
            ),
            country: String(addr?.country || ""),
            countryCode: String(addr?.country_code || "").toUpperCase(),
            state: String(
              addr?.city ||
                addr?.town ||
                addr?.village ||
                addr?.state ||
                addr?.county ||
                ""
            ) || undefined,
            lat: String(row?.lat ?? ""),
            lon: String(row?.lon ?? ""),
            population: undefined,
            kind: classifyNominatimKind(row),
          }
        })
      )
    } catch {
      // ignore source failure
    }

    let results = dedupResults([
      ...geonamesResults,
      ...geoapifyResults,
      ...nominatimResults,
    ])

    // High-confidence landmark disambiguation (preprend to ensure top suggestion).
    const overrides = getLandmarkOverrides(q, country)
    if (overrides.length > 0) {
      results = dedupResults([...overrides, ...results])
    }

    results = [...results]
      .sort((a, b) => scoreResult(b, q, country) - scoreResult(a, q, country))
      .slice(0, 30)
      .filter((item) => item.kind === validScope)

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to fetch locations" },
      { status: 500 }
    )
  }
}
