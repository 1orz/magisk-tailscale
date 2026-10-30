const units = ["B", "KB", "MB", "GB", "TB"]

export function formatBytes(n: number): string {
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${i === 0 ? n : n.toFixed(1)} ${units[i]}`
}

const steps: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 30],
  ["month", 12],
  ["year", Infinity],
]

// formatRelative returns e.g. "5 minutes ago" in locale.
export function formatRelative(date: Date, locale: string, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  let value = (date.getTime() - now) / 1000
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) {
      return rtf.format(Math.round(value), unit)
    }
    value /= size
  }
  return rtf.format(Math.round(value), "year")
}
