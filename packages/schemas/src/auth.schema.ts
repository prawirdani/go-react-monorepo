import { z } from "zod";

export const loginSchema = z.object({
	email: z.email("Format email tidak valid").nonempty("Email wajib diisi."),
	password: z.string().nonempty("Kata sandi wajib diisi."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type TokenPair = {
	accessToken: string;
	refreshToken: string;
};
