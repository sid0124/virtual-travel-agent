import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const forward = await fetch(new URL("/api/itinerary/ai/edit", req.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentItineraryJson: body?.itineraryJson || body?.currentItineraryJson,
      userRequest: body?.userInstruction || body?.userRequest,
      preferences: body?.preferences || {},
    }),
  })

  const json = await forward.json().catch(() => ({ error: "Proxy failed" }))
  if (!forward.ok) return NextResponse.json(json, { status: forward.status })
  return NextResponse.json(json)
}
