"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  CalendarDays,
  Edit3,
  Hotel,
  MapPinned,
  Plane,
  Save,
  Sparkles,
  WalletCards,
} from "lucide-react"

import { ChatBubble } from "@/components/chat-bubble"
import { Navigation } from "@/components/navigation"
import { useTripPlanning } from "@/components/trip-planning-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { buildBudgetEstimate, type TripBudgetEstimate } from "@/lib/trip-budget"

const budgetItems = [
  { key: "stay", label: "Stay", color: "bg-blue-500" },
  { key: "food", label: "Food", color: "bg-emerald-500" },
  { key: "travel", label: "Travel", color: "bg-amber-500" },
  { key: "activities", label: "Activities", color: "bg-violet-500" },
] as const

export default function BudgetPage() {
  const { tripSetup, hydrated } = useTripPlanning()
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const estimate = useMemo<TripBudgetEstimate | null>(() => {
    if (!tripSetup.selectedDestinations.length || !tripSetup.dateRange.from || !tripSetup.dateRange.to) {
      return null
    }
    return buildBudgetEstimate(tripSetup)
  }, [tripSetup])

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <div className="rounded-[2rem] border border-border/60 bg-card/90 p-12 text-center shadow-xl">
            <p className="text-lg font-medium text-foreground">Preparing your budget overview...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!estimate) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-3xl rounded-[2rem] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] p-10 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <WalletCards className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Your budget estimate will appear here
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Start from destinations, select your places, set your trip details, and we&apos;ll calculate a polished budget overview.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/destinations">
                <Button className="rounded-full px-6">Go to destinations</Button>
              </Link>
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

  const total = Math.max(estimate.totalBudget, 1)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))]">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <section className="rounded-[2rem] border border-border/60 bg-background/90 p-6 shadow-xl backdrop-blur lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-4 rounded-full bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Budget Estimation
              </Badge>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                Your Trip Budget Overview
              </h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                A destination-aware estimate using place pricing, hotel signals, arrival flights, and local transfers based on your selected pace and budget preference.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/destinations">
                <Button variant="outline" className="rounded-full bg-transparent">
                  <Edit3 className="mr-2 h-4 w-4" />
                  Modify Trip
                </Button>
              </Link>
              <Link href="/destinations">
                <Button variant="outline" className="rounded-full bg-transparent">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Add More Places
                </Button>
              </Link>
              <Button
                className="rounded-full"
                onClick={() => {
                  const timestamp = new Date().toLocaleString()
                  setSavedAt(timestamp)
                  toast.success("Trip budget saved to this browser.")
                }}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Trip
              </Button>
            </div>
          </div>
          {savedAt && <p className="mt-4 text-sm text-muted-foreground">Saved locally on {savedAt}</p>}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {[
            { label: "Total Budget", value: `$${estimate.totalBudget.toLocaleString()}`, icon: WalletCards },
            { label: "Total Days", value: `${estimate.totalDays} Days`, icon: CalendarDays },
            { label: "Total Distance", value: `${estimate.totalDistanceKm.toLocaleString()} km`, icon: MapPinned },
            { label: "Destinations", value: `${estimate.destinationsCount}`, icon: Sparkles },
            { label: "Flight Estimate", value: `$${estimate.flightCost.toLocaleString()}`, icon: Plane },
            { label: "Avg Hotel / Night", value: `$${estimate.averageHotelPerNight.toLocaleString()}`, icon: Hotel },
          ].map((item) => (
            <Card key={item.label} className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-lg">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Cost Breakdown</h2>
                  <p className="text-sm text-muted-foreground">
                    Built from destination-level hotel, food, flight, and activity assumptions
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
                          ${amount.toLocaleString()} • {percentage}%
                        </span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`${item.color} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(6, percentage)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Per Day Cost</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    ${estimate.perDayCost.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Travel Cost</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    ${estimate.travelCost.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Flight Estimate</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    ${estimate.flightCost.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                  <p className="text-sm text-muted-foreground">Hotel total</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    ${estimate.hotelCost.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                  <p className="text-sm text-muted-foreground">Local transport</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    ${estimate.localTransportCost.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/90 p-4">
                  <p className="text-sm text-muted-foreground">Inter-city transfers</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    ${estimate.intercityTravelCost.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Route Snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The estimated order used to calculate travel distance
              </p>

              <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/[0.05] p-5">
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  ~{estimate.totalDistanceKm.toLocaleString()} km
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

              <div className="mt-5 rounded-2xl bg-secondary/70 p-4">
                <p className="text-sm text-muted-foreground">Starting location</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {tripSetup.startingLocation || "Not provided"}
                </p>
              </div>

              <div className="mt-5 space-y-3">
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

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Selected Destinations</h2>
                  <p className="text-sm text-muted-foreground">
                    Your saved shortlist with destination-level pricing signals
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {estimate.destinationDetails.length} places
                </Badge>
              </div>

              <div className="grid gap-3">
                {estimate.destinationDetails.map((destination) => {
                  const sourceDestination = tripSetup.selectedDestinations.find((item) => item.id === destination.id)

                  return (
                    <div
                      key={destination.id}
                      className="flex items-center gap-3 rounded-3xl border border-border/60 bg-background/90 p-3 transition-shadow hover:shadow-md"
                    >
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
                        <p className="font-medium text-foreground">{destination.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{destination.location}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>${destination.hotelPerNight}/night</span>
                          <span>{destination.daysAllocated} days</span>
                          {destination.flightEstimate > 0 ? <span>flight ${destination.flightEstimate}</span> : null}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          ${destination.totalEstimate.toLocaleString()}
                        </p>
                        <Badge variant="outline" className="mt-2 rounded-full">
                          {destination.pricingSource}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border border-border/60 bg-card/90 shadow-xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-foreground">Trip Snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The setup inputs used for this estimate
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Dates</p>
                  <p className="mt-2 font-medium text-foreground">
                    {tripSetup.dateRange.from && tripSetup.dateRange.to
                      ? `${formatDate(tripSetup.dateRange.from)} - ${formatDate(tripSetup.dateRange.to)}`
                      : "Not selected"}
                  </p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Travel Style</p>
                  <p className="mt-2 font-medium capitalize text-foreground">{tripSetup.travelStyle}</p>
                </div>
                <div className="rounded-2xl bg-secondary/70 p-4">
                  <p className="text-sm text-muted-foreground">Budget Preference</p>
                  <p className="mt-2 font-medium capitalize text-foreground">{tripSetup.budgetPreference}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <ChatBubble />
    </div>
  )
}

function formatDate(value?: string) {
  if (!value) return ""
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
