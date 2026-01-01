export * from "./auth/index.js";

// Core utilities stub. Add logger/env helpers here later.
export function notImplemented(feature: string): never {
  throw new Error(`Feature not implemented: ${feature}`);
}
