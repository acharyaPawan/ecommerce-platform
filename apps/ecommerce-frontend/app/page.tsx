import Link from "next/link"

import { ProductCard } from "@/components/product-card"
import { loadStorefrontData } from "@/lib/server/storefront-data"

export const dynamic = "force-dynamic"

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function buildHref(query?: string, category?: string) {
  const params = new URLSearchParams()
  if (query) params.set("q", query)
  if (category) params.set("category", category)
  const value = params.toString()
  return value ? `/?${value}` : "/"
}

export default async function Page({ searchParams }: PageProps) {
  const query =
    typeof searchParams?.q === "string" ? searchParams.q.trim() : undefined
  const category =
    typeof searchParams?.category === "string"
      ? searchParams.category.trim()
      : undefined

  const data = await loadStorefrontData({ query, category })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-10">
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.4em] text-muted">
            Welcome to Aurora Market
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Discover crafted essentials curated for calm, modern living.
          </h1>
          <p className="text-base text-muted md:text-lg">
            Every item is sourced from our catalog services and stocked with care.
            Browse by category, drop favorites into your cart, and check out in a
            single flow.
          </p>
          <form
            className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            action="/"
          >
            <input
              type="text"
              name="q"
              placeholder="Search the catalog"
              defaultValue={query ?? ""}
              className="w-full rounded-full border border-[color:var(--line)] bg-white/90 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-glow)]"
            />
            {category ? (
              <input type="hidden" name="category" value={category} />
            ) : null}
            <button
              type="submit"
              className="accent-gradient rounded-full px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent-glow)]/30"
            >
              Search
            </button>
          </form>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <div>
              <p className="text-lg font-semibold text-[color:var(--ink)]">
                {data.products.length}
              </p>
              <p>active picks</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-[color:var(--ink)]">
                {data.categories.length}
              </p>
              <p>categories</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-[color:var(--ink)]">48h</p>
              <p>order turnaround</p>
            </div>
          </div>
        </div>
        <div className="surface-strong relative overflow-hidden p-6">
          <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,var(--accent-glow)_0%,transparent_70%)] opacity-80 animate-glow-float" />
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Fresh arrivals
            </p>
            <h2 className="text-2xl font-semibold">
              Curated for the season
            </h2>
            <p className="text-sm text-muted">
              New inventory is added weekly through the catalog service. Keep an
              eye on limited runs and artisan collaborations.
            </p>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3">
                <span>Signature home goods</span>
                <span className="text-xs text-muted">Ships in 2 days</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3">
                <span>Seasonal accessories</span>
                <span className="text-xs text-muted">Limited edition</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-[color:var(--line)] bg-white/80 px-4 py-3">
                <span>Wellness essentials</span>
                <span className="text-xs text-muted">New arrivals</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted">
              Shop by category
            </p>
            <h2 className="text-2xl font-semibold">Find your next favorite</h2>
          </div>
          {query ? (
            <Link
              href={buildHref(undefined, category)}
              className="text-sm font-semibold text-[color:var(--teal)]"
            >
              Clear search
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={buildHref(query, undefined)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              !category
                ? "border-transparent bg-[color:var(--accent)] text-white"
                : "border-[color:var(--line)] bg-white/80 text-[color:var(--ink)]"
            }`}
          >
            All categories
          </Link>
          {data.categories.slice(0, 8).map((item) => (
            <Link
              key={item.id}
              href={buildHref(query, item.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                category === item.id
                  ? "border-transparent bg-[color:var(--accent)] text-white"
                  : "border-[color:var(--line)] bg-white/80 text-[color:var(--ink)]"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data.products.length > 0 ? (
          data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <div className="surface col-span-full p-8 text-center">
            <p className="text-lg font-semibold">No products found.</p>
            <p className="text-sm text-muted">
              Try a different search or check back soon.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
