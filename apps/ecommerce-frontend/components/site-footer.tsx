export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--line)] bg-[color:var(--canvas)]/80">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-semibold">Aurora Market</p>
          <p className="text-sm text-muted">
            A calm storefront for the ecommerce platform. Curate new arrivals, share
            the story behind every product, and ship from a single, focused hub.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Explore</p>
          <p className="text-muted">Catalog</p>
          <p className="text-muted">Categories</p>
          <p className="text-muted">Order tracking</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Need help?</p>
          <p className="text-muted">support@auroramarket.dev</p>
          <p className="text-muted">+1 (555) 245-2222</p>
          <p className="text-muted">Seattle, WA</p>
        </div>
      </div>
      <div className="border-t border-[color:var(--line)] py-4 text-center text-xs text-muted">
        Built for the ecommerce platform. All rights reserved.
      </div>
    </footer>
  )
}
