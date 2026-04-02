import { NextResponse } from "next/server"
import Groq from "groq-sdk"
import { normalizeAiPlannerResponse, parseJsonObject, validateAiPlannerResponse } from "@/lib/ai-itinerary"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const MODEL_TIMEOUT_MS = 45_000

type Body = {
  tripContext: any
  bookings: any
  selectedPlaces: any[]
  preferences: any
}

function normalizeInterestList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean)
}

function isBookedActivity(activity: any): boolean {
  return Boolean(
    activity?.meta?.flightId ||
    activity?.meta?.hotelId ||
    activity?.type === "travel" ||
    activity?.type === "hotel"
  )
}

function isGenericTitle(title: unknown): boolean {
  const t = String(title || "").trim().toLowerCase()
  return !t || t === "activity" || t === "free" || t === "free time" || t.includes("explore nearby")
}

function nextTimeSlot(idx: number): string {
  const slots = ["09:30", "11:30", "13:30", "16:00", "19:00"]
  return slots[idx % slots.length]
}

function uniqueCityList(body: Body): string[] {
  const fromSelected = (Array.isArray(body?.selectedPlaces) ? body.selectedPlaces : [])
    .map((p: any) => String(p?.city || "").trim())
    .filter(Boolean)
  const fromTripContextSelected = (Array.isArray(body?.tripContext?.selectedPlaces) ? body.tripContext.selectedPlaces : [])
    .map((p: any) => String(p?.city || "").trim())
    .filter(Boolean)
  const fromRouteOrder = (Array.isArray(body?.tripContext?.routeOrder) ? body.tripContext.routeOrder : [])
    .map((c: any) => String(c || "").trim())
    .filter(Boolean)
  const all = [...fromRouteOrder, ...fromTripContextSelected, ...fromSelected]
  const dedup = [...new Set(all)]
  return dedup.length ? dedup : [String(body?.tripContext?.selectedPlaces?.[0]?.city || "Destination")]
}

function chooseCityForDay(dayIdx: number, day: any, body: Body): string {
  const dayCity = String(day?.city || "").trim()
  if (dayCity) return dayCity
  const cities = uniqueCityList(body)
  return cities[dayIdx % cities.length] || "Destination"
}

function buildSuggestedTitle(
  city: string,
  placeName: string,
  interests: string[],
  slotIdx: number,
  dayIdx: number
): { title: string; type: string } {
  const theme = dayIdx % 4

  if (slotIdx === 0) {
    if (theme === 0) return { title: `Signature landmark: ${placeName}`, type: "sightseeing" }
    if (theme === 1) return { title: `Hidden gems walk in ${city}`, type: "sightseeing" }
    if (theme === 2 && interests.includes("nature")) return { title: `Morning green escape in ${city}`, type: "sightseeing" }
    return { title: `Old town exploration in ${city}`, type: "sightseeing" }
  }
  if (slotIdx === 1) {
    if (theme === 1) return { title: "Street-food tasting lunch", type: "food" }
    if (theme === 3) return { title: "Cafe break at a local favorite", type: "food" }
    return { title: "Lunch at a local restaurant", type: "food" }
  }
  if (slotIdx === 2) {
    if (interests.includes("museums")) return { title: `Museum and culture session in ${city}`, type: "sightseeing" }
    if (interests.includes("shopping")) return { title: `Shopping district walk in ${city}`, type: "sightseeing" }
    if (theme === 2) return { title: `Neighborhood immersion in ${city}`, type: "sightseeing" }
    return { title: `City highlights tour in ${city}`, type: "sightseeing" }
  }
  if (slotIdx === 3) {
    if (interests.includes("nightlife")) return { title: `Evening nightlife in ${city}`, type: "other" }
    if (theme === 0) return { title: `Sunset riverfront stroll in ${city}`, type: "sightseeing" }
    if (theme === 1) return { title: `Rooftop viewpoints in ${city}`, type: "sightseeing" }
    return { title: `Sunset viewpoints in ${city}`, type: "sightseeing" }
  }
  if (interests.includes("family")) return { title: `Family-friendly dinner in ${city}`, type: "food" }
  return { title: `Dinner and local flavors in ${city}`, type: "food" }
}

