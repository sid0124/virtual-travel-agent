"use client"

import { useEffect, useMemo, useState } from "react"

type UseHotelsParams = {
  city: string
  country?: string
  checkInDate?: string
  checkOutDate?: string
  adults: number
  budgetLevel: string
  sort: string
  minPrice?: number
  maxPrice?: number
  minRating?: number
  amenities?: string[]
  limit?: number
  inventoryTarget?: number
  enabled?: boolean
}

export function useHotels(params: UseHotelsParams) {
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"LIVE" | "DEMO" | "MIXED">("LIVE")
  const [message, setMessage] = useState("")

  const queryKey = useMemo(
    () =>
      JSON.stringify({
        city: params.city,
        country: params.country,
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults: params.adults,
        budgetLevel: params.budgetLevel,
        sort: params.sort,
        minPrice: params.minPrice,
        maxPrice: params.maxPrice,
        minRating: params.minRating,
        amenities: params.amenities?.join(","),
        limit: params.limit || 20,
        inventoryTarget: params.inventoryTarget || 120,
      }),
    [
      params.city,
      params.country,
      params.checkInDate,
      params.checkOutDate,
      params.adults,
      params.budgetLevel,
      params.sort,
      params.minPrice,
      params.maxPrice,
      params.minRating,
      params.amenities?.join(","),
      params.limit,
      params.inventoryTarget,
    ]
  )

  useEffect(() => {
    setPage(1)
    setResults([])
    setTotal(0)
    setHasMore(false)
    setError(null)
  }, [queryKey])

  useEffect(() => {
    if (!params.enabled || !params.city) return

    const fetchPage = async () => {
      const q = new URLSearchParams({
        city: params.city,
        country: params.country || "",
        checkInDate: params.checkInDate || "",
        checkOutDate: params.checkOutDate || "",
        adults: String(params.adults || 1),
        budgetLevel: params.budgetLevel || "medium",
        sort: params.sort || "recommended",
        page: String(page),
        limit: String(params.limit || 20),
        inventoryTarget: String(params.inventoryTarget || 120),
      })
      if (params.minPrice !== undefined) q.set("minPrice", String(params.minPrice))
      if (params.maxPrice !== undefined) q.set("maxPrice", String(params.maxPrice))
      if (params.minRating !== undefined) q.set("minRating", String(params.minRating))
      if (params.amenities && params.amenities.length > 0) q.set("amenities", params.amenities.join(","))

      try {
        if (page === 1) setIsLoading(true)
        else setIsLoadingMore(true)
        const res = await fetch(`/api/hotels?${q.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to load hotels")
        setResults((prev) => (page === 1 ? data.results || [] : [...prev, ...(data.results || [])]))
        setTotal(data.total || 0)
        setHasMore(Boolean(data.hasMore))
        setMode((data.mode || "LIVE") as "LIVE" | "DEMO" | "MIXED")
        setMessage(data.message || "")
      } catch (e: any) {
        setError(e?.message || "Failed to load hotels")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    }

    fetchPage()
  }, [params.enabled, params.city, page, queryKey])

  return {
    hotels: results,
    total,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    mode,
    message,
    loadMore: () => setPage((p) => p + 1),
    reset: () => setPage(1),
  }
}
