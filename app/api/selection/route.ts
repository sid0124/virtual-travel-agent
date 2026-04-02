import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { destinations } from "@/lib/data"

type SelectedPlaceSnapshot = {
  id: string
  name: string
  image?: string
  city?: string
  country?: string
  entryFee?: number
  latitude?: number
  longitude?: number
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

export async function GET() {
  const cookieStore = await cookies()
  const selectionCookie = cookieStore.get("travel_selection")
  const customPlacesCookie = cookieStore.get("travel_selection_places")
  const selectedIds = parseJsonArray<any>(selectionCookie?.value).map((v) => String(v))
  const selectedIdSet = new Set(selectedIds)
  const customPlacesRaw = parseJsonArray<any>(customPlacesCookie?.value)
  const customPlaces: SelectedPlaceSnapshot[] = customPlacesRaw
    .map((p) => ({
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
      image: p?.image ? String(p.image) : undefined,
      city: p?.city ? String(p.city) : undefined,
      country: p?.country ? String(p.country) : undefined,
      entryFee: Number.isFinite(Number(p?.entryFee)) ? Number(p.entryFee) : undefined,
      latitude: Number.isFinite(Number(p?.latitude)) ? Number(p.latitude) : undefined,
      longitude: Number.isFinite(Number(p?.longitude)) ? Number(p.longitude) : undefined,
    }))
    .filter((p) => p.id && p.name && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
    .filter((p) => selectedIdSet.has(p.id))

  // enrich with name and image
  const datasetPlaces: SelectedPlaceSnapshot[] = destinations
    .filter((d) => selectedIdSet.has(String(d.id)))
    .map((d) => ({
      id: d.id,
      name: d.name,
      image: d.image,
      city: d.city,
      country: d.country,
      entryFee: d.entryFee,
      latitude: d.latitude,
      longitude: d.longitude,
    }))
  const datasetIds = new Set(datasetPlaces.map((p) => p.id))
  const selectedPlaces = [...datasetPlaces, ...customPlaces.filter((p) => !datasetIds.has(p.id))]

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
  let customPlaces: SelectedPlaceSnapshot[] = parseJsonArray<any>(customPlacesCookie?.value)
    .map((p) => ({
      id: String(p?.id ?? ""),
      name: String(p?.name ?? ""),
      image: p?.image ? String(p.image) : undefined,
      city: p?.city ? String(p.city) : undefined,
      country: p?.country ? String(p.country) : undefined,
      entryFee: Number.isFinite(Number(p?.entryFee)) ? Number(p.entryFee) : undefined,
      latitude: Number.isFinite(Number(p?.latitude)) ? Number(p.latitude) : undefined,
      longitude: Number.isFinite(Number(p?.longitude)) ? Number(p.longitude) : undefined,
    }))
    .filter((p) => p.id)
  const normalizedId = String(id)

  if (selectedIds.includes(normalizedId)) {
    selectedIds = selectedIds.filter((sid) => sid !== normalizedId)
    customPlaces = customPlaces.filter((p) => p.id !== normalizedId)
  } else {
    selectedIds.push(normalizedId)
    const lat = Number(place?.latitude)
    const lon = Number(place?.longitude)
    if (place && String(place?.name || "").trim() && Number.isFinite(lat) && Number.isFinite(lon)) {
      const snapshot: SelectedPlaceSnapshot = {
        id: normalizedId,
        name: String(place.name),
        image: place?.image ? String(place.image) : undefined,
        city: place?.city ? String(place.city) : undefined,
        country: place?.country ? String(place.country) : undefined,
        entryFee: Number.isFinite(Number(place?.entryFee)) ? Number(place.entryFee) : undefined,
        latitude: lat,
        longitude: lon,
      }
      customPlaces = [...customPlaces.filter((p) => p.id !== normalizedId), snapshot]
    }
  }

  cookieStore.set("travel_selection", JSON.stringify(selectedIds))
  cookieStore.set("travel_selection_places", JSON.stringify(customPlaces))

  return NextResponse.json({ success: true, selectedIds })
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.set("travel_selection", "[]")
  cookieStore.set("travel_selection_places", "[]")
  return NextResponse.json({ success: true, selectedIds: [] })
}
