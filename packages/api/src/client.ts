import type { TokenPair } from "@repo/schemas/auth";
import type { APIPaginatedResponse, APIResponse } from "./response";

const RETRY_HEADER = "X-Api-Retried" as const;

type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface TokenProvider {
	getAccessToken(): Promise<string | null>;
	getRefreshToken(): Promise<string | null>;
}

interface FetchOptions extends RequestInit {
	withAuth?: boolean;
	skipRefresh?: boolean; // Prevent infinite refresh loops
}

type APIRequestFn = {
	<T>(
		path: string,
		options: Omit<FetchOptions, "method"> & { paginated: true },
	): Promise<APIPaginatedResponse<T>>;
	<T>(
		path: string,
		options?: Omit<FetchOptions, "method"> & { paginated?: false },
	): Promise<APIResponse<T>>;
};

export interface APIClientConfig {
	baseURL: string;
	tokenProvider?: TokenProvider;
	refreshEndpoint: string;
	onTokenRefreshed?: (tokens: TokenPair) => void; // Callback for token updates
	onTokenRefreshFailed?: () => void; // Callback for handling logout
}

export class APIClient {
	private baseURL: string;
	private tokenProvider?: TokenProvider;
	private refreshEndpoint: string;
	private refreshPromise: Promise<Response> | null = null;
	private onTokenRefreshFailed?: () => void;
	private onTokenRefreshed?: (tokens: TokenPair) => void;

	constructor(conf: APIClientConfig) {
		this.baseURL = conf.baseURL.replace(/\/$/, ""); // Remove trailing slash
		this.tokenProvider = conf.tokenProvider;
		this.refreshEndpoint = conf.refreshEndpoint;
		this.onTokenRefreshed = conf.onTokenRefreshed;
		this.onTokenRefreshFailed = conf.onTokenRefreshFailed;
	}

	public Get = this.makeVerb("GET");
	public Post = this.makeVerb("POST");
	public Put = this.makeVerb("PUT");
	public Delete = this.makeVerb("DELETE");
	public Patch = this.makeVerb("PATCH");

	/** Fetch with refresh token interceptor. */
	public async Fetch(url: string, init?: FetchOptions): Promise<Response> {
		const options = await this.prepareOptions(init);

		const response = await fetch(url, options);

		const { headers } = options;
		// Handle 401 with token refresh (only once)
		const isRetried = headers.get(RETRY_HEADER) === "true";
		if (
			response.status === 401 &&
			init?.withAuth &&
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

		return response;
	}

	// Utility methods
	public setTokenRetriever(tokenRetriever: TokenProvider): void {
		this.tokenProvider = tokenRetriever;
	}

	public setBaseURL(baseURL: string): void {
		this.baseURL = baseURL.replace(/\/$/, "");
	}

	public setOnUnauthorized(fn: () => void) {
		this.onTokenRefreshFailed = fn;
	}

	public setOnTokenRefreshed(fn: (tokens: TokenPair) => void) {
		this.onTokenRefreshed = fn;
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
						const resBody = (await response.json()) as APIResponse<TokenPair>;
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

		// Inject token to Authorization Headers (mobile case)
		if (init?.withAuth && this.tokenProvider) {
			const accessToken = await this.tokenProvider.getAccessToken();
			if (accessToken) {
				headers.set("Authorization", `Bearer ${accessToken}`);
			}
		}

		return {
			...init,
			headers,
			credentials: init?.withAuth ? "include" : init?.credentials,
		};
	}

	private makeVerb(method: HTTPMethod): APIRequestFn {
		return async (path, options = {}) => {
			const res = await this.Fetch(this.baseURL + path, {
				method,
				...options,
			});

			if (!res.ok) {
				const errorBody = await res.json().catch((e) => e);
				throw errorBody;
			}

			return await res.json();
		};
	}
}
