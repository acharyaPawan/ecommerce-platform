import type { Context } from 'hono';
import type { GatewayBindings, ServiceTarget } from '../types.js';
import type { ServiceRequestOptions, ServiceResponse } from '../clients/types.js';
import { DownstreamError } from '../clients/http-client.js';

export type AppContext = Context<GatewayBindings>;

interface ExtendedRequestOptions extends ServiceRequestOptions {
  forwardAuth?: boolean;
  forwardIdempotencyKey?: boolean;
}

export const callService = async <T>(
  c: AppContext,
  target: ServiceTarget,
  options: ExtendedRequestOptions,
): Promise<ServiceResponse<T>> => {
  const services = c.get('services');
  const client = services[target];
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
    'x-request-id': c.get('requestId'),
  };

  const traceparent = c.get('traceparent');
  if (traceparent) {
    headers.traceparent = traceparent;
  }

  if (options.forwardAuth) {
    const authHeader = c.req.header('authorization');
    if (authHeader) {
      headers.authorization = authHeader;
    }
  }

  if (options.forwardIdempotencyKey) {
    const keyName = c.get('config').idempotencyHeader;
    const keyValue = c.req.header(keyName);
    if (keyValue) {
      headers[keyName] = keyValue;
    }
  }

  return client.request<T>({
    ...options,
    headers,
  });
};

export const unwrap = async <T>(
  promise: Promise<ServiceResponse<T>>,
  onError?: (error: DownstreamError) => void,
): Promise<T> => {
  try {
    const { data } = await promise;
    return data;
  } catch (error) {
    if (error instanceof DownstreamError) {
      onError?.(error);
    }
    throw error;
  }
};

export const collectWarnings = (
  results: Array<PromiseSettledResult<unknown>>,
  services: string[],
): string[] => {
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      warnings.push(`${services[index]} unavailable`);
    }
  });
  return warnings;
};

export const requestQueries = (c: AppContext): Record<string, string | string[]> => {
  const entries = Object.entries(c.req.queries());
  return entries.reduce<Record<string, string | string[]>>((acc, [key, value]) => {
    if (value.length === 1) {
      acc[key] = value[0];
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
};
