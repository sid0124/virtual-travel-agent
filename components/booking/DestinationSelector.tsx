"use client"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type DestinationSelectorProps = {
  destinations: string[]
  selectedDestination: string
  onChange: (destination: string) => void
  currentOrigin: string
  disabled?: boolean
  helperText?: string
}

export function DestinationSelector({
  destinations,
  selectedDestination,
  onChange,
  currentOrigin,
  disabled = false,
  helperText,
}: DestinationSelectorProps) {
  if (destinations.length === 0) return null

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-secondary bg-secondary/30 p-4">
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-semibold text-muted-foreground">Select destination to book stays & flights</label>
          {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        </div>
        <Select value={selectedDestination} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-[280px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {destinations.map((destination) => (
              <SelectItem key={destination} value={destination}>
                {destination}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Badge variant="outline" className="border-primary/20 bg-primary/5 px-3 py-1 text-primary">
        Route: {currentOrigin} → {selectedDestination}
      </Badge>
    </div>
  )
}
