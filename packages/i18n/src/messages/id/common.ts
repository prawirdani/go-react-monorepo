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
		date: {
			trigger: "Tanggal",
			apply: "Terapkan",
			reset: "Atur ulang",
		},
	},
	roleOptions: {
		admin: "Admin",
		user: "User",
	},
	// Active-session surfaces (profile + admin). Arg-free by contract: device,
	// IP and timestamps are composed in JSX from parsed/format values.
	sessions: {
		empty: "Tidak ada sesi aktif.",
		error: "Gagal memuat sesi.",
		loading: "Memuat sesi…",
		unknownDevice: "Perangkat tidak dikenal",
		revoke: "Cabut",
		revokeAll: "Cabut semua",
		revokeConfirmTitle: "Cabut sesi ini?",
		revokeConfirmDescription:
			"Sesi tersebut langsung dikeluarkan. Jika itu perangkat yang Anda gunakan sekarang, Anda juga akan keluar.",
		revokeAllConfirmTitle: "Cabut semua sesi?",
		revokeAllConfirmDescription:
			"Semua perangkat yang masuk ke akun ini dikeluarkan, termasuk perangkat ini.",
		revoked: "Sesi dicabut.",
		revokedAll: "Semua sesi dicabut.",
		thisDevice: "Perangkat ini",
		revokeCurrentDisabled:
			"Anda tidak dapat mencabut sesi yang sedang Anda gunakan. Keluar saja.",
		ipLabel: "Alamat IP",
		signedIn: "Masuk",
		lastActive: "Terakhir aktif",
		expires: "Kedaluwarsa",
	},
};

export default common;
