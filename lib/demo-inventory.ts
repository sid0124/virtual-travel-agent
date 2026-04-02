type BudgetLevel = "low" | "medium" | "premium"

type DemoHotel = {
  id: string
  name: string
  city: string
  country?: string
  rating: number
  reviews: number
  price: number
  amenities: string[]
  hotelType: string
  image: string
  demo: true
  isDemo: true
  source: "DEMO"
}

type DemoFlight = {
  id: string
  airline: string
  from: string
  to: string
  departure: string
  arrival: string
  duration: string
  price: number
  class: string
  stops: number
  isDemo: true
  source: "DEMO"
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOTEL_PREFIXES = ["Grand", "Royal", "Urban", "Skyline", "Harbor", "Central", "Regent", "Vista", "Aurora", "Summit"]
const HOTEL_SUFFIXES = ["Suites", "Residency", "Hotel", "Inn", "Plaza", "Retreat", "Stays", "Collection", "Lodge", "Palace"]
const HOTEL_AMENITIES = ["WiFi", "Breakfast", "Gym", "Pool", "Spa", "Restaurant", "Airport Shuttle", "Parking", "Business Center"]
const HOTEL_TYPES = ["Budget", "Standard", "Boutique", "Luxury", "Resort"]
const DEMO_AIRLINES = ["DEMO AIR 1", "DEMO AIR 2", "DEMO AIR 3", "DEMO AIR 4", "DEMO AIR 5"]
const DEMO_HOTEL_IMAGES = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80",
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=1200&q=80",
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&q=80",
  "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80",
  "https://images.unsplash.com/photo-1598605272254-173a2bce9ef2?w=1200&q=80",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=1200&q=80",
]

function budgetPriceRange(level: BudgetLevel): [number, number] {
  if (level === "low") return [40, 120]
  if (level === "premium") return [300, 900]
  return [120, 300]
}

export function generateDemoHotels(city: string, country: string | undefined, count: number, budgetLevel: string): DemoHotel[] {
  const level = (budgetLevel || "medium") as BudgetLevel
  const [minPrice, maxPrice] = budgetPriceRange(level)
  const normalizedCity = city.trim().toLowerCase().replace(/\s+/g, " ")
  const rnd = mulberry32(hash(`${normalizedCity}|${level}`))
  const amenityByTier: Record<BudgetLevel, string[]> = {
    low: ["wifi", "breakfast", "parking"],
    medium: ["wifi", "breakfast", "gym", "restaurant", "parking"],
    premium: ["wifi", "breakfast", "gym", "pool", "spa", "restaurant", "airport shuttle"],
  }

  return Array.from({ length: count }).map((_, idx) => {
    const name = `${HOTEL_PREFIXES[Math.floor(rnd() * HOTEL_PREFIXES.length)]} ${city} ${HOTEL_SUFFIXES[Math.floor(rnd() * HOTEL_SUFFIXES.length)]}`
    const rating = Number((3.5 + rnd() * 1.4).toFixed(1))
    const reviews = Math.floor(50 + rnd() * 5000)
    const price = Math.round(minPrice + rnd() * (maxPrice - minPrice))
    const tierAmenities = amenityByTier[level]
    const optional = HOTEL_AMENITIES.map((a) => a.toLowerCase()).filter((a) => !tierAmenities.includes(a))
    const extras = optional.filter(() => rnd() > 0.7).slice(0, 3)
    const amenities = Array.from(new Set(["wifi", ...tierAmenities, ...extras]))
    const image = DEMO_HOTEL_IMAGES[hash(`${normalizedCity}|${idx}`) % DEMO_HOTEL_IMAGES.length]
    return {
      id: `demo-hotel-${city.toLowerCase().replace(/\s+/g, "-")}-${idx + 1}`,
      name,
      city,
      country,
      rating,
      reviews,
      price,
      amenities: amenities.length ? amenities : ["WiFi", "Breakfast"],
      hotelType: HOTEL_TYPES[Math.floor(rnd() * HOTEL_TYPES.length)],
      image,
      demo: true,
      isDemo: true,
      source: "DEMO",
    }
  })
}

export function generateDemoFlights(
  origin: string,
  destination: string,
  departureDate: string,
  travelers: number,
  budgetLevel: string,
  count = 8
): DemoFlight[] {
  const level = (budgetLevel || "medium") as BudgetLevel
  const rnd = mulberry32(hash(`${origin}|${destination}|${departureDate}|${level}|${travelers}`))
  const basePrice = level === "low" ? 120 : level === "premium" ? 420 : 240

  return Array.from({ length: count }).map((_, idx) => {
    const depHour = 5 + Math.floor(rnd() * 16)
    const depMin = Math.floor(rnd() * 60)
    const durationMin = 90 + Math.floor(rnd() * 360)
    const arrTotal = depHour * 60 + depMin + durationMin
    const arrHour = Math.floor((arrTotal % (24 * 60)) / 60)
    const arrMin = arrTotal % 60
    const stops = rnd() > 0.7 ? 1 : 0
    const totalPrice = Math.round((basePrice + rnd() * basePrice) * travelers)

    return {
      id: `demo-flight-${origin}-${destination}-${idx + 1}`,
      airline: DEMO_AIRLINES[Math.floor(rnd() * DEMO_AIRLINES.length)],
      from: origin,
      to: destination,
      departure: `${String(depHour).padStart(2, "0")}:${String(depMin).padStart(2, "0")}`,
      arrival: `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`,
      duration: `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`,
      price: totalPrice,
      class: level === "premium" ? "Business" : level === "low" ? "Economy" : "Premium Economy",
      stops,
      isDemo: true,
      source: "DEMO",
    }
  })
}
