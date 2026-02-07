export type ShippingOption = {
  id: string;
  label: string;
  carrier: string;
  serviceLevel: "standard" | "express";
  amount: number;
  currency: string;
  estimatedDeliveryDays: number;
};

export type ShipmentView = {
  shipmentId: string;
  orderId: string;
  status: "fulfilled";
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string;
  deliveredAt: string;
};
