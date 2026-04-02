import type { TripPlan } from "@/lib/trip-plan"

export type PlannerPreferences = {
  tripStyle: "relaxed" | "balanced" | "packed"
  interests: string[]
  dayStartTime: string
  dayEndTime: string
  mealPreferenceDinnerDaily: boolean
  transportMode: "walking" | "taxi" | "mixed"
  maxActivitiesPerDay: 3 | 4 | 5
  arrivalBufferMinutes: 60 | 90
  optionalActivitiesMax: 0 | 1 | 2 | 3
}

export type AiPlannerResponse = {
  analysis: {
    issues_found: string[]
    planning_notes: string
  }
  proposed_itinerary: {
    days: TripPlan["itinerary"]["days"]
  }
  changes_summary: Array<{
    change_type: "add" | "move" | "remove" | "reschedule" | "reorder"
    description: string
    reason: string
  }>
  budget_estimate: {
    total: number
    currency: string
  }
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isValidTime(value: unknown): boolean {
  return typeof value === "string" && HHMM_RE.test(value)
}

export function parseJsonObject(text: string): any {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Fallback: extract the first balanced JSON object to tolerate trailing text.
    const start = trimmed.indexOf("{")
    if (start < 0) throw new Error("No JSON object found in AI response.")

    let inString = false
    let escaped = false
    let depth = 0
    let end = -1

    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === "\\") {
          escaped = true
          continue
        }
        if (ch === "\"") {
          inString = false
        }
        continue
      }

      if (ch === "\"") {
        inString = true
        continue
      }
      if (ch === "{") depth++
      if (ch === "}") {
        depth--
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end < 0) throw new Error("No complete JSON object found in AI response.")
    return JSON.parse(trimmed.slice(start, end + 1))
  }
}

export function validateAiPlannerResponse(value: any): { ok: true; data: AiPlannerResponse } | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "AI response is not an object." }
  }

  const days = value?.proposed_itinerary?.days
  if (!Array.isArray(days) || days.length === 0) {
    return { ok: false, error: "proposed_itinerary.days is missing or empty." }
  }

  for (const day of days) {
    if (typeof day?.dayNumber !== "number" || !day?.date) {
      return { ok: false, error: "Every day must include dayNumber and date." }
    }
    if (!Array.isArray(day.activities)) {
      return { ok: false, error: `Day ${day.dayNumber} is missing activities.` }
    }
    for (const a of day.activities) {
      if (!isValidTime(a?.time)) {
        return { ok: false, error: `Invalid time for activity in day ${day.dayNumber}.` }
      }
    }
  }

  return { ok: true, data: value as AiPlannerResponse }
}

export function normalizeAiPlannerResponse(
  value: any,
  fallbackDateByDayNumber: Record<number, string> = {}
): any {
  if (!value || typeof value !== "object") return value

  const analysis = value.analysis || {}
  const proposedRoot = value.proposed_itinerary || value.optimized_itinerary || {}
  const rawDays = Array.isArray(proposedRoot.days) ? proposedRoot.days : []

  const days = rawDays.map((d: any, dayIdx: number) => {
    const dayNumberRaw = d?.dayNumber ?? d?.day_number ?? d?.day ?? dayIdx + 1
    const dayNumber = Number(dayNumberRaw)
    const date = String(d?.date || d?.dayDate || d?.day_date || fallbackDateByDayNumber[dayNumber] || "")
    const rawActivities = Array.isArray(d?.activities) ? d.activities : []

    const activities = rawActivities.map((a: any, idx: number) => {
      const time = String(a?.time || a?.start_time || "10:00")
      const title = String(a?.title || a?.name || "Activity")
      const typeRaw = String(a?.type || "other").toLowerCase()
      const type =
        typeRaw === "travel" || typeRaw === "hotel" || typeRaw === "sightseeing" || typeRaw === "food" || typeRaw === "other"
          ? typeRaw
          : "other"
      const locationLabel = String(a?.locationLabel || a?.location || d?.city || "")
      const durationMinutes = Number(a?.durationMinutes ?? a?.duration_minutes ?? 90)
      const cost = Number(a?.cost ?? a?.estimated_cost ?? 0)
      const currency = String(a?.currency || "USD")
      const isOptional = Boolean(a?.isOptional ?? a?.is_optional ?? false)
      const id = String(a?.id || `d${dayNumber}-activity-${idx + 1}-${time}`)
      const meta = a?.meta && typeof a.meta === "object" ? a.meta : {}

      return {
        id,
        type,
        title,
        time,
        locationLabel,
        durationMinutes,
        cost,
        currency,
        isOptional,
        meta,
      }
    })

    return {
      dayNumber: Number.isFinite(dayNumber) ? dayNumber : dayIdx + 1,
      date,
      city: String(d?.city || ""),
      title: String(d?.title || `Day ${Number.isFinite(dayNumber) ? dayNumber : dayIdx + 1}`),
      activities,
    }
  })

  return {
    analysis: {
      issues_found: Array.isArray(analysis?.issues_found) ? analysis.issues_found : [],
      planning_notes: String(analysis?.planning_notes || analysis?.optimization_strategy || ""),
    },
    proposed_itinerary: { days },
    changes_summary: Array.isArray(value?.changes_summary) ? value.changes_summary : [],
    budget_estimate: {
      total: Number(value?.budget_estimate?.total ?? value?.estimated_budget_impact?.new_total ?? 0),
      currency: String(value?.budget_estimate?.currency || "USD"),
    },
  }
}