function choosePlaceNameForDay(dayIdx: number, slotIdx: number, selectedPlaceNames: string[], city: string): string {
  if (!selectedPlaceNames.length) return `Top attraction in ${city}`
  const index = (dayIdx * 3 + slotIdx) % selectedPlaceNames.length
  return selectedPlaceNames[index]
}

function diversifyDuplicateTitles(days: any[]): { days: any[]; changed: number } {
  const seen = new Map<string, number>()
  let changed = 0
  const updated = days.map((day: any) => {
    const nextActivities = (Array.isArray(day?.activities) ? day.activities : []).map((a: any, idx: number) => {
      if (isBookedActivity(a)) return a
      const key = String(a?.title || "").trim().toLowerCase()
      if (!key) return a
      const count = (seen.get(key) || 0) + 1
      seen.set(key, count)
      if (count <= 1) return a
      changed++
      const city = String(day?.city || "city")
      const suffixes = ["with local guide", "via scenic route", "in a different district", "with photo stops"]
      const suffix = suffixes[(count + idx) % suffixes.length]
      return {
        ...a,
        title: `${a.title} (${city}, ${suffix})`,
      }
    })
    return { ...day, activities: nextActivities }
  })
  return { days: updated, changed }
}

function enrichWeakItinerary(data: any, body: Body, fallbackDates: Record<number, string>): any {
  const days = data?.proposed_itinerary?.days
  if (!Array.isArray(days) || days.length === 0) return data

  const selectedPlaces = Array.isArray(body?.selectedPlaces) ? body.selectedPlaces : []
  const selectedPlaceNames = selectedPlaces.map((p: any) => String(p?.name || "")).filter(Boolean)
  const interests = normalizeInterestList(body?.preferences?.interests)
  const maxActivities = Number(body?.preferences?.maxActivitiesPerDay || 4)
  const minActivities = Math.max(3, Math.min(4, Number.isFinite(maxActivities) ? maxActivities : 4))
  const currency = body?.tripContext?.currency || "USD"
  const defaultCity =
    body?.tripContext?.selectedPlaces?.[0]?.city ||
    body?.tripContext?.destinations?.[0]?.name ||
    "Destination"

  let weakCount = 0

  const nextDays = days.map((day: any, dayIdx: number) => {
    const dayNumber = Number(day?.dayNumber) || dayIdx + 1
    const city = chooseCityForDay(dayIdx, day, body) || defaultCity
    const date = String(day?.date || fallbackDates[dayNumber] || "")
    const sourceActivities = Array.isArray(day?.activities) ? day.activities : []

    const preserved = sourceActivities.filter((a: any) => isBookedActivity(a))
    let editable = sourceActivities.filter((a: any) => !isBookedActivity(a))

    editable = editable.map((a: any, idx: number) => {
      if (!isGenericTitle(a?.title)) {
        return {
          ...a,
          time: String(a?.time || nextTimeSlot(idx)),
          locationLabel: String(a?.locationLabel || city),
          currency: String(a?.currency || currency),
        }
      }
      weakCount++
      const placeName = choosePlaceNameForDay(dayIdx, idx, selectedPlaceNames, city)
      const suggestion = buildSuggestedTitle(city, placeName, interests, idx, dayIdx)
      return {
        ...a,
        id: String(a?.id || `d${dayNumber}-suggested-${idx + 1}`),
        title: suggestion.title,
        type: suggestion.type,
        time: String(a?.time || nextTimeSlot(idx)),
        locationLabel: String(a?.locationLabel || city),
        durationMinutes: Number(a?.durationMinutes || 90),
        cost: Number(a?.cost || 0),
        currency: String(a?.currency || currency),
        isOptional: Boolean(a?.isOptional),
        meta: a?.meta && typeof a.meta === "object" ? a.meta : {},
      }
    })

    while (preserved.length + editable.length < minActivities) {
      const idx = editable.length
      const placeName = choosePlaceNameForDay(dayIdx, idx, selectedPlaceNames, city)
      const suggestion = buildSuggestedTitle(city, placeName, interests, idx, dayIdx)
      editable.push({
        id: `d${dayNumber}-added-${idx + 1}`,
        title: suggestion.title,
        type: suggestion.type,
        time: nextTimeSlot(idx),
        locationLabel: city,
        durationMinutes: suggestion.type === "food" ? 75 : 90,
        cost: suggestion.type === "food" ? 20 : 0,
        currency,
        isOptional: idx >= minActivities - 1,
        meta: {},
      })
      weakCount++
    }

    const activities = [...preserved, ...editable].sort((a: any, b: any) => String(a?.time || "").localeCompare(String(b?.time || "")))
    const title = isGenericTitle(day?.title) ? `Discover ${city}` : String(day?.title)
    return { ...day, dayNumber, city, date, title, activities }
  })

  const diversified = diversifyDuplicateTitles(nextDays)
  const totalChanged = weakCount + diversified.changed
  if (totalChanged === 0) return data

  return {
    ...data,
    analysis: {
      issues_found: Array.isArray(data?.analysis?.issues_found)
        ? [...data.analysis.issues_found, "Weak/repeated AI suggestions were auto-enhanced."]
        : ["Weak/repeated AI suggestions were auto-enhanced."],
      planning_notes: String(data?.analysis?.planning_notes || "Plan was enhanced with concrete daily suggestions."),
    },
    proposed_itinerary: { days: diversified.days },
    changes_summary: [
      ...(Array.isArray(data?.changes_summary) ? data.changes_summary : []),
      { change_type: "add", description: "Filled generic activities with specific suggestions.", reason: "Improve itinerary usefulness." },
      { change_type: "reorder", description: "Diversified repeated activities across days.", reason: "Avoid same-day pattern repetition." },
    ],
  }
}

