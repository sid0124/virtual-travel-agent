"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Slider } from "@/components/ui/slider"
import { MapPin, CalendarIcon, Users, DollarSign, Search } from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/currency"
import { cn } from "@/lib/utils"

export function SearchForm() {
  const router = useRouter()
  const [destination, setDestination] = useState("")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [travelers, setTravelers] = useState(2)
  const [budget, setBudget] = useState([10000, 50000])

  const handleSearch = () => {
    const params = new URLSearchParams({
      destination,
      travelers: travelers.toString(),
      budgetMin: budget[0].toString(),
      budgetMax: budget[1].toString(),
    })
    if (dateRange.from) params.set("from", dateRange.from.toISOString())
    if (dateRange.to) params.set("to", dateRange.to.toISOString())
    router.push(`/destinations?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-4xl rounded-2xl border bg-card p-2 shadow-lg">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        {/* Destination */}
        <div className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-secondary/50">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground">Where</Label>
            <Input
              type="text"
              placeholder="Search destinations"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="h-auto border-0 bg-transparent p-0 text-base font-medium placeholder:text-muted-foreground/70 focus-visible:ring-0"
            />
          </div>
        </div>

        <div className="hidden h-8 w-px bg-border lg:block" />

        {/* Dates */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-secondary/50">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground">When</Label>
                <p className="text-base font-medium">
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d")}
                      </>
                    ) : (
                      format(dateRange.from, "MMM d, yyyy")
                    )
                  ) : (
                    <span className="text-muted-foreground/70">Add dates</span>
                  )}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              disabled={(date) => date < new Date()}
            />
          </PopoverContent>
        </Popover>

        <div className="hidden h-8 w-px bg-border lg:block" />

        {/* Travelers */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-secondary/50">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground">Who</Label>
                <p className="text-base font-medium">
                  {travelers} {travelers === 1 ? "traveler" : "travelers"}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Travelers</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    onClick={() => setTravelers(Math.max(1, travelers - 1))}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-medium">{travelers}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-transparent"
                    onClick={() => setTravelers(Math.min(10, travelers + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <div className="hidden h-8 w-px bg-border lg:block" />

        {/* Budget */}
        <Popover>
          <PopoverTrigger asChild>
            <div className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-secondary/50">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <Label className="text-xs font-medium text-muted-foreground">Budget</Label>
                <p className="text-base font-medium">
                  {formatCurrency(budget[0])} - {formatCurrency(budget[1])}
                </p>
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Total Budget (INR)</Label>
                <div className="mt-4 px-2">
                  <Slider
                    value={budget}
                    onValueChange={setBudget}
                    min={5000}
                    max={300000}
                    step={5000}
                  />
                </div>
                <div className="mt-2 flex justify-between text-sm text-muted-foreground">
                  <span>{formatCurrency(budget[0])}</span>
                  <span>{formatCurrency(budget[1])}</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Search Button */}
        <Button
          size="lg"
          className="gap-2 rounded-xl px-6"
          onClick={handleSearch}
        >
          <Search className="h-5 w-5" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>
    </div>
  )
}
