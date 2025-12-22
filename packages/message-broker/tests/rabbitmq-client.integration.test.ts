import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { RabbitMqClient } from '../src';
import type { EventEnvelope } from '@ecommerce/events';

const dockerAvailable = (() => {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    // Docker is unavailable (missing daemon or insufficient permissions).
    return false;
  }
})();

if (!dockerAvailable) {
  console.warn('Skipping RabbitMqClient integration tests because Docker is not available.');
}

const describeIfDocker = dockerAvailable ? describe : describe.skip;

describeIfDocker('RabbitMqClient integration', () => {
  let container: StartedRabbitMQContainer;

  beforeAll(async () => {
    // Spin up a disposable RabbitMQ container for the integration tests.
    console.info('[integration] starting RabbitMQ container');
    container = await new RabbitMQContainer('rabbitmq:3.13-management').start();
    console.info('[integration] container started on', container.getHost(), 'ports', {
      amqp: container.getMappedPort(5672),
      http: container.getMappedPort(15672)
    });
  });

  afterAll(async () => {
    console.info('[integration] stopping RabbitMQ container');
    await container.stop();
    console.info('[integration] container stopped');
  });

  it('publishes and consumes a domain event end-to-end', async () => {
    const connectionUrl = `amqp://guest:guest@${container.getHost()}:${container.getMappedPort(5672)}`;
    console.info('[integration] connecting client to', connectionUrl);
    const client = await RabbitMqClient.connect({
      url: connectionUrl,
      exchange: 'integration_events',
      queue: 'integration_queue',
      prefetch: 1
    });

    const event: EventEnvelope<{ orderId: string }> = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      type: 'IntegrationEvent',
      aggregate: {
        id: 'order-123',
        type: 'order',
        version: 1
      },
      payload: { orderId: 'order-123' }
    };
    console.info('[integration] prepared event', event.id);

    let resolveHandler!: (value: EventEnvelope<{ orderId: string }>) => void;
    const handlerPromise = new Promise<EventEnvelope<{ orderId: string }>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for event')), 20000);
      resolveHandler = (value) => {
        clearTimeout(timeout);
        resolve(value);
      };
    });

    await client.subscribe({
      routingKey: 'domain.IntegrationEvent',
      handler: async (received) => {
        console.info('[integration] handler received event', received.id);
        resolveHandler(received as EventEnvelope<{ orderId: string }>);
      }
    });

    console.info('[integration] publishing event', event.id);
    const publishResult = await client.publish(event);
    expect(publishResult).toBe(true);

    const receivedEvent = await handlerPromise;
    expect(receivedEvent).toEqual(event);

    console.info('[integration] closing client');
    await client.close();
    console.info('[integration] client closed');
  });
});
