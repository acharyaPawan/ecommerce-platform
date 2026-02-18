export const ALLOWED_REMOTE_IMAGE_HOSTS = [
  "images.unsplash.com",
  "loremflickr.com",
] as const

export function isAllowedRemoteImageHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase()
  return ALLOWED_REMOTE_IMAGE_HOSTS.some(
    (allowedHost) =>
      normalized === allowedHost || normalized.endsWith(`.${allowedHost}`)
  )
}
