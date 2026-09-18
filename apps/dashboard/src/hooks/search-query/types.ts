import type { SortOrder } from "@repo/schemas/search-query"

/** The base shape every search query carries; domain filters are extra keys. */
export type SearchQuery = {
  page: number
  limit: number
  sort: string
  order: SortOrder
  [key: string]: unknown
}

/**
 * The slice of `Route.useNavigate()` the query concerns need. Deliberately
 * narrower than the router's generic navigate — call sites cast
 * `Route.useNavigate()` once (see the users route) rather than spreading `any`.
 */
export type SearchQueryNavigate = (options: {
  search: (prev: SearchQuery) => SearchQuery
}) => unknown
