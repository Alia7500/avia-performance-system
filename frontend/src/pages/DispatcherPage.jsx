import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, CartesianGrid } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, 
  Users, Heart, ShieldAlert, Map, ChevronDown, ChevronUp, Clock
} from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

const AIRPORTS = {
  'SVO':[55.97, 37.41], 'AER':[43.44, 39.95], 'ABA':[53.74, 91.38], 'LED':[59.80, 30.26], 
  'SVX':[56.74, 60.80], 'OVB':[55.01, 82.65], 'VVO':[43.39, 132.14], 'KZN':[55.60, 49.27], 
  'KGD':[54.89, 20.59], 'IST':[41.27, 28.75], 'DXB':[25.25, 55.36], 'CEK':[55.30, 61.39],
  'PEE':[57.91, 56.02], 'VOG':[48.78, 44.34], 'UFA':[54.55, 55.87], 'IKT':[52.26, 104.38]
};

const createPlaneIcon = (heading, isRisk) => {
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 0}deg)`, color: isRisk ? '#f43f5e' : '#3b82f6', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>
      <Plane size={32} fill="currentColor" stroke="white" strokeWidth={1.5} />
    </div>
  );
  return L.divIcon({ html, className: 'custom-plane-icon', iconSize: [32, 32], iconAnchor:[14, 14] });
};

// Умный расчет прогресса с учетом задержек
const calcFlightProgress = (timeDep, timeArr, delayMins = 0) => {
  if (!timeDep || !timeArr) return 0;
  try {
    const now = new Date();
    const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes() + 180; // MSK (UTC+3)
    
    let [dh, dm] = timeDep.split(':').map(Number);
    let[ah, am] = timeArr.split(':').map(Number);
    
    let depMins = dh * 60 + dm + delayMins;
    let arrMins = ah * 60 + am + delayMins;
    
    if (arrMins < depMins) arrMins += 1440; 
    let curr = currentMins;
    if (curr < depMins && arrMins >= 1440) curr += 1440;

    let progress = ((curr - depMins) / (arrMins - depMins)) * 100;
    return isNaN(progress) ? 0 : Math.max(0, Math.min(100, progress));
  } catch (e) { return 0; }
};

const DispatcherPage = ({ user, onLogout }) => {
  const[activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [monitorData, setMonitorData] = useState([]);
  const[expandedFlight, setExpandedFlight] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => { if (isDarkMode) document.documentElement.classList.add('dark'); },[]);

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

  const riskCount = monitorData.filter(f => (f.crew ||[]).some(c => c.score > 0 && c.score < 70)).length;

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40"><Plane size={24} className="text-white" /></div>
          <div className="leading-none">
            <span className="font-black text-xl tracking-tighter uppercase block">ЦУП АЭРОФЛОТ</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] tracking-[0.2em] uppercase">Контроль МС-21</span>
          </div>
        </div>
        <nav className="flex-1 p-6 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Рабочее место</p>
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-bold ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
            <LayoutDashboard size={20} /> Мониторинг флота
          </button>
          <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-bold ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
            <Map size={20} /> Карта (Радар)
          </button>
        </nav>
        <button onClick={onLogout} className="p-6 text-rose-500 font-bold flex items-center gap-3 m-4 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all">
          <LogOut size={20} /> Завершить смену
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Центр управления полетами</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Связь с сервером активна</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400 hover:scale-105 transition-all"><Sun size={20} /></button>
            <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-[1600px] mx-auto">
          {activeTab === 'monitor' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Активных бортов</p>
                    <h4 className="text-6xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                  </div>
                  <div className="w-20 h-20 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-blue-600"><Plane size={40} /></div>
                </div>
                <div className={`p-8 rounded-[2rem] border-l-4 shadow-xl flex justify-between items-center transition-colors ${riskCount > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500' : 'bg-white dark:bg-slate-800 border-emerald-500'}`}>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${riskCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}><AlertTriangle size={16}/> Зона риска (Экипаж)</p>
                    <h4 className={`text-6xl font-black ${riskCount > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{riskCount} БОРТА</h4>
                  </div>
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${riskCount > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'}`}><ShieldAlert size={40} /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {monitorData.map((f, i) => {
                  const safeCrew = f.crew ||[];
                  const activeCrew = safeCrew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = safeCrew.filter(c => c.score > 0 && c.score < 70).length;
                  const progress = calcFlightProgress(f.time_dep, f.time_arr, f.delay);
                  const isExpanded = expandedFlight === f.id;

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 overflow-hidden ${alerts > 0 ? 'border-rose-500 shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="p-8 pb-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => { setExpandedFlight(isExpanded ? null : f.id); setSelectedMember(null); }}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <div className="flex items-center gap-3 mb-3">
                              <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                БОРТ: RA-{f.tail.replace('RA-', '')}
                              </span>
                              {f.status === 'Задержан' && (
                                <span className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                                  <Clock size={12}/> Задержан на {f.delay} мин
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                               <h4 className="text-5xl font-black tracking-tighter italic text-blue-600 dark:text-blue-400">{f.number}</h4>
                               {alerts > 0 && <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-lg animate-pulse uppercase">Аномалия ЧСС</span>}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                               <div className={`text-5xl font-black ${avgScore === 0 ? 'text-slate-300' : (avgScore > 70 ? 'text-emerald-500' : 'text-rose-500')}`}>
                                 {avgScore > 0 ? `${avgScore}%` : '--'}
                               </div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Готовность экипажа</p>
                            </div>
                            <div className="text-slate-400">{isExpanded ? <ChevronUp size={36} /> : <ChevronDown size={36} />}</div>
                          </div>
                        </div>

                        {/* ПРОГРЕСС И ФАКТИЧЕСКОЕ ВРЕМЯ */}
                        <div className="mt-4">
                          <div className="flex justify-between items-end mb-2 font-bold">
                            <div className="text-left">
                               <p className="text-[10px] text-slate-400 uppercase">Вылет (MSK)</p>
                               <p className="text-2xl text-slate-800 dark:text-white">
                                  {f.dep} <span className="text-sm text-slate-500 ml-1">
                                    {f.delay > 0 ? <><s className="opacity-50">{f.time_dep}</s> <span className="text-amber-500">{f.actual_dep}</span></> : f.time_dep}
                                  </span>
                               </p>
                            </div>
                            <div className="text-center pb-1">
                               <span className={`px-2 py-1 text-[10px] rounded-lg font-black uppercase tracking-widest border ${f.status === 'В полёте' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-600'}`}>
                                 {f.status === 'В полёте' ? `В полете (${Math.round(progress)}%)` : f.status}
                               </span>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-slate-400 uppercase">Прибытие (План)</p>
                               <p className="text-2xl text-slate-800 dark:text-white"><span className="text-sm text-slate-500 mr-1">{f.time_arr}</span> {f.arr}</p>
                            </div>
                          </div>
                          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-4">
                             <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${f.status === 'Задержан' ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                             {f.status === 'В полёте' && <Plane size={24} className="absolute -top-3 text-blue-600 dark:text-blue-400 transition-all duration-1000 drop-shadow-md" style={{ left: `calc(${progress}% - 12px)` }} />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {safeCrew.map((member, j) => (
                              <div key={j} onClick={(e) => { e.stopPropagation(); setSelectedMember(selectedMember === member.uid ? null : member.uid); }} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedMember === member.uid ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-blue-300'}`}>
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')}`} />
                                    <div>
                                      <span className="font-bold text-sm block text-slate-800 dark:text-slate-200 leading-tight">{member.fio}</span>
                                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">{member.role}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-100 dark:border-slate-700 pt-3">
                                  <div>
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Пульс</span>
                                     <span className="text-sm font-mono font-bold flex items-center gap-1"><Heart size={10} className={member.score > 70 ? "text-slate-400" : "text-rose-500 animate-pulse"}/> {member.hr > 0 ? member.hr : '--'}</span>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Индекс</span>
                                     <span className={`text-xl font-black leading-none ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{member.score > 0 ? `${Math.round(member.score)}%` : '--'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {selectedMember && (
                             <div className="mt-8 p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-blue-500/30 shadow-inner animate-in zoom-in-95">
                                <div className="flex justify-between items-center mb-4">
                                   <h4 className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                                     <Activity size={16}/> Детальный анализ: {safeCrew.find(m => m.uid === selectedMember)?.fio}
                                   </h4>
                                   <button onClick={(e) => { e.stopPropagation(); setSelectedMember(null); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white">Скрыть</button>
                                </div>
                                <div className="h-48 w-full">
                                   <ResponsiveContainer width="100%" height="100%">
                                     <AreaChart data={safeCrew.find(m => m.uid === selectedMember)?.history ||[]}>
                                       <defs>
                                         <linearGradient id="colorHrPersonal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                                       </defs>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                                       <XAxis hide />
                                       <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                                       <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', border: 'none', borderRadius: '12px', fontSize: '12px'}} />
                                       <Area type="monotone" dataKey="hr" stroke="#3b82f6" strokeWidth={3} fill="url(#colorHrPersonal)" />
                                     </AreaChart>
                                   </ResponsiveContainer>
                                </div>
                             </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl animate-in fade-in duration-500 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6 px-4">
                  <h3 className="text-2xl font-black italic text-slate-800 dark:text-white flex items-center gap-3">
                     <Navigation className="text-blue-500" size={32}/> ОПЕРАТИВНЫЙ РАДАР
                  </h3>
                </div>
                
                <div className="w-full h-[700px] rounded-[2.5rem] overflow-hidden border-8 border-slate-50 dark:border-slate-900 relative z-0">
                  <MapContainer center={[55.75, 37.61]} zoom={4} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    <TileLayer url={isDarkMode ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'} />
                    
                    {monitorData.map((f, i) => {
                      const depCoords = AIRPORTS[f.dep] || AIRPORTS['SVO'];
                      const arrCoords = AIRPORTS[f.arr] || AIRPORTS['SVO'];
                      
                      const progress = calcFlightProgress(f.time_dep, f.time_arr, f.delay) / 100;
                      const currentLat = depCoords[0] + (arrCoords[0] - depCoords[0]) * progress;
                      const currentLon = depCoords[1] + (arrCoords[1] - depCoords[1]) * progress;
                      const heading = Math.atan2(arrCoords[1] - depCoords[1], arrCoords[0] - depCoords[0]) * (180 / Math.PI);
                      const hasRisk = (f.crew ||[]).some(c => c.score > 0 && c.score < 70);

                      return (
                        <React.Fragment key={i}>
                          <Marker position={depCoords} icon={L.divIcon({className: 'bg-blue-600 w-3 h-3 rounded-full border-2 border-white', iconSize: [12,12]})}><Popup><b>{f.dep}</b></Popup></Marker>
                          <Marker position={arrCoords} icon={L.divIcon({className: 'bg-slate-400 w-3 h-3 rounded-full border-2 border-white', iconSize:[12,12]})}><Popup><b>{f.arr}</b></Popup></Marker>
                          <Polyline positions={[depCoords, arrCoords]} color="#94a3b8" weight={2} opacity={0.4} dashArray="5, 8" />
                          <Marker position={[currentLat, currentLon]} icon={createPlaneIcon(heading, hasRisk)}>
                            <Popup>
                              <div className="text-center font-sans p-2">
                                <b className="text-blue-600 text-xl block mb-1">{f.number || f.flight}</b>
                                <span className="font-black text-slate-500 uppercase text-[10px] bg-slate-100 px-2 py-1 rounded">{f.dep} ➔ {f.arr}</span>
                              </div>
                            </Popup>
                          </Marker>
                        </React.Fragment>
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