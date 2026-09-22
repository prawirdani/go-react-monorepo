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
	genderPlaceholder: "Select gender",
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
		sortNewest: "Newest first",
		sortOldest: "Oldest first",
		date: {
			trigger: "Date",
			apply: "Apply",
			reset: "Reset",
		},
	},
	roleOptions: {
		admin: "Admin",
		user: "User",
	},
	// Active-session surfaces (profile + admin). Arg-free by contract: device,
	// IP and timestamps are composed in JSX from parsed/format values.
	sessions: {
		empty: "No active sessions.",
		error: "Could not load sessions.",
		loading: "Loading sessions…",
		unknownDevice: "Unknown device",
		revoke: "Revoke",
		revokeAll: "Revoke all",
		revokeConfirmTitle: "Revoke this session?",
		revokeConfirmDescription:
			"That session is signed out immediately. If it is the device you are using now, you will be signed out too.",
		revokeAllConfirmTitle: "Revoke all sessions?",
		revokeAllConfirmDescription:
			"Every device signed into this account is signed out, including this one.",
		revoked: "Session revoked.",
		revokedAll: "All sessions revoked.",
		thisDevice: "This device",
		revokeCurrentDisabled:
			"You cannot revoke the session you are using. Sign out instead.",
		ipLabel: "IP address",
		signedIn: "Signed in",
		lastActive: "Last active",
		expires: "Expires",
	},
} as const;
