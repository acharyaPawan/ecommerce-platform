import { z } from "zod"

type HttpOptions<TSchema extends z.ZodTypeAny | undefined = undefined> = RequestInit & {
  schema?: TSchema
}

export async function httpFetch<TOutput = unknown>(
  input: RequestInfo | URL,
  { schema, ...init }: HttpOptions<z.ZodTypeAny | undefined> = {}
): Promise<TOutput> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const message = await safeReadText(response)
    throw new Error(message || `Request failed with status ${response.status}`)
  }

  const data = (await response.json().catch(() => ({}))) as unknown

  if (schema) {
    return schema.parse(data) as TOutput
  }

  return data as TOutput
}

async function safeReadText(response: Response) {
  try {
    return await response.text()
  } catch {
    return ""
  }
}
