import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, XAxis } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, 
  Users, Heart, ShieldAlert, Map, ChevronDown, ChevronUp, Info, Clock, Navigation
} from 'lucide-react';

// --- ИКОНКИ И ГРАФИКА ---
const createPlaneIcon = (heading, isRisk) => {
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 0}deg)`, color: isRisk ? '#ff4d4d' : '#3b82f6' }}>
      <Plane size={32} fill="currentColor" stroke="white" strokeWidth={1} />
    </div>
  );
  return L.divIcon({ html, className: 'plane-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
};

// Координаты основных узлов РФ
const AIRPORTS = {
  'SVO': [55.97, 37.41], 'AER': [43.44, 39.95], 'ABA': [53.74, 91.38],
  'LED': [59.80, 30.26], 'SVX': [56.74, 60.80], 'OVB': [55.01, 82.65],
  'VVO': [43.39, 132.14], 'KZN': [55.60, 49.27], 'KGD': [54.89, 20.59],
  'IST': [41.27, 28.75], 'DXB': [25.25, 55.36], 'CEK': [55.30, 61.39],
  'PEE': [57.91, 56.02], 'VOG': [48.78, 44.34], 'UFA': [54.55, 55.87]
};

const DispatcherPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [monitorData, setMonitorData] = useState([]);
  const [expandedFlight, setExpandedFlight] = useState(null);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const loadData = async () => {
    try {
      const res = await api.get('/dispatcher/monitor');
      setMonitorData(Array.isArray(res.data) ? res.data : []);
    } catch (e) { console.error("Ошибка ЦУП:", e); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Математический расчет прогресса для полоски пути
  const getProgress = (dep, arr) => {
    const now = new Date();
    const [dh, dm] = dep.split(':').map(Number);
    const [ah, am] = arr.split(':').map(Number);
    const dMins = dh * 60 + dm;
    let aMins = ah * 60 + am;
    if (aMins < dMins) aMins += 1440;
    const cMins = now.getHours() * 60 + now.getMinutes();
    const progress = ((cMins - dMins) / (aMins - dMins)) * 100;
    return Math.max(0, Math.min(100, Math.round(progress)));
  };

  const riskCount = monitorData.filter(f => f.crew?.some(c => c.score > 0 && c.score < 70)).length;

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} font-sans transition-colors duration-500`}>
      
      {/* ЛЕВОЕ МЕНЮ (САЙДБАР) */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/40">
             <Plane size={24} className="text-white" />
          </div>
          <div className="leading-none">
            <span className="font-black text-xl tracking-tighter uppercase block">ЦУП АЭРОФЛОТ</span>
            <span className="text-blue-500 font-bold text-[10px] tracking-widest uppercase">Система МС-21</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-4">
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-bold ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Мониторинг флота
          </button>
          <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all font-bold ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Navigation size={20} /> Радар (Live)
          </button>
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-black w-full p-4 hover:bg-rose-500/10 rounded-2xl transition-all">
            <LogOut size={20} /> ЗАВЕРШИТЬ СМЕНУ
          </button>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-tight italic">Центр управления полетами</h2>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-500 dark:text-yellow-400 shadow-inner">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg">{user.fio[0]}</div>
               <div className="text-left leading-none px-1">
                  <p className="font-bold text-sm">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">Дежурный Диспетчер</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-[1400px] mx-auto">
          {activeTab === 'monitor' && (
            <div className="space-y-8 animate-in fade-in duration-700">
              
              {/* ПАНЕЛЬ СТАТИСТИКИ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm">
                   <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Бортов в воздухе</p>
                   <h4 className="text-5xl font-black">{monitorData.length}</h4>
                </div>
                <div className={`p-6 rounded-[2rem] border-2 shadow-xl transition-all ${riskCount > 0 ? 'bg-rose-500 text-white border-rose-400 animate-pulse' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                   <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${riskCount > 0 ? 'text-rose-100' : 'text-slate-400'}`}>Зона риска (Экипаж)</p>
                   <h4 className="text-5xl font-black">{riskCount} БОРТА</h4>
                </div>
              </div>

              {/* ТАБЛО РЕЙСОВ */}
              <div className="grid grid-cols-1 gap-8">
                {monitorData.map((f, i) => {
                  const prog = getProgress(f.time_dep, f.time_arr);
                  const hasRisk = f.crew?.some(c => c.score > 0 && c.score < 70);

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all ${hasRisk ? 'border-rose-500 bg-rose-500/5' : 'border-slate-100 dark:border-slate-700'}`}>
                      
                      {/* ЗАГОЛОВОК КАРТОЧКИ */}
                      <div className="p-8 flex justify-between items-center cursor-pointer" onClick={() => setExpandedFlight(expandedFlight === f.id ? null : f.id)}>
                        <div className="flex items-center gap-10">
                           <div>
                              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800">Борт: {f.tail}</span>
                              <h3 className="text-5xl font-black tracking-tighter italic mt-2">{f.number}</h3>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="text-center">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">Вылет</p>
                                 <p className="text-2xl font-black">{f.dep} <span className="text-sm text-slate-400 font-normal">{f.time_dep}</span></p>
                              </div>
                              <div className="w-32 text-center relative pt-4">
                                 <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full w-full">
                                    <div className="h-full bg-blue-500 rounded-full" style={{width: `${prog}%`}}></div>
                                 </div>
                                 <Plane size={14} className="text-blue-500 absolute top-2 transition-all duration-1000" style={{left: `calc(${prog}% - 7px)`}} />
                                 <p className="text-[9px] font-black text-blue-500 mt-1">{prog}% ПУТИ</p>
                              </div>
                              <div className="text-center">
                                 <p className="text-[10px] text-slate-400 font-bold uppercase">Прибытие</p>
                                 <p className="text-2xl font-black"><span className="text-sm text-slate-400 font-normal">{f.time_arr}</span> {f.arr}</p>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           {f.delayed && <div className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black animate-pulse flex items-center gap-2"><Clock size={14}/> ЗАДЕРЖКА</div>}
                           {expandedFlight === f.id ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}
                        </div>
                      </div>

                      {/* СПИСОК ЭКИПАЖА (РАСКРЫВАЮЩИЙСЯ) */}
                      {expandedFlight === f.id && (
                        <div className="p-8 pt-0 border-t border-slate-50 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                             {f.crew.map((member, j) => (
                               <div key={j} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 relative group overflow-hidden">
                                  <div className="flex justify-between items-start relative z-10">
                                     <div>
                                        <h5 className="font-black text-lg leading-none mb-1">{member.fio}</h5>
                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{member.role}</span>
                                     </div>
                                     <div className="text-right">
                                        <div className={`text-3xl font-black ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(member.score)}%</div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Готовность</p>
                                     </div>
                                  </div>

                                  {/* Мини-график пульса */}
                                  <div className="h-20 mt-4 relative z-10">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={member.history}>
                                           <defs>
                                              <linearGradient id={`grad${i}${j}`} x1="0" y1="0" x2="0" y2="1">
                                                 <stop offset="5%" stopColor={member.score > 70 ? "#10b981" : "#f43f5e"} stopOpacity={0.3}/>
                                                 <stop offset="95%" stopColor={member.score > 70 ? "#10b981" : "#f43f5e"} stopOpacity={0}/>
                                              </linearGradient>
                                           </defs>
                                           <Area type="monotone" dataKey="hr" stroke={member.score > 70 ? "#10b981" : "#f43f5e"} strokeWidth={3} fill={`url(#grad${i}${j})`} />
                                           <YAxis hide domain={['dataMin-10', 'dataMax+10']} />
                                        </AreaChart>
                                     </ResponsiveContainer>
                                  </div>
                                  
                                  <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                     <span className="flex items-center gap-1"><Heart size={12} className="text-rose-500"/> ТЕКУЩИЙ ПУЛЬС: {member.hr} BPM</span>
                                     <span className={member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}>{member.score > 70 ? 'СТАТУС: НОРМА' : 'СТАТУС: КРИТИЧЕСКИ'}</span>
                                  </div>
                               </div>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ВКЛАДКА КАРТЫ */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-[3rem] shadow-2xl animate-in fade-in duration-500">
                <div className="flex justify-between items-center mb-6 px-4">
                   <h3 className="text-2xl font-black italic uppercase tracking-tight">Оперативный радар (Аэрофлот)</h3>
                   <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full" /> Экипаж стабилен</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" /> Аномалия ЧСС</div>
                   </div>
                </div>
                <div className="h-[650px] rounded-[2.5rem] overflow-hidden border-8 border-slate-100 dark:border-slate-900 z-0 relative">
                   <MapContainer center={[55.75, 37.61]} zoom={4} style={{height:'100%'}} attributionControl={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {monitorData.map((f, i) => {
                         const coords = AIRPORTS[f.arr] || [55.75, 37.61];
                         return f.lat && (
                           <Marker key={i} position={[f.lat, f.lon]} icon={createPlaneIcon(f.heading, f.crew?.some(c => c.score > 0 && c.score < 70))}>
                              <Popup>
                                 <div className="text-center font-bold">
                                    <p className="text-blue-600">{f.number}</p>
                                    <p className="text-[10px] uppercase">{f.dep} ➔ {f.arr}</p>
                                 </div>
                              </Popup>
                           </Marker>
                         );
                      })}
                   </MapContainer>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DispatcherPage;