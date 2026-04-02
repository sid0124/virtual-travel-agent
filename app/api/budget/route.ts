import { NextResponse } from "next/server"
import { budgetEstimates } from "@/lib/data"

export async function POST(req: Request) {
  try {
    const { destination, days = 3 } = await req.json()

    if (!destination) {
      return NextResponse.json({ error: "Missing destination" }, { status: 400 })
    }

    // Match your dataset
    const lower = String(destination).toLowerCase()
    const match =
      budgetEstimates.find((b: any) => String(b.destination).toLowerCase() === lower) ||
      budgetEstimates.find((b: any) => String(b.destination).toLowerCase().includes(lower)) ||
      budgetEstimates.find((b: any) => lower.includes(String(b.destination).toLowerCase()))

    if (!match) {
      return NextResponse.json({ error: "Budget data not available" }, { status: 404 })
    }

    const d = Number(days) || 3

    const flight = Number(match.avgFlightCost || 0)
    const hotelPerNight = Number(match.hotelPricePerNight || 0)
    const foodPerDay = Number(match.foodCostPerDay || 0)
    const transportPerDay = Number(match.localTransportCost || 0)
    const activitiesPerDay = Number(match.activityCostAvg || 0)
    const entryFeesTotal = Number(match.entryFee || 0)

    const total =
      flight +
      d * hotelPerNight +
      d * foodPerDay +
      d * transportPerDay +
      d * activitiesPerDay +
      entryFeesTotal

    return NextResponse.json({
      destination: match.destination,
      days: d,
      currency: "USD",
      flight,
      hotelPerNight,
      foodPerDay,
      transportPerDay,
      activitiesPerDay,
      entryFeesTotal,
      total,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Budget API error" }, { status: 500 })
  }
}
