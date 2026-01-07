import "server-only"

import crypto from "node:crypto"

import { env } from "@/env/server"
import { getServiceAuthToken } from "@/lib/server/service-auth-context"

export type ServiceName =
  | "iam"
  | "catalog"
  | "inventory"
  | "cart"
  | "orders"
  | "ordersRead"
  | "payments"
  | "paymentsRead"
  | "fulfillment"

type ServiceConfig = {
  url: string
  timeoutMs: number
}

const defaultServiceConfig: Record<ServiceName, ServiceConfig> = {
  iam: { url: "http://localhost:3001", timeoutMs: 400 },
  catalog: { url: "http://localhost:3002", timeoutMs: 10_000 },
  inventory: { url: "http://localhost:3003", timeoutMs: 500 },
  cart: { url: "http://localhost:3004", timeoutMs: 400 },
  orders: { url: "http://localhost:3005", timeoutMs: 800 },
  ordersRead: { url: "http://localhost:3005", timeoutMs: 600 },
  payments: { url: "http://localhost:3007", timeoutMs: 800 },
  paymentsRead: { url: "http://localhost:3008", timeoutMs: 600 },
  fulfillment: { url: "http://localhost:3009", timeoutMs: 600 },
}

const serviceEnvKeys: Record<
  ServiceName,
  { url: keyof typeof env; timeout: keyof typeof env }
> = {
  iam: {
    url: "SERVICE_IAM_URL",
    timeout: "SERVICE_IAM_TIMEOUT_MS",
  },
  catalog: {
    url: "SERVICE_CATALOG_URL",
    timeout: "SERVICE_CATALOG_TIMEOUT_MS",
  },
  inventory: {
    url: "SERVICE_INVENTORY_URL",
    timeout: "SERVICE_INVENTORY_TIMEOUT_MS",
  },
  cart: {
    url: "SERVICE_CART_URL",
    timeout: "SERVICE_CART_TIMEOUT_MS",
  },
  orders: {
    url: "SERVICE_ORDERS_URL",
    timeout: "SERVICE_ORDERS_TIMEOUT_MS",
  },
  ordersRead: {
    url: "SERVICE_ORDERS_READ_URL",
    timeout: "SERVICE_ORDERS_READ_TIMEOUT_MS",
  },
  payments: {
    url: "SERVICE_PAYMENTS_URL",
    timeout: "SERVICE_PAYMENTS_TIMEOUT_MS",
  },
  paymentsRead: {
    url: "SERVICE_PAYMENTS_READ_URL",
    timeout: "SERVICE_PAYMENTS_READ_TIMEOUT_MS",
  },
  fulfillment: {
    url: "SERVICE_FULFILLMENT_URL",
    timeout: "SERVICE_FULFILLMENT_TIMEOUT_MS",
  },
}

const servicesConfig: Record<ServiceName, ServiceConfig> = Object.fromEntries(
  (Object.keys(defaultServiceConfig) as ServiceName[]).map((service) => {
    const envKeys = serviceEnvKeys[service]
    const defaults = defaultServiceConfig[service]
    const url = env[envKeys.url] ?? defaults.url
    const timeoutFromEnv = env[envKeys.timeout]
    const timeoutMs =
      typeof timeoutFromEnv === "number" && timeoutFromEnv > 0
        ? timeoutFromEnv
        : defaults.timeoutMs
    return [service, { url, timeoutMs }]
  })
) as Record<ServiceName, ServiceConfig>

const serviceBasePathOverrides: Partial<Record<ServiceName, string>> = {
  ordersRead: "/api/orders/read",
  paymentsRead: "/api/payments/read",
}

function getServiceBasePath(service: ServiceName) {
  if (serviceBasePathOverrides[service]) {
    return serviceBasePathOverrides[service]!
  }
  return `/api/${service}`
}

export function getServiceConfig(service: ServiceName): ServiceConfig {
  return servicesConfig[service]
}

type FetchOptions = RequestInit & {
  service: ServiceName
  path: string
  searchParams?: Record<string, string | number | boolean | undefined>
  idempotency?: boolean
  timeoutMs?: number
}

export class ServiceRequestError extends Error {
  status: number
  service: ServiceName

  constructor(service: ServiceName, message: string, status: number) {
    super(message)
    this.name = "ServiceRequestError"
    this.status = status
    this.service = service
  }
}

export async function serviceFetch<TResponse>({
  service,
  path,
  searchParams,
  headers,
  idempotency,
  timeoutMs,
  signal,
  ...rest
}: FetchOptions): Promise<TResponse> {
  const config = getServiceConfig(service)
  if (!config?.url) {
    throw new Error(`Missing configuration for service "${service}".`)
  }

  const basePath = getServiceBasePath(service)
  const url = new URL(joinServicePath(basePath, path), config.url)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }

  const controller = new AbortController()
  let timedOut = false
  const timeoutDuration = timeoutMs ?? config.timeoutMs
  const timeoutHandle = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutDuration)

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener(
        "abort",
        () => controller.abort(signal.reason),
        { once: true }
      )
    }
  }

  const authToken = getServiceAuthToken()
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }
  if (authToken) {
    requestHeaders.set("Authorization", `Bearer ${authToken}`)
  }
  if (idempotency) {
    requestHeaders.set("Idempotency-Key", crypto.randomUUID())
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const errorMessage = await tryParseServiceError(response)
      throw new ServiceRequestError(service, errorMessage, response.status)
    }

    if (response.status === 204) {
      return undefined as TResponse
    }

    return (await response.json()) as TResponse
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (timedOut) {
        throw new ServiceRequestError(
          service,
          `Request to ${service} timed out after ${timeoutDuration}ms.`,
          504
        )
      }

      throw new ServiceRequestError(
        service,
        `Request to ${service} was aborted.`,
        499
      )
    }

    throw error
  } finally {
    clearTimeout(timeoutHandle)
  }
}

async function tryParseServiceError(response: Response) {
  try {
    const payload = await response.json()
    if (typeof payload.error === "string") return payload.error
    if (typeof payload.message === "string") return payload.message
  } catch {
    // ignore
  }

  return `Service ${response.status} error`
}

function joinServicePath(basePath: string, resourcePath: string) {
  const normalizedBase = basePath.endsWith("/")
    ? basePath.slice(0, -1)
    : basePath
  const normalizedResource = resourcePath.startsWith("/")
    ? resourcePath
    : `/${resourcePath}`
  return `${normalizedBase}${normalizedResource}`
}
