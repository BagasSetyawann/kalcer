import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, Clock, CheckCircle, Bell, 
  Search, TrendingUp, ChevronLeft, ChevronRight,
  LogOut, ShieldCheck, Activity, BarChart2, GitCommit, FileText, Zap, ChevronDown, ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const CATEGORIES = [
  { id: 'kepeg',      name: 'Kepegawaian',      color: 'bg-blue-500',   text: 'text-blue-600',   dot: 'bg-blue-500', border: 'border-blue-500/30' },
  { id: 'keu',        name: 'Keuangan',         color: 'bg-green-500',  text: 'text-green-600',  dot: 'bg-green-500', border: 'border-green-500/30' },
  { id: 'sakip',      name: 'SAKIP',            color: 'bg-purple-500', text: 'text-purple-600', dot: 'bg-purple-500', border: 'border-purple-500/30' },
  { id: 'mr',         name: 'Manajemen Risiko', color: 'bg-red-500',    text: 'text-red-600',    dot: 'bg-red-500', border: 'border-red-500/30' },
  { id: 'persediaan', name: 'Persediaan',       color: 'bg-orange-500', text: 'text-orange-600', dot: 'bg-orange-500', border: 'border-orange-500/30' },
  { id: 'bmn',        name: 'BMN',              color: 'bg-yellow-500', text: 'text-yellow-600', dot: 'bg-yellow-500', border: 'border-yellow-500/30' },
  { id: 'spider',     name: 'SPIDER',           color: 'bg-teal-500',   text: 'text-teal-600',   dot: 'bg-teal-500', border: 'border-teal-500/30' },
];

