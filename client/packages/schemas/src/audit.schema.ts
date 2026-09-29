import { z } from "zod";
import "./error-map";
import {
	type DateQuery,
	dateFields,
	dateStripDefaults,
} from "./search-query/date";
import { filteringStripDefaults } from "./search-query/filtering";
import { paginationFields } from "./search-query/pagination";
import { sortingFields } from "./search-query/sorting";

type JsonObject = Record<string, unknown>;

/** Enriched actor on an entry; null when the action was system-initiated. */
export type AuditActor = {
	id: string;
	name: string;
};

/** Extra context attached to an entry; the UI reads these defensively. */
export type AuditMeta = {
	actor_role: string;
	ip_addr: string;
	request_id: string;
	session_id: string;
	user_agent: string;
};

export interface AuditEntry {
	id: number;
	actor: AuditActor | null;
	action: string;
	entity: string;
	entity_id: string;
	prev: JsonObject | null;
	next: JsonObject | null;
	meta: AuditMeta | null;
	created_at: string;
}

// Search query for the audit log. Every field `.catch`es to a default so a
// hand-edited/garbage URL param falls back instead of throwing at the router.
// Params mirror the backend: ?sort=&order=&page=&limit=&entity=&actor=&date=&from=&to=&tz=
// — entity is multi-select (comma-joined server-side); actor is free-text (a
// name, or an exact id); date/from/to follow the cross-domain convention in
// `search-query/date.ts` (`date` wins over `from`/`to`).
export const AUDIT_SORT_KEYS = ["created_at"] as const;
export type AuditSortKey = (typeof AUDIT_SORT_KEYS)[number];

export const AUDIT_ENTITIES = [
	"session",
	"user",
	"registration_token",
] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

/** The applied filter values the backend echoes back in `meta.filter`. */
export type AuditFilter = {
	entity: AuditEntity[];
	actor: string;
} & DateQuery;

const auditFilters = {
	entity: z.array(z.enum(AUDIT_ENTITIES)).catch([]),
};

// NOTE: `sortingFields` emits lowercase `asc|desc`; the sample request showed
// `order=DESC`. Kept lowercase for consistency with `/api/users` (verified
// working) — flip `SORT_ORDERS` in `search-query/sorting.ts` if the server is
// strict about casing.
export const auditSearchQuerySchema = z.object({
	...paginationFields,
	...sortingFields(AUDIT_SORT_KEYS, "created_at"),
	...dateFields,
	...auditFilters,
	actor: z.string().catch(""),
});

export type AuditSearchQuery = z.infer<typeof auditSearchQuerySchema>;

export const auditSearchQueryStripDefaults = {
	...filteringStripDefaults(auditFilters),
	...dateStripDefaults,
	actor: "",
};

/**
 * The home route validates its search, so every `to="/"` link and redirect has
 * to supply one. These are that route's own defaults — every field `.catch`es,
 * so `parse({})` cannot throw.
 */
export const AUDIT_SEARCH_DEFAULTS = auditSearchQuerySchema.parse({});
