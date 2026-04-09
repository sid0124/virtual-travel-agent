import { buildDestinationImageUrl, destinations, destinationFallbackImage } from "@/lib/data"
import { normalizeSelectedDestination, type SelectedDestination } from "@/lib/trip-budget"

export type PlannerDestinationSourceType =
  | "city"
  | "state"
  | "landmark"
  | "beach"
  | "monument"
  | "district"
  | "attraction"
  | "region"
  | "destination"

export type PlannerDestination = SelectedDestination & {
  destinationKey: string
  originalName: string
  sourceType: PlannerDestinationSourceType
  sourceItemId: string
}

type RawPlannerPlace = {
  id?: string
  label?: string
  name?: string
  title?: string
  city?: string
  state?: string
  country?: string
  region?: string
  image?: string
  imageFallback?: string
  latitude?: number
  longitude?: number
  entryFee?: number
  type?: string
  category?: string
  destinationKey?: string
  originalName?: string
  sourceItemId?: string
}

type StaticPlannerMapping = {
  name: string
  city: string
  state: string
  country: string
  region: string
  latitude: number
  longitude: number
  sourceType: PlannerDestinationSourceType
  destinationName?: string
}

const DEFAULT_COUNTRY = "India"
const DEFAULT_REGION = "South Asia"

const STATIC_PLACE_MAPPINGS: Record<string, StaticPlannerMapping> = {
  "taj mahal": {
    name: "Agra",
    city: "Agra",
    state: "Uttar Pradesh",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 27.1767,
    longitude: 78.0081,
    sourceType: "landmark",
    destinationName: "Agra",
  },
  "fort aguada": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.4922,
    longitude: 73.7736,
    sourceType: "landmark",
  },
  "baga beach": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.5553,
    longitude: 73.7517,
    sourceType: "beach",
  },
  "anjuna beach": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.574,
    longitude: 73.7389,
    sourceType: "beach",
  },
  "calangute beach": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.5439,
    longitude: 73.7553,
    sourceType: "beach",
  },
  candolim: {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.518,
    longitude: 73.7626,
    sourceType: "district",
  },
  "candolim beach": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.518,
    longitude: 73.7626,
    sourceType: "beach",
  },
  "gateway of india": {
    name: "Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 18.9218,
    longitude: 72.8347,
    sourceType: "landmark",
    destinationName: "Mumbai",
  },
  "india gate": {
    name: "Delhi",
    city: "New Delhi",
    state: "Delhi",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 28.6129,
    longitude: 77.2295,
    sourceType: "monument",
  },
  "red fort": {
    name: "Delhi",
    city: "New Delhi",
    state: "Delhi",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 28.6562,
    longitude: 77.241,
    sourceType: "monument",
  },
  "marine drive": {
    name: "Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 18.943,
    longitude: 72.8238,
    sourceType: "attraction",
    destinationName: "Mumbai",
  },
  "hawa mahal": {
    name: "Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 26.9239,
    longitude: 75.8267,
    sourceType: "landmark",
    destinationName: "Jaipur",
  },
  "charminar": {
    name: "Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 17.3616,
    longitude: 78.4747,
    sourceType: "landmark",
    destinationName: "Hyderabad",
  },
  agra: {
    name: "Agra",
    city: "Agra",
    state: "Uttar Pradesh",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 27.1767,
    longitude: 78.0081,
    sourceType: "city",
    destinationName: "Agra",
  },
  jaipur: {
    name: "Jaipur",
    city: "Jaipur",
    state: "Rajasthan",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 26.9124,
    longitude: 75.7873,
    sourceType: "city",
    destinationName: "Jaipur",
  },
  mumbai: {
    name: "Mumbai",
    city: "Mumbai",
    state: "Maharashtra",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 19.076,
    longitude: 72.8777,
    sourceType: "city",
    destinationName: "Mumbai",
  },
  hyderabad: {
    name: "Hyderabad",
    city: "Hyderabad",
    state: "Telangana",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 17.385,
    longitude: 78.4867,
    sourceType: "city",
    destinationName: "Hyderabad",
  },
  manali: {
    name: "Manali",
    city: "Manali",
    state: "Himachal Pradesh",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 32.2432,
    longitude: 77.1892,
    sourceType: "city",
    destinationName: "Manali",
  },
  goa: {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.2993,
    longitude: 74.124,
    sourceType: "state",
  },
  "north goa": {
    name: "Goa",
    city: "Goa",
    state: "Goa",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 15.5333,
    longitude: 73.8333,
    sourceType: "district",
  },
  delhi: {
    name: "Delhi",
    city: "New Delhi",
    state: "Delhi",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 28.6139,
    longitude: 77.209,
    sourceType: "state",
  },
  "new delhi": {
    name: "Delhi",
    city: "New Delhi",
    state: "Delhi",
    country: DEFAULT_COUNTRY,
    region: DEFAULT_REGION,
    latitude: 28.6139,
    longitude: 77.209,
    sourceType: "city",
  },
}

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "destination"
}

