import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConsumeMessage } from 'amqplib';
import { RabbitMqClient } from '../src';
import type { EventEnvelope } from '@ecommerce/events';

const connectMock = vi.hoisted(() => vi.fn());

// Mock amqplib so the tests can simulate the broker without a live RabbitMQ instance.
vi.mock('amqplib', () => ({
  __esModule: true,
  default: {
    connect: connectMock
  },
  connect: connectMock
}));

type ChannelStub = {
  assertExchange: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
  publish: ReturnType<typeof vi.fn>;
  assertQueue: ReturnType<typeof vi.fn>;
  bindQueue: ReturnType<typeof vi.fn>;
  consume: ReturnType<typeof vi.fn>;
  ack: ReturnType<typeof vi.fn>;
  nack: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

type ConnectionStub = {
  createChannel: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const createChannelStub = (): ChannelStub => ({
  assertExchange: vi.fn().mockResolvedValue(undefined),
  prefetch: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockReturnValue(true),
  assertQueue: vi.fn().mockResolvedValue(undefined),
  bindQueue: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn(),
  ack: vi.fn(),
  nack: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined)
});

const createConnectionStub = (channel: ChannelStub): ConnectionStub => ({
  createChannel: vi.fn().mockResolvedValue(channel),
  close: vi.fn().mockResolvedValue(undefined)
});

const resolveConnection = (connection: ConnectionStub): void => {
  connectMock.mockResolvedValueOnce(connection);
};

// Helper to turn an envelope into the minimal ConsumeMessage shape RabbitMqClient expects.
const createMessage = <TPayload>(payload: EventEnvelope<TPayload>): ConsumeMessage => ({
  content: Buffer.from(JSON.stringify(payload)),
  fields: {} as any,
  properties: {} as any
});

describe('RabbitMqClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RABBITMQ_URL;
  });

  it('connect asserts the exchange and respects custom prefetch settings', async () => {
    const channel = createChannelStub();
    const connection = createConnectionStub(channel);
    resolveConnection(connection);

    await RabbitMqClient.connect({
      exchange: 'orders_events',
      exchangeType: 'fanout',
      prefetch: 5
    });

    expect(connectMock).toHaveBeenCalledWith('amqp://ecommerce:ecommerce@localhost:5672');
    expect(channel.assertExchange).toHaveBeenCalledWith('orders_events', 'fanout', {
      durable: true
    });
    expect(channel.prefetch).toHaveBeenCalledWith(5);
  });

  it('publish serializes the schema-validated payload', async () => {
    const channel = createChannelStub();
    const connection = createConnectionStub(channel);
    resolveConnection(connection);

    const client = await RabbitMqClient.connect({ exchange: 'domain_events' });
    const event: EventEnvelope<{ total: number }> = {
      id: 'evt-1',
      occurredAt: new Date().toISOString(),
      type: 'OrderSubmitted',
      aggregate: {
        id: 'order-1',
        type: 'order',
        version: 1
      },
      payload: { total: 10 }
    };
    const normalizedEvent = { ...event, payload: { total: 12 } };
    const schema = { parse: vi.fn().mockReturnValue(normalizedEvent) };

    await client.publish(event, { schema, headers: { source: 'tests' } });

    expect(schema.parse).toHaveBeenCalledWith(event);
    expect(channel.publish).toHaveBeenCalledTimes(1);
    const publishArgs = channel.publish.mock.calls[0];
    expect(publishArgs[0]).toBe('domain_events');
    expect(publishArgs[1]).toBe('domain.OrderSubmitted');
    expect(JSON.parse(publishArgs[2].toString())).toEqual(normalizedEvent);
    expect(publishArgs[3]).toMatchObject({
      contentType: 'application/json',
      persistent: true,
      headers: { source: 'tests' }
    });
  });

  it('subscribe acknowledges messages after a successful handler execution', async () => {
    const channel = createChannelStub();
    const connection = createConnectionStub(channel);
    const event: EventEnvelope<{ itemId: string }> = {
      id: 'evt-2',
      occurredAt: new Date().toISOString(),
      type: 'InventoryAdjusted',
      aggregate: {
        id: 'inventory-1',
        type: 'inventory',
        version: 3
      },
      payload: { itemId: 'item-1' }
    };
    const message = createMessage(event);

    channel.consume.mockImplementation(async (_queue, listener) => {
      await listener(message);
      return { consumerTag: 'consumer-1' } as any;
    });

    resolveConnection(connection);
    const client = await RabbitMqClient.connect();
    const handler = vi.fn();

    await client.subscribe({
      handler,
      schema: { parse: vi.fn().mockReturnValue(event) }
    });

    expect(handler).toHaveBeenCalledWith(event, message, channel as any);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('subscribe nacks messages when the handler throws', async () => {
    const channel = createChannelStub();
    const connection = createConnectionStub(channel);
    const event: EventEnvelope<{ cartId: string }> = {
      id: 'evt-3',
      occurredAt: new Date().toISOString(),
      type: 'CartCheckedOut',
      aggregate: {
        id: 'cart-123',
        type: 'cart'
      },
      payload: { cartId: 'cart-123' }
    };
    const message = createMessage(event);

    channel.consume.mockImplementation(async (_queue, listener) => {
      await listener(message);
      return { consumerTag: 'consumer-2' } as any;
    });

    resolveConnection(connection);
    const client = await RabbitMqClient.connect();
    const handler = vi.fn().mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await client.subscribe({ handler });

    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('subscribe configures dead letter settings when provided', async () => {
    const channel = createChannelStub();
    const connection = createConnectionStub(channel);
    resolveConnection(connection);

    const client = await RabbitMqClient.connect({ queue: 'orders' });
    await client.subscribe({
      handler: vi.fn(),
      deadLetterExchange: 'dlx',
      deadLetterRoutingKey: 'dlx.orders'
    });

    expect(channel.assertQueue).toHaveBeenCalledWith('orders', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': 'dlx.orders'
      }
    });
  });
});
