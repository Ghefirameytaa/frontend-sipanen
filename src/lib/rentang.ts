/**
 * rentang.ts — sebutan untuk lebar rentang ketidakpastian.
 *
 * Ambang 25% dan 15% dipakai di lebih dari satu tempat: `PitaPasti` pada kartu
 * saran tanam, dan jalur putusan di atas grafik `/prediksi`. Bila keduanya
 * menuliskan ambangnya sendiri-sendiri, cepat atau lambat satu halaman menyebut
 * "rentang lebar" untuk angka yang di halaman lain disebut "rentang sedang" —
 * dan pembaca yang menyadarinya berhenti mempercayai keduanya.
 *
 * Kata-katanya sengaja tidak menyiratkan penilaian untung/rugi. Rentang lebar
 * berarti "jangan bersandar pada satu angka", bukan "jangan menanam".
 */
export type NadaRentang = 'bagus' | 'netral' | 'hati';

export interface SebutanRentang {
  nada: NadaRentang;
  teks: string;
}

export function sebutanRentang(lebarPersen: number): SebutanRentang {
  if (!Number.isFinite(lebarPersen)) {
    return { nada: 'netral', teks: 'Rentang tidak diketahui' };
  }
  if (lebarPersen >= 25) return { nada: 'hati', teks: 'Rentang lebar' };
  if (lebarPersen >= 15) return { nada: 'netral', teks: 'Rentang sedang' };
  return { nada: 'bagus', teks: 'Rentang sempit' };
}

/**
 * Lebar rentang dalam persen terhadap angka tengah.
 *
 * Pembaginya `tengah`, dan definisi ini sama dengan yang dipakai backend pada
 * `recommender.go` (`uncertainty = (upper - lower) / expected * 100`). Lihat
 * catatan pada `rentangKeyakinan` di `api.ts`.
 */
export function lebarRentang(bawah: number, tengah: number, atas: number): number {
  if (!(tengah > 0)) return Number.NaN;
  return ((atas - bawah) / tengah) * 100;
}
