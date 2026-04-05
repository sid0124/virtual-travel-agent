export const DEFAULT_CURRENCY = "INR"
export const DEFAULT_LOCALE = "en-IN"
export const USD_TO_INR = 83

const EXCHANGE_RATES_TO_USD_BASE: Record<string, number> = {
  USD: 1,
  INR: USD_TO_INR,
  EUR: 0.93,
  GBP: 0.79,
  JPY: 151,
}

export function normalizeCurrencyCode(currency?: string | null) {
  const code = String(currency || DEFAULT_CURRENCY).trim().toUpperCase()
  return EXCHANGE_RATES_TO_USD_BASE[code] ? code : DEFAULT_CURRENCY
}

export function roundCurrencyAmount(value: number, nearest = 50) {
  if (!Number.isFinite(value)) return 0
  if (nearest <= 1) return Math.round(value)
  return Math.round(value / nearest) * nearest
}

export function convertCurrencyValue(amount: number, fromCurrency = "USD", toCurrency = DEFAULT_CURRENCY, roundTo = 0) {
  if (!Number.isFinite(amount)) return 0
  const source = normalizeCurrencyCode(fromCurrency)
  const target = normalizeCurrencyCode(toCurrency)
  const fromRate = EXCHANGE_RATES_TO_USD_BASE[source] || 1
  const toRate = EXCHANGE_RATES_TO_USD_BASE[target] || 1
  const usdAmount = source === "USD" ? amount : amount / fromRate
  const converted = usdAmount * toRate
  return roundTo > 0 ? roundCurrencyAmount(converted, roundTo) : converted
}

export function convertUsdToInr(amount: number, roundTo = 50) {
  return convertCurrencyValue(amount, "USD", "INR", roundTo)
}

export function formatCurrency(value: number, currency = DEFAULT_CURRENCY, options?: Intl.NumberFormatOptions) {
  const code = normalizeCurrencyCode(currency)
  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      ...options,
    }).format(Number.isFinite(value) ? value : 0)
  } catch {
    return `${code} ${Math.round(Number(value || 0)).toLocaleString(DEFAULT_LOCALE)}`
  }
}

export function formatPriceRange(min: number, max: number, currency = DEFAULT_CURRENCY) {
  return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`
}

export function normalizeMonetaryValue<T extends { price?: number; currency?: string }>(
  input: T,
  priceKey: keyof T = "price" as keyof T
) {
  const value = Number(input[priceKey] || 0)
  const nextCurrency = normalizeCurrencyCode(String(input.currency || "USD"))
  return {
    ...input,
    [priceKey]: convertCurrencyValue(value, nextCurrency, DEFAULT_CURRENCY, 50),
    currency: DEFAULT_CURRENCY,
  }
}