const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];


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
    if (status === 'confirmed') return <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-green-500/10 text-green-700 uppercase tracking-wider"><CheckCircle className="w-3 h-3 mr-1" />Terkonfirmasi</span>;
    if (status === 'reminded')  return <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-orange-500/10 text-orange-700 uppercase tracking-wider"><Clock className="w-3 h-3 mr-1" />Menunggu</span>;
    return <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-gray-500/10 text-gray-700 uppercase tracking-wider"><Bell className="w-3 h-3 mr-1" />Terjadwal</span>;
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
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-gray-900 selection:bg-blue-600 selection:text-white">
      
      {/* ─── NAVIGATION BAR ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
              KALCER <span className="hidden sm:inline text-sm font-medium text-gray-500 ml-1 tracking-normal">(Kalender Cerdas Reminder)</span>
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link 
              to="/admin" 
              className="group flex items-center space-x-2 bg-gray-900 hover:bg-black text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md hover:shadow-xl active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors" />
              <span>Login Admin</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <div className="relative pt-32 pb-16 px-6 sm:px-12 lg:px-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white" />
        <div className="relative max-w-7xl mx-auto z-10 text-center flex flex-col items-center">
          
          <div className="inline-flex items-center space-x-2 bg-blue-50 px-4 py-1.5 rounded-full mb-6 border border-blue-100/50">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
            <span className="text-[11px] font-bold text-blue-700 tracking-wide uppercase">Realtime Dashboard</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-gray-900 leading-[1.1]">
            KALCER <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-300% animate-gradient">Kalender Cerdas Reminder</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl font-medium mb-12">
            Transparansi penuh untuk seluruh jadwal dan respon konfirmasi dari masing-masing penanggung jawab tim.
          </p>
          
          {/* TEAM FILTERS */}
          <div className="flex flex-wrap justify-center gap-3 w-full max-w-4xl">
            <button 
              onClick={() => setSelectedTeam('all')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                selectedTeam === 'all' 
                  ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20' 
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              Semua Tim
            </button>
            {CATEGORIES.map(c => (
              <button 
                key={c.id}
                onClick={() => setSelectedTeam(c.id)}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                  selectedTeam === c.id
                    ? `${c.color} text-white ${c.border} shadow-lg shadow-${c.color.split('-')[1]}-500/30` 
                    : `bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50`
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${selectedTeam === c.id ? 'bg-white' : c.dot}`} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-20 pb-20 space-y-12">
        
        {/* ─── STATISTIK RESPONS BULAN INI ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-2xl transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <CalendarIcon className="w-16 h-16 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Total {MONTH_NAMES[calMonth.month]}</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-4xl font-extrabold text-gray-900">{totalEvents}</p>
              <span className="text-sm font-medium text-gray-400">Kegiatan</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-green-100 shadow-xl shadow-green-900/5 hover:shadow-2xl transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
            <p className="text-sm font-bold text-green-600 uppercase tracking-wider mb-2">Terkonfirmasi</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-4xl font-extrabold text-green-700">{totalConfirmed}</p>
              <span className="text-sm font-medium text-green-600/60">Siap</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-xl shadow-orange-900/5 hover:shadow-2xl transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-16 h-16 text-orange-600" />
            </div>
            <p className="text-sm font-bold text-orange-600 uppercase tracking-wider mb-2">Menunggu</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-4xl font-extrabold text-orange-700">{totalReminded}</p>
              <span className="text-sm font-medium text-orange-600/60">Respons</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-2xl transition-shadow relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Bell className="w-16 h-16 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Terjadwal</p>
            <div className="flex items-baseline space-x-2">
              <p className="text-4xl font-extrabold text-gray-700">{totalPending}</p>
              <span className="text-sm font-medium text-gray-400">Menunggu H-</span>
            </div>
          </div>
        </div>

        {/* ─── MAIN CONTENT GRID (CALENDAR & UPCOMING) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* KALENDER */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 p-8 h-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
                <h2 className="text-2xl font-bold flex items-center text-gray-900">
                  <Activity className="w-6 h-6 mr-3 text-blue-600" />
                  Agenda {MONTH_NAMES[calMonth.month]} {calMonth.year}
                </h2>
                <div className="flex items-center space-x-2 bg-gray-50 rounded-full p-1.5 border border-gray-100">
                  <button onClick={prevMonth} className="p-2.5 rounded-full hover:bg-white hover:shadow-md text-gray-600 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold px-4 w-32 text-center">{MONTH_NAMES[calMonth.month]}</span>
                  <button onClick={nextMonth} className="p-2.5 rounded-full hover:bg-white hover:shadow-md text-gray-600 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Grid Kalender */}
              <div className="grid grid-cols-7 gap-3">
                {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-gray-400 py-2 uppercase tracking-widest">{d}</div>
                ))}
                {(() => {
                  const { year, month } = calMonth;
                  const daysInMonth = getDaysInMonth(year, month);
                  const firstDay = getFirstDayOfMonth(year, month);
                  const cells = [];
                  
                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="min-h-[140px] rounded-3xl" />);
                  }
                  
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayEvents = filteredEvents.filter(e => e.date === dateStr);
                    const isToday = dateStr === todayStr;
                    
                    cells.push(
                      <div key={day} className={`min-h-[140px] rounded-3xl p-3 border transition-all duration-300 ${isToday ? 'bg-gradient-to-b from-blue-50/50 to-white border-blue-200 shadow-md shadow-blue-500/10' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <span className={`text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-gray-500'}`}>{day}</span>
                          {dayEvents.length > 0 && (
                            <span className="text-[10px] font-extrabold px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">{dayEvents.length}</span>
                          )}
                        </div>
                        <div className="space-y-2 overflow-hidden">
                          {dayEvents.slice(0, 3).map(e => {
                            const cat = CATEGORIES.find(c => c.id === e.category) || CATEGORIES[0];
                            return (
                              <div key={e.id} className={`text-[11px] font-semibold leading-snug px-2.5 py-2 rounded-xl bg-gray-50/50 border border-gray-100 ${cat.text} truncate group relative hover:scale-[1.02] transition-transform`} title={e.title}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${cat.dot}`} />
                                {e.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-gray-400 text-center pt-1 font-bold">+{dayEvents.length - 3} lainnya</div>
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
          <div className="space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 p-8 sticky top-24">
              
              <div className="relative mb-8">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Cari kegiatan..." 
                  className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-full py-3.5 pl-12 pr-4 text-gray-700 font-medium placeholder-gray-400 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <h2 className="text-xl font-bold flex items-center mb-6 text-gray-900">
                <TrendingUp className="w-5 h-5 mr-3 text-purple-600" />
                Segera Mendatang
              </h2>
              
              {isLoading ? (
                <div className="flex flex-col space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex space-x-4 p-4 border border-gray-100 rounded-2xl">
                      <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <div className="w-16 h-16 bg-white shadow-sm rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-500 font-bold">Semua beres!</p>
                  <p className="text-xs text-gray-400 mt-1">Tidak ada jadwal mendatang.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {upcomingEvents.slice(0, 10).map((event) => {
                    const cat = CATEGORIES.find(c => c.id === event.category) || CATEGORIES[0];
                    const eventDate = new Date(event.date);
                    const isToday = event.date === todayStr;
                    
                    return (
                      <div key={event.id} className="group flex gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all border border-gray-100 hover:border-gray-200 hover:shadow-md">
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl shrink-0 ${isToday ? 'bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-600 group-hover:bg-white group-hover:shadow-sm'}`}>
                          <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">{MONTH_NAMES[eventDate.getMonth()].substring(0,3)}</span>
                          <span className="text-xl font-extrabold leading-none mt-0.5">{eventDate.getDate()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{event.title}</h4>
                          <div className="flex items-center space-x-2 mt-1.5 mb-2.5">
                            <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                            <span className="text-xs font-semibold text-gray-500 truncate">{cat.name} • {event.picName}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <StatusBadge status={event.status} />
                            {event.evidence_url && (
                              <a href={event.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
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

        {/* ─── CHANGELOG SECTION ─── */}
        <div className="mt-20 pt-16 border-t border-gray-100 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4 flex items-center justify-center">
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              Aktivitas Terbaru
            </h2>
            <p className="text-gray-500 font-medium">Log riwayat penambahan, pengubahan status, dan penghapusan jadwal kegiatan.</p>
          </div>
          
          <div className="relative border-l-2 border-gray-100 ml-4 md:ml-8 space-y-12">
            {activityLogs.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Belum ada riwayat aktivitas yang tercatat.</p>
            ) : activityLogs.map((log, idx) => {
              const logDate = new Date(log.created_at);
              const dateString = logDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              
              let actionColor = 'bg-gray-100 text-gray-800';
              if (log.action === 'Tambah') actionColor = 'bg-blue-100 text-blue-800';
              if (log.action === 'Update Status') actionColor = 'bg-orange-100 text-orange-800';
              if (log.action === 'Hapus') actionColor = 'bg-red-100 text-red-800';

              return (
                <div key={log.id} className="relative pl-8 md:pl-12 animate-in fade-in slide-in-from-left-4 duration-700" style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}>
                  {/* Timeline dot */}
                  <div className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white ${idx === 0 ? 'bg-blue-600 shadow-md shadow-blue-500/40 ring-4 ring-blue-50' : 'bg-gray-300'}`} />
                  
                  <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-2xl transition-shadow group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-extrabold tracking-wide uppercase ${actionColor}`}>{log.action}</span>
                        <h3 className="text-lg font-bold text-gray-900">{log.entity_title}</h3>
                      </div>
                      <span className="text-sm font-semibold text-gray-400 flex items-center">
                        <Clock className="w-4 h-4 mr-1.5" />
                        {dateString}
                      </span>
                    </div>
                    <p className="text-gray-600 leading-relaxed font-medium">
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
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #E5E7EB;
          border-radius: 20px;
        }
        .animate-gradient {
          background-size: 300%;
          animation: gradient 8s ease infinite;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
