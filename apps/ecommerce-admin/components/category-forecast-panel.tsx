import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { CategoryForecastSnapshot } from "@/lib/types/analytics"

export function CategoryForecastPanel({
  data,
}: {
  data: CategoryForecastSnapshot
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Category Demand Forecast
        </h2>
        <p className="text-muted-foreground max-w-3xl text-sm">
          This baseline forecast uses confirmed purchase interactions, rolls them
          up by catalog category, and projects the next {data.horizonDays} days
          from recent movement rather than storefront browsing noise.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Forecast horizon"
          value={`${data.horizonDays} days`}
          description={`Computed from the last ${data.lookbackDays} days of confirmed demand`}
        />
        <MetricCard
          label="Tracked categories"
          value={formatNumber(data.categories.length)}
          description="Top categories ranked by projected unit demand"
        />
        <MetricCard
          label="Highest projection"
          value={
            data.categories[0]
              ? formatNumber(data.categories[0].projectedUnits)
              : "0"
          }
          description={
            data.categories[0]
              ? `${data.categories[0].categoryName} leads the current horizon`
              : "No confirmed purchase data available yet"
          }
        />
        <MetricCard
          label="High-confidence categories"
          value={formatNumber(
            data.categories.filter((item) => item.confidence === "high").length
          )}
          description="Categories with stronger history depth and volume"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.categories.map((category) => (
          <Card key={category.categoryId} className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{category.categoryName}</CardTitle>
                  <CardDescription>
                    Category {category.categoryId}
                  </CardDescription>
                </div>
                <Badge variant={badgeVariantForConfidence(category.confidence)}>
                  {category.confidence} confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ForecastStat
                  label="Projected units"
                  value={formatNumber(category.projectedUnits)}
                />
                <ForecastStat
                  label="Observed units"
                  value={formatNumber(category.totalObservedUnits)}
                />
                <ForecastStat
                  label="Recent 7-day window"
                  value={formatNumber(category.recentWindowUnits)}
                />
                <ForecastStat
                  label="Trend"
                  value={`${category.trendPct > 0 ? "+" : ""}${category.trendPct}%`}
                  positive={category.trendPct >= 0}
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-muted-foreground text-xs uppercase">
                  Daily forecast path
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {category.forecast.map((point) => (
                    <div
                      key={point.date}
                      className="min-w-[4.5rem] rounded-xl border border-border/70 bg-background px-3 py-2 text-center"
                    >
                      <p className="text-muted-foreground text-[10px] uppercase">
                        {point.date.slice(5)}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatNumber(point.units)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <Card className="border-border/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  )
}

function ForecastStat({
  label,
  value,
  positive,
}: {
  label: string
  value: string
  positive?: boolean
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3">
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p
        className={`text-2xl font-semibold ${
          positive === undefined
            ? ""
            : positive
              ? "text-emerald-700"
              : "text-amber-700"
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function badgeVariantForConfidence(confidence: "high" | "medium" | "low") {
  switch (confidence) {
    case "high":
      return "default" as const
    case "medium":
      return "secondary" as const
    case "low":
      return "outline" as const
  }
}
