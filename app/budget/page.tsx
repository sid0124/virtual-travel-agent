"use client"

import Link from "next/link"
import { useEffect, useState, type ComponentType } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Edit3,
  Hotel,
  Loader2,
  Map,
  MapPinned,
  Plane,
  Save,
  Sparkles,
  Users,
  UtensilsCrossed,
  WalletCards,
} from "lucide-react"

import { ChatBubble } from "@/components/chat-bubble"
import { Navigation } from "@/components/navigation"
import { useTripPlanning } from "@/components/trip-planning-provider"
import { useRouter } from "next/navigation"
import { buildTripPlan, saveTripPlan } from "@/lib/trip-plan"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

const budgetItems = [
  { key: "stay", label: "Hotels", color: "bg-sky-500", icon: Hotel },
  { key: "food", label: "Food", color: "bg-emerald-500", icon: UtensilsCrossed },
  { key: "travel", label: "Travel", color: "bg-amber-500", icon: Plane },
  { key: "activities", label: "Activities", color: "bg-rose-500", icon: Sparkles },
] as const

const loadingMessages = [
  "Fetching real travel prices...",
  "Checking flight prices...",
  "Estimating hotel costs...",
  "Calibrating food spend...",
  "Mapping local travel...",
]

export default function BudgetPage() {
  const router = useRouter()
  const { tripSetup, budgetEstimate, setBudgetEstimate, hydrated } = useTripPlanning()
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingIndex, setLoadingIndex] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading) {
      setLoadingIndex(0)
      return
    }

    const interval = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingMessages.length)
    }, 1100)

    return () => window.clearInterval(interval)
  }, [isLoading])

  useEffect(() => {
    if (!hydrated) return
    if (budgetEstimate) return
    if (!tripSetup.selectedDestinations.length || !tripSetup.dateRange.from || !tripSetup.dateRange.to) return

    let active = true

    const loadEstimate = async () => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripSetup),
        })

        if (!response.ok) {
          throw new Error("Unable to fetch budget estimate")
        }

        const estimate = await response.json()
        if (active) {
          setBudgetEstimate(estimate)
        }
      } catch {
        if (active) {
          setLoadError("Live pricing is temporarily unavailable.")
          toast.error("Could not refresh live pricing. Try estimating again from the destinations page.")
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadEstimate()

    return () => {
      active = false
    }
  }, [budgetEstimate, hydrated, setBudgetEstimate, tripSetup])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <BudgetSkeleton loadingText="Preparing your budget overview..." progressValue={15} />
        </main>
      </div>
    )
  }

  if (!tripSetup.selectedDestinations.length || !tripSetup.dateRange.from || !tripSetup.dateRange.to) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-10 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <WalletCards className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Your budget estimate will appear here
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Select destinations, dates, and preferences first. Then Wanderly can fetch live pricing and build your trip budget.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/destinations">
                <Button variant="outline" className="rounded-full px-6 bg-transparent">
                  Build a trip plan
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <ChatBubble />
      </div>
    )
  }

  if (isLoading && !budgetEstimate) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_34%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))]">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <BudgetSkeleton
            loadingText={loadingMessages[loadingIndex]}
            progressValue={22 + loadingIndex * 18}
          />
        </main>
      </div>
    )
  }

  if (!budgetEstimate) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/60 bg-card/90 p-10 text-center shadow-xl">
            <p className="text-lg font-medium text-foreground">No budget estimate is available right now.</p>
            <p className="mt-3 text-muted-foreground">
              {loadError || "Please try estimating your budget again from the destinations page."}
            </p>
            <div className="mt-6">
              <Link href="/destinations">
                <Button className="rounded-full px-6">Back to trip setup</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const estimate = budgetEstimate
  const total = Math.max(estimate.totalBudget, 1)
  const formatMoney = (value: number) => formatCurrency(value, estimate.currency || "INR")
  const formatBudgetRange = (range: { min: number; max: number }) =>
    `${formatMoney(range.min)} - ${formatMoney(range.max)}`

  const handleViewItinerary = () => {
    const dynamicPlan = buildTripPlan({
      tripContext: {
        fromLocation: tripSetup.startingLocation,
        dateRange: tripSetup.dateRange as any,
        selectedPlaces: tripSetup.selectedDestinations.map(d => ({ ...d, city: d.city || d.name })),
        budgetLevel: tripSetup.budgetPreference,
        travelers: tripSetup.travelers,
      },
      orderedRoute: [
        tripSetup.startingLocation,
        ...tripSetup.selectedDestinations.map((p) => p.city || p.name),
      ].filter(Boolean) as string[],
      segmentDateMap: {},
      hotelsByCity: {},
      flightsBySegment: {},
    })

    saveTripPlan(dynamicPlan)
    router.push("/itinerary")
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.08),_transparent_34%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))]">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <section className="rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-6 shadow-xl lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-4 rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Live Budget Estimation
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                Total estimated budget: {formatBudgetRange(estimate.totalBudgetRange)}
              </h1>
              <p className="mt-3 max-w-3xl text-muted-foreground">
                Wanderly blended provider-backed travel pricing with fallback safeguards so you always get a usable estimate.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                  {estimate.estimateQuality} confidence
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {estimate.totalDays} days
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {estimate.destinationsCount} destinations
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Updated {formatTimestamp(estimate.fetchedAt)}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/destinations">
                <Button variant="outline" className="rounded-full bg-transparent">
                  <Edit3 className="mr-2 h-4 w-4" />
                  Modify Trip
                </Button>
              </Link>
              <Button
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  const timestamp = new Date().toLocaleString()
                  setSavedAt(timestamp)
                  toast.success("Trip budget saved to this browser.")
                }}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Budget
              </Button>
              <Button
                className="rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                onClick={handleViewItinerary}
              >
                <Map className="mr-2 h-4 w-4" />
                View Itinerary
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HeroMetric
              label="Total Budget"
              value={formatMoney(estimate.totalBudget)}
              subItem={{
                label: "Per Person",
                value: formatMoney(Math.round(estimate.totalBudget / (tripSetup.travelers || 1)))
              }}
              icon={WalletCards}
            />
            <HeroMetric
              label="Per day"
              value={formatMoney(estimate.perDayCost)}
              icon={CalendarDays}
            />
            <HeroMetric
              label="Flights"
              value={formatMoney(estimate.flightCost)}
              icon={Plane}
            />
            <HeroMetric
              label="Avg hotel / night"
              value={formatMoney(estimate.averageHotelPerNight)}
              icon={Hotel}
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {estimate.sourceAttribution.map((source) => (
              <div
                key={source}
                className="rounded-2xl border border-border/60 bg-white/85 px-4 py-3 text-sm text-muted-foreground"
              >
                {source}
              </div>
            ))}
          </div>

          {savedAt && <p className="mt-4 text-sm text-muted-foreground">Saved locally on {savedAt}</p>}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Budget breakdown</h2>
                  <p className="text-sm text-muted-foreground">
                    Real-time where available, fallback-safe everywhere else
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1 capitalize">
                  {tripSetup.budgetPreference}
                </Badge>
              </div>

              <div className="space-y-5">
                {budgetItems.map((item) => {
                  const amount = estimate.breakdown[item.key]
                  const percentage = Math.round((amount / total) * 100)
                  return (
                    <div key={item.key}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="text-muted-foreground">
                          {formatMoney(amount)} · {percentage}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`${item.color} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(8, percentage)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <SummaryBox label="Hotel total" value={formatMoney(estimate.hotelCost)} />
                <SummaryBox label="Local travel" value={formatMoney(estimate.localTransportCost)} />
                <SummaryBox label="Activities buffer" value={formatMoney(estimate.activitiesBuffer)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Pricing signals</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                What powered each category in this estimate
              </p>

              <div className="mt-6 space-y-4">
                <StatusCard title="Flights" status={estimate.componentStatus.flights} icon={Plane} />
                <StatusCard title="Hotels" status={estimate.componentStatus.hotels} icon={Hotel} />
                <StatusCard title="Food" status={estimate.componentStatus.food} icon={UtensilsCrossed} />
                <StatusCard title="Local travel" status={estimate.componentStatus.localTravel} icon={CarFront} />
              </div>

              <div className="mt-5 rounded-2xl bg-secondary/70 p-4">
                <p className="text-sm text-muted-foreground">Route snapshot</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {estimate.totalDistanceKm.toLocaleString()} km across your selected stops
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {estimate.routeNames.map((name, index) => (
                    <div key={name} className="flex items-center gap-2">
                      <span>{name}</span>
                      {index < estimate.routeNames.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
                    </div>
                  ))}
                </div>
              </div>

              {estimate.packedWarning && (
                <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
                  {estimate.packedWarning}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Destination-wise cost</h2>
                  <p className="text-sm text-muted-foreground">
                    Per stop pricing built from stay, food, local travel, and activities
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {estimate.destinationDetails.length} stops
                </Badge>
              </div>

              <div className="grid gap-4">
                {estimate.destinationDetails.map((destination) => {
                  const share = Math.round((destination.totalEstimate / total) * 100)
                  const sourceDestination = tripSetup.selectedDestinations.find((item) => item.id === destination.id)

                  return (
                    <div
                      key={destination.id}
                      className="rounded-3xl border border-border/60 bg-background/90 p-4 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                          {sourceDestination?.image ? (
                            <img
                              src={sourceDestination.image}
                              alt={destination.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <MapPinned className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium text-foreground">{destination.name}</p>
                              <p className="truncate text-sm text-muted-foreground">{destination.location}</p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-semibold text-foreground">
                                {formatMoney(destination.totalEstimate)}
                              </p>
                              <p className="text-xs text-muted-foreground">{share}% of total trip budget</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MiniMetric label="Hotel" value={formatMoney(destination.hotelCost)} />
                            <MiniMetric label="Food" value={formatMoney(destination.foodCost)} />
                            <MiniMetric label="Travel" value={formatMoney(destination.localTransportCost)} />
                            <MiniMetric label="Activities" value={formatMoney(destination.activitiesCost)} />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="rounded-full">
                              {formatMoney(destination.hotelPerNight)}/night
                            </Badge>
                            <Badge variant="outline" className="rounded-full">
                              {destination.daysAllocated} days
                            </Badge>
                            {destination.flightEstimate > 0 ? (
                              <Badge variant="outline" className="rounded-full">
                                Flight {formatMoney(destination.flightEstimate)}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="rounded-full">
                              {destination.pricingSource}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Trip snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Inputs used to generate this estimate
              </p>

              <div className="mt-5 space-y-4">
                <SnapshotBox
                  label="Dates"
                  value={`${formatDate(tripSetup.dateRange.from)} - ${formatDate(tripSetup.dateRange.to)}`}
                />
                <SnapshotBox label="Starting city" value={tripSetup.startingLocation || "Not provided"} />
                <SnapshotBox label="Travel style" value={capitalize(tripSetup.travelStyle)} />
                <SnapshotBox label="Budget preference" value={capitalize(tripSetup.budgetPreference)} />
                <SnapshotBox
                  label="Travel cost"
                  value={`${formatMoney(estimate.travelCost)} including ${formatMoney(estimate.intercityTravelCost)} inter-city movement`}
                />
              </div>

              <div className="mt-6 space-y-3">
                {estimate.pricingNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-2xl border border-border/60 bg-background/90 p-4 text-sm text-muted-foreground"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <ChatBubble />
    </div>
  )
}

function HeroMetric({
  label,
  value,
  subItem,
  icon: Icon,
}: {
  label: string
  value: string
  subItem?: { label: string; value: string }
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Card className="rounded-[1.5rem] border border-border/60 bg-white/90 shadow-lg">
      <CardContent className="flex flex-col p-5 h-full justify-between">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {subItem && (
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {subItem.label}
            </p>
            <p className="text-md font-semibold text-foreground">{subItem.value}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function SnapshotBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/70 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium text-foreground">{value}</p>
    </div>
  )
}

function StatusCard({
  title,
  status,
  icon: Icon,
}: {
  title: string
  status: { mode: string; source: string; message: string }
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background/90 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{title}</p>
            <Badge variant="outline" className="rounded-full capitalize">
              {status.mode}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{status.source}</p>
          <p className="mt-1 text-sm text-muted-foreground">{status.message}</p>
        </div>
      </div>
    </div>
  )
}

function BudgetSkeleton({
  loadingText,
  progressValue,
}: {
  loadingText: string
  progressValue: number
}) {
  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-border/60 bg-card/90 p-8 shadow-xl">
        <div className="flex items-center gap-3 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-lg font-medium text-foreground">{loadingText}</p>
        </div>
        <Progress value={progressValue} className="mt-5 h-3" />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-[1.5rem]" />
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <Skeleton className="h-[380px] rounded-[1.75rem]" />
        <Skeleton className="h-[380px] rounded-[1.75rem]" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Skeleton className="h-[420px] rounded-[1.75rem]" />
        <Skeleton className="h-[420px] rounded-[1.75rem]" />
      </div>
    </div>
  )
}

function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string) {
  if (!value) return "Not selected"
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatTimestamp(value?: string) {
  if (!value) return "recently"
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}

function capitalize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}
