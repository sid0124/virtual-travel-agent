"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { type DateRange } from "react-day-picker"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Award,
  CalendarDays,
  ChevronDown,
  Loader2,
  MapPin,
  Plane,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { ChatBubble } from "@/components/chat-bubble"
import { DestinationCard } from "@/components/destination-card"
import { Navigation } from "@/components/navigation"
import { useTripPlanning } from "@/components/trip-planning-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { destinationFallbackImage, destinations, ensureDestinationImage, interestTags } from "@/lib/data"
import { formatCurrency, formatPriceRange, USD_TO_INR } from "@/lib/currency"
import {
  buildBudgetEstimate,
  convertBudgetEstimateCurrency,
  defaultTripSetupState,
  type BudgetPreference,
  estimateTravelDistance,
  getTripDuration,
  type SelectedDestination,
  TRIP_SETUP_STORAGE_KEY,
  type TravelStyle,
} from "@/lib/trip-budget"
import { cn, calculateDistance } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const DistanceCard = ({ distance, routeText }: { distance: number, routeText?: string }) => (
  <div className="rounded-[1.75rem] border border-primary/15 bg-white/90 p-5 shadow-lg shadow-blue-100/60 mt-5">
    <div className="mb-4 flex items-center gap-3">
      <div className="rounded-2xl bg-primary/10 p-3 text-primary">
        <MapPin className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">Estimated Travel Distance</h3>
        <p className="text-sm text-muted-foreground">Global route calculation</p>
      </div>
    </div>
    <p className="text-3xl font-semibold tracking-tight text-foreground">
      {distance > 1000 ? `${(distance / 1000).toFixed(1)}k km` : `${distance} km`}
    </p>
    {routeText && <p className="mt-3 text-sm font-medium text-muted-foreground">{routeText}</p>}
  </div>
)

const BudgetCardPlaceholder = () => (
  <div className="rounded-[1.75rem] border border-emerald-500/15 bg-white/90 p-5 shadow-lg shadow-emerald-100/60 mt-5">
    <div className="mb-2 flex items-center gap-3">
      <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-600">
        <Award className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">Budget Ready</h3>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">Your travel details are fully verified. Tap below to generate global live pricing.</p>
  </div>
)

const DESTINATION_IMAGE_CACHE_KEY = "destination-image-cache:v1"
const budgetLoadingMessages = [
  "Checking flight prices...",
  "Scanning hotel rates...",
  "Estimating food costs...",
  "Mapping local travel...",
  "Building your budget dashboard...",
]

const countryAliases: Record<string, string[]> = {
  usa: ["united states", "united states of america", "america", "us"],
  "united states": ["usa", "united states of america", "america", "us"],
  uae: ["united arab emirates", "emirates"],
  "united arab emirates": ["uae", "emirates"],
  uk: ["united kingdom", "great britain", "britain", "england"],
  "united kingdom": ["uk", "great britain", "britain", "england"],
}

function getCountrySearchTerms(country?: string) {
  const normalizedCountry = (country || "").toLowerCase().trim()
  return [normalizedCountry, ...(countryAliases[normalizedCountry] || [])].filter(Boolean)
}

function getSearchableText(dest: (typeof destinations)[number]) {
  return [
    dest.name,
    dest.city,
    dest.state || "",
    dest.country,
    ...getCountrySearchTerms(dest.country),
    dest.category || "",
    ...(dest.tags || []),
    ...dest.interests,
    dest.famousFor,
    dest.type,
    dest.description,
  ].join(" ")
}

function matchesDestinationSearch(dest: (typeof destinations)[number], query: string) {
  if (!query) return true

  const normalizedTags = [...(dest.tags || []), ...dest.interests].map((tag) => tag.toLowerCase())
  const state = dest.state?.toLowerCase() || ""
  const city = dest.city?.toLowerCase() || ""
  const countryTerms = getCountrySearchTerms(dest.country)
  const category = dest.category?.toLowerCase() || ""
  const type = dest.type?.toLowerCase() || ""
  const name = dest.name?.toLowerCase() || ""

  return (
    name.includes(query) ||
    city.includes(query) ||
    state.includes(query) ||
    countryTerms.some((term) => term.includes(query)) ||
    category.includes(query) ||
    type.includes(query) ||
    normalizedTags.some((tag) => tag.includes(query))
  )
}

function buildImageRequest(dest: (typeof destinations)[number]) {
  return {
    key: dest.id,
    id: dest.id,
    name: dest.name,
    city: dest.city,
    state: dest.state,
    country: dest.country,
    category: dest.category || dest.type,
    tags: dest.tags || dest.interests || [],
    imageQuery: [dest.name, dest.city, dest.state || "", dest.country, dest.category || dest.type]
      .filter(Boolean)
      .join(" "),
    image: dest.image,
    imageFallback: destinationFallbackImage,
  }
}

type SelectedPlace = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
  region?: string
  image?: string
  latitude?: number
  longitude?: number
  entryFee?: number
}

