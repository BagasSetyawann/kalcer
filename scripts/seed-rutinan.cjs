const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_FILE = path.join(__dirname, '..', 'data', 'kalremind.db');

const rawData = `Kategori LO;Penanggung Jawab PIC;Nomor Wa;Tipe Periode;Kode Dokumen;;;
Akuntansi;Dinda;089604418252;Semesteran;LK 01a, LK 01b;;;
Anggaran;Sandi;082393305225;Bulanan;Agrn 03;;;
Anggaran;Sandi;082393305225;Kondisional;Agrn 01, Agrn 02a, Agrn 02b;;;
Belanja 51;Sandi;082393305225;Bulanan;Blj 51 01 s.d. Blj 51 06;;;
Bendahara Penerimaan;Sandi;082393305225;Kondisional;BPn 01, BPn 02, BPn 03;;;
Bendahara Pengeluaran;Agus;082188659677;Bulanan;BPg 01 s.d. 06, BPg 08a s.d. 11, BPg 12a, BPg 12b;;;
Bendahara Pengeluaran;Agus;082188659677;Kondisional;BPg 13, BPg KKP 01 s.d. 04;;;
Bendahara Pengeluaran;Dinda;089604418252;Bulanan;BPg 07a, BPg 07b, BPg 15;;;
Bendahara Pengeluaran;Sandi;082393305225;Bulanan;BPg 14, BPg 16, BPg 17a, BPg 17b;;;
Bendahara Pengeluaran;Sandi;082393305225;Kondisional;BPP 01 s.d. 05;;;
Kepegawaian;Sandi;082393305225;Bulanan;Pgw 01;;;
Kepegawaian;Sandi;082393305225;Kondisional;Pgw 02 s.d. Pgw 05;;;
PBJ;Sandi;082393305225;Kondisional;PBJ 01;;;
Pengelolaan BMN;Dian;081291780150;Bulanan;BMN 01a, 01b, 01c, BMN 02, Psd 01, Psd 03;;;
Pengelolaan BMN;Dian;081291780150;Semesteran;Psd 02;;;
Pengelolaan BMN;Sandi;082393305225;Kondisional;BMN 03, BMN 04a, BMN 04b, BMN 05a, BMN 05b;;;
PNBP;Dinda;089604418252;Bulanan;PNBP 02a, PNBP 02b;;;
PNBP;Sandi;082393305225;Bulanan;PNBP 01;;;
PNBP;Sandi;082393305225;Kondisional;PNBP 03;;;`;

async function run() {
  console.log('Menghubungkan ke database...');
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // Tentukan tanggal 14 bulan berjalan
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const targetDate = `${year}-${month}-14`;

  console.log(`Tanggal deadline untuk data rutinan: ${targetDate}`);

  const lines = rawData.split('\n');
  let insertedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(';');
    if (parts.length >= 5) {
      const kategoriLO = parts[0].trim();
      const picName = parts[1].trim();
      const picPhone = parts[2].trim();
      const tipePeriode = parts[3].trim();
      const kodeDokumen = parts[4].trim();

      if (tipePeriode.toLowerCase() === 'bulanan') {
        // Prepare title
        const title = `Penyampaian ${kodeDokumen}`;

        await db.run(
          `INSERT INTO events (title, date, category, picName, picPhone, status) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [title, targetDate, kategoriLO, picName, picPhone, 'pending']
        );
        insertedCount++;
        console.log(`Inserted: ${title}`);
      }
    }
  }

  console.log(`Selesai. Berhasil menambahkan ${insertedCount} data rutinan ke database.`);
}

run().catch(err => {
  console.error(err);
});
