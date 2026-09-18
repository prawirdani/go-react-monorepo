import { auditQueries, authQueries, userQueries } from "@repo/queries"
import { auditAPI, authAPI, userAPI } from "./api"

export const { getSession } = authQueries(authAPI)
export const { listUser } = userQueries(userAPI)
export const { auditEntries } = auditQueries(auditAPI)
