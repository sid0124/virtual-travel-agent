"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { parseJsonObject, type AiPlannerResponse, type PlannerPreferences } from "@/lib/ai-itinerary"
import type { DayPlan, TripPlan } from "@/lib/trip-plan"
import { toast } from "sonner"
import { ChevronDown, Edit2, RotateCcw, Sparkles, Trash2 } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  plan: TripPlan
  initialDraft: AiPlannerResponse | null
  startAtPreview?: boolean
  onAcceptPlan: (draft: AiPlannerResponse) => void
  onDraftGenerated: (draft: AiPlannerResponse) => void
}

const INTEREST_OPTIONS = ["Food", "Museums", "Shopping", "Nature", "Nightlife", "Family"]
const TRIP_STYLES = ["relaxed", "balanced", "packed"] as const
const TRANSPORT = ["walking", "taxi", "mixed"] as const
const PROGRESS_MSGS = ["Analyzing trip...", "Building day plan...", "Optimizing timing..."]

const API_TIMEOUT_MS = 70_000

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function defaultPrefs(): PlannerPreferences {
  return {
    tripStyle: "balanced",
    interests: [],
    dayStartTime: "09:00",
    dayEndTime: "21:30",
    mealPreferenceDinnerDaily: true,
    transportMode: "mixed",
    maxActivitiesPerDay: 4,
    arrivalBufferMinutes: 90,
    optionalActivitiesMax: 2,
  }
}

function parseApiPayload(rawText: string): any {
  try {
    return JSON.parse(rawText)
  } catch {
    return parseJsonObject(rawText)
  }
}

function safeFormatDayDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Date TBD"
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return format(dt, "MMM d")
}

async function fetchTextWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    const rawText = await res.text()
    return { res, rawText }
  } finally {
    clearTimeout(timer)
  }
}

async function runWithTimeout<T>(work: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return await Promise.race([
    work,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    }),
  ])
}

