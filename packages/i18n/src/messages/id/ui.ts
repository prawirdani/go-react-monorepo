import type en from "../en/ui";
import type { DeepStringify } from "../types";

const ui: DeepStringify<typeof en> = {
	breadcrumb: {
		label: "Navigasi remah",
		more: "Lainnya",
	},
	dialog: {
		close: "Tutup",
	},
	errorBoundary: {
		message: "Terjadi kesalahan, coba lagi beberapa saat.",
	},
	imageInput: {
		choose: "Pilih Gambar",
		loadError: "Gambar gagal dimuat",
		previewAlt: "Pratinjau gambar",
	},
	locale: {
		en: "English",
		id: "Bahasa Indonesia",
		label: "Bahasa",
	},
	sidebar: {
		description: "Menampilkan bilah sisi seluler.",
		title: "Bilah sisi",
		toggle: "Ganti bilah sisi",
	},
	theme: {
		mode: "Mode",
		theme: "Tema",
		toDark: "Mode Gelap",
		toLight: "Mode Terang",
	},
};

export default ui;
