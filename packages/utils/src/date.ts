export function parseEpoch(value: unknown): Date | null {
	if (
		typeof value !== "number" ||
		!Number.isFinite(value) ||
		!Number.isInteger(value)
	) {
		return null;
	}

	const date = new Date(value * 1000);

	return Number.isNaN(date.getTime()) ? null : date;
}
