import { NextResponse } from "next/server"

type PlaceOut = {
  id: string
  name: string
  formatted?: string
  lat: number
  lon: number
  categories?: string[]
  wikipedia?: string
  wikidata?: string
  image?: string | null
  distance?: number
}

type CandidatePlace = {
  id: string
  name: string
  formatted?: string
  lat: number
  lon: number
  categories?: string[]
  wikipedia?: string
  wikidata?: string
  distance?: number
}

const WIKI_CACHE = new Map<string, { image: string | null; expires: number }>()
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreTitleAgainstPlace(title: string, placeName: string): number {
  const t = normalizeText(title)
  const p = normalizeText(placeName)
  if (!t || !p) return 0
  if (t === p) return 100
  if (t.startsWith(p)) return 70
  if (t.includes(p)) return 50

  const pTokens = p.split(" ").filter(Boolean)
  let score = 0
  for (const token of pTokens) {
    if (t.includes(token)) score += 8
  }
  return score
}

function isGenericPlaceName(name: string): boolean {
  const n = normalizeText(name)
  if (!n) return true
  const blocked = [
    "office",
    "street",
    "road",
    "railway",
    "station",
    "bus stop",
    "mobile home",
    "residential",
    "apartment",
    "building",
    "market",
    "sector",
    "zone",
    "ward",
    "colony",
    "phase",
    "block",
    "locality",
  ]
  if (n.length < 4) return true
  if (/\d{3,}/.test(n)) return true
  if (/^zone\s*\d+/.test(n)) return true
  if (/^sector\s*[a-z0-9-]+/.test(n)) return true
  return blocked.some((token) => n.includes(token))
}

function isUnsupportedImageUrl(url: string): boolean {
  const u = url.toLowerCase()
  return u.includes(".tif") || u.includes(".tiff") || u.includes(".pdf") || u.includes(".webm")
}

async function isRenderableImageUrl(url?: string | null): Promise<boolean> {
  if (!url) return false
  if (url.startsWith("data:image/")) return true
  if (isUnsupportedImageUrl(url)) return false

  const checkResponse = (res: Response) => {
    if (!res.ok) return false
    const contentType = String(res.headers.get("content-type") || "").toLowerCase()
    if (!contentType.startsWith("image/")) return false
    if (contentType.includes("tiff")) return false
    return true
  }

  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "wanderly-app/1.0 image-check" },
    })
    if (checkResponse(head)) return true
  } catch {
    // try GET fallback below
  }

  try {
    const get = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "wanderly-app/1.0 image-check",
        Range: "bytes=0-0",
      },
    })
    return checkResponse(get)
  } catch {
    return false
  }
}

async function getWikidataImageById(wikidataId?: string): Promise<string | null> {
  if (!wikidataId) return null
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const entity = data?.entities?.[wikidataId]
    const claim = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    if (!claim || typeof claim !== "string") return null
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(claim)}`
  } catch {
    return null
  }
}

async function getWikipediaImageByCoords(
  lat: number,
  lon: number,
  placeName: string
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  try {
    const geoUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        list: "geosearch",
        gscoord: `${lat}|${lon}`,
        gsradius: "3000",
        gslimit: "10",
      })

    const geoRes = await fetch(geoUrl, { cache: "no-store" })
    if (!geoRes.ok) return null
    const geoData = await geoRes.json()
    const items = Array.isArray(geoData?.query?.geosearch) ? geoData.query.geosearch : []
    if (!items.length) return null

    const sorted = [...items].sort((a: any, b: any) => {
      const sA = scoreTitleAgainstPlace(String(a?.title || ""), placeName)
      const sB = scoreTitleAgainstPlace(String(b?.title || ""), placeName)
      if (sB !== sA) return sB - sA
      return Number(a?.dist || 0) - Number(b?.dist || 0)
    })

    const pageIds = sorted
      .slice(0, 5)
      .map((x: any) => String(x?.pageid || "").trim())
      .filter(Boolean)
      .join("|")
    if (!pageIds) return null

    const pageUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "pageimages",
        pageids: pageIds,
        piprop: "thumbnail|original",
        pithumbsize: "900",
      })

    const pageRes = await fetch(pageUrl, { cache: "no-store" })
    if (!pageRes.ok) return null
    const pageData = await pageRes.json()
    const pages = pageData?.query?.pages || {}

    let bestImage: string | null = null
    let bestScore = -1
    for (const row of sorted.slice(0, 5)) {
      const page = pages[String(row.pageid)]
      const img = page?.thumbnail?.source || page?.original?.source || null
      if (!img) continue
      const score = scoreTitleAgainstPlace(String(row?.title || ""), placeName) * 10 - Number(row?.dist || 0)
      if (score > bestScore) {
        bestScore = score
        bestImage = img
      }
    }
    if (bestScore < 80) return null
    return bestImage
  } catch {
    return null
  }
}

function extractWikiTitle(wikipedia?: string): string | null {
  // geoapify gives like: "en:Agra Fort"
  if (!wikipedia) return null
  const parts = wikipedia.split(":")
  if (parts.length < 2) return null
  return parts.slice(1).join(":").trim()
}

async function getWikiThumbPageImages(title: string): Promise<string | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "pageimages",
        titles: title,
        piprop: "thumbnail|original",
        pithumbsize: "900",
      })

    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()

    const pages = data?.query?.pages
    if (!pages) return null

    const firstKey = Object.keys(pages)[0]
    const page = pages[firstKey]

    return page?.thumbnail?.source || page?.original?.source || null
  } catch {
    return null
  }
}

async function getWikipediaThumbByTitle(title: string): Promise<string | null> {
  const key = title.toLowerCase()
  const now = Date.now()
  const cached = WIKI_CACHE.get(key)
  if (cached && cached.expires > now) return cached.image

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title
    )}`
    const res = await fetch(url, { headers: { "User-Agent": "wanderly-app" } })
    if (!res.ok) {
      WIKI_CACHE.set(key, { image: null, expires: now + CACHE_TTL_MS })
      return null
    }
    const data = await res.json()

    const img =
      data?.thumbnail?.source ||
      data?.originalimage?.source ||
      null

    WIKI_CACHE.set(key, { image: img, expires: now + CACHE_TTL_MS })
    return img
  } catch {
    WIKI_CACHE.set(key, { image: null, expires: now + CACHE_TTL_MS })
    return null
  }
}

