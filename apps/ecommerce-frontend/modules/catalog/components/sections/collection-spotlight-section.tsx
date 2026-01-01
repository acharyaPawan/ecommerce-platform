import { SectionHeading } from "@/components/shared/section-heading"

import { type CollectionDTO } from "@/modules/catalog/server/query/dto/product-dto"

import { CollectionCard } from "../ui/collection-card"

type CollectionSpotlightSectionProps = {
  collections: CollectionDTO[]
}

export function CollectionSpotlightSection({ collections }: CollectionSpotlightSectionProps) {
  return (
    <section id="collections" className="space-y-8">
      <SectionHeading
        eyebrow="Programs"
        title="Collections built with supply ops in mind"
        description="Mix SKUs, run pop-ups, ship globally. Everything is modeled as kit-of-parts so you can reconfigure endlessly."
      />
      <div className="grid gap-6">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  )
}
