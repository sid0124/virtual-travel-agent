"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type NormalizedHotel = {
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
  demo?: boolean
  isDemo?: boolean
  source?: "LIVE" | "DEMO"
}

type ApiResponse = {
  ok?: boolean
  mode?: "live" | "demo"
  reason?: "quota_exceeded" | "rate_limited" | "invalid_request" | "unknown" | null
  message?: string
  city: string
  page: number
  limit: number
  total: number | null
  hasMore: boolean
  hotels: NormalizedHotel[]
  error?: string
  details?: string
}

type UseHotelsSearchParams = {
  city: string
  checkIn?: string
  checkOut?: string
  adults: number
  budgetLevel?: string
  sort: "recommended" | "price-lowhigh" | "rating-highlow"
  minPrice?: number
  maxPrice?: number
  minRating?: number
  amenities?: string[]
  limit?: number
  enabled?: boolean
}

function dedupeByHotelId(items: NormalizedHotel[]): NormalizedHotel[] {
  const seen = new Set<string>()
  const unique: NormalizedHotel[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }
  return unique
}

function score(hotel: NormalizedHotel): number {
  const rating = hotel.rating || 0
  const reviews = hotel.reviewCount || 0
  const pricePenalty = hotel.pricePerNight || 0
  return rating * 1000 + reviews * 0.1 - pricePenalty
}

