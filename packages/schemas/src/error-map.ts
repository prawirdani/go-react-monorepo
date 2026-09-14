import { z } from "zod";

/**
 * Locale-agnostic global error map. It emits message *keys* (not translations)
 * so any zod issue the schemas don't explicitly key still resolves to something
 * the display layer can translate, instead of leaking zod's English text.
 */
z.config({
	customError: (issue) => {
		switch (issue.code) {
			case "invalid_type":
				return {
					message:
						issue.input === undefined
							? "validation.required"
							: "validation.invalidType",
				};
			case "too_small":
				return { message: "validation.tooSmall" };
			case "too_big":
				return { message: "validation.tooBig" };
			case "invalid_format":
				return {
					message:
						issue.format === "email"
							? "validation.email.invalid"
							: "validation.invalidFormat",
				};
			case "invalid_value":
				return { message: "validation.invalidValue" };
			default:
				return undefined;
		}
	},
});
