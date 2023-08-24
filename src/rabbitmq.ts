import * as winston from 'winston';
import { Message } from 'amqplib';
import { v4 as uuid } from 'uuid';
import Logger from './logger';
import {
  withCorrelationContext,
  currentCorrelationContext
} from './correlation';
import {
  BrokerAsPromised as Broker,
  BrokerConfig,
  SubscriptionConfig,
  PublicationConfig,
  withDefaultConfig,
  QueueConfig,
  ExchangeConfig,
  AckOrNack,
  RetryConfig
} from 'rascal';

type Dictionary<T> = { [key: string]: T };
type Awaitable<T> = Promise<T> | T;

type QueueName = string;
type Exchange = { exchange: string; key?: string };

type MessageHandlerFn = (
  msg: Message
) => Awaitable<MessageHandlerResult[] | void>;
interface MessageHandlerResult {
  exchange: string;
  key: string;
  payload: string | object | null;
  headers?: Dictionary<string>;
}

const baseLogger = Logger.child({});

export class RejectAndDontRequeueError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, RejectAndDontRequeueError.prototype);
  }
}

export class RabbitMQ {
  public readonly handlersMap = new Map<string, MessageHandlerFn>();
  public readonly subscriptionOverrides = new Map<string, SubscriptionConfig>();
  public readonly vhost: string = '/';
  public readonly prefetch: number;

  private broker: Broker | null = null;

  constructor(
    public readonly amqpURI: string = process.env.AMQP_URI ||
      'amqp://guest:guest@localhost:5672/',
    public readonly targets: Exchange[] = [],
    public readonly autoAck: boolean = false,
    prefetch: number = -1
  ) {
    this.prefetch =
      prefetch < 0 ? parseInt(process.env.PREFETCH_COUNT || '5', 10) : prefetch;
  }

  addHandler(
    from: QueueName,
    handler: MessageHandlerFn,
    configOverride?: SubscriptionConfig
  ): void {
    if (this.handlersMap.has(from)) {
      throw new Error('QUEUE_ALREADY_SUBSCRIBED');
    }

    this.handlersMap.set(from, handler);

    if (configOverride) {
      this.subscriptionOverrides.set(from, configOverride);
    }
  }

  start(): Promise<void> {
    return this.setupBroker();
  }

  stop(): Promise<void> {
    if (!this.broker) {
      return Promise.resolve();
    }
    return this.broker.shutdown();
  }

  private async setupBroker(): Promise<void> {
    const config = this.getBrokerConfig();
    baseLogger.debug('RabbitMQ broker config generated', { config });

    try {
      this.broker = await Broker.create(config);
      baseLogger.info('RabbitMQ broker created');

      this.broker.on('error', (error) => {
        baseLogger.error('Error in RabbitMQ broker', error);
      });

      this.broker.on('blocked', (reason, { vhost, connectionUrl }) => {
        baseLogger.warn(
          `Vhost: ${vhost} was blocked using connection: ${connectionUrl}. Reason: ${reason}`
        );
      });

      this.broker.on('unblocked', ({ vhost, connectionUrl }) => {
        baseLogger.warn(
          `Vhost: ${vhost} was unblocked using connection: ${connectionUrl}.`
        );
      });

      for (const [queueName, handler] of this.handlersMap) {
        await this.setupSubscription(queueName, handler);
      }
    } catch (error) {
      baseLogger.error('Error while creating RabbitMQ broker', error);
      throw error;
    }
  }

  private getBrokerConfig(): BrokerConfig {
    const queueNames = [...this.handlersMap.keys()];

    const queues = queueNames.reduce(
      (queues, queueName) => ({
        ...queues,
        [queueName]: {
          assert: false,
          check: true
        }
      }),
      {} as Dictionary<QueueConfig>
    );

    const exchanges = this.targets.reduce(
      (exchanges, target) => ({
        ...exchanges,
        [target.exchange]: {
          assert: false,
          check: true
        }
      }),
      {} as Dictionary<ExchangeConfig>
    );

    const subscriptions = queueNames.reduce(
      (subscriptions, queueName) => ({
        ...subscriptions,
        [this.subscriptionKey(queueName)]: {
          queue: queueName,
          prefetch: this.prefetch,
          options: {
            noAck: this.autoAck
          }
        }
      }),
      {} as Dictionary<SubscriptionConfig>
    );

    const publications = this.targets.reduce(
      (publications, target) => ({
        ...publications,
        [this.publicationKey(target)]: {
          exchange: target.exchange,
          routingKey: target.key,
          confirm: true
        }
      }),
      {} as Dictionary<PublicationConfig>
    );

    return withDefaultConfig({
      vhosts: {
        [this.vhost]: {
          connection: {
            url: this.amqpURI
          },
          publicationChannelPools: {
            confirmPool: {
              max: 20,
              min: 10,
              evictionRunIntervalMillis: 1000,
              idleTimeoutMillis: 30000,
              autostart: false
            }
          },
          queues,
          exchanges,
          subscriptions,
          publications
        }
      }
    });
  }

