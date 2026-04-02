import type { StructuredOptimizationResponse, TripPlan } from "@/lib/trip-plan"

export const AI_EDITS_RESULT_KEY = "wanderly_ai_edits_result"
export const PREVIOUS_ITINERARY_SNAPSHOT_KEY = "wanderly_previous_itinerary_snapshot"

export function readAiEditsResult(): StructuredOptimizationResponse | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(AI_EDITS_RESULT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StructuredOptimizationResponse
  } catch {
    return null
  }
}

export function saveAiEditsResult(result: StructuredOptimizationResponse): void {
  if (typeof window === "undefined") return
  localStorage.setItem(AI_EDITS_RESULT_KEY, JSON.stringify(result))
}

export function readPreviousItinerarySnapshot(): TripPlan | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(PREVIOUS_ITINERARY_SNAPSHOT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TripPlan
  } catch {
    return null
  }
}

export function savePreviousItinerarySnapshot(plan: TripPlan): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PREVIOUS_ITINERARY_SNAPSHOT_KEY, JSON.stringify(plan))
}
