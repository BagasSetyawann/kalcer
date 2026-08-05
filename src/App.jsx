import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon, Clock, CheckCircle, X, Bell,
  Plus, LayoutGrid, List as ListIcon, Settings, RefreshCw,
  Send, AlertCircle, Zap, Link, ExternalLink, Save, Eye, EyeOff
} from 'lucide-react';
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
const FONNTE_TOKEN_KEY = 'kalremind_fonnte_token';

export default function App() {
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [events, setEvents]             = useState([]);
  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [blastResult, setBlastResult]   = useState(null); // Hasil blasting H-1

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

  // Load awal + realtime subscription
  useEffect(() => {
    fetchEvents();
    tokenInput === '' && setTokenInput(fonnteToken);

    // Supabase Realtime: Update UI otomatis ketika ada perubahan di DB
    const channel = supabase
      .channel('events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchEvents();
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
  // BLASTING H-1 — via Edge Function /blast/h1
  // ============================================================
  const handleBlastH1 = async () => {
    if (!fonnteToken) {
      alert('Token Fonnte belum diisi! Silakan masuk ke tab Pengaturan terlebih dahulu.');
      setActiveTab('settings');
      return;
    }
    setIsLoading(true);
    setBlastResult(null);
    try {
      const res = await callBlastFunction('/blast/h1');
      if (!res) return;
      const data = await res.json();
      setBlastResult(data);
      fetchEvents();
    } catch (err) {
      setBlastResult({ error: err.message });
    } finally {
      setIsLoading(false);
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
  const NavButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm transition-all duration-200 ${
        activeTab === id
          ? 'bg-black text-white font-medium shadow-md'
          : 'text-gray-500 hover:text-black hover:bg-gray-100'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
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
            <h1 className="text-lg font-semibold tracking-tight">KalRemind</h1>
          </div>

          <nav className="hidden md:flex items-center space-x-1">
            <NavButton id="dashboard" icon={LayoutGrid}   label="Overview" />
            <NavButton id="calendar"  icon={CalendarIcon} label="Calendar" />
            <NavButton id="list"      icon={ListIcon}     label="Schedules" />
            <NavButton id="blast"     icon={Zap}          label="Blasting" />
            <NavButton id="settings"  icon={Settings}     label="Pengaturan" />
          </nav>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={event.status} />
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
            BLASTING TAB
        ══════════════════════════════ */}
        {activeTab === 'blast' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Panel Blasting H-1 */}
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center">
                    <Zap className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Blasting H-1</h3>
                    <p className="text-xs text-gray-400">Kirim pengingat massal ke semua PIC yang jadwalnya besok</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Jadwal H-1 (besok)</p>
                  {(() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowStr = tomorrow.toISOString().split('T')[0];
                    const h1Events = events.filter(e => e.date === tomorrowStr && e.status === 'pending');
                    if (h1Events.length === 0) return (
                      <p className="text-sm text-gray-400 italic">Tidak ada jadwal H-1 yang pending untuk besok ({tomorrowStr}).</p>
                    );
                    return h1Events.map(e => {
                      const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                      return (
                        <div key={e.id} className="flex items-center space-x-2 py-1.5">
                          <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                          <span className="text-sm text-gray-700 font-medium">{e.title}</span>
                          <span className="text-xs text-gray-400">— {e.picName}</span>
                        </div>
                      );
                    });
                  })()}
                </div>

                <button
                  onClick={handleBlastH1}
                  disabled={isLoading || !fonnteToken}
                  className={`mt-6 w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center space-x-2 ${
                    !fonnteToken
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isLoading
                      ? 'bg-green-100 text-green-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-200'
                  }`}
                >
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>{isLoading ? 'Mengirim...' : 'BLASTING H-1 SEKARANG'}</span>
                </button>

                {!fonnteToken && (
                  <p className="mt-3 text-xs text-center text-amber-600">
                    Token Fonnte belum diisi.{' '}
                    <button onClick={() => setActiveTab('settings')} className="underline font-medium">Buka Pengaturan →</button>
                  </p>
                )}
              </div>

              {/* Panel Hasil Blasting */}
              <div className="bg-[#0D1117] rounded-3xl overflow-hidden border border-gray-800 flex flex-col min-h-[400px]">
                <div className="bg-[#161B22] px-6 py-4 border-b border-gray-800 flex items-center space-x-3">
                  <Send className="w-4 h-4 text-gray-400" />
                  <h3 className="text-gray-200 font-mono text-sm tracking-wide">BLAST_RESULT_CONSOLE</h3>
                </div>
                <div className="flex-1 p-6 font-mono text-xs text-gray-400 overflow-y-auto space-y-2">
                  {!blastResult ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-40">
                      <Zap className="w-8 h-8" />
                      <p>Tekan tombol "BLASTING H-1 SEKARANG" untuk melihat hasilnya di sini.</p>
                    </div>
                  ) : blastResult.error ? (
                    <div className="text-red-400 space-y-1">
                      <p className="text-red-500 font-semibold">● ERROR</p>
                      <p>{blastResult.error}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-green-400 font-semibold">
                        ● Blasting selesai: {blastResult.sent}/{blastResult.total} pesan terkirim untuk tanggal {blastResult.date}
                      </div>
                      {blastResult.message && <p className="text-gray-500">{blastResult.message}</p>}
                      {blastResult.results?.map((r, i) => (
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
                  )}
                </div>
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
    </div>
  );
}