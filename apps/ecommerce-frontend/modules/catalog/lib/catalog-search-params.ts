import {
  createSearchParamsCache,
  inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server"

export const catalogSearchParsers = {
  q: parseAsString.withDefault(""),
  sort: parseAsStringEnum(["featured", "new", "price-asc", "price-desc"]).withDefault("featured"),
  tags: parseAsArrayOf(parseAsString, { separator: "," }).withDefault([]),
}

export const catalogSearchParamsCache = createSearchParamsCache(catalogSearchParsers)

export type CatalogSearchState = inferParserType<typeof catalogSearchParsers>

export function getCatalogSearchState(
  searchParams: Record<string, string | string[] | undefined> | URLSearchParams | undefined
): CatalogSearchState {
  return catalogSearchParamsCache.parse(searchParams ?? {})
}
