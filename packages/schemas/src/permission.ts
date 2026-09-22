// Full catalog of permissions the backend defines (rbac.Permission).
// This is a hand-maintained MIRROR of the backend, not an enforcer — the server
// owns and enforces authorization. It exists only for compile-time safety and
// autocomplete on `can(perm)` call sites. When the backend adds/renames a
// permission, sync this list. See AGENTS.md "Backend Compatibility".
export const PERMISSIONS = [
	"audit.read",
	"auth.change-password",
	"auth.register-user",
	"auth.revoke-user-sessions",
	"auth.view-user-sessions",
	"user.delete",
	"user.read",
	"user.update",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
