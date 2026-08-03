export type DateFormatStyle = "DateNumeric" | "FullWithTZ";

export const DateFmts: Record<DateFormatStyle, Intl.DateTimeFormatOptions> = {
	DateNumeric: {
		dateStyle: "short",
	},
	FullWithTZ: {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	},
};

// local cache
const formatters = new Map<DateFormatStyle, Intl.DateTimeFormat>();

export const formatDate = (
	date: string | Date,
	style: keyof typeof DateFmts = "FullWithTZ",
) => {
	const d = new Date(date);
	if (!date || Number.isNaN(d.getTime())) return "-";

	let fmt = formatters.get(style);
	if (!fmt) {
		fmt = new Intl.DateTimeFormat("id-ID", DateFmts[style]);
		formatters.set(style, fmt);
	}

	return fmt.format(d);
};

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
