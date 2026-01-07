"use server"

import { revalidatePath } from "next/cache"
import { faker } from "@faker-js/faker"

import {
  createCatalogProduct,
  updateCatalogProduct,
} from "@/lib/server/catalog-client";
import type {
  CatalogProductInput,
  CatalogProductStatus,
} from "@/lib/types/catalog";
import {
  type SeedProductsActionState,
  type CreateProductActionState,
  type UpdateProductActionState,
  seedInitialState,
  createProductInitialState,
  updateProductInitialState,
  type BaseActionState,
} from "@/lib/actions/catalog-action-state";

export async function seedRandomProductsAction(
  _prev: SeedProductsActionState,
  formData: FormData
): Promise<SeedProductsActionState> {
  const countRaw = formData.get("count")?.toString() ?? "100"
  const brandPrefix = formData.get("brandPrefix")?.toString().trim()
  const categoryPrefix = formData.get("categoryPrefix")?.toString().trim()
  const status = parseStatus(formData.get("status")?.toString())

  const count = clamp(Number(countRaw), 1, 200)
  if (!Number.isFinite(count)) {
    return errorState(seedInitialState, "Invalid count value.")
  }

  const tasks = Array.from({ length: count }, (_, index) =>
    buildRandomProduct({
      brandPrefix,
      categoryPrefix,
      status,
      index,
    })
  )

  let processed = 0
  const errors: string[] = []

  for (const payload of tasks) {
    try {
      await createCatalogProduct(payload)
      processed += 1
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown error")
    }
  }

  revalidatePath("/")
  if (errors.length) {
    return {
      status: "error",
      message: errors[0],
      processed,
    }
  }

  return {
    status: "success",
    message: `Created ${processed} products`,
    processed,
  }
}

export async function createCatalogProductAction(
  _prev: CreateProductActionState,
  formData: FormData
): Promise<CreateProductActionState> {
  const title = formData.get("title")?.toString().trim()
  const sku = formData.get("sku")?.toString().trim()
  const priceRaw = formData.get("price")?.toString()
  const currency = formData.get("currency")?.toString().trim() || "USD"

  if (!title) return errorState(createProductInitialState, "Title is required.")
  if (!sku) return errorState(createProductInitialState, "SKU is required.")
  const price = Number(priceRaw)
  if (!Number.isFinite(price) || price <= 0) {
    return errorState(createProductInitialState, "Price must be greater than zero.")
  }

  const payload = normalizeProductPayload({
    title,
    description: formData.get("description")?.toString(),
    brand: formData.get("brand")?.toString(),
    status: parseStatus(formData.get("status")?.toString()) ?? "draft",
    categoriesInput: formData.get("categories")?.toString(),
    sku,
    currency,
    price,
    attributesInput: formData.get("attributes")?.toString(),
  })

  try {
    const { productId } = await createCatalogProduct(payload)
    revalidatePath("/")
    return {
      status: "success",
      message: "Product created.",
      productId,
    }
  } catch (error) {
    return errorState(
      createProductInitialState,
      error instanceof Error ? error.message : "Failed to create product."
    )
  }
}

export async function updateCatalogProductAction(
  _prev: UpdateProductActionState,
  formData: FormData
): Promise<UpdateProductActionState> {
  const productId = formData.get("productId")?.toString()
  const title = formData.get("title")?.toString().trim()
  const status = parseStatus(formData.get("status")?.toString())

  if (!productId) return errorState(updateProductInitialState, "Product ID missing.")
  if (!title) return errorState(updateProductInitialState, "Title is required.")
  if (!status) return errorState(updateProductInitialState, "Status is required.")

  const payload: Partial<CatalogProductInput> = {
    title,
    status,
    description: formData.get("description")?.toString() || undefined,
    brand: formData.get("brand")?.toString() || undefined,
  }

  try {
    await updateCatalogProduct(productId, payload)
    revalidatePath("/")
    return { status: "success", message: "Product updated." }
  } catch (error) {
    return errorState(
      updateProductInitialState,
      error instanceof Error ? error.message : "Failed to update product."
    )
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function parseStatus(value?: string): CatalogProductStatus | undefined {
  if (!value) return undefined
  if (value === "draft" || value === "published" || value === "archived") {
    return value
  }
  return undefined
}

function buildRandomProduct(params: {
  brandPrefix?: string
  categoryPrefix?: string
  status?: CatalogProductStatus
  index: number
}): CatalogProductInput {
  const categorySlug = `${params.categoryPrefix ?? "category"}-${faker.number
    .int({ min: 1, max: 999 })
    .toString()
    .padStart(3, "0")}`
  const baseTitle = faker.commerce.productName()
  const sku = `${faker.commerce.productMaterial().slice(0, 3)}-${faker.number
    .int({ min: 1000, max: 9999 })
    .toString()}-${params.index}`

  return {
    title: baseTitle,
    description: faker.commerce.productDescription(),
    brand:
      params.brandPrefix ??
      `${faker.company.buzzNoun()} ${faker.company.buzzVerb()}`,
    status: params.status ?? "draft",
    categories: [
      {
        id: categorySlug,
        name: faker.commerce.department(),
      },
    ],
    media: [
      {
        url: faker.image.urlLoremFlickr({ category: "fashion" }),
        sortOrder: 0,
        altText: `${baseTitle} hero image`,
      },
    ],
    variants: [
      {
        sku,
        status: "active",
        attributes: {
          color: faker.commerce.productMaterial(),
          size: faker.helpers.arrayElement(["XS", "S", "M", "L", "XL"]),
        },
        prices: [
          {
            currency: "USD",
            amountCents: faker.number.int({ min: 1500, max: 25000 }),
          },
        ],
      },
    ],
  }
}

function normalizeProductPayload({
  title,
  description,
  brand,
  status,
  categoriesInput,
  sku,
  currency,
  price,
  attributesInput,
}: {
  title: string
  description?: string | null
  brand?: string | null
  status: CatalogProductStatus
  categoriesInput?: string
  sku: string
  currency: string
  price: number
  attributesInput?: string
}): CatalogProductInput {
  const categories = categoriesInput
    ? categoriesInput
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [id, name] = entry.split(":").map((value) => value.trim())
          return {
            id: id || faker.helpers.slugify(entry),
            name: name || capitalize(id || entry),
          }
        })
    : []

  const attributes = attributesInput
    ? Object.fromEntries(
        attributesInput
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            const [key, value] = entry.split(":").map((value) => value.trim())
            return [key || "attribute", value || ""]
          })
      )
    : {}

  const payload: CatalogProductInput = {
    title,
    description: description || undefined,
    brand: brand || undefined,
    status,
    categories,
    variants: [
      {
        sku,
        status: "active",
        attributes,
        prices: [
          {
            currency: currency.toUpperCase(),
            amountCents: Math.round(price * 100),
          },
        ],
      },
    ],
  }

  return payload
}

function capitalize(value: string) {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function errorState<T extends BaseActionState>(state: T, message: string): T {
  return {
    ...state,
    status: "error",
    message,
  }
}
