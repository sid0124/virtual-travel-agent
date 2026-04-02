import { NextResponse } from "next/server"

const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY

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

function extractWikiTitle(wikipedia?: string): string | null {
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
    const res = await fetch(url, { cache: "no-store" })
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
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { "User-Agent": "wanderly-app" }, cache: "no-store" }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.thumbnail?.source || data?.originalimage?.source || null
  } catch {
    return null
  }
}

async function wikiSearchToTitle(query: string): Promise<string | null> {
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
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const data = await res.json()
    const title = Array.isArray(data) && Array.isArray(data[1]) ? data[1][0] : null
    return title || null
  } catch {
    return null
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

    for (const row of sorted.slice(0, 5)) {
      const page = pages[String(row.pageid)]
      const img = page?.thumbnail?.source || page?.original?.source || null
      if (img) return img
    }
    return null
  } catch {
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")

  if (!lat || !lon) {
    return NextResponse.json({ places: [] }, { status: 200 })
  }

  if (!GEOAPIFY_KEY) {
    return NextResponse.json(
      { error: "Missing GEOAPIFY_API_KEY" },
      { status: 500 }
    )
  }

  try {
    // Geoapify: tourist attractions near city
    const url =
      `https://api.geoapify.com/v2/places?` +
      `categories=tourism.attraction,tourism.sights,tourism.museum,heritage,building.historic` +
      `&filter=circle:${lon},${lat},15000` + // 15km radius
      `&limit=12` +
      `&bias=proximity:${lon},${lat}` +
      `&apiKey=${GEOAPIFY_KEY}`

    const res = await fetch(url)
    const data = await res.json()

    const items = (data?.features || []).map((f: any) => {
      const p = f.properties || {}
      return {
        id: f.id || p.place_id || `${p.name}-${p.lat}-${p.lon}`,
        name: p.name || "Unknown place",
        address: p.formatted || "",
        category: (p.categories && p.categories[0]) || "tourism",
        lat: p.lat,
        lon: p.lon,
        wikipedia: p?.wiki_and_media?.wikipedia,
        wikidata: p?.wiki_and_media?.wikidata || p?.datasource?.raw?.wikidata,
        // sometimes geoapify gives rating/popularity, but not always
        rank: p.rank || p.place_rank || 0,
      }
    })

    // pick best 5 (rank first, fallback proximity already applied)
    const top = items
      .filter((x: any) => x.name && x.name.length > 2)
      .sort((a: any, b: any) => (b.rank || 0) - (a.rank || 0))
      .slice(0, 5)

    // Add wiki thumbnails (best for famous places)
    const withImages = await Promise.all(
      top.map(async (pl: any) => {
        const wikidataId = pl?.wikidata || pl?.datasource?.raw?.wikidata
        const wikipediaRef = pl?.wikipedia
        const wikiTitle = extractWikiTitle(wikipediaRef)

        let image: string | null = await getWikidataImageById(typeof wikidataId === "string" ? wikidataId : undefined)
        if (!image && wikiTitle) {
          image = await getWikiThumbPageImages(wikiTitle)
          if (!image) image = await getWikipediaThumbByTitle(wikiTitle)
        }
        if (!image) {
          const guessed = await wikiSearchToTitle(`${pl.name} ${pl.address}`.trim())
          if (guessed) {
            image = await getWikiThumbPageImages(guessed)
            if (!image) image = await getWikipediaThumbByTitle(guessed)
          }
        }
        if (!image) {
          image = await getWikipediaImageByCoords(Number(pl.lat), Number(pl.lon), pl.name)
        }
        if (!image) {
          const cityGuess = String(pl?.address || "").split(",").slice(-2).join(" ").trim()
          if (cityGuess) {
            const cityTitle = await wikiSearchToTitle(cityGuess)
            if (cityTitle) {
              image = await getWikiThumbPageImages(cityTitle)
              if (!image) image = await getWikipediaThumbByTitle(cityTitle)
            }
          }
        }
        return { ...pl, image: image || null }
      })
    )

    return NextResponse.json({ places: withImages }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ places: [] }, { status: 200 })
  }
}
