// export type UserRole = "admin" | "cashier";
export type User = {
	id: string;
	name: string;
	email: string;
	// role: UserRole;
	phone: string | null;
	profile_image: string | null;
	created_at: string;
	updated_at: string;
};
