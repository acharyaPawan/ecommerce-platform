import Image from "next/image"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { type ProductDTO } from "@/modules/catalog/server/query/dto/product-dto"

type HeroSectionProps = {
  product: ProductDTO
}

export function HeroSection({ product }: HeroSectionProps) {
  return (
    <section className="grid gap-10 lg:grid-cols-[2fr,1.2fr] lg:items-center">
      <div className="space-y-6">
        <Badge variant="secondary" className="w-fit uppercase tracking-[0.3em]">
          Weekly drop
        </Badge>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
            {product.name}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">{product.shortDescription}</p>
        </div>
        {product.story ? <p className="text-sm text-muted-foreground">{product.story}</p> : null}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{product.priceLabel}</span>
          <span>•</span>
          <span>
            {product.rating.toFixed(1)} from {product.reviewCount} teams
          </span>
          <span>•</span>
          <span>{product.inventory} in stock</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="#catalog" className={cn(buttonVariants())}>
            Build your kit
          </Link>
          <Link href="#collections" className={cn(buttonVariants({ variant: "ghost" }))}>
            View floor sets
          </Link>
        </div>
      </div>
      <figure className="relative aspect-square overflow-hidden rounded-3xl border border-border/70">
        <Image
          src={product.heroImage}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 520px, 100vw"
          priority
        />
      </figure>
    </section>
  )
}
