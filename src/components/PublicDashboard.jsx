import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle, Bell, 
  Search, TrendingUp, ChevronLeft, ChevronRight,
  ShieldCheck, Activity, FileText, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const CATEGORIES = [
  { id: 'kepeg', name: 'Kepegawaian', color: 'bg-blue-400', text: 'text-blue-500', dot: 'bg-blue-400', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  { id: 'keu', name: 'Keuangan', color: 'bg-emerald-400', text: 'text-emerald-500', dot: 'bg-emerald-400', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
  { id: 'sakip', name: 'SAKIP', color: 'bg-violet-400', text: 'text-violet-500', dot: 'bg-violet-400', border: 'border-violet-200', lightBg: 'bg-violet-50' },
  { id: 'mr', name: 'Manajemen Risiko', color: 'bg-rose-400', text: 'text-rose-500', dot: 'bg-rose-400', border: 'border-rose-200', lightBg: 'bg-rose-50' },
  { id: 'persediaan', name: 'Persediaan', color: 'bg-amber-400', text: 'text-amber-500', dot: 'bg-amber-400', border: 'border-amber-200', lightBg: 'bg-amber-50' },
  { id: 'bmn', name: 'BMN', color: 'bg-yellow-400', text: 'text-yellow-500', dot: 'bg-yellow-400', border: 'border-yellow-200', lightBg: 'bg-yellow-50' },
  { id: 'spider', name: 'SPIDER', color: 'bg-teal-400', text: 'text-teal-500', dot: 'bg-teal-400', border: 'border-teal-200', lightBg: 'bg-teal-50' },
];

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];


export default function PublicDashboard() {
  const [events, setEvents] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, logsRes] = await Promise.all([
          supabase.from('events').select('*').order('date', { ascending: true }),
          supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20)
        ]);
        
        if (eventsRes.error) throw eventsRes.error;
        if (logsRes.error) throw logsRes.error;
        
        setEvents(eventsRes.data || []);
        setActivityLogs(logsRes.data || []);
      } catch (err) {
        console.error('Error fetching data:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const channel = supabase
      .channel('public-events-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };
  const prevMonth = () => setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const todayStr = new Date().toISOString().split('T')[0];

  const StatusBadge = ({ status }) => {
    if (status === 'confirmed') return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-600"><CheckCircle className="w-3 h-3 mr-1" />Terkonfirmasi</span>;
    if (status === 'reminded') return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-600"><Clock className="w-3 h-3 mr-1" />Menunggu</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-500"><Bell className="w-3 h-3 mr-1" />Terjadwal</span>;
  };

  // Filter events
  const filteredEvents = events.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTeam = selectedTeam === 'all' || e.category === selectedTeam;
    return matchSearch && matchTeam;
  });

  const upcomingEvents = filteredEvents.filter(e => e.date >= todayStr);
  
  // Hitung Statistik Bulan Ini
  const currentMonthPrefix = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, '0')}`;
  const monthEvents = filteredEvents.filter(e => e.date.startsWith(currentMonthPrefix));
  const totalEvents = monthEvents.length;
  const totalConfirmed = monthEvents.filter(e => e.status === 'confirmed').length;
  const totalReminded = monthEvents.filter(e => e.status === 'reminded').length;
  const totalPending = monthEvents.filter(e => e.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-sans text-gray-900">
      
      {/* ─── NAVIGATION BAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/85 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.png" alt="KALCER" className="w-11 h-11 rounded-xl object-contain" />
          </div>
          
          <div className="flex items-center space-x-3">
            <a 
              href="https://docs.google.com/forms/d/e/1FAIpQLSeKq4N6x4yezgs6mM_5AQdynRBbbG9Y6aQA6_gHYPhk14q8UA/viewform?usp=publish-editor"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-4 py-2 rounded-full text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Bukti Dukung</span>
            </a>
            <Link 
              to="/admin" 
              className="group flex items-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Login Admin</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <div className="relative pt-24 sm:pt-28 pb-8 sm:pb-12 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/40 via-white to-[#f8f9fb]" />
        <div className="relative max-w-7xl mx-auto z-10 text-center flex flex-col items-center">
          
          <div className="inline-flex items-center space-x-2 bg-white px-3 sm:px-4 py-1.5 rounded-full mb-4 sm:mb-5 border border-gray-200/60 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 tracking-wide uppercase">Realtime Dashboard</span>
          </div>
          
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-3 sm:mb-4 text-gray-800 leading-tight">
            Kalender Cerdas <br className="hidden md:block"/>
            <span className="text-indigo-500">Reminder</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-400 max-w-xl font-medium mb-6 sm:mb-10">
            Transparansi penuh untuk seluruh jadwal dan respon konfirmasi dari masing-masing penanggung jawab tim.
          </p>
          
          {/* TEAM FILTERS */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 w-full max-w-4xl pb-2 sm:flex-wrap sm:justify-center sm:overflow-visible">
            <button 
              onClick={() => setSelectedTeam('all')}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all border whitespace-nowrap shrink-0 ${
                selectedTeam === 'all' 
                  ? 'bg-gray-800 text-white border-gray-800 shadow-md shadow-gray-300/30' 
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              Semua Tim
            </button>
            {CATEGORIES.map(c => (
              <button 
                key={c.id}
                onClick={() => setSelectedTeam(c.id)}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all border whitespace-nowrap shrink-0 ${
                  selectedTeam === c.id
                    ? `${c.lightBg} ${c.text} ${c.border} shadow-sm` 
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-20 pb-20 space-y-6 sm:space-y-8">
        
        {/* ─── STATISTIK ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Total {MONTH_NAMES[calMonth.month]}</p>
              <CalendarIcon className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-indigo-300" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">{totalEvents}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Kegiatan</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-emerald-400 uppercase tracking-wider">Terkonfirmasi</p>
              <CheckCircle className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-300" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald-500">{totalConfirmed}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Siap</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-amber-400 uppercase tracking-wider">Menunggu</p>
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-300" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-amber-500">{totalReminded}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Respons</p>
          </div>
          <div className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <p className="text-[10px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">Terjadwal</p>
              <Bell className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-gray-300" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-500">{totalPending}</p>
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Menunggu H-</p>
          </div>
        </div>

        {/* ─── MAIN CONTENT GRID ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* KALENDER */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200/60 shadow-sm p-3 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-sm sm:text-lg font-bold flex items-center text-gray-700">
                  <Activity className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-indigo-400" />
                  <span className="hidden sm:inline">Agenda {MONTH_NAMES[calMonth.month]} {calMonth.year}</span>
                  <span className="sm:hidden">{MONTH_NAMES[calMonth.month].substring(0, 3)} {calMonth.year}</span>
                </h2>
                <div className="flex items-center space-x-1 bg-gray-50 rounded-full p-0.5 sm:p-1 border border-gray-100">
                  <button onClick={prevMonth} className="p-1.5 sm:p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-400 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 w-16 sm:w-24 text-center text-gray-600">{MONTH_NAMES[calMonth.month].substring(0, 3)}</span>
                  <button onClick={nextMonth} className="p-1.5 sm:p-2 rounded-full hover:bg-white hover:shadow-sm text-gray-400 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Kalender */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Mobile day headers */}
                {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
                  <div key={`m-${i}`} className="text-center text-[9px] font-semibold text-gray-400 py-1 uppercase tracking-wider sm:hidden">{d}</div>
                ))}
                {/* Desktop day headers */}
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                  <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-2 uppercase tracking-widest hidden sm:block">{d}</div>
                ))}
                {(() => {
                  const { year, month } = calMonth;
                  const daysInMonth = getDaysInMonth(year, month);
                  const firstDay = getFirstDayOfMonth(year, month);
                  const cells = [];
                  
                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="min-h-[48px] sm:min-h-[110px] rounded-lg sm:rounded-xl" />);
                  }
                  
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = filteredEvents.filter(e => e.date === dateStr);
                    const isToday = dateStr === todayStr;
                    
                    cells.push(
                      <div key={day} className={`min-h-[48px] sm:min-h-[110px] rounded-lg sm:rounded-xl p-1 sm:p-2.5 border transition-all duration-200 ${isToday ? 'bg-indigo-50/60 border-indigo-200/80 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-0.5 sm:mb-2">
                          <span className={`text-[10px] sm:text-xs font-semibold w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-200' : 'text-gray-400'}`}>{day}</span>
                          {dayEvents.length > 0 && (
                            <span className="hidden sm:inline text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">{dayEvents.length}</span>
                          )}
                        </div>
                        {/* Mobile: dots only */}
                        <div className="flex flex-wrap gap-0.5 mt-0.5 sm:hidden">
                          {dayEvents.slice(0, 3).map(e => {
                            const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                            return <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />;
                          })}
                          {dayEvents.length > 3 && <span className="text-[8px] text-gray-400">+{dayEvents.length - 3}</span>}
                        </div>
                        {/* Desktop: full labels */}
                        <div className="space-y-1 hidden sm:block">
                          {dayEvents.slice(0, 3).map(e => {
                            const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                            return (
                              <div key={e.id} className={`text-[10px] font-medium leading-snug px-2 py-1 rounded-lg ${cat.lightBg} ${cat.text} truncate`} title={e.title}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cat.dot}`} />
                                {e.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] text-gray-400 text-center pt-0.5 font-medium">+{dayEvents.length - 3} lainnya</div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            </div>
          </div>

          {/* UPCOMING & SEARCH */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5 sticky top-24">
              
              <div className="relative mb-5">
                <Search className="w-4 h-4 text-gray-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Cari kegiatan..." 
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 rounded-xl py-3 pl-10 pr-4 text-sm text-gray-700 font-medium placeholder-gray-400 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <h2 className="text-base font-bold flex items-center mb-4 text-gray-700">
                <TrendingUp className="w-4 h-4 mr-2 text-indigo-400" />
                Segera Mendatang
              </h2>
              
              {isLoading ? (
                <div className="flex flex-col space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex space-x-3 p-3 border border-gray-100 rounded-xl">
                      <div className="w-11 h-11 bg-gray-100 rounded-xl" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-gray-100 rounded w-3/4" />
                        <div className="h-2 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Semua beres!</p>
                  <p className="text-xs text-gray-400 mt-1">Tidak ada jadwal mendatang.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                  {upcomingEvents.slice(0, 10).map((event) => {
                    const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
                    const eventDate = new Date(event.date);
                    const isToday = event.date === todayStr;
                    
                    return (
                      <div key={event.id} className="group flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all border border-gray-100 hover:border-gray-200">
                        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 ${isToday ? 'bg-indigo-500 text-white shadow-sm shadow-indigo-200' : 'bg-gray-50 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                          <span className="text-[9px] uppercase font-bold tracking-wider opacity-80">{MONTH_NAMES[eventDate.getMonth()].substring(0, 3)}</span>
                          <span className="text-lg font-extrabold leading-none mt-0.5">{eventDate.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-800 truncate">{event.title}</h4>
                          <div className="flex items-center space-x-2 mt-0.5 mb-1.5">
                            <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                            <span className="text-xs text-gray-400 truncate">{cat.name} • {event.picName}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <StatusBadge status={event.status} />
                            {event.evidence_url && (
                              <a href={event.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors">
                                <ExternalLink className="w-3 h-3 mr-1" /> Bukti
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── ACTIVITY LOG ─── */}
        <div className="mt-12 pt-10 border-t border-gray-200/60 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-700 mb-2 flex items-center justify-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-400" />
              Aktivitas Terbaru
            </h2>
            <p className="text-sm text-gray-400">Log riwayat penambahan, pengubahan status, dan penghapusan jadwal kegiatan.</p>
          </div>
          
          <div className="relative border-l-2 border-gray-200/60 ml-4 md:ml-6 space-y-6">
            {activityLogs.length === 0 ? (
              <p className="text-gray-400 text-center py-8 text-sm">Belum ada riwayat aktivitas yang tercatat.</p>
            ) : activityLogs.map((log, idx) => {
              const logDate = new Date(log.created_at);
              const dateString = logDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              
              let actionColor = 'bg-gray-50 text-gray-600';
              if (log.action === 'Tambah') actionColor = 'bg-blue-50 text-blue-600';
              if (log.action === 'Update Status') actionColor = 'bg-amber-50 text-amber-600';
              if (log.action === 'Hapus') actionColor = 'bg-rose-50 text-rose-500';

              return (
                <div key={log.id} className="relative pl-7 md:pl-10 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
                  {/* Timeline dot */}
                  <div className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-[3px] border-white ${idx === 0 ? 'bg-indigo-400 ring-4 ring-indigo-50' : 'bg-gray-300'}`} />
                  
                  <div className="bg-white p-5 rounded-2xl border border-gray-200/60 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${actionColor}`}>{log.action}</span>
                        <h3 className="text-sm font-semibold text-gray-700">{log.entity_title}</h3>
                      </div>
                      <span className="text-xs text-gray-400 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {dateString}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {log.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <style jsx="true">{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #E5E7EB;
          border-radius: 20px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
