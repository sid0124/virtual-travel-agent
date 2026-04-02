"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Globe, Loader2, Search, SlidersHorizontal, X, Award, Briefcase, Plane } from "lucide-react"

import { Navigation } from "@/components/navigation"
import { DestinationCard } from "@/components/destination-card"
import { ChatBubble } from "@/components/chat-bubble"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { destinations, interestTags } from "@/lib/data"
import { cn } from "@/lib/utils"


type ExpertiseLevel = "beginner" | "intermediate" | "expert"
type SearchScope = "country" | "city" | "place"

type ApiLocation = {
  id: number
  name: string
  country: string
  countryCode: string
  state?: string
  lat: string
  lon: string
  population?: number
  image?: string
  kind?: SearchScope
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function locationRelevanceScore(loc: ApiLocation, query: string): number {
  const q = normalizeText(query)
  if (!q) return 0
  const tokens = q.split(" ").filter(Boolean)
  const target = normalizeText([loc.name, loc.state || "", loc.country].join(" "))
  const name = normalizeText(loc.name)

  let score = 0
  if (name === q) score += 100
  if (name.startsWith(q)) score += 45
  if (name.includes(q)) score += 30
  if (target.includes(q)) score += 20
  for (const token of tokens) {
    if (name.includes(token)) score += 8
    else if (target.includes(token)) score += 4
  }

  const pop = typeof loc.population === "number" ? loc.population : 0
  score += Math.min(20, Math.log10(Math.max(1, pop)))
  return score
}

function placeMatchesQuery(place: { name?: string; formatted?: string }, query: string) {
  const q = normalizeText(query)
  if (!q) return true

  const name = normalizeText(place?.name || "")
  const formatted = normalizeText(place?.formatted || "")
  const haystack = `${name} ${formatted}`.trim()

  if (name.includes(q) || haystack.includes(q)) return true

  const aliases: Record<string, string[]> = {
    "golden temple": ["harmandir", "darbar sahib", "shri harmandir"],
    "marine drive": ["netaji subhash chandra bose road", "queen s necklace"],
    "red fort": ["lal qila", "red fort delhi", "laal qila", "qila e mubarak"],
  }

  const mapped = Object.entries(aliases).find(([key]) => q.includes(key))
  if (mapped) {
    const [, words] = mapped
    return words.some((w) => name.includes(normalizeText(w)) || haystack.includes(normalizeText(w)))
  }

  const tokens = q.split(" ").filter((t) => t.length > 2)
  if (tokens.length === 0) return true
  return tokens.every((t) => name.includes(t)) || tokens.every((t) => haystack.includes(t))
}

function preferredSearchLabel(query: string, fallbackName: string) {
  const q = normalizeText(query)
  if (q.includes("golden temple")) return "Golden Temple"
  if (q.includes("marine drive")) return "Marine Drive"
  if (q.includes("red fort") || q.includes("lal qila") || q.includes("laal qila")) return "Red Fort"
  if (!q) return fallbackName
  return query.trim()
}

function getLocalSearchableText(dest: (typeof destinations)[number], searchScope: SearchScope) {
  if (searchScope === "country") return dest.country
  if (searchScope === "city") return dest.city
  return [dest.name, dest.famousFor, dest.type, dest.description].join(" ")
}

function hasVerifiedPlacePhoto(image?: string | null) {
  const src = String(image || "").trim()
  if (!src) return false
  if (src === "/placeholder.svg") return false
  if (src.startsWith("data:image/svg+xml")) return false
  return true
}

const countries = [
  { code: "ALL", name: "All Countries" },
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  // add more anytime
]

// Derived from world_famous_places_2024 dataset regions
const regions = [
  "All Regions",
  "Western Europe",
  "Southern Europe",
  "North America",
  "East Asia",
  "South Asia",
  "Southeast Asia",
  "South America",
  "Middle East",
  "North Africa",
  "Oceania",
]

// Derived from Type column
const placeTypes = [
  "All Types",
  "Monument/Tower",
  "Museum",
  "Historic Monument",
  "Archaeological Site",
  "Cathedral",
  "Natural Wonder",
  "Palace",
  "Skyscraper",
  "Cultural Building",
  "Park",
  "Urban Landmark",
]

export default function DestinationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [budgetRange, setBudgetRange] = useState([0, 500])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedRegion, setSelectedRegion] = useState("All Regions")
  const [selectedType, setSelectedType] = useState("All Types")
  const [unescoOnly, setUnescoOnly] = useState(false)
  const [sortBy, setSortBy] = useState("popular")
  const [useGlobalSearch, setUseGlobalSearch] = useState(true)
  const [countryCode, setCountryCode] = useState("ALL")
  const [searchScope, setSearchScope] = useState<SearchScope>("city")
  const [expertise, setExpertise] = useState<ExpertiseLevel>("beginner")

  const [apiLocations, setApiLocations] = useState<ApiLocation[]>([])
  const [imageMap, setImageMap] = useState<Record<string, string>>({})
  const [selectedLocation, setSelectedLocation] = useState<ApiLocation | null>(null)
  const [nearbyPlaces, setNearbyPlaces] = useState<
    Array<{ id: string; name: string; image?: string | null; formatted?: string; distance?: number; lat?: number; lon?: number }>
  >([])
  const [topPlaces, setTopPlaces] = useState<
    Array<{ id: string; name: string; address: string; image?: string | null }>
  >([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Selection Logic
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/selection")
      .then((res) => res.json())
      .then((data) => setSelectedIds(data.selectedIds || []))
      .catch(() => { })
  }, [])

  const toggleSelection = async (
    id: string,
    place?: {
      name?: string
      city?: string
      country?: string
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

    setSelectedIds(newSelection)

    try {
      await fetch("/api/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, place }),
      })
    } catch {
      // revert if failed - optional
    }
  }

  const startPlan = () => {
    if (selectedIds.length === 0) return
    router.push("/chat?mode=plan&startPlan=1")
  }

  const loadImage = async (key: string, query: string) => {
    if (imageMap[key]) return

    try {
      const res = await fetch(`/api/images?q=${encodeURIComponent(query)}`)
      const data = await res.json()

      if (data.image) {
        setImageMap((prev) => ({
          ...prev,
          [key]: data.image,
        }))
      }
    } catch { }
  }

  // --------- HELPERS (ADD HERE) ---------
  const estimateBudgetFromPopulation = (population?: number) => {
    const pop = population && population > 0 ? population : 500_000 // default fallback

    const base =
      pop >= 5_000_000 ? 120 :
        pop >= 1_000_000 ? 90 :
          pop >= 200_000 ? 65 :
            45

    const expertiseMultiplier =
      expertise === "beginner" ? 1 :
        expertise === "intermediate" ? 1.1 :
          1.25

    return {
      min: Math.round(base * 0.7 * expertiseMultiplier),
      max: Math.round(base * 2 * expertiseMultiplier),
      currency: "USD" as const,
    }
  }


  const expertiseAllows = (population?: number) => {
    // If population is missing or zero, DO NOT block
    if (!population || population === 0) return true

    if (expertise === "beginner") return population >= 200_000
    if (expertise === "intermediate") return population >= 50_000
    return true
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
    setBudgetRange([0, 500])
    setSelectedInterests([])
    setSelectedRegion("All Regions")
    setSelectedType("All Types")
    setUnescoOnly(false)
    setSortBy("popular")
    setSearchScope("city")
  }

  // Filter logic maps to dataset columns:
  // searchQuery -> scoped field based on searchScope (country/city/place)
  // budgetRange -> budget.min/budget.max
  // selectedInterests -> interests[]
  // selectedRegion -> region (from world_famous_places Region column)
  // selectedType -> type (from world_famous_places Type column)
  // unescoOnly -> isUNESCO (from UNESCO_World_Heritage column)
  const filteredDestinations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery)
    const queryTokens = normalizedQuery.split(" ").filter(Boolean)

    let filtered = destinations.filter((dest) => {
      if (queryTokens.length > 0) {
        const searchable = normalizeSearchText(getLocalSearchableText(dest, searchScope))
        const hasAllTokens = queryTokens.every((token) => searchable.includes(token))
        if (!hasAllTokens) return false
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

      if (selectedType !== "All Types" && !dest.type.includes(selectedType.replace("All Types", ""))) {
        return false
      }

      if (unescoOnly && !dest.isUNESCO) {
        return false
      }

      return true
    })

    // Sort using dataset fields:
    // popular = annualVisitors (Annual_Visitors_Millions)
    // rating = rating
    // price-low/high = budget.min
    // revenue = tourismRevenue (Tourism_Revenue_Million_USD)
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
  }, [searchQuery, searchScope, budgetRange, selectedInterests, selectedRegion, selectedType, unescoOnly, sortBy])

  useEffect(() => {
    if (useGlobalSearch) return
    if (searchQuery.trim().length < 2) return
    if (filteredDestinations.length > 0) return
    setUseGlobalSearch(true)
  }, [useGlobalSearch, searchQuery, filteredDestinations.length])

  // --------- GLOBAL SEARCH (GEONAMES) ---------
  useEffect(() => {
    if (!useGlobalSearch) return

    const q = searchQuery.trim()
    if (q.length < 2) {
      setApiLocations([])
      setApiError(null)
      return
    }

    setApiLoading(true)
    setApiError(null)
    console.log("useGlobalSearch:", useGlobalSearch, "searchQuery:", searchQuery, "country:", countryCode, "scope:", searchScope)

    const timer = setTimeout(async () => {
      try {
        console.log("Fetching GeoNames...")

        const countryQuery = countryCode === "ALL" ? "" : countryCode
        const res = await fetch(
          `/api/locations/search?q=${encodeURIComponent(q)}&country=${countryQuery}&scope=${encodeURIComponent(searchScope)}`
        )

        const contentType = res.headers.get("content-type") || ""
        if (!contentType.includes("application/json")) {
          const text = await res.text()
          throw new Error("API did not return JSON. Check API route. " + text.slice(0, 80))
        }
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to fetch locations")

        const results: ApiLocation[] = (data.results || [])
          .filter((p: ApiLocation) => expertiseAllows(p.population))
          .filter((p: ApiLocation) => {
            const b = estimateBudgetFromPopulation(p.population)
            return !(b.min > budgetRange[1] || b.max < budgetRange[0])
          })
          .sort((a: ApiLocation, b: ApiLocation) => locationRelevanceScore(b, q) - locationRelevanceScore(a, q))

        console.log("GeoNames results:", data.results?.length, data.results)

        const withImages = await Promise.all(
          results.map(async (loc) => {
            try {
              const q = `${loc.name}, ${loc.state || loc.country}`
              const res = await fetch(`/api/images?q=${encodeURIComponent(q)}`)
              const data = await res.json()

              return {
                ...loc,
                image: data.image || "/placeholder.svg",
              }
            } catch {
              return {
                ...loc,
                image: "/placeholder.svg",
              }
            }
          })
        )

        setApiLocations(withImages)

        // Auto-select known landmark override if present; else only when a single result exists.
        const nq = normalizeText(q)
        const landmarkPreferred = withImages.find((loc) => {
          const name = normalizeText(loc.name)
          const state = normalizeText(loc.state || "")
          const country = normalizeText(loc.country || "")
          if (nq.includes("golden temple")) {
            return name.includes("golden temple") || name.includes("harmandir")
          }
          if (nq.includes("marine drive")) {
            return name.includes("marine drive") && (state.includes("mumbai") || country.includes("india"))
          }
          if (nq.includes("red fort") || nq.includes("lal qila") || nq.includes("laal qila")) {
            return (name.includes("red fort") || name.includes("lal qila")) && (state.includes("delhi") || country.includes("india"))
          }
          return false
        })

        if (landmarkPreferred) {
          setSelectedLocation(landmarkPreferred)
        } else if (withImages.length === 1) {
          setSelectedLocation(withImages[0])
        }

      } catch (err: any) {
        setApiLocations([])
        setApiError(err.message || "Failed to fetch locations")
      } finally {
        setApiLoading(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [useGlobalSearch, searchQuery, countryCode, searchScope, expertise, budgetRange])

  useEffect(() => {
    if (!useGlobalSearch) return
    if (apiLocations.length === 0) return

    const loadImages = async () => {
      await Promise.all(
        apiLocations.map(async (loc) => {
          const key = `geo-${loc.id}`
          const imageQuery = `${loc.name}, ${loc.state || loc.country}, travel`
          await loadImage(key, imageQuery)
        })
      )
    }

    loadImages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLocations, useGlobalSearch])

  // --------- PLACES NEAR SELECTED CITY (GEOAPIFY) ---------
  useEffect(() => {
    if (!selectedLocation) return

    const loadTopPlaces = async () => {
      setPlacesLoading(true)
      try {
        const res = await fetch(
          `/api/places/top?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}&limit=5`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to fetch places")
        const places = Array.isArray(data?.places) ? data.places : []
        setNearbyPlaces(places.filter((place: any) => hasVerifiedPlacePhoto(place?.image)))
      } catch {
        setNearbyPlaces([])
      } finally {
        setPlacesLoading(false)
      }
    }

    loadTopPlaces()
  }, [selectedLocation])

  useEffect(() => {
    if (!selectedLocation) return

    const loadTopPlaces = async () => {
      try {
        const res = await fetch(
          `/api/places/nearby?lat=${selectedLocation.lat}&lon=${selectedLocation.lon}`
        )
        const data = await res.json()
        setTopPlaces(data.places || [])
      } catch {
        setTopPlaces([])
      }
    }

    loadTopPlaces()
  }, [selectedLocation])


  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (budgetRange[0] > 0 || budgetRange[1] < 500 ? 1 : 0) +
    selectedInterests.length +
    (selectedRegion !== "All Regions" ? 1 : 0) +
    (selectedType !== "All Types" ? 1 : 0) +
    (unescoOnly ? 1 : 0)

  const displayedNearbyPlaces = useMemo(() => {
    if (!useGlobalSearch) return nearbyPlaces
    const q = searchQuery.trim()
    if (!q) return nearbyPlaces
    const matched = nearbyPlaces.filter((p) => placeMatchesQuery({ name: p.name, formatted: p.formatted }, q))
    return matched.length > 0 ? matched : nearbyPlaces
  }, [useGlobalSearch, searchQuery, nearbyPlaces])

  const searchedPlace = useMemo(() => {
    if (!useGlobalSearch) return null
    const q = searchQuery.trim()
    if (!q || displayedNearbyPlaces.length === 0) return null
    return displayedNearbyPlaces.find((p) => placeMatchesQuery({ name: p.name, formatted: p.formatted }, q)) || displayedNearbyPlaces[0] || null
  }, [useGlobalSearch, searchQuery, displayedNearbyPlaces])

  const nearbyWithoutSearchedPlace = useMemo(() => {
    if (!searchedPlace) return displayedNearbyPlaces
    return displayedNearbyPlaces.filter((p) => String(p.id) !== String(searchedPlace.id))
  }, [displayedNearbyPlaces, searchedPlace])

  const searchedPlaceDisplay = useMemo(() => {
    if (!searchedPlace) return null
    if (!hasVerifiedPlacePhoto(searchedPlace.image)) return null
    const displayName = preferredSearchLabel(searchQuery, searchedPlace.name)
    const officialName = searchedPlace.name
    const description = searchedPlace.formatted || `Explore ${officialName}`
    const mergedDescription =
      normalizeText(displayName) !== normalizeText(officialName)
        ? `Official name: ${officialName}. ${description}`
        : description

    return {
      ...searchedPlace,
      image: searchedPlace.image,
      displayName,
      mergedDescription,
    }
  }, [searchedPlace, searchQuery])

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <Label className="mb-4 block text-sm font-medium">Daily Budget (USD)</Label>
        <Slider
          value={budgetRange}
          onValueChange={setBudgetRange}
          min={0}
          max={500}
          step={10}
        />
        <div className="mt-2 flex justify-between text-sm text-muted-foreground">
          <span>${budgetRange[0]}</span>
          <span>${budgetRange[1]}+</span>
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
          onClick={() => setUnescoOnly(!unescoOnly)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border p-3 transition-colors",
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

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">


          {/* 🔹 GLOBAL SEARCH + COUNTRY + EXPERTISE (ADD HERE) */}
          <div className="flex flex-wrap items-center gap-3">
            {useGlobalSearch && apiError && (
              <div className="mb-4 w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <Button
              type="button"
              variant={useGlobalSearch ? "default" : "outline"}
              className="gap-2 bg-transparent"
              onClick={() => {
                setUseGlobalSearch((v) => !v)
                setApiLocations([])
                setSelectedLocation(null)
                setNearbyPlaces([])
                setApiError(null)
              }}
            >
              <Globe className="h-4 w-4" />
              {useGlobalSearch ? "Global Search ON" : "Global Search"}
            </Button>

            <Button
              variant={selectedIds.length > 0 ? "default" : "outline"}
              className={cn(
                "gap-2",
                selectedIds.length > 0 ? "bg-primary text-primary-foreground shadow-md animate-pulse" : "bg-transparent opacity-50 cursor-not-allowed"
              )}
              onClick={startPlan}
              disabled={selectedIds.length === 0}
            >
              <Plane className="h-4 w-4" />
              Start Plan {selectedIds.length > 0 && `(${selectedIds.length})`}
            </Button>

            {useGlobalSearch && (
              <>
                <Select
                  value={searchScope}
                  onValueChange={(v) => {
                    setSearchScope(v as SearchScope)
                    setSelectedLocation(null)
                    setApiLocations([])
                    setNearbyPlaces([])
                    setTopPlaces([])
                    setApiError(null)
                  }}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Search In" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="city">City</SelectItem>
                    <SelectItem value="place">Place</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={expertise}
                  onValueChange={(v) => setExpertise(v as ExpertiseLevel)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Expertise" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* 🔹 EXISTING SEARCH INPUT (KEEP AS-IS) */}
          <div className="relative min-w-[240px] flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                useGlobalSearch
                  ? searchScope === "country"
                    ? "Search country (e.g. India, France, Japan)"
                    : searchScope === "city"
                      ? "Search city or town (e.g. Agra, Paris, Kyoto)"
                      : "Search place (e.g. Eiffel Tower, Golden Temple)"
                  : searchScope === "country"
                    ? "Search by country..."
                    : searchScope === "city"
                      ? "Search by city..."
                      : "Search by place..."
              }
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (selectedLocation) {
                  setSelectedLocation(null)
                  setNearbyPlaces([])
                  setTopPlaces([])
                }
              }}
              className="pl-10"
            />
            {useGlobalSearch && searchQuery.trim().length >= 2 && !selectedLocation && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-card shadow-sm">
                {apiLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Searching...</div>
                ) : apiLocations.length > 0 ? (
                  apiLocations.slice(0, 6).map((loc) => (
                    <button
                      key={loc.id}
                      className="w-full text-left px-3 py-2 hover:bg-secondary text-sm"
                      onClick={() => {
                        setSelectedLocation(loc)
                        setApiLocations([])
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{loc.name}</div>
                        <span className="text-xs uppercase text-muted-foreground">{loc.kind || searchScope}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {loc.state ? `${loc.state}, ` : ""}{loc.country}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-sm text-muted-foreground">No matches</div>
                )}
              </div>
            )}
          </div>

          {/* 🔹 SORT + FILTER BUTTONS (KEEP AS-IS) */}
          <div className="flex items-center gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
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

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 lg:hidden bg-transparent">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>



        </div>

        <div className="flex gap-8">
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
                {(budgetRange[0] > 0 || budgetRange[1] < 500) && (
                  <Badge variant="secondary" className="gap-1">
                    ${budgetRange[0]} - ${budgetRange[1]}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setBudgetRange([0, 500])} />
                  </Badge>
                )}
                {selectedRegion !== "All Regions" && (
                  <Badge variant="secondary" className="gap-1">
                    {selectedRegion}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedRegion("All Regions")} />
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

            {useGlobalSearch && searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
              <div className="mb-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                Type at least 2 letters to search locations.
              </div>
            )}

            <p className="mb-6 text-sm text-muted-foreground">
              {useGlobalSearch
                ? `Showing ${
                    selectedLocation ? displayedNearbyPlaces.length : apiLocations.length
                  } ${
                    (selectedLocation ? displayedNearbyPlaces.length : apiLocations.length) === 1 ? "location" : "locations"
                  }`
                : `Showing ${filteredDestinations.length} of ${destinations.length} destinations`}
            </p>


            {useGlobalSearch ? (
              selectedLocation ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                      Top places near {selectedLocation.name}
                    </h2>
                    <Button
                      variant="outline"
                      className="bg-transparent"
                      onClick={() => {
                        setSelectedLocation(null)
                        setNearbyPlaces([])
                      }}
                    >
                      Change city
                    </Button>
                  </div>

                  {placesLoading ? (
                    <div className="rounded-xl border bg-card p-12 text-center">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="mb-1 text-lg font-medium">Loading places...</p>
                      <p className="text-muted-foreground">Fetching nearby places for {selectedLocation.name}</p>
                    </div>
                  ) : displayedNearbyPlaces.length > 0 ? (
                    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
                      {searchedPlaceDisplay && (
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-foreground">Searched Place</h3>
                          <DestinationCard
                            key={searchedPlaceDisplay.id}
                            id={searchedPlaceDisplay.id}
                            name={searchedPlaceDisplay.displayName}
                            country={selectedLocation.country}
                            city={selectedLocation.state || ""}
                            image={searchedPlaceDisplay.image || "/placeholder.svg"}
                            description={searchedPlaceDisplay.mergedDescription}
                            bestTime="Year round"
                            budget={estimateBudgetFromPopulation(selectedLocation.population)}
                            rating={4.7}
                            interests={["culture", "history", "food"]}
                            type="Famous Spot"
                            className="h-full"
                            isSelected={selectedIds.includes(searchedPlaceDisplay.id)}
                            onToggleSelection={() =>
                              toggleSelection(searchedPlaceDisplay.id, {
                                name: searchedPlaceDisplay.displayName,
                                city: selectedLocation.name,
                                country: selectedLocation.country,
                                latitude: Number(searchedPlaceDisplay.lat),
                                longitude: Number(searchedPlaceDisplay.lon),
                                image: searchedPlaceDisplay.image || undefined,
                              })
                            }
                          />
                        </div>
                      )}

                      {nearbyWithoutSearchedPlace.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-foreground">Nearby Places</h3>
                          <div className="grid gap-6 sm:grid-cols-2">
                            {nearbyWithoutSearchedPlace.slice(0, 6).map((place) => (
                              <DestinationCard
                                key={place.id}
                                id={place.id}
                                name={place.name}
                                country={selectedLocation.country}
                                city={selectedLocation.state || ""}
                                image={place.image || "/placeholder.svg"}
                                description={place.formatted || `Explore ${place.name}`}
                                bestTime="Year round"
                                budget={estimateBudgetFromPopulation(selectedLocation.population)}
                                rating={4.7}
                                interests={["culture", "history", "food"]}
                                type="Famous Spot"
                                className="h-full"
                                isSelected={selectedIds.includes(place.id)}
                                onToggleSelection={() =>
                                  toggleSelection(place.id, {
                                    name: place.name,
                                    city: selectedLocation.name,
                                    country: selectedLocation.country,
                                    latitude: Number(place.lat),
                                    longitude: Number(place.lon),
                                    image: place.image || undefined,
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border bg-card p-12 text-center">
                      <p className="mb-2 text-lg font-medium">No famous places found</p>
                      <p className="text-muted-foreground">
                        Try another city (or increase search radius)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                apiLoading && searchQuery.trim().length >= 2 ? (
                  <div className="rounded-xl border bg-card p-12 text-center">
                    <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="mb-1 text-lg font-medium">Searching places...</p>
                    <p className="text-muted-foreground">Finding results for "{searchQuery.trim()}"</p>
                  </div>
                ) : (
                  <div className="rounded-xl border bg-card p-12 text-center">
                    <p className="mb-2 text-lg font-medium">Search a city to begin</p>
                    <p className="text-muted-foreground">
                      Example: Agra, Paris, Jaipur, Dubai
                    </p>
                  </div>
                )
              )
            ) : filteredDestinations.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredDestinations.map((destination) => (
                  <DestinationCard
                    key={destination.id}
                    {...destination}
                    isSelected={selectedIds.includes(destination.id)}
                    onToggleSelection={() =>
                      toggleSelection(destination.id, {
                        name: destination.name,
                        city: destination.city,
                        country: destination.country,
                        latitude: Number(destination.latitude),
                        longitude: Number(destination.longitude),
                        image: destination.image,
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
                  Try adjusting your filters to see more results
                </p>
                <Button onClick={clearFilters}>Clear Filters</Button>
              </div>
            )}

          </div> {/* flex-1 */}
        </div> {/* flex gap-8 */}
      </main>

      <ChatBubble />
    </div>
  )
}
