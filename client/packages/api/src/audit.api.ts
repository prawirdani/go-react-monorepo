import type {
	AuditEntry,
	AuditFilter,
	AuditSearchQuery,
	AuditSortKey,
} from "@repo/schemas/audit";
import type { APIClient } from "./client";
import type { QueryableResponse, QueryMeta } from "./response";

/** `/api/audit` echoes the applied filter, sort, and pagination. */
export type AuditListMeta = QueryMeta<AuditFilter, AuditSortKey, true>;

export class AuditAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	/*
	 * requires audit.read permission
	 *
	 * Query params: sort, order, page, limit, entity (comma-joined multi-select),
	 * actor (name or exact id), and date/from/to read in the `tz` zone — the
	 * bounds are bare calendar days, and `date` wins over `from`/`to`.
	 */
	async listAuditEntry(
		params: AuditSearchQuery,
	): Promise<QueryableResponse<AuditEntry, AuditListMeta>> {
		const query = new URLSearchParams({
			page: String(params.page),
			limit: String(params.limit),
			sort: params.sort,
			order: params.order,
		});
		// Multi-select filter: comma-joined, omitted when empty (never `entity=`).
		if (params.entity.length) query.set("entity", params.entity.join(","));
		if (params.actor) query.set("actor", params.actor);

		// `date` wins over `from`/`to`: send one form or the other, never both.
		if (params.date) {
			query.set("date", params.date);
		} else {
			if (params.from) query.set("from", params.from);
			if (params.to) query.set("to", params.to);
		}

		// `tz` names the zone the bare dates are read in. The backend falls back to UTC
		// when it is absent or unknown, so only send it alongside a bound.
		if (params.tz && (params.date || params.from || params.to)) {
			query.set("tz", params.tz);
		}

		return await this.client.Queryable<AuditEntry, AuditListMeta>(
			`/api/audit?${query}`,
		);
	}
}
