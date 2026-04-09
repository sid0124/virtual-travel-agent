import { destinations } from "@/lib/data"

export type PlaceImageInput = {
  key?: string
  id?: string
  name?: string
  city?: string
  state?: string
  country?: string
  category?: string
  tags?: string[]
  imageQuery?: string
  image?: string
  imageFallback?: string
  coordinates?: {
    latitude?: number | null
    longitude?: number | null
  }
}

export type PlaceImageSource = "google" | "unsplash" | "static" | "placeholder"

export type ResolvedPlaceImage = {
  imageUrl: string
  blurDataUrl: string
  source: PlaceImageSource
  width?: number
  height?: number
  relevanceScore: number
  resolvedQuery: string
  attribution?: {
    provider: string
    author?: string
    authorLink?: string
    sourceLink?: string
  }
  placeholder?: boolean
}

export function isRenderableImageUrl(url?: string | null) {
  const value = String(url || "").trim()
  return Boolean(value) && (/^https?:\/\//i.test(value) || /^data:image\//i.test(value) || value.startsWith("/"))
}

export function isUnavailablePlaceholderImage(url?: string | null) {
  const value = String(url || "")
  if (!value.trim()) return false
  if (!/^data:image\/svg\+xml/i.test(value)) return false
  try {
    return /(Image unavailable|Preview unavailable|Wanderly place card)/i.test(decodeURIComponent(value))
  } catch {
    return /(Image unavailable|Preview unavailable|Wanderly place card)/i.test(value)
  }
}

const IMAGE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "area",
  "at",
  "best",
  "destination",
  "for",
  "from",
  "guide",
  "hotel",
  "in",
  "landmark",
  "near",
  "nearby",
  "of",
  "options",
  "place",
  "spot",
  "stay",
  "the",
  "travel",
  "trip",
  "view",
])

const GENERIC_IMAGE_PATTERNS = [
  /source\.unsplash\.com/i,
  /desktop-wallpaper-travel-mobile-global/i,
  /^data:image\/svg\+xml/i,
  /placeholder/i,
]

const MANUAL_CURATED_PLACE_IMAGES: Record<string, string> = {
  "bethesda terrace": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Bethesda_Terrace%2C_Central_Park%2C_NYC.jpg/1280px-Bethesda_Terrace%2C_Central_Park%2C_NYC.jpg",
  "bow bridge": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Bow_Bridge_in_Central_Park.jpg/1280px-Bow_Bridge_in_Central_Park.jpg",
  "columbus circle": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Columbus_Circle_from_Time_Warner_Center.jpg/1280px-Columbus_Circle_from_Time_Warner_Center.jpg",
  "strawberry fields": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Imagine_Mosaic_in_Central_Park.jpg/1280px-Imagine_Mosaic_in_Central_Park.jpg",
  "belvedere castle": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Belvedere_Castle_in_Central_Park.jpg/1280px-Belvedere_Castle_in_Central_Park.jpg",
  "conservatory garden": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Conservatory_Garden_Central_Park.jpg/1280px-Conservatory_Garden_Central_Park.jpg",
  "broadway theatres": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Broadway_theatre_district_night.jpg/1280px-Broadway_theatre_district_night.jpg",
  "bryant park": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Bryant_Park_-_New_York_City.jpg/1280px-Bryant_Park_-_New_York_City.jpg",
  "rockefeller center": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/30_Rockefeller_Plaza_2017.jpg/1280px-30_Rockefeller_Plaza_2017.jpg",
  "top of the rock": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/View_from_Top_of_the_Rock.jpg/1280px-View_from_Top_of_the_Rock.jpg",
  "fifth avenue": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Fifth_Avenue_Midtown_Manhattan.jpg/1280px-Fifth_Avenue_Midtown_Manhattan.jpg",
  "empire state building": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Empire_State_Building_from_the_Top_of_the_Rock.jpg/1280px-Empire_State_Building_from_the_Top_of_the_Rock.jpg",
  "madame tussauds new york": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Madame_Tussauds_New_York.jpg/1280px-Madame_Tussauds_New_York.jpg",
  "hell's kitchen food spots": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/9th_Avenue_Hells_Kitchen.jpg/1280px-9th_Avenue_Hells_Kitchen.jpg",
  "upper west side": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Upper_West_Side_historic_district.jpg/1280px-Upper_West_Side_historic_district.jpg",
  "midtown west": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Midtown_Manhattan_from_Top_of_the_Rock.jpg/1280px-Midtown_Manhattan_from_Top_of_the_Rock.jpg",
  "columbus circle area": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Columbus_Circle_from_Time_Warner_Center.jpg/1280px-Columbus_Circle_from_Time_Warner_Center.jpg",
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titleCase(value?: string | null) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function isLikelyGeneratedImage(url?: string | null) {
  const value = String(url || "").trim()
  if (!value) return true
  return GENERIC_IMAGE_PATTERNS.some((pattern) => pattern.test(value))
}

function tokenizeTerms(value?: string | null) {
  return Array.from(
    new Set(
      normalizeText(value)
        .split(" ")
        .filter((token) => token.length >= 3 && !IMAGE_STOP_WORDS.has(token))
    )
  )
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)))
}

