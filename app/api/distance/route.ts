import { NextResponse } from "next/server"

type Coord = {
  lat: number
  lon: number
}

type DistanceRequest = {
  from?: Coord
  to?: Coord
  profile?: "driving-car" | "cycling-regular" | "foot-walking"
}

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DistanceRequest
    const fromLat = toFiniteNumber(body?.from?.lat)
    const fromLon = toFiniteNumber(body?.from?.lon)
    const toLat = toFiniteNumber(body?.to?.lat)
    const toLon = toFiniteNumber(body?.to?.lon)

    if (fromLat === null || fromLon === null || toLat === null || toLon === null) {
      return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
    }

    const profile =
      body?.profile === "cycling-regular" || body?.profile === "foot-walking"
        ? body.profile
        : "driving-car"

    const apiKey = process.env.OPENROUTESERVICE_API_KEY || process.env.ORS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENROUTESERVICE_API_KEY" }, { status: 503 })
    }

    const orsRes = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: [
          [fromLon, fromLat],
          [toLon, toLat],
        ],
        instructions: false,
      }),
      cache: "no-store",
    })

    const orsData = await orsRes.json()
    if (!orsRes.ok) {
      return NextResponse.json(
        { error: orsData?.error?.message || orsData?.message || "OpenRouteService failed" },
        { status: orsRes.status }
      )
    }

    const summary =
      orsData?.routes?.[0]?.summary ||
      orsData?.features?.[0]?.properties?.summary ||
      null

    const distanceMeters = toFiniteNumber(summary?.distance)
    const durationSeconds = toFiniteNumber(summary?.duration)

    if (distanceMeters === null || durationSeconds === null) {
      return NextResponse.json({ error: "Route summary unavailable" }, { status: 502 })
    }

    return NextResponse.json({
      provider: "openrouteservice",
      profile,
      distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
      durationMins: Math.max(1, Math.round(durationSeconds / 60)),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to compute distance" },
      { status: 500 }
    )
  }
}

