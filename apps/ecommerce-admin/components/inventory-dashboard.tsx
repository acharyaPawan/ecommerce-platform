"use client"

import Image from "next/image"
import * as React from "react"
import { useFormState } from "react-dom"

import {
  createCatalogProductAction,
  seedRandomProductsAction,
  updateCatalogProductAction,
} from "@/app/actions/catalog-actions"
import {
  type CreateProductActionState,
  type SeedProductsActionState,
  type UpdateProductActionState,
  createProductInitialState,
  seedInitialState,
  updateProductInitialState,
} from "@/lib/actions/catalog-action-state"
import {
  adjustInventoryAction,
  commitReservationAction,
  createReservationAction,
  releaseReservationAction,
  type AdjustmentActionState,
  type ReservationActionState,
} from "@/app/actions/inventory-actions"
import { formatCurrency, formatNumber, formatRelativeTimeFromNow } from "@/lib/format"
import type {
  InventoryDashboardData,
  InventoryListItem,
} from "@/lib/server/dashboard-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowCircleDownIcon,
  ArrowCircleUpIcon,
  ArrowsClockwiseIcon,
  ClipboardTextIcon,
} from "@phosphor-icons/react"

type InventoryDashboardProps = {
  data: InventoryDashboardData
}

const adjustmentInitialState: AdjustmentActionState = { status: "idle" }
const reservationInitialState: ReservationActionState = { status: "idle" }

export function InventoryDashboard({ data }: InventoryDashboardProps) {
  const [selectedSku, setSelectedSku] = React.useState(
    data.items[0]?.sku ?? ""
  )

  React.useEffect(() => {
    if (!data.items.find((item) => item.sku === selectedSku)) {
      setSelectedSku(data.items[0]?.sku ?? "")
    }
  }, [data.items, selectedSku])

  const selectedItem =
    data.items.find((item) => item.sku === selectedSku) ?? data.items[0]

  const lowStockItems = React.useMemo(
    () => data.items.filter((item) => item.lowStock).slice(0, 5),
    [data.items]
  )

  return (
    <div className="space-y-6">
      <MetricsGrid data={data} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <InventoryTable
            items={data.items}
            onSelect={setSelectedSku}
            selectedSku={selectedItem?.sku}
          />
          <SelectedSkuPanel item={selectedItem} />
        </div>
        <div className="space-y-6">
          <LowStockWatchlist
            items={lowStockItems}
            onSelect={setSelectedSku}
            selectedSku={selectedItem?.sku}
          />
          <AdjustmentForm selectedSku={selectedItem?.sku} />
          <ReservationForms selectedSku={selectedItem?.sku} />
          <CatalogSeederCard />
          <CatalogProductCreator />
        </div>
      </div>
    </div>
  )
}