function dedupeSelectedPlaces(places: SelectedPlace[]) {
  const map = new Map<string, SelectedPlace>()
  for (const place of places) {
    map.set(place.id, place)
  }
  return Array.from(map.values())
}

export default function DestinationsPage() {
  const router = useRouter()
  const { tripSetup, setTripSetup, setBudgetEstimate } = useTripPlanning()
  const isMobile = useIsMobile()

  const [searchQuery, setSearchQuery] = useState("")
  const [budgetRange, setBudgetRange] = useState([0, 50000])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState("All Regions")
  const [selectedState, setSelectedState] = useState("All States")
  const [selectedType, setSelectedType] = useState("All Types")
  const [unescoOnly, setUnescoOnly] = useState(false)
  const [sortBy, setSortBy] = useState("popular")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedPlaces, setSelectedPlaces] = useState<SelectedPlace[]>([])
  const [isSelectionPopoverOpen, setIsSelectionPopoverOpen] = useState(false)
  const [isTripSetupOpen, setIsTripSetupOpen] = useState(false)
  const [tripDateRange, setTripDateRange] = useState<DateRange | undefined>(() => {
    const from = tripSetup.dateRange.from ? new Date(tripSetup.dateRange.from) : undefined
    const to = tripSetup.dateRange.to ? new Date(tripSetup.dateRange.to) : undefined
    if (!from && !to) return undefined
    return { from, to }
  })
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(tripSetup.travelStyle || defaultTripSetupState.travelStyle)
  const [budgetPreference, setBudgetPreference] = useState<BudgetPreference>(
    tripSetup.budgetPreference || defaultTripSetupState.budgetPreference
  )
  const [startingLocation, setStartingLocation] = useState(tripSetup.startingLocation || "")
  const [people, setPeople] = useState(tripSetup.travelers || 1)
  const [startingLocationData, setStartingLocationData] = useState<any>(null)
  
  useEffect(() => {
    if (!startingLocation || startingLocation.trim().length === 0) {
      setStartingLocationData(null)
      return
    }
    const timer = setTimeout(() => {
       fetch(`/api/geocode?q=${encodeURIComponent(startingLocation)}`)
         .then((r) => r.json())
         .then((data) => {
            if (data.lat && data.lng) {
               setStartingLocationData({ name: startingLocation, lat: data.lat, lon: data.lng })
            } else {
               setStartingLocationData(null)
            }
         })
         .catch(() => setStartingLocationData(null))
    }, 800)
    return () => clearTimeout(timer)
  }, [startingLocation])
  const [isBudgetLoading, setIsBudgetLoading] = useState(false)
  const [budgetLoadingMessageIndex, setBudgetLoadingMessageIndex] = useState(0)
  const [tripSetupErrors, setTripSetupErrors] = useState<{
    destinations?: string
    dates?: string
    budgetPreference?: string
  }>({})
  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({})
  const [isImagePrefetching, setIsImagePrefetching] = useState(false)
  const hydratedImageCache = useRef(false)
  const startedImagePrefetch = useRef(false)
  const normalizedDestinations = useMemo(
    () => destinations.map((destination) => ensureDestinationImage(destination)),
    []
  )
  const regions = useMemo(
    () => ["All Regions", ...Array.from(new Set(normalizedDestinations.map((dest) => dest.region))).sort()],
    [normalizedDestinations]
  )
  const placeTypes = useMemo(
    () => ["All Types", ...Array.from(new Set(normalizedDestinations.map((dest) => dest.type).filter(Boolean))).sort()],
    [normalizedDestinations]
  )

  useEffect(() => {
    fetch("/api/selection")
      .then((res) => res.json())
      .then((data) => {
        const nextSelectedIds = data.selectedIds || []
        const nextSelectedPlaces = dedupeSelectedPlaces(
          Array.isArray(data.selectedPlaces)
            ? data.selectedPlaces.map((place: SelectedPlace) => ({
                ...place,
                region:
                  normalizedDestinations.find((destination) => destination.id === place.id)?.region || place.region,
              }))
            : []
        )

        setSelectedIds(nextSelectedIds)
        setSelectedPlaces(nextSelectedPlaces)
        setTripSetup((prev) => ({
          ...prev,
          selectedDestinations: nextSelectedPlaces.map((place) => ({
            id: place.id,
            name: place.name,
            city: place.city,
            state: place.state,
            country: place.country,
            region: place.region,
            image: place.image,
            latitude: place.latitude,
            longitude: place.longitude,
            entryFee: place.entryFee,
            budget: normalizedDestinations.find((destination) => destination.id === place.id)?.budget,
          })),
        }))
      })
      .catch(() => {})
  }, [normalizedDestinations, setTripSetup])

  useEffect(() => {
    if (hydratedImageCache.current || typeof window === "undefined") return

    hydratedImageCache.current = true

    try {
      const storedValue = window.localStorage.getItem(DESTINATION_IMAGE_CACHE_KEY)
      if (!storedValue) return

      const parsed = JSON.parse(storedValue) as Record<string, string>
      if (!parsed || typeof parsed !== "object") return

      setResolvedImages(parsed)
    } catch {
      // Ignore invalid cached image payloads.
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || Object.keys(resolvedImages).length === 0) return

    window.localStorage.setItem(
      DESTINATION_IMAGE_CACHE_KEY,
      JSON.stringify(resolvedImages)
    )
  }, [resolvedImages])

  useEffect(() => {
    if (!isBudgetLoading) {
      setBudgetLoadingMessageIndex(0)
      return
    }

    const interval = window.setInterval(() => {
      setBudgetLoadingMessageIndex((current) =>
        current >= budgetLoadingMessages.length - 1 ? current : current + 1
      )
    }, 1200)

    return () => window.clearInterval(interval)
  }, [isBudgetLoading])

  const buildSelectedPlace = (
    id: string,
    place?: {
      name?: string
      city?: string
      state?: string
      country?: string
      region?: string
      latitude?: number
      longitude?: number
      image?: string
      entryFee?: number
    }
  ): SelectedPlace | null => {
    const normalizedId = String(id)
    const destination = normalizedDestinations.find((item) => item.id === normalizedId)
    const name = place?.name || destination?.name
    if (!name) return null

    return {
      id: normalizedId,
      name,
      city: place?.city || destination?.city,
      state: place?.state || destination?.state,
      country: place?.country || destination?.country,
      region: place?.region || destination?.region,
      latitude: place?.latitude ?? destination?.latitude,
      longitude: place?.longitude ?? destination?.longitude,
      image: place?.image || resolvedImages[normalizedId] || destination?.image,
      entryFee: place?.entryFee ?? destination?.entryFee,
    }
  }

  const toggleSelection = async (
    id: string,
    place?: {
      name?: string
      city?: string
      state?: string
      country?: string
      region?: string
      latitude?: number
      longitude?: number
      image?: string
      entryFee?: number
    }
  ) => {
    const isSelected = selectedIds.includes(id)
    const newSelection = isSelected
      ? selectedIds.filter((sid) => sid !== id)
      : [...selectedIds, id]
    const selectedPlace = buildSelectedPlace(id, place)
    const nextPlaces = isSelected
      ? selectedPlaces.filter((item) => item.id !== id)
      : dedupeSelectedPlaces(selectedPlace ? [...selectedPlaces, selectedPlace] : selectedPlaces)

    setSelectedIds(newSelection)
    setSelectedPlaces(nextPlaces)
    setTripSetup((current) => ({
      ...current,
      selectedDestinations: nextPlaces.map((item) => ({
        id: item.id,
        name: item.name,
        city: item.city,
        state: item.state,
        country: item.country,
        region: item.region,
        image: item.image,
        latitude: item.latitude,
        longitude: item.longitude,
        entryFee: item.entryFee,
        budget: normalizedDestinations.find((destination) => destination.id === item.id)?.budget,
      })),
    }))

    try {
      await fetch("/api/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, place }),
      })
    } catch {
      // Keep the optimistic UI state if the request fails.
    }
  }

  const clearSelectedPlaces = async () => {
    setSelectedIds([])
    setSelectedPlaces([])
    setTripSetup((prev) => ({
      ...prev,
      selectedDestinations: [],
    }))

    try {
      await fetch("/api/selection", { method: "DELETE" })
    } catch {
      // Keep the optimistic UI state if the request fails.
    }
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const normalizeSearchText = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const clearFilters = () => {
    setSearchQuery("")
    setBudgetRange([0, 50000])
    setSelectedInterests([])
    setSelectedRegion("All Regions")
    setSelectedState("All States")
    setSelectedType("All Types")
    setUnescoOnly(false)
    setSortBy("popular")
  }

  const states = useMemo(
    () => ["All States", ...Array.from(new Set(normalizedDestinations.map((dest) => dest.state).filter(Boolean) as string[])).sort()],
    [normalizedDestinations]
  )

  const startPlan = () => {
    if (selectedIds.length === 0) {
      toast.error("Please select at least one destination to start planning.")
      return
    }
    setIsSelectionPopoverOpen(false)
    setIsTripSetupOpen(true)
  }

  const selectedPlacesWithImages = useMemo(
    () =>
      dedupeSelectedPlaces(
        selectedPlaces.map((place) => ({
          ...place,
          image:
            resolvedImages[place.id] ||
            place.image ||
            normalizedDestinations.find((destination) => destination.id === place.id)?.image,
          region:
            place.region ||
            normalizedDestinations.find((destination) => destination.id === place.id)?.region,
        }))
      ),
    [normalizedDestinations, resolvedImages, selectedPlaces]
  )

  const selectedDestinationsForSetup = useMemo(
    () =>
      selectedPlacesWithImages.map((place) => ({
        id: place.id,
        name: place.name,
        city: place.city,
        state: place.state,
        country: place.country,
        region: place.region,
        image: place.image,
        latitude: place.latitude,
        longitude: place.longitude,
        entryFee: place.entryFee,
        budget: normalizedDestinations.find((destination) => destination.id === place.id)?.budget,
      })) as SelectedDestination[],
    [normalizedDestinations, selectedPlacesWithImages]
  )

  const durationSummary = useMemo(() => {
    if (!tripDateRange?.from || !tripDateRange?.to) return null
    return getTripDuration({
      from: tripDateRange.from.toISOString(),
      to: tripDateRange.to.toISOString(),
    })
  }, [tripDateRange])

  const tripDistancePreview = useMemo(() => {
    if (!startingLocationData || selectedDestinationsForSetup.length === 0) {
      return { totalDistanceKm: 0, routeNames: [] };
    }

    const formattedDestinations = selectedDestinationsForSetup.map(p => ({
      ...p,
      lat: Number(p.latitude),
      lon: Number(p.longitude)
    }));

    if (
      !startingLocationData.lat ||
      !startingLocationData.lon ||
      formattedDestinations.some(p => !p.lat || !p.lon)
    ) {
      console.error("Invalid coordinates detected:", startingLocationData, formattedDestinations);
      return { totalDistanceKm: 0, routeNames: [] };
    }

    console.log("START LOCATION:", startingLocationData);
    console.log("DESTINATIONS:", formattedDestinations);

    return {
      totalDistanceKm: calculateDistance(startingLocationData, formattedDestinations),
      routeNames: [startingLocationData.name, ...formattedDestinations.map(d => d.name)]
    }
  }, [selectedDestinationsForSetup, startingLocationData])

  const totalDistance = tripDistancePreview.totalDistanceKm;

  const isValid =
    Boolean(startingLocationData) &&
    selectedDestinationsForSetup.length > 0 &&
    totalDistance > 0 &&
    people > 0 &&
    Boolean(tripDateRange?.from) &&
    Boolean(tripDateRange?.to);

  const canShowBudget =
    isValid &&
    Boolean(budgetPreference);

  const handleEstimateBudget = async () => {
    const nextErrors: typeof tripSetupErrors = {}
    if (!selectedDestinationsForSetup.length) {
      nextErrors.destinations = "Please select at least one destination."
    }
    if (!tripDateRange?.from || !tripDateRange?.to) {
      nextErrors.dates = "Select your departure and return dates."
    }
    if (!budgetPreference) {
      nextErrors.budgetPreference = "Choose a budget preference."
    }

    setTripSetupErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please complete the required trip details.")
      return
    }

    if (people < 1) {
      toast.error("Please enter a valid number of travellers.")
      return
    }

    setIsBudgetLoading(true)
    const confirmedFrom = tripDateRange?.from
    const confirmedTo = tripDateRange?.to
    if (!confirmedFrom || !confirmedTo) {
      setIsBudgetLoading(false)
      return
    }

    const nextTripSetup = {
      selectedDestinations: selectedDestinationsForSetup,
      dateRange: {
        from: confirmedFrom.toISOString(),
        to: confirmedTo.toISOString(),
      },
      travelStyle,
      budgetPreference,
      startingLocation,
      travelers: people,
    }

    setTripSetup(nextTripSetup)
    setBudgetEstimate(null)
    window.localStorage.setItem(TRIP_SETUP_STORAGE_KEY, JSON.stringify(nextTripSetup))
    window.localStorage.setItem(
      "WANDERLY_TRIP_CONTEXT",
      JSON.stringify({
        selectedPlaces: selectedDestinationsForSetup,
        startDate: nextTripSetup.dateRange.from,
        endDate: nextTripSetup.dateRange.to,
        travelStyle,
        budgetLevel:
          budgetPreference === "budget"
            ? "low"
            : budgetPreference === "mid-range"
              ? "medium"
              : "premium",
        origin: startingLocation,
        estimatedDistanceKm: tripDistancePreview.totalDistanceKm,
        routeNames: tripDistancePreview.routeNames,
      })
    )

    try {
      const response = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextTripSetup),
      })

      if (!response.ok) {
        throw new Error("Budget API request failed")
      }

      const estimate = await response.json()
      setBudgetEstimate(estimate)
    } catch {
      setBudgetEstimate(convertBudgetEstimateCurrency(buildBudgetEstimate(nextTripSetup), "INR", USD_TO_INR))
      toast.error("Live pricing is unavailable right now. Showing a smart fallback estimate instead.")
    } finally {
      setIsBudgetLoading(false)
      setIsTripSetupOpen(false)
      router.push("/budget")
    }
  }

  const dateInputLabel = tripDateRange?.from
    ? tripDateRange?.to
      ? `${format(tripDateRange.from, "dd MMM")} - ${format(tripDateRange.to, "dd MMM")} • ${durationSummary?.totalDays || 0} Days`
      : `${format(tripDateRange.from, "dd MMM yyyy")} - Select return date`
    : "Select start and end dates"

  const filteredDestinations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery)
    const queryTokens = normalizedQuery.split(" ").filter(Boolean)

    let filtered = normalizedDestinations.filter((dest) => {
      if (queryTokens.length > 0) {
        const fieldMatch = matchesDestinationSearch(dest, normalizedQuery)
        const searchable = normalizeSearchText(getSearchableText(dest))
        const tokenMatch = queryTokens.every((token) => searchable.includes(token))
        if (!fieldMatch && !tokenMatch) return false
      }

      if (dest.budget.min > budgetRange[1] || dest.budget.max < budgetRange[0]) {
        return false
      }

      if (
        selectedInterests.length > 0 &&
        !selectedInterests.some((interest) =>
          dest.interests.includes(interest.toLowerCase())
        )
      ) {
        return false
      }

      if (selectedRegion !== "All Regions" && dest.region !== selectedRegion) {
        return false
      }

      if (selectedState !== "All States" && dest.state !== selectedState) {
        return false
      }

      if (selectedType !== "All Types" && !dest.type.includes(selectedType)) {
        return false
      }

      if (unescoOnly && !dest.isUNESCO) {
        return false
      }

      return true
    })

    if (filtered.length === 0 && normalizedQuery) {
      const exactStateMatches = normalizedDestinations.filter(
        (dest) => normalizeSearchText(dest.state || "") === normalizedQuery
      )

      if (exactStateMatches.length > 0) {
        filtered = exactStateMatches
      }
    }

    if (filtered.length === 0 && normalizedQuery) {
      const exactCountryOrCityMatches = normalizedDestinations.filter((dest) => {
        const countryMatch = getCountrySearchTerms(dest.country)
          .map((term) => normalizeSearchText(term))
          .some((term) => term === normalizedQuery)
        const cityMatch = normalizeSearchText(dest.city || "") === normalizedQuery
        return countryMatch || cityMatch
      })

      if (exactCountryOrCityMatches.length > 0) {
        filtered = exactCountryOrCityMatches
      }
    }

    if (filtered.length === 0 && normalizedQuery) {
      filtered = normalizedDestinations.filter((dest) => {
        const stateMatch = normalizeSearchText(dest.state || "").includes(normalizedQuery)
        const cityMatch = normalizeSearchText(dest.city || "").includes(normalizedQuery)
        const countryMatch = getCountrySearchTerms(dest.country)
          .map((term) => normalizeSearchText(term))
          .some((term) => term.includes(normalizedQuery))
        const tagMatch = [...(dest.tags || []), ...dest.interests]
          .map((tag) => normalizeSearchText(tag))
          .some((tag) => tag.includes(normalizedQuery))

        return stateMatch || cityMatch || countryMatch || tagMatch
      })
    }

    switch (sortBy) {
      case "price-low":
        filtered.sort((a, b) => a.budget.min - b.budget.min)
        break
      case "price-high":
        filtered.sort((a, b) => b.budget.max - a.budget.max)
        break
      case "rating":
        filtered.sort((a, b) => b.rating - a.rating)
        break
      case "visitors":
        filtered.sort((a, b) => b.annualVisitors - a.annualVisitors)
        break
      case "revenue":
        filtered.sort((a, b) => b.tourismRevenue - a.tourismRevenue)
        break
      default:
        filtered.sort((a, b) => b.annualVisitors - a.annualVisitors)
        break
    }

    return filtered
  }, [searchQuery, budgetRange, selectedInterests, selectedRegion, selectedState, selectedType, unescoOnly, sortBy, normalizedDestinations])

  useEffect(() => {
    if (startedImagePrefetch.current) return
    startedImagePrefetch.current = true

    const pendingDestinations = normalizedDestinations.filter((place) => {
      const currentImage = resolvedImages[place.id] || place.image
      return !currentImage || currentImage.includes("source.unsplash.com") || currentImage.includes("images.unsplash.com") || currentImage.startsWith("data:image/")
    })

    if (pendingDestinations.length === 0) return

    let cancelled = false
    setIsImagePrefetching(true)

    const loadImages = async () => {
      try {
        const requestById = Object.fromEntries(
          pendingDestinations.map((place) => [place.id, buildImageRequest(place)])
        )
        const response = await fetch("/api/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            places: Object.values(requestById),
          }),
        })
        const data = await response.json()
        const imageMap = data?.images && typeof data.images === "object" ? data.images : {}

        if (cancelled) return

        setResolvedImages((prev) => {
          const next = { ...prev }
          for (const place of pendingDestinations) {
            const resolvedImage = imageMap[place.id] || prev[place.id] || destinationFallbackImage
            next[place.id] = resolvedImage
          }
          return next
        })
      } catch {
        if (cancelled) return

        setResolvedImages((prev) => {
          const next = { ...prev }
          for (const place of pendingDestinations) {
            next[place.id] = prev[place.id] || destinationFallbackImage
          }
          return next
        })
      } finally {
        if (!cancelled) {
          setIsImagePrefetching(false)
        }
      }
    }

    void loadImages()

    return () => {
      cancelled = true
    }
  }, [normalizedDestinations, resolvedImages])

  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (budgetRange[0] > 0 || budgetRange[1] < 50000 ? 1 : 0) +
    selectedInterests.length +
    (selectedRegion !== "All Regions" ? 1 : 0) +
    (selectedState !== "All States" ? 1 : 0) +
    (selectedType !== "All Types" ? 1 : 0) +
    (unescoOnly ? 1 : 0)

  useEffect(() => {
    setTripSetup((prev) => ({
      ...prev,
      discoveryContext: {
        searchQuery,
        budgetRange: [budgetRange[0], budgetRange[1]],
        selectedInterests,
        selectedRegion,
        selectedState,
        selectedType,
        unescoOnly,
        sortBy,
        activeFiltersCount,
      },
    }))
  }, [
    activeFiltersCount,
    budgetRange,
    searchQuery,
    selectedInterests,
    selectedRegion,
    selectedState,
    selectedType,
    setTripSetup,
    sortBy,
    unescoOnly,
  ])

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <Label className="mb-4 block text-sm font-medium">Daily Budget (INR)</Label>
        <Slider
          value={budgetRange}
          onValueChange={setBudgetRange}
          min={0}
          max={50000}
          step={500}
        />
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span>{formatCurrency(budgetRange[0])}</span>
          <span>{formatCurrency(budgetRange[1])}+</span>
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Region</Label>
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">State</Label>
        <Select value={selectedState} onValueChange={setSelectedState}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {states.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Place Type</Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {placeTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <button
          onClick={() => setUnescoOnly((prev) => !prev)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors",
            unescoOnly ? "border-chart-3 bg-chart-3/10" : "hover:bg-secondary"
          )}
        >
          <Award className={cn("h-5 w-5", unescoOnly ? "text-chart-3" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium", unescoOnly ? "text-foreground" : "text-muted-foreground")}>
            UNESCO World Heritage Only
          </span>
        </button>
      </div>

      <div>
        <Label className="mb-3 block text-sm font-medium">Interests</Label>
        <div className="flex flex-wrap gap-2">
          {interestTags.map((interest) => (
            <Badge
              key={interest}
              variant={selectedInterests.includes(interest) ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                selectedInterests.includes(interest)
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-secondary"
              )}
              onClick={() => toggleInterest(interest)}
            >
              {interest}
            </Badge>
          ))}
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <Button variant="outline" className="w-full bg-transparent" onClick={clearFilters}>
          Clear All Filters
        </Button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Explore World Famous Places
          </h1>
          <p className="text-muted-foreground">
            Discover {destinations.length} iconic destinations from the World Famous Places 2024 dataset
          </p>
        </div>

        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by state, city, country, or destination"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Visited</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="revenue">Tourism Revenue</SelectItem>
              </SelectContent>
            </Select>

            <Popover open={isSelectionPopoverOpen} onOpenChange={setIsSelectionPopoverOpen}>
              <div className="flex w-full items-center sm:w-auto">
                <Button
                  variant={selectedIds.length > 0 ? "default" : "outline"}
                  className={cn(
                    "h-11 flex-1 justify-between rounded-r-none border-r-0 px-4 shadow-sm sm:min-w-[190px]",
                    selectedIds.length > 0
                      ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
                      : "bg-card text-foreground hover:bg-secondary"
                  )}
                  onClick={startPlan}
                  disabled={selectedIds.length === 0}
                >
                  <span className="flex items-center gap-2">
                    <Plane className="h-4 w-4" />
                    Start Plan
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
                        selectedIds.length > 0
                          ? "bg-white/20 text-primary-foreground"
                          : "bg-secondary text-foreground"
                      )}
                    >
                      {selectedIds.length}
                    </span>
                  </span>
                </Button>
                <PopoverTrigger asChild>
                  <Button
                    variant={selectedIds.length > 0 ? "default" : "outline"}
                    size="icon"
                    className={cn(
                      "h-11 rounded-l-none border-l px-3 shadow-sm",
                      selectedIds.length > 0
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-card text-foreground hover:bg-secondary"
                    )}
                    aria-label="View selected places"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </div>
              <PopoverContent
                align="end"
                sideOffset={10}
                className="w-[min(92vw,24rem)] rounded-2xl border border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur"
              >
                <div className="border-b border-border/60 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Selected places</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Selected Places: {selectedIds.length}
                      </p>
                    </div>
                    {selectedIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3 text-muted-foreground hover:text-foreground"
                        onClick={clearSelectedPlaces}
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                </div>

                {selectedPlacesWithImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
                    <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No destinations selected yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add places from the cards to build your trip shortlist.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-80 space-y-2 overflow-y-auto px-3 py-3">
                      {selectedPlacesWithImages.map((place) => {
                        const location = [place.city, place.state, place.country].filter(Boolean).join(", ")
                        return (
                          <div
                            key={place.id}
                            className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2 transition-colors hover:bg-secondary/70"
                          >
                            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                              {place.image ? (
                                <img
                                  src={place.image}
                                  alt={place.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {location || place.region || "Selected destination"}
                              </p>
                              {place.region && (
                                <p className="mt-0.5 text-xs text-muted-foreground/80">{place.region}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Remove ${place.name} from selected places`}
                              onClick={() =>
                                toggleSelection(place.id, {
                                  name: place.name,
                                  city: place.city,
                                  state: place.state,
                                  country: place.country,
                                  region: place.region,
                                  latitude: place.latitude,
                                  longitude: place.longitude,
                                  image: place.image,
                                  entryFee: place.entryFee,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>

                    <div className="border-t border-border/60 px-4 py-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Review, adjust, and continue when your shortlist looks right.
                        </p>
                        <Button className="rounded-full px-4" onClick={startPlan}>
                          Open trip setup
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <section className="mb-6 lg:hidden">
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Filters</h2>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
            <FilterContent />
          </div>
        </section>

        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-72 shrink-0 lg:block">
            <div className="sticky top-24 rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-foreground">Filters</h2>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear
                  </Button>
                )}
              </div>
              <FilterContent />
            </div>
          </aside>

          <div className="flex-1">
            {activeFiltersCount > 0 && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Search: {searchQuery}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery("")} />
                  </Badge>
                )}
                {(budgetRange[0] > 0 || budgetRange[1] < 50000) && (
                  <Badge variant="secondary" className="gap-1">
                    {formatPriceRange(budgetRange[0], budgetRange[1])}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setBudgetRange([0, 50000])} />
                  </Badge>
                )}
                {selectedRegion !== "All Regions" && (
                  <Badge variant="secondary" className="gap-1">
                    {selectedRegion}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedRegion("All Regions")} />
                  </Badge>
                )}
                {selectedState !== "All States" && (
                  <Badge variant="secondary" className="gap-1">
                    {selectedState}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedState("All States")} />
                  </Badge>
                )}
                {selectedType !== "All Types" && (
                  <Badge variant="secondary" className="gap-1">
                    {selectedType}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedType("All Types")} />
                  </Badge>
                )}
                {unescoOnly && (
                  <Badge variant="secondary" className="gap-1">
                    UNESCO Only
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setUnescoOnly(false)} />
                  </Badge>
                )}
                {selectedInterests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="gap-1">
                    {interest}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => toggleInterest(interest)} />
                  </Badge>
                ))}
              </div>
            )}

            <p className="mb-6 text-sm text-muted-foreground">
              Showing {filteredDestinations.length} of {destinations.length} destinations
            </p>

            {isImagePrefetching && (
              <div className="mb-6 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading destination images...
              </div>
            )}

            {filteredDestinations.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDestinations.map((destination) => (
                  <DestinationCard
                    key={destination.id}
                    {...destination}
                    image={resolvedImages[destination.id] || destination.image || destinationFallbackImage}
                    isSelected={selectedIds.includes(destination.id)}
                    onToggleSelection={() =>
                      toggleSelection(destination.id, {
                        name: destination.name,
                        city: destination.city,
                        state: destination.state,
                        country: destination.country,
                        region: destination.region,
                        latitude: Number(destination.latitude),
                        longitude: Number(destination.longitude),
                        image: resolvedImages[destination.id] || destination.image,
                        entryFee: destination.entryFee,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border bg-card p-12 text-center">
                <p className="mb-2 text-lg font-medium text-foreground">
                  No destinations found
                </p>
                <p className="mb-4 text-muted-foreground">
                  Try adjusting your search or filters to see more results
                </p>
                <Button onClick={clearFilters}>Clear Filters</Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={isTripSetupOpen} onOpenChange={setIsTripSetupOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden rounded-[2rem] border border-white/40 bg-background/95 p-0 shadow-2xl backdrop-blur">
          <div className="grid max-h-[92vh] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
            <div className="overflow-y-auto border-b border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-6 lg:border-b-0 lg:border-r lg:p-8">
              <DialogHeader className="mb-8 space-y-2 text-left">
                <DialogTitle className="text-3xl font-semibold tracking-tight text-foreground">
                  Plan Your Trip
                </DialogTitle>
                <DialogDescription className="text-base text-muted-foreground">
                  {selectedDestinationsForSetup.length} destinations selected
                </DialogDescription>
              </DialogHeader>

              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Selected Places
                  </h3>
                  {selectedDestinationsForSetup.length > 0 && (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {selectedDestinationsForSetup.length} selected
                    </Badge>
                  )}
                </div>
                {selectedPlacesWithImages.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border bg-card/70 p-6 text-center text-sm text-muted-foreground">
                    No destinations selected yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedPlacesWithImages.map((place) => (
                      <div
                        key={place.id}
                        className="group flex items-center gap-3 rounded-3xl border border-border/70 bg-card/85 p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
                          {place.image ? (
                            <img
                              src={place.image}
                              alt={place.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <MapPin className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{place.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[place.state || place.city, place.country].filter(Boolean).join(", ")}
                          </p>
                        </div>
                        <button
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Remove ${place.name} from the trip setup`}
                          onClick={() =>
                            toggleSelection(place.id, {
                              name: place.name,
                              city: place.city,
                              state: place.state,
                              country: place.country,
                              region: place.region,
                              latitude: place.latitude,
                              longitude: place.longitude,
                              image: place.image,
                              entryFee: place.entryFee,
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mb-8 rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-foreground">Trip Duration</h3>
                    <p className="text-sm text-muted-foreground">Choose your start and end dates</p>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-border/70 bg-background/88 p-3 sm:p-4">
                  <div className="mb-3 rounded-2xl border border-border/70 bg-background px-4 py-3 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Selected dates</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{dateInputLabel}</p>
                  </div>
                  <div className="overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/70">
                    <Calendar
                      mode="range"
                      numberOfMonths={isMobile ? 1 : 2}
                      selected={tripDateRange}
                      onSelect={(range) => {
                        setTripDateRange(range)
                        setTripSetupErrors((prev) => ({ ...prev, dates: undefined }))
                      }}
                      defaultMonth={tripDateRange?.from || new Date()}
                      disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                      className="mx-auto w-full"
                    />
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    {durationSummary
                      ? `${format(tripDateRange?.from as Date, "MMM dd")} – ${format(tripDateRange?.to as Date, "MMM dd")} • ${durationSummary.totalDays} Days`
                      : tripDateRange?.from
                        ? "Select return date"
                        : "Choose dates to see trip duration"}
                  </p>
                  {tripDateRange?.from && !tripDateRange?.to && (
                    <p className="mt-1 text-sm text-muted-foreground">Select return date</p>
                  )}
                </div>
                {tripSetupErrors.dates && (
                  <p className="mt-3 text-sm text-destructive">{tripSetupErrors.dates}</p>
                )}
              </section>

              <div className="grid gap-5 md:grid-cols-2">
                <section className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-foreground">Travel Style</h3>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: "relaxed", label: "Relaxed" },
                      { value: "balanced", label: "Balanced" },
                      { value: "fast-paced", label: "Fast-paced" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          travelStyle === option.value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background hover:border-primary/40 hover:bg-primary/[0.04]"
                        )}
                        onClick={() => setTravelStyle(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-foreground">Budget Preference</h3>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { value: "budget", label: "Budget" },
                      { value: "mid-range", label: "Mid-range" },
                      { value: "luxury", label: "Luxury" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                          budgetPreference === option.value
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-background hover:border-primary/40 hover:bg-primary/[0.04]"
                        )}
                        onClick={() => setBudgetPreference(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {tripSetupErrors.budgetPreference && (
                    <p className="mt-3 text-sm text-destructive">{tripSetupErrors.budgetPreference}</p>
                  )}
                </section>
              </div>

              <section className="mt-5 rounded-[1.75rem] border border-border/70 bg-card/80 p-5 shadow-sm">
                <Label htmlFor="starting-location" className="mb-3 block font-semibold text-foreground">
                  Starting Location
                </Label>
                <Input
                  id="starting-location"
                  value={startingLocation}
                  onChange={(e) => setStartingLocation(e.target.value)}
                  placeholder="Enter your starting city"
                  className="h-11 rounded-2xl border-border/70 bg-background/90"
                />
                
                <Label htmlFor="people" className="mb-3 mt-5 block font-semibold text-foreground">
                  Number of People
                </Label>
                <Input
                  id="people"
                  type="number"
                  min="1"
                  value={people || ""}
                  onChange={(e) => setPeople(Number(e.target.value))}
                  placeholder="Enter number of travellers"
                  className="h-11 rounded-2xl border-border/70 bg-background/90"
                />
                
                <p className="mt-3 text-sm text-muted-foreground">
                  Adding your exact travel party and starting origin gives you highly precise budget metrics natively calculating shared multi-person layouts perfectly.
                </p>
              </section>
            </div>

            <div className="overflow-y-auto border-t border-border/60 bg-[linear-gradient(180deg,rgba(239,246,255,0.88),rgba(255,255,255,0.96))] p-6 lg:border-l lg:border-t-0 lg:p-8">
              
              {!startingLocationData && (
                <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  <p>Select starting location</p>
                </div>
              )}

              {(!people || people < 1) && (
                <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  <p>Please enter number of travellers</p>
                </div>
              )}

              {startingLocationData && selectedDestinationsForSetup.length === 0 && (
                <div className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-700">
                  <p>Select at least one destination</p>
                </div>
              )}

              {isValid && <DistanceCard distance={totalDistance} routeText={tripDistancePreview.routeNames.join(" → ")} />}
              
              {canShowBudget ? (
                <BudgetCardPlaceholder />
              ) : (
                <p className="text-muted-foreground mt-4 text-sm px-2 text-center">
                  Complete trip details to estimate budget
                </p>
              )}

              <div className="mt-5 rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-sm">
                <Button
                  className="h-12 w-full rounded-full text-base shadow-lg shadow-primary/20"
                  onClick={handleEstimateBudget}
                  disabled={!canShowBudget || isBudgetLoading}
                >
                  {isBudgetLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {budgetLoadingMessages[budgetLoadingMessageIndex]}
                    </>
                  ) : (
                    "Estimate Budget"
                  )}
                </Button>
                {tripSetupErrors.destinations && (
                  <p className="mt-3 text-sm text-destructive">{tripSetupErrors.destinations}</p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChatBubble />
    </div>
  )
}
