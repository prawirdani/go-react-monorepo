export function isDeepEqual(obj1: any, obj2: any): boolean {
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

	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	// Check number of properties
	if (keys1.length !== keys2.length) return false;

	// Recursive check for every key
	for (const key of keys1) {
		if (!keys2.includes(key) || !isDeepEqual(obj1[key], obj2[key])) {
			return false;
		}
	}

	return true;
}

/**
 * Debounces a function - delays execution until after wait time has passed since last call
 */
export function debounce<T extends (...args: any[]) => any>(
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
