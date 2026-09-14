import { z } from "zod";
import "./error-map";

export const loginSchema = z.object({
	email: z
		.email("validation.email.invalid")
		.nonempty("validation.email.required"),
	password: z.string().nonempty("validation.password.required"),
});

const newPasswordSchema = z
	.string()
	.nonempty("validation.newPassword.required")
	.min(8, { error: "validation.newPassword.min" });

export const changePasswordSchema = z
	.object({
		password: z.string().nonempty("validation.password.required"),
		new_password: newPasswordSchema,
		new_password_confirmation: z
			.string()
			.nonempty("validation.confirmPassword.required"),
	})
	.refine((data) => data.new_password === data.new_password_confirmation, {
		message: "validation.password.mismatch",
		path: ["new_password_confirmation"],
	});

export const recoverPasswordSchema = z.object({
	email: z
		.email("validation.email.invalid")
		.nonempty("validation.email.required"),
});

export const resetPasswordSchema = z
	.object({
		token: z.string().nonempty("validation.token.required"),
		new_password: newPasswordSchema,
		new_password_confirmation: z
			.string()
			.nonempty("validation.confirmPassword.required"),
	})
	.refine((data) => data.new_password === data.new_password_confirmation, {
		message: "validation.password.mismatch",
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
