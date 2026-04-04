"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Heart, Star, ExternalLink, Calendar, Users, Award, CheckCircle2, Plus, X } from "lucide-react"
import { buildDestinationImageUrl, destinationFallbackImage } from "@/lib/data"
import { cn } from "@/lib/utils"

interface DestinationCardProps {
  id: string
  name: string
  country: string
  city?: string
  state?: string
  image: string
  imageFallback?: string
  description: string
  bestTime: string
  budget: { min: number; max: number; currency: string }
  rating: number
  interests: string[]
  category?: string
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
  state,
  image,
  imageFallback,
  description,
  bestTime,
  budget,
  rating,
  interests,
  category,
  type,
  isUNESCO,
  annualVisitors,
  entryFee,
  className,
  isSelected,
  onToggleSelection,
}: DestinationCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const locationParts = [city, state, country].filter(Boolean)
  const fallbackImage = imageFallback || destinationFallbackImage
  const autoImage = useMemo(
    () =>
      buildDestinationImageUrl({
        name,
        state,
        city,
        country,
        category: category || type,
      }),
    [name, state, city, country, category, type]
  )
  const primaryImage = image?.trim() ? image : autoImage
  const [imgSrc, setImgSrc] = useState(primaryImage)

  useEffect(() => {
    setImgSrc(primaryImage)
  }, [primaryImage])

  return (
    <Card
      className={cn(
        "group overflow-hidden rounded-2xl border border-border/70 bg-card/95 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl",
        isSelected && "border-primary/70 bg-primary/[0.04] shadow-lg shadow-primary/10 ring-1 ring-primary/20",
        className
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={imgSrc}
          alt={name}
          className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (imgSrc !== autoImage) {
              setImgSrc(autoImage)
              return
            }

            if (imgSrc !== fallbackImage) {
              setImgSrc(fallbackImage)
              e.currentTarget.src = fallbackImage
            }
          }}
        />
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          isSelected ? "from-primary/30" : "from-foreground/60"
        )} />

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
          {isSelected && (
            <Badge className="gap-1 border-none bg-primary text-primary-foreground shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              In your plan
            </Badge>
          )}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          {onToggleSelection && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleSelection()
              }}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isSelected
                  ? "border-primary/50 bg-primary text-primary-foreground shadow-md"
                  : "border-white/30 bg-black/25 text-white hover:bg-black/40"
              )}
              aria-label={isSelected ? `Remove ${name} from trip plan` : `Add ${name} to trip plan`}
            >
              {isSelected ? <X className="h-4.5 w-4.5" /> : <Plus className="h-4.5 w-4.5" />}
            </button>
          )}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card/80 backdrop-blur transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-colors",
                isFavorite ? "fill-destructive text-destructive" : "text-foreground"
              )}
            />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-2">
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
              {locationParts.join(", ")}
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
          <Button
            className={cn(
              "flex-1 rounded-full",
              isSelected
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : ""
            )}
            size="sm"
            variant={isSelected ? "secondary" : "default"}
            onClick={onToggleSelection}
            aria-label={isSelected ? `Remove ${name} from trip plan` : `Add ${name} to trip plan`}
          >
            {isSelected ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Selected
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add to plan
              </>
            )}
          </Button>
          <Link href={`/weather?destination=${encodeURIComponent(city || name)}`}>
            <Button variant="outline" size="sm" className="gap-1 rounded-full bg-transparent">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