function buildFallbackPlannerResponse(body: Body, fallbackDates: Record<number, string>) {
  const startRaw = body?.tripContext?.startDate || body?.tripContext?.dateRange?.from
  const start = startRaw ? new Date(startRaw) : new Date()
  const tripDuration =
    Number(body?.tripContext?.tripDuration) > 0
      ? Number(body?.tripContext?.tripDuration)
      : Math.max(1, Object.keys(fallbackDates).length || 3)

  const selectedPlaces = Array.isArray(body?.selectedPlaces) ? body.selectedPlaces : []
  const fallbackCity =
    body?.tripContext?.selectedPlaces?.[0]?.city ||
    body?.tripContext?.destinations?.[0]?.name ||
    selectedPlaces?.[0]?.city ||
    selectedPlaces?.[0]?.name ||
    "Destination"
  const fallbackCountry = body?.tripContext?.selectedPlaces?.[0]?.country || ""
  const currency = body?.tripContext?.currency || "USD"

  const days = Array.from({ length: tripDuration }).map((_, i) => {
    const dayNumber = i + 1
    const dt = fallbackDates[dayNumber]
      ? fallbackDates[dayNumber]
      : new Date(start.getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const place = selectedPlaces[i % Math.max(1, selectedPlaces.length)]
    const placeName = place?.name || `Explore ${fallbackCity}`

    return {
      dayNumber,
      date: dt,
      city: fallbackCity,
      title: dayNumber === 1 ? `Arrival in ${fallbackCity}` : `Discover ${fallbackCity}`,
      activities: [
        {
          id: `d${dayNumber}-morning`,
          type: "sightseeing",
          title: dayNumber === 1 ? `Light orientation walk in ${fallbackCity}` : `Visit ${placeName}`,
          time: "10:00",
          locationLabel: [fallbackCity, fallbackCountry].filter(Boolean).join(", "),
          durationMinutes: 120,
          cost: 0,
          currency,
          isOptional: false,
          meta: {},
        },
        {
          id: `d${dayNumber}-lunch`,
          type: "food",
          title: "Lunch at local restaurant",
          time: "13:00",
          locationLabel: fallbackCity,
          durationMinutes: 75,
          cost: 20,
          currency,
          isOptional: false,
          meta: {},
        },
        {
          id: `d${dayNumber}-evening`,
          type: "sightseeing",
          title: `Evening highlights in ${fallbackCity}`,
          time: "17:00",
          locationLabel: fallbackCity,
          durationMinutes: 120,
          cost: 0,
          currency,
          isOptional: true,
          meta: {},
        },
      ],
    }
  })

  return {
    analysis: {
      issues_found: ["AI provider was unavailable or returned invalid output."],
      planning_notes: "Generated a safe fallback itinerary. You can regenerate to get a richer AI plan.",
    },
    proposed_itinerary: { days },
    changes_summary: [
      { change_type: "add", description: "Created fallback day plans", reason: "AI response was unavailable." },
    ],
    budget_estimate: {
      total: days.length * 20,
      currency,
    },
  }
}

export async function POST(req: Request) {
  const started = Date.now()
  try {
    const key = process.env.GROQ_API_KEY
    if (!key) return NextResponse.json({ error: "Missing GROQ_API_KEY" }, { status: 500 })

    const body = (await req.json()) as Body
    if (!body?.tripContext || !body?.preferences) {
      return NextResponse.json({ error: "Missing required payload fields." }, { status: 400 })
    }

    const groq = new Groq({ apiKey: key })
    const selectedPlaceNames = (Array.isArray(body.selectedPlaces) ? body.selectedPlaces : []).map((p: any) => p?.name).filter(Boolean)

    const system = [
      "You are Wanderly AI Trip Planner.",
      "Return strict JSON only (no markdown).",
      "Use routeOrder/segments/cities from tripContext and do not hallucinate cities.",
      "Use selectedPlaces only for sightseeing.",
      "Preserve bookings from bookings payload (flight/hotel activities).",
      "Arrival day: no sightseeing before arrival; add buffer before check-in/dinner.",
      "Respect maxActivitiesPerDay and buffers.",
      "Output schema exactly:",
      JSON.stringify({
        analysis: { issues_found: ["string"], planning_notes: "string" },
        proposed_itinerary: { days: [] },
        changes_summary: [{ change_type: "add", description: "string", reason: "string" }],
        budget_estimate: { total: 0, currency: "USD" },
      }),
    ].join("\n")

    const user = [
      `Allowed places: ${JSON.stringify(selectedPlaceNames)}`,
      `Trip context: ${JSON.stringify(body.tripContext)}`,
      `Bookings: ${JSON.stringify(body.bookings || {})}`,
      `Preferences: ${JSON.stringify(body.preferences)}`,
    ].join("\n\n")

    const buildFallbackDateByDayNumber = () => {
      const out: Record<number, string> = {}
      const startRaw = body?.tripContext?.startDate || body?.tripContext?.dateRange?.from
      const endRaw = body?.tripContext?.endDate || body?.tripContext?.dateRange?.to
      const start = startRaw ? new Date(startRaw) : null
      const end = endRaw ? new Date(endRaw) : null
      let count = Number(body?.tripContext?.tripDuration || 0)
      if ((!Number.isFinite(count) || count <= 0) && start && end) {
        const ms = end.getTime() - start.getTime()
        count = Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1)
      }
      if (!start || !Number.isFinite(count) || count <= 0) return out
      for (let i = 0; i < count; i++) {
        const dt = new Date(start)
        dt.setDate(start.getDate() + i)
        out[i + 1] = dt.toISOString().slice(0, 10)
      }
      return out
    }
    const fallbackDates = buildFallbackDateByDayNumber()

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
      // handled with retry below
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
        const fallback = buildFallbackPlannerResponse(body, fallbackDates)
        return NextResponse.json({
          success: true,
          data: fallback,
          inferenceMs: Date.now() - started,
          fallback: true,
          error: second.error,
        })
      }
      validatedData = second.data
      validationError = null
    }

    if (!validatedData) {
      const fallback = buildFallbackPlannerResponse(body, fallbackDates)
      return NextResponse.json({
        success: true,
        data: fallback,
        inferenceMs: Date.now() - started,
        fallback: true,
        error: validationError || "Failed to validate response.",
      })
    }

    validatedData = enrichWeakItinerary(validatedData, body, fallbackDates)

    return NextResponse.json({
      success: true,
      data: validatedData,
      inferenceMs: Date.now() - started,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to generate itinerary." },
      { status: 500 }
    )
  }
}
