export default {
	actions: {
		cancel: "Cancel",
		close: "Close",
		save: "Save",
	},
	genderOptions: {
		m: "Male",
		f: "Female",
		o: "Other",
	},
	// Shared by every list surface (pager + filters). Arg-free by contract:
	// counts and ranges are composed in JSX from these labels plus numbers.
	searchQuery: {
		showing: "Showing",
		of: "of",
		page: "Page",
		rows: "Rows",
		prev: "Previous page",
		next: "Next page",
		filter: "Filter",
		clear: "Clear filters",
	},
	roleOptions: {
		admin: "Admin",
		user: "User",
	},
} as const;
