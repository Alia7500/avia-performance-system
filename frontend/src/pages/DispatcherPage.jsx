import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, Users, Heart, ShieldAlert, Map } from 'lucide-react';

// Создаем иконку самолета, которая поворачивается по курсу
const createPlaneIcon = (heading, isRisk) => {
  const color = isRisk ? '#f43f5e' : '#3b82f6';
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 0}deg)`, color: color }}>
      <Plane size={28} fill="currentColor" />
    </div>
  );
  return L.divIcon({ html, className: 'custom-plane-icon', iconSize: [28, 28], iconAnchor: [14, 14] });
};

const DispatcherPage = ({ user, onLogout }) => {
  const[activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [monitorData, setMonitorData] = useState([]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dispatcher/monitor');
        setMonitorData(Array.isArray(res.data) ? res.data :[]);
      } catch (e) { console.error(e); }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  },[]);

  const riskFlightsCount = monitorData.filter(f => (f.crew ||[]).some(c => c.score > 0 && c.score < 70)).length;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Plane size={24} className="text-white" /></div>
          <span className="font-black text-xl tracking-tighter uppercase leading-none">ЦУП <br/><span className="text-blue-500 text-sm">АЭРОФЛОТ</span></span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Управление флотом</p>
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Мониторинг МС-21
          </button>
          <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Map size={20} /> Карта (Радар)
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-3 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all"><LogOut size={20} /> Выход</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-tight">ЦЕНТР УПРАВЛЕНИЯ ПОЛЕТАМИ</h2>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400"><Sun size={20} /></button>
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'monitor' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-l-4 border-emerald-500 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Бортов в небе</p>
                  <h4 className="text-4xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-l-4 border-rose-500 shadow-sm">
                  <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1"><AlertTriangle size={12}/> Зона риска (Экипаж)</p>
                  <h4 className="text-4xl font-black text-rose-600">{riskFlightsCount} БОРТА</h4>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {monitorData.map((f, i) => {
                  const safeCrew = f.crew ||[];
                  const activeCrew = safeCrew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = safeCrew.filter(c => c.score > 0 && c.score < 70).length;
                  const peakHr = safeCrew.length > 0 ? Math.max(...safeCrew.map(c => c.hr || 0)) : 0;

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 ${alerts > 0 ? 'border-rose-500 shadow-rose-500/20' : 'border-transparent dark:border-slate-700'}`}>
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black mb-3 inline-block uppercase tracking-widest border border-blue-100 dark:border-blue-800">
                             БОРТ: {f.tail}
                          </span>
                          <h4 className="text-5xl font-black tracking-tighter italic text-slate-800 dark:text-white">{f.flight}</h4>
                          <div className="flex items-center gap-3 mt-2 text-slate-600 dark:text-slate-300 font-bold">
                            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-xs">{f.time_dep}</span>
                            <span className="text-lg">{f.dep}</span>
                            <Plane size={16} className="rotate-90 text-slate-400" />
                            <span className="text-lg">{f.arr}</span>
                            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded text-xs">{f.time_arr}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-6xl font-black ${avgScore === 0 ? 'text-slate-300' : (avgScore > 70 ? 'text-emerald-500' : 'text-rose-500')}`}>
                            {avgScore > 0 ? `${avgScore}%` : '...'}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Готовность экипажа</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-slate-50 dark:border-slate-700">
                         <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl"><Heart size={18} className="text-rose-500"/></div>
                            <div>
                               <p className="text-[9px] text-slate-400 font-bold uppercase">Пик ЧСС</p>
                               <p className="text-sm font-black">{peakHr > 0 ? `${peakHr} BPM` : 'Ожидание'}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${alerts > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'}`}><ShieldAlert size={18} /></div>
                            <div>
                               <p className="text-[9px] text-slate-400 font-bold uppercase">Аномалии</p>
                               <p className="text-sm font-black">{alerts > 0 ? `${alerts} чел. в зоне риска` : 'Норма'}</p>
                            </div>
                         </div>
                      </div>

                      {/* СПИСОК ЭКИПАЖА */}
                      {safeCrew.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-700 space-y-2">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2"><Users size={12} className="inline mr-1"/> Состав экипажа на борту:</p>
                           {safeCrew.map((member, j) => (
                             <div key={j} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')}`} />
                                  <span className="font-bold text-xs">{member.fio}</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase px-2 border border-slate-200 dark:border-slate-700 rounded">{member.role}</span>
                                </div>
                                <div className="flex gap-4 items-center">
                                  {member.hr > 0 ? (
                                    <><span className="text-[10px] font-mono text-slate-400 italic">HR: {member.hr}</span><span className={`text-xs font-black ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(member.score)}%</span></>
                                  ) : (<span className="text-[9px] font-bold text-slate-400 uppercase italic">Ожидание...</span>)}
                                </div>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ИНТЕРАКТИВНАЯ КАРТА (FLIGHTRADAR24 API) */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-[3rem] shadow-xl animate-in fade-in duration-500">
                <h3 className="text-2xl font-black mb-6 px-4 italic text-slate-800 dark:text-white">ОПЕРАТИВНЫЙ РАДАР (ДАННЫЕ FLIGHTRADAR24)</h3>
                <div className="w-full h-[600px] rounded-[2rem] overflow-hidden border-4 border-slate-100 dark:border-slate-900 relative z-0">
                  {/* attributionControl={false} убирает флаг и копирайты */}
                  <MapContainer center={[55.7558, 37.6173]} zoom={4} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    {/* Используем карту Google Maps на РУССКОМ языке */}
                    <TileLayer url={isDarkMode ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru&apistyle=s.t%3A33|s.e%3Ag|p.c%3A#242f3e' : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru'} />
                    
                    {/* Рисуем самолеты, у которых есть реальные координаты */}
                    {monitorData.filter(f => f.lat && f.lon).map((f, i) => (
                        <Marker 
                          key={i} 
                          position={[f.lat, f.lon]} 
                          icon={createPlaneIcon(f.heading, (f.crew ||[]).some(c => c.score > 0 && c.score < 70))}
                        >
                          <Popup>
                            <div className="text-center">
                              <b className="text-slate-800 text-lg block">{f.flight}</b>
                              <span className="text-slate-500 text-xs">{f.dep} ➔ {f.arr}</span>
                            </div>
                          </Popup>
                        </Marker>
                    ))}
                  </MapContainer>
                  
                  <div className="absolute bottom-6 left-6 z-[1000] p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">ЛЕГЕНДА:</p>
                      <div className="flex items-center gap-2 mb-1"><Plane size={14} className="text-blue-500"/><span className="text-xs font-bold">Экипаж стабилен</span></div>
                      <div className="flex items-center gap-2"><Plane size={14} className="text-rose-500"/><span className="text-xs font-bold">Аномалия ЧСС</span></div>
                  </div>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DispatcherPage;