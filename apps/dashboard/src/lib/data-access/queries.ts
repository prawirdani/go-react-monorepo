import { auditQueries, userQueries } from "@repo/queries"
import { auditAPI, authAPI, userAPI } from "./api"

export const { currentUser, listUser } = userQueries(authAPI, userAPI)
export const { auditEntries } = auditQueries(auditAPI)
