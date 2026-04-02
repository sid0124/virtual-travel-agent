import { NextResponse } from "next/server"

type MonthlyAggregate = {
  tempTotal: number
  tempCount: number
  precipitationTotal: number
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function classifyCondition(avgTemp: number, rainfallMm: number): string {
  if (avgTemp <= 0) return rainfallMm >= 40 ? "Snow & Rain" : "Snowy"
  if (rainfallMm >= 120) return avgTemp >= 22 ? "Hot & Rainy" : "Rainy"
  if (avgTemp >= 32) return "Extreme Heat"
  if (avgTemp >= 26) return "Hot"
  if (avgTemp >= 18) return "Warm"
  if (avgTemp >= 10) return "Mild"
  if (avgTemp >= 3) return "Cool"
  return "Cold"
}

async function resolveCoords(city: string): Promise<{ latitude: number; longitude: number; cityName: string; country?: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()
  const first = data?.results?.[0]
  if (!first) return null
  const latitude = toFiniteNumber(first.latitude)
  const longitude = toFiniteNumber(first.longitude)
  if (latitude === null || longitude === null) return null
  return {
    latitude,
    longitude,
    cityName: first.name || city,
    country: first.country || undefined,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const rawCity = typeof body?.city === "string" ? body.city.trim() : ""
    const rawLat = toFiniteNumber(body?.lat)
    const rawLon = toFiniteNumber(body?.lon)

    let latitude = rawLat
    let longitude = rawLon
    let resolvedCity = rawCity || "Selected location"
    let resolvedCountry: string | undefined

    if (latitude === null || longitude === null) {
      if (!rawCity) {
        return NextResponse.json({ error: "City or valid coordinates are required." }, { status: 400 })
      }
      const resolved = await resolveCoords(rawCity)
      if (!resolved) {
        return NextResponse.json({ error: "Could not resolve location for climate data." }, { status: 404 })
      }
      latitude = resolved.latitude
      longitude = resolved.longitude
      resolvedCity = resolved.cityName
      resolvedCountry = resolved.country
    }

    const now = new Date()
    const currentUtcYear = now.getUTCFullYear()
    const currentUtcMonth = now.getUTCMonth() + 1
    const lastCompleteYear = currentUtcMonth === 1 ? currentUtcYear - 2 : currentUtcYear - 1
    const endYear = Math.max(2000, lastCompleteYear)
    const startYear = endYear - 9
    const startDate = `${startYear}-01-01`
    const endDate = `${endYear}-12-31`

    const archiveUrl =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
      `&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`

    const archiveRes = await fetch(archiveUrl, { cache: "no-store" })
    if (!archiveRes.ok) {
      const details = await archiveRes.text()
      return NextResponse.json({ error: "Failed to fetch climate archive data.", details }, { status: archiveRes.status })
    }

    const archiveData = await archiveRes.json()
    const days: string[] = Array.isArray(archiveData?.daily?.time) ? archiveData.daily.time : []
    const temps: Array<number | null> = Array.isArray(archiveData?.daily?.temperature_2m_mean)
      ? archiveData.daily.temperature_2m_mean
      : []
    const precipitation: Array<number | null> = Array.isArray(archiveData?.daily?.precipitation_sum)
      ? archiveData.daily.precipitation_sum
      : []

    if (!days.length || temps.length !== days.length || precipitation.length !== days.length) {
      return NextResponse.json({ error: "Incomplete climate data returned by provider." }, { status: 502 })
    }

    const byMonth = new Map<number, MonthlyAggregate>()
    for (let month = 0; month < 12; month += 1) {
      byMonth.set(month, { tempTotal: 0, tempCount: 0, precipitationTotal: 0 })
    }

    for (let i = 0; i < days.length; i += 1) {
      const dateStr = days[i]
      const monthIndex = Number(dateStr.slice(5, 7)) - 1
      if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) continue
      const bucket = byMonth.get(monthIndex)!
      const t = toFiniteNumber(temps[i])
      const p = toFiniteNumber(precipitation[i])
      if (t !== null) {
        bucket.tempTotal += t
        bucket.tempCount += 1
      }
      if (p !== null) {
        bucket.precipitationTotal += p
      }
    }

    const yearCount = Math.max(1, endYear - startYear + 1)
    const monthly = MONTHS.map((monthLabel, index) => {
      const bucket = byMonth.get(index)!
      const avgTemperature = bucket.tempCount > 0 ? Math.round((bucket.tempTotal / bucket.tempCount) * 10) / 10 : 0
      const rainfall = Math.round((bucket.precipitationTotal / yearCount) * 10) / 10
      return {
        location: resolvedCity,
        month: monthLabel,
        avgTemperature,
        rainfall,
        humidity: 60,
        weatherCondition: classifyCondition(avgTemperature, rainfall),
      }
    })

    return NextResponse.json({
      city: resolvedCity,
      country: resolvedCountry,
      latitude,
      longitude,
      startYear,
      endYear,
      source: "open-meteo-archive",
      monthly,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}

