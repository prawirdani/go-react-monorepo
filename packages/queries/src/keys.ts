/**
 * Query-key roots, in one place so an invalidation target cannot drift from the
 * readers it is meant to refresh. `user.query.ts` and `auth.query.ts` both need
 * these, and importing them from each other would be a cycle.
 */
export const AUTH_KEY = "auth" as const;
export const USER_KEY = "users" as const;
export const AUDIT_KEY = "audit" as const;

/**
 * Session lists. Deliberately not nested under `AUTH_KEY`: identity
 * invalidation (`["auth"]`) would then wipe every session list, and revoking a
 * session would refetch the session identity.
 */
export const SESSIONS_KEY = "sessions" as const;
