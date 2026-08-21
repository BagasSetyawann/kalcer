import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon, Clock, CheckCircle, X, Bell,
  Plus, LayoutGrid, List as ListIcon, Settings, RefreshCw,
  Send, AlertCircle, Zap, Link, ExternalLink, Save, Eye, EyeOff, LogOut,
  Repeat, Upload, Download, FileSpreadsheet, ToggleLeft, ToggleRight, Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, FUNCTIONS_URL } from './lib/supabase.js';

const CATEGORIES = [
  { id: 'kepeg',      name: 'Kepegawaian',      color: 'bg-blue-500',   text: 'text-blue-600',   dot: 'bg-blue-500' },
  { id: 'keu',        name: 'Keuangan',          color: 'bg-green-500',  text: 'text-green-600',  dot: 'bg-green-500' },
  { id: 'sakip',      name: 'SAKIP',             color: 'bg-purple-500', text: 'text-purple-600', dot: 'bg-purple-500' },
  { id: 'mr',         name: 'Manajemen Risiko',  color: 'bg-red-500',    text: 'text-red-600',    dot: 'bg-red-500' },
  { id: 'persediaan', name: 'Persediaan',        color: 'bg-orange-500', text: 'text-orange-600', dot: 'bg-orange-500' },
  { id: 'bmn',        name: 'BMN',               color: 'bg-yellow-500', text: 'text-yellow-600', dot: 'bg-yellow-500' },
  { id: 'spider',     name: 'SPIDER',            color: 'bg-teal-500',   text: 'text-teal-600',   dot: 'bg-teal-500' },
];

// Key penyimpanan token Fonnte di localStorage (tersimpan di browser admin)
const FONNTE_TOKEN_KEY = 'kalcer_fonnte_token';

