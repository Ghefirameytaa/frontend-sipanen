import crypto from 'node:crypto';
/**
 * api.ts — Klien API SiPanen
 *
 * ATURAN YANG DIPEGANG BERKAS INI
 * --------------------------------
 * 1. TIDAK ADA data karangan. Versi sebelumnya mengembalikan harga acak
 *    (`Math.random()`) ketika backend tidak dapat dihubungi. Akibatnya halaman
 *    tetap tampak berisi padahal backend mati — kegagalan tersembunyi, dan
 *    angka palsu nyaris tampil sebagai data sungguhan. Kini kegagalan selalu
 *    menjadi kegagalan yang terlihat.
 *
 * 2. Setiap fungsi mengembalikan `ApiResult`, bukan melempar pengecualian.
 *    Halaman dipaksa memeriksa `hasil.ok` sebelum memakai datanya, sehingga
 *    "backend mati" tidak mungkin terlewat tanpa sengaja.
 *
 * 3. `meta.data_kind` ikut dikembalikan. Angka berlabel `simulasi` wajib
 *    ditampilkan berbeda dari yang berlabel `aktual`.
 */

/**
 * Menentukan alamat API.
 *
 * Seluruh pengambilan data di dashboard ini berjalan di sisi server (SSR),
 * bukan di peramban. Karena itu alamat API harus dapat dijangkau DARI DALAM
 * wadah tempat Astro berjalan — di Docker nilainya `http://backend:3000/api`,
 * bukan `http://localhost:3000/api`.
 *
 * `API_BASE_URL` dibaca saat program berjalan dan lebih diutamakan daripada
 * `PUBLIC_API_BASE_URL` yang ditanam saat pembangunan. Dengan begitu satu
 * image yang sama dapat dipakai untuk beberapa lingkungan tanpa dibangun
 * ulang — persis masalah yang membuat frontend di Docker tidak dapat
 * menghubungi backend pada versi sebelumnya.
 */
function dasarApi(): string {
  const runtime =
    typeof process !== "undefined" && process.env
      ? process.env.API_BASE_URL
      : undefined;
  return (
    (runtime && runtime.trim()) ||
    (import.meta.env.PUBLIC_API_BASE_URL as string | undefined) ||
    "http://127.0.0.1:3000/api"
  );
}

const API_BASE: string = dasarApi();

// ── Amplop respons ────────────────────────────────────────────────────────────

export interface Meta {
  data_kind: string;
  generated_at: string;
  region_id?: number;
  notes?: string[];
  count: number;
}

export interface ErrorBody {
  code: string;
  message: string;
}

/** Kode kesalahan backend yang boleh diandalkan frontend. */
export const KODE = {
  BELUM_ADA_DATA: "belum_ada_data",
  PARAMETER_TIDAK_SAH: "parameter_tidak_sah",
  TIDAK_DITEMUKAN: "tidak_ditemukan",
  GALAT_INTERNAL: "galat_internal",
  /** Bukan dari backend: backend memang tidak dapat dihubungi. */
  TIDAK_TERHUBUNG: "tidak_terhubung",
} as const;

export type ApiResult<T> =
  | { ok: true; data: T; meta: Meta }
  | { ok: false; error: ErrorBody };

/** Pesan yang layak dibaca petani, bukan pesan teknis. */
export function pesanUntuk(error: ErrorBody): string {
  switch (error.code) {
    case KODE.TIDAK_TERHUBUNG:
      return "Tidak dapat menghubungi server data. Periksa sambungan internet, lalu coba lagi.";
    case KODE.BELUM_ADA_DATA:
      return "Data untuk wilayah ini belum tersedia. Hubungi petugas pendamping.";
    case KODE.TIDAK_DITEMUKAN:
      return "Data yang diminta tidak ditemukan.";
    default:
      return error.message || "Terjadi gangguan saat mengambil data.";
  }
}

// ── Pemanggilan dasar ─────────────────────────────────────────────────────────


function rahasiaApi(): string {
  const runtime =
    typeof process !== "undefined" && process.env
      ? process.env.API_SECRET_KEY
      : undefined;
  return (
    (runtime && runtime.trim()) ||
    "sipanen-secure-hmac-key-blederan-2026"
  );
}

