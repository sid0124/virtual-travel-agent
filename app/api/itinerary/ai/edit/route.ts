import { NextResponse } from "next/server"
import Groq from "groq-sdk"
import { normalizeAiPlannerResponse, parseJsonObject, validateAiPlannerResponse } from "@/lib/ai-itinerary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MODEL_TIMEOUT_MS = 45_000

type Body = {
  currentItineraryJson: any
  userRequest: string
  preferences: any
}

export async function POST(req: Request) {
  const started = Date.now()
  try {
    const key = process.env.GROQ_API_KEY
    if (!key) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })
    const body = (await req.json()) as Body
    if (!body?.currentItineraryJson || !body?.userRequest?.trim()) {
      return NextResponse.json({ error: "Missing currentItineraryJson or userRequest." }, { status: 400 })
    }

    const groq = new Groq({ apiKey: key })
    const selectedPlaces = (body.currentItineraryJson?.tripContext?.selectedPlaces || []).map((p: any) => p?.name).filter(Boolean)

    const system = [
      "You are Wanderly AI itinerary editor.",
      "Return strict JSON only (no markdown).",
      "Edit current itinerary per user request while preserving booked flight/hotel activities.",
      "Use selected places only for sightseeing.",
      "Keep realistic timings and buffers.",
      "Schema:",
      JSON.stringify({
        analysis: { issues_found: ["string"], planning_notes: "string" },
        proposed_itinerary: { days: [] },
        changes_summary: [{ change_type: "reschedule", description: "string", reason: "string" }],
        budget_estimate: { total: 0, currency: "USD" },
      }),
    ].join("\n")

    const user = [
      `User request: ${body.userRequest}`,
      `Preferences: ${JSON.stringify(body.preferences || {})}`,
      `Allowed places: ${JSON.stringify(selectedPlaces)}`,
      `Current itinerary JSON: ${JSON.stringify(body.currentItineraryJson)}`,
    ].join("\n\n")

    const fallbackDates: Record<number, string> = {}
    const existingDays = body?.currentItineraryJson?.itinerary?.days
    if (Array.isArray(existingDays)) {
      for (const d of existingDays) {
        const dn = Number(d?.dayNumber)
        if (Number.isFinite(dn) && d?.date) fallbackDates[dn] = String(d.date)
      }
    }

    const baseMessages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ]

    const runModel = async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) => {
      const completion = await Promise.race([
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          temperature: 0.2,
          messages,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI provider timeout. Please try again.")), MODEL_TIMEOUT_MS)
        ),
      ])
      return completion.choices?.[0]?.message?.content || ""
    }

    const rawFirst = await runModel(baseMessages)
    let parsed: any = null
    let validatedData: any = null
    let validationError: string | null = "Unknown validation error"
    let raw = rawFirst

    try {
      parsed = parseJsonObject(rawFirst)
      parsed = normalizeAiPlannerResponse(parsed, fallbackDates)
      const result = validateAiPlannerResponse(parsed)
      if (result.ok) {
        validatedData = result.data
        validationError = null
      } else {
        validationError = result.error
      }
    } catch {
      // retry below
    }

    if (!validatedData) {
      const repairPrompt = [
        "Your previous response was not valid for the required schema.",
        "Return ONLY one valid JSON object matching the schema.",
        "Do not include markdown, prose, code fences, or comments.",
        "Ensure proposed_itinerary.days is non-empty and each activity has HH:MM time.",
      ].join(" ")
      const rawSecond = await runModel([
        ...baseMessages,
        { role: "assistant", content: rawFirst },
        { role: "user", content: repairPrompt },
      ])
      raw = rawSecond
      try {
        parsed = parseJsonObject(rawSecond)
        parsed = normalizeAiPlannerResponse(parsed, fallbackDates)
      } catch (e: any) {
        return NextResponse.json(
          { error: e?.message || "Failed to parse model response.", rawResponse: rawSecond },
          { status: 502 }
        )
      }
      const second = validateAiPlannerResponse(parsed)
      if (!second.ok) {
        return NextResponse.json(
          { error: second.error, rawResponse: rawSecond },
          { status: 422 }
        )
      }
      validatedData = second.data
      validationError = null
    }

    if (!validatedData) {
      return NextResponse.json(
        { error: validationError || "Failed to validate response.", rawResponse: raw },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      data: validatedData,
      inferenceMs: Date.now() - started,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to edit itinerary." },
      { status: 500 }
    )
  }
}
