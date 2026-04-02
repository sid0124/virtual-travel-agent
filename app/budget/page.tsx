"use client"

import React from "react"
import { useState, useMemo, useEffect } from "react"
import { differenceInCalendarDays } from "date-fns"
import { Navigation } from "@/components/navigation"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Plane,
  Hotel,
  Utensils,
  Camera,
  ShoppingBag,
  HelpCircle,
  Edit2,
  PieChart,
  Bus,
  Ticket,
  RefreshCw,
} from "lucide-react"
import { budgetEstimates, destinations, budgetCategories } from "@/lib/data"
import type { BudgetEstimate } from "@/lib/data"
import Link from "next/link"

const currencies = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen" },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee" },
]

type PlaceLike = {
  id?: string | number
  name?: string
  city?: string
  country?: string
  entryFee?: number
}

function normalizePlaceKey(name?: string, city?: string, country?: string) {
  return `${String(name || "").trim()}|${String(city || "").trim()}|${String(country || "").trim()}`.toLowerCase()
}

function placeValueKey(place: PlaceLike) {
  if (place?.id !== undefined && place?.id !== null && String(place.id).trim() !== "") {
    return `id:${String(place.id)}`
  }
  return normalizePlaceKey(place?.name, place?.city, place?.country)
}

function findEstimateForPlace(place: PlaceLike): BudgetEstimate {
  const placeName = String(place?.name || "").trim().toLowerCase()
  const placeCity = String(place?.city || "").trim().toLowerCase()
  const placeCountry = String(place?.country || "").trim().toLowerCase()

  return (
    budgetEstimates.find((b) => normalizePlaceKey(b.destination, b.city, b.country) === normalizePlaceKey(place?.name, place?.city, place?.country)) ||
    budgetEstimates.find((b) => b.destination.toLowerCase() === placeName) ||
    budgetEstimates.find((b) => b.city.toLowerCase() === placeCity && b.country.toLowerCase() === placeCountry) ||
    budgetEstimates.find((b) => b.city.toLowerCase() === placeCity) ||
    budgetEstimates.find((b) => b.country.toLowerCase() === placeCountry) ||
    budgetEstimates[0]
  )
}

