/**
 * grafik.ts — penggambar grafik.
 *
 * KEPUTUSAN YANG DIAMBIL DI SINI
 * -------------------------------
 * 1. Chart.js di-*bundle* dari `node_modules`, bukan diambil dari CDN seperti
 *    versi sebelumnya. Demo KKN sering dijalankan di tempat yang sambungan
 *    internetnya lemah atau diblokir; grafik yang hilang saat presentasi
 *    adalah kegagalan yang tidak perlu.
 *
 * 2. Berkas ini didaftarkan ke kejadian `astro:page-load`. Kejadian itu
 *    dipancarkan Astro setiap kali halaman selesai dimuat, termasuk setelah
 *    perpindahan halaman lewat View Transitions — sehingga grafik tetap
 *    tergambar pada halaman kedua dan seterusnya, bukan hanya yang pertama.
 *
 * 3. Grafik baru digambar ketika sudah masuk layar. Inilah satu-satunya alasan
 *    animasi Chart.js terlihat: animasi bawaan berjalan saat grafik dibuat,
 *    dan grafik yang dibuat jauh di bawah layar akan selesai beranimasi
 *    sebelum sempat dilihat.
 *
 * 4. Bila pengguna memilih `prefers-reduced-motion`, animasi dimatikan dan
 *    grafik langsung digambar tanpa menunggu masuk layar.
 */

import Chart from 'chart.js/auto';
import type { ChartConfiguration, ScriptableContext } from 'chart.js';

interface KonfigurasiGrafik {
  /** Label sumbu mendatar, mis. "17 Sep". */
  labels: string[];
  /** Tanggal ISO lengkap untuk tooltip saat titik grafik disentuh. */
  tanggal: string[];
  /** Harga yang sudah terjadi. */
  riwayat: (number | null)[];
  /** Angka tengah perkiraan. */
  perkiraan: (number | null)[];
  /** Batas atas rentang ketidakpastian. */
  atas: (number | null)[];
  /** Batas bawah rentang ketidakpastian. */
  bawah: (number | null)[];
  /** Nama satuan, mis. "kg". */
  satuan: string;
  /** Nama komoditas, dipakai pada keterangan pembaca layar. */
  judul: string;
}

function warnaTema() {
  const gelap = document.documentElement.classList.contains('dark');
  return {
    riwayat: gelap ? '#C0F283' : '#125112',
    riwayatArea: gelap ? 'rgba(100, 144, 46, 0.24)' : 'rgba(230, 239, 230, 0.85)',
    perkiraan: gelap ? '#C0F283' : '#125112',
    pita: gelap ? 'rgba(100, 144, 46, 0.28)' : 'rgba(230, 239, 230, 0.8)',
    sumbu: gelap ? '#E2E7EA' : '#263238',
    kisi: gelap ? '#717171' : '#D2D2D2',
    teks: gelap ? '#F8F9FA' : '#263238',
  };
}

/** Menyisipkan titik sambung agar garis riwayat dan perkiraan tidak terputus. */
function sambung(deret: (number | null)[], nilaiSambung: number | null): (number | null)[] {
  if (nilaiSambung === null) return deret;
  const akhir = deret.lastIndexOf(null);
  if (akhir === -1) return deret;
  const hasil = [...deret];
  hasil[akhir] = nilaiSambung;
  return hasil;
}

function rupiah(nilai: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(nilai);
}

function rupiahRingkas(nilai: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
    notation: 'compact',
  }).format(nilai);
}

// Grafik yang sudah dibuat disimpan agar dapat dimusnahkan sebelum digambar
// ulang. Tanpa ini, perpindahan halaman bolak-balik akan menumpuk grafik pada
// kanvas yang sama dan memori browser terpakai tanpa guna.
const tersimpan = new WeakMap<HTMLCanvasElement, Chart>();

