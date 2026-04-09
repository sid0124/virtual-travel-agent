import { NextResponse } from "next/server"

import { getCache, setCache } from "@/lib/api-cache"
import { prisma } from "@/lib/prisma"
import {
  type PlaceImageInput,
  type ResolvedPlaceImage,
  buildImageUnavailablePlaceholder,
  buildPlaceImageBlurPlaceholder,
  buildPlaceImageCacheKey,
  buildPlaceImageKey,
  buildPlaceImageQuery,
  isHighQualityCandidate,
  resolveStaticPlaceImage,
  scoreTextRelevance,
} from "@/lib/place-images"

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14
const NO_IMAGE = "__NO_IMAGE__"
const IMAGE_CACHE_INTENT = "place_image"

type CachedImagePayload = ResolvedPlaceImage | typeof NO_IMAGE

function normalizeText(value?: string | null) {
  return String(value || "").trim()
}

function parsePlaceInput(raw: any): PlaceImageInput {
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.map((tag: unknown) => String(tag || "").trim()).filter(Boolean)
    : []

  return {
    key: normalizeText(raw?.key) || undefined,
    id: normalizeText(raw?.id) || undefined,
    name: normalizeText(raw?.name) || undefined,
    city: normalizeText(raw?.city) || undefined,
    state: normalizeText(raw?.state) || undefined,
    country: normalizeText(raw?.country) || undefined,
    category: normalizeText(raw?.category) || undefined,
    tags,
    imageQuery: normalizeText(raw?.imageQuery) || undefined,
    image: normalizeText(raw?.image) || undefined,
    imageFallback: normalizeText(raw?.imageFallback) || undefined,
    coordinates:
      raw?.coordinates && typeof raw.coordinates === "object"
        ? {
            latitude: raw.coordinates.latitude ?? null,
            longitude: raw.coordinates.longitude ?? null,
          }
        : undefined,
  }
}

function buildPlaceholderResult(input: PlaceImageInput): ResolvedPlaceImage {
  return {
    imageUrl: buildImageUnavailablePlaceholder(input),
    blurDataUrl: buildPlaceImageBlurPlaceholder(input),
    source: "placeholder",
    width: 1600,
    height: 900,
    relevanceScore: 0,
    resolvedQuery: buildPlaceImageQuery(input),
    placeholder: true,
  }
}

async function readPersistentCache(cacheKey: string) {
  try {
    const cached = await (prisma as any).aiResponseCache.findUnique({
      where: { cacheKey },
    })

    if (!cached) return null
    if (cached.expiresAt.getTime() <= Date.now()) return null
    return cached.payload as CachedImagePayload
  } catch {
    return null
  }
}

async function writePersistentCache(cacheKey: string, payload: CachedImagePayload) {
  try {
    await (prisma as any).aiResponseCache.upsert({
      where: { cacheKey },
      update: {
        intent: IMAGE_CACHE_INTENT,
        inputHash: cacheKey,
        payload: payload as any,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
      create: {
        cacheKey,
        intent: IMAGE_CACHE_INTENT,
        inputHash: cacheKey,
        payload: payload as any,
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      },
    })
  } catch {
    // Ignore DB cache failures and keep the resolver usable.
  }
}

function resolveGooglePhotoProxyUrl(photoReference: string, maxWidth = 1600) {
  return `/api/images/google-photo?ref=${encodeURIComponent(photoReference)}&maxwidth=${Math.max(800, Math.min(1600, maxWidth))}`
}

async function fetchGooglePlaceImage(input: PlaceImageInput): Promise<ResolvedPlaceImage | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  const query = buildPlaceImageQuery(input)
  if (!apiKey || !query) return null

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`
    const searchResponse = await fetch(searchUrl, { cache: "no-store" })
    if (!searchResponse.ok) return null

    const searchData = await searchResponse.json()
    const candidate = Array.isArray(searchData?.candidates) ? searchData.candidates[0] : null
    if (!candidate?.place_id) return null

    const searchScore = scoreTextRelevance([candidate.name, candidate.formatted_address].filter(Boolean).join(" "), input)
    if (searchScore < 120) return null

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(candidate.place_id)}&fields=name,formatted_address,photos&key=${apiKey}`
    const detailsResponse = await fetch(detailsUrl, { cache: "no-store" })
    if (!detailsResponse.ok) return null

    const detailsData = await detailsResponse.json()
    const photo = Array.isArray(detailsData?.result?.photos) ? detailsData.result.photos.find((item: any) => isHighQualityCandidate(item?.width, item?.height)) || detailsData.result.photos[0] : null
    if (!photo?.photo_reference) return null
    if (photo?.width && Number(photo.width) < 800) return null

    return {
      imageUrl: resolveGooglePhotoProxyUrl(photo.photo_reference, photo.width || 1600),
      blurDataUrl: buildPlaceImageBlurPlaceholder(input),
      source: "google",
      width: photo.width || 1600,
      height: photo.height || 900,
      relevanceScore: Math.min(100, searchScore + 12),
      resolvedQuery: query,
      attribution: {
        provider: "google",
      },
    }
  } catch {
    return null
  }
}

