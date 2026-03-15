import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, 
  Users, Heart, ShieldAlert, Map, ChevronDown, ChevronUp, 
  Activity, BrainCircuit, Navigation, Clock 
} from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// РАСШИРЕННЫЙ СПИСОК АЭРОПОРТОВ (Чтобы были все траектории)
const AIRPORTS = {
  'SVO':[55.9726, 37.4146], 'AER':[43.4499, 39.9566], 'ABA':[53.7400, 91.3850],
  'LED':[59.8003, 30.2625], 'SVX':[56.7431, 60.8027], 'OVB': [55.0125, 82.6506],
  'VVO': [43.3989, 132.1480], 'KZN': [55.6061, 49.2787], 'KGD': [54.8900, 20.5926],
  'IST': [41.2752, 28.7519], 'DXB':[25.2532, 55.3657], 'CEK':[55.3053, 61.3936],
  'PEE':[57.9144, 56.0214], 'VOG':[48.7817, 44.3467], 'UFA':[54.5575, 55.8744],
  'IKT':[52.2680, 104.3890], 'KJA':[56.1722, 92.4933], 'OMS':[54.9581, 73.3108],
  'MRV':[44.2250, 43.0817], 'MCX':[42.8169, 47.6514], 'YKS':[62.0933, 129.7710],
  'UUS':[46.8886, 142.7170], 'BAX':[53.3636, 83.5383], 'KEJ':[55.2708, 86.1072],
  'ARH':[64.5961, 40.7164], 'ASF': [46.2833, 48.0064], 'EVN': [40.1473, 44.3959],
  'TAS': [41.2579, 69.2812], 'DYR':[64.7342, 177.7410], 'KVK':[67.5772, 33.5853],
  'MMK':[68.7817, 32.7508], 'GRV':[43.3328, 45.6286], 'NJC':[60.9493, 76.4795],
  'GOJ':[56.2300, 43.7866], 'NOZ':[53.8114, 86.8772], 'NUX':[66.0694, 76.5197],
  'NSK':[69.3111, 87.3322], 'REN':[51.7961, 55.4566], 'PKC':[53.1678, 158.4539]
};

