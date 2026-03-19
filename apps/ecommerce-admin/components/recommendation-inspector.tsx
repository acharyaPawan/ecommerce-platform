import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatNumber } from "@/lib/format"
import type { RecommendationInspectorData } from "@/lib/server/recommendation-insights"

export function RecommendationInspector({
  data,
}: {
  data: RecommendationInspectorData
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Recommendation Inspector
        </h2>
        <p className="text-muted-foreground max-w-3xl text-sm">
          This panel samples recent anchor products, reruns the current
          recommendation pipeline, and exposes fallback, low-support, and
          diversification behavior directly from analytics-svc.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Recommendation fallback rate"
          value={`${data.snapshot.metrics.fallbackRate}%`}
          description={`${formatNumber(data.snapshot.metrics.fallbackCount)} of ${formatNumber(
            data.snapshot.metrics.recommendationCount
          )} sampled items used popular fallback`}
        />
        <MetricCard
          label="Low-support rate"
          value={`${data.snapshot.metrics.lowSupportRate}%`}
          description={`${formatNumber(data.snapshot.metrics.lowSupportCount)} items did not clear the actor-support threshold`}
        />
        <MetricCard
          label="Diversified selections"
          value={`${data.snapshot.metrics.diversifiedRate}%`}
          description={`${formatNumber(data.snapshot.metrics.diversifiedCount)} items landed during the diversified first pass`}
        />
        <MetricCard
          label="Behavior coverage"
          value={formatNumber(data.snapshot.metrics.totalInteractions)}
          description={`${formatNumber(data.snapshot.metrics.uniqueActors)} actors across ${formatNumber(data.snapshot.metrics.uniqueProducts)} products in the last ${data.snapshot.lookbackDays} days`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Event Mix</CardTitle>
            <CardDescription>
              Raw interaction distribution feeding the current recommender.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(data.snapshot.metrics.eventTypeBreakdown).map(
              ([eventType, count]) => (
                <div key={eventType} className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{eventType}</span>
                  <span className="font-semibold">{formatNumber(count)}</span>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Selection Stages</CardTitle>
            <CardDescription>
              How sampled recommendations were admitted into the final lists.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 text-sm">
            {Object.entries(data.snapshot.metrics.stageBreakdown).map(([stage, count]) => (
              <div
                key={stage}
                className="rounded-2xl border border-border/70 bg-muted/20 p-3"
              >
                <p className="text-muted-foreground text-xs uppercase">{stage}</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(count)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.anchors.map((anchor) => (
          <Card key={anchor.productId} className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{anchor.productTitle}</CardTitle>
                  <CardDescription>
                    Anchor product {anchor.productId}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {formatNumber(anchor.interactionCount)} interactions
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {anchor.recommendations.length > 0 ? (
                anchor.recommendations.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.productTitle}</p>
                      <Badge variant="secondary">{item.diagnostics.source}</Badge>
                      <Badge variant="outline">{item.diagnostics.selectionStage}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-2 text-sm">
                      {item.explanationSummary}
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <span>Signal: {item.strongestEventType}</span>
                      <span>Supporting events: {formatNumber(item.supportingSignals)}</span>
                      <span>Behavior score: {item.score}</span>
                      <span>Supporting actors: {formatNumber(item.diagnostics.contributingActors)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  No recommendations available for this anchor in the sampled window.
                </p>
              )}
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
