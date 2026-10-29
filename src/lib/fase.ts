/**
 * fase.ts — penampilan tiap fase kegiatan tanam.
 *
 * Dikumpulkan di satu berkas karena fase yang sama ditampilkan di dua tempat:
 * pita 12 bulan (`PitaWaktu`) dan kartu bulan (`PlantingCalendar`). Bila
 * warnanya ditulis dua kali, keduanya cepat atau lambat akan berbeda — dan
 * pembaca yang sudah belajar bahwa "hijau berarti penanaman" akan tertipu.
 *
 * Setiap fase punya IKON, bukan hanya warna. Sebagian petani lanjut usia
 * mengalami gangguan penglihatan warna, dan warna saja tidak cukup untuk
 * membedakan penanaman dari pemupukan.
 */
export interface GayaFase {
  /** Nama fase dalam bahasa sehari-hari. */
  label: string;
  /** Nama ikon pada `Ikon.astro`. */
  ikon: string;
  /**
   * Latar blok fase. Sengaja HANYA latar — tanpa bingkai.
   *
   * Dulu nilainya menyertakan warna bingkai, dan setiap pemakainya menambahkan
   * lebar bingkai sendiri. Akibatnya blok fase tampil sebagai kotak bergaris di
   * tengah halaman yang sudah penuh kotak. Yang membedakan fase sekarang cukup
   * dua: warna latar dan ikon di dalamnya — dan ikon itulah yang bekerja untuk
   * pembaca dengan gangguan penglihatan warna.
   */
  blok: string;
  /** Warna ikon di dalam blok. */
  blokTeks: string;
  /** Warna teks keterangan pada kartu bulan. */
  teks: string;
  /** Titik penanda kecil. */
  titik: string;
}

export const FASE: Record<string, GayaFase> = {
  persiapan: {
    label: 'Persiapan lahan',
    ikon: 'cangkul',
    blok: 'bg-stone-100',
    blokTeks: 'text-stone-800',
    teks: 'text-stone-900',
    titik: 'bg-stone-500',
  },
  tanam: {
    label: 'Penanaman',
    ikon: 'bibit',
    blok: 'bg-sipanen-100',
    blokTeks: 'text-sipanen-800',
    teks: 'text-sipanen-900',
    titik: 'bg-sipanen-600',
  },
  perawatan: {
    label: 'Perawatan',
    ikon: 'air',
    blok: 'bg-sky-100',
    blokTeks: 'text-sky-800',
    teks: 'text-sky-900',
    titik: 'bg-sky-600',
  },
  pemupukan: {
    label: 'Pemupukan',
    ikon: 'semprot',
    blok: 'bg-amber-100',
    blokTeks: 'text-amber-800',
    teks: 'text-amber-900',
    titik: 'bg-amber-600',
  },
  panen: {
    label: 'Panen',
    ikon: 'keranjang',
    blok: 'bg-red-100',
    blokTeks: 'text-red-800',
    teks: 'text-red-900',
    titik: 'bg-red-600',
  },
};

/** Fase yang tidak dikenal tetap ditampilkan, tidak disembunyikan. */
export function gayaFase(fase: string): GayaFase {
  return (
    FASE[fase] ?? {
      label: fase,
      ikon: 'tanya',
      blok: 'bg-kertas-lembut',
      blokTeks: 'text-tinta-kedua',
      teks: 'text-tinta-kedua',
      titik: 'bg-tinta-redup',
    }
  );
}

/** Urutan fase dari awal sampai akhir siklus. */
export const URUTAN_FASE = ['persiapan', 'tanam', 'perawatan', 'pemupukan', 'panen'];
