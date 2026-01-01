import { z } from "zod";

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const cartItemSchema = z.object({
  sku: z.string().trim().min(1),
  qty: z.number().int().positive(),
  variantId: z.string().trim().min(1).optional().nullable(),
  selectedOptions: z.record(z.string()).optional().nullable(),
  metadata: z.record(metadataValueSchema).optional(),
  unitPriceCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  title: z.string().optional().nullable(),
});

const pricingSnapshotSchema = z.object({
  subtotalCents: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().length(3),
  itemCount: z.number().int().nonnegative(),
  totalQuantity: z.number().int().nonnegative(),
  computedAt: z.string().datetime(),
});

const totalsSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  totalQuantity: z.number().int().nonnegative(),
  subtotalCents: z.number().int().nonnegative().nullable(),
  currency: z.string().trim().length(3),
});

export const cartSnapshotSchema = z.object({
  snapshotId: z.string().trim().min(1),
  cartId: z.string().trim().min(1),
  cartVersion: z.number().int().nonnegative(),
  currency: z.string().trim().length(3),
  items: z.array(cartItemSchema).min(1),
  totals: totalsSchema,
  createdAt: z.string().datetime(),
  userId: z.string().trim().min(1).nullable().optional(),
  signature: z.string().trim().length(64),
  pricingSnapshot: pricingSnapshotSchema.nullable().optional(),
});

export type CartSnapshotPayload = z.infer<typeof cartSnapshotSchema>;
