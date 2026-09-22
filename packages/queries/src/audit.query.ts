import type { AuditAPI } from "@repo/api";
import type { AuditSearchQuery } from "@repo/schemas/audit";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { AUDIT_KEY } from "./keys";

export function auditQueries(auditAPI: AuditAPI) {
	return {
		auditEntries: (params: AuditSearchQuery) =>
			queryOptions({
				queryKey: [AUDIT_KEY, params],
				queryFn: () => auditAPI.listAuditEntry(params),
				placeholderData: keepPreviousData, // keep old page visible while the next loads
				retry: false,
				staleTime: 60 * 1000, // 1 minute
			}),
	};
}