  private async setupSubscription(
    queueName: string,
    handler: MessageHandlerFn
  ): Promise<void> {
    this.assertBroker(this.broker);

    const configOverride = this.subscriptionOverrides.get(queueName);

    const subscription = await this.broker.subscribe(
      this.subscriptionKey(queueName),
      configOverride
    );
    const log = baseLogger.child({
      subscription: subscription.name,
      config: configOverride
    });
    log.info('RabbitMQ broker subscribed');

    subscription.on('message', (msg, _content, ackOrNackFn) => {
      const messageId = msg.properties.messageId;
      const headers = msg.properties.headers;
      const {
        'correlation-id': correlationId,
        'causation-id': causationId
      } = headers;
      const inputMessage = {
        body: msg.content.toString(),
        properties: msg.properties,
        fields: msg.fields
      };

      withCorrelationContext(
        { correlationId, causationId, messageId, inputMessage },
        () => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onMessage(log, handler, msg, ackOrNackFn, configOverride);
        }
      );
    });

    subscription.on('error', (error) => {
      log.error('Error in RabbitMQ subscription', error);
    });
  }

  private async onMessage(
    subscriptionLogger: winston.Logger,
    handler: MessageHandlerFn,
    msg: Message,
    ackOrNackFn: AckOrNack,
    configOverride?: SubscriptionConfig
  ): Promise<void> {
    const log = subscriptionLogger.child({
      msgHeaders: msg.properties.headers,
      msgFields: msg.fields
    });

    log.debug(
      `New message: ${msg.fields.routingKey}, ${msg.properties.messageId}`
    );

    this.assertBroker(this.broker);

    try {
      const startTime = process.hrtime();
      const results = await handler(msg);
      const endTime = process.hrtime(startTime);

      log.debug(
        `Message processed: ${msg.fields.routingKey}, ${
          msg.properties.messageId
        }, ${endTime[0]}s ${endTime[1] / 1000000}ms`,
        { results }
      );

      if (results) {
        for (const result of results) {
          if (result.payload) {
            await this.publishHandlerResult(result);
          }
        }
      }

      if (!this.autoAck) {
        await new Promise<void>((resolve, reject) => {
          (ackOrNackFn as any)((error: Error) =>
            error ? reject(error) : resolve()
          );
        });
      }
    } catch (error) {
      log.error('Error while processing RabbitMQ message', error);

      if (error instanceof RejectAndDontRequeueError) {
        try {
          await new Promise<void>((resolve, reject) => {
            (ackOrNackFn as any)(
              error,
              [{ strategy: 'nack' }],
              (error: Error) => (error ? reject(error) : resolve())
            );
          });
        } catch (error) {
          log.error('Could not nack message');
        }
      } else if (!this.autoAck) {
        try {
          await new Promise<void>((resolve, reject) => {
            (ackOrNackFn as any)(
              error,
              [
                {
                  strategy: 'republish',
                  requeue: true,
                  defer: (configOverride?.retry as RetryConfig).delay ?? 10000,
                  attempts: configOverride?.redeliveries?.limit ?? 5
                },
                { strategy: 'nack' }
              ],
              (error: Error) => (error ? reject(error) : resolve())
            );
          });
        } catch (error) {
          log.error('Could not nack message');
        }
      }
    }
  }

  private publishHandlerResult(result: MessageHandlerResult): Promise<void> {
    return this.publish(result.exchange, result.key, result.payload, {
      options: { headers: result.headers || {} }
    });
  }

  public async publish<T>(
    exchange: string,
    key: string | undefined,
    payload: T,
    publicationOptions: PublicationConfig = {}
  ): Promise<void> {
    const publicationKey = this.publicationKey({ exchange, key });
    const previousContext = currentCorrelationContext();
    const options = publicationOptions.options ?? {};

    if (!options.messageId) {
      options.messageId = uuid();
    }

    options.persistent = true;

    const correlationContext = {
      correlationId: previousContext?.correlationId,
      causationId: previousContext?.messageId,
      messageId: options.messageId
    };

    return withCorrelationContext(correlationContext, async () => {
      this.assertBroker(this.broker);

      options.headers = {
        ...(options.headers || {}),
        'correlation-id': correlationContext.correlationId,
        'causation-id': correlationContext.causationId
      };

      publicationOptions.options = options;

      baseLogger.debug('Publishing', {
        publicationKey,
        payload,
        publicationOptions
      });

      const publication = await this.broker.publish(
        publicationKey,
        payload,
        publicationOptions
      );

      return new Promise((resolve, reject) => {
        publication.on('success', () => {
          resolve();
        });

        publication.on('return', () => {
          reject(new Error('Message was returned'));
        });

        publication.on('error', (error) => {
          reject(error);
        });
      });
    });
  }

  private assertBroker(broker: Broker | null): asserts broker is Broker {
    if (!broker) {
      throw new Error('BROKER_IS_NOT_SETUP');
    }
  }

  private publicationKey(target: Exchange): string {
    if (!target.key) {
      return `${this.vhost}${target.exchange}`;
    }
    return `${this.vhost}${target.exchange}/${target.key}`;
  }

  private subscriptionKey(queueName: string): string {
    return `${this.vhost}${queueName}`;
  }
}