function getPlaceLabel(place?: RawPlannerPlace | null) {
  return String(place?.label || place?.name || place?.title || "").trim()
}

function buildPlannerImage(input: { name: string; city?: string; state?: string; country?: string; category?: string }) {
  return buildDestinationImageUrl({
    name: input.name,
    city: input.city,
    state: input.state,
    country: input.country,
    category: input.category || "Destination",
  })
}

function createSyntheticPlannerDestination(
  input: {
    name: string
    city?: string
    state?: string
    country?: string
    region?: string
    latitude?: number
    longitude?: number
    image?: string
    entryFee?: number
    sourceType: PlannerDestinationSourceType
    originalName: string
    sourceItemId: string
  }
): PlannerDestination {
  const baseName = String(input.name || input.city || input.originalName).trim()
  const state = String(input.state || "").trim()
  const destinationKey = slugify([input.city || baseName, state, input.country || DEFAULT_COUNTRY].filter(Boolean).join(" "))
  const id = `planner-${destinationKey}`

  return {
    id,
    name: baseName,
    city: input.city || baseName,
    state: state || undefined,
    country: input.country || DEFAULT_COUNTRY,
    region: input.region || DEFAULT_REGION,
    image:
      String(input.image || "").trim() ||
      buildPlannerImage({
        name: baseName,
        city: input.city || baseName,
        state: state || undefined,
        country: input.country || DEFAULT_COUNTRY,
        category: "Destination",
      }) ||
      destinationFallbackImage,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    entryFee: Number.isFinite(Number(input.entryFee)) ? Number(input.entryFee) : undefined,
    destinationKey,
    originalName: input.originalName,
    sourceType: input.sourceType,
    sourceItemId: input.sourceItemId,
  }
}

function matchDatasetDestination(query: { id?: string; name?: string; city?: string; state?: string; country?: string }) {
  const id = String(query.id || "").trim()
  if (id) {
    const byId = destinations.find((destination) => destination.id === id)
    if (byId) return byId
  }

  const name = normalizeText(query.name || "")
  const city = normalizeText(query.city || "")
  const state = normalizeText(query.state || "")
  const country = normalizeText(query.country || "")

  return (
    destinations.find((destination) => normalizeText(destination.name) === name) ||
    destinations.find((destination) => normalizeText(destination.city) === city && (!country || normalizeText(destination.country) === country)) ||
    destinations.find(
      (destination) =>
        normalizeText(destination.name) === city ||
        (state && normalizeText(destination.state || "") === state && (!country || normalizeText(destination.country) === country))
    )
  )
}

function matchExactPlannerDatasetDestination(query: { id?: string; name?: string; city?: string; country?: string }) {
  const id = String(query.id || "").trim()
  if (id) {
    const byId = destinations.find((destination) => destination.id === id)
    if (byId) return byId
  }

  const name = normalizeText(query.name || "")
  const city = normalizeText(query.city || "")
  const country = normalizeText(query.country || "")

  return (
    destinations.find((destination) => normalizeText(destination.name) === name && (!country || normalizeText(destination.country) === country)) ||
    destinations.find((destination) => normalizeText(destination.city) === city && (!country || normalizeText(destination.country) === country))
  )
}

