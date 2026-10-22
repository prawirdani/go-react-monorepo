import { z } from "zod";
import "./error-map";
import { filteringStripDefaults } from "./search-query/filtering";
import { paginationFields } from "./search-query/pagination";
import { sortingFields } from "./search-query/sorting";

const GENDERS = ["M", "F", "O"] as const;
const ROLES = ["admin", "user"] as const;
const DELETED_STATES = ["active", "deleted"] as const;

// The group opens on live accounts. This is the filter's schema default, so it
// behaves like `page=1` / `sort=created_at`: absent in the URL, re-applied on
// every parse, and the status group always holds at least one value.
export const DEFAULT_DELETED_STATES: DeletedState[] = ["active"];

export type Gender = (typeof GENDERS)[number];
export type Role = (typeof ROLES)[number];
export type DeletedState = (typeof DELETED_STATES)[number];

// Gender display labels live in the i18n catalog (app.profile.genderOptions):
// packages/schemas carries data shapes, not user-facing copy.

export type User = {
	id: string;
	name: string;
	role: Role;
	email: string;
	email_verified_at: string | null;
	gender: Gender | null;
	phone: string | null;
	profile_picture: string | null;
	created_at: string;
	updated_at: string;
	/** RFC3339 timestamp, null when the account is live (not soft-deleted). */
	deleted_at: string | null;
};

export const updateUserSchema = z.object({
	name: z.string().nonempty("validation.name.required"),
	phone: z.string().nullable(),
	gender: z.enum(GENDERS).nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Search query for the admin users table. Every field `.catch`es to a default so
// a hand-edited/garbage URL param falls back instead of throwing at the router.
// Params mirror the backend: ?sort=&order=&page=&limit=&role=&gender=&deleted_at=
// — role, gender and deleted_at are multi-select (comma-joined server-side;
// gender is UPPERCASE; deleted_at values are `active`/`deleted`). An absent
// filter means no filter at all, so the backend lists every row; the UI starts
// with deleted_at=active checked, which asks for live accounts only.
export const USER_SORT_KEYS = ["id", "created_at", "updated_at"] as const;
export type UserSortKey = (typeof USER_SORT_KEYS)[number];

/**
 * The applied filter values the backend echoes back in `meta.filter`. Optional
 * for the same reason as `AuditFilter`: Go marshals them `omitempty`.
 */
export type UserFilter = {
	role?: Role[];
	gender?: Gender[];
	deleted_at?: DeletedState[];
};

const userFilters = {
	role: z.array(z.enum(ROLES)).catch([]),
	gender: z.array(z.enum(GENDERS)).catch([]),
	deleted_at: z.array(z.enum(DELETED_STATES)).catch(DEFAULT_DELETED_STATES),
};

export const userSearchQuerySchema = z.object({
	...paginationFields,
	...sortingFields(USER_SORT_KEYS, "created_at"),
	...userFilters,
});

export type UserSearchQuery = z.infer<typeof userSearchQuerySchema>;

/**
 * Each filter's default for the URL stripper. `deleted_at` is deliberately
 * absent: it opens pre-selected, so it belongs in the URL like any other live
 * filter instead of being implied by a schema default.
 */
export const userSearchQueryStripDefaults = filteringStripDefaults({
	role: userFilters.role,
	gender: userFilters.gender,
});

const MAX_PROFILE_PIC_SIZE = 2 * 1024 * 1024; // 2MB
export const profilePictureSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0, "validation.profilePicture.required")
	.refine((file) => file.size <= MAX_PROFILE_PIC_SIZE, {
		message: "validation.profilePicture.maxSize",
	})
	.refine(
		(file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
		{
			message: "validation.profilePicture.type",
		},
	);
