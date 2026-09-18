import type en from "../en/common";
import type { DeepStringify } from "../types";

const common: DeepStringify<typeof en> = {
	actions: {
		cancel: "Batal",
		close: "Tutup",
		save: "Simpan",
	},
	genderOptions: {
		m: "Laki-Laki",
		f: "Perempuan",
		o: "Lainnya",
	},
	// Shared by every list surface (pager + filters). Arg-free by contract:
	// counts and ranges are composed in JSX from these labels plus numbers.
	searchQuery: {
		showing: "Menampilkan",
		of: "dari",
		page: "Halaman",
		rows: "Baris",
		prev: "Halaman sebelumnya",
		next: "Halaman berikutnya",
		filter: "Filter",
		clear: "Hapus filter",
	},
	roleOptions: {
		admin: "Admin",
		user: "User",
	},
};

export default common;
