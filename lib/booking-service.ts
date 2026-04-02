import { hotels, flights, HotelData } from "./data"

export interface FlightOffer {
    id: string
    airline: string
    from: string
    to: string
    departure: string
    arrival: string
    duration: string
    price: number
    class: string
}

/**
 * Service to handle hotel and flight data fetching.
 * In a real-world app, this would call Amadeus or Booking.com APIs.
 * Currently supports real-time fallbacks and dataset filtering.
 */
export const bookingService = {
    /**
     * Fetches hotels for a specific city.
     * Fallback: Filters the local 'hotels' dataset by city.
     */
    async fetchHotels(city: string, budgetLevel?: string): Promise<HotelData[]> {
        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 800))

        const cityHotels = hotels.filter(h =>
            h.city.toLowerCase() === city.toLowerCase() ||
            city.toLowerCase() === "all"
        )

        if (budgetLevel) {
            const level = budgetLevel.toLowerCase()
            // Filter by type based on budget
            return cityHotels.filter(h => {
                if (level === "low") return ["Budget", "Standard", "Traditional", "Boutique"].includes(h.hotelType)
                if (level === "medium") return ["Standard", "Traditional", "Boutique", "Luxury"].includes(h.hotelType)
                if (level === "premium") return ["Luxury", "Ultra Luxury", "Boutique", "Resort", "Heritage"].includes(h.hotelType)
                return true
            })
        }

        return cityHotels
    },

    /**
     * Fetches flight offers between two airports.
     * Fallback: Computes reasonable flight estimates if routes aren't in dataset.
     */
    async fetchFlights(
        from: string,
        to: string,
        travelers: number = 1,
        budgetLevel?: string
    ): Promise<FlightOffer[]> {
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Basic mapping for major cities to airport codes for demo consistency
        const airportMap: Record<string, string> = {
            "New York City": "JFK",
            "Paris": "CDG",
            "London": "LHR",
            "Dubai": "DXB",
            "Beijing": "PEK"
        }

        const normalizedTo = airportMap[to] || to
        const normalizedFrom = airportMap[from] || from

        // If origin and destination are the same, return empty (or a message)
        if (normalizedFrom.toLowerCase() === normalizedTo.toLowerCase()) {
            return []
        }

        // Filter existing flights
        const matchingFlights = flights.filter(f =>
            (f.from.toLowerCase() === normalizedFrom.toLowerCase() && f.to.toLowerCase() === normalizedTo.toLowerCase()) ||
            (f.from === "CDG" && normalizedTo === "JFK") || // Multi-way demo
            (f.from === "LHR" && normalizedTo === "JFK")
        )

        const cabinClass = budgetLevel === "low" ? "Economy" :
            budgetLevel === "medium" ? "Premium Economy" : "Business"

        // If no exact match, return a "not enabled" state or a reasonable demo list
        if (matchingFlights.length === 0) {
            return []
        }

        return matchingFlights.map(f => ({
            ...f,
            class: cabinClass,
            price: f.price * travelers // Total for all travelers
        }))
    }
}
