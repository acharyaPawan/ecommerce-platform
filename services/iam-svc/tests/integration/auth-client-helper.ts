import type { BetterFetch } from "@better-fetch/fetch";

export type AuthClient = typeof import("../../src/lib/auth-client")["authClient"];

export type AuthClientHarness = {
  authClient: AuthClient;
  restoreFetch: () => void;
  cookieJar: CookieJar;
};

export async function setupAuthClientHarness(): Promise<AuthClientHarness> {
  const originalFetch = globalThis.fetch;
  const jar = new CookieJar();
  const wrappedFetch = createCookieFetch(originalFetch, jar);
  globalThis.fetch = wrappedFetch as typeof fetch;

  const { authClient } = await import("../../src/lib/auth-client");

  return {
    authClient,
    cookieJar: jar,
    restoreFetch: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

class CookieJar {
  private readonly store = new Map<string, Map<string, string>>();

  getCookieHeader(url: URL): string | undefined {
    const bucket = this.store.get(url.host);
    if (!bucket || bucket.size === 0) {
      return undefined;
    }
    return Array.from(bucket.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  storeFromResponse(url: URL, headers: Headers): void {
    for (const raw of getSetCookies(headers)) {
      this.storeCookie(url.host, raw);
    }
  }

  private storeCookie(host: string, raw: string): void {
    const [nameValue, ...attributes] = raw.split(";");
    const [name, ...valueParts] = nameValue.trim().split("=");
    if (!name) {
      return;
    }
    const value = valueParts.join("=") ?? "";
    const attrMap = attributes.reduce<Record<string, string>>((acc, attr) => {
      const [key, ...rest] = attr.trim().split("=");
      if (key) {
        acc[key.toLowerCase()] = rest.join("=") ?? "";
      }
      return acc;
    }, {});

    const targetBucket = this.store.get(host) ?? new Map<string, string>();
    const maxAge = attrMap["max-age"];
    const expires = attrMap["expires"];
    if (maxAge && Number(maxAge) <= 0) {
      targetBucket.delete(name);
    } else if (expires && Date.parse(expires) <= Date.now()) {
      targetBucket.delete(name);
    } else {
      targetBucket.set(name, value);
    }

    if (targetBucket.size > 0) {
      this.store.set(host, targetBucket);
    } else {
      this.store.delete(host);
    }
  }
}

function getSetCookies(headers: Headers): string[] {
  const experimental = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof experimental === "function") {
    return experimental.call(headers) ?? [];
  }
  const header = headers.get("set-cookie");
  return header ? [header] : [];
}

function createCookieFetch(target: typeof fetch, jar: CookieJar): typeof fetch | BetterFetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    const cookieHeader = jar.getCookieHeader(url);
    if (cookieHeader) {
      const existing = headers.get("cookie");
      headers.set("cookie", existing ? `${existing}; ${cookieHeader}` : cookieHeader);
    }

    const proxiedRequest = new Request(request, { headers });
    const response = await target(proxiedRequest);
    jar.storeFromResponse(url, response.headers);
    return response;
  };
}