export function buildPlaceImageQuery(input: PlaceImageInput) {
  if (String(input.imageQuery || "").trim()) return String(input.imageQuery).trim()

  const base = uniqueStrings([
    input.name,
    input.city,
    input.state,
    input.country,
  ])

  const categorySuffix =
    input.category && !/hotel|stay|area/i.test(input.category)
      ? input.category
      : /hotel|stay|area/i.test(input.category || "")
        ? "landmark area"
        : "landmark"

  if (categorySuffix) base.push(categorySuffix)
  return base.join(" ")
}

export function buildPlaceImageKey(input: PlaceImageInput) {
  const normalized = normalizeText(
    input.key ||
    input.id ||
    [input.name, input.city, input.state, input.country, input.category, input.imageQuery].filter(Boolean).join("|")
  )
  return normalized || "unknown-place"
}

export function buildPlaceImageCacheKey(input: PlaceImageInput) {
  return `place-image:${buildPlaceImageKey(input)}`
}

function escapeSvgText(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function buildPlaceImageBlurPlaceholder(input: PlaceImageInput) {
  const title = escapeSvgText(input.name || "Wanderly")
  const subtitle = escapeSvgText([input.city || input.state, input.country].filter(Boolean).join(", ") || "Travel photo")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#dbeafe" />
          <stop offset="45%" stop-color="#e0f2fe" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <circle cx="1260" cy="180" r="190" fill="rgba(255,255,255,0.65)" />
      <circle cx="340" cy="720" r="240" fill="rgba(186,230,253,0.55)" />
      <rect x="100" y="606" width="620" height="116" rx="36" fill="rgba(15,23,42,0.18)" />
      <rect x="100" y="742" width="380" height="54" rx="27" fill="rgba(15,23,42,0.10)" />
      <text x="118" y="674" fill="#0f172a" font-size="60" font-family="Arial, sans-serif" font-weight="700">${title}</text>
      <text x="118" y="780" fill="#334155" font-size="30" font-family="Arial, sans-serif">${subtitle}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

export function buildImageUnavailablePlaceholder(input: PlaceImageInput) {
  const title = escapeSvgText(input.name || "Image unavailable")
  const subtitle = escapeSvgText([input.city || input.state, input.country].filter(Boolean).join(", ") || "Wanderly travel card")
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc" />
          <stop offset="100%" stop-color="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#bg)" />
      <rect x="140" y="180" width="1320" height="540" rx="40" fill="rgba(255,255,255,0.72)" stroke="rgba(148,163,184,0.30)" stroke-width="8" />
      <circle cx="800" cy="380" r="92" fill="rgba(148,163,184,0.15)" />
      <path d="M736 402 790 456 876 330" fill="none" stroke="#64748b" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" />
      <text x="800" y="558" text-anchor="middle" fill="#0f172a" font-size="56" font-family="Arial, sans-serif" font-weight="700">Preview unavailable</text>
      <text x="800" y="628" text-anchor="middle" fill="#475569" font-size="30" font-family="Arial, sans-serif">${title}</text>
      <text x="800" y="674" text-anchor="middle" fill="#64748b" font-size="24" font-family="Arial, sans-serif">${subtitle}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function buildTextCorpus(input: PlaceImageInput) {
  return [
    buildPlaceImageQuery(input),
    input.name,
    input.city,
    input.state,
    input.country,
    input.category,
    ...(input.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
}

export function scoreTextRelevance(text: string, input: PlaceImageInput) {
  const haystack = normalizeText(text)
  if (!haystack) return 0

  let score = 0
  const normalizedName = normalizeText(input.name)
  const normalizedCity = normalizeText(input.city)
  const normalizedState = normalizeText(input.state)
  const normalizedCountry = normalizeText(input.country)
  const normalizedCategory = normalizeText(input.category)
  const queryTokens = tokenizeTerms(buildTextCorpus(input))

  if (normalizedName && haystack.includes(normalizedName)) score += 120
  if (normalizedCity && haystack.includes(normalizedCity)) score += 36
  if (normalizedState && haystack.includes(normalizedState)) score += 18
  if (normalizedCountry && haystack.includes(normalizedCountry)) score += 12
  if (normalizedCategory && haystack.includes(normalizedCategory)) score += 8

  for (const token of queryTokens) {
    if (haystack.includes(token)) score += token.length >= 6 ? 14 : 8
  }

  if (/(skyline|cityscape|travel|vacation|tourism|scenic view)/i.test(haystack) && !normalizedName) score -= 30
  if (/(stock photo|wallpaper|template|mockup)/i.test(haystack)) score -= 60

  return score
}

export function isHighQualityCandidate(width?: number | null, height?: number | null) {
  const safeWidth = Number(width || 0)
  const safeHeight = Number(height || 0)
  if (!safeWidth || !safeHeight) return false
  if (safeWidth < 800) return false
  return safeWidth >= safeHeight
}

function normalizeImageUrl(url: string) {
  if (/images\.unsplash\.com/i.test(url)) {
    return `${url}${url.includes("?") ? "&" : "?"}w=1600&q=80&fit=crop&crop=entropy&fm=jpg`
  }

  return url
}

function buildStaticResolvedImage(input: PlaceImageInput, imageUrl: string, relevanceScore: number): ResolvedPlaceImage {
  return {
    imageUrl: normalizeImageUrl(imageUrl),
    blurDataUrl: buildPlaceImageBlurPlaceholder(input),
    source: "static",
    width: 1600,
    height: 900,
    relevanceScore,
    resolvedQuery: buildPlaceImageQuery(input),
    attribution: {
      provider: "static",
    },
  }
}

export function resolveStaticPlaceImage(input: PlaceImageInput): ResolvedPlaceImage | null {
  if (input.image && !isLikelyGeneratedImage(input.image)) {
    return buildStaticResolvedImage(input, input.image, 72)
  }

  const normalizedName = normalizeText(input.name)
  const manual = MANUAL_CURATED_PLACE_IMAGES[normalizedName]
  if (manual) {
    return buildStaticResolvedImage(input, manual, 96)
  }

  const datasetMatch = destinations.find((destination) => {
    if (normalizeText(destination.name) !== normalizedName) return false
    if (input.city && normalizeText(destination.city) && normalizeText(destination.city) !== normalizeText(input.city)) return false
    return true
  })

  if (datasetMatch?.image && !isLikelyGeneratedImage(datasetMatch.image)) {
    return buildStaticResolvedImage(input, datasetMatch.image, 88)
  }

  const fallbackMatch = destinations
    .filter((destination) => !isLikelyGeneratedImage(destination.image))
    .map((destination) => ({
      destination,
      score: scoreTextRelevance(
        [destination.name, destination.city, destination.state, destination.country, destination.type, ...(destination.tags || [])].join(" "),
        input
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .find((item) => item.score >= 125)

  if (fallbackMatch?.destination?.image) {
    return buildStaticResolvedImage(input, fallbackMatch.destination.image, Math.min(84, fallbackMatch.score))
  }

  return null
}
