**Fulfillment service**
- Owns post-payment order execution.
- Creates shipments, packs items, books carriers, tracks delivery status.
- Handles warehouse workflow: pick/pack/ship, partial shipments, returns intake hooks.
- Emits events like `shipment.created`, `shipment.dispatched`, `shipment.delivered`, `shipment.failed`.

**Notification service**
- Owns customer/operator messaging across channels.
- Sends email/SMS/push/in-app for order and shipment lifecycle events.
- Manages templates, localization, channel preferences, retries, and provider failover.
- Emits/records delivery outcomes like `notification.sent`, `notification.bounced`, `notification.failed`.

**Reporting service**
- Owns analytics/read models, not operational workflows.
- Subscribes to domain events and builds denormalized projections for dashboards and BI.
- Tracks KPIs: sales, conversion, fulfillment SLA, stockouts, notification performance.
- Supports scheduled exports, aggregated queries, and historical trend analysis.

**Boundary rule**
- Fulfillment changes real-world order state.
- Notification communicates state changes.
- Reporting analyzes state changes.