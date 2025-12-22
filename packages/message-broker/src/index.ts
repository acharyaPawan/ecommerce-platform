import amqplib from 'amqplib';
import type {
  Channel,
  ChannelModel,
  ConsumeMessage,
  Options,
  Replies
} from 'amqplib';
import type { EnvelopeSchema, EventEnvelope } from '@ecommerce/events';

export interface RabbitMqClientConfig {
  url?: string;
  exchange?: string;
  exchangeType?: 'topic' | 'fanout' | 'direct';
  queue?: string;
  prefetch?: number;
}

export interface PublishOptions<TPayload = unknown> {
  routingKey?: string;
  persistent?: boolean;
  headers?: Options.Publish['headers'];
  schema?: EnvelopeSchema<EventEnvelope<TPayload>>;
}

export interface SubscribeOptions<TPayload = unknown> {
  queue?: string;
  routingKey?: string;
  handler: EventHandler<TPayload>;
  noAck?: boolean;
  deadLetterExchange?: string;
  deadLetterRoutingKey?: string;
  prefetch?: number;
  schema?: EnvelopeSchema<EventEnvelope<TPayload>>;
}

export type EventHandler<TPayload = unknown> = (
  event: EventEnvelope<TPayload>,
  rawMessage: ConsumeMessage,
  channel: Channel
) => Promise<void> | void;

export class RabbitMqClient {
  private constructor(
    private readonly config: Required<RabbitMqClientConfig>,
    private readonly connection: ChannelModel,
    private readonly channel: Channel
  ) {}

  static async connect(
    config: RabbitMqClientConfig = {}
  ): Promise<RabbitMqClient> {
    const resolvedConfig: Required<RabbitMqClientConfig> = {
      url: config.url ?? getDefaultUrl(),
      exchange: config.exchange ?? 'domain_events',
      exchangeType: config.exchangeType ?? 'topic',
      queue: config.queue ?? 'domain_events',
      prefetch: config.prefetch ?? 10
    };

    const connection = await amqplib.connect(resolvedConfig.url);
    const channel = await connection.createChannel();
    await channel.assertExchange(resolvedConfig.exchange, resolvedConfig.exchangeType, {
      durable: true
    });
    if (resolvedConfig.prefetch > 0) {
      await channel.prefetch(resolvedConfig.prefetch);
    }

    return new RabbitMqClient(resolvedConfig, connection, channel);
  }

  async publish<TPayload = unknown>(
    event: EventEnvelope<TPayload>,
    options: PublishOptions<TPayload> = {}
  ): Promise<boolean> {
    const routingKey = options.routingKey ?? buildRoutingKey(event.type);
    const payloadBuffer = Buffer.from(JSON.stringify(event));
    if (options.schema) {
      options.schema.parse(event);
    }

    return this.channel.publish(
      this.config.exchange,
      routingKey,
      payloadBuffer,
      {
        contentType: 'application/json',
        persistent: options.persistent ?? true,
        headers: options.headers
      }
    );
  }

  async subscribe<TPayload = unknown>(
    options: SubscribeOptions<TPayload>
  ): Promise<Replies.Consume> {
    const queueName = options.queue ?? this.config.queue;
    const routingKey = options.routingKey ?? 'domain.#';
    const noAck = options.noAck ?? false;
    const prefetch = options.prefetch ?? this.config.prefetch;

    const queueArgs: Options.AssertQueue = {
      durable: true,
      arguments: {}
    };
    if (options.deadLetterExchange) {
      queueArgs.arguments = {
        ...queueArgs.arguments,
        'x-dead-letter-exchange': options.deadLetterExchange
      };
      if (options.deadLetterRoutingKey) {
        queueArgs.arguments['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;
      }
    }

    await this.channel.assertQueue(queueName, queueArgs);
    await this.channel.bindQueue(queueName, this.config.exchange, routingKey);
    if (prefetch > 0) {
      await this.channel.prefetch(prefetch);
    }

    return this.channel.consume(
      queueName,
      async (message) => {
        if (!message) {
          return;
        }
        try {
          const parsed = this.parseMessage(message, options.schema);
          await options.handler(parsed, message, this.channel);
          if (!noAck) {
            this.channel.ack(message);
          }
        } catch (error) {
          if (!noAck) {
            this.channel.nack(message, false, false);
          }
          console.error('RabbitMQ handler failed', error);
        }
      },
      { noAck }
    );
  }

  async close(): Promise<void> {
    await this.channel.close();
    await this.connection.close();
  }

  private parseMessage<TPayload>(
    message: ConsumeMessage,
    schema?: EnvelopeSchema<EventEnvelope<TPayload>>
  ): EventEnvelope<TPayload> {
    const raw = JSON.parse(message.content.toString());
    if (schema) {
      return schema.parse(raw);
    }
    return raw as EventEnvelope<TPayload>;
  }
}

function getDefaultUrl(): string {
  const envUrl = process.env.RABBITMQ_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  return 'amqp://ecommerce:ecommerce@localhost:5672';
}

function buildRoutingKey(eventType: string): string {
  return eventType.includes('.') ? eventType : `domain.${eventType}`;
}
