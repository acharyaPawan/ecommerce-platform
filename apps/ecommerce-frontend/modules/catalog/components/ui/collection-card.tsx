import Image from "next/image"
import Link from "next/link"

import { type CollectionDTO } from "@/modules/catalog/server/query/dto/product-dto"

type CollectionCardProps = {
  collection: CollectionDTO
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <article className="grid gap-6 border border-border/70 bg-card/70 p-6 lg:grid-cols-2 lg:items-center">
      <div className="space-y-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{collection.metricLabel}</p>
          <p className="text-2xl font-semibold text-foreground">{collection.metricValue}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-3xl font-semibold tracking-tight">{collection.title}</h3>
          <p className="text-base text-muted-foreground">{collection.description}</p>
          {collection.callout ? <p className="text-sm text-muted-foreground">{collection.callout}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {collection.swatches.map((swatch, index) => (
            <span
              key={`${collection.id}-${index}`}
              className="h-10 w-10 rounded-full border border-border/70"
              style={{ backgroundColor: swatch }}
              aria-label="Color swatch"
            />
          ))}
        </div>
        <Link href={`/collections/${collection.id}`} className="text-sm font-semibold text-primary hover:underline">
          View collection →
        </Link>
      </div>
      <figure className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border/60">
        <Image
          src={collection.heroImage}
          alt={collection.title}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 480px, 100vw"
        />
      </figure>
    </article>
  )
}
