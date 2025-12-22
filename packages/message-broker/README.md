# @ecommerce/message-broker

Thin wrapper around `amqplib` that standardizes publishing and consuming `DomainEvent`s via RabbitMQ.

```ts
import { RabbitMqClient } from '@ecommerce/message-broker';

const broker = await RabbitMqClient.connect();

await broker.publish({
  id: crypto.randomUUID(),
  type: 'CartCheckedOut',
  version: 1,
  occurredAt: new Date().toISOString(),
  payload: { cartId: 'cart-123' }
});

await broker.subscribe({
  routingKey: 'domain.CartCheckedOut',
  handler: async (event) => {
    console.log(event.payload.cartId);
  }
});
```

Configuration is driven through `RABBITMQ_URL` or the options passed into `RabbitMqClient.connect`.
