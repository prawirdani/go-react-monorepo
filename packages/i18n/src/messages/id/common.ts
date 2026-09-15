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
};

export default common;
