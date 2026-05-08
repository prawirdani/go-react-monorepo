// ─── Core type ───────────────────────────────────────────────────────────────

export type ErrorDescriptor<T extends string, TD = null> = {
	readonly code: T;
	message: string;
	details: TD;
};

// ─── Error map (single source of truth) ──────────────────────────────────────

type ErrorMap = {
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
	VALIDATION: Partial<Record<string, string[]>>;
	RESOURCE_NOT_FOUND: null;
	// Auth
	REQ_UNAUTHORIZED: null;
	REQ_FORBIDDEN: null;
	AUTH_CREDENTIALS: null;
	AUTH_EXPIRED: null;
	AUTH_INVALID_SESSION: null;
};

// ─── Derived types ────────────────────────────────────────────────────────────

export type APIError = {
	[K in keyof ErrorMap]: ErrorDescriptor<K, ErrorMap[K]>;
}[keyof ErrorMap];

export type APIErrorCodes = keyof ErrorMap;

// Named aliases are now just lookups — add only what you actually import elsewhere
export type ErrValidation<T = Record<string, string[]>> = ErrorDescriptor<
	"VALIDATION",
	Partial<Record<keyof T, string[]>>
>;

export function parseAPIError(err: unknown): APIError {
	if (isNetworkError(err)) {
		return {
			code: "NETWORK_ERROR",
			message:
				"Gagal terhubung ke server. Periksa koneksi internet Anda dan coba lagi.",
			details: null,
		};
	}
	if (isAPIErrorResponse(err)) return processAPIError(err.error);
	return {
		code: "UNKNOWN_ERROR",
		message: "Terjadi kesalahan. Silahkan ulangi beberapa saat lagi.",
		details: err,
	};
}

function isAPIErrorResponse(body: unknown): body is { error: APIError } {
	return (
		typeof body === "object" &&
		body !== null &&
		"error" in body &&
		typeof (body as { error: unknown }).error === "object" &&
		(body as { error: unknown }).error !== null &&
		"code" in (body as { error: object }).error &&
		typeof (body as { error: { code: unknown } }).error.code === "string"
	);
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

function processAPIError(err: APIError): APIError {
	const message = PrettyMessageDict[err.code];
	return message ? { ...err, message } : err;
}