function buildPlannerDestinationFromDataset(
  datasetMatch: (typeof destinations)[number],
  raw: RawPlannerPlace,
  originalName: string,
  sourceItemId: string,
  sourceType: PlannerDestinationSourceType
): PlannerDestination {
  const normalized = normalizeSelectedDestination({
    ...datasetMatch,
    image: String(raw.image || "").trim() || datasetMatch.image,
    originalName,
    sourceItemId,
    sourceType,
    destinationKey: datasetMatch.id,
  })

  if (!normalized) {
    return createSyntheticPlannerDestination({
      name: datasetMatch.name,
      city: datasetMatch.city,
      state: datasetMatch.state,
      country: datasetMatch.country,
      region: datasetMatch.region,
      latitude: datasetMatch.latitude,
      longitude: datasetMatch.longitude,
      image: datasetMatch.image,
      entryFee: datasetMatch.entryFee,
      sourceType,
      originalName,
      sourceItemId,
    })
  }

  return normalized as PlannerDestination
}

function resolveMappedPlannerDestination(raw: RawPlannerPlace, label: string, sourceItemId: string) {
  const normalizedLabel = normalizeText(label)
  const mapped = STATIC_PLACE_MAPPINGS[normalizedLabel]
  if (!mapped) return null

  const datasetMatch = mapped.destinationName
    ? matchExactPlannerDatasetDestination({ name: mapped.destinationName, city: mapped.city, country: mapped.country })
    : matchExactPlannerDatasetDestination({ name: mapped.name, city: mapped.city, country: mapped.country })

  if (datasetMatch) {
    return buildPlannerDestinationFromDataset(datasetMatch, raw, label, sourceItemId, mapped.sourceType)
  }

  return createSyntheticPlannerDestination({
    name: mapped.name,
    city: mapped.city,
    state: mapped.state,
    country: mapped.country,
    region: mapped.region,
    latitude: mapped.latitude,
    longitude: mapped.longitude,
    image: String(raw.image || "").trim(),
    entryFee: raw.entryFee,
    sourceType: mapped.sourceType,
    originalName: label,
    sourceItemId,
  })
}

export function normalizeChatbotPlace(place?: RawPlannerPlace | null): PlannerDestination | null {
  if (!place) return null

  const label = getPlaceLabel(place)
  const sourceItemId = String(place.sourceItemId || place.id || label).trim()
  if (!label && !place.city && !place.state) return null

  const explicitSourceType = normalizeText(place.type || place.category || "") as PlannerDestinationSourceType
  const mappedDestination = resolveMappedPlannerDestination(place, label, sourceItemId)
  if (mappedDestination) return mappedDestination

  const datasetMatch = matchDatasetDestination({
    id: place.destinationKey || place.id,
    name: label,
    city: place.city,
    state: place.state,
    country: place.country,
  })
  if (datasetMatch) {
    return buildPlannerDestinationFromDataset(
      datasetMatch,
      place,
      label || datasetMatch.name,
      sourceItemId || datasetMatch.id,
      explicitSourceType || "destination"
    )
  }

  const fallbackName = String(place.city || place.state || label).trim()
  if (!fallbackName) return null

  return createSyntheticPlannerDestination({
    name: place.city ? fallbackName : label || fallbackName,
    city: place.city || fallbackName,
    state: place.state,
    country: place.country || DEFAULT_COUNTRY,
    region: place.region || DEFAULT_REGION,
    latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : undefined,
    longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude) : undefined,
    image: String(place.image || place.imageFallback || "").trim(),
    entryFee: place.entryFee,
    sourceType: explicitSourceType || (place.city && !label ? "city" : "destination"),
    originalName: label || fallbackName,
    sourceItemId: sourceItemId || fallbackName,
  })
}

export function normalizeChatbotPlaces(places: Array<RawPlannerPlace | null | undefined>) {
  const normalized = new Map<string, PlannerDestination>()

  for (const place of places) {
    const plannerDestination = normalizeChatbotPlace(place)
    if (!plannerDestination) continue
    normalized.set(plannerDestination.id, plannerDestination)
  }

  return Array.from(normalized.values())
}
