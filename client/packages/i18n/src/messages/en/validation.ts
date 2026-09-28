export default {
	confirmPassword: {
		required: "Password confirmation is required",
	},
	email: {
		invalid: "Invalid email format",
		required: "Email is required",
	},
	invalidFormat: "Invalid format",
	invalidType: "Invalid value",
	invalidValue: "Invalid value",
	name: {
		required: "Name is required",
	},
	newPassword: {
		min: "Minimum 8 characters",
		required: "New password is required",
	},
	password: {
		mismatch: "Password confirmation does not match",
		required: "Password is required",
	},
	profilePicture: {
		maxSize: "Maximum size is 2MB",
		required: "Please upload a profile picture",
		type: "Allowed image types are JPEG, PNG and WebP",
	},
	required: "This field is required",
	reset_password_token: {
		required: "Password reset token is required",
	},
	registration_token: {
		required: "Registration token is required",
	},
	tooBig: "Value is too long",
	tooSmall: "Value is too short",
} as const;
