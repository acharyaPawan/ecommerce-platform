import Link from "next/link"

import { InventoryDashboard } from "@/components/inventory-dashboard"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { formatRelativeTimeFromNow } from "@/lib/format"
import { getInventoryDashboardData } from "@/lib/server/dashboard-data"
import type { CatalogProductStatus } from "@/lib/types/catalog"
import { authClient } from "@/lib/server/auth-client"
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export const dynamic = "force-dynamic"

const statusOptions: Array<{ value: CatalogProductStatus | "all"; label: string }> =
  [
    { value: "published", label: "Published" },
    { value: "draft", label: "Draft" },
    { value: "archived", label: "Archived" },
    { value: "all", label: "All statuses" },
  ]

type PageSearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams?: PageSearchParams | Promise<PageSearchParams | undefined>
}

type StatusFilter = CatalogProductStatus | "all"

const statusSet = new Set(statusOptions.map((option) => option.value))

function parseStatus(value?: string): StatusFilter | undefined {
  if (!value) return undefined
  return statusSet.has(value as StatusFilter) ? (value as StatusFilter) : undefined
}

export default async function Page({ searchParams }: PageProps) {
//here
const sessioon = await authClient.getSession({
  'fetchOptions': {
    headers: await headers()
  }
});

  console.log("Session info: ", sessioon);
  if (!sessioon.data?.session) {
    // Redirect to sign-in page
    const redirectUrl = new URL("/auth/sign-in", "http://localhost:3000");
    redirectUrl.searchParams.set("redirectTo", "/");
    redirect(redirectUrl.toString())
  }
  console.log("In page");
  const resolvedSearchParams = searchParams
    ? await searchParams
    : undefined

  const query =
    typeof resolvedSearchParams?.q === "string" && resolvedSearchParams.q.trim().length > 0
      ? resolvedSearchParams.q.trim()
      : undefined
  const statusParam =
    typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : undefined
  const normalizedStatus = parseStatus(statusParam)
  const displayStatus: StatusFilter = normalizedStatus ?? "published"
  const filtersApplied = Boolean(query) || (!!normalizedStatus && normalizedStatus !== "published")

  const dashboardData = await getInventoryDashboardData({
    q: query,
    status: normalizedStatus,
  })

  return (
    <main className="space-y-8 pb-12">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Inventory Control
          </h1>
          <p className="text-muted-foreground">
            Monitor catalog availability, reservations, and corrective actions in
            a single workspace.
          </p>
          <p className="text-xs text-muted-foreground">
            Last refreshed {formatRelativeTimeFromNow(dashboardData.lastRefreshed)}
          </p>
        </div>
        <FilterForm q={query} status={displayStatus} filtersApplied={filtersApplied} />
      </header>

      <InventoryDashboard data={dashboardData} />
    </main>
  )
}

function FilterForm({
  q,
  status,
  filtersApplied,
}: {
  q?: string
  status: StatusFilter
  filtersApplied: boolean
}) {
  return (
    <form className="w-full rounded-3xl border border-border/80 bg-card/50 p-4 shadow-sm md:max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="inventory-search">Search</Label>
          <Input
            id="inventory-search"
            name="q"
            placeholder="Search by SKU, title, or brand"
            defaultValue={q ?? ""}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="inventory-status">Status</Label>
          <select
            id="inventory-status"
            name="status"
            defaultValue={status}
            className="bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 h-9 rounded-4xl border px-3 text-sm transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] outline-none"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {filtersApplied && (
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Reset
          </Link>
        )}
        <Button type="submit">Apply</Button>
      </div>
    </form>
  )
}
