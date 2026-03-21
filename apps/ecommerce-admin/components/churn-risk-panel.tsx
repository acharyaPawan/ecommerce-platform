import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatNumber, formatRelativeTimeFromNow } from "@/lib/format"
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
          label="Average churn score"
          value={formatNumber(data.averageScore)}
          description="Average risk across the sampled customer cohort"
        />
        <MetricCard
          label="Top score"
          value={formatNumber(data.customers[0]?.churnScore ?? 0)}
          description={
            data.customers[0]
              ? `${data.customers[0].name ?? data.customers[0].userId} is currently the highest-risk customer`
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
                <ChurnStat
                  label="Last order"
                  value={formatRelativeTimeFromNow(customer.lastConfirmedOrderAt)}
                />
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
