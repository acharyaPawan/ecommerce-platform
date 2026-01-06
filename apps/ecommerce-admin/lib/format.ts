const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
})

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDateTime(isoString: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoString))
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

export function formatRelativeTimeFromNow(isoString: string) {
  const target = new Date(isoString).getTime()
  if (Number.isNaN(target)) return "just now"
  const diff = target - Date.now()

  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.34524],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ]

  let value = diff / 1000
  for (const [unit, amount] of divisions) {
    if (Math.abs(value) < amount) {
      return relativeTimeFormat.format(Math.round(value), unit)
    }
    value /= amount
  }

  return "just now"
}
