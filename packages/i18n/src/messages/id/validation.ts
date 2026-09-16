import type en from "../en/validation";
import type { DeepStringify } from "../types";

const validation: DeepStringify<typeof en> = {
	confirmPassword: {
		required: "Konfirmasi kata sandi wajib diisi",
	},
	email: {
		invalid: "Format email tidak valid",
		required: "Email wajib diisi",
	},
	invalidFormat: "Format tidak valid",
	invalidType: "Nilai tidak valid",
	invalidValue: "Nilai tidak valid",
	name: {
		required: "Nama wajib diisi",
	},
	newPassword: {
		min: "Minimum 8 karakter",
		required: "Kata sandi baru wajib diisi",
	},
	password: {
		mismatch: "Konfirmasi kata sandi tidak cocok",
		required: "Kata sandi wajib diisi",
	},
	profilePicture: {
		maxSize: "Ukuran maksimum adalah 2MB",
		required: "Mohon unggah foto profil",
		type: "Jenis foto yang diizikan adalah: JPEG, PNG dan WebP",
	},
	required: "Wajib diisi",
	reset_password_token: {
		required: "Token reset password wajib diisi",
	},
	registration_token: {
		required: "Token registrasi wajib diisi",
	},
	tooBig: "Nilai terlalu panjang",
	tooSmall: "Nilai terlalu pendek",
};

export default validation;