function scoreUnsplashCandidate(photo: any, input: PlaceImageInput) {
  const descriptionText = [
    photo?.alt_description,
    photo?.description,
    photo?.slug,
    photo?.location?.title,
    ...(Array.isArray(photo?.tags) ? photo.tags.map((tag: any) => tag?.title) : []),
    ...(Array.isArray(photo?.tags_preview) ? photo.tags_preview.map((tag: any) => tag?.title) : []),
  ]
    .filter(Boolean)
    .join(" ")

  let score = scoreTextRelevance(descriptionText, input)

  if (isHighQualityCandidate(photo?.width, photo?.height)) score += 18
  if (/skyline|cityscape/i.test(descriptionText) && score < 120) score -= 22
  if (/beach|mountain|forest|sunset/i.test(descriptionText) && score < 120) score -= 18

  return score
}

async function fetchUnsplashImage(input: PlaceImageInput): Promise<ResolvedPlaceImage | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  const query = buildPlaceImageQuery(input)
  if (!key || !query) return null

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=8&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${key}`,
        },
        next: { revalidate: 60 * 60 * 24 },
      }
    )

    if (!response.ok) return null
    const data = await response.json()
    const results = Array.isArray(data?.results) ? data.results : []

    const best = results
      .map((photo: any) => ({
        photo,
        score: scoreUnsplashCandidate(photo, input),
      }))
      .filter((item: { score: number; photo: any }) => item.score >= 130)
      .sort((a: { score: number; photo: any }, b: { score: number; photo: any }) => b.score - a.score || (b.photo?.width || 0) - (a.photo?.width || 0))[0]

    if (!best?.photo?.urls?.regular) return null

    return {
      imageUrl: `${best.photo.urls.regular}${String(best.photo.urls.regular).includes("?") ? "&" : "?"}w=1600&q=80&fit=crop&crop=entropy`,
      blurDataUrl: best.photo?.blur_hash ? buildPlaceImageBlurPlaceholder(input) : buildPlaceImageBlurPlaceholder(input),
      source: "unsplash",
      width: best.photo.width,
      height: best.photo.height,
      relevanceScore: best.score,
      resolvedQuery: query,
      attribution: {
        provider: "unsplash",
        author: best.photo?.user?.name,
        authorLink: best.photo?.user?.links?.html,
        sourceLink: best.photo?.links?.html,
      },
    }
  } catch {
    return null
  }
}

async function wikiSearchToTitle(query: string): Promise<string | null> {
  if (!query) return null

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

    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } })
    if (!response.ok) return null

    const data = await response.json()
    const titles = Array.isArray(data?.[1]) ? data[1] : []
    return typeof titles[0] === "string" ? titles[0] : null
  } catch {
    return null
  }
}

async function getWikipediaThumbByTitle(title: string): Promise<string | null> {
  if (!title) return null

  try {
    const pageImagesUrl =
      "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        origin: "*",
        prop: "pageimages",
        titles: title,
        piprop: "thumbnail|original",
        pithumbsize: "1600",
      })
    const pageImagesResponse = await fetch(pageImagesUrl, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (pageImagesResponse.ok) {
      const pageImagesData = await pageImagesResponse.json()
      const pages = pageImagesData?.query?.pages || {}
      const firstKey = Object.keys(pages)[0]
      const page = firstKey ? pages[firstKey] : null
      const pageImage = page?.original?.source || page?.thumbnail?.source || null
      if (pageImage) return pageImage
    }

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    const response = await fetch(url, {
      headers: { "User-Agent": "wanderly-app" },
      next: { revalidate: 60 * 60 * 24 * 7 },
    })
    if (!response.ok) return null

    const data = await response.json()
    return data?.thumbnail?.source || data?.originalimage?.source || null
  } catch {
    return null
  }
}

async function fetchWikipediaImage(input: PlaceImageInput): Promise<ResolvedPlaceImage | null> {
  const candidateQueries = Array.from(
    new Set(
      [
        [input.name, input.city, input.state, input.country].filter(Boolean).join(" "),
        [input.name, input.state, input.country].filter(Boolean).join(" "),
        [input.name, input.country].filter(Boolean).join(" "),
        buildPlaceImageQuery(input),
      ]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  )

  for (const query of candidateQueries) {
    const title = await wikiSearchToTitle(query)
    if (!title) continue

    const score = scoreTextRelevance(title, input)
    if (score < 80) continue

    const imageUrl = await getWikipediaThumbByTitle(title)
    if (!imageUrl) continue

    return {
      imageUrl,
      blurDataUrl: buildPlaceImageBlurPlaceholder(input),
      source: "static",
      width: 1600,
      height: 900,
      relevanceScore: Math.min(100, score + 10),
      resolvedQuery: title,
      attribution: {
        provider: "wikipedia",
        sourceLink: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, "_"))}`,
      },
    }
  }

  return null
}

