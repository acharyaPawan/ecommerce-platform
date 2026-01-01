import Image from "next/image"
import Link from "next/link"

import { type EditorialDTO } from "@/modules/catalog/server/query/dto/product-dto"

type StoryCardProps = {
  story: EditorialDTO
}

export function StoryCard({ story }: StoryCardProps) {
  const slug = story.ctaHref.replace(/^\/stories\//, "") || story.id
  const storyHref = `/stories/${slug}` as `/stories/${string}`

  return (
    <article className="space-y-4 border border-border/60 bg-card/80 p-6">
      <div className="relative aspect-[3/2] overflow-hidden rounded-xl border border-border/60">
        <Image src={story.image} alt={story.title} fill className="object-cover" sizes="400px" />
      </div>
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{story.eyebrow}</p>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">{story.title}</h3>
        <p className="text-sm text-muted-foreground">{story.description}</p>
      </div>
      <Link href={storyHref} className="text-sm font-semibold text-primary hover:underline">
        {story.ctaLabel} →
      </Link>
    </article>
  )
}
