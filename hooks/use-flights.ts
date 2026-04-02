"use client"

import { useEffect, useMemo, useState } from "react"

type UseFlightsParams = {
  origin: string
  destination: string
  depart: string
  returnDate?: string
  adults: number
  budgetLevel: string
  sort: "best" | "cheapest" | "fastest"
  stops: "all" | "0" | "1" | "2+"
  airlines: string[]
  departureWindow: "all" | "morning" | "afternoon" | "evening" | "night"
  enabled?: boolean
}

export function useFlights(params: UseFlightsParams) {
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<"LIVE" | "DEMO">("LIVE")
  const [message, setMessage] = useState("")

  const queryKey = useMemo(
    () =>
      JSON.stringify({
        origin: params.origin,
        destination: params.destination,
        depart: params.depart,
        returnDate: params.returnDate,
        adults: params.adults,
        budgetLevel: params.budgetLevel,
        sort: params.sort,
        stops: params.stops,
        airlines: params.airlines.join(","),
        departureWindow: params.departureWindow,
      }),
    [
      params.origin,
      params.destination,
      params.depart,
      params.returnDate,
      params.adults,
      params.budgetLevel,
      params.sort,
      params.stops,
      params.airlines.join(","),
      params.departureWindow,
    ]
  )

  useEffect(() => {
    if (!params.enabled || !params.origin || !params.destination || !params.depart) return

    const fetchFlights = async () => {
      const q = new URLSearchParams({
        origin: params.origin,
        dest: params.destination,
        depart: params.depart,
        return: params.returnDate || "",
        adults: String(params.adults || 1),
        budgetLevel: params.budgetLevel || "medium",
        sort: params.sort,
        stops: params.stops,
        departureWindow: params.departureWindow,
      })
      if (params.airlines.length > 0) {
        q.set("airlines", params.airlines.join(","))
      }

      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/flights?${q.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to load flights")
        setResults(data.results || [])
        setMode((data.mode || "LIVE") as "LIVE" | "DEMO")
        setMessage(data.message || "")
      } catch (e: any) {
        setError(e?.message || "Failed to load flights")
      } finally {
        setIsLoading(false)
      }
    }

    fetchFlights()
  }, [params.enabled, queryKey])

  return {
    flights: results,
    isLoading,
    error,
    mode,
    message,
  }
}