const API_SECRET_KEY = rahasiaApi();

function signRequest(
  method: string,
  path: string,
  params?: Params
): { sig: string; t: number; queryPairs: [string, string][] } {
  const t = Math.floor(Date.now() / 1000);
  const cleanPairs: [string, string][] = [];

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") {
        const kLower = k.toLowerCase();
        if (
          kLower !== "_sig" &&
          kLower !== "sig" &&
          kLower !== "hash" &&
          kLower !== "_t" &&
          kLower !== "t" &&
          kLower !== "timestamp"
        ) {
          cleanPairs.push([k, String(v)]);
        }
      }
    }
  }

  cleanPairs.sort((a, b) => a[0].localeCompare(b[0]));
  const canonicalQuery = cleanPairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const apiPath = path.startsWith("/api")
    ? path
    : `/api${path.startsWith("/") ? path : `/${path}`}`;
  const payload = `${method.toUpperCase()}|${apiPath}|${canonicalQuery}|${t}`;

  const sig = crypto
    .createHmac("sha256", API_SECRET_KEY)
    .update(payload)
    .digest("hex");

  return { sig, t, queryPairs: cleanPairs };
}

type Params = Record<string, string | number | undefined | null>;

async function panggil<T>(
  path: string,
  params?: Params,
): Promise<ApiResult<T>> {
  const { sig, t, queryPairs } = signRequest("GET", path, params);

  let url: string;
  try {
    const u = new URL(`${API_BASE}${path}`);
    for (const [k, v] of queryPairs) {
      u.searchParams.set(k, v);
    }
    u.searchParams.set("_sig", sig);
    u.searchParams.set("_t", String(t));
    url = u.toString();
  } catch {
    return {
      ok: false,
      error: {
        code: KODE.GALAT_INTERNAL,
        message: `Alamat API tidak sah: ${API_BASE}`,
      },
    };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-SiPanen-Signature": sig,
        "X-SiPanen-Timestamp": String(t),
      },
      cache: "no-store",
    });
  } catch (e) {
    // Backend tidak dapat dihubungi. Ini keadaan yang harus terlihat.
    console.error(`[api] gagal menghubungi ${url}`, e);
    return {
      ok: false,
      error: {
        code: KODE.TIDAK_TERHUBUNG,
        message: "Tidak dapat menghubungi server data.",
      },
    };
  }

  let isi: unknown;
  try {
    isi = await res.json();
  } catch {
    return {
      ok: false,
      error: {
        code: KODE.GALAT_INTERNAL,
        message: `Server mengirim balasan yang tidak dapat dibaca (HTTP ${res.status}).`,
      },
    };
  }

  if (!res.ok) {
    const badan = (isi as { error?: ErrorBody })?.error;
    return {
      ok: false,
      error: badan ?? {
        code: KODE.GALAT_INTERNAL,
        message: `Permintaan gagal (HTTP ${res.status}).`,
      },
    };
  }

  const amplop = isi as { data?: T; meta?: Meta };
  return {
    ok: true,
    data: amplop.data as T,
    meta: amplop.meta ?? {
      data_kind: "tidak_diketahui",
      generated_at: new Date().toISOString(),
      count: 0,
    },
  };
}

