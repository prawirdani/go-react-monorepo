import type { TokenPair } from "@repo/schemas/auth";
import type { PaginatedResponseBody, ResponseBody } from "./response";

const RETRY_HEADER = "X-Api-Retried" as const;

type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface TokenProvider {
	getAccessToken(): Promise<string | null>;
	getRefreshToken(): Promise<string | null>;
}

interface FetchOptions extends RequestInit {
	/**
	 * Prevents the client from attaching an Authorization header.
	 *
	 * By default, authenticated requests automatically include the
	 * current access token when available.
	 */
	noAuth?: boolean;

	/**
	 * Skips the automatic access token refresh mechanism.
	 *
	 * Primarily used for refresh token requests themselves to prevent
	 * infinite refresh/retry loops when authentication fails.
	 */
	skipRefresh?: boolean;
}

/** Standard (non-paginated) request. */
type APIRequestFn = <T>(
	path: string,
	options?: Omit<FetchOptions, "method">,
) => Promise<ResponseBody<T>>;

/**
 * Paginated request. Kept as a distinct type/method rather than a
 * `paginated` flag on options, since the flag had no runtime effect
 * and was being spread into the underlying fetch init unused.
 *
 * If pagination ever needs real behavior (e.g. injecting `page`/`cursor`
 * query params, following `next` links), implement it in `makePaginatedVerb`
 * below rather than branching on a boolean in the shared verb factory.
 */
type PaginatedAPIRequestFn = <T>(
	path: string,
	options?: Omit<FetchOptions, "method">,
) => Promise<PaginatedResponseBody<T>>;

export interface APIClientConfig {
	baseURL: string;
	tokenProvider?: TokenProvider;
	refreshEndpoint: string;
	onTokenRefreshed?: (tokens: TokenPair) => Promise<void>; // Callback for token updates
	onTokenRefreshFailed?: () => void; // Callback for handling logout
}

export class APIClient {
	private refreshPromise: Promise<Response> | null = null; // refresh access token inflight promise
	private baseURL: string;
	private tokenProvider?: TokenProvider;
	private refreshEndpoint: string;
	private onTokenRefreshFailed?: () => void;
	private onTokenRefreshed?: (tokens: TokenPair) => Promise<void>;

	constructor(conf: APIClientConfig) {
		this.baseURL = conf.baseURL.replace(/\/$/, ""); // Remove trailing slash
		this.tokenProvider = conf.tokenProvider;
		this.refreshEndpoint = conf.refreshEndpoint;
		this.onTokenRefreshed = conf.onTokenRefreshed;
		this.onTokenRefreshFailed = conf.onTokenRefreshFailed;
	}

	public Get = this.makeVerb("GET");
	public Paginated = this.makeVerb("GET") as unknown as PaginatedAPIRequestFn; // Same as Get but with casted Paginated type
	public Post = this.makeVerb("POST");
	public Put = this.makeVerb("PUT");
	public Delete = this.makeVerb("DELETE");
	public Patch = this.makeVerb("PATCH");

	/** Fetch with refresh token interceptor. */
	public async Fetch(url: string, init?: FetchOptions): Promise<Response> {
		const options = await this.prepareOptions({
			...init,
			credentials: "include",
		});

		const response = await fetch(url, options);

		const { headers } = options;
		// Handle 401 with token refresh (only once)
		const isRetried = headers.get(RETRY_HEADER) === "true";
		if (
			response.status === 401 &&
			!init?.noAuth &&
			!isRetried &&
			!init?.skipRefresh
		) {
			const refreshed = await this.handleTokenRefresh();

			// retry the main fetch
			if (refreshed) {
				headers.set(RETRY_HEADER, "true");
				return await this.Fetch(url, {
					...options,
					headers,
				});
			}

			// Refresh failed, trigger unauthorized callback
			this.onTokenRefreshFailed?.();
		}

		if (!response.ok) {
			const errorBody = await response.json().catch((e) => e);
			throw errorBody;
		}

		return response;
	}

	// Utility methods
	public setTokenRetriever(tokenRetriever: TokenProvider): void {
		this.tokenProvider = tokenRetriever;
	}

	public setBaseURL(baseURL: string): void {
		this.baseURL = baseURL.replace(/\/$/, "");
	}

	public getBaseURL(): string {
		return this.baseURL;
	}

	public setOnUnauthorized(fn: () => void) {
		this.onTokenRefreshFailed = fn;
	}

	public setOnTokenRefreshed(fn: (tokens: TokenPair) => Promise<void>) {
		this.onTokenRefreshed = fn;
	}

	public async healthz() {
		// Fetch does not prefix baseURL (only makeVerb does), so build it here —
		// otherwise this hits the app's origin and gets the SPA's HTML fallback.
		const res = await this.Fetch(`${this.getBaseURL()}/api/healthz`);
		const resBody = (await res.json()) as {
			internal_mode: boolean;
			status: string;
		};

		return resBody;
	}

	/** Handle token refresh with concurrent request protection */
	private async handleTokenRefresh(): Promise<boolean> {
		// If already refreshing, wait for that promise
		if (this.refreshPromise) {
			const response = await this.refreshPromise;
			return response.ok;
		}

		// Immediate assignment creates the "lock"
		this.refreshPromise = (async () => {
			try {
				const headers = new Headers();
				if (this.tokenProvider) {
					const refreshToken = await this.tokenProvider.getRefreshToken();
					if (refreshToken) {
						headers.set("Authorization", `Bearer ${refreshToken}`);
					}
				}

				const response = await fetch(`${this.baseURL}${this.refreshEndpoint}`, {
					method: "POST",
					credentials: "include",
					headers: headers,
				});

				if (response.ok) {
					const contentType = response.headers.get("content-type");
					if (contentType?.includes("application/json")) {
						const resBody = (await response.json()) as ResponseBody<TokenPair>;
						this.onTokenRefreshed?.(resBody.data);
					}
				}

				return response;
			} finally {
				this.refreshPromise = null;
			}
		})();

		const finalResponse = await this.refreshPromise;
		return finalResponse?.ok ?? false;
	}

	private async prepareOptions(init: FetchOptions | undefined) {
		const headers = new Headers(init?.headers);

		const isFormData = init?.body instanceof FormData;
		if (init?.body && !isFormData && !headers.has("Content-Type")) {
			headers.set("Content-Type", "application/json");
		}

		// Inject token to Authorization Headers (non web base)
		if (!init?.noAuth && this.tokenProvider) {
			const accessToken = await this.tokenProvider.getAccessToken();
			if (accessToken) {
				headers.set("Authorization", `Bearer ${accessToken}`);
			}
		}

		return {
			...init,
			headers,
		};
	}

	private makeVerb(method: HTTPMethod): APIRequestFn {
		return async (path, options = {}) => {
			const res = await this.Fetch(this.baseURL + path, {
				method,
				...options,
			});

			return await res.json();
		};
	}
}
