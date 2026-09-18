import { z } from "zod";

export const DEFAULT_LIMIT = 10;
export const LIMIT_OPTIONS = [10, 20, 50] as const;

/**
 * Paging fields shared by every search query. Each `.catch`es to a default, so
 * a hand-edited or garbage URL param falls back instead of throwing.
 */
export const paginationFields = {
	page: z.coerce.number().int().min(1).catch(1),
	limit: z.coerce.number().int().min(1).max(100).catch(DEFAULT_LIMIT),
} as const;

export type PaginationQuery = {
	page: number;
	limit: number;
};
