import { fetch } from 'undici';
import type { Logger } from '../logger.js';
import type { ServiceRequestOptions, ServiceResponse, ServiceClient } from './types.js';
import type { ServiceTarget } from '../types.js';

export class DownstreamError extends Error {
  constructor(
    public readonly details: {
      service: ServiceTarget;
      status?: number;
      cause?: unknown;
      body?: string;
    },
  ) {
    super(`Downstream service ${details.service} request failed`);
  }
}

interface ClientOptions {
  name: ServiceTarget;
  baseUrl: string;
  defaultTimeoutMs: number;
  logger: Logger;
}

export class HttpServiceClient implements ServiceClient {
  readonly name: ServiceTarget;
  private readonly base: URL;

  constructor(private readonly options: ClientOptions) {
    this.name = options.name;
    this.base = new URL(options.baseUrl);
  }

  async request<T>(options: ServiceRequestOptions): Promise<ServiceResponse<T>> {
    const url = new URL(options.path, this.base);
    if (options.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) {
            url.searchParams.append(key, String(item));
          }
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(options.headers ?? {}),
    };

    let body = options.body ?? null;
    if (options.json !== undefined) {
      body = JSON.stringify(options.json);
      headers['content-type'] = headers['content-type'] ?? 'application/json';
    }

    const timeout = options.timeoutMs ?? this.options.defaultTimeoutMs;
    const signal = AbortSignal.timeout(timeout);

    try {
      console.log(`fetch url is: ${url}`)
      const response = await fetch(url, {
        method: options.method,
        headers,
        body,
        signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      const shouldParseJson = options.parseJson ?? contentType.includes('application/json');

      if (!response.ok) {
        const text = await response.text();
        throw new DownstreamError({
          service: this.name,
          status: response.status,
          body: text,
        });
      }

      let data: unknown;
      if (shouldParseJson) {
        data = (await response.json()) as T;
      } else {
        data = (await response.text()) as unknown;
      }

      this.options.logger.debug(
        {
          service: this.name,
          method: options.method,
          path: options.path,
          status: response.status,
        },
        'downstream.request',
      );

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        data: data as T,
        headers: responseHeaders,
      };
    } catch (error) {
      if (error instanceof DownstreamError) {
        this.options.logger.warn(
          {
            service: error.details.service,
            status: error.details.status,
          },
          'downstream.error',
        );
        throw error;
      }

      this.options.logger.error(
        {
          service: this.name,
          err: error as Error,
        },
        'downstream.error',
      );
      throw new DownstreamError({
        service: this.name,
        cause: error,
      });
    }
  }
}
