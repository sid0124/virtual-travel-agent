import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/currency"

export function BudgetCard({ b }: { b: any }) {
  const currency = b?.currency || "INR"

  return (
    <Card className="w-full max-w-md p-4">
      <h3 className="text-lg font-semibold">
        Budget for {b.destination} ({b.days} days)
      </h3>

      <div className="mt-3 space-y-1 text-sm">
        <p>Flight: {formatCurrency(b.flight, currency)}</p>
        <p>Hotel: {formatCurrency(b.hotel, currency)}</p>
        <p>Food: {formatCurrency(b.food, currency)}</p>
        <p>Transport: {formatCurrency(b.transport, currency)}</p>
        <p>Activities: {formatCurrency(b.activities, currency)}</p>
      </div>

      <div className="mt-3 border-t pt-2 font-semibold">
        Total: {formatCurrency(b.totalCost, currency)}
      </div>
    </Card>
  )
}
