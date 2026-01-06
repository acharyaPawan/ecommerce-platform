export type BaseActionState = {
  status: "idle" | "success" | "error"
  message?: string
}

export type SeedProductsActionState = BaseActionState & {
  processed?: number
}

export type CreateProductActionState = BaseActionState & {
  productId?: string
}

export type UpdateProductActionState = BaseActionState

export const seedInitialState: SeedProductsActionState = { status: "idle" }
export const createProductInitialState: CreateProductActionState = {
  status: "idle",
}
export const updateProductInitialState: UpdateProductActionState = {
  status: "idle",
}
