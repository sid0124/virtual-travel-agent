import { NextResponse } from "next/server"

type GeoNamesResp = {
  geonames?: Array<{
    geonameId: number
    name: string
    countryName: string
    countryCode: string
    adminName1?: string
    lat: string
    lng: string
    population?: number
    fcl?: string
    fcode?: string
  }>
  status?: { message?: string; value?: number }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const country = searchParams.get("country")?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const username = process.env.GEONAMES_USERNAME
    if (!username) {
      return NextResponse.json(
        { error: "Missing GEONAMES_USERNAME in .env.local" },
        { status: 500 }
      )
    }

    const url = new URL("https://api.geonames.org/searchJSON")
    url.searchParams.set("q", q)
    url.searchParams.set("maxRows", "10")
    url.searchParams.set("featureClass", "P") // populated places
    url.searchParams.set("style", "FULL")
    url.searchParams.set("username", username)
    if (country) url.searchParams.set("country", country)

    const res = await fetch(url.toString(), { cache: "no-store" })
    const data = (await res.json()) as GeoNamesResp

    if (!res.ok) {
      return NextResponse.json({ error: "GeoNames request failed" }, { status: 500 })
    }

    if (data.status?.message) {
      return NextResponse.json(
        { error: `GeoNames: ${data.status.message}` },
        { status: 500 }
      )
    }

    const results =
      (data.geonames || []).map((g) => ({
        id: g.geonameId,
        name: g.name,
        country: g.countryName,
        countryCode: g.countryCode,
        state: g.adminName1 || "",
        lat: g.lat,
        lon: g.lng,
        population: g.population || 0,
      })) || []

    return NextResponse.json({ results })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown server error" },
      { status: 500 }
    )
  }
}
