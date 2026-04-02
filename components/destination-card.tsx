"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Heart, Star, ExternalLink, Calendar, Users, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface DestinationCardProps {
  id: string
  name: string
  country: string
  city?: string
  image: string
  description: string
  bestTime: string
  budget: { min: number; max: number; currency: string }
  rating: number
  interests: string[]
  type?: string
  isUNESCO?: boolean
  annualVisitors?: number
  entryFee?: number
  className?: string
  isSelected?: boolean
  onToggleSelection?: () => void
}

export function DestinationCard({
  id,
  name,
  country,
  city,
  image,
  description,
  bestTime,
  budget,
  rating,
  interests,
  type,
  isUNESCO,
  annualVisitors,
  entryFee,
  className,
  isSelected,
  onToggleSelection,
}: DestinationCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [imgSrc, setImgSrc] = useState(image?.trim() ? image : "/placeholder.svg")

  return (
    <Card className={cn("group overflow-hidden transition-all hover:shadow-lg", className)}>
      <div className="relative aspect-[4/3] overflow-hidden">
        {/*
          Use raw <img> behavior for external URLs to avoid optimizer redirect issues.
        */}
        <img
          src={imgSrc}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setImgSrc("/placeholder.svg")
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />

        {/* Toggle Selection Button */}
        {onToggleSelection && (
          <div className={cn(
            "absolute inset-0 z-10 flex items-center justify-center bg-black/40 transition-opacity duration-300",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <Button
              variant={isSelected ? "default" : "secondary"}
              className={cn(
                "font-semibold shadow-lg transition-transform hover:scale-105",
                isSelected ? "bg-green-600 hover:bg-green-700 text-white" : ""
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleSelection()
              }}
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        )}

        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur transition-colors hover:bg-card"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart
            className={cn(
              "h-5 w-5 transition-colors",
              isFavorite ? "fill-destructive text-destructive" : "text-foreground"
            )}
          />
        </button>

        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {isUNESCO && (
            <Badge className="gap-1 bg-chart-3 text-chart-3-foreground">
              <Award className="h-3 w-3" />
              UNESCO
            </Badge>
          )}
          {rating >= 4.8 && (
            <Badge className="bg-card text-foreground">
              Guest favorite
            </Badge>
          )}
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {isSelected && (
            <Badge className="bg-green-600 text-white hover:bg-green-600 border-none shadow-sm">
              Selected
            </Badge>
          )}
          <div className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-1 text-sm font-medium backdrop-blur">
            <Star className="h-4 w-4 fill-chart-4 text-chart-4" />
            {rating}
          </div>
          {annualVisitors && (
            <div className="flex items-center gap-1 rounded-full bg-card/80 px-2 py-1 text-xs backdrop-blur">
              <Users className="h-3 w-3" />
              {annualVisitors}M/yr
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">
              {city ? `${city}, ` : ""}{country}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              ${budget.min} - ${budget.max}
            </p>
            <p className="text-xs text-muted-foreground">per day</p>
          </div>
        </div>

        {type && (
          <Badge variant="outline" className="mb-2 text-xs">
            {type}
          </Badge>
        )}

        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>

        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Best: {bestTime}</span>
        </div>

        {entryFee !== undefined && (
          <p className="mb-3 text-xs text-muted-foreground">
            Entry fee: {entryFee === 0 ? "Free" : `$${entryFee}`}
          </p>
        )}

        <div className="mb-4 flex flex-wrap gap-1">
          {interests.slice(0, 3).map((interest) => (
            <Badge key={interest} variant="secondary" className="text-xs capitalize">
              {interest}
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Link href={`/chat?destination=${encodeURIComponent(name)}`} className="flex-1">
            <Button className="w-full" size="sm">
              Plan Trip
            </Button>
          </Link>
          <Link href={`/weather?destination=${encodeURIComponent(city || name)}`}>
            <Button variant="outline" size="sm" className="gap-1 bg-transparent">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