export function AiPlannerModal({
  open,
  onOpenChange,
  plan,
  initialDraft,
  startAtPreview = false,
  onAcceptPlan,
  onDraftGenerated,
}: Props) {
  const hasInitializedForOpen = useRef(false)
  const [step, setStep] = useState(1)
  const [prefs, setPrefs] = useState<PlannerPreferences>(defaultPrefs())
  const [loading, setLoading] = useState(false)
  const [progressIdx, setProgressIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [draft, setDraft] = useState<AiPlannerResponse | null>(null)
  const [inferenceMs, setInferenceMs] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<number[]>([])
  const [editMode, setEditMode] = useState(false)
  const [editPrompt, setEditPrompt] = useState("")

  const selectedPlaces = useMemo(() => Array.isArray(plan.tripContext.selectedPlaces) ? plan.tripContext.selectedPlaces : [], [plan])

  useEffect(() => {
    if (!open) {
      hasInitializedForOpen.current = false
      return
    }
    if (hasInitializedForOpen.current) return
    hasInitializedForOpen.current = true

    setStep(startAtPreview && initialDraft ? 5 : 1)
    setDraft(initialDraft)
    setEditMode(false)
    setEditPrompt("")
    setInferenceMs(null)
    setErrorMsg(null)
    setExpandedDays(initialDraft ? initialDraft.proposed_itinerary.days.slice(0, 2).map((d) => d.dayNumber) : [])
  }, [open, startAtPreview, initialDraft])

  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setProgressIdx((i) => (i + 1) % PROGRESS_MSGS.length), 1300)
    return () => clearInterval(t)
  }, [loading])

  useEffect(() => {
    if (!loading) return
    const watchdog = setTimeout(() => {
      setLoading(false)
      setErrorMsg("AI request timed out. Please try again.")
      toast.error("AI request timed out. Please try again.")
    }, API_TIMEOUT_MS + 5000)
    return () => clearTimeout(watchdog)
  }, [loading])

  const toggleInterest = (interest: string) => {
    setPrefs((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((x) => x !== interest)
        : [...prev.interests, interest],
    }))
  }

  const callGenerate = async () => {
    setLoading(true)
    setProgressIdx(0)
    setErrorMsg(null)
    try {
      const { res, rawText } = await runWithTimeout(
        fetchTextWithTimeout("/api/itinerary/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripContext: plan.tripContext,
            bookings: plan.bookings,
            selectedPlaces,
            preferences: prefs,
          }),
        }),
        API_TIMEOUT_MS + 5000,
        "AI planning timed out. Please try again."
      )
      let data: any
      try {
        data = parseApiPayload(rawText)
      } catch {
        console.error("ai-generate invalid payload", rawText)
        throw new Error("Invalid server response while generating itinerary.")
      }
      if (!res.ok || !data?.success || !data?.data) {
        throw new Error(data?.error || "Failed to generate itinerary")
      }

      const generated = data.data as AiPlannerResponse
      setDraft(generated)
      setInferenceMs(typeof data.inferenceMs === "number" ? data.inferenceMs : null)
      setExpandedDays(generated.proposed_itinerary.days.slice(0, 2).map((d) => d.dayNumber))
      setStep(5)
      try {
        onDraftGenerated(generated)
      } catch (err) {
        console.error("onDraftGenerated failed", err)
      }
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "AI planning timed out. Please try again."
          : e?.message || "We couldn't generate itinerary. Please try again."
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const callEdit = async (request: string) => {
    if (!draft) return
    setLoading(true)
    setProgressIdx(0)
    setErrorMsg(null)
    try {
      const currentItineraryJson = {
        ...plan,
        itinerary: { days: draft.proposed_itinerary.days },
      }
      const { res, rawText } = await runWithTimeout(
        fetchTextWithTimeout("/api/itinerary/ai/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentItineraryJson,
            userRequest: request,
            preferences: prefs,
          }),
        }),
        API_TIMEOUT_MS + 5000,
        "AI edit timed out. Please try again."
      )
      let data: any
      try {
        data = parseApiPayload(rawText)
      } catch {
        console.error("ai-edit invalid payload", rawText)
        throw new Error("Invalid server response while editing itinerary.")
      }
      if (!res.ok || !data?.success || !data?.data) {
        throw new Error(data?.error || "Failed to edit itinerary")
      }
      const edited = data.data as AiPlannerResponse
      setDraft(edited)
      setInferenceMs(typeof data.inferenceMs === "number" ? data.inferenceMs : null)
      try {
        onDraftGenerated(edited)
      } catch (err) {
        console.error("onDraftGenerated failed", err)
      }
      setEditPrompt("")
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "AI edit timed out. Please try again."
          : e?.message || "We couldn't edit itinerary. Please try again."
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const updateActivityTime = (dayNumber: number, activityId: string, time: string) => {
    if (!draft) return
    const next = deepClone(draft)
    for (const day of next.proposed_itinerary.days) {
      if (day.dayNumber !== dayNumber) continue
      const target = day.activities.find((a) => a.id === activityId)
      if (target) target.time = time
    }
    setDraft(next)
    onDraftGenerated(next)
  }

  const removeActivity = (dayNumber: number, activityId: string) => {
    if (!draft) return
    const next = deepClone(draft)
    for (const day of next.proposed_itinerary.days) {
      if (day.dayNumber !== dayNumber) continue
      const target = day.activities.find((a) => a.id === activityId)
      if (target?.meta?.flightId || target?.meta?.hotelId || target?.type === "travel" || target?.type === "hotel") {
        toast.error("Booked travel/hotel activity cannot be removed.")
        return
      }
      day.activities = day.activities.filter((a) => a.id !== activityId)
    }
    setDraft(next)
    onDraftGenerated(next)
  }

  const moveActivityToDay = (fromDayNumber: number, activityId: string, toDayNumber: number) => {
    if (!draft || fromDayNumber === toDayNumber) return
    const next = deepClone(draft)
    const from = next.proposed_itinerary.days.find((d) => d.dayNumber === fromDayNumber)
    const to = next.proposed_itinerary.days.find((d) => d.dayNumber === toDayNumber)
    if (!from || !to) return
    const idx = from.activities.findIndex((a) => a.id === activityId)
    if (idx < 0) return
    const [activity] = from.activities.splice(idx, 1)
    if (activity.meta?.flightId || activity.meta?.hotelId || activity.type === "travel" || activity.type === "hotel") {
      from.activities.splice(idx, 0, activity)
      toast.error("Booked travel/hotel activity cannot be moved.")
      return
    }
    to.activities.push(activity)
    to.activities.sort((a, b) => a.time.localeCompare(b.time))
    setDraft(next)
    onDraftGenerated(next)
  }

  const addOptionalActivity = (dayNumber: number, placeName: string) => {
    if (!draft) return
    const next = deepClone(draft)
    const day = next.proposed_itinerary.days.find((d) => d.dayNumber === dayNumber)
    if (!day) return
    day.activities.push({
      id: `d${dayNumber}-optional-${placeName.replace(/\s+/g, "")}-17:00`,
      type: "sightseeing",
      title: `Optional: Visit ${placeName}`,
      time: "17:00",
      locationLabel: `${day.city}, ${plan.tripContext.selectedPlaces?.[0]?.country || ""}`.trim(),
      durationMinutes: 90,
      cost: 0,
      currency: "USD",
      isOptional: true,
      meta: { placeId: placeName },
    } as any)
    day.activities.sort((a, b) => a.time.localeCompare(b.time))
    setDraft(next)
    onDraftGenerated(next)
  }

  const regenerateDay = (dayNumber: number) => {
    callEdit(`Regenerate day ${dayNumber} with realistic pacing and buffers. Keep all booked activities.`)
  }

  const stepContent = () => {
    if (loading) {
      return (
        <div className="rounded-md border p-6 text-center">
          <p className="text-sm text-muted-foreground">{PROGRESS_MSGS[progressIdx]}</p>
        </div>
      )
    }

    if (step === 1) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Trip details (prefilled from your itinerary)</p>
          <div className="grid gap-3 md:grid-cols-2">
            <Card><CardContent className="p-3 text-sm">Destination: {plan.itinerary.days[0]?.city || "N/A"}</CardContent></Card>
            <Card><CardContent className="p-3 text-sm">Travelers: {plan.tripContext.travelersCount || plan.tripContext.travelers || 1}</CardContent></Card>
            <Card><CardContent className="p-3 text-sm">Dates: {plan.tripContext.startDate?.slice(0, 10)} to {plan.tripContext.endDate?.slice(0, 10)}</CardContent></Card>
            <Card><CardContent className="p-3 text-sm">Budget: {plan.tripContext.budgetLevel || "medium"}</CardContent></Card>
          </div>
          <p className="text-xs text-muted-foreground">Selected places: {selectedPlaces.map((p: any) => p.name).join(", ") || "None"}</p>
        </div>
      )
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Trip style</p>
            <div className="flex flex-wrap gap-2">
              {TRIP_STYLES.map((style) => (
                <Button key={style} variant={prefs.tripStyle === style ? "default" : "outline"} size="sm" onClick={() => setPrefs((p) => ({ ...p, tripStyle: style }))}>
                  {style}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Interests</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((i) => (
                <Button key={i} variant={prefs.interests.includes(i) ? "default" : "outline"} size="sm" onClick={() => toggleInterest(i)}>
                  {i}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><p className="mb-1 text-xs text-muted-foreground">Daily start time</p><Input value={prefs.dayStartTime} onChange={(e) => setPrefs((p) => ({ ...p, dayStartTime: e.target.value }))} /></div>
            <div><p className="mb-1 text-xs text-muted-foreground">Return by time</p><Input value={prefs.dayEndTime} onChange={(e) => setPrefs((p) => ({ ...p, dayEndTime: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={prefs.mealPreferenceDinnerDaily} onCheckedChange={(v) => setPrefs((p) => ({ ...p, mealPreferenceDinnerDaily: Boolean(v) }))} />
            <span className="text-sm">Include one dinner daily</span>
          </div>
        </div>
      )
    }

    if (step === 3) {
      return (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Transport mode</p>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT.map((mode) => (
                <Button key={mode} variant={prefs.transportMode === mode ? "default" : "outline"} size="sm" onClick={() => setPrefs((p) => ({ ...p, transportMode: mode }))}>
                  {mode}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Max activities/day</p>
              <Input type="number" min={3} max={5} value={prefs.maxActivitiesPerDay} onChange={(e) => setPrefs((p) => ({ ...p, maxActivitiesPerDay: Math.max(3, Math.min(5, Number(e.target.value || 4))) as 3 | 4 | 5 }))} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Arrival buffer (mins)</p>
              <Input type="number" min={60} max={90} step={30} value={prefs.arrivalBufferMinutes} onChange={(e) => setPrefs((p) => ({ ...p, arrivalBufferMinutes: (Number(e.target.value || 90) >= 90 ? 90 : 60) as 60 | 90 }))} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Optional activities max</p>
              <Input type="number" min={0} max={3} value={prefs.optionalActivitiesMax} onChange={(e) => setPrefs((p) => ({ ...p, optionalActivitiesMax: Math.max(0, Math.min(3, Number(e.target.value || 2))) as 0 | 1 | 2 | 3 }))} />
            </div>
          </div>
        </div>
      )
    }

    if (step === 4) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">Confirm your planning inputs</p>
          <div className="rounded-md border p-3 text-sm">
            <p>Trip style: {prefs.tripStyle}</p>
            <p>Interests: {prefs.interests.join(", ") || "None selected"}</p>
            <p>Daily window: {prefs.dayStartTime} - {prefs.dayEndTime}</p>
            <p>Transport: {prefs.transportMode}</p>
            <p>Max activities/day: {prefs.maxActivitiesPerDay}</p>
            <p>Arrival buffer: {prefs.arrivalBufferMinutes} mins</p>
            <p>Optional max: {prefs.optionalActivitiesMax}</p>
            <p>Dinner daily: {prefs.mealPreferenceDinnerDaily ? "Yes" : "No"}</p>
          </div>
          <Button className="w-full gap-2" onClick={callGenerate}>
            <Sparkles className="h-4 w-4" />
            Generate Itinerary with AI
          </Button>
        </div>
      )
    }

    if (step === 5 && draft) {
      return (
        <div className="space-y-4">
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium text-foreground">Why this plan</p>
            <p className="text-sm text-muted-foreground">{draft.analysis.planning_notes}</p>
            {typeof inferenceMs === "number" && (
              <p className="mt-1 text-xs text-muted-foreground">Inference time: {(inferenceMs / 1000).toFixed(2)}s</p>
            )}
          </div>

          <div className="space-y-3">
            {draft.proposed_itinerary.days.map((day) => (
              <Collapsible key={day.dayNumber} open={expandedDays.includes(day.dayNumber)} onOpenChange={() => setExpandedDays((prev) => prev.includes(day.dayNumber) ? prev.filter((d) => d !== day.dayNumber) : [...prev, day.dayNumber])}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer py-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Day {day.dayNumber} • {safeFormatDayDate(day.date)} • {day.title}</CardTitle>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-2">
                      {day.activities.map((a: any) => (
                        <div key={a.id} className="rounded-md border p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{a.time}</span>
                                <span className="text-sm">{a.title}</span>
                                {(a.meta?.flightId || a.meta?.hotelId) && <Badge variant="secondary" className="text-[10px]">Booked</Badge>}
                                {a.isOptional && <Badge variant="outline" className="text-[10px]">Optional</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">{a.locationLabel} • {a.cost > 0 ? `${a.currency} ${a.cost}` : "Free"}</p>
                            </div>
                            {editMode && (
                              <div className="flex items-center gap-1">
                                <Input className="h-8 w-24 text-xs" value={a.time} onChange={(e) => updateActivityTime(day.dayNumber, a.id, e.target.value)} />
                                <select
                                  className="h-8 rounded-md border bg-background px-2 text-xs"
                                  value={day.dayNumber}
                                  onChange={(e) => moveActivityToDay(day.dayNumber, a.id, Number(e.target.value))}
                                >
                                  {draft.proposed_itinerary.days.map((d) => (
                                    <option key={d.dayNumber} value={d.dayNumber}>Day {d.dayNumber}</option>
                                  ))}
                                </select>
                                <Button variant="ghost" size="icon" onClick={() => removeActivity(day.dayNumber, a.id)}><Trash2 className="h-4 w-4" /></Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {editMode && (
                        <div className="flex flex-wrap gap-2">
                          {selectedPlaces.map((p: any) => (
                            <Button key={`${day.dayNumber}-${p.name}`} size="sm" variant="outline" onClick={() => addOptionalActivity(day.dayNumber, p.name)}>
                              Add optional {p.name}
                            </Button>
                          ))}
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => regenerateDay(day.dayNumber)}>
                            <RotateCcw className="h-3 w-3" />
                            Regenerate this day
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Ask AI to modify specific parts</p>
            <div className="flex gap-2">
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Move Central Park to morning and dinner to 8pm"
                className="min-h-[70px]"
              />
              <Button disabled={!editPrompt.trim() || loading} onClick={() => callEdit(editPrompt)}>Apply AI Edit</Button>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Trip Planner</DialogTitle>
          <DialogDescription>Plan and refine your itinerary with AI, right here.</DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        {stepContent()}

        <DialogFooter>
          {step > 1 && step < 5 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={loading}>
              Back
            </Button>
          )}
          {step < 4 && (
            <Button onClick={() => setStep((s) => s + 1)} disabled={loading}>
              Next
            </Button>
          )}

          {step === 5 && draft && (
            <>
              <Button variant="outline" className="gap-1" onClick={() => setEditMode((v) => !v)}>
                <Edit2 className="h-3.5 w-3.5" />
                {editMode ? "Stop editing" : "Edit Plan"}
              </Button>
              <Button variant="outline" className="gap-1" onClick={callGenerate} disabled={loading}>
                <RotateCcw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button
                onClick={() => {
                  onAcceptPlan(draft)
                  onOpenChange(false)
                }}
              >
                Accept Plan
              </Button>
            </>
          )}
          {step === 5 && editMode && draft && (
            <Button onClick={() => { onAcceptPlan(draft); onOpenChange(false) }}>
              Apply Updates
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