export function useHotelsSearch(params: UseHotelsSearchParams) {
  const [hotelsRaw, setHotelsRaw] = useState<NormalizedHotel[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(params.limit || 25)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<string | null>(null)
  const [liveUnavailable, setLiveUnavailable] = useState(false)
  const [mode, setMode] = useState<"live" | "demo">("live")
  const [reason, setReason] = useState<"quota_exceeded" | "rate_limited" | "invalid_request" | "unknown" | null>(null)
  const [message, setMessage] = useState("")
  const [widerSearch, setWiderSearch] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  const debouncedCity = useDebouncedValue(params.city, 400)

  const baseKey = useMemo(
    () =>
      JSON.stringify({
        city: debouncedCity,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: params.adults,
        budgetLevel: params.budgetLevel,
        enabled: params.enabled,
        widerSearch,
      }),
    [debouncedCity, params.checkIn, params.checkOut, params.adults, params.budgetLevel, params.enabled, widerSearch]
  )

  const fetchPage = useCallback(
    async (
      pageNumber: number,
      append: boolean,
      overrides?: { forceLimit?: number; forceWiderSearch?: boolean }
    ): Promise<{ ok: boolean; count: number; hasMore: boolean; total: number | null } | null> => {
      if (!params.enabled || !debouncedCity || !params.checkIn || !params.checkOut) return null

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const effectiveLimit = overrides?.forceLimit ?? limit
      const effectiveWiderSearch = overrides?.forceWiderSearch ?? widerSearch

      const query = new URLSearchParams({
        city: debouncedCity,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        adults: String(Math.max(1, params.adults)),
        budgetLevel: params.budgetLevel || "medium",
        page: String(pageNumber),
        limit: String(effectiveLimit),
      })
      if (effectiveWiderSearch) query.set("widerSearch", "true")

      try {
        setError(null)
        setDetails(null)
        if (append) setIsLoadingMore(true)
        else setIsLoading(true)

        const res = await fetch(`/api/hotels/search?${query.toString()}`, {
          signal: controller.signal,
        })
        const data = (await res.json()) as ApiResponse

        if (!res.ok) {
          const msg = data?.error || "Failed to load hotels"
          const d = data?.details || null
          setError(msg)
          setDetails(d)
          setLiveUnavailable(true)
          setMode("live")
          setReason((data?.reason as any) || "unknown")
          setMessage(data?.message || msg)
          if (!append) {
            setHotelsRaw([])
            setTotal(null)
            setHasMore(false)
          }
          return { ok: false, count: 0, hasMore: false, total: null }
        }

        const currentMode = data.mode || "live"
        const isDemo = currentMode === "demo"
        setLiveUnavailable(isDemo)
        setMode(currentMode)
        setReason((data.reason as any) || null)
        setMessage(data.message || "")
        setTotal(typeof data.total === "number" ? data.total : null)
        setHasMore(Boolean(data.hasMore))
        setHotelsRaw((prev) =>
          append
            ? dedupeByHotelId([...prev, ...(data.hotels || [])])
            : dedupeByHotelId(data.hotels || [])
        )
        return {
          ok: true,
          count: (data.hotels || []).length,
          hasMore: Boolean(data.hasMore),
          total: typeof data.total === "number" ? data.total : null,
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message || "Failed to load hotels")
          setLiveUnavailable(true)
          setMode("live")
          setReason("unknown")
          setMessage("Live hotel inventory unavailable. Showing demo hotels.")
          if (!append) {
            setHotelsRaw([])
            setTotal(null)
            setHasMore(false)
          }
        }
        return null
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [params.enabled, debouncedCity, params.checkIn, params.checkOut, params.adults, params.budgetLevel, limit, widerSearch]
  )

  useEffect(() => {
    setPage(1)
    if (!widerSearch) {
      setLimit(params.limit || 25)
    }
    setHotelsRaw([])
    setTotal(null)
    setHasMore(false)
    setError(null)
    setDetails(null)
    setMode("live")
    setReason(null)
    setMessage("")
  }, [baseKey, params.limit, widerSearch])

  useEffect(() => {
    if (!params.enabled || !debouncedCity || !params.checkIn || !params.checkOut) return
    fetchPage(1, false)

    return () => {
      abortRef.current?.abort()
    }
  }, [fetchPage, params.enabled, debouncedCity, params.checkIn, params.checkOut])

  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    await fetchPage(nextPage, true)
  }, [isLoading, isLoadingMore, hasMore, page, fetchPage])

  const loadUntil = useCallback(
    async (targetCount: number) => {
      if (isLoading || isLoadingMore) return
      let currentPage = page
      let currentCount = hotelsRaw.length
      let canContinue = hasMore

      while (canContinue && currentCount < targetCount) {
        currentPage += 1
        setPage(currentPage)
        const result = await fetchPage(currentPage, true)
        if (!result?.ok) break
        currentCount += result.count
        canContinue = result.hasMore
      }
    },
    [isLoading, isLoadingMore, page, hotelsRaw.length, hasMore, fetchPage]
  )

  const tryWiderSearch = useCallback(async () => {
    const nextLimit = Math.min(50, Math.max(limit, 40))
    setWiderSearch(true)
    setLimit(nextLimit)
    setPage(1)
    setHotelsRaw([])
    setTotal(null)
    setHasMore(false)
    await fetchPage(1, false, { forceLimit: nextLimit, forceWiderSearch: true })
  }, [fetchPage, limit])

  const amenitiesAvailable = useMemo(() => {
    const set = new Set<string>()
    for (const hotel of hotelsRaw) {
      for (const amenity of hotel.amenities || []) {
        set.add(amenity.toLowerCase())
      }
    }
    return Array.from(set)
  }, [hotelsRaw])

  const hotels = useMemo(() => {
    let next = [...hotelsRaw]

    if (typeof params.minPrice === "number") {
      next = next.filter((h) => h.pricePerNight != null && h.pricePerNight >= params.minPrice!)
    }

    if (typeof params.maxPrice === "number") {
      next = next.filter((h) => h.pricePerNight != null && h.pricePerNight <= params.maxPrice!)
    }

    if (typeof params.minRating === "number" && params.minRating > 0) {
      next = next.filter((h) => (h.rating || 0) >= params.minRating!)
    }

    if (params.amenities && params.amenities.length > 0) {
      const required = params.amenities.map((a) => a.toLowerCase())
      next = next.filter((h) => {
        const hotelAmenities = new Set((h.amenities || []).map((a) => a.toLowerCase()))
        return required.every((a) => hotelAmenities.has(a))
      })
    }

    if (params.sort === "price-lowhigh") {
      next.sort((a, b) => (a.pricePerNight || Number.MAX_SAFE_INTEGER) - (b.pricePerNight || Number.MAX_SAFE_INTEGER))
    } else if (params.sort === "rating-highlow") {
      next.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    } else {
      next.sort((a, b) => score(b) - score(a))
    }

    return next
  }, [hotelsRaw, params.sort, params.minPrice, params.maxPrice, params.minRating, params.amenities])

  const loadedCount = hotelsRaw.length

  return {
    hotels,
    hotelsRaw,
    total,
    hasMore,
    page,
    limit,
    loadedCount,
    isLoading,
    isLoadingMore,
    error,
    details,
    liveUnavailable,
    mode,
    reason,
    message,
    amenitiesAvailable,
    loadMore,
    loadUntil100: () => loadUntil(100),
    tryWiderSearch,
  }
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
