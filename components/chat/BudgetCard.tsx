import { Card } from "@/components/ui/card"

export function BudgetCard({ b }: { b: any }) {
  return (
    <Card className="w-full max-w-md p-4">
      <h3 className="text-lg font-semibold">
        Budget for {b.destination} ({b.days} days)
      </h3>

      <div className="mt-3 space-y-1 text-sm">
        <p>✈️ Flight: ${b.flight}</p>
        <p>🏨 Hotel: ${b.hotel}</p>
        <p>🍽 Food: ${b.food}</p>
        <p>🚕 Transport: ${b.transport}</p>
        <p>🎟 Activities: ${b.activities}</p>
      </div>

      <div className="mt-3 border-t pt-2 font-semibold">
        💰 Total: ${b.totalCost}
      </div>
    </Card>
  )
}
