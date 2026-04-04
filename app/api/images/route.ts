import { NextResponse } from "next/server"

import { getCache, setCache } from "@/lib/api-cache"

const CACHE_TTL_MS = 1000 * 60 * 60 * 24
const QUERY_CACHE_PREFIX = "unsplash:image:"
const NO_IMAGE = "__NO_IMAGE__"

function normalizeQuery(query: string | null | undefined) {
  return String(query || "").trim()
}

async function fetchImageForQuery(query: string): Promise<string | null> {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) return null

  const cacheKey = `${QUERY_CACHE_PREFIX}${normalizedQuery.toLowerCase()}`
  const cached = getCache<string>(cacheKey)
  if (typeof cached === "string") {
    return cached === NO_IMAGE ? null : cached
  }

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    setCache(cacheKey, NO_IMAGE, CACHE_TTL_MS)
    return null
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        normalizedQuery
      )}&orientation=landscape&per_page=1`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        },
        next: { revalidate: 60 * 60 * 24 },
      }
    )

    if (!res.ok) {
      setCache(cacheKey, NO_IMAGE, CACHE_TTL_MS)
      return null
    }

    const data = await res.json()
    const image = data.results?.[0]?.urls?.regular || null
    setCache(cacheKey, image || NO_IMAGE, CACHE_TTL_MS)
    return image
  } catch {
    setCache(cacheKey, NO_IMAGE, CACHE_TTL_MS)
    return null
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = normalizeQuery(searchParams.get("q"))

  if (!query) {
    return NextResponse.json({ image: null })
  }

  const image = await fetchImageForQuery(query)
  return NextResponse.json({ image })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { queries?: unknown }
    const inputQueries: unknown[] = Array.isArray(body?.queries) ? body.queries : []
    const uniqueQueries = Array.from(
      new Set(
        inputQueries
          .map((query: unknown) => normalizeQuery(typeof query === "string" ? query : ""))
          .filter(Boolean)
      )
    ) as string[]

    if (uniqueQueries.length === 0) {
      return NextResponse.json({ images: {} })
    }

    const entries = await Promise.all(
      uniqueQueries.map(async (query) => [query, await fetchImageForQuery(query)] as const)
    )

    return NextResponse.json({
      images: Object.fromEntries(entries),
    })
  } catch {
    return NextResponse.json({ images: {} }, { status: 400 })
  }
}
