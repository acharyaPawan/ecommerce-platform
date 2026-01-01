import { z } from "zod";

export const cartContextSchema = z.object({
  cartId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  currency: z.string().length(3).optional(),
});

export const createAddItemSchema = (maxQtyPerItem: number) =>
  z.object({
    sku: z.string().min(1).max(128),
    qty: z.number().int().min(1).max(maxQtyPerItem),
    variantId: z.string().min(1).max(128).optional(),
    selectedOptions: z
      .record(z.string().min(1).max(128), z.string().min(1).max(256))
      .optional(),
    currency: z.string().length(3).optional(),
  });

export const itemTargetSchema = z.object({
  variantId: z.string().min(1).max(128).optional(),
  selectedOptions: z
    .record(z.string().min(1).max(128), z.string().min(1).max(256))
    .optional(),
});

export const createUpdateItemSchema = (maxQtyPerItem: number) =>
  itemTargetSchema
    .extend({
      qty: z.number().int().min(0).max(maxQtyPerItem).optional(),
      delta: z.number().int().min(-maxQtyPerItem).max(maxQtyPerItem).optional(),
    })
    .refine((data) => typeof data.qty === "number" || typeof data.delta === "number", {
      message: "qty or delta is required",
      path: ["qty"],
    });

export const checkoutSchema = z.object({
  refreshPricing: z.boolean().optional(),
});

export type AddItemPayload = z.infer<ReturnType<typeof createAddItemSchema>>;
export type UpdateItemPayload = z.infer<ReturnType<typeof createUpdateItemSchema>>;
export type CheckoutPayload = z.infer<typeof checkoutSchema>;
export type ItemTargetPayload = z.infer<typeof itemTargetSchema>;
