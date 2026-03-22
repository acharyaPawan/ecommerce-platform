import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatCurrency, formatNumber, formatRelativeTimeFromNow } from "@/lib/format"
import type { CustomerChurnRiskSnapshot } from "@/lib/types/analytics"

export function ChurnRiskPanel({
  data,
}: {
  data: CustomerChurnRiskSnapshot
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Customer Churn Watch
        </h2>
        <p className="text-muted-foreground max-w-3xl text-sm">
          This baseline churn view scores signed-in customers from confirmed
          order recency, storefront engagement recency, and order-history depth.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Tracked customers"
          value={formatNumber(data.customerCount)}
          description="Signed-in customers with at least one confirmed order"
        />
        <MetricCard
          label="High-risk customers"
          value={formatNumber(data.highRiskCount)}
          description="Customers most likely to need retention action first"
        />
        <MetricCard
          label="P1 retention targets"
          value={formatNumber(data.highValueHighRiskCount)}
          description="High-value customers currently sitting in the high-risk band"
        />
        <MetricCard
          label="High drift customers"
          value={formatNumber(data.highDriftCount)}
          description="Customers whose recent category mix moved sharply from long-term behavior"
        />
        <MetricCard
          label="Average churn score"
          value={formatNumber(data.averageScore)}
          description={
            data.customers[0]
              ? `${data.customers[0].name ?? data.customers[0].userId} is currently the top-priority customer`
              : "No churn-risk profiles available yet"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.customers.map((customer) => (
          <Card key={customer.userId} className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{customer.name ?? customer.userId}</CardTitle>
                  <CardDescription>
                    {customer.email ?? customer.userId}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={badgeVariantForPriority(customer.retentionPriority)}>
                    {customer.retentionPriority.toUpperCase()}
                  </Badge>
                  <Badge variant={badgeVariantForBand(customer.churnBand)}>
                    {customer.churnBand} risk
                  </Badge>
                  <Badge variant="outline">
                    score {formatNumber(customer.churnScore)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ChurnStat
                  label="Confirmed orders"
                  value={formatNumber(customer.confirmedOrders)}
                />
                <ChurnStat
                  label="Avg order value"
                  value={formatCurrency(customer.averageOrderValueCents / 100)}
                />
                <ChurnStat
                  label="Lifetime value"
                  value={formatCurrency(customer.lifetimeValueCents / 100)}
                />
                <ChurnStat
                  label="Last order"
                  value={formatRelativeTimeFromNow(customer.lastConfirmedOrderAt)}
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariantForValue(customer.valueBand)}>
                    {customer.valueBand} value
                  </Badge>
                  {customer.topCategoryName ? (
                    <Badge variant="outline">
                      {customer.topCategoryName} focus {Math.round(customer.topCategoryShare * 100)}%
                    </Badge>
                  ) : null}
                  <Badge variant={badgeVariantForDrift(customer.categoryDriftBand)}>
                    {customer.categoryDriftBand} drift
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ChurnStat
                    label="Days since order"
                    value={formatNumber(customer.daysSinceOrder)}
                  />
                  <ChurnStat
                    label="Days since activity"
                    value={
                      customer.daysSinceInteraction === null
                        ? "N/A"
                        : formatNumber(customer.daysSinceInteraction)
                    }
                  />
                </div>
                {customer.recentTopCategoryName ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Recent category focus is{" "}
                    <span className="font-medium text-foreground">
                      {customer.recentTopCategoryName}
                    </span>{" "}
                    at {Math.round(customer.recentTopCategoryShare * 100)}% of recent orders.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-sm font-medium">Recommended action</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {customer.recommendation}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-muted-foreground text-xs uppercase">
                  Risk drivers
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {customer.drivers.map((driver) => (
                    <li key={driver} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                      {driver}
                    </li>
                  ))}
                </ul>
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

function ChurnStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3">
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  )
}

function badgeVariantForBand(band: "high" | "medium" | "low") {
  switch (band) {
    case "high":
      return "destructive" as const
    case "medium":
      return "secondary" as const
    case "low":
      return "outline" as const
  }
}

function badgeVariantForValue(band: "high" | "medium" | "low") {
  switch (band) {
    case "high":
      return "default" as const
    case "medium":
      return "secondary" as const
    case "low":
      return "outline" as const
  }
}

function badgeVariantForDrift(band: "high" | "medium" | "low") {
  switch (band) {
    case "high":
      return "destructive" as const
    case "medium":
      return "secondary" as const
    case "low":
      return "outline" as const
  }
}

function badgeVariantForPriority(priority: "p1" | "p2" | "p3") {
  switch (priority) {
    case "p1":
      return "destructive" as const
    case "p2":
      return "secondary" as const
    case "p3":
      return "outline" as const
  }
}