async function resolvePlaceImage(input: PlaceImageInput): Promise<ResolvedPlaceImage> {
  const cacheKey = buildPlaceImageCacheKey(input)
  const memoryCached = getCache<CachedImagePayload>(cacheKey)
  if (memoryCached) {
    return memoryCached === NO_IMAGE ? buildPlaceholderResult(input) : memoryCached
  }

  const dbCached = await readPersistentCache(cacheKey)
  if (dbCached) {
    setCache(cacheKey, dbCached, CACHE_TTL_MS)
    return dbCached === NO_IMAGE ? buildPlaceholderResult(input) : dbCached
  }

  const resolved =
    await fetchGooglePlaceImage(input) ||
    await fetchUnsplashImage(input) ||
    resolveStaticPlaceImage(input) ||
    await fetchWikipediaImage(input) ||
    buildPlaceholderResult(input)

  const payloadToStore: CachedImagePayload = resolved.placeholder ? NO_IMAGE : resolved
  setCache(cacheKey, payloadToStore, CACHE_TTL_MS)
  await writePersistentCache(cacheKey, payloadToStore)

  return resolved
}

function buildLegacyQueryInput(query: string): PlaceImageInput {
  return {
    key: query,
    name: query,
    imageQuery: query,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const input = parsePlaceInput({
    key: searchParams.get("key"),
    id: searchParams.get("id"),
    name: searchParams.get("name"),
    city: searchParams.get("city"),
    state: searchParams.get("state"),
    country: searchParams.get("country"),
    category: searchParams.get("category"),
    imageQuery: searchParams.get("q") || searchParams.get("imageQuery"),
    image: searchParams.get("image"),
    imageFallback: searchParams.get("imageFallback"),
    tags: searchParams.get("tags")?.split(",").map((tag) => tag.trim()).filter(Boolean) || [],
  })

  if (!input.name && !input.imageQuery) {
    return NextResponse.json({ image: null, resolved: buildPlaceholderResult(input) })
  }

  const resolved = await resolvePlaceImage(input)
  return NextResponse.json({
    image: resolved.imageUrl,
    resolved,
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawPlaces = Array.isArray(body?.places) ? body.places : []
    const rawQueries = Array.isArray(body?.queries) ? body.queries : []

    const placeInputs = rawPlaces.map((item: any) => parsePlaceInput(item)).filter((item: PlaceImageInput) => item.name || item.imageQuery)
    const queryInputs = rawQueries
      .map((query: unknown) => normalizeText(typeof query === "string" ? query : ""))
      .filter(Boolean)
      .map((query: string) => buildLegacyQueryInput(query))

    const inputs = [...placeInputs, ...queryInputs]
    if (!inputs.length) {
      return NextResponse.json({ images: {}, items: {} })
    }

    const uniqueInputs = Array.from(
      new Map(inputs.map((input) => [buildPlaceImageKey(input), input])).values()
    )

    const resolvedEntries = await Promise.all(
      uniqueInputs.map(async (input) => {
        const key = buildPlaceImageKey(input)
        const resolved = await resolvePlaceImage(input)
        return [key, resolved] as const
      })
    )

    const items = Object.fromEntries(resolvedEntries)
    const images = Object.fromEntries(
      uniqueInputs.map((input) => {
        const key = input.key || input.imageQuery || buildPlaceImageKey(input)
        const resolved = items[buildPlaceImageKey(input)]
        return [key, resolved?.imageUrl || null]
      })
    )

    return NextResponse.json({ images, items })
  } catch {
    return NextResponse.json({ images: {}, items: {} }, { status: 400 })
  }
}
