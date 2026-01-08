import { AsyncLocalStorage } from "node:async_hooks"

type ServiceAuthContextValue = {
  authToken?: string
}

const serviceAuthStorage = new AsyncLocalStorage<ServiceAuthContextValue>()

export function getServiceAuthToken(): string | undefined {
  return serviceAuthStorage.getStore()?.authToken
}

export function withServiceAuthToken<T>(
  token: string | null | undefined,
  callback: () => T
): T {
  return serviceAuthStorage.run(
    {
      authToken: token ?? undefined,
    },
    callback
  )
}

export function setServiceAuthToken(token: string | null | undefined): void {
  const normalizedToken = token ?? undefined
  const store = serviceAuthStorage.getStore()
  if (store) {
    store.authToken = normalizedToken
    return
  }

  serviceAuthStorage.enterWith({
    authToken: normalizedToken,
  })
}

export function clearServiceAuthToken(): void {
  setServiceAuthToken(undefined)
}
