"use server"

import "server-only"

import crypto from "node:crypto"

import { env as serverEnv } from "@/env/server"

export class GatewayRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "GatewayRequestError"
    this.status = status
  }
}

const gatewayBaseUrl =
  serverEnv.GATEWAY_BASE_URL ?? process.env.NEXT_PUBLIC_GATEWAY_BASE_URL

if (!gatewayBaseUrl) {
  throw new Error(
    "GATEWAY_BASE_URL (or NEXT_PUBLIC_GATEWAY_BASE_URL) is required to call backend services."
  )
}

const adminToken =
  serverEnv.GATEWAY_ADMIN_TOKEN ?? process.env.GATEWAY_ADMIN_TOKEN ?? ""

type FetchOptions = RequestInit & {
  path: string
  searchParams?: Record<string, string | number | undefined>
  idempotency?: boolean
}

export async function gatewayFetch<TResponse>({
  path,
  searchParams,
  headers,
  idempotency,
  ...rest
}: FetchOptions): Promise<TResponse> {
  const url = new URL(path, gatewayBaseUrl)
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(idempotency ? { "Idempotency-Key": crypto.randomUUID() } : {}),
      ...headers,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const errorMessage = await tryParseError(response)
    throw new GatewayRequestError(errorMessage, response.status)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}

async function tryParseError(res: Response) {
  try {
    const payload = await res.json()
    if (typeof payload.error === "string") return payload.error
    if (typeof payload.message === "string") return payload.message
  } catch {
    // ignore
  }

  return `Gateway error (${res.status})`
}
