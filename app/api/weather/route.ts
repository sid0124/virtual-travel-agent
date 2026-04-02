import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { city, lat, lon, placeName } = await req.json()

    const safeCity = typeof city === "string" ? city.trim() : ""
    const safeLat = typeof lat === "number" ? lat : Number(lat)
    const safeLon = typeof lon === "number" ? lon : Number(lon)
    const hasCoords = Number.isFinite(safeLat) && Number.isFinite(safeLon)

    if (!safeCity && !hasCoords) {
      return NextResponse.json({ error: "City or valid coordinates are required" }, { status: 400 })
    }

    const apiKey = process.env.OPENWEATHER_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENWEATHER_API_KEY in .env.local" },
        { status: 500 }
      )
    }

    const url = hasCoords
      ? `https://api.openweathermap.org/data/2.5/weather?lat=${safeLat}&lon=${safeLon}&appid=${apiKey}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(safeCity)}&appid=${apiKey}&units=metric`

    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      const txt = await res.text()
      return NextResponse.json(
        { error: "OpenWeather error", details: txt },
        { status: res.status }
      )
    }

    const data = await res.json()

    const payload = {
      city: data?.name,
      country: data?.sys?.country,
      placeName: typeof placeName === "string" ? placeName : undefined,
      tempC: Math.round(data?.main?.temp),
      feelsLikeC: Math.round(data?.main?.feels_like),
      humidity: data?.main?.humidity,
      windKmh: Math.round((data?.wind?.speed ?? 0) * 3.6),
      rainMm:
        typeof data?.rain?.["1h"] === "number"
          ? data.rain["1h"]
          : typeof data?.rain?.["3h"] === "number"
            ? data.rain["3h"]
            : 0,
      visibilityKm:
        typeof data?.visibility === "number"
          ? Math.round((data.visibility / 1000) * 10) / 10
          : null,
      condition: data?.weather?.[0]?.main,
      description: data?.weather?.[0]?.description,
      icon: data?.weather?.[0]?.icon,
      observedAt: Date.now(),
    }

    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
