export type PaymentStatus = "authorized" | "failed" | "captured"

export type PaymentRecord = {
  id: string
  orderId: string
  status: PaymentStatus
  amountCents: number
  currency: string
  failureReason: string | null
  failedAt: string | null
  capturedAt: string | null
  createdAt: string
  updatedAt: string
}
