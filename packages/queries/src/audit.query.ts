import type { AuditAPI } from "@repo/api";
import { queryOptions } from "@tanstack/react-query";

export function auditQueries(auditAPI: AuditAPI) {
	return {
		list: queryOptions({
			queryKey: ["audit", "list"],
			queryFn: () => auditAPI.listAuditEntry(),
			staleTime: 60 * 1000, // 1 minute
			retry: false,
		}),
	};
}
