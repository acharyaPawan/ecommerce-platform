import type { CatalogProduct } from "@/lib/types/catalog"
import type { InventorySummary } from "@/lib/types/inventory"

export const mockCatalogProducts: CatalogProduct[] = [
  {
    id: "prod-essential-tee",
    title: "Essential Cotton Tee",
    description:
      "Super-soft cotton tee built for everyday comfort with a tailored silhouette.",
    brand: "Nova Apparel",
    status: "published",
    categories: [
      { id: "tops", name: "Tops" },
      { id: "essentials", name: "Everyday Essentials" },
    ],
    media: [
      {
        id: "media-tee-black",
        url: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80",
        altText: "Essential tee on hanger",
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: "var-tee-black-s",
        sku: "TEE-BLK-S",
        status: "active",
        attributes: { color: "Black", size: "S" },
        prices: [
          {
            id: "price-tee-black-s",
            currency: "USD",
            amountCents: 2800,
            effectiveFrom: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "var-tee-black-m",
        sku: "TEE-BLK-M",
        status: "active",
        attributes: { color: "Black", size: "M" },
        prices: [
          {
            id: "price-tee-black-m",
            currency: "USD",
            amountCents: 2800,
            effectiveFrom: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "var-tee-white-m",
        sku: "TEE-WHT-M",
        status: "active",
        attributes: { color: "White", size: "M" },
        prices: [
          {
            id: "price-tee-white-m",
            currency: "USD",
            amountCents: 2800,
            effectiveFrom: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2024-01-05T12:00:00.000Z",
    updatedAt: "2024-02-10T09:00:00.000Z",
  },
  {
    id: "prod-performance-hoodie",
    title: "Performance Tech Hoodie",
    description:
      "Lightweight performance hoodie with bonded seams and moisture-wicking finish.",
    brand: "Nova Apparel",
    status: "published",
    categories: [
      { id: "outerwear", name: "Outerwear" },
      { id: "performance", name: "Performance" },
    ],
    media: [
      {
        id: "media-hoodie",
        url: "https://images.unsplash.com/photo-1484516758160-69878111a911?w=800&q=80",
        altText: "Performance hoodie flat lay",
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: "var-hoodie-navy-m",
        sku: "HD-NVY-M",
        status: "active",
        attributes: { color: "Navy", size: "M" },
        prices: [
          {
            id: "price-hoodie-navy-m",
            currency: "USD",
            amountCents: 7800,
            effectiveFrom: "2024-02-01T00:00:00.000Z",
          },
        ],
      },
      {
        id: "var-hoodie-navy-l",
        sku: "HD-NVY-L",
        status: "active",
        attributes: { color: "Navy", size: "L" },
        prices: [
          {
            id: "price-hoodie-navy-l",
            currency: "USD",
            amountCents: 7800,
            effectiveFrom: "2024-02-01T00:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2024-01-12T09:20:00.000Z",
    updatedAt: "2024-02-15T12:12:00.000Z",
  },
  {
    id: "prod-all-day-sneaker",
    title: "All-Day Knit Sneaker",
    description:
      "Breathable knit sneaker built for all-day wear with responsive cushioning.",
    brand: "Stratus Footwear",
    status: "published",
    categories: [
      { id: "footwear", name: "Footwear" },
      { id: "sneakers", name: "Sneakers" },
    ],
    media: [
      {
        id: "media-sneaker",
        url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80",
        altText: "White knit sneakers",
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: "var-sneaker-white-9",
        sku: "SHOE-WHT-9",
        status: "active",
        attributes: { color: "White", size: "9" },
        prices: [
          {
            id: "price-sneaker-white-9",
            currency: "USD",
            amountCents: 11800,
            effectiveFrom: "2024-01-10T00:00:00.000Z",
          },
        ],
      },
      {
        id: "var-sneaker-white-10",
        sku: "SHOE-WHT-10",
        status: "active",
        attributes: { color: "White", size: "10" },
        prices: [
          {
            id: "price-sneaker-white-10",
            currency: "USD",
            amountCents: 11800,
            effectiveFrom: "2024-01-10T00:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2024-01-22T07:45:00.000Z",
    updatedAt: "2024-02-20T15:45:00.000Z",
  },
  {
    id: "prod-travel-backpack",
    title: "Modular Travel Backpack",
    description:
      "45L modular backpack with lay-flat opening and weather-resistant shell.",
    brand: "Aero Supply",
    status: "published",
    categories: [
      { id: "bags", name: "Bags" },
      { id: "travel", name: "Travel" },
    ],
    media: [
      {
        id: "media-backpack",
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80",
        altText: "Travel backpack on chair",
        sortOrder: 0,
      },
    ],
    variants: [
      {
        id: "var-backpack-std",
        sku: "BAG-TRVL-STD",
        status: "active",
        attributes: { color: "Charcoal", size: "45L" },
        prices: [
          {
            id: "price-backpack-std",
            currency: "USD",
            amountCents: 16800,
            effectiveFrom: "2024-02-05T00:00:00.000Z",
          },
        ],
      },
    ],
    createdAt: "2024-02-01T10:05:00.000Z",
    updatedAt: "2024-02-20T08:00:00.000Z",
  },
]

export type InventoryOperationalMetadata = {
  reorderPoint: number
  safetyStock: number
  binLocation: string
  supplier: string
  leadTimeDays: number
  lastOrderQuantity: number
  notes?: string
}

export const mockInventorySummaries: Record<string, InventorySummary> = {
  "TEE-BLK-S": {
    sku: "TEE-BLK-S",
    onHand: 280,
    reserved: 26,
    available: 254,
    updatedAt: "2024-03-11T10:45:00.000Z",
  },
  "TEE-BLK-M": {
    sku: "TEE-BLK-M",
    onHand: 320,
    reserved: 35,
    available: 285,
    updatedAt: "2024-03-11T10:45:00.000Z",
  },
  "TEE-WHT-M": {
    sku: "TEE-WHT-M",
    onHand: 180,
    reserved: 60,
    available: 120,
    updatedAt: "2024-03-11T10:30:00.000Z",
  },
  "HD-NVY-M": {
    sku: "HD-NVY-M",
    onHand: 140,
    reserved: 22,
    available: 118,
    updatedAt: "2024-03-11T09:20:00.000Z",
  },
  "HD-NVY-L": {
    sku: "HD-NVY-L",
    onHand: 95,
    reserved: 18,
    available: 77,
    updatedAt: "2024-03-11T09:20:00.000Z",
  },
  "SHOE-WHT-9": {
    sku: "SHOE-WHT-9",
    onHand: 210,
    reserved: 45,
    available: 165,
    updatedAt: "2024-03-10T21:12:00.000Z",
  },
  "SHOE-WHT-10": {
    sku: "SHOE-WHT-10",
    onHand: 188,
    reserved: 38,
    available: 150,
    updatedAt: "2024-03-10T21:12:00.000Z",
  },
  "BAG-TRVL-STD": {
    sku: "BAG-TRVL-STD",
    onHand: 62,
    reserved: 9,
    available: 53,
    updatedAt: "2024-03-11T05:58:00.000Z",
  },
}

export const mockInventoryMetadata: Record<
  string,
  InventoryOperationalMetadata
> = {
  "TEE-BLK-S": {
    reorderPoint: 160,
    safetyStock: 60,
    binLocation: "A1-01-01",
    supplier: "Swift Manufacturing",
    leadTimeDays: 12,
    lastOrderQuantity: 400,
  },
  "TEE-BLK-M": {
    reorderPoint: 180,
    safetyStock: 70,
    binLocation: "A1-01-02",
    supplier: "Swift Manufacturing",
    leadTimeDays: 12,
    lastOrderQuantity: 420,
  },
  "TEE-WHT-M": {
    reorderPoint: 150,
    safetyStock: 55,
    binLocation: "A1-01-05",
    supplier: "Swift Manufacturing",
    leadTimeDays: 12,
    lastOrderQuantity: 300,
    notes: "Paired with seasonal campaign, monitor sell-through weekly.",
  },
  "HD-NVY-M": {
    reorderPoint: 100,
    safetyStock: 40,
    binLocation: "B2-04-02",
    supplier: "Summit Performance Gear",
    leadTimeDays: 18,
    lastOrderQuantity: 180,
  },
  "HD-NVY-L": {
    reorderPoint: 90,
    safetyStock: 35,
    binLocation: "B2-04-03",
    supplier: "Summit Performance Gear",
    leadTimeDays: 18,
    lastOrderQuantity: 160,
  },
  "SHOE-WHT-9": {
    reorderPoint: 120,
    safetyStock: 50,
    binLocation: "C1-08-01",
    supplier: "Orbit Footwear Collective",
    leadTimeDays: 24,
    lastOrderQuantity: 260,
  },
  "SHOE-WHT-10": {
    reorderPoint: 120,
    safetyStock: 50,
    binLocation: "C1-08-02",
    supplier: "Orbit Footwear Collective",
    leadTimeDays: 24,
    lastOrderQuantity: 240,
  },
  "BAG-TRVL-STD": {
    reorderPoint: 45,
    safetyStock: 15,
    binLocation: "D4-02-01",
    supplier: "Aero Supply",
    leadTimeDays: 28,
    lastOrderQuantity: 80,
    notes: "Production slot shared with duffel program; expedite PO if < 30 available.",
  },
}

export type InventoryActivity =
  | {
      id: string
      sku: string
      type: "adjustment" | "reservation" | "commit" | "release" | "threshold"
      quantity: number
      status: "applied" | "failed" | "reserved" | "committed" | "released" | "warning"
      occurredAt: string
      actor: string
      reference?: string
      details?: string
    }

export const mockInventoryActivities: InventoryActivity[] = [
  {
    id: "act-101",
    sku: "TEE-WHT-M",
    type: "threshold",
    status: "warning",
    quantity: 120,
    occurredAt: "2024-03-11T08:10:00.000Z",
    actor: "system",
    details: "Available dipped below reorder point (150).",
  },
  {
    id: "act-100",
    sku: "HD-NVY-M",
    type: "reservation",
    status: "reserved",
    quantity: 18,
    occurredAt: "2024-03-11T07:52:00.000Z",
    actor: "oms",
    reference: "order-90122",
    details: "Reservation created for flash sale order.",
  },
  {
    id: "act-099",
    sku: "SHOE-WHT-10",
    type: "commit",
    status: "committed",
    quantity: 20,
    occurredAt: "2024-03-11T06:34:00.000Z",
    actor: "oms",
    reference: "order-90077",
  },
  {
    id: "act-098",
    sku: "TEE-BLK-M",
    type: "adjustment",
    status: "applied",
    quantity: 80,
    occurredAt: "2024-03-10T22:18:00.000Z",
    actor: "warehouse-nyc",
    reference: "putaway-556",
    details: "Cycle count correction after inbound ASN.",
  },
  {
    id: "act-097",
    sku: "BAG-TRVL-STD",
    type: "reservation",
    status: "failed",
    quantity: 12,
    occurredAt: "2024-03-10T20:05:00.000Z",
    actor: "oms",
    reference: "order-90012",
    details: "Insufficient stock for VIP pre-order.",
  },
]
