import type en from "../en/app";
import type { DeepStringify } from "../types";

const app: DeepStringify<typeof en> = {
	brand: {
		name: "Dashboard",
		subtitle: "template/admin",
	},
	shared: {
		avatarAlt: "Foto profil",
		yes: "Ya",
	},
	nav: {
		groupLabel: "Navigasi",
		dashboard: "Dashboard",
		users: "Pengguna",
		example: "Contoh",
		settings: "Pengaturan",
		exampleChild1: "Anak 1",
		exampleChild2: "Anak 2",
		exampleChild3: "Anak 3",
		versionLabel: "Versi",
	},
	form: {
		unsaved: {
			title: "Perubahan Belum Tersimpan",
			description:
				"Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
		},
	},
	header: {
		toggleNav: "Buka atau tutup navigasi",
		accountMenu: "Menu akun",
		profile: "Profil",
		logout: "Keluar",
		logoutDescription:
			"Anda akan keluar dari akun ini. Anda perlu masuk kembali untuk mengakses aplikasi.",
	},
	auth: {
		rail: {
			intro: "Satu konsol untuk memantau operasional dan mengelola akun Anda.",
			access1: "Ringkasan dan aktivitas terbaru",
			access2: "Pengaturan tampilan, profil, dan keamanan akun",
			contact: "Belum punya akses? Hubungi admin internal.",
			environment: "Lingkungan",
			environmentDev: "Pengembangan",
			environmentProd: "Produksi",
		},
		fields: {
			email: "Email",
			password: "Kata Sandi",
			emailPlaceholder: "Masukkan alamat email Anda",
			passwordPlaceholder: "Masukkan kata sandi Anda",
		},
		login: {
			title: "Masuk",
			description: "Gunakan akun internal Anda untuk melanjutkan ke konsol.",
			forgot: "Lupa password?",
			submit: "Masuk",
			credentialsError: "Email atau kata sandi Anda salah",
			noAccount: "Belum punya akun?",
			registerLink: "Buat akun",
		},
		forgot: {
			title: "Lupa Kata Sandi",
			description:
				"Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.",
			sentDescription: "Tautan pemulihan sudah dikirim ke email Anda.",
			submit: "Kirim",
			retryIn: "Coba lagi dalam",
			secondsUnit: "detik",
			sentMessage:
				"Kami telah mengirimkan tautan untuk mengatur ulang kata sandi ke alamat email Anda. Silakan periksa kotak masuk dan folder spam.",
			noEmail: "Tidak menerima email?",
			tryAgain: "Coba lagi",
			emailNotFound: "Email yang Anda masukkan tidak terdaftar",
		},
		reset: {
			title: "Atur Ulang Kata Sandi",
			description: "Buat kata sandi baru untuk akun Anda.",
			invalidDescription: "Tautan ini tidak dapat digunakan lagi.",
			expired: "Tautan telah kedaluwarsa atau tidak valid.",
			requestAgainLead: "Silakan",
			requestAgainLink: "ajukan kembali",
			requestAgainTail:
				"permintaan atur ulang kata sandi baru untuk mendapatkan tautan yang dapat digunakan.",
			newPasswordLabel: "Kata sandi baru",
			newPasswordPlaceholder: "Masukkan kata sandi baru Anda",
			confirmLabel: "Konfirmasi kata sandi baru",
			confirmPlaceholder: "Masukkan ulang kata sandi baru Anda",
			success: "Kata sandi Anda berhasil diperbarui,",
			successLink: "login",
		},
		register: {
			title: "Buat Akun",
			description:
				"Daftarkan akun internal. Kami akan mengirim tautan ke email Anda untuk menyelesaikan pendaftaran.",
			nameLabel: "Nama",
			namePlaceholder: "Masukkan nama Anda",
			submit: "Buat akun",
			emailConflict: "Email ini sudah dipakai akun lain",
			sentMessage:
				"Kami sudah mengirim tautan konfirmasi ke alamat email Anda. Buka tautan itu untuk membuat kata sandi dan menyelesaikan pendaftaran.",
			sentBack: "Sudah punya kata sandi?",
		},
		registerComplete: {
			title: "Selesaikan Pendaftaran",
			description: "Buat kata sandi untuk mengaktifkan akun Anda.",
			invalidDescription: "Tautan ini tidak dapat digunakan lagi.",
			invalidExpired: "Tautan ini sudah kedaluwarsa atau tidak lagi valid.",
			invalidLead: "Silakan kembali ke",
			invalidLink: "halaman masuk",
			invalidTail: "untuk memulai ulang.",
			confirmLabel: "Konfirmasi kata sandi",
			confirmPlaceholder: "Masukkan ulang kata sandi Anda",
			submit: "Aktifkan akun",
			success: "Akun Anda sudah siap.",
		},
	},
	dashboard: {
		title: "Konsol",
		description:
			"Struktur operasional yang bisa Anda ganti dengan data nyata. Angka ringkasan adalah contoh; log audit diambil dari data nyata.",
		sampleTag: "Contoh",
		panels: {
			summary: "Ringkasan",
			services: "Status Layanan",
			actions: "Tindakan",
			audit: "Log Audit",
		},
		summaryNote: "Contoh data — hubungkan ke sumber data Anda.",
		summary: {
			entriesToday: "Entri hari ini",
			awaitingReview: "Menunggu tinjauan",
			failedProcessing: "Gagal diproses",
			lastSync: "Sinkron terakhir",
		},
		service: {
			api: "API",
			auth: "Autentikasi",
			storage: "Penyimpanan",
			taskQueue: "Antrean tugas",
			backup: "Pencadangan",
		},
		serviceState: {
			normal: "Normal",
			slow: "Lambat",
			disrupted: "Terganggu",
			scheduled: "Terjadwal",
		},
		audit: {
			loading: "Memuat entri audit…",
			empty: "Belum ada entri audit.",
			error: "Gagal memuat log audit.",
			system: "Sistem",
			payload: "Muatan",
			context: "Konteks",
			actorSearch: "Aktor",
			actorPlaceholder: "Nama atau ID",
			entityOptions: {
				session: "Sesi",
				user: "Pengguna",
				registrationToken: "Token registrasi",
			},
		},
		actionsNote:
			"Halaman contoh berisi tabel dengan status pemuatan. Pakai sebagai titik awal untuk daftar dan filter yang Anda butuhkan.",
		openExample: "Buka contoh data",
		openSettings: "Pengaturan",
		table: {
			time: "Waktu",
			actor: "Pelaku",
			action: "Aksi",
			entity: "Entitas",
		},
	},
	users: {
		title: "Pengguna",
		description: "Semua akun di konsol ini.",
		breadcrumb: "Pengguna",
		table: {
			user: "Pengguna",
			role: "Peran",
			status: "Status",
			phone: "No Handphone",
			gender: "Jenis Kelamin",
			created: "Dibuat",
			actions: "Tindakan",
		},
		delete: {
			action: "Hapus pengguna",
			title: "Hapus pengguna",
			description: "Akun ini akan dihapus secara permanen.",
			confirm: "Hapus",
			success: "Pengguna dihapus",
		},
		edit: {
			action: "Ubah pengguna",
			title: "Ubah pengguna",
			description: "Perbarui nama, nomor telepon, dan jenis kelamin akun ini.",
			namePlaceholder: "Masukkan nama lengkap pengguna",
			phonePlaceholder: "Masukkan nomor handphone pengguna",
			success: "Pengguna diperbarui.",
		},
		invite: {
			action: "Undang pengguna",
			title: "Undang pengguna",
			description:
				"Kirim undangan kepada orang ini untuk menyelesaikan pembuatan akunnya.",
			namePlaceholder: "Masukkan nama lengkap pengguna",
			emailPlaceholder: "Masukkan alamat email pengguna",
			success: "Undangan terkirim.",
		},
		sessions: {
			toggle: "Sesi",
			panel: "Sesi aktif",
		},
		empty: "Tidak ada pengguna di halaman ini.",
		error: "Gagal memuat daftar pengguna.",
		loading: "Memuat pengguna…",
	},
	profile: {
		title: "Profil",
		description: "Identitas akun dan pengaturan keamanannya.",
		identity: {
			panel: "Identitas",
			editLabel: "Ubah identitas",
			name: "Nama",
			phone: "No Handphone",
			gender: "Jenis Kelamin",
			role: "Peran",
		},
		security: {
			panel: "Keamanan Akun",
			description:
				"Kelola kata sandi dan alamat email untuk menjaga keamanan akun Anda.",
			changeEmail: "Ubah email",
			verifyEmail: "Verifikasi",
			verified: "Terverifikasi",
			unverified: "Belum Terverifikasi",
			password: "Kata Sandi",
			changePassword: "Ubah kata sandi",
		},
		sessions: {
			panel: "Sesi aktif",
			description: "Perangkat yang saat ini masuk ke akun ini.",
		},
		changePassword: {
			success:
				"Kata sandi diperbarui. Silakan masuk lagi dengan kata sandi baru Anda.",
			mismatch: "Kata sandi Anda tidak cocok",
			currentLabel: "Kata sandi lama",
			newLabel: "Kata sandi baru",
			confirmLabel: "Konfirmasi kata sandi baru",
			currentPlaceholder: "Masukkan kata sandi Anda saat ini",
			newPlaceholder: "Masukkan kata sandi baru",
			confirmPlaceholder: "Masukkan ulang kata sandi baru",
		},
		updateUser: {
			success: "Profile berhasil diperbarui",
			namePlaceholder: "Masukkan nama Anda",
			phonePlaceholder: "Masukkan nomor handphone Anda",
		},
		picture: {
			invalid: "Foto profil tidak valid",
			upload: "Unggah",
			delete: "Hapus",
			deleteTitle: "Hapus foto profil",
			deleteDescription:
				"Apakah Anda yakin ingin menghapus foto profil saat ini?",
		},
	},
	settings: {
		title: "Pengaturan",
		description: "Pilih tampilan konsol.",
		appearance: {
			panel: "Tampilan",
			label: "Tema dan mode",
			hint: "Preferensi disimpan di peramban ini dan mengikuti sistem bila belum dipilih.",
		},
	},
	example: {
		title: "Contoh",
		description:
			"Kerangka tabel dengan status pemuatan. Ganti dengan daftar dan filter yang Anda butuhkan.",
		tablePanel: "Tabel Contoh",
		column: "Kolom",
		note: "Baris di atas adalah placeholder pemuatan, bukan data nyata.",
	},
	errors: {
		title: "Terjadi kesalahan",
		generic: "Terjadi kesalahan. Coba lagi beberapa saat.",
		sessionExpiredTitle: "Sesi Kedaluwarsa",
		sessionExpiredMessage:
			"Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.",
		codes: {
			validation: "Beberapa isian belum valid. Periksa kembali formulir.",
			invalidQuery: "Beberapa parameter kueri tidak valid",
			credentials: "Email atau kata sandi Anda salah.",
			expired: "Sesi Anda telah berakhir. Silakan login kembali.",
			invalid:
				"Sesi Anda sudah tidak berlaku lagi. Silakan login kembali untuk melanjutkan.",
			invalidSession: "Sesi Anda tidak valid. Silakan login kembali.",
			invalidRecoveryToken:
				"Tautan pemulihan tidak valid atau sudah kedaluwarsa.",
			invalidRegistrationToken:
				"Tautan registrasi tidak valid atau sudah kedaluwarsa.",
			recoveryThrottled: "Terlalu banyak percobaan. Coba lagi pada",
			notFound: "Data yang diminta tidak ditemukan.",
			emailConflict: "Email ini sudah terdaftar.",
			unauthorized: "Anda belum masuk. Silakan login kembali.",
			forbidden: "Anda tidak diizinkan melakukan tindakan ini.",
			network: "Gagal terhubung ke server. Periksa koneksi Anda dan coba lagi.",
			timeout: "Server sedang sibuk. Coba lagi beberapa saat.",
			internal: "Terjadi kesalahan di server. Coba lagi beberapa saat.",
		},
		notFound: {
			heading: "404 / Tidak ditemukan",
			message: "Halaman yang Anda cari tidak ada atau sudah dipindahkan.",
			action: "Kembali ke konsol",
		},
		server: {
			heading: "500 / Kesalahan server",
			message:
				"Terjadi kesalahan saat memuat halaman. Coba lagi beberapa saat.",
			action: "Muat ulang",
		},
		forbidden: {
			heading: "Akses ditolak",
			message:
				"Anda tidak memiliki izin untuk melihat halaman ini. Hubungi administrator jika menurut Anda ini keliru.",
			action: "Kembali ke dasbor",
		},
	},
};

export default app;
