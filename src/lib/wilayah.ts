/**
 * wilayah.ts — penentuan wilayah kerja.
 *
 * Seluruh dashboard ini hanya melayani satu wilayah: Desa Blederan, Kecamatan
 * Mojotengah, Kabupaten Wonosobo. Wilayah diambil dari backend, bukan ditulis
 * di dalam kode, supaya angka ketinggian dan jenis tanahnya tetap satu sumber
 * dengan yang dipakai kalender tanam.
 *
 * Bila wilayah belum ada di basis data, halaman harus menampilkan keterangan
 * bahwa seeder belum dijalankan — bukan menampilkan halaman kosong tanpa
 * penjelasan.
 */

import { getRegions, type ApiResult, type Region } from './api';

/** Mengambil wilayah kerja pertama yang terdaftar. */
export async function wilayahAktif(): Promise<ApiResult<Region>> {
  const hasil = await getRegions();

  if (!hasil.ok) return hasil;

  if (hasil.data.length === 0) {
    return {
      ok: false,
      error: {
        code: 'belum_ada_data',
        message:
          'Wilayah kerja belum terdaftar di basis data. Jalankan backend sekali agar data wilayah dan komoditas terisi.',
      },
    };
  }

  return { ok: true, data: hasil.data[0], meta: hasil.meta };
}