function opsi(konfigurasi: KonfigurasiGrafik, gerak: boolean): ChartConfiguration['options'] {
  const warna = warnaTema();
  return {
    responsive: true,
    maintainAspectRatio: false,
    font: { family: '"Inter Variable", Inter, sans-serif' },
    // Grafik yang tidak beranimasi tetap dapat dibaca; yang beranimasi tanpa
    // henti justru mengganggu.
    animation: gerak ? { duration: 500, easing: 'easeOutQuart' } : false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#263238',
        titleColor: '#FFFFFF',
        bodyColor: '#F8F9FA',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 14 },
        callbacks: {
          title(items) {
            const tanggal = konfigurasi.tanggal[items[0]?.dataIndex ?? -1];
            if (!tanggal) return '';
            return new Intl.DateTimeFormat('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(`${tanggal}T00:00:00Z`));
          },
          label(ctx) {
            const nilai = ctx.parsed.y;
            if (nilai === null || nilai === undefined) return '';
            // Batas atas dan bawah diberi nama yang jelas; menampilkannya
            // sebagai "atas"/"bawah" saja membuat pembaca mengira itu harga.
            if (ctx.dataset.label === 'Batas atas') return `Perkiraan tertinggi: ${rupiah(nilai)}`;
            if (ctx.dataset.label === 'Batas bawah') return `Perkiraan terendah: ${rupiah(nilai)}`;
            return `${ctx.dataset.label}: ${rupiah(nilai)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: warna.sumbu,
          font: (context) => ({ family: '"Inter Variable", Inter, sans-serif', size: context.chart.width < 480 ? 11 : 14 }),
          maxRotation: 0,
          autoSkipPadding: 18,
          maxTicksLimit: 8,
          callback(value, index) {
            const label = konfigurasi.labels[index] ?? String(value);
            return this.chart.width < 480 ? label.split(' ').slice(1).join(' ') || label : label;
          },
        },
        grid: { color: warna.kisi },
      },
      y: {
        beginAtZero: false,
        ticks: {
          color: warna.sumbu,
          font: (context) => ({ family: '"Inter Variable", Inter, sans-serif', size: context.chart.width < 480 ? 11 : 14 }),
          callback: (v) => rupiahRingkas(Number(v)),
        },
        grid: { color: warna.kisi },
        title: {
          display: true,
          text: `Harga per ${konfigurasi.satuan}`,
          color: warna.teks,
          font: { family: '"Inter Variable", Inter, sans-serif', size: 13, weight: 'bold' },
        },
      },
    },
  };
}

function gambarPrediksi(canvas: HTMLCanvasElement, cfg: KonfigurasiGrafik, gerak: boolean) {
  const warna = warnaTema();
  const terakhirRiwayat = [...cfg.riwayat].reverse().find((v) => v !== null) ?? null;

  const datasets = [
    // Pita ketidakpastian digambar lebih dulu supaya berada di belakang garis.
    // `fill: '+1'` membuat area antara deret ini dan deret berikutnya terisi.
    {
      label: 'Batas atas',
      data: sambung(cfg.atas, terakhirRiwayat),
      borderColor: 'transparent',
      backgroundColor: warna.pita,
      fill: '+1',
      pointRadius: 0,
      pointHoverRadius: 0,
      borderWidth: 0,
    },
    {
      label: 'Batas bawah',
      data: sambung(cfg.bawah, terakhirRiwayat),
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      borderWidth: 0,
    },
    {
      label: 'Harga tercatat',
      data: cfg.riwayat,
      borderColor: warna.riwayat,
      backgroundColor: warna.riwayatArea,
      borderWidth: 3,
      pointRadius: (context: ScriptableContext<'line'>) => context.dataIndex % 7 === 0 ? 3 : 0,
      pointHoverRadius: 7,
      tension: 0,
      fill: true,
      spanGaps: false,
    },
    {
      label: 'Perkiraan',
      data: sambung(cfg.perkiraan, terakhirRiwayat),
      borderColor: warna.perkiraan,
      backgroundColor: warna.perkiraan,
      borderWidth: 3,
      // Garis putus-putus menandai bahwa bagian ini belum terjadi. Perbedaan
      // bentuk garis, bukan hanya warna, agar tetap terbaca oleh pengguna
      // dengan gangguan penglihatan warna.
      borderDash: [8, 6],
      pointRadius: (context: ScriptableContext<'line'>) => context.dataIndex % 7 === 0 ? 3 : 0,
      pointHoverRadius: 7,
      tension: 0,
      spanGaps: false,
    },
  ];

  tersimpan.get(canvas)?.destroy();
  tersimpan.set(
    canvas,
    new Chart(canvas, { type: 'line', data: { labels: cfg.labels, datasets }, options: opsi(cfg, gerak) })
  );
}

function gambarRiwayat(canvas: HTMLCanvasElement, cfg: KonfigurasiGrafik, gerak: boolean) {
  const warna = warnaTema();
  tersimpan.get(canvas)?.destroy();
  tersimpan.set(
    canvas,
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: cfg.labels,
        datasets: [
          {
            label: 'Harga tercatat',
            data: cfg.riwayat,
            borderColor: warna.riwayat,
            backgroundColor: warna.riwayatArea,
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25,
            fill: true,
            spanGaps: true,
          },
        ],
      },
      options: opsi(cfg, gerak),
    })
  );
}

function ambilKonfigurasi(canvas: HTMLCanvasElement): KonfigurasiGrafik | null {
  const id = canvas.dataset.konfigurasi;
  if (!id) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? '{}') as KonfigurasiGrafik;
  } catch (e) {
    console.error('[grafik] konfigurasi tidak dapat dibaca', id, e);
    return null;
  }
}

/** Menampilkan keterangan pengganti bila grafik gagal digambar. */
function gagal(canvas: HTMLCanvasElement, pesan: string) {
  console.error('[grafik]', pesan);
  const wadah = canvas.parentElement;
  if (!wadah) return;
  canvas.hidden = true;
  const p = document.createElement('p');
  p.className = 'text-tinta-kedua py-8 text-center';
  p.textContent = 'Grafik tidak dapat ditampilkan. Angka lengkapnya tersedia pada tabel di bawah.';
  wadah.appendChild(p);
}

function gambarSatu(canvas: HTMLCanvasElement, gerak: boolean) {
  const cfg = ambilKonfigurasi(canvas);
  if (!cfg) {
    gagal(canvas, 'konfigurasi grafik tidak ditemukan');
    return;
  }
  try {
    if (canvas.dataset.grafik === 'riwayat') {
      gambarRiwayat(canvas, cfg, gerak);
    } else {
      gambarPrediksi(canvas, cfg, gerak);
    }
  } catch (e) {
    gagal(canvas, String(e));
  }
}

/**
 * Menggambar seluruh grafik pada halaman.
 *
 * Aman dipanggil berkali-kali: grafik lama dimusnahkan lebih dulu sebelum
 * digambar ulang, sehingga perpindahan halaman tidak menumpuk grafik.
 */
export function gambarSemuaGrafik() {
  const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const daftar = document.querySelectorAll<HTMLCanvasElement>('canvas[data-grafik]');

  daftar.forEach((canvas) => {
    if (canvas.getClientRects().length === 0) return;
    // Grafik yang belum terlihat ditunda sampai masuk layar, agar animasinya
    // benar-benar terlihat. Bila gerak dikurangi, langsung digambar.
    if (kurangiGerak || !('IntersectionObserver' in window)) {
      gambarSatu(canvas, false);
      return;
    }

    const pengamat = new IntersectionObserver(
      (entri) => {
        for (const e of entri) {
          if (!e.isIntersecting) continue;
          gambarSatu(canvas, true);
          pengamat.disconnect();
        }
      },
      { rootMargin: '0px 0px -80px 0px', threshold: 0.1 }
    );
    pengamat.observe(canvas);
  });
}

// Dipanggil pada pemuatan pertama maupun setiap perpindahan halaman.
document.addEventListener('astro:page-load', gambarSemuaGrafik);
document.addEventListener('sipanen:refresh-charts', gambarSemuaGrafik);
document.addEventListener('sipanen:theme-change', () => {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-grafik]').forEach((canvas) => {
    gambarSatu(canvas, false);
  });
});