export default function BudgetPage() {
  const [activePlaceKey, setActivePlaceKey] = useState("")
  const [tripDays, setTripDays] = useState(5)
  const [currency, setCurrency] = useState("USD")
  const [travelers, setTravelers] = useState(1)
  const [tripStyle, setTripStyle] = useState("Normal")
  const [isLoaded, setIsLoaded] = useState(false)
  const [tripContext, setTripContext] = useState<any>(null)
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1, EUR: 0.93, GBP: 0.79, JPY: 151.0, INR: 83.0 })
  const [isRatesLoading, setIsRatesLoading] = useState(false)

  useEffect(() => {
    // 1. Try Local Storage first (Synchronous/Priority)
    const contextStr = localStorage.getItem("WANDERLY_TRIP_CONTEXT")
    if (contextStr) {
      try {
        const raw = JSON.parse(contextStr)
        const ctx = raw?.tripContext || raw
        setTripContext(ctx)
        if (ctx.travelers || ctx.travelersCount) setTravelers(ctx.travelers || ctx.travelersCount)
        if (ctx.budgetLevel) {
          if (ctx.budgetLevel === "low") setTripStyle("Budget")
          else if (ctx.budgetLevel === "medium") setTripStyle("Normal")
          else if (ctx.budgetLevel === "premium") setTripStyle("Luxury")
        } else if (ctx.tripStyle) {
          if (ctx.tripStyle === "Relaxed") setTripStyle("Budget")
          else if (ctx.tripStyle === "Packed") setTripStyle("Luxury")
          else setTripStyle("Normal")
        }

        const startDate = ctx.startDate || ctx.dateRange?.from
        const endDate = ctx.endDate || ctx.dateRange?.to
        if (startDate && endDate) {
          const diff = differenceInCalendarDays(new Date(endDate), new Date(startDate))
          if (diff >= 0) setTripDays(diff + 1)
        }
      } catch (e) {
        console.error("Context load error:", e)
      }
    }

    // 2. Fetch Exchange Rates
    const fetchRates = async () => {
      setIsRatesLoading(true)
      try {
        // Cache rates for 12h
        const cached = localStorage.getItem("WANDERLY_RATES")
        const now = Date.now()
        if (cached) {
          const { data, timestamp } = JSON.parse(cached)
          if (now - timestamp < 12 * 60 * 60 * 1000) {
            setRates(data)
            setIsRatesLoading(false)
            return
          }
        }

        const res = await fetch("https://api.frankfurter.app/latest?from=USD")
        const data = await res.json()
        if (data.rates) {
          const newRates = { USD: 1, ...data.rates }
          setRates(newRates)
          localStorage.setItem("WANDERLY_RATES", JSON.stringify({ data: newRates, timestamp: now }))
        }
      } catch (e) {
        console.error("Exchange rate API failed", e)
      } finally {
        setIsRatesLoading(false)
      }
    }
    fetchRates()

    // 3. Fallback to API
    fetch("/api/trip-plan")
      .then(res => res.json())
      .then(data => {
        const plan = data.plan
        if (plan && !contextStr) {
          const ctx = plan.tripContext || plan
          setTripContext(ctx)
          if (ctx.travelers || ctx.travelersCount) setTravelers(ctx.travelers || ctx.travelersCount)
          if (ctx.budgetLevel) {
            if (ctx.budgetLevel === "low") setTripStyle("Budget")
            else if (ctx.budgetLevel === "medium") setTripStyle("Normal")
            else if (ctx.budgetLevel === "premium") setTripStyle("Luxury")
          } else if (ctx.tripStyle) {
            if (ctx.tripStyle === "Relaxed") setTripStyle("Budget")
            else if (ctx.tripStyle === "Packed") setTripStyle("Luxury")
            else setTripStyle("Normal")
          } else if (plan.style) {
            setTripStyle(plan.style)
          }
          const startDate = ctx.startDate || ctx.dateRange?.from || plan.startDate
          const endDate = ctx.endDate || ctx.dateRange?.to || plan.endDate
          if (startDate && endDate) {
            const diff = differenceInCalendarDays(new Date(endDate), new Date(startDate))
            if (diff >= 0) setTripDays(diff + 1)
          }
        }
        setIsLoaded(true)
      })
      .catch(() => setIsLoaded(true))
  }, [])

  const currencySymbol = currencies.find((c) => c.code === currency)?.symbol || "$"

  const selectedPlaces = useMemo(() => {
    if (!tripContext?.selectedPlaces || !Array.isArray(tripContext.selectedPlaces)) return []
    return tripContext.selectedPlaces as PlaceLike[]
  }, [tripContext])

  const primaryPlace = useMemo(() => {
    if (!selectedPlaces.length) return null
    if (tripContext?.primaryPlaceId) {
      const byId = selectedPlaces.find((p) => String(p.id) === String(tripContext.primaryPlaceId))
      if (byId) return byId
    }
    return selectedPlaces[0]
  }, [selectedPlaces, tripContext?.primaryPlaceId])

  const destinationOptions = useMemo(() => {
    if (selectedPlaces.length > 0) {
      return selectedPlaces.map((place) => ({
        value: placeValueKey(place),
        label: `${place.name} - ${place.city}`,
        place,
      }))
    }

    return budgetEstimates.map((est) => ({
      value: normalizePlaceKey(est.destination, est.city, est.country),
      label: `${est.destination} - ${est.city}`,
      place: { name: est.destination, city: est.city, country: est.country, entryFee: est.entryFee },
    }))
  }, [selectedPlaces])

  useEffect(() => {
    if (!destinationOptions.length) return
    if (activePlaceKey && destinationOptions.some((opt) => opt.value === activePlaceKey)) return
    if (primaryPlace) {
      setActivePlaceKey(placeValueKey(primaryPlace))
      return
    }
    setActivePlaceKey(destinationOptions[0].value)
  }, [activePlaceKey, destinationOptions, primaryPlace])

  const activePlace = useMemo(() => {
    return (
      destinationOptions.find((opt) => opt.value === activePlaceKey)?.place ||
      primaryPlace ||
      destinationOptions[0]?.place ||
      null
    )
  }, [destinationOptions, activePlaceKey, primaryPlace])

  const estimate = useMemo(() => {
    if (!activePlace) return budgetEstimates[0]
    return findEstimateForPlace(activePlace)
  }, [activePlace])

  const destInfo = useMemo(() => {
    if (activePlace?.city && activePlace?.country) {
      return { city: activePlace.city, country: activePlace.country }
    }
    const match = destinations.find((d) => d.name === activePlace?.name)
    return { city: match?.city || estimate.city, country: match?.country || estimate.country }
  }, [activePlace, estimate.city, estimate.country])

  const tierMultipliers = {
    Budget: 0.6,
    Normal: 1.0,
    Luxury: 2.5,
  }
  const baseMultiplier = tierMultipliers[tripStyle as keyof typeof tierMultipliers] || 1.0
  let hotelWeight = 1.0
  let activityWeight = 1.0
  let transportWeight = 1.0

  if (tripContext?.preferences?.includes("Relaxation")) {
    hotelWeight = 1.10
    activityWeight = 0.85
  }
  if (tripContext?.preferences?.includes("Adventure")) {
    activityWeight = 1.25
    transportWeight = 1.10
  }

  const rate = rates[currency] || 1.0
  const flightMultiplier = tripStyle === "Luxury" ? 1.8 : 1.0
  const roomsCount = Math.ceil(travelers / 2)

  const breakdown = useMemo(() => {
    const flightCost = estimate.avgFlightCost * travelers * flightMultiplier * rate
    const hotelCost = estimate.hotelPricePerNight * tripDays * roomsCount * baseMultiplier * hotelWeight * rate
    const foodCost = estimate.foodCostPerDay * tripDays * travelers * baseMultiplier * rate
    const transportCost = estimate.localTransportCost * tripDays * travelers * baseMultiplier * transportWeight * rate
    const activityCost = estimate.activityCostAvg * tripDays * travelers * baseMultiplier * activityWeight * rate
    const entryFeePerPerson = Number(activePlace?.entryFee ?? estimate.entryFee ?? 0)
    const entryCost = entryFeePerPerson * travelers * rate
    const total = flightCost + hotelCost + foodCost + transportCost + activityCost + entryCost

    return [
      { name: "Flights", amount: flightCost, icon: Plane, color: "hsl(var(--chart-1))" },
      { name: "Accommodation", amount: hotelCost, icon: Hotel, color: "hsl(var(--chart-2))" },
      { name: "Food & Dining", amount: foodCost, icon: Utensils, color: "hsl(var(--chart-3))" },
      { name: "Local Transport", amount: transportCost, icon: Bus, color: "hsl(var(--chart-4))" },
      { name: "Activities", amount: activityCost, icon: Camera, color: "hsl(var(--chart-5))" },
      { name: "Entry Fees", amount: entryCost, icon: Ticket, color: "hsl(var(--muted-foreground))" },
    ].map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.amount / total) * 100) : 0,
      total,
    }))
  }, [
    estimate,
    travelers,
    flightMultiplier,
    rate,
    tripDays,
    roomsCount,
    baseMultiplier,
    hotelWeight,
    transportWeight,
    activityWeight,
    activePlace?.entryFee,
  ])

  const computeEstimatedTotal = (candidateEstimate: BudgetEstimate, candidatePlace?: PlaceLike) => {
    const flightCost = candidateEstimate.avgFlightCost * travelers * flightMultiplier * rate
    const hotelCost = candidateEstimate.hotelPricePerNight * tripDays * roomsCount * baseMultiplier * hotelWeight * rate
    const foodCost = candidateEstimate.foodCostPerDay * tripDays * travelers * baseMultiplier * rate
    const transportCost = candidateEstimate.localTransportCost * tripDays * travelers * baseMultiplier * transportWeight * rate
    const activityCost = candidateEstimate.activityCostAvg * tripDays * travelers * baseMultiplier * activityWeight * rate
    const entryCost = Number(candidatePlace?.entryFee ?? candidateEstimate.entryFee ?? 0) * travelers * rate
    return flightCost + hotelCost + foodCost + transportCost + activityCost + entryCost
  }

  const similarDestinations = useMemo(() => {
    if (!tripContext) {
      return budgetEstimates.slice(0, 8).map((est) => ({
        key: normalizePlaceKey(est.destination, est.city, est.country),
        name: est.destination,
        total: computeEstimatedTotal(est),
        isActive: false,
      }))
    }

    const active = activePlace || { name: estimate.destination, city: estimate.city, country: estimate.country, entryFee: estimate.entryFee }
    const activeEstimate = findEstimateForPlace(active)
    const activeItem = {
      key: normalizePlaceKey(active.name, active.city, active.country),
      name: String(active.name || activeEstimate.destination),
      total: computeEstimatedTotal(activeEstimate, active),
      isActive: true,
    }

    const byCity = budgetEstimates.filter((est) => est.city.toLowerCase() === String(active.city || "").toLowerCase())
    const byCountry = budgetEstimates.filter((est) => est.country.toLowerCase() === String(active.country || "").toLowerCase())
    const pool = byCity.length > 0 ? byCity : byCountry

    const others = pool
      .filter((est) => normalizePlaceKey(est.destination, est.city, est.country) !== activeItem.key)
      .slice(0, 7)
      .map((est) => ({
        key: normalizePlaceKey(est.destination, est.city, est.country),
        name: est.destination,
        total: computeEstimatedTotal(est),
        isActive: false,
      }))

    return [activeItem, ...others]
  }, [tripContext, activePlace, estimate, tripDays, travelers, tripStyle, rates, currency])

  const totalCost = breakdown[0]?.total || 0
  const dailyAvg = Math.round(totalCost / tripDays)

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 animate-pulse text-primary" />
          <p className="mt-4 text-muted-foreground font-medium">Calculating your trip budget...</p>
        </div>
      </div>
    )
  }

  // Handle empty state if no context found after loading
  const hasContext = typeof window !== "undefined" && localStorage.getItem("WANDERLY_TRIP_CONTEXT")
  if (!hasContext && !activePlace) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-20 text-center">
          <Card className="mx-auto max-w-md p-8">
            <HelpCircle className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h2 className="mt-6 text-2xl font-bold">No trip data found</h2>
            <p className="mt-2 text-muted-foreground">
              Please use our AI Assistant to plan your trip first so we can calculate a budget for you.
            </p>
            <Link href="/chat">
              <Button className="mt-8 w-full py-6 text-lg">
                Go to AI Assistant
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-semibold px-3 py-1">
                📍 {destInfo.city}, {destInfo.country}
              </Badge>
              <Badge variant="secondary" className="font-medium">
                📅 {tripDays} Days
              </Badge>
              <Badge variant="secondary" className="font-medium">
                👥 {travelers} Travelers
              </Badge>
              <Badge className="bg-chart-2 hover:bg-chart-2/90 text-white font-bold">
                ✨ {tripStyle === "Budget" ? "Budget Plan" : tripStyle === "Luxury" ? "Luxury Plan" : "Standard Plan"}
              </Badge>
            </div>
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-foreground">Budget Planner</h1>
            <p className="text-muted-foreground font-medium">
              Comprehensive cost breakdown for your upcoming trip to{" "}
              {selectedPlaces.length > 0 ? (
                <>
                  <span className="text-foreground font-bold">{activePlace?.name}</span>
                  {selectedPlaces.length > 1 && (
                    <span className="text-muted-foreground italic ml-1">
                      + {selectedPlaces.length - 1} more place{selectedPlaces.length > 2 ? "s" : ""}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-foreground font-bold">{activePlace?.name || estimate.destination}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isRatesLoading && (
              <Badge variant="outline" className="animate-pulse bg-primary/5 text-primary border-primary/20 gap-1 px-2">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Converting...
              </Badge>
            )}
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/chat">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Optimize with AI
              </Button>
            </Link>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Estimate</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(totalCost)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <RefreshCw className={isRatesLoading ? "h-6 w-6 text-primary animate-spin" : "h-6 w-6 text-primary"} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Daily Average</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(dailyAvg)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-2/10">
                  <PieChart className="h-6 w-6 text-chart-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Per Person</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(totalCost / travelers)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-3/10">
                  <TrendingDown className="h-6 w-6 text-chart-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Flight Cost</p>
                  <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(breakdown.find(b => b.name === "Flights")?.amount || 0)}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-5/10">
                  <Plane className="h-6 w-6 text-chart-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Source: Budget Estimates Dataset
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {breakdown.map((category) => {
                    const Icon = category.icon
                    return (
                      <div key={category.name} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg"
                              style={{ backgroundColor: `${category.color}20` }}
                            >
                              <Icon className="h-5 w-5" style={{ color: category.color }} />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{category.name}</p>
                              <p className="text-sm text-muted-foreground">{category.percentage}% of total</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(category.amount)}
                            </p>
                          </div>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Visual Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Spending Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-8 overflow-hidden rounded-lg">
                  {breakdown.map((category) => (
                    <div
                      key={category.name}
                      className="transition-all hover:opacity-80"
                      style={{
                        width: `${category.percentage}%`,
                        backgroundColor: category.color,
                      }}
                      title={`${category.name}: ${currencySymbol}${category.amount}`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  {breakdown.map((category) => (
                    <div key={category.name} className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="text-sm text-muted-foreground">{category.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Destination Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {tripContext ? "Similar Destinations" : "Compare Destinations"} ({tripDays} days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tripContext && selectedPlaces.length === 0 && (
                  <p className="mb-3 text-xs text-amber-600">No places selected - showing city-level estimates</p>
                )}
                <div className="space-y-3">
                  {similarDestinations.map((item) => {
                    const maxTotal = Math.max(totalCost * 1.5, 3000)
                    return (
                      <div key={item.key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={item.isActive ? "font-semibold text-primary" : "text-foreground"}>
                            {item.name}
                          </span>
                          <span className="font-medium text-foreground">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: currency }).format(item.total)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min((item.total / maxTotal) * 100, 100)}
                          className="h-2"
                        />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trip Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Destination</Label>
                  <Select value={activePlaceKey} onValueChange={setActivePlaceKey}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {destinationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Based on your selected places in chat</p>
                </div>
                <div>
                  <Label htmlFor="days">Trip Duration (days)</Label>
                  <Input
                    id="days"
                    type="number"
                    value={tripDays}
                    onChange={(e) => setTripDays(Math.max(1, Number(e.target.value)))}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="travelers">Number of Travelers</Label>
                  <Input
                    id="travelers"
                    type="number"
                    value={travelers}
                    onChange={(e) => setTravelers(Math.max(1, Number(e.target.value)))}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dataset Info */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Cost Data Sources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-card p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">Flight Costs</p>
                  <p className="text-xs text-muted-foreground">
                    Average round-trip from JFK, derived from regional flight data
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">Hotel Prices</p>
                  <p className="text-xs text-muted-foreground">
                    Mid-range hotel averages per destination city
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">Entry Fees</p>
                  <p className="text-xs text-muted-foreground">
                    From world_famous_places_2024.csv Entry_Fee_USD column
                  </p>
                </div>
                <div className="rounded-lg bg-card p-3">
                  <p className="mb-1 text-sm font-medium text-foreground">Daily Costs</p>
                  <p className="text-xs text-muted-foreground">
                    Food, transport, and activities from regional cost-of-living estimates
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-4">
                <Link href="/itinerary">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Camera className="h-4 w-4" />
                    View Itinerary
                  </Button>
                </Link>
                <Link href="/booking">
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Hotel className="h-4 w-4" />
                    Book Accommodations
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <ChatBubble />
    </div>
  )
}

