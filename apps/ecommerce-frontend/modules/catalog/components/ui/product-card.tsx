import Image from "next/image"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { AddToCartButton } from "@/modules/cart/components/ui/add-to-cart-button"
import { type ProductDTO } from "@/modules/catalog/server/query/dto/product-dto"

type ProductCardProps = {
  product: ProductDTO
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className="flex h-full flex-col border border-border/80 bg-card/80 shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b">
        <Image
          src={product.heroImage}
          alt={product.name}
          fill
          sizes="(min-width: 768px) 400px, 100vw"
          className="object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{product.name}</CardTitle>
          <p className="text-base font-medium">{product.priceLabel}</p>
        </div>
        <p className="text-sm text-muted-foreground">{product.shortDescription}</p>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{product.category}</span>
          <span>•</span>
          <span>{product.rating.toFixed(1)} rating</span>
          <span>•</span>
          <span>{product.reviewCount} reviews</span>
        </div>
        {product.badges.length ? (
          <div className="flex flex-wrap gap-2">
            {product.badges.map((badge) => (
              <Badge key={badge} variant="secondary">
                {badge}
              </Badge>
            ))}
          </div>
        ) : null}
        <AddToCartButton productId={product.id} />
      </CardContent>
    </Card>
  )
}
