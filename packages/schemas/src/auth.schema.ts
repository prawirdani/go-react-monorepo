import { z } from "zod";

export const loginSchema = z.object({
	email: z.email("Format email tidak valid").nonempty("Email wajib diisi"),
	password: z.string().nonempty("Kata sandi wajib diisi"),
});

const newPasswordSchema = z
	.string()
	.nonempty("Kata sandi baru wajib diisi")
	.min(8, { error: "Minimum 8 karakter" });

export const changePasswordSchema = z
	.object({
		password: z.string().nonempty("Kata sandi wajib diisi"),
		new_password: newPasswordSchema,
		new_password_confirmation: z
			.string()
			.nonempty("Konfirmasi kata sandi wajib diisi"),
	})
	.refine((data) => data.new_password === data.new_password_confirmation, {
		message: "Konfirmasi kata sandi tidak cocok",
		path: ["new_password_confirmation"],
	});

export const recoverPasswordSchema = z.object({
	email: z.email("Format email tidak valid").nonempty("Email wajib diisi"),
});

export const resetPasswordSchema = z
	.object({
		token: z.string().nonempty("Token reset password wajib diisi"),
		new_password: newPasswordSchema,
		new_password_confirmation: z
			.string()
			.nonempty("Konfirmasi kata sandi wajib diisi"),
	})
	.refine((data) => data.new_password === data.new_password_confirmation, {
		message: "Konfirmasi kata sandi tidak cocok",
		path: ["new_password_confirmation"],
	});

export type TokenPair = {
	access_token: string;
	refresh_token: string;
};
export type LoginInput = z.infer<typeof loginSchema>;
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
// API payloads exclude client-side new_password_confirmation (form schema only)
export type ChangePasswordInput = {
	password: string;
	new_password: string;
};
export type ResetPasswordInput = {
	token: string;
	new_password: string;
};
export type PasswordRecoveryToken = {
	expires_at: string;
	used_at: string | null;
};
