export type ValidationErrorDetails = Partial<Record<string, string[]>>; // Server side validation error, "key/field": ["errors"].

export type ErrorDescriptor<T extends string, TD = null> = {
	readonly code: T;
	message: string;
	details: TD;
};

export type ErrorMap = {
	// Client/Fetch
	NETWORK_ERROR: null;
	UNKNOWN_ERROR: unknown;

	// General server
	MULTIPART_FORM: null;
	BODY_TOO_LARGE: null;
	REQ_RATE_LIMIT: null;
	HANDLER_NOT_FOUND: null;
	HANDLER_METHOD_NOT_ALLOWED: null;
	INVALID_QUERY_PARAMETERS: { param: string; value: string; reason: string }[];
	INVALID_PARAMETER: { parameter: string; value: string };
	INTERNAL: null;
	SERVER_TIMEOUT: null;
	REQ_MALFORMED_JSON: null;
	VALIDATION: ValidationErrorDetails;
	RESOURCE_NOT_FOUND: null;

	// Upload
	UPLOAD_MAX_SIZE: { max_bytes: number; received_bytes: number };
	UPLOAD_MIME_TYPES: {
		claimed_mime: string;
		actual_mime: string;
		allowed_mimes: string[];
	};
	UPLOAD_INVALID: never;

	// User domain errors
	USER_EMAIL_CONFLICT: null;
	USER_VALIDATION: null;

	// Auth
	REQ_UNAUTHORIZED: null;
	REQ_FORBIDDEN: null;
	AUTH_CREDENTIALS: null;
	AUTH_EXPIRED: null;
	AUTH_INVALID: null;
	AUTH_INVALID_SESSION: null;
	AUTH_INVALID_RECOV_TOKEN: null;
	AUTH_INVALID_REGISTRATION_TOKEN: null;
	AUTH_RECOVERY_THROTTLED: {
		allowed: boolean;
		/** ISO 8601 date-time when another request is allowed. */
		retry_after: string;
	};
};

export type APIError = {
	[K in keyof ErrorMap]: ErrorDescriptor<K, ErrorMap[K]>;
}[keyof ErrorMap];

export type APIErrorCodes = keyof ErrorMap;

// Named aliases are now just lookups, add only what you actually import elsewhere.
export type ErrValidation<T = Record<string, string[]>> = ErrorDescriptor<
	"VALIDATION",
	Partial<Record<keyof T, string[]>>
>;

type ServerErrorEnvelope = { code: string; message: string; details: unknown };

function extractErrorEnvelope(body: unknown): ServerErrorEnvelope | null {
	if (typeof body !== "object" || body === null) return null;
	const candidate =
		"error" in body &&
		typeof (body as { error?: unknown }).error === "object" &&
		(body as { error?: unknown }).error !== null
			? (body as { error: unknown }).error
			: body;
	if (typeof candidate !== "object" || candidate === null) return null;
	if (typeof (candidate as { code?: unknown }).code !== "string") return null;
	return candidate as unknown as ServerErrorEnvelope;
}

export function parseAPIError(err: unknown): APIError {
	if (isNetworkError(err)) {
		return {
			code: "NETWORK_ERROR",
			message:
				"Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.",
			details: null,
		};
	}
	const envelope = extractErrorEnvelope(err);
	if (envelope) return processAPIError(envelope);
	return {
		code: "UNKNOWN_ERROR",
		message: "Terjadi kesalahan. Silahkan ulangi beberapa saat lagi.",
		details: err,
	};
}

function isNetworkError(err: unknown): err is TypeError {
	return (
		err instanceof TypeError &&
		(err.message === "Failed to fetch" ||
			err.message === "NetworkError when attempting to fetch resource.")
	);
}

const PrettyMessageDict: Partial<Record<APIErrorCodes, string>> = {
	SERVER_TIMEOUT: "Server sedang sibuk, coba lagi beberapa saat.",
};

function processAPIError(err: ServerErrorEnvelope): APIError {
	let details: unknown = err.details ?? null;
	// Backend VALIDATION details = { errors: [...], details: { field: [msg] } }.
	// The app consumes only the field-message map; unwrap it here so callers
	// keep passing e.details straight into setFormErrors.
	if (
		err.code === "VALIDATION" &&
		typeof details === "object" &&
		details !== null &&
		"details" in details
	) {
		details = (details as { details: unknown }).details;
	}
	const message = PrettyMessageDict[err.code as APIErrorCodes] ?? err.message;
	return { code: err.code, message, details } as unknown as APIError;
}
