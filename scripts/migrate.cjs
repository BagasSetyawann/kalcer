const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const DB_FILE = path.join(DATA_DIR, 'kalremind.db');

async function migrate() {
  console.log('Memulai proses migrasi data dari JSON ke SQLite...');

  if (!fs.existsSync(EVENTS_FILE)) {
    console.log('File events.json tidak ditemukan. Tidak ada data yang perlu dimigrasi.');
    return;
  }

  try {
    const rawData = fs.readFileSync(EVENTS_FILE, 'utf8');
    const events = JSON.parse(rawData || '[]');

    if (events.length === 0) {
      console.log('Data di events.json kosong.');
      return;
    }

    const db = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        picName TEXT NOT NULL,
        picPhone TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    let migratedCount = 0;
    for (const event of events) {
      // Periksa apakah event ini sudah ada (hindari duplikasi jika script dijalankan ulang)
      const existing = await db.get('SELECT * FROM events WHERE id = ?', event.id);
      if (!existing) {
        await db.run(
          `INSERT INTO events (id, title, date, category, picName, picPhone, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [event.id, event.title, event.date, event.category, event.picName, event.picPhone, event.status || 'pending']
        );
        migratedCount++;
      }
    }

    console.log(`Migrasi selesai! Berhasil memindahkan ${migratedCount} jadwal kegiatan ke SQLite.`);
    
    // Optional: Rename JSON file as backup
    const backupPath = path.join(DATA_DIR, 'events_backup.json');
    fs.renameSync(EVENTS_FILE, backupPath);
    console.log(`File events.json lama telah dibackup ke events_backup.json`);

  } catch (error) {
    console.error('Terjadi kesalahan saat migrasi:', error);
  }
}

migrate();