async function wikiSearchToTitle(query: string): Promise<string | null> {
  // fallback if wiki field missing
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "opensearch",
        search: query,
        limit: "1",
        namespace: "0",
        format: "json",
        origin: "*",
      })

    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const title = Array.isArray(data) && Array.isArray(data[1]) ? data[1][0] : null
    return title || null
  } catch {
    return null
  }
}

async function resolveImageForCandidate(place: CandidatePlace): Promise<string | null> {
  const name = place.name
  const wikipedia = place.wikipedia
  const wikidata = place.wikidata
  let title = extractWikiTitle(wikipedia)

  const tryImage = async (input: Promise<string | null> | string | null) => {
    const candidate = typeof input === "string" || input === null ? input : await input
    if (!candidate) return null
    if (!(await isRenderableImageUrl(candidate))) return null
    return candidate
  }

  let image: string | null = await tryImage(
    getWikidataImageById(typeof wikidata === "string" ? wikidata : undefined)
  )
  if (!image && title) {
    image = await tryImage(getWikiThumbPageImages(title))
    if (!image) image = await tryImage(getWikipediaThumbByTitle(title))
  }

  if (!image) {
    const guess = `${name} ${place.formatted || ""}`.trim()
    title = await wikiSearchToTitle(guess)
    if (title) {
      image = await tryImage(getWikiThumbPageImages(title))
      if (!image) image = await tryImage(getWikipediaThumbByTitle(title))
    }
  }

  if (!image) {
    image = await tryImage(getWikipediaImageByCoords(place.lat, place.lon, name))
  }

  return image
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const lat = Number(searchParams.get("lat"))
    const lon = Number(searchParams.get("lon"))
    const limit = Math.min(Number(searchParams.get("limit") || 5), 10)
    const radius = Math.min(Number(searchParams.get("radius") || 15000), 50000)
    const candidateLimit = Math.min(Math.max(limit * 8, 30), 100)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json(
        { error: "lat and lon are required (numbers)." },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEOAPIFY_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEOAPIFY_API_KEY in env." },
        { status: 500 }
      )
    }

    // ✅ Supported categories (don’t use tourism.museum etc.)
    // Use: entertainment.museum (NOT tourism.museum)
    const categories = [
      "tourism.attraction",
      "tourism.sights",
      "heritage.unesco",
      "entertainment.museum",
      "tourism.sights.place_of_worship",
      "tourism.sights.castle",
      "tourism.sights.fort",
      "tourism.sights.archaeological_site",
      "tourism.sights.memorial.monument",
    ].join(",")

    const geoapifyUrl =
      "https://api.geoapify.com/v2/places?" +
      new URLSearchParams({
        categories,
        filter: `circle:${lon},${lat},${radius}`,
        bias: `proximity:${lon},${lat}`,
        limit: String(candidateLimit),
        apiKey,
      })

    const res = await fetch(geoapifyUrl)
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || "Geoapify places failed", raw: data },
        { status: res.status }
      )
    }

    const features = Array.isArray(data?.features) ? data.features : []

    const allCandidates: CandidatePlace[] = features
      .map((f: any) => {
        const p = f?.properties || {}
        const g = f?.geometry || {}
        const coords = Array.isArray(g?.coordinates) ? g.coordinates : [null, null]
        const name = p?.name || p?.address_line1 || "Unknown place"
        return {
          id: String(p?.place_id || p?.osm_id || `${name}-${coords[0]}-${coords[1]}`),
          name,
          formatted: p?.formatted,
          lat: Number(coords[1]),
          lon: Number(coords[0]),
          categories: p?.categories,
          wikipedia: p?.wiki_and_media?.wikipedia,
          wikidata: p?.wiki_and_media?.wikidata || p?.datasource?.raw?.wikidata,
          distance: p?.distance,
        }
      })
      .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon))
    const candidates: CandidatePlace[] = allCandidates
      .filter((c) => !isGenericPlaceName(c.name))
      .sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0))

    const places: PlaceOut[] = []
    const usedNames = new Set<string>()
    const usedImages = new Set<string>()

    for (const candidate of candidates) {
      if (places.length >= limit) break
      const nameKey = normalizeText(candidate.name)
      if (!nameKey || usedNames.has(nameKey)) continue

      const image = await resolveImageForCandidate(candidate)
      if (!image) continue
      if (usedImages.has(image)) continue

      usedNames.add(nameKey)
      usedImages.add(image)
      places.push({
        ...candidate,
        image,
      })
    }

    // Relaxed fallback: widen candidate filters, but keep verified-image requirement.
    if (places.length === 0) {
      const relaxed = allCandidates
        .filter((c) => String(c.name || "").trim().length > 2)
        .sort((a, b) => Number(a.distance || 0) - Number(b.distance || 0))
        .slice(0, limit)

      for (const candidate of relaxed) {
        const image = await resolveImageForCandidate(candidate)
        if (!image) continue
        places.push({
          ...candidate,
          image,
        })
      }
    }

    return NextResponse.json({ places })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    )
  }
}
