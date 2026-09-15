export function isDeepEqual(obj1: unknown, obj2: unknown): boolean {
	if (obj1 === obj2) return true;

	if (
		obj1 == null ||
		obj2 == null ||
		typeof obj1 !== "object" ||
		typeof obj2 !== "object"
	) {
		return false;
	}

	// Handle Arrays
	if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

	// Both sides are non-null objects by this point.
	const left = obj1 as Record<string, unknown>;
	const right = obj2 as Record<string, unknown>;
	const keys1 = Object.keys(left);
	const keys2 = Object.keys(right);

	// Check number of properties
	if (keys1.length !== keys2.length) return false;

	// Recursive check for every key
	for (const key of keys1) {
		if (!keys2.includes(key) || !isDeepEqual(left[key], right[key])) {
			return false;
		}
	}

	return true;
}

/**
 * Debounces a function - delays execution until after wait time has passed since last call
 */
// biome-ignore lint/suspicious/noExplicitAny: a forwarding wrapper needs `any[]` here; `unknown[]` is not assignable from parameterised callbacks (contravariance)
export function debounce<T extends (...args: any[]) => unknown>(
	func: T,
	wait: number = 300,
) {
	let timeoutId: ReturnType<typeof setTimeout>;

	const debounced = (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => func(...args), wait);
	};

	debounced.cancel = () => clearTimeout(timeoutId);

	return debounced;
}
