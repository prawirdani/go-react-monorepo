type Currencies = "IDR" | "USD";

// IDR formatter
const idrFormatter = new Intl.NumberFormat("id-ID", {
	style: "currency",
	currency: "IDR",
	maximumFractionDigits: 0,
});

// USD formatter
const usdFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
});

// Currency formatter map
const CurrencyFormatter: Record<Currencies, Intl.NumberFormat> = {
	IDR: idrFormatter,
	USD: usdFormatter,
};

export function formatCurrency(amount: number, currency: Currencies) {
	// return idrFormatter.format(amount);
	return CurrencyFormatter[currency].format(amount);
}
