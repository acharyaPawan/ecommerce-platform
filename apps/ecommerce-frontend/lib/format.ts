const currencyCache = new Map<string, Intl.NumberFormat>()

export function formatCurrency(amountCents: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase()
  const formatter = currencyCache.get(normalizedCurrency) ??
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 0,
    })

  if (!currencyCache.has(normalizedCurrency)) {
    currencyCache.set(normalizedCurrency, formatter)
  }

  return formatter.format(amountCents / 100)
}
