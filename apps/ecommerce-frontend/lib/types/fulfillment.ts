export type ShippingOption = {
  id: string
  label: string
  carrier: string
  serviceLevel: "standard" | "express"
  amount: number
  currency: string
  estimatedDeliveryDays: number
}

export type ShippingOptionsResponse = {
  country: string
  postalCode: string | null
  options: ShippingOption[]
}

export type Shipment = {
  shipmentId: string
  orderId: string
  status: "fulfilled"
  carrier: string
  trackingNumber: string
  trackingUrl: string
  shippedAt: string
  deliveredAt: string
}

export type CreateShipmentResponse = {
  shipment: Shipment
}
