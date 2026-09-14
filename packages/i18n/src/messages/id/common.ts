import type en from "../en/common";
import type { DeepStringify } from "../types";

const common: DeepStringify<typeof en> = {
	actions: {
		cancel: "Batal",
		close: "Tutup",
		save: "Simpan",
	},
	state: {
		loading: "Memuat…",
	},
};

export default common;
