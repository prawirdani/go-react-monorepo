import { z } from "zod";
import "./error-map";

export type TokenPair = {
	access_token: string;
	refresh_token: string;
};

/**
 * OpaqueTokenMeta is response shape for get Registration Token and Reset Password Token
 */
export type OpaqueTokenMeta = {
	expires_at: string;
	used_at: string | null;
};

const newPasswordSchema = z
	.string()
	.nonempty("validation.newPassword.required")
	.min(8, { error: "validation.newPassword.min" });

export const registerSchema = z.object({
	name: z.string().nonempty("validation.name.required"),
	email: z
		.email("validation.email.invalid")
		.nonempty("validation.email.required"),
});

export const completeRegistrationSchema = z
	.object({
		token: z.string().nonempty("validation.registration_token.required"),
		password: z
			.string()
			.nonempty("validation.password.required")
			.min(8, { error: "validation.newPassword.min" }),
		password_confirmation: z
			.string()
			.nonempty("validation.confirmPassword.required"),
	})
	.refine((data) => data.password === data.password_confirmation, {
		message: "validation.password.mismatch",
		path: ["password_confirmation"],
	});

export const loginSchema = z.object({
	email: z
		.email("validation.email.invalid")
		.nonempty("validation.email.required"),
	password: z.string().nonempty("validation.password.required"),
});

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
		token: z.string().nonempty("validation.reset_password_token.required"),
		new_password: newPasswordSchema,
		new_password_confirmation: z
			.string()
			.nonempty("validation.confirmPassword.required"),
	})
	.refine((data) => data.new_password === data.new_password_confirmation, {
		message: "validation.password.mismatch",
		path: ["new_password_confirmation"],
	});

export type RegisterInput = z.infer<typeof registerSchema>;
export type CompleteRegistrationInput = z.infer<
	typeof completeRegistrationSchema
>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecoverPasswordInput = z.infer<typeof recoverPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
