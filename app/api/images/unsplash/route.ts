import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") || "city"
  const key = process.env.UNSPLASH_ACCESS_KEY

  if (!key) return NextResponse.json({ error: "Missing UNSPLASH_ACCESS_KEY" }, { status: 500 })

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    q
  )}&per_page=1&orientation=landscape`

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
    cache: "no-store",
  })
  const data = await res.json()

  const photo = data?.results?.[0]
  return NextResponse.json({
    url: photo?.urls?.regular || null,
  })
}
