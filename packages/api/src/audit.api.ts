import type { AuditEntry, AuditSearchQuery } from "@repo/schemas/audit";
import type { APIClient } from "./client";
import type { QueryMetaOnly, QueryableResponse } from "./response";

/**
 * `/api/audit` is confirmed to echo pagination only; its echo of applied
 * filter/sort is unconfirmed, so only the guaranteed slice is typed. Widen to
 * `QueryMeta<AuditFilter, AuditSortKey, true>` if the backend is confirmed to
 * echo them.
 */
export type AuditListMeta = QueryMetaOnly;

export class AuditAPI {
	private client: APIClient;

	constructor(client: APIClient) {
		this.client = client;
	}

	/*
	 * requires audit.read permission
	 *
	 * Query params: sort, order, page, limit, entity (comma-joined multi-select),
	 * actor (name or exact id), and date/from/to — `date` wins over `from`/`to`.
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

		return await this.client.Queryable<AuditEntry, AuditListMeta>(
			`/api/audit?${query}`,
		);
	}
}
