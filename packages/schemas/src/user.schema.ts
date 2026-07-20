import { z } from "zod";

const GENDERS = ["M", "F", "O"] as const;

export type Gender = (typeof GENDERS)[number];

export const GenderLabels: Record<Gender, string> = {
	M: "Laki-laki",
	F: "Perempuan",
	O: "Lainnya",
};

export type User = {
	id: string;
	name: string;
	email: string;
	email_verified_at: string | null;
	gender: Gender | null;
	phone: string | null;
	profile_picture: string | null;
	created_at: string;
	updated_at: string;
};

export const updateUserSchema = z.object({
	name: z.string().nonempty("Nama wajib diisi"),
	phone: z.string().nullable(),
	gender: z.enum(GENDERS).nullable(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

const MAX_PROFILE_PIC_SIZE = 2 * 1024 * 1024; // 2MB
export const profilePictureSchema = z
	.instanceof(File)
	.refine((file) => file.size > 0, "Mohon unggah foto profil")
	.refine((file) => file.size <= MAX_PROFILE_PIC_SIZE, {
		message: "Ukuran maksimum adalah 2MB",
	})
	.refine(
		(file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type),
		{
			message: "Jenis foto yang diizikan adalah: JPEG, PNG dan WebP",
		},
	);