export default function App({ session }) {
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [events, setEvents]             = useState([]);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [blastResults, setBlastResults] = useState({}); // Hasil blasting per key (h7, h3, h2, h1)
  const [lastBlastKey, setLastBlastKey] = useState(null); // Key terakhir yang di-blast

  // Fonnte token management
  const [fonnteToken, setFonnteToken]   = useState(() => localStorage.getItem(FONNTE_TOKEN_KEY) || '');
  const [tokenInput, setTokenInput]     = useState('');
  const [showToken, setShowToken]       = useState(false);
  const [tokenSaved, setTokenSaved]     = useState(false);

  // Kalender state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed
  });

  const [formData, setFormData] = useState({
    title: '', date: '', category: 'kepeg', picName: '', picPhone: ''
  });

  // ─── Import Excel state ───
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreview, setImportPreview]         = useState([]);   // parsed rows

  // ─── Upload Bukti state ───
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedUploadEvent, setSelectedUploadEvent] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importError, setImportError]             = useState('');
  const [isImporting, setIsImporting]             = useState(false);
  const [isDragOver, setIsDragOver]               = useState(false);
  const fileInputRef                              = useRef(null);

  // ─── Recurring events state ───
  const [recurringEvents, setRecurringEvents]       = useState([]);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isGenerating, setIsGenerating]             = useState(false);
  const [generateResult, setGenerateResult]         = useState(null);
  const [recurringForm, setRecurringForm]           = useState({
    title: '', day_of_month: 1, category: 'kepeg', picName: '', picPhone: ''
  });

  // ─── Import Rutin Excel state ───
  const [isImportRecurringOpen, setIsImportRecurringOpen] = useState(false);
  const [importRecurringPreview, setImportRecurringPreview] = useState([]);
  const [importRecurringError, setImportRecurringError]   = useState('');
  const [isImportingRecurring, setIsImportingRecurring]   = useState(false);
  const [isDragOverRecurring, setIsDragOverRecurring]     = useState(false);
  const fileInputRecurringRef                             = useRef(null);

  // ============================================================
  // DATA FETCHING via Supabase JS Client
  // ============================================================
  const fetchEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Gagal mengambil data kegiatan:', err.message);
    }
  }, []);

  const fetchRecurringEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_events')
        .select('*')
        .order('day_of_month', { ascending: true });
      if (error) throw error;
      setRecurringEvents(data || []);
    } catch (err) {
      console.error('Gagal mengambil data rutin:', err.message);
    }
  }, []);

  // Load awal + realtime subscription
  useEffect(() => {
    fetchEvents();
    fetchRecurringEvents();
    tokenInput === '' && setTokenInput(fonnteToken);

    // Supabase Realtime: Update UI otomatis ketika ada perubahan di DB
    const channel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_events' }, () => {
        fetchRecurringEvents();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ============================================================
  // TOKEN FONNTE
  // ============================================================
  const handleSaveToken = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) { alert('Token Fonnte tidak boleh kosong.'); return; }
    localStorage.setItem(FONNTE_TOKEN_KEY, trimmed);
    setFonnteToken(trimmed);
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 3000);
  };

  // ============================================================
  // AUTH
  // ============================================================
  const handleLogout = async () => {
    await supabase.auth.signOut();
    // main.jsx akan mendeteksi session menjadi null dan tampilkan LoginPage
  };

  // Helper: panggil Edge Function dengan Fonnte token
  const callBlastFunction = async (path) => {
    if (!fonnteToken) {
      alert('Token Fonnte belum diisi! Silakan masuk ke tab Pengaturan terlebih dahulu.');
      return null;
    }
    const res = await fetch(`${FUNCTIONS_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-fonnte-token': fonnteToken,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });
    return res;
  };

  // ============================================================
  // CRUD EVENTS
  // ============================================================
  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([{ ...formData, status: 'pending' }])
        .select()
        .single();
      if (error) throw error;
      setEvents(prev => [...prev, data]);
      setIsModalOpen(false);
      setFormData({ title: '', date: '', category: 'kepeg', picName: '', picPhone: '' });
    } catch (err) {
      alert('Gagal menambah kegiatan: ' + err.message);
    }
  };

  // ============================================================
  // UPLOAD BUKTI
  // ============================================================
  const handleUploadEvidence = async (e) => {
    e.preventDefault();
    if (!uploadFile || !selectedUploadEvent) return;
    
    setIsUploading(true);
    try {
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${selectedUploadEvent.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, uploadFile);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('evidence')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          evidence_url: publicUrl,
          status: 'confirmed'
        })
        .eq('id', selectedUploadEvent.id);
        
      if (updateError) throw updateError;
      
      setEvents(events.map(ev => 
        ev.id === selectedUploadEvent.id 
          ? { ...ev, evidence_url: publicUrl, status: 'confirmed' }
          : ev
      ));
      
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setSelectedUploadEvent(null);
      
    } catch (err) {
      console.error('Error uploading evidence:', err.message);
      alert('Gagal mengunggah bukti: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ============================================================
  // IMPORT EXCEL
  // ============================================================
  const VALID_CATEGORIES = CATEGORIES.map(c => c.id);

  const parseExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          // Skip header row
          const parsed = rows.slice(1).map((row, i) => ({
            rowNum: i + 2,
            title:    String(row[0] || '').trim(),
            date:     String(row[1] || '').trim(),
            category: String(row[2] || '').trim().toLowerCase(),
            picName:  String(row[3] || '').trim(),
            picPhone: String(row[4] || '').trim(),
          })).filter(r => r.title);
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const validateImportRow = (row) => {
    const errors = [];
    if (!row.title) errors.push('Nama Kegiatan kosong');
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) errors.push('Format Tanggal harus YYYY-MM-DD');
    if (!VALID_CATEGORIES.includes(row.category)) errors.push(`Kategori "${row.category}" tidak valid`);
    if (!row.picName) errors.push('Nama PIC kosong');
    if (!row.picPhone) errors.push('No WA PIC kosong');
    return errors;
  };

  const handleFileChange = async (file) => {
    if (!file) return;
    setImportError('');
    setImportPreview([]);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) { setImportError('File kosong atau tidak ada data di bawah header.'); return; }
      const withValidation = rows.map(r => ({ ...r, errors: validateImportRow(r) }));
      setImportPreview(withValidation);
    } catch {
      setImportError('Gagal membaca file. Pastikan file berformat .xlsx atau .csv.');
    }
  };

  const handleImportSubmit = async () => {
    const validRows = importPreview.filter(r => r.errors.length === 0);
    if (validRows.length === 0) { alert('Tidak ada baris yang valid untuk diimpor.'); return; }
    setIsImporting(true);
    try {
      const payload = validRows.map(r => ({
        title: r.title, date: r.date, category: r.category,
        picName: r.picName, picPhone: r.picPhone, status: 'pending'
      }));
      const { error } = await supabase.from('events').insert(payload);
      if (error) throw error;
      alert(`✅ Berhasil mengimpor ${validRows.length} kegiatan!`);
      setIsImportModalOpen(false);
      setImportPreview([]);
      fetchEvents();
    } catch (err) {
      alert('Gagal mengimpor: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Kegiatan', 'Tanggal (YYYY-MM-DD)', 'Kategori', 'Nama PIC', 'No WA PIC'],
      ['Rapat Evaluasi Bulanan', '2026-09-10', 'kepeg', 'Ahmad Basuki', '08123456789'],
      ['Rekonsiliasi Keuangan',  '2026-09-15', 'keu',   'Siti Rahayu',  '08987654321'],
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Events');
    XLSX.writeFile(wb, 'template_kalcer.xlsx');
  };

  // ============================================================
  // RECURRING EVENTS
  // ============================================================
  const handleAddRecurring = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('recurring_events')
        .insert([{ ...recurringForm, is_active: true }]);
      if (error) throw error;
      setIsRecurringModalOpen(false);
      setRecurringForm({ title: '', day_of_month: 1, category: 'kepeg', picName: '', picPhone: '' });
      fetchRecurringEvents();
    } catch (err) {
      alert('Gagal menambah event rutin: ' + err.message);
    }
  };

  // ============================================================
  // IMPORT EXCEL RUTIN
  // ============================================================
  const validateRecurringRow = (row) => {
    const errors = [];
    if (!row.title) errors.push('Nama Kegiatan kosong');
    const d = parseInt(row.day_of_month);
    if (isNaN(d) || d < 1 || d > 31) errors.push('Tanggal harus angka 1-31');
    if (!VALID_CATEGORIES.includes(row.category)) errors.push(`Kategori "${row.category}" tidak valid`);
    if (!row.picName) errors.push('Nama PIC kosong');
    if (!row.picPhone) errors.push('No WA PIC kosong');
    return errors;
  };

  const handleRecurringFileChange = async (file) => {
    if (!file) return;
    setImportRecurringError('');
    setImportRecurringPreview([]);
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) { setImportRecurringError('File kosong atau tidak ada data di bawah header.'); return; }
      // Kolom: Nama Kegiatan | Tanggal (1-31) | Kategori | Nama PIC | No WA PIC
      const parsed = rows.map(r => ({
        ...r,
        day_of_month: r.date, // kolom ke-2 di template rutin = tanggal 1-31
        date: undefined,
      }));
      const withValidation = parsed.map(r => ({ ...r, errors: validateRecurringRow(r) }));
      setImportRecurringPreview(withValidation);
    } catch {
      setImportRecurringError('Gagal membaca file. Pastikan file berformat .xlsx atau .csv.');
    }
  };

  const handleImportRecurringSubmit = async () => {
    const validRows = importRecurringPreview.filter(r => r.errors.length === 0);
    if (validRows.length === 0) { alert('Tidak ada baris yang valid untuk diimpor.'); return; }
    setIsImportingRecurring(true);
    try {
      const payload = validRows.map(r => ({
        title: r.title,
        day_of_month: parseInt(r.day_of_month),
        category: r.category,
        picName: r.picName,
        picPhone: r.picPhone,
        is_active: true,
      }));
      const { error } = await supabase.from('recurring_events').insert(payload);
      if (error) throw error;
      alert(`✅ Berhasil mengimpor ${validRows.length} template rutin!`);
      setIsImportRecurringOpen(false);
      setImportRecurringPreview([]);
      fetchRecurringEvents();
    } catch (err) {
      alert('Gagal mengimpor: ' + err.message);
    } finally {
      setIsImportingRecurring(false);
    }
  };

  const downloadRecurringTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nama Kegiatan', 'Tanggal (1-31)', 'Kategori', 'Nama PIC', 'No WA PIC'],
      ['Rekonsiliasi Keuangan', 5, 'keu', 'Siti Rahayu', '08987654321'],
      ['Rapat Evaluasi Bulanan', 10, 'kepeg', 'Ahmad Basuki', '08123456789'],
      ['Laporan SPIDER', 15, 'spider', 'Budi Santoso', '08111222333'],
    ]);
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rutin');
    XLSX.writeFile(wb, 'template_kalcer_rutin.xlsx');
  };

  const handleDeleteRecurring = async (id) => {
    if (!confirm('Hapus template event rutin ini?')) return;
    try {
      const { error } = await supabase.from('recurring_events').delete().eq('id', id);
      if (error) throw error;
      setRecurringEvents(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  const handleToggleRecurring = async (id, currentActive) => {
    try {
      const { error } = await supabase
        .from('recurring_events')
        .update({ is_active: !currentActive })
        .eq('id', id);
      if (error) throw error;
      setRecurringEvents(prev => prev.map(r => r.id === id ? { ...r, is_active: !currentActive } : r));
    } catch (err) {
      alert('Gagal mengubah status: ' + err.message);
    }
  };

  const handleGenerateMonth = async () => {
    const activeTemplates = recurringEvents.filter(r => r.is_active);
    if (activeTemplates.length === 0) { alert('Tidak ada template rutin yang aktif.'); return; }
    setIsGenerating(true);
    setGenerateResult(null);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const toInsert = [];
      const skipped = [];

      for (const tmpl of activeTemplates) {
        const day = Math.min(tmpl.day_of_month, daysInMonth);
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Cek apakah sudah ada event dengan judul & tanggal yang sama
        const exists = events.some(e => e.title === tmpl.title && e.date === dateStr);
        if (exists) {
          skipped.push(tmpl.title);
        } else {
          toInsert.push({
            title: tmpl.title, date: dateStr,
            category: tmpl.category, picName: tmpl.picName,
            picPhone: tmpl.picPhone, status: 'pending'
          });
        }
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('events').insert(toInsert);
        if (error) throw error;
        fetchEvents();
      }

      setGenerateResult({ inserted: toInsert.length, skipped: skipped.length, skippedNames: skipped });
    } catch (err) {
      alert('Gagal generate: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal kegiatan ini?')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert('Gagal menghapus kegiatan: ' + err.message);
    }
  };

  // ============================================================
  // KIRIM WA — via Edge Function /blast/{id}
  // ============================================================
  const handleSendReminder = async (id) => {
    setIsLoading(true);
    try {
      const res = await callBlastFunction(`/blast/${id}`);
      if (!res) return;
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ Pengingat WA berhasil dikirim!`);
        fetchEvents();
      } else {
        alert('❌ Gagal mengirim: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // BLASTING H-N — via Edge Function /blast/hN
  // ============================================================
  const BLAST_OPTIONS = [
    { key: 'h7', days: 7,  label: 'H-7', desc: '7 hari lagi',  color: 'purple' },
    { key: 'h3', days: 3,  label: 'H-3', desc: '3 hari lagi',  color: 'blue'   },
    { key: 'h2', days: 2,  label: 'H-2', desc: '2 hari lagi',  color: 'orange' },
    { key: 'h1', days: 1,  label: 'H-1', desc: 'besok',        color: 'green'  },
  ];

  const handleBlast = async (option) => {
    if (!fonnteToken) {
      alert('Token Fonnte belum diisi! Silakan masuk ke tab Pengaturan terlebih dahulu.');
      setActiveTab('settings');
      return;
    }
    setIsLoading(option.key);
    setLastBlastKey(option.key);
    try {
      const res = await callBlastFunction(`/blast/${option.key}`);
      if (!res) return;
      const data = await res.json();
      setBlastResults(prev => ({ ...prev, [option.key]: data }));
      fetchEvents();
    } catch (err) {
      setBlastResults(prev => ({ ...prev, [option.key]: { error: err.message } }));
    } finally {
      setIsLoading(null);
    }
  };


  // ============================================================
  // KALENDER HELPERS
  // ============================================================
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    // 0=Minggu, 1=Senin, dst. Kita geser agar Senin = 0
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };
  const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const prevMonth = () => setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const todayStr = new Date().toISOString().split('T')[0];

  // ============================================================
  // RENDER HELPERS
  // ============================================================
  const NavButton = ({ id, icon: Icon, label, badge }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`relative flex items-center space-x-2 px-4 py-2 rounded-full text-sm transition-all duration-200 ${
        activeTab === id
          ? 'bg-black text-white font-medium shadow-md'
          : 'text-gray-500 hover:text-black hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      {badge > 0 && (
        <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          activeTab === id ? 'bg-white text-black' : 'bg-black text-white'
        }`}>{badge}</span>
      )}
    </button>
  );

  const StatusBadge = ({ status }) => {
    if (status === 'confirmed') return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Terkonfirmasi</span>;
    if (status === 'reminded')  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700"><Clock className="w-3 h-3 mr-1" />Menunggu</span>;
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><Bell className="w-3 h-3 mr-1" />Terjadwal</span>;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 selection:bg-black selection:text-white">

      {/* ─── Top Navigation ─── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">KALCER</h1>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <NavButton id="dashboard"  icon={LayoutGrid}   label="Overview" />
            <NavButton id="calendar"   icon={CalendarIcon} label="Calendar" />
            <NavButton id="list"       icon={ListIcon}     label="Schedules" />
            <NavButton id="recurring"  icon={Repeat}       label="Rutin" badge={recurringEvents.filter(r => r.is_active).length} />
            <NavButton id="blast"      icon={Zap}          label="Blasting" />
            <NavButton id="settings"   icon={Settings}     label="Pengaturan" />
          </nav>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => { setImportPreview([]); setImportError(''); setIsImportModalOpen(true); }}
              title="Import dari Excel"
              className="flex items-center space-x-2 border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-black px-4 py-2 rounded-full text-sm font-medium transition-all hover:shadow-sm active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden lg:inline">Import Excel</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-2 bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Event</span>
            </button>
          </div>

          {/* User info + logout */}
          <div className="hidden md:flex items-center space-x-3 ml-3 pl-3 border-l border-gray-200">
            <span className="text-xs text-gray-400 max-w-[140px] truncate" title={session?.user?.email}>
              {session?.user?.email}
            </span>
            <button
              onClick={handleLogout}
              title="Keluar"
              className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* ══════════════════════════════
            DASHBOARD TAB
        ══════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-500">Total Kegiatan</p>
                  <CalendarIcon className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-4xl font-light tracking-tight">{events.length}</p>
                <p className="text-xs text-gray-400 mt-2">Seluruh Jadwal</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-500">Menunggu Respon</p>
                  <Clock className="w-5 h-5 text-orange-400" />
                </div>
                <p className="text-4xl font-light tracking-tight">{events.filter(e => e.status === 'reminded').length}</p>
                <p className="text-xs text-gray-400 mt-2">Telah dikirimi pengingat</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-500">Terkonfirmasi</p>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-4xl font-light tracking-tight">{events.filter(e => e.status === 'confirmed').length}</p>
                <p className="text-xs text-gray-400 mt-2">PIC membalas "Siap/Ok"</p>
              </div>
            </div>

            {/* Kegiatan Mendatang */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Kegiatan Mendatang</h3>
                <button onClick={fetchEvents} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {events.length === 0 ? (
                  <p className="p-8 text-center text-sm text-gray-400">Belum ada kegiatan terjadwal.</p>
                ) : (
                  events.slice(0, 5).map((event, idx) => {
                    const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
                    return (
                      <div key={event.id} className={`flex items-center justify-between p-5 ${idx !== 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}>
                        <div className="flex items-center space-x-4">
                          <div className={`w-2.5 h-2.5 rounded-full ${cat.dot}`} />
                          <div>
                            <h4 className="font-medium text-gray-900">{event.title}</h4>
                            <p className="text-sm text-gray-500 mt-0.5">{event.date} • {event.picName} ({event.picPhone})</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <StatusBadge status={event.status} />
                          {event.status !== 'confirmed' && fonnteToken && (
                            <button
                              onClick={() => handleSendReminder(event.id)}
                              disabled={isLoading}
                              className="p-2 rounded-full text-gray-400 hover:text-green-600 hover:bg-green-50 active:scale-95 transition-all"
                              title="Kirim pengingat WA sekarang"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Banner token belum diisi */}
            {!fonnteToken && (
              <div className="flex items-start space-x-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Token Fonnte Belum Diisi</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Untuk mengaktifkan pengiriman WhatsApp, masukkan Token API Fonnte di tab{' '}
                    <button onClick={() => setActiveTab('settings')} className="underline font-medium">Pengaturan</button>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            CALENDAR TAB
        ══════════════════════════════ */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 animate-in fade-in duration-500 min-h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center space-x-4">
                <button onClick={prevMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-2xl font-light">{MONTH_NAMES[calMonth.month]} {calMonth.year}</h2>
                <button onClick={nextMonth} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {CATEGORIES.map(c => (
                  <div key={c.id} className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                    <span className="text-xs text-gray-500">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-xl overflow-hidden flex-1">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                <div key={d} className="bg-white text-center text-xs font-medium text-gray-400 py-3 uppercase tracking-wider">{d}</div>
              ))}
              {(() => {
                const { year, month } = calMonth;
                const daysInMonth = getDaysInMonth(year, month);
                const firstDay = getFirstDayOfMonth(year, month);
                const cells = [];
                // Empty cells for alignment
                for (let i = 0; i < firstDay; i++) {
                  cells.push(<div key={`empty-${i}`} className="bg-white min-h-[100px] opacity-30" />);
                }
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = events.filter(e => e.date === dateStr);
                  const isToday = dateStr === todayStr;
                  cells.push(
                    <div key={day} className="bg-white min-h-[100px] p-3 hover:bg-gray-50 transition-colors">
                      <span className={`text-sm inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-black text-white' : 'text-gray-600'}`}>{day}</span>
                      <div className="mt-2 space-y-1.5">
                        {dayEvents.map(e => {
                          const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                          return (
                            <div key={e.id} className={`text-[11px] truncate px-2 py-1 rounded-md bg-gray-50 border border-gray-100 ${cat.text}`} title={e.title}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cat.dot}`} />
                              {e.title}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            LIST / SCHEDULES TAB
        ══════════════════════════════ */}
        {activeTab === 'list' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider">Kegiatan</th>
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider">Kategori</th>
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider">PIC & Kontak</th>
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-5 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {events.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-400">Belum ada kegiatan terjadwal.</td></tr>
                  ) : (
                    events.map(event => {
                      const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
                      return (
                        <tr key={event.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{event.date}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center space-x-1.5 text-sm ${cat.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                              <span>{cat.name}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{event.picName}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{event.picPhone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap flex flex-col items-start gap-1">
                            <StatusBadge status={event.status} />
                            {event.evidence_url && (
                              <a href={event.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
                                <ExternalLink className="w-3 h-3 mr-1" /> Lihat Bukti
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleSendReminder(event.id)}
                              disabled={event.status === 'confirmed' || !fonnteToken || isLoading}
                              title={!fonnteToken ? 'Isi token Fonnte di Pengaturan' : 'Kirim pengingat WhatsApp'}
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                                event.status === 'confirmed'
                                  ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : !fonnteToken
                                  ? 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                                  : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              }`}
                            >
                              <Send className="w-3.5 h-3.5 mr-1" />
                              Kirim WA
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUploadEvent(event);
                                setIsUploadModalOpen(true);
                              }}
                              title="Upload Bukti Tindak Lanjut"
                              className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all active:scale-95"
                            >
                              <Upload className="w-3.5 h-3.5 mr-1" />
                              Bukti
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              title="Hapus kegiatan"
                              className="inline-flex items-center p-1.5 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            RECURRING TAB
        ══════════════════════════════ */}
        {activeTab === 'recurring' && (
          <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Event Rutin Bulanan</h2>
                <p className="text-sm text-gray-500 mt-1">Template kegiatan yang berulang setiap bulan pada tanggal yang sama.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateMonth}
                  disabled={isGenerating}
                  className="flex items-center space-x-2 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-5 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Memproses...' : 'Generate Bulan Ini'}</span>
                </button>
                <button
                  onClick={() => { setImportRecurringPreview([]); setImportRecurringError(''); setIsImportRecurringOpen(true); }}
                  className="flex items-center space-x-2 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 px-4 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">Import Excel</span>
                </button>
                <button
                  onClick={() => setIsRecurringModalOpen(true)}
                  className="flex items-center space-x-2 bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Rutin</span>
                </button>
              </div>
            </div>

            {/* Generate result banner */}
            {generateResult && (
              <div className={`flex items-start space-x-3 rounded-2xl p-5 border ${
                generateResult.inserted > 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <CheckCircle className={`w-5 h-5 mt-0.5 shrink-0 ${generateResult.inserted > 0 ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div className="text-sm">
                  <p className="font-semibold">
                    {generateResult.inserted > 0
                      ? `${generateResult.inserted} event berhasil dibuat untuk bulan ini!`
                      : 'Semua event rutin sudah ada untuk bulan ini.'}
                  </p>
                  {generateResult.skipped > 0 && (
                    <p className="text-gray-500 mt-1">{generateResult.skipped} event dilewati (sudah ada): {generateResult.skippedNames.join(', ')}</p>
                  )}
                </div>
                <button onClick={() => setGenerateResult(null)} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* List recurring events */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {recurringEvents.length === 0 ? (
                <div className="p-16 text-center">
                  <Repeat className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                  <p className="text-sm text-gray-400 font-medium">Belum ada template event rutin.</p>
                  <p className="text-xs text-gray-300 mt-1">Klik "Tambah Rutin" untuk membuat template.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recurringEvents.map((rec) => {
                    const cat = CATEGORIES.find(c => c.id === rec.category) || CATEGORIES[0];
                    return (
                      <div key={rec.id} className={`flex items-center justify-between p-5 transition-colors ${
                        rec.is_active ? 'hover:bg-gray-50/50' : 'opacity-50 bg-gray-50/30'
                      }`}>
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center text-white shrink-0 ${
                            rec.is_active ? cat.color : 'bg-gray-300'
                          }`}>
                            <span className="text-[10px] font-medium leading-none">Tgl</span>
                            <span className="text-lg font-bold leading-none">{rec.day_of_month}</span>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{rec.title}</h4>
                            <p className="text-sm text-gray-500 mt-0.5">
                              <span className={`inline-flex items-center space-x-1 ${cat.text} mr-3`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
                                <span>{cat.name}</span>
                              </span>
                              {rec.picName} · {rec.picPhone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            rec.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                          }`}>{rec.is_active ? 'Aktif' : 'Nonaktif'}</span>
                          <button
                            onClick={() => handleToggleRecurring(rec.id, rec.is_active)}
                            title={rec.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            {rec.is_active
                              ? <ToggleRight className="w-5 h-5 text-emerald-500" />
                              : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteRecurring(rec.id)}
                            title="Hapus template"
                            className="p-2 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
              <p className="font-semibold mb-1">💡 Cara kerja Generate Bulan Ini</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600">
                <li>Sistem membaca semua template rutin yang berstatus <strong>Aktif</strong>.</li>
                <li>Untuk setiap template, sistem menghitung tanggal di bulan berjalan (misal: tgl 5 → 2026-08-05).</li>
                <li>Jika event dengan judul & tanggal yang sama belum ada, event baru dibuat dengan status <em>Terjadwal</em>.</li>
                <li>Klik tombol ini sekali di awal setiap bulan, atau kapanpun Anda butuhkan.</li>
              </ol>
            </div>
          </div>
        )}

        {/* ══════════════════════════════
            BLASTING TAB
        ══════════════════════════════ */}
        {activeTab === 'blast' && (
          <div className="space-y-6 animate-in fade-in duration-500">

            {!fonnteToken && (
              <div className="flex items-start space-x-3 bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Token Fonnte Belum Diisi</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Untuk mengaktifkan blasting, masukkan Token Fonnte di tab{' '}
                    <button onClick={() => setActiveTab('settings')} className="underline font-medium">Pengaturan →</button>
                  </p>
                </div>
              </div>
            )}

            {/* Grid 4 Kartu Blasting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {BLAST_OPTIONS.map((option) => {
                const targetDate = (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + option.days);
                  return d.toISOString().split('T')[0];
                })();
                const pendingEvents = events.filter(e => e.date === targetDate && e.status === 'pending');
                const isThisLoading = isLoading === option.key;

                const colorMap = {
                  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', btn: 'bg-purple-600 hover:bg-purple-500 shadow-purple-200', dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-700' },
                  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   btn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-200',     dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700'   },
                  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', btn: 'bg-orange-600 hover:bg-orange-500 shadow-orange-200', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
                  green:  { bg: 'bg-green-50',  border: 'border-green-200',  icon: 'text-green-600',  btn: 'bg-green-600 hover:bg-green-500 shadow-green-200',   dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700'  },
                };
                const c = colorMap[option.color];

                return (
                  <div key={option.key} className="bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    {/* Header kartu */}
                    <div className={`flex items-center justify-between px-5 py-4 ${c.bg} border-b ${c.border}`}>
                      <div className="flex items-center space-x-2">
                        <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                          <Zap className={`w-4 h-4 ${c.icon}`} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{option.label}</p>
                          <p className="text-xs text-gray-500">{option.desc}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
                        {pendingEvents.length} pending
                      </span>
                    </div>

                    {/* Daftar event preview */}
                    <div className="flex-1 p-4 space-y-1.5 min-h-[120px]">
                      {pendingEvents.length === 0 ? (
                        <p className="text-xs text-gray-400 italic text-center pt-6">
                          Tidak ada jadwal pending<br />
                          <span className="font-mono text-[10px]">{targetDate}</span>
                        </p>
                      ) : (
                        pendingEvents.map(e => {
                          const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                          return (
                            <div key={e.id} className="flex items-center space-x-2 py-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat.dot}`} />
                              <span className="text-xs text-gray-700 truncate font-medium">{e.title}</span>
                              <span className="text-[10px] text-gray-400 shrink-0">— {e.picName}</span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Tombol blast */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => handleBlast(option)}
                        disabled={!!isLoading || !fonnteToken}
                        className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center space-x-1.5 shadow-lg ${
                          !fonnteToken
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                            : isThisLoading
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed shadow-none'
                            : `${c.btn} text-white`
                        }`}
                      >
                        {isThisLoading
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Mengirim...</span></>
                          : <><Zap className="w-3.5 h-3.5" /><span>BLAST {option.label}</span></>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Console Hasil Blasting */}
            <div className="bg-[#0D1117] rounded-3xl overflow-hidden border border-gray-800">
              <div className="bg-[#161B22] px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Send className="w-4 h-4 text-gray-400" />
                  <h3 className="text-gray-200 font-mono text-sm tracking-wide">BLAST_RESULT_CONSOLE</h3>
                </div>
                {lastBlastKey && blastResults[lastBlastKey] && (
                  <span className="text-xs font-mono text-gray-500">last: /{lastBlastKey}</span>
                )}
              </div>
              <div className="p-6 font-mono text-xs text-gray-400 min-h-[200px] max-h-[340px] overflow-y-auto space-y-2">
                {!lastBlastKey || !blastResults[lastBlastKey] ? (
                  <div className="flex flex-col items-center justify-center h-40 space-y-2 opacity-40">
                    <Zap className="w-8 h-8" />
                    <p>Tekan salah satu tombol BLAST di atas untuk melihat hasilnya di sini.</p>
                  </div>
                ) : (() => {
                  const result = blastResults[lastBlastKey];
                  if (result.error) return (
                    <div className="text-red-400 space-y-1">
                      <p className="text-red-500 font-semibold">● ERROR</p>
                      <p>{result.error}</p>
                    </div>
                  );
                  return (
                    <div className="space-y-3">
                      <div className="text-green-400 font-semibold">
                        ● Blasting H-{result.daysAhead || lastBlastKey?.replace('h','')}: {result.sent}/{result.total} pesan terkirim untuk {result.date}
                      </div>
                      {result.message && <p className="text-gray-500">{result.message}</p>}
                      {result.results?.map((r, i) => (
                        <div key={i} className={`flex items-start space-x-2 ${r.success ? 'text-gray-300' : 'text-red-400'}`}>
                          <span>{r.success ? '✅' : '❌'}</span>
                          <div>
                            <span className="font-medium">{r.title}</span>
                            <span className="text-gray-500"> — {r.picName} ({r.picPhone})</span>
                            {!r.success && <p className="text-red-400 text-[10px] mt-0.5">{r.message}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}


        {/* ══════════════════════════════
            SETTINGS TAB
        ══════════════════════════════ */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Pengaturan Gateway WhatsApp</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Aplikasi ini menggunakan{' '}
                  <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center space-x-1">
                    <span>Fonnte</span><ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  sebagai gateway WhatsApp. Daftarkan nomor WA Anda di Fonnte dan salin API Token-nya ke sini.
                </p>
              </div>

              {/* Token Input */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Fonnte API Token</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value)}
                    placeholder="Paste token Fonnte Anda di sini..."
                    className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:border-black focus:outline-none text-sm font-mono bg-gray-50 transition-colors"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Token disimpan di browser Anda (localStorage) dan tidak dikirim ke server kami.</p>
              </div>

              <button
                onClick={handleSaveToken}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-full text-sm font-medium transition-all active:scale-95 ${
                  tokenSaved
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-black text-white hover:bg-gray-800 shadow-sm'
                }`}
              >
                {tokenSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{tokenSaved ? 'Tersimpan!' : 'Simpan Token'}</span>
              </button>

              {fonnteToken && (
                <div className="flex items-center space-x-2 text-green-700 bg-green-50 border border-green-100 rounded-xl p-4">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <p className="text-sm">Token Fonnte sudah aktif. Fitur pengiriman WhatsApp siap digunakan.</p>
                </div>
              )}
            </div>

            {/* Panduan Setup Fonnte */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">Cara Mendapatkan Token Fonnte</h4>
              <ol className="space-y-3 text-sm text-gray-600">
                {[
                  <>Daftar di <a href="https://fonnte.com" target="_blank" rel="noreferrer" className="text-blue-600 underline">fonnte.com</a> dan login ke dashboard.</>,
                  'Klik "Add Device" dan ikuti instruksi untuk menghubungkan nomor WhatsApp Anda.',
                  'Setelah perangkat terhubung, salin API Token yang ditampilkan di dashboard.',
                  'Paste token tersebut di kolom di atas dan klik "Simpan Token".',
                  <>Opsional: Daftarkan Webhook URL di Fonnte agar balasan PIC diproses otomatis:<br /><code className="bg-gray-100 px-2 py-0.5 rounded text-xs mt-1 inline-block">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-reply</code></>,
                ].map((step, i) => (
                  <li key={i} className="flex items-start space-x-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-black text-white text-xs flex items-center justify-center font-medium mt-0.5">{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Supabase Info */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Informasi Supabase</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="font-medium text-gray-500">Project URL</span>
                  <span className="font-mono text-xs text-gray-700 truncate max-w-[280px]">{import.meta.env.VITE_SUPABASE_URL}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="font-medium text-gray-500">Webhook URL</span>
                  <a
                    href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-reply`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-blue-600 underline inline-flex items-center space-x-1 truncate max-w-[280px]"
                  >
                    <Link className="w-3 h-3 shrink-0" />
                    <span>receive-reply</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ─── Modal Jadwal Baru ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Buat Jadwal Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nama Kegiatan</label>
                  <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                    placeholder="Contoh: Rapat Evaluasi Bulanan" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tanggal</label>
                    <input required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Kategori</label>
                    <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 cursor-pointer">
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi PIC</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nama PIC</label>
                    <input required type="text" value={formData.picName} onChange={e => setFormData({ ...formData, picName: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                      placeholder="Contoh: Ahmad" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nomor WhatsApp</label>
                    <input required type="tel" value={formData.picPhone} onChange={e => setFormData({ ...formData, picPhone: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                      placeholder="Contoh: 08123456789" />
                  </div>
                </div>
              </div>

              <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors shadow-sm">Simpan Jadwal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Import Excel ─── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Import dari Excel</h3>
                  <p className="text-xs text-gray-400">Format: .xlsx atau .csv</p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {/* Drop zone */}
              {importPreview.length === 0 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFileChange(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-black bg-gray-50 scale-[1.01]'
                      : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-600">Drag & drop file Excel di sini</p>
                  <p className="text-xs text-gray-400 mt-1">atau klik untuk memilih file</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileChange(e.target.files[0])}
                  />
                </div>
              )}

              {/* Error */}
              {importError && (
                <div className="flex items-center space-x-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{importError}</p>
                </div>
              )}

              {/* Preview table */}
              {importPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Preview: <span className="text-black">{importPreview.length} baris</span>
                      {importPreview.filter(r => r.errors.length > 0).length > 0 && (
                        <span className="ml-2 text-red-500">({importPreview.filter(r => r.errors.length > 0).length} error)</span>
                      )}
                    </p>
                    <button
                      onClick={() => { setImportPreview([]); setImportError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >Ganti file</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Baris</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nama Kegiatan</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tanggal</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kategori</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">PIC</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">No WA</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importPreview.map((row) => (
                          <tr key={row.rowNum} className={row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{row.rowNum}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[150px] truncate">{row.title || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.date || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5">
                              {(() => { const c = CATEGORIES.find(c => c.id === row.category); return c ? <span className={`text-xs ${c.text}`}>{c.name}</span> : <span className="text-red-400 text-xs">{row.category || '—'}</span>; })()}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{row.picName || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5 text-gray-600">{row.picPhone || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5">
                              {row.errors.length === 0
                                ? <span className="text-xs text-emerald-600 font-medium">✓ Valid</span>
                                : <span className="text-xs text-red-500" title={row.errors.join(', ')}>✗ {row.errors[0]}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Download template */}
              <div className="flex items-center justify-between py-4 border-t border-gray-50">
                <div>
                  <p className="text-xs font-medium text-gray-500">Belum punya template?</p>
                  <p className="text-xs text-gray-400">Download template Excel dengan format yang sudah benar.</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center space-x-2 border border-gray-200 hover:border-gray-400 px-4 py-2 rounded-full text-sm text-gray-600 hover:text-black transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            {importPreview.length > 0 && (
              <div className="px-8 py-5 border-t border-gray-100 flex justify-between items-center shrink-0">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-emerald-600">{importPreview.filter(r => r.errors.length === 0).length} valid</span>
                  {importPreview.filter(r => r.errors.length > 0).length > 0 && (
                    <span className="ml-2 text-red-500">{importPreview.filter(r => r.errors.length > 0).length} error (akan dilewati)</span>
                  )}
                </p>
                <div className="flex space-x-3">
                  <button onClick={() => setIsImportModalOpen(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors">Batal</button>
                  <button
                    onClick={handleImportSubmit}
                    disabled={isImporting || importPreview.filter(r => r.errors.length === 0).length === 0}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-black hover:bg-gray-800 disabled:bg-gray-300 text-white text-sm font-medium rounded-full transition-colors shadow-sm"
                  >
                    {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{isImporting ? 'Mengimpor...' : `Import ${importPreview.filter(r => r.errors.length === 0).length} Event`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal Tambah Event Rutin ─── */}
      {isRecurringModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                  <Repeat className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Tambah Event Rutin</h3>
              </div>
              <button onClick={() => setIsRecurringModalOpen(false)} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddRecurring} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nama Kegiatan</label>
                  <input required type="text" value={recurringForm.title} onChange={e => setRecurringForm({ ...recurringForm, title: e.target.value })}
                    className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                    placeholder="Contoh: Rekonsiliasi Keuangan Bulanan" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tanggal Setiap Bulan</label>
                    <div className="flex items-center space-x-2 border-b-2 border-gray-200 focus-within:border-black transition-colors py-2">
                      <input
                        required type="number" min="1" max="31"
                        value={recurringForm.day_of_month}
                        onChange={e => setRecurringForm({ ...recurringForm, day_of_month: parseInt(e.target.value) || 1 })}
                        className="w-16 bg-transparent outline-none text-gray-900 text-2xl font-light"
                      />
                      <span className="text-sm text-gray-400">setiap bulan</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Jika bulan pendek, otomatis pakai hari terakhir.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Kategori</label>
                    <select value={recurringForm.category} onChange={e => setRecurringForm({ ...recurringForm, category: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 cursor-pointer">
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi PIC</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nama PIC</label>
                    <input required type="text" value={recurringForm.picName} onChange={e => setRecurringForm({ ...recurringForm, picName: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                      placeholder="Contoh: Siti Rahayu" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Nomor WhatsApp</label>
                    <input required type="tel" value={recurringForm.picPhone} onChange={e => setRecurringForm({ ...recurringForm, picPhone: e.target.value })}
                      className="w-full px-0 py-2 border-0 border-b-2 border-gray-200 focus:border-black bg-transparent outline-none transition-colors text-gray-900 placeholder-gray-300"
                      placeholder="Contoh: 08123456789" />
                  </div>
                </div>
              </div>

              <div className="pt-8 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsRecurringModalOpen(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors">Batal</button>
                <button type="submit" className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-full transition-colors shadow-sm">Simpan Template</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Import Excel Rutin ─── */}
      {isImportRecurringOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Import Template Rutin dari Excel</h3>
                  <p className="text-xs text-gray-400">Format: .xlsx atau .csv</p>
                </div>
              </div>
              <button onClick={() => setIsImportRecurringOpen(false)} className="text-gray-400 hover:text-black transition-colors rounded-full p-1 hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-8 space-y-6">
              {/* Drop zone */}
              {importRecurringPreview.length === 0 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOverRecurring(true); }}
                  onDragLeave={() => setIsDragOverRecurring(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setIsDragOverRecurring(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleRecurringFileChange(file);
                  }}
                  onClick={() => fileInputRecurringRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragOverRecurring
                      ? 'border-violet-500 bg-violet-50 scale-[1.01]'
                      : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/30'
                  }`}
                >
                  <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-600">Drag & drop file Excel di sini</p>
                  <p className="text-xs text-gray-400 mt-1">atau klik untuk memilih file</p>
                  <input
                    ref={fileInputRecurringRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleRecurringFileChange(e.target.files[0])}
                  />
                </div>
              )}

              {/* Error */}
              {importRecurringError && (
                <div className="flex items-center space-x-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{importRecurringError}</p>
                </div>
              )}

              {/* Preview table */}
              {importRecurringPreview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">
                      Preview: <span className="text-black">{importRecurringPreview.length} baris</span>
                      {importRecurringPreview.filter(r => r.errors.length > 0).length > 0 && (
                        <span className="ml-2 text-red-500">({importRecurringPreview.filter(r => r.errors.length > 0).length} error)</span>
                      )}
                    </p>
                    <button
                      onClick={() => { setImportRecurringPreview([]); setImportRecurringError(''); if (fileInputRecurringRef.current) fileInputRecurringRef.current.value = ''; }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >Ganti file</button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Baris</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Nama Kegiatan</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tgl/Bln</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Kategori</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">PIC</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">No WA</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importRecurringPreview.map((row) => (
                          <tr key={row.rowNum} className={row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-2.5 text-gray-400 text-xs">{row.rowNum}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[150px] truncate">{row.title || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5 text-gray-600 font-semibold">
                              {row.day_of_month ? `Tgl ${row.day_of_month}` : <span className="text-red-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {(() => { const c = CATEGORIES.find(c => c.id === row.category); return c ? <span className={`text-xs ${c.text}`}>{c.name}</span> : <span className="text-red-400 text-xs">{row.category || '—'}</span>; })()}
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{row.picName || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5 text-gray-600">{row.picPhone || <span className="text-red-400">—</span>}</td>
                            <td className="px-3 py-2.5">
                              {row.errors.length === 0
                                ? <span className="text-xs text-emerald-600 font-medium">✓ Valid</span>
                                : <span className="text-xs text-red-500" title={row.errors.join(', ')}>✗ {row.errors[0]}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Format info + Download template */}
              <div className="flex items-center justify-between py-4 border-t border-gray-50">
                <div>
                  <p className="text-xs font-medium text-gray-500">Format kolom Excel:</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Nama Kegiatan | Tanggal (1-31) | Kategori | Nama PIC | No WA PIC</p>
                </div>
                <button
                  onClick={downloadRecurringTemplate}
                  className="flex items-center space-x-2 border border-gray-200 hover:border-violet-300 hover:text-violet-700 px-4 py-2 rounded-full text-sm text-gray-600 transition-colors shrink-0 ml-4"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Template</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            {importRecurringPreview.length > 0 && (
              <div className="px-8 py-5 border-t border-gray-100 flex justify-between items-center shrink-0">
                <p className="text-sm text-gray-500">
                  <span className="font-medium text-emerald-600">{importRecurringPreview.filter(r => r.errors.length === 0).length} valid</span>
                  {importRecurringPreview.filter(r => r.errors.length > 0).length > 0 && (
                    <span className="ml-2 text-red-500">{importRecurringPreview.filter(r => r.errors.length > 0).length} error (akan dilewati)</span>
                  )}
                </p>
                <div className="flex space-x-3">
                  <button onClick={() => setIsImportRecurringOpen(false)} className="px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-full transition-colors">Batal</button>
                  <button
                    onClick={handleImportRecurringSubmit}
                    disabled={isImportingRecurring || importRecurringPreview.filter(r => r.errors.length === 0).length === 0}
                    className="flex items-center space-x-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-300 text-white text-sm font-medium rounded-full transition-colors shadow-sm"
                  >
                    {isImportingRecurring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{isImportingRecurring ? 'Mengimpor...' : `Import ${importRecurringPreview.filter(r => r.errors.length === 0).length} Template`}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ─── Modal Upload Bukti ─── */}
      {isUploadModalOpen && selectedUploadEvent && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Upload Bukti Tindak Lanjut</h3>
              <button onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }} className="text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadEvidence} className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Kegiatan:</p>
                <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">{selectedUploadEvent.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pilih File (Gambar/PDF)</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-blue-400 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="text-sm text-gray-500">
                        {uploadFile ? (
                          <span className="font-semibold text-blue-600">{uploadFile.name}</span>
                        ) : (
                          <><span className="font-semibold">Klik untuk upload</span> atau drag and drop</>
                        )}
                      </p>
                      {!uploadFile && <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF (Max. 5MB)</p>}
                    </div>
                    <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" onChange={(e) => setUploadFile(e.target.files[0])} />
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button type="button" onClick={() => { setIsUploadModalOpen(false); setUploadFile(null); }} className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-full">Batal</button>
                <button type="submit" disabled={!uploadFile || isUploading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-full shadow-sm flex items-center">
                  {isUploading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {isUploading ? 'Mengunggah...' : 'Simpan Bukti'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}