function MetricsGrid({ data }: { data: InventoryDashboardData }) {
  const metricCards = [
    {
      label: "Tracked SKUs",
      value: formatNumber(data.metrics.totalSkus),
      description: "Variants synced from catalog",
      icon: <ClipboardTextIcon className="size-5 text-primary" />,
    },
    {
      label: "On Hand",
      value: formatNumber(data.metrics.totalOnHand),
      description: "Physical quantity",
      icon: <ArrowCircleDownIcon className="size-5 text-primary" />,
    },
    {
      label: "Reserved",
      value: formatNumber(data.metrics.totalReserved),
      description: "Allocated to orders",
      icon: <ArrowCircleUpIcon className="size-5 text-primary" />,
    },
    {
      label: "Available",
      value: formatNumber(data.metrics.totalAvailable),
      description: "Ready to sell",
      icon: <ArrowsClockwiseIcon className="size-5 text-primary" />,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metricCards.map((metric) => (
        <Card key={metric.label} className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            {metric.icon}
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">
              {metric.value}
            </div>
            <p className="text-muted-foreground text-xs">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="border-destructive/30 bg-destructive/10">
        <CardHeader className="space-y-1">
          <CardTitle className="text-sm font-semibold text-destructive">
            Low Stock
          </CardTitle>
          <CardDescription>
            {data.metrics.lowStockSkus} SKUs below threshold
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold text-destructive">
            {data.metrics.lowStockSkus}
          </div>
          <p className="text-muted-foreground text-xs">
            Sell-through risk: {data.metrics.sellThroughRisk}%
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function InventoryTable({
  items,
  selectedSku,
  onSelect,
}: {
  items: InventoryListItem[]
  selectedSku?: string
  onSelect: (sku: string) => void
}) {
  if (!items.length) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            No products found. Try adjusting your filters.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-border/80 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            {items.length} variants loaded from catalog
          </CardDescription>
        </div>
        <Badge variant="outline">
          Updated {formatRelativeTimeFromNow(items[0].summary.updatedAt)}
        </Badge>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full table-auto text-sm">
          <thead className="text-muted-foreground text-xs uppercase">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium">SKU</th>
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">On Hand</th>
              <th className="px-3 py-2 text-right font-medium">Available</th>
              <th className="px-3 py-2 text-right font-medium">Reserved</th>
              <th className="px-3 py-2 text-right font-medium">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.sku}
                className={cn(
                  "border-b hover:bg-muted/30 cursor-pointer transition-colors",
                  selectedSku === item.sku && "bg-primary/5"
                )}
                onClick={() => onSelect(item.sku)}
                aria-selected={selectedSku === item.sku}
              >
                <td className="px-3 py-3 font-semibold text-xs md:text-sm">
                  {item.sku}
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <p className="font-medium">{item.productTitle}</p>
                    <p className="text-muted-foreground text-xs uppercase">
                      {Object.entries(item.attributes)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" · ")}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={item.status === "active" ? "secondary" : "outline"}
                  >
                    {item.status}
                  </Badge>
                </td>
                <td className="px-3 py-3 text-right font-semibold">
                  {formatNumber(item.summary.onHand)}
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right font-semibold",
                    item.lowStock && "text-destructive"
                  )}
                >
                  {formatNumber(item.summary.available)}
                </td>
                <td className="px-3 py-3 text-right text-muted-foreground">
                  {formatNumber(item.summary.reserved)}
                </td>
                <td className="px-3 py-3 text-right">
                  {item.lowStock ? (
                    <Badge variant="destructive" className="uppercase">
                      Low
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function SelectedSkuPanel({ item }: { item?: InventoryListItem }) {
  if (!item) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Variant Details</CardTitle>
          <CardDescription>Select an item to inspect metadata.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const attributesDisplay = Object.entries(item.attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ")
  const threshold = Math.max(Math.round(item.summary.onHand * 0.25), 25)

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        {item.mediaUrl ? (
          <Image
            src={item.mediaUrl}
            alt={item.productTitle}
            width={80}
            height={80}
            className="h-20 w-20 rounded-2xl object-cover"
            sizes="80px"
          />
        ) : (
          <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-2xl text-xs uppercase text-muted-foreground">
            {item.productTitle.slice(0, 2)}
          </div>
        )}
        <div className="flex-1 space-y-1">
          <CardTitle>{item.productTitle}</CardTitle>
          <CardDescription className="text-xs uppercase">
            SKU {item.sku}
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            {item.categories.map((category) => (
              <Badge variant="outline" key={category}>
                {category}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="secondary">{item.productStatus}</Badge>
          <Badge variant="outline" className="text-[10px] uppercase">
            Variant {item.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {item.productDescription ? (
          <p className="text-sm text-muted-foreground">
            {item.productDescription}
          </p>
        ) : null}
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryStat label="On Hand" value={item.summary.onHand} />
          <SummaryStat label="Reserved" value={item.summary.reserved} />
          <SummaryStat
            label="Available"
            value={item.summary.available}
            emphasis={item.lowStock}
          />
        </div>
        <Separator />
        <div className="grid gap-3 text-sm">
          <DetailRow
            label="Unit Price"
            value={
              item.price
                ? formatCurrency(item.price.amount, item.price.currency)
                : "N/A"
            }
          />
          <DetailRow label="Brand" value={item.brand ?? "Not set"} />
          <DetailRow
            label="Attributes"
            value={attributesDisplay || "No attributes"}
          />
          <DetailRow
            label="Last Updated"
            value={formatRelativeTimeFromNow(item.summary.updatedAt)}
          />
          <DetailRow
            label="Low-stock threshold"
            value={`${formatNumber(threshold)} units`}
          />
        </div>
        <Separator />
        <ProductUpdateForm key={item.productId} item={item} />
      </CardContent>
    </Card>
  )
}

function ProductUpdateForm({ item }: { item: InventoryListItem }) {
  const [title, setTitle] = React.useState(item.productTitle)
  const [brand, setBrand] = React.useState(item.brand ?? "")
  const [description, setDescription] = React.useState(
    item.productDescription ?? ""
  )
  const [status, setStatus] = React.useState(item.productStatus)
  const [state, formAction] = useFormState(
    updateCatalogProductAction,
    updateProductInitialState
  )

  React.useEffect(() => {
    setTitle(item.productTitle)
    setBrand(item.brand ?? "")
    setDescription(item.productDescription ?? "")
    setStatus(item.productStatus)
  }, [item.productId, item.productStatus, item.productTitle, item.brand, item.productDescription])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={item.productId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`product-title-${item.productId}`}>Title</Label>
        <Input
          id={`product-title-${item.productId}`}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`product-brand-${item.productId}`}>Brand</Label>
        <Input
          id={`product-brand-${item.productId}`}
          name="brand"
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          placeholder="Nova Apparel"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`product-status-${item.productId}`}>Status</Label>
        <select
          id={`product-status-${item.productId}`}
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value as typeof status)}
          className="bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-4xl border px-3 text-sm transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none"
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="archived">archived</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`product-description-${item.productId}`}>
          Description
        </Label>
        <Textarea
          id={`product-description-${item.productId}`}
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
        />
      </div>
      {state.message ? (
        <p
          className={cn(
            "text-sm",
            state.status === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="outline">
        Save product
      </Button>
    </form>
  )
}

function SummaryStat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: boolean
}) {
  return (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold",
          emphasis && "text-destructive"
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-6 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function LowStockWatchlist({
  items,
  selectedSku,
  onSelect,
}: {
  items: InventoryListItem[]
  selectedSku?: string
  onSelect: (sku: string) => void
}) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base">Low Stock Watchlist</CardTitle>
        <CardDescription>
          Monitor variants trending toward stockouts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All tracked SKUs are above their threshold.
          </p>
        ) : (
          items.map((item) => {
            const threshold = Math.max(
              Math.round(item.summary.onHand * 0.25),
              25
            )
            return (
              <button
                key={item.sku}
                type="button"
                onClick={() => onSelect(item.sku)}
                className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition hover:border-destructive/60",
                selectedSku === item.sku
                  ? "border-destructive bg-destructive/10"
                  : "border-transparent bg-muted/30"
              )}
              >
                <div>
                  <p className="font-medium">{item.sku}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.productTitle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-destructive font-semibold">
                    {formatNumber(item.summary.available)} avail.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Min {formatNumber(threshold)}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function AdjustmentForm({ selectedSku }: { selectedSku?: string }) {
  const [sku, setSku] = React.useState(selectedSku ?? "")
  const [state, formAction] = React.useActionState(
    adjustInventoryAction,
    adjustmentInitialState
  )

  React.useEffect(() => {
    setSku(selectedSku ?? "")
  }, [selectedSku])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adjust Stock</CardTitle>
        <CardDescription>
          Apply manual corrections or cycle count adjustments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="grid gap-2">
            <Label htmlFor="adjust-sku">SKU</Label>
            <Input
              id="adjust-sku"
              name="sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="TEE-BLK-M"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-delta">Delta</Label>
            <Input
              id="adjust-delta"
              name="delta"
              type="number"
              step="1"
              placeholder="+/- qty"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Input
              id="adjust-reason"
              name="reason"
              placeholder="Cycle count correction"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adjust-reference">Reference ID (optional)</Label>
            <Input
              id="adjust-reference"
              name="referenceId"
              placeholder="putaway-123"
            />
          </div>
          {state.message ? (
            <p
              className={cn(
                "text-sm",
                state.status === "error" ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {state.message}
            </p>
          ) : null}
          <CardFooter className="p-0">
            <Button type="submit" className="w-full">
              Apply Adjustment
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  )
}

function ReservationForms({ selectedSku }: { selectedSku?: string }) {
  const [sku, setSku] = React.useState(selectedSku ?? "")
  const [reserveState, reserveAction] = React.useActionState(
    createReservationAction,
    reservationInitialState
  )
  const [commitState, commitAction] = React.useActionState(
    commitReservationAction,
    reservationInitialState
  )
  const [releaseState, releaseAction] = React.useActionState(
    releaseReservationAction,
    reservationInitialState
  )

  React.useEffect(() => {
    setSku(selectedSku ?? "")
  }, [selectedSku])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reservations</CardTitle>
        <CardDescription>
          Coordinate with order management to reserve, commit, or release stock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h4 className="font-medium text-sm">Create Reservation</h4>
          <form action={reserveAction} className="grid gap-3">
            <Input
              name="sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="SKU"
              required
            />
            <Input
              name="orderId"
              placeholder="Order ID"
              required
            />
            <Input
              name="quantity"
              type="number"
              min="1"
              placeholder="Quantity"
              required
            />
            <Input
              name="ttlSeconds"
              type="number"
              min="0"
              placeholder="TTL (seconds, optional)"
            />
            {reserveState.message ? (
              <p
                className={cn(
                  "text-sm",
                  reserveState.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {reserveState.message}
              </p>
            ) : null}
            <Button type="submit">Reserve Stock</Button>
          </form>
        </section>
        <Separator />
        <section className="space-y-3">
          <h4 className="font-medium text-sm">Commit Reservation</h4>
          <form action={commitAction} className="space-y-3">
            <Input name="orderId" placeholder="Order ID" required />
            {commitState.message ? (
              <p
                className={cn(
                  "text-sm",
                  commitState.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {commitState.message}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" className="w-full">
              Commit
            </Button>
          </form>
        </section>
        <Separator />
        <section className="space-y-3">
          <h4 className="font-medium text-sm">Release Reservation</h4>
          <form action={releaseAction} className="space-y-3">
            <Input name="orderId" placeholder="Order ID" required />
            <Textarea
              name="reason"
              placeholder="Reason (optional, e.g. customer canceled)"
            />
            {releaseState.message ? (
              <p
                className={cn(
                  "text-sm",
                  releaseState.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {releaseState.message}
              </p>
            ) : null}
            <Button type="submit" variant="outline" className="w-full">
              Release
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  )
}

function CatalogSeederCard() {
  const [state, formAction] = React.useActionState(
    seedRandomProductsAction,
    seedInitialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catalog Seeder</CardTitle>
        <CardDescription>
          Quickly inject randomized products through the gateway for load or
          demo scenarios.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="seed-count">Number of products</Label>
            <Input
              id="seed-count"
              name="count"
              type="number"
              min="1"
              max="200"
              defaultValue={100}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="seed-brand">Brand prefix</Label>
            <Input
              id="seed-brand"
              name="brandPrefix"
              placeholder="Nova Labs"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="seed-category">Category prefix</Label>
            <Input
              id="seed-category"
              name="categoryPrefix"
              placeholder="apparel"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="seed-status">Lifecycle status</Label>
            <select
              id="seed-status"
              name="status"
              className="bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-4xl border px-3 text-sm transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none"
              defaultValue="draft"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {state.message ? (
            <p
              className={cn(
                "text-sm",
                state.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {state.message}
              {state.processed ? ` (processed ${state.processed})` : null}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            Generate products
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CatalogProductCreator() {
  const [state, formAction] = React.useActionState(
    createCatalogProductAction,
    createProductInitialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create Catalog Product</CardTitle>
        <CardDescription>
          Publish a single product with one variant directly from the admin UI.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="create-title">Title</Label>
            <Input id="create-title" name="title" placeholder="Product name" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-brand">Brand</Label>
            <Input id="create-brand" name="brand" placeholder="Brand" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-status">Status</Label>
            <select
              id="create-status"
              name="status"
              className="bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-4xl border px-3 text-sm transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none"
              defaultValue="draft"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-description">Description</Label>
            <Textarea
              id="create-description"
              name="description"
              rows={3}
              placeholder="Details customers care about"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-categories">Categories</Label>
            <Input
              id="create-categories"
              name="categories"
              placeholder="tops:Tops,outerwear:Outerwear"
            />
            <p className="text-xs text-muted-foreground">
              Use comma separated pairs of `id:Name`.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-sku">Variant SKU</Label>
            <Input
              id="create-sku"
              name="sku"
              placeholder="SKU-123"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-price">Price</Label>
            <div className="flex gap-2">
              <Input
                id="create-price"
                name="price"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="99.00"
                className="flex-1"
                required
              />
              <Input
                name="currency"
                defaultValue="USD"
                className="w-24 uppercase"
                aria-label="Currency"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-attributes">Attributes</Label>
            <Input
              id="create-attributes"
              name="attributes"
              placeholder="color:Black,size:M"
            />
            <p className="text-xs text-muted-foreground">
              Comma separated key:value pairs.
            </p>
          </div>
          {state.message ? (
            <p
              className={cn(
                "text-sm",
                state.status === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {state.message}
            </p>
          ) : null}
          <Button type="submit" className="w-full" variant="secondary">
            Create product
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