async function panggilJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const { sig, t } = signRequest("POST", path);
  const url = `${API_BASE}${path}?_sig=${sig}&_t=${t}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-SiPanen-Signature": sig,
        "X-SiPanen-Timestamp": String(t),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const isi = (await response.json()) as { data?: T; error?: ErrorBody; meta?: Meta };
    if (!response.ok) {
      return { ok: false, error: isi.error ?? { code: KODE.GALAT_INTERNAL, message: `Permintaan gagal (HTTP ${response.status}).` } };
    }
    return { ok: true, data: isi.data as T, meta: isi.meta ?? { data_kind: "tidak_diketahui", generated_at: new Date().toISOString(), count: 0 } };
  } catch {
    return { ok: false, error: { code: KODE.TIDAK_TERHUBUNG, message: "Tidak dapat menghubungi server data." } };
  }
}

export interface PlantingMonthRecommendation {
  bulan_tanam: number; nama_bulan: string; perkiraan_bulan_panen: string;
  durasi_hst?: number; satuan_durasi?: string;
  skor_kelayakan: number; skor_iklim_murni?: number;
  status_tanam?: string; kategori: string;
  tren_harga_panen?: string; indeks_harga_panen_persen?: number;
  strategi_mitra?: string; alasan_lengkap?: string;
  alasan_cuaca: string; alasan_harga: string;
  risiko_gagal_panen_persen: number; estimasi_laba_bersih_rp: number;
  iklim?: {
    hujan_mm: number; kategori_hujan: string; suhu_c: number;
    hari_hujan: number; kelembapan_persen?: number;
  };
  fase?: Record<string, {
    hari_mulai_hst: number; hari_selesai_hst: number; durasi_hari: number;
    nama_bulan_dominan: string; hujan_mm: number; suhu_c: number;
    hari_hujan: number; kelembapan_persen: number; skor_fase: number;
  }>;
  musim?: {
    kategori: string; label: string; keandalan_pola_persen: number;
    rincian_keandalan: string; kemarau_basah: boolean;
    saran_umum: string; saran_komoditas: string;
  };
}
export interface PlantingSchedule {
  status: string; komoditas: string; key_komoditas?: string;
  durasi_hst?: number; satuan_umur_tanam?: string;
  luas_ubin: number; bulan_emas_terbaik: string;
  jadwal_update_otomatis?: string; terakhir_diperbarui_wib?: string;
  ringkasan_musim?: Record<string, any>;
  rekomendasi_12_bulan: PlantingMonthRecommendation[];
}
export interface FullKalenderTanam {
  metadata: Record<string, any>;
  ringkasan_musim: Record<string, any>;
  kalender: Array<Record<string, any>>;
  jadwal_update_otomatis?: string;
  terakhir_diperbarui_wib?: string;
}
export interface WeatherWarning {
  status: string; level_peringatan: string; deskripsi_bahaya: string;
  pesan_whatsapp_warga: string; mitigasi_parit_dan_lahan: string[];
}
export interface FailureDay {
  tanggal: string; curah_hujan_mm: number; probabilitas_gagal_panen_persen: number;
  level_risiko: string; klasifikasi_bmkg: string; ancaman_utama: string; tindakan_darurat: string;
}
export interface FailureRisk {
  status: string; wilayah: string; komoditas: string; fase_tanaman: string; luas_ubin: number;
  rata_rata_risiko_persen: number; hari_paling_kritis: string; hasil_harian: FailureDay[];
  rekomendasi_penyuluh_ppl: string[];
}
export interface PlantingPriceForecast {
  status: string; komoditas: string; harga_pasar_wonosobo_sekarang_rp: number;
  proyeksi_harga_puncak_panen_rp: number; rekor_harga_terendah_rp: number;
  arah_tren: string; pasar_rujukan: string[];
}

export function getFullKalenderTanam(opts?: { komoditas?: string; bulan?: number }) {
  return panggil<FullKalenderTanam>("/kalender", {
    komoditas: opts?.komoditas,
    bulan: opts?.bulan,
  });
}
export function getPlantingSchedule(input: { komoditas: string; luas_ubin: number; bulan_target_tanam?: number }) {
  return panggilJson<PlantingSchedule>("/kalender/schedule", input);
}
export function getWeatherWarning(input: { tanggal: string; curah_hujan_mm: number; kelembapan: number; kecepatan_angin_kmh: number; blok_wilayah: string }) {
  return panggilJson<WeatherWarning>("/kalender-tanam/weather-warning", input);
}
export function getFailureRisk(input: { komoditas: string; fase_tanaman: string; luas_ubin: number; blok_wilayah: string }) {
  return panggilJson<FailureRisk>("/kalender-tanam/failure-risk", input);
}
export function getPlantingPriceForecast(komoditas: string) {
  return panggil<PlantingPriceForecast>("/kalender-tanam/price-forecast", { komoditas });
}

// ── Jenis data ────────────────────────────────────────────────────────────────

export interface Region {
  id: number;
  name: string;
  district: string;
  regency: string;
  province: string;
  elevation_m: number;
  land_type: string;
  source: string;
}

export interface Agronomy {
  days_to_first_harvest: number;
  harvest_duration_days: number;
  optimal_planting_months: number[];
  elevation_min_m: number;
  elevation_max_m: number;
  ideal_rainfall_min_mm: number;
  ideal_rainfall_max_mm: number;
  notes: string;
  source: string;
}

export interface Commodity {
  id: number;
  code: string;
  name: string;
  category: string;
  variety: string;
  unit: string;
  is_active: boolean;
  /** null berarti data agronomi belum ada — bukan nol. */
  agronomy: Agronomy | null;
}

export interface PriceItem {
  commodity_id: number;
  commodity_code: string;
  commodity_name: string;
  category: string;
  variety: string;
  unit: string;
  price: number;
  date: string;
  previous_price: number;
  previous_date: string;
  change_absolute: number;
  change_percent: number;
  /** Wajib diperiksa sebelum menampilkan perubahan harga. */
  has_previous: boolean;
  data_kind: string;
  source: string;
}

export interface PriceHistoryItem {
  commodity: string;
  market: string;
  date: string;
  price: number;
  data_kind: string;
  source: string;
}

export interface PlantDisease {
  nama_penyakit: string;
  nama_english: string;
  deskripsi: string;
  gejala: string[];
  penyebab: string;
  jenis_patogen?: string;
  tingkat_keparahan: string;
  solusi: {
    penanganan_kimia?: string[];
    penanganan_organik?: string[];
    pupuk_rekomendasi?: string[];
    pencegahan?: string[];
    tips_perawatan?: string[];
  };
}

export type TomatoDisease = PlantDisease;

export interface ActualPoint {
  date: string;
  price: number;
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
  mae: number;
  baseline_mae: number;
  beats_baseline: boolean;
  day_name?: string;
  curah_hujan_mm?: number;
  peluang_hujan?: number;
  kondisi_cuaca?: string;
  klasifikasi_pasar?: string;
  catatan_cuaca?: string;
}

export interface CuacaSentraInfo {
  total_curah_hujan_mm: number;
  rata_rata_hujan_harian_mm: number;
  status_umum: string;
  rekomendasi_petani: string;
}

export interface Accuracy {
  evaluated: boolean;
  mae: number;
  mape: number;
  rmse: number;
  baseline_name: string;
  baseline_mae: number;
  beats_baseline: boolean;
  train_rows: number;
  test_rows: number;
  model_version: string;
  evaluated_at: string;
  notes: string;
}

export interface ForecastSeries {
  commodity_id: number;
  commodity_code: string;
  commodity_name: string;
  category: string;
  variety: string;
  unit: string;
  current_price: number;
  current_price_date: string;
  history: ActualPoint[];
  forecast: ForecastPoint[];
  accuracy: Accuracy;
  weather_summary?: CuacaSentraInfo;
  model_version: string;
  generated_at: string;
}

export interface ReasonItem {
  factor: string;
  detail: string;
  impact: string;
}

export interface RecommendationItem {
  rank: number;
  commodity_id: number;
  commodity_code: string;
  commodity_name: string;
  category: string;
  variety: string;
  unit: string;
  score: number;
  confidence_score: number;
  predicted_trend: string;
  current_price: number;
  expected_price_at_harvest: number;
  expected_gain_pct: number;
  uncertainty_pct: number;
  planting_window_start: string;
  planting_window_end: string;
  expected_harvest_start: string;
  expected_harvest_end: string;
  recommendation_text: string;
  reasons: ReasonItem[];
}

export interface SkippedItem {
  commodity_code: string;
  commodity_name: string;
  reason: string;
}

export interface Recommendations {
  region_id: number;
  region_name: string;
  top_n: number;
  recommendations: RecommendationItem[];
  skipped: SkippedItem[];
  computed_at: string;
  notes: string[];
}

export interface CalendarActivity {
  fase: string;
  judul: string;
  keterangan: string;
  dari_tahun_lalu: boolean;
}

export interface CalendarMonth {
  bulan: number;
  nama_bulan: string;
  kegiatan: CalendarActivity[];
  musim_tanam_disarankan: boolean;
  bulan_tanam_pilihan: boolean;
  status: string;
  kini: boolean;
}

export interface CalendarWindow {
  mulai: string;
  selesai: string;
  keterangan: string;
  dari_tahun_lalu: boolean;
}

export interface CalendarSuitability {
  ketinggian_sesuai: boolean;
  ketinggian_note: string;
  curah_hujan_note: string;
}

export interface CalendarWeather {
  available: boolean;
  data_kind: string;
  source: string;
  avg_rainfall_mm: number;
  avg_monthly_mm: number;
  note: string;
}

export interface CommodityCalendar {
  commodity_id: number;
  commodity_code: string;
  commodity_name: string;
  region_id: number;
  region_name: string;
  tahun: number;
  bulan: CalendarMonth[];
  bulan_tanam_pilihan: number;
  bulan_tanam_pilihan_otomatis: boolean;
  bulan_tanam_disarankan: number[];
  jendela_tanam: CalendarWindow[];
  jendela_panen: CalendarWindow[];
  kesesuaian: CalendarSuitability;
  catatan: string[];
  sumber_agronomi: string;
  weather: CalendarWeather;
}

export interface EducationSection {
  heading: string;
  body: string[];
}

export interface EducationModuleSummary {
  slug: string;
  title: string;
  summary: string;
  category: string;
  reading_minutes: number;
  sort_order: number;
}

export interface EducationModule extends EducationModuleSummary {
  sections: EducationSection[];
  key_points: string[];
  caution?: string;
  source: string;
}

export interface EducationIndex {
  modules: EducationModuleSummary[];
  categories: string[];
}

// ── Fungsi API ────────────────────────────────────────────────────────────────

/** Wilayah kerja. Dipakai hampir semua halaman untuk mengetahui wilayah aktif. */
export function getRegions() {
  return panggil<Region[]>("/regions");
}

export async function getBackendHealth(): Promise<boolean> {
  const base = API_BASE.replace(/\/api\/?$/, "");
  try {
    const response = await fetch(`${base}/healthz`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return false;
    const status = (await response.json()) as { status?: string };
    return status.status === "healthy";
  } catch {
    return false;
  }
}

export function getCommodities(regionId?: number) {
  return panggil<Commodity[]>("/commodities", { region_id: regionId });
}

/** Fitur 3 — harga terkini beserta perubahan dan asal datanya. */
export function getLatestPrices(regionId?: number) {
  return panggil<PriceItem[]>("/prices/latest", { region_id: regionId });
}

export function getPriceHistory(opts?: {
  commodityId?: number;
  marketId?: number;
  from?: string;
  to?: string;
}) {
  return panggil<PriceHistoryItem[]>("/prices", {
    commodity_id: opts?.commodityId,
    market_id: opts?.marketId,
    from: opts?.from,
    to: opts?.to,
  });
}

/** Fitur 1 (utama) — prediksi harga. */
export function getPredictions(opts?: {
  regionId?: number;
  commodityId?: number;
  historyDays?: number;
}) {
  return panggil<ForecastSeries[]>("/predictions", {
    region_id: opts?.regionId,
    commodity_id: opts?.commodityId,
    history_days: opts?.historyDays,
  });
}

/** Fitur 2 — kalender tanam. */
export function getCalendar(opts?: {
  regionId?: number;
  commodityId?: number;
  year?: number;
  month?: number;
}) {
  return panggil<CommodityCalendar[]>("/calendar", {
    region_id: opts?.regionId,
    commodity_id: opts?.commodityId,
    year: opts?.year,
    month: opts?.month,
  });
}

/** Fitur 4 — rekomendasi tanam Top 3. */
export function getTopRecommendations(opts?: {
  regionId?: number;
  limit?: number;
}) {
  return panggil<Recommendations>("/recommendations/top", {
    region_id: opts?.regionId,
    limit: opts?.limit,
  });
}

/** Fitur 5 — modul edukasi. */
export function getEducationModules(category?: string) {
  return panggil<EducationIndex>("/education", { category });
}

export function getEducationModule(slug: string) {
  return panggil<EducationModule>(`/education/${encodeURIComponent(slug)}`);
}

export function getTomatoDiseases() {
  return panggil<Record<string, PlantDisease>>("/diagnose/tomato/diseases");
}

export function getChiliDiseases() {
  return panggil<Record<string, PlantDisease>>("/diagnose/cabai/diseases");
}

// ── Bantuan tampilan ──────────────────────────────────────────────────────────

/** Format rupiah tanpa desimal, sesuai kebiasaan harga di pasar. */
export function rupiah(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nilai);
}

/** Format rupiah ringkas untuk sumbu grafik. */
export function rupiahRingkas(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(nilai);
}

/** Tanggal panjang berbahasa Indonesia, mis. "17 September 2026". */
export function tanggalPanjang(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Tanggal ringkas, mis. "17 Sep". */
export function tanggalRingkas(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
  }).format(d);
}

/** Waktu lengkap, mis. "17 Sep 2026, 14.30". */
export function waktuLengkap(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Persentase bertanda, mis. "+12,3%" atau "−4,1%". */
export function persen(nilai: number, desimal = 1): string {
  const tanda = nilai > 0 ? "+" : "";
  return `${tanda}${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(nilai)}%`;
}

/**
 * Rentang ketidakpastian sebuah rekomendasi: batas bawah dan batas atas.
 *
 * MENGAPA DIHITUNG DI SINI
 * ------------------------
 * Backend TIDAK mengirim batas bawah/atas sebagai field tersendiri; yang dikirim
 * hanya `expected_price_at_harvest` (titik tengah) dan `uncertainty_pct`. Padahal
 * menampilkan titik tengah saja membuat perkiraan tampak seperti kepastian —
 * persis yang dilarang ketentuan proyek. Jadi batasnya harus direkonstruksi.
 *
 * Rumusnya BUKAN tebakan. Di `backend-go/internal/services/recommender/recommender.go`
 * (fungsi penilaian, sekitar baris 232) lebarnya didefinisikan sebagai:
 *
 *     uncertainty = (upper - lower) / expected * 100
 *
 * Artinya `uncertainty_pct` adalah LEBAR PENUH dalam persen terhadap titik tengah,
 * bukan setengah lebar. Karena itu pembaginya 200, bukan 100:
 *
 *     lower = expected * (1 - uncertainty_pct / 200)
 *     upper = expected * (1 + uncertainty_pct / 200)
 *
 * Dengan membagi 100, batas yang tampil akan meleset hampir dua kali lipat —
 * angka yang salah, dan salahnya justru pada bagian yang paling mudah
 * disalahpercaya.
 *
 * Angka ini identik dengan yang dicetak backend pada kalimat rekomendasinya
 * (fungsi `ringkasan` memakai `a.lower`/`a.upper` yang sama). Selisihnya hanya
 * berasal dari pembulatan: `uncertainty_pct` disimpan ke dua desimal dan
 * `expected` ke rupiah utuh.
 *
 * Diperiksa pada contoh nyata: `expected` 56.509 dengan `uncertainty_pct` 73,61
 * menghasilkan Rp35.711–Rp77.307, sedangkan kalimat backend menyebut
 * Rp35.712–Rp77.306 — beda 1 rupiah, hilang setelah diformat tanpa desimal.
 * Sebagai pembanding, pembagi 100 akan menghasilkan Rp14.913–Rp98.105, yaitu
 * salah hampir dua kali lipat pada bagian yang paling mudah disalahpercaya.
 *
 * Bila suatu saat definisi di backend berubah, ubah HANYA di sini.
 */
export function rentangKeyakinan(item: {
  expected_price_at_harvest: number;
  uncertainty_pct: number;
}): { bawah: number; tengah: number; atas: number } {
  const tengah = item.expected_price_at_harvest;
  const separuhLebar = item.uncertainty_pct / 200;
  return {
    bawah: tengah * (1 - separuhLebar),
    tengah,
    atas: tengah * (1 + separuhLebar),
  };
}

/** Selisih hari dari hari ini; negatif berarti sudah lewat. */
export function selisihHari(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hariIni = new Date();
  const satuHari = 24 * 60 * 60 * 1000;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(
    hariIni.getFullYear(),
    hariIni.getMonth(),
    hariIni.getDate(),
  );
  return Math.round((a - b) / satuHari);
}
