import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
  const { searchParams } = new URL(req.url)
  const photoReference = String(searchParams.get("ref") || "").trim()
  const maxWidth = Math.max(800, Math.min(1600, Number(searchParams.get("maxwidth") || 1600)))

  if (!apiKey || !photoReference) {
    return NextResponse.json({ error: "Missing Google photo parameters" }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${encodeURIComponent(photoReference)}&key=${apiKey}`,
      { cache: "force-cache" }
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Unable to load Google place photo" }, { status: response.status })
    }

    const contentType = response.headers.get("content-type") || "image/jpeg"
    const arrayBuffer = await response.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    })
  } catch {
    return NextResponse.json({ error: "Unable to load Google place photo" }, { status: 500 })
  }
}
