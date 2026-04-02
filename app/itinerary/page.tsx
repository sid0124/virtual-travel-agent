"use client"

import { useEffect, useMemo, useState } from "react"
import { Navigation } from "@/components/navigation"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  MapPin,
  Clock,
  DollarSign,
  Edit2,
  Trash2,
  Plus,
  Calendar,
  Utensils,
  Camera,
  Bed,
  Map,
  Sparkles,
  Download,
  Share2,
  Plane,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  type Activity,
  type DayPlan,
  type TripPlan,
  deleteTripPlanActivity,
  normalizeCity,
  readTripPlan,
  saveTripPlan,
  updateTripPlanDayActivity,
} from "@/lib/trip-plan"
import { AiPlannerModal } from "@/components/itinerary/AiPlannerModal"
import type { AiPlannerResponse } from "@/lib/ai-itinerary"
import { saveAiEditsResult } from "@/lib/ai-edits-store"

const activityIcons: Record<Activity["type"], typeof MapPin> = {
  hotel: Bed,
  food: Utensils,
  sightseeing: Camera,
  travel: Plane,
  free: Map,
  other: MapPin,
}

export default function ItineraryPage() {
  const [isHydrated, setIsHydrated] = useState(false)
  const [plan, setPlan] = useState<TripPlan | null>(null)
  const [expandedDays, setExpandedDays] = useState<number[]>([1])
  const [editingActivity, setEditingActivity] = useState<string | null>(null)
  const [editingDay, setEditingDay] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [showAiPlannerModal, setShowAiPlannerModal] = useState(false)
  const [plannerStartAtPreview, setPlannerStartAtPreview] = useState(false)
  const [aiDraftItinerary, setAiDraftItinerary] = useState<AiPlannerResponse | null>(null)
  const [previousItinerarySnapshot, setPreviousItinerarySnapshot] = useState<TripPlan | null>(null)
  const [aiPlanHistory, setAiPlanHistory] = useState<Array<{ id: string; at: number; notes: string; issues: number }>>([])
  const [currency, setCurrency] = useState("USD")
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, EUR: 0.93, GBP: 0.79, JPY: 151.0, INR: 83.0 })

  useEffect(() => {
    const next = readTripPlan()
    setPlan(next)

    const contextStr = localStorage.getItem("WANDERLY_TRIP_CONTEXT")
    if (!contextStr && next?.tripContext) {
      localStorage.setItem("WANDERLY_TRIP_CONTEXT", JSON.stringify(next.tripContext))
    }

    if (next?.tripContext?.currency) setCurrency(next.tripContext.currency)

    const ratesStr = localStorage.getItem("WANDERLY_RATES")
    if (ratesStr) {
      try {
        const parsed = JSON.parse(ratesStr)
        if (parsed?.data) setRates(parsed.data)
      } catch {
        // ignore malformed local data
      }
    }

    const draftStr = localStorage.getItem("wanderly_ai_draft_itinerary")
    if (draftStr) {
      try { setAiDraftItinerary(JSON.parse(draftStr)) } catch {}
    }
    const snapshotStr = localStorage.getItem("wanderly_previous_itinerary_snapshot")
    if (snapshotStr) {
      try { setPreviousItinerarySnapshot(JSON.parse(snapshotStr)) } catch {}
    }
    const historyStr = localStorage.getItem("wanderly_ai_plan_history")
    if (historyStr) {
      try {
        const parsed = JSON.parse(historyStr)
        if (Array.isArray(parsed)) setAiPlanHistory(parsed)
      } catch {}
    }

    setIsHydrated(true)
  }, [])

  const setAndPersistPlan = (next: TripPlan) => {
    setPlan(next)
    saveTripPlan(next)
  }

  const toggleDay = (day: number) => {
    setExpandedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const days = plan?.itinerary.days || []

  const convertCurrency = (amount: number, fromCurrency = "USD", toCurrency = currency) => {
    const fromRate = rates[fromCurrency] || 1
    const toRate = rates[toCurrency] || 1
    const usdAmount = fromCurrency === "USD" ? amount : amount / fromRate
    return usdAmount * toRate
  }

  const formatPrice = (amount: number, fromCurrency = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(convertCurrency(amount, fromCurrency, currency))

  const totalActivities = useMemo(
    () => days.reduce((sum, day) => sum + day.activities.length, 0),
    [days]
  )

  const estimatedCost = useMemo(() => {
    if (!plan) return 0
    const activityCost = days.reduce(
      (sum, day) => sum + day.activities.reduce((daySum, act) => daySum + convertCurrency(act.cost, act.currency || "USD", "USD"), 0),
      0
    )

    const hotelCost = Object.values(plan.bookings.hotelsByCity).reduce((sum, hotel) => {
      const nights = Math.max(1, Number(hotel.nights || 1))
      return sum + convertCurrency(hotel.pricePerNight * nights, hotel.currency || "USD", "USD")
    }, 0)

    const flightCost = Object.values(plan.bookings.flightsBySegment).reduce((sum, flight) => {
      return sum + convertCurrency(flight.price || 0, flight.currency || "USD", "USD")
    }, 0)

    return activityCost + hotelCost + flightCost
  }, [plan, days, rates])

  const tripDurationDays = useMemo(() => {
    if (!plan?.tripContext?.startDate || !plan?.tripContext?.endDate) return days.length
    const start = new Date(plan.tripContext.startDate)
    const end = new Date(plan.tripContext.endDate)
    const ms = end.getTime() - start.getTime()
    return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1)
  }, [plan, days.length])

  const tripTitle = useMemo(() => {
    if (!plan) return "My Itinerary"
    const topPlace = plan.tripContext.selectedPlaces?.[0]?.name
    const firstCity = plan.itinerary.days?.[0]?.city || plan.tripContext.selectedPlaces?.[0]?.city
    if (topPlace) return `${topPlace} Adventure`
    if (firstCity) return `${firstCity} Trip`
    return "My Itinerary"
  }, [plan])

  const aiSuggestions = useMemo(() => {
    if (!plan) return []
    const suggestions: string[] = []

    for (const day of plan.itinerary.days) {
      if (day.activities.length < 3) {
        suggestions.push(`Day ${day.dayNumber} has a light schedule, add 1-2 activities in ${day.city}.`)
      }

      const travelCount = day.activities.filter((a) => a.type === "travel").length
      if (travelCount > 1) {
        suggestions.push(`Day ${day.dayNumber} has multiple travel legs, consider reordering to reduce transit time.`)
      }
    }

    if (suggestions.length === 0) {
      suggestions.push("Your plan is well balanced. Consider adding one relaxation block on the busiest day.")
    }

    return suggestions.slice(0, 3)
  }, [plan])

  const primaryDestination = plan?.itinerary.days?.[0]?.city || plan?.tripContext.selectedPlaces?.[0]?.city || ""

  const hotelCount = plan ? Object.keys(plan.bookings.hotelsByCity).length : 0
  const flightCount = plan ? Object.keys(plan.bookings.flightsBySegment).length : 0

  const startEditActivity = (dayNumber: number, activity: Activity) => {
    setEditingDay(dayNumber)
    setEditingActivity(activity.id)
    setEditingTitle(activity.title)
  }

  const commitEditActivity = () => {
    if (!plan || !editingActivity || !editingDay) {
      setEditingActivity(null)
      setEditingDay(null)
      setEditingTitle("")
      return
    }

    const next = updateTripPlanDayActivity(plan, editingDay, editingActivity, editingTitle)
    setAndPersistPlan(next)
    setEditingActivity(null)
    setEditingDay(null)
    setEditingTitle("")
  }

  const removeActivity = (dayNumber: number, activityId: string) => {
    if (!plan) return
    const next = deleteTripPlanActivity(plan, dayNumber, activityId)
    setAndPersistPlan(next)
  }

  const addActivity = (day: DayPlan) => {
    if (!plan) return

    const nextDays = plan.itinerary.days.map((d) => {
      if (d.dayNumber !== day.dayNumber) return d
      return {
        ...d,
        activities: [
          ...d.activities,
          {
            id: `d${d.dayNumber}-free-${Date.now()}`,
            type: "free" as const,
            title: "Free time / explore nearby",
            time: "17:00",
            locationLabel: d.city,
            cost: 0,
            currency: "USD",
          },
        ],
      }
    })

    setAndPersistPlan({
      ...plan,
      itinerary: { days: nextDays },
      lastUpdatedAt: Date.now(),
    })
  }

  const addDay = () => {
    if (!plan || days.length === 0) return
    const last = days[days.length - 1]
    const lastDate = new Date(last.date)
    const nextDate = new Date(lastDate)
    nextDate.setDate(lastDate.getDate() + 1)

    const nextDay: DayPlan = {
      dayNumber: last.dayNumber + 1,
      date: format(nextDate, "yyyy-MM-dd"),
      city: last.city,
      title: `More of ${last.city}`,
      activities: [
        {
          id: `d${last.dayNumber + 1}-free-${Date.now()}`,
          type: "free",
          title: "Free exploration",
          time: "10:00",
          locationLabel: last.city,
          cost: 0,
          currency: "USD",
        },
      ],
    }

    setAndPersistPlan({
      ...plan,
      itinerary: { days: [...days, nextDay] },
      lastUpdatedAt: Date.now(),
    })
    setExpandedDays((prev) => [...prev, nextDay.dayNumber])
  }

  const exportJson = () => {
    if (!plan) return
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "trip-itinerary.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const openPlannerWizard = () => {
    setPlannerStartAtPreview(false)
    setShowAiPlannerModal(true)
  }

  const openPlannerPreview = () => {
    setPlannerStartAtPreview(true)
    setShowAiPlannerModal(true)
  }

  const handleDraftGenerated = (draft: AiPlannerResponse) => {
    setAiDraftItinerary(draft)
    saveAiEditsResult({
      analysis: {
        issues_found: draft.analysis.issues_found,
        optimization_strategy: draft.analysis.planning_notes,
      },
      optimized_itinerary: { days: draft.proposed_itinerary.days as any },
      changes_summary: draft.changes_summary as any,
      estimated_budget_impact: {
        previous_total: 0,
        new_total: draft.budget_estimate.total,
        difference: 0,
      },
    } as any)
    localStorage.setItem("wanderly_ai_draft_itinerary", JSON.stringify(draft))
    const item = {
      id: `${Date.now()}`,
      at: Date.now(),
      notes: draft.analysis.planning_notes,
      issues: draft.analysis.issues_found.length,
    }
    const nextHistory = [item, ...aiPlanHistory].slice(0, 8)
    setAiPlanHistory(nextHistory)
    localStorage.setItem("wanderly_ai_plan_history", JSON.stringify(nextHistory))
  }

  const handleAcceptPlan = (draft: AiPlannerResponse) => {
    if (!plan) return
    const snapshot = JSON.parse(JSON.stringify(plan)) as TripPlan
    setPreviousItinerarySnapshot(snapshot)
    localStorage.setItem("wanderly_previous_itinerary_snapshot", JSON.stringify(snapshot))

    const next: TripPlan = {
      ...plan,
      itinerary: { days: draft.proposed_itinerary.days as any },
      updatedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    }
    setAndPersistPlan(next)
    toast.success("AI itinerary applied ✅", {
      action: {
        label: "Undo",
        onClick: () => {
          const restore = previousItinerarySnapshot || snapshot
          setAndPersistPlan(restore)
          toast.success("Reverted.")
        },
      },
    })
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading itinerary...</CardContent>
          </Card>
        </main>
      </div>
    )
  }

  if (!plan || days.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>No itinerary yet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Go to AI Assistant / Booking to create one.
              </p>
              <div className="flex gap-2">
                <Link href="/chat">
                  <Button>Go to AI Assistant</Button>
                </Link>
                <Link href="/booking">
                  <Button variant="outline">Go to Booking</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
        <ChatBubble />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary">Live Trip Plan</Badge>
              <Badge variant="outline">{tripDurationDays} Days</Badge>
            </div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              {tripTitle}
            </h1>
            <p className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {plan.tripContext.startDate && plan.tripContext.endDate
                ? `${format(new Date(plan.tripContext.startDate), "MMMM d")} - ${format(new Date(plan.tripContext.endDate), "MMMM d, yyyy")}`
                : "Dates not set"}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 bg-transparent">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={exportJson}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent" onClick={openPlannerPreview}>
              <Sparkles className="h-4 w-4" />
              Apply AI Edits
            </Button>
            <Button className="gap-2" onClick={openPlannerWizard}>
              <Sparkles className="h-4 w-4" />
              Edit with AI
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-8 lg:grid-cols-3">
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-1 lg:col-span-2">
            <div className="space-y-4">
              {days.map((day) => (
                <Collapsible
                  key={day.dayNumber}
                  open={expandedDays.includes(day.dayNumber)}
                  onOpenChange={() => toggleDay(day.dayNumber)}
                >
                  <Card>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer transition-colors hover:bg-secondary/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
                              {day.dayNumber}
                            </div>
                            <div>
                              <CardTitle className="text-lg">Day {day.dayNumber}</CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {day.title} • {format(new Date(day.date), "MMM d")}
                              </p>
                              <div className="mt-1">
                                <Badge variant={plan.bookings.hotelsByCity[normalizeCity(day.city)] ? "secondary" : "outline"}>
                                  {plan.bookings.hotelsByCity[normalizeCity(day.city)] ? "Booked" : "Missing hotel"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="hidden text-right sm:block">
                              <p className="text-sm font-medium text-foreground">
                                {day.activities.length} activities
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatPrice(day.activities.reduce((sum, a) => sum + convertCurrency(a.cost, a.currency || "USD", "USD"), 0), "USD")} total
                              </p>
                            </div>
                            <ChevronDown
                              className={cn(
                                "h-5 w-5 text-muted-foreground transition-transform",
                                expandedDays.includes(day.dayNumber) && "rotate-180"
                              )}
                            />
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="relative space-y-4 pl-6">
                          <div className="absolute bottom-4 left-2 top-0 w-px bg-border" />

                          {day.activities.map((activity, idx) => {
                            const Icon = activityIcons[activity.type] || MapPin
                            const isEditing = editingActivity === activity.id && editingDay === day.dayNumber

                            return (
                              <div
                                key={activity.id}
                                className="relative flex gap-4"
                              >
                                <div
                                  className={cn(
                                    "absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-card",
                                    idx === 0
                                      ? "border-primary"
                                      : "border-muted-foreground/30"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "h-2 w-2 rounded-full",
                                      idx === 0 ? "bg-primary" : "bg-muted-foreground/30"
                                    )}
                                  />
                                </div>

                                <Card className="flex-1">
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                                          <Icon className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="flex-1">
                                          {isEditing ? (
                                            <Input
                                              value={editingTitle}
                                              className="mb-2"
                                              autoFocus
                                              onChange={(e) => setEditingTitle(e.target.value)}
                                              onBlur={commitEditActivity}
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter") commitEditActivity()
                                              }}
                                            />
                                          ) : (
                                            <h4 className="font-medium text-foreground">
                                              {activity.title}
                                            </h4>
                                          )}
                                          <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {activity.time}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />
                                              {activity.locationLabel}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <DollarSign className="h-3 w-3" />
                                              {activity.cost > 0
                                                ? formatPrice(activity.cost, activity.currency || "USD")
                                                : "Free"}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => startEditActivity(day.dayNumber, activity)}
                                        >
                                          <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 text-destructive"
                                          onClick={() => removeActivity(day.dayNumber, activity.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            )
                          })}

                          <div className="relative">
                            <div className="absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-card" />
                            <Button
                              variant="outline"
                              className="w-full gap-2 border-dashed bg-transparent"
                              onClick={() => addActivity(day)}
                            >
                              <Plus className="h-4 w-4" />
                              Add Activity
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}

              <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={addDay}>
                <Plus className="h-4 w-4" />
                Add Day
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(100vh-220px)] space-y-6 overflow-y-auto pr-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trip Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium text-foreground">{tripDurationDays} days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Activities</span>
                  <span className="font-medium text-foreground">{totalActivities}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated Cost</span>
                  <span className="font-medium text-foreground">{formatPrice(estimatedCost, "USD")}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Hotels booked</span>
                  <span>{hotelCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Flights booked</span>
                  <span>{flightCount}</span>
                </div>
                <hr />
                <Link href="/budget">
                  <Button variant="outline" className="w-full gap-2 bg-transparent">
                    <DollarSign className="h-4 w-4" />
                    View Budget Details
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="secondary" className="w-full justify-start gap-2">
                  <Map className="h-4 w-4" />
                  View on Map
                </Button>
                <Link href="/booking" className="block">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Bed className="h-4 w-4" />
                    {hotelCount > 0 ? "Manage Booking" : "Book Hotels"}
                  </Button>
                </Link>
                <Link href={primaryDestination ? `/weather?city=${encodeURIComponent(primaryDestination)}` : "/weather"} className="block">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Calendar className="h-4 w-4" />
                    Check Weather
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Based on your itinerary, here are some recommendations:
                </p>
                <ul className="space-y-2 text-sm">
                  {aiSuggestions.map((suggestion) => (
                    <li key={suggestion} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-foreground">{suggestion}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-2 w-full gap-2" onClick={openPlannerWizard}>
                  <Sparkles className="h-4 w-4" />
                  Get More Suggestions
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent AI Plans</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {aiPlanHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AI plans generated yet.</p>
                ) : (
                  aiPlanHistory.map((h) => (
                    <button
                      key={h.id}
                      className="w-full rounded-md border p-2 text-left hover:bg-secondary/40"
                      onClick={openPlannerPreview}
                    >
                      <p className="text-xs text-muted-foreground">{format(new Date(h.at), "MMM d, HH:mm")}</p>
                      <p className="text-sm font-medium">{h.issues} issues analyzed</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{h.notes}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AiPlannerModal
        open={showAiPlannerModal}
        onOpenChange={setShowAiPlannerModal}
        plan={plan}
        initialDraft={aiDraftItinerary}
        startAtPreview={plannerStartAtPreview}
        onDraftGenerated={handleDraftGenerated}
        onAcceptPlan={handleAcceptPlan}
      />

      <ChatBubble />
    </div>
  )
}
