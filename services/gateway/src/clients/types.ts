import type { BodyInit } from 'undici';
import type { ServiceTarget } from '../types.js';

export interface ServiceRequestOptions {
  method: string;
  path: string;
  headers?: Record<string, string>;
  searchParams?: Record<string, string | number | boolean | Array<string | number | boolean>>;
  json?: unknown;
  body?: BodyInit | null;
  timeoutMs?: number;
  parseJson?: boolean;
}

export interface ServiceResponse<T> {
  status: number;
  data: T;
  headers: Headers;
}

export interface ServiceClient {
  name: ServiceTarget;
  request<T>(options: ServiceRequestOptions): Promise<ServiceResponse<T>>;
}

export type DownstreamClients = Record<ServiceTarget, ServiceClient>;
