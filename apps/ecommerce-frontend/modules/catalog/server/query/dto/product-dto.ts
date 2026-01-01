import { z } from "zod"

export const productDtoSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  story: z.string().optional(),
  heroImage: z.string(),
  gallery: z.array(z.string()).default([]),
  price: z.number(),
  priceLabel: z.string(),
  currency: z.string(),
  rating: z.number(),
  reviewCount: z.number(),
  inventory: z.number(),
  category: z.string(),
  tags: z.array(z.string()),
  badges: z.array(z.string()),
  featured: z.boolean(),
})

export const collectionDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  callout: z.string().optional(),
  heroImage: z.string(),
  swatches: z.tuple([z.string(), z.string()]),
  metricLabel: z.string(),
  metricValue: z.string(),
})

export const editorialDtoSchema = z.object({
  id: z.string(),
  eyebrow: z.string(),
  title: z.string(),
  description: z.string(),
  author: z.string().nullable().optional(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
  image: z.string(),
})

export type ProductDTO = z.infer<typeof productDtoSchema>
export type CollectionDTO = z.infer<typeof collectionDtoSchema>
export type EditorialDTO = z.infer<typeof editorialDtoSchema>
