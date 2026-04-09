import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { normalizePlaceSelection } from "@/lib/chat-planner"
import { destinations } from "@/lib/data"
import { normalizeChatbotPlaces } from "@/lib/planner-destination"

type SelectedPlaceSnapshot = {
  id: string
  name: string
  image?: string
  city?: string
  state?: string
  country?: string
  region?: string
  entryFee?: number
  latitude?: number
  longitude?: number
  destinationKey?: string
  originalName?: string
  sourceType?: string
  sourceItemId?: string
}

function parseJsonArray<T>(raw: string | undefined): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeSnapshot(place: any): SelectedPlaceSnapshot | null {
  const normalized = normalizePlaceSelection(place)
  if (!normalized) return null

  return {
    id: normalized.id,
    name: normalized.name,
    image: normalized.image,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    region: normalized.region,
    entryFee: normalized.entryFee,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    destinationKey: normalized.destinationKey,
    originalName: normalized.originalName,
    sourceType: normalized.sourceType,
    sourceItemId: normalized.sourceItemId,
  }
}

function parseSelectedPlaceSnapshots(raw: string | undefined) {
  return parseJsonArray<any>(raw)
    .map((place) => normalizeSnapshot(place))
    .filter(Boolean) as SelectedPlaceSnapshot[]
}

function buildSelectedPlaces(selectedIds: string[], customPlaces: SelectedPlaceSnapshot[]) {
  const selectedIdSet = new Set(selectedIds)
  const datasetPlaces: SelectedPlaceSnapshot[] = destinations
    .filter((destination) => selectedIdSet.has(String(destination.id)))
    .map((destination) => ({
      id: destination.id,
      name: destination.name,
      image: destination.image,
      city: destination.city,
      state: destination.state,
      country: destination.country,
      region: destination.region,
      entryFee: destination.entryFee,
      latitude: destination.latitude,
      longitude: destination.longitude,
      destinationKey: destination.id,
      originalName: destination.name,
      sourceType: "destination",
      sourceItemId: destination.id,
    }))
  const customById = new Map(customPlaces.map((place) => [place.id, place]))
  const datasetById = new Map(datasetPlaces.map((place) => [place.id, place]))

  return selectedIds
    .map((id) => {
      const datasetPlace = datasetById.get(id)
      const customPlace = customById.get(id)
      if (datasetPlace && customPlace) {
        return {
          ...datasetPlace,
          originalName: customPlace.originalName || datasetPlace.originalName,
          sourceType: customPlace.sourceType || datasetPlace.sourceType,
          sourceItemId: customPlace.sourceItemId || datasetPlace.sourceItemId,
          destinationKey: customPlace.destinationKey || datasetPlace.destinationKey,
        }
      }
      return datasetPlace || customPlace
    })
    .filter(Boolean) as SelectedPlaceSnapshot[]
}

export async function GET() {
  const cookieStore = await cookies()
  const selectionCookie = cookieStore.get("travel_selection")
  const customPlacesCookie = cookieStore.get("travel_selection_places")
  const selectedIds = parseJsonArray<any>(selectionCookie?.value).map((v) => String(v))
  const customPlaces = parseSelectedPlaceSnapshots(customPlacesCookie?.value)
  const selectedPlaces = buildSelectedPlaces(selectedIds, customPlaces)

  return NextResponse.json({ selectedIds, selectedPlaces })
}

export async function POST(req: Request) {
  const body = await req.json()
  const id = body?.id
  const place = body?.place
  const cookieStore = await cookies()
  const selectionCookie = cookieStore.get("travel_selection")
  const customPlacesCookie = cookieStore.get("travel_selection_places")
  let selectedIds = parseJsonArray<any>(selectionCookie?.value).map((v) => String(v))
  let customPlaces = parseSelectedPlaceSnapshots(customPlacesCookie?.value)
  const normalizedId = String(id)

  if (selectedIds.includes(normalizedId)) {
    selectedIds = selectedIds.filter((sid) => sid !== normalizedId)
    customPlaces = customPlaces.filter((p) => p.id !== normalizedId)
  } else {
    selectedIds.push(normalizedId)
    const snapshot = normalizeSnapshot({ ...place, id: normalizedId })
    if (snapshot) {
      customPlaces = [...customPlaces.filter((p) => p.id !== normalizedId), snapshot]
    }
  }

  cookieStore.set("travel_selection", JSON.stringify(selectedIds))
  cookieStore.set("travel_selection_places", JSON.stringify(customPlaces))

  return NextResponse.json({ success: true, selectedIds })
}

export async function PUT(req: Request) {
  const body = await req.json()
  const cookieStore = await cookies()
  const normalizedPlaces = normalizeChatbotPlaces(Array.isArray(body?.selectedPlaces) ? body.selectedPlaces : [])
  const selectedIds = normalizedPlaces.map((place) => place.id)
  const customPlaces: SelectedPlaceSnapshot[] = normalizedPlaces.map((place) => ({
    id: place.id,
    name: place.name,
    image: place.image,
    city: place.city,
    state: place.state,
    country: place.country,
    region: place.region,
    entryFee: place.entryFee,
    latitude: place.latitude,
    longitude: place.longitude,
    destinationKey: place.destinationKey,
    originalName: place.originalName,
    sourceType: place.sourceType,
    sourceItemId: place.sourceItemId,
  }))

  cookieStore.set("travel_selection", JSON.stringify(selectedIds))
  cookieStore.set("travel_selection_places", JSON.stringify(customPlaces))

  return NextResponse.json({
    success: true,
    selectedIds,
    selectedPlaces: buildSelectedPlaces(selectedIds, customPlaces),
  })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.set("travel_selection", "[]")
  cookieStore.set("travel_selection_places", "[]")
  return NextResponse.json({ success: true, selectedIds: [] })
}
