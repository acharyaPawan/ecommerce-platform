import { z } from "zod";

const attributeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const priceInputSchema = z.object({
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  amountCents: z.number().int().nonnegative(),
  effectiveFrom: z.iso.datetime()
    .optional(),
});

export const variantInputSchema = z.object({
  sku: z.string().min(1),
  status: z.enum(["active", "discontinued"]).default("active"),
  attributes: z.record(z.string(), attributeValueSchema).default({}),
  prices: z.array(priceInputSchema).min(1),
});

export const mediaInputSchema = z.object({
  url: z.url(),
  sortOrder: z.number().int().nonnegative().optional(),
  altText: z.string().optional(),
});

export const categoryInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
});

export const createProductSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  media: z.array(mediaInputSchema).default([]),
  categories: z.array(categoryInputSchema).default([]),
  variants: z.array(variantInputSchema).min(1),
});

export const updateProductSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    brand: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
export type PriceInput = z.infer<typeof priceInputSchema>;
export type MediaInput = z.infer<typeof mediaInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
