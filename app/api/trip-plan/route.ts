import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { applyStructuredOptimizationResponse, applyTripEdits } from "@/lib/trip-plan"
import type { StructuredOptimizationResponse, TripEditRequest, TripPlan } from "@/lib/trip-plan"

export async function GET() {
    const cookieStore = await cookies()
    const val = cookieStore.get("trip_plan")
    const plan = val ? JSON.parse(val.value) : {}
    return NextResponse.json({ plan })
}

export async function POST(req: Request) {
    const data = await req.json()
    const cookieStore = await cookies()

    const val = cookieStore.get("trip_plan")
    const existing = val ? JSON.parse(val.value) : {}

    const merged = { ...existing, ...data }

    cookieStore.set("trip_plan", JSON.stringify(merged))

    return NextResponse.json({ success: true, plan: merged })
}

export async function PATCH(req: Request) {
    const body = await req.json().catch(() => null) as {
        plan?: TripPlan
        edits?: TripEditRequest | StructuredOptimizationResponse
    } | null
    if (!body?.plan || !body?.edits) {
        return NextResponse.json(
            { success: false, error: "Invalid payload. Expected { plan, edits }." },
            { status: 400 }
        )
    }

    let result
    if (Array.isArray((body.edits as StructuredOptimizationResponse)?.optimized_itinerary?.days)) {
        result = applyStructuredOptimizationResponse(body.plan, body.edits as StructuredOptimizationResponse)
    } else if (Array.isArray((body.edits as TripEditRequest)?.changes)) {
        result = applyTripEdits(body.plan, body.edits as TripEditRequest)
    } else {
        return NextResponse.json(
            { success: false, error: "Invalid edits. Provide either optimized_itinerary.days[] or changes[] payload." },
            { status: 400 }
        )
    }

    return NextResponse.json({
        success: true,
        plan: result.plan,
        validationNotes: result.validationNotes,
    })
}