const createPlaneIcon = (heading, isRisk) => {
  const color = isRisk ? '#f43f5e' : '#3b82f6';
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 0}deg)`, color: color, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>
      <Plane size={32} fill="currentColor" stroke="white" strokeWidth={1.5} />
    </div>
  );
  return L.divIcon({ html, className: 'custom-plane-icon', iconSize: [32, 32], iconAnchor:[16, 16] });
};

// Умный генератор ИИ-подсказки
const getAiVerdict = (score, stress, hr) => {
  if (score > 70) return "Физиологические показатели в норме. Признаков утомления не выявлено. Экипаж полностью работоспособен.";
  if (stress > 30) return `Зафиксировано повышение ЧСС (${hr} bpm) на фоне высокого уровня стресса (${stress}%). Снижение концентрации внимания. Рекомендуется перерыв.`;
  return `Отклонение ЧСС от персональной нормы. Текущий пульс: ${hr} bpm. Требуется мониторинг состояния.`;
};

const DispatcherPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const[monitorData, setMonitorData] = useState([]);
  const [expandedFlight, setExpandedFlight] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
  },[]);

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
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/40">
             <Plane size={24} className="text-white" />
          </div>
          <div className="leading-none">
            <span className="font-black text-xl tracking-tighter uppercase block">ЦУП АЭРОФЛОТ</span>
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[10px] tracking-[0.2em] uppercase">Контроль МС-21</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Рабочее место</p>
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-bold ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Мониторинг флота
          </button>
          <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all font-bold ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            <Map size={20} /> Карта и радар
          </button>
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-4 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all">
            <LogOut size={20} /> Завершить смену
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center">
          <h2 className="text-3xl font-black uppercase tracking-tight">Центр управления полетами</h2>
          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400 hover:scale-105 transition-all">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
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
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Бортов в небе</p>
                    <h4 className="text-6xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                  </div>
                  <div className="w-20 h-20 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-blue-600"><Plane size={40} /></div>
                </div>
                <div className={`p-8 rounded-[2rem] border-l-4 shadow-xl flex justify-between items-center transition-colors ${riskFlightsCount > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500' : 'bg-white dark:bg-slate-800 border-emerald-500'}`}>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-widest mb-1 flex items-center gap-2 ${riskFlightsCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}><AlertTriangle size={16}/> Зона риска (Экипаж)</p>
                    <h4 className={`text-6xl font-black ${riskFlightsCount > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{riskFlightsCount} БОРТА</h4>
                  </div>
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${riskFlightsCount > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'}`}><ShieldAlert size={40} /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {monitorData.map((f, i) => {
                  const safeCrew = f.crew ||[];
                  const activeCrew = safeCrew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = safeCrew.filter(c => c.score > 0 && c.score < 70).length;
                  const isExpanded = expandedFlight === f.id;

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 overflow-hidden ${alerts > 0 ? 'border-rose-500 shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="p-8 pb-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors" onClick={() => { setExpandedFlight(isExpanded ? null : f.id); setSelectedMember(null); }}>
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black mb-3 inline-block uppercase tracking-widest">
                               БОРТ: RA-{f.tail.replace('RA-', '')}
                            </span>
                            <div className="flex items-center gap-4">
                               <h4 className="text-5xl font-black tracking-tighter italic text-blue-600 dark:text-blue-400">{f.number}</h4>
                               {alerts > 0 && <span className="px-3 py-1 bg-rose-500 text-white text-[10px] font-black rounded-lg animate-pulse uppercase">Аномалия</span>}
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

                        <div className="mt-4 flex justify-between items-end mb-2 font-bold">
                            <div className="text-left">
                               <p className="text-[10px] text-slate-400 uppercase">Вылет</p>
                               <p className="text-2xl text-slate-800 dark:text-white">{f.dep} <span className="text-sm text-slate-500 ml-1">{f.time_dep}</span></p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-slate-400 uppercase">Прибытие</p>
                               <p className="text-2xl text-slate-800 dark:text-white"><span className="text-sm text-slate-500 mr-1">{f.time_arr}</span> {f.arr}</p>
                            </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {safeCrew.map((member, j) => (
                              <div key={j} onClick={(e) => { e.stopPropagation(); setSelectedMember(selectedMember === member.uid ? null : member.uid); }} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedMember === member.uid ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 hover:border-blue-300'}`}>
                                <div className="flex items-center gap-3 mb-3">
                                  <div className={`w-3 h-3 rounded-full shadow-sm ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')}`} />
                                  <div>
                                    <span className="font-bold text-sm block text-slate-800 dark:text-slate-200 leading-tight">{member.fio}</span>
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">{member.role}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-end border-t border-slate-100 dark:border-slate-700 pt-3">
                                  <div>
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Пульс</span>
                                     <span className="text-sm font-mono font-bold flex items-center gap-1"><Heart size={10} className={member.score > 70 ? "text-slate-400" : "text-rose-500"}/> {member.hr > 0 ? member.hr : '--'}</span>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Индекс</span>
                                     <span className={`text-xl font-black leading-none ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{member.score > 0 ? `${Math.round(member.score)}%` : '--'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {selectedMember && (() => {
                             const sel = safeCrew.find(m => m.uid === selectedMember);
                             return (
                               <div className="mt-6 p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-blue-500/30 shadow-inner animate-in zoom-in-95">
                                  <div className="flex justify-between items-center mb-6">
                                     <h4 className="text-blue-600 dark:text-blue-400 font-black text-sm uppercase tracking-widest flex items-center gap-2"><BrainCircuit size={16}/> ИИ-Анализ: {sel.fio}</h4>
                                     <button onClick={(e) => { e.stopPropagation(); setSelectedMember(null); }} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">Скрыть</button>
                                  </div>
                                  
                                  {/* РЕАЛЬНАЯ МЕДИЦИНА ИЗ БД */}
                                  <div className="grid grid-cols-4 gap-2 mb-6">
                                     <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center"><span className="text-[9px] text-slate-400 uppercase font-bold block">SpO2</span><p className="font-mono font-bold text-slate-700 dark:text-slate-300">{sel.spo2 || '--'}%</p></div>
                                     <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center"><span className="text-[9px] text-slate-400 uppercase font-bold block">АД (BP)</span><p className="font-mono font-bold text-slate-700 dark:text-slate-300">{sel.bp || '---'}</p></div>
                                     <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center"><span className="text-[9px] text-slate-400 uppercase font-bold block">Темп.</span><p className="font-mono font-bold text-slate-700 dark:text-slate-300">{sel.temp || '--'}°C</p></div>
                                     <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl text-center"><span className="text-[9px] text-slate-400 uppercase font-bold block">Стресс</span><p className="font-mono font-bold text-slate-700 dark:text-slate-300">{sel.stress ? `${sel.stress}%` : '--'}</p></div>
                                  </div>

                                  {/* ИНТЕЛЛЕКТУАЛЬНЫЙ ВЫВОД ИИ */}
                                  <div className={`p-4 rounded-xl text-xs font-bold border ${sel.score > 70 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'}`}>
                                     <strong>Вердикт Агента:</strong> {getAiVerdict(sel.score, sel.stress, sel.hr)}
                                  </div>

                                  {/* ГРАФИК */}
                                  <div className="h-40 w-full mt-4">
                                     <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={sel.history ||[]}>
                                         <defs>
                                           <linearGradient id="colorHrPersonal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={sel.score > 70 ? "#10b981" : "#f43f5e"} stopOpacity={0.4}/><stop offset="95%" stopColor={sel.score > 70 ? "#10b981" : "#f43f5e"} stopOpacity={0}/></linearGradient>
                                         </defs>
                                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                                         <XAxis hide />
                                         <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                                         <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', border: 'none', borderRadius: '12px', fontSize: '12px'}} />
                                         <Area type="monotone" dataKey="hr" stroke={sel.score > 70 ? "#10b981" : "#f43f5e"} strokeWidth={3} fill="url(#colorHrPersonal)" />
                                       </AreaChart>
                                     </ResponsiveContainer>
                                  </div>
                               </div>
                             );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- РУССКАЯ КАРТА БЕЗ АТТРИБУТОВ --- */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl animate-in fade-in duration-500 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6 px-4">
                  <h3 className="text-2xl font-black italic text-slate-800 dark:text-white flex items-center gap-3">
                     <Navigation className="text-blue-500" size={32}/> ОПЕРАТИВНЫЙ РАДАР (FLIGHTRADAR24)
                  </h3>
                  <div className="flex gap-6 bg-slate-50 dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                     <span className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><div className="w-4 h-4 bg-blue-500 rounded-md"></div> Экипаж в норме</span>
                     <span className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><div className="w-4 h-4 bg-rose-500 rounded-md animate-pulse"></div> Аномалия ЧСС</span>
                  </div>
                </div>
                
                <div className="w-full h-[700px] rounded-[2.5rem] overflow-hidden border-8 border-slate-50 dark:border-slate-900 relative z-0">
                  <MapContainer center={[55.75, 37.61]} zoom={4} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    {/* ЧИСТАЯ РУССКАЯ КАРТА GOOGLE (БЕЗ ФЛАГОВ И КОПИРАЙТОВ) */}
                    <TileLayer 
                       url={isDarkMode ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru&apistyle=s.t%3A33|s.e%3Ag|p.c%3A%23242f3e' : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru'} 
                    />
                    
                    {monitorData.map((f, i) => {
                      const depCoords = AIRPORTS[f.dep];
                      const arrCoords = AIRPORTS[f.arr];
                      const hasRisk = (f.crew ||[]).some(c => c.score > 0 && c.score < 70);

                      return (
                        <React.Fragment key={i}>
                          {depCoords && <Marker position={depCoords} icon={L.divIcon({className: 'bg-blue-600 w-3 h-3 rounded-full border-2 border-white shadow-lg'})}><Popup><b className="font-sans text-sm">{f.dep}</b></Popup></Marker>}
                          {arrCoords && <Marker position={arrCoords} icon={L.divIcon({className: 'bg-blue-600 w-3 h-3 rounded-full border-2 border-white shadow-lg'})}><Popup><b className="font-sans text-sm">{f.arr}</b></Popup></Marker>}
                          
                          {/* Линия рисуется, только если есть ОБА аэропорта */}
                          {depCoords && arrCoords && <Polyline positions={[depCoords, arrCoords]} color={hasRisk ? "#f43f5e" : "#3b82f6"} weight={3} opacity={0.5} dashArray="8, 8" />}
                          
                          {f.lat && f.lon && (
                            <Marker position={[f.lat, f.lon]} icon={createPlaneIcon(f.heading, hasRisk)}>
                              <Popup>
                                <div className="text-center font-sans p-2">
                                  <b className="text-blue-600 text-xl block mb-1">{f.number}</b>
                                  <span className="font-black text-slate-500 uppercase text-[10px] bg-slate-100 px-2 py-1 rounded">{f.dep} ➔ {f.arr}</span>
                                </div>
                              </Popup>
                            </Marker>
                          )}
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