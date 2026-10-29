/**
 * komoditas.ts — warna ikon tiap komoditas.
 *
 * Dikumpulkan di satu berkas karena ikon komoditas muncul di banyak tempat:
 * kartu harga, pemilih komoditas, saran tanam, kalender, beranda. Bila warnanya
 * ditulis ulang di setiap tempat, cepat atau lambat ada yang berbeda dan
 * pembaca kehilangan petunjuk yang sudah ia hafal.
 *
 * Warna di sini hanya PEMBANTU. Yang menentukan tetap nama komoditas yang
 * selalu tertulis di sebelah ikonnya — sebagian orang tidak dapat membedakan
 * merah dari hijau, dan bagi mereka warna tidak boleh menjadi satu-satunya
 * pembeda.
 */
const WARNA: Record<string, string> = {
  'cabai-keriting': 'text-red-700',
  'cabai-rawit-merah': 'text-red-800',
  'cabai-rawit-hijau': 'text-sipanen-700',
  tomat: 'text-bahaya-700',
  'tomat-besar': 'text-bahaya-700',
  'tomat-kecil': 'text-rose-600',
};

export function warnaKomoditas(code: string): string {
  return WARNA[code] ?? 'text-sipanen-700';
}
