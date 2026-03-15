import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Tooltip, CartesianGrid } from 'recharts';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, 
  Users, Heart, ShieldAlert, Map, ChevronDown, ChevronUp, Clock, Info
} from 'lucide-react';

// Фикс иконок Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Иконка летящего самолета
const createPlaneIcon = (heading, isRisk) => {
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 0}deg)`, color: isRisk ? '#f43f5e' : '#3b82f6', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>
      <Plane size={32} fill="currentColor" stroke="white" strokeWidth={1} />
    </div>
  );
  return L.divIcon({ html, className: 'plane-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
};

// Точные координаты всех 30+ аэропортов
const AIRPORTS = {
  'SVO':[55.9726, 37.4146], 'AER':[43.4499, 39.9566], 'ABA':[53.7400, 91.3850],
  'LED':[59.8003, 30.2625], 'SVX':[56.7431, 60.8027], 'OVB':[55.0125, 82.6506],
  'VVO':[43.3989, 132.1480], 'KZN':[55.6061, 49.2787], 'KGD':[54.8900, 20.5926],
  'IST':[41.2752, 28.7519], 'DXB':[25.2532, 55.3657], 'CEK':[55.3053, 61.3936],
  'PEE':[57.9144, 56.0214], 'VOG':[48.7817, 44.3467], 'UFA':[54.5575, 55.8744],
  'IKT':[52.2680, 104.3890], 'KJA':[56.1722, 92.4933], 'OMS':[54.9581, 73.3108],
  'MRV':[44.2250, 43.0817], 'MCX':[42.8169, 47.6514], 'YKS':[62.0933, 129.7710],
  'UUS':[46.8886, 142.7170], 'BAX':[53.3636, 83.5383], 'KEJ':[55.2708, 86.1072],
  'ARH':[64.5961, 40.7164], 'ASF':[46.2833, 48.0064], 'EVN':[40.1473, 44.3959],
  'TAS':[41.2579, 69.2812], 'DYR': [64.7342, 177.7410], 'KVK': [67.5772, 33.5853]
};

// Расчет шкалы прогресса полета
const calcFlightProgress = (timeDep, timeArr) => {
  if (!timeDep || !timeArr) return 0;
  const now = new Date();
  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes() + 180; // UTC+3
  let [dh, dm] = timeDep.split(':').map(Number);
  let [ah, am] = timeArr.split(':').map(Number);
  let depMins = dh * 60 + dm;
  let arrMins = ah * 60 + am;
  if (arrMins < depMins) arrMins += 1440;
  let curr = currentMins;
  if (curr < depMins && arrMins >= 1440) curr += 1440;
  let progress = ((curr - depMins) / (arrMins - depMins)) * 100;
  return Math.max(0, Math.min(100, progress));
};

const DispatcherPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const[monitorData, setMonitorData] = useState([]);
  const [expandedFlight, setExpandedFlight] = useState(null); // Какой рейс раскрыт
  const [selectedMember, setSelectedMember] = useState(null); // Чей график смотрим

  // Включаем темную тему при старте, если нужно
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
  },[]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dispatcher/monitor');
        setMonitorData(Array.isArray(res.data) ? res.data :[]);
      } catch (e) { console.error("Ошибка сети:", e); }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  },[]);

  const riskCount = monitorData.filter(f => (f.crew ||[]).some(c => c.score > 0 && c.score < 70)).length;

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 overflow-hidden">
      
      {/* --- БОКОВОЕ МЕНЮ --- */}
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
        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-4 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all">
            <LogOut size={20} /> Завершить смену
          </button>
        </div>
      </aside>

      {/* --- ОСНОВНОЙ ЭКРАН --- */}
      <main className="flex-1 overflow-y-auto">
        {/* ШАПКА */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Центр управления полетами</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Связь с сервером активна
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400 hover:scale-105 transition-all">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 pr-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">ДЕЖУРНЫЙ ДИСПЕТЧЕР</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-[1600px] mx-auto">
          {/* --- ВКЛАДКА МОНИТОРИНГА --- */}
          {activeTab === 'monitor' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* СТАТИСТИКА */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-l-4 border-emerald-500 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Бортов в небе</p>
                    <h4 className="text-5xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                  </div>
                  <div className="w-16 h-16 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-blue-600"><Plane size={32} /></div>
                </div>
                <div className={`p-6 rounded-[2rem] border-2 shadow-xl flex justify-between items-center transition-colors ${riskCount > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${riskCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      <AlertTriangle size={14}/> Зона риска (Экипаж)
                    </p>
                    <h4 className={`text-5xl font-black ${riskCount > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{riskCount} БОРТА</h4>
                  </div>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${riskCount > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'}`}><ShieldAlert size={32} /></div>
                </div>
              </div>

              {/* СПИСОК РЕЙСОВ */}
              <div className="grid grid-cols-1 gap-8">
                {monitorData.map((f, i) => {
                  const safeCrew = f.crew ||[];
                  const activeCrew = safeCrew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = safeCrew.filter(c => c.score > 0 && c.score < 70).length;
                  const progress = calcFlightProgress(f.time_dep, f.time_arr);
                  const hasRisk = alerts > 0;

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 overflow-hidden ${hasRisk ? 'border-rose-500 shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      
                      {/* ШАПКА РЕЙСА (КЛИКАБЕЛЬНАЯ) */}
                      <div 
                        className="p-8 pb-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                        onClick={() => { setExpandedFlight(expandedFlight === f.id ? null : f.id); setSelectedMember(null); }}
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black mb-3 inline-block uppercase tracking-widest">
                               БОРТ: {f.tail || 'ОЖИДАНИЕ'}
                            </span>
                            <div className="flex items-center gap-6">
                               <h4 className="text-5xl font-black tracking-tighter italic text-blue-600 dark:text-blue-400">{f.number || f.flight}</h4>
                               {hasRisk && <span className="px-4 py-2 bg-rose-500 text-white text-xs font-black rounded-xl animate-pulse flex items-center gap-2"><AlertTriangle size={14}/> ВНИМАНИЕ</span>}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-6">
                            <div>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сводный индекс экипажа</p>
                               <div className={`text-5xl font-black ${avgScore === 0 ? 'text-slate-300' : (avgScore > 70 ? 'text-emerald-500' : 'text-rose-500')}`}>
                                 {avgScore > 0 ? `${avgScore}%` : '--'}
                               </div>
                            </div>
                            {expandedFlight === f.id ? <ChevronUp size={36} className="text-slate-400"/> : <ChevronDown size={36} className="text-slate-400"/>}
                          </div>
                        </div>

                        {/* ПРОГРЕСС-БАР ПОЛЕТА */}
                        <div className="mt-4">
                          <div className="flex justify-between items-end mb-2 font-bold">
                            <div className="text-left">
                               <p className="text-[10px] text-slate-400 uppercase">Вылет</p>
                               <p className="text-2xl text-slate-800 dark:text-white">{f.dep} <span className="text-sm text-slate-500">{f.time_dep}</span></p>
                            </div>
                            <div className="text-center pb-1">
                               <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] rounded-lg font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                                 В полете ({Math.round(progress)}%)
                               </span>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-slate-400 uppercase">Прибытие</p>
                               <p className="text-2xl text-slate-800 dark:text-white"><span className="text-sm text-slate-500">{f.time_arr}</span> {f.arr}</p>
                            </div>
                          </div>
                          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-4">
                             <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }}></div>
                             <Plane size={24} className="absolute -top-3 text-blue-600 dark:text-blue-400 transition-all duration-1000 drop-shadow-md" style={{ left: `calc(${progress}% - 12px)` }} />
                          </div>
                        </div>
                      </div>

                      {/* СПИСОК ЭКИПАЖА И ГРАФИКИ (АККОРДЕОН) */}
                      {expandedFlight === f.id && (
                        <div className="p-8 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-4 duration-300">
                          <div className="flex justify-between items-center mb-6">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                               <Users size={16}/> Состав на борту ({safeCrew.length} чел.)
                             </p>
                             {alerts > 0 && <span className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-100 dark:border-rose-900">Аномалии: {alerts} чел.</span>}
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                            {safeCrew.map((member, j) => (
                              <div 
                                key={j} 
                                onClick={() => setSelectedMember(selectedMember === member.uid ? null : member.uid)}
                                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${selectedMember === member.uid ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-blue-300'}`}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full shadow-sm ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')}`} />
                                    <div>
                                      <span className="font-bold text-sm block text-slate-800 dark:text-slate-200">{member.fio}</span>
                                      <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">{member.role}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex justify-between items-end">
                                  <div>
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Пульс</span>
                                     <span className="text-sm font-mono font-bold flex items-center gap-1"><Heart size={12} className={member.score > 70 ? "text-slate-400" : "text-rose-500 animate-pulse"}/> {member.hr > 0 ? member.hr : '--'}</span>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-[9px] text-slate-400 uppercase font-bold block">Индекс</span>
                                     <span className={`text-xl font-black leading-none ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{member.score > 0 ? `${Math.round(member.score)}%` : '--'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* ГРАФИК ВЫБРАННОГО СОТРУДНИКА */}
                          {selectedMember && (
                             <div className="mt-8 p-8 bg-slate-50 dark:bg-slate-900 rounded-[2rem] border border-blue-500/30 animate-in zoom-in-95">
                                <div className="flex justify-between items-center mb-6">
                                   <div>
                                      <h4 className="text-blue-600 dark:text-blue-400 font-black text-lg uppercase tracking-widest flex items-center gap-2">
                                        <Activity size={20}/> Детальный анализ ИИ
                                      </h4>
                                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
                                        Сотрудник: {safeCrew.find(m => m.uid === selectedMember)?.fio}
                                      </p>
                                   </div>
                                   <button onClick={() => setSelectedMember(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Скрыть график</button>
                                </div>
                                <div className="h-64 w-full">
                                   <ResponsiveContainer width="100%" height="100%">
                                     <AreaChart data={safeCrew.find(m => m.uid === selectedMember)?.history ||[]}>
                                       <defs>
                                         <linearGradient id="colorHrPersonal" x1="0" y1="0" x2="0" y2="1">
                                           <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                                           <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                         </linearGradient>
                                       </defs>
                                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                                       <XAxis hide />
                                       <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold'}} />
                                       <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', border: 'none', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                                       <Area type="monotone" dataKey="hr" stroke="#3b82f6" strokeWidth={4} fill="url(#colorHrPersonal)" />
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

          {/* --- ВКЛАДКА КАРТЫ (РАДАР) --- */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-2xl animate-in fade-in duration-500 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-8 px-4">
                  <div>
                    <h3 className="text-3xl font-black italic text-slate-800 dark:text-white flex items-center gap-3">
                       <Navigation className="text-blue-500" size={32}/> ОПЕРАТИВНЫЙ РАДАР
                    </h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Реальные координаты Flightradar24</p>
                  </div>
                  <div className="flex gap-6 bg-slate-50 dark:bg-slate-900 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                     <span className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><div className="w-4 h-4 bg-blue-500 rounded-md"></div> Экипаж в норме</span>
                     <span className="flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><div className="w-4 h-4 bg-rose-500 rounded-md animate-pulse"></div> Аномалия ЧСС</span>
                  </div>
                </div>
                
                <div className="w-full h-[700px] rounded-[2.5rem] overflow-hidden border-8 border-slate-50 dark:border-slate-900 relative z-0">
                  <MapContainer center={[55.75, 37.61]} zoom={4} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    {/* Google Maps RU (БЕЗ ПОЛИТИКИ И ФЛАГОВ) */}
                    <TileLayer url={isDarkMode ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru&apistyle=s.t%3A33|s.e%3Ag|p.c%3A#242f3e' : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=ru'} />
                    
                    {monitorData.map((f, i) => {
                      const depCoords = AIRPORTS[f.dep];
                      const arrCoords = AIRPORTS[f.arr];
                      if (!depCoords || !arrCoords) return null; // Защита от неизвестных аэропортов
                      
                      const hasRisk = (f.crew ||[]).some(c => c.score > 0 && c.score < 70);

                      return (
                        <React.Fragment key={i}>
                          {/* Маркеры аэропортов (Синие кружки) */}
                          <Marker position={depCoords} icon={L.divIcon({className: 'bg-blue-600 w-3 h-3 rounded-full border-2 border-white shadow-lg'})}>
                             <Popup><b className="font-sans text-sm">{f.dep}</b></Popup>
                          </Marker>
                          <Marker position={arrCoords} icon={L.divIcon({className: 'bg-blue-600 w-3 h-3 rounded-full border-2 border-white shadow-lg'})}>
                             <Popup><b className="font-sans text-sm">{f.arr}</b></Popup>
                          </Marker>
                          
                          {/* Линия маршрута */}
                          <Polyline positions={[depCoords, arrCoords]} color={hasRisk ? "#f43f5e" : "#3b82f6"} weight={3} opacity={0.5} dashArray="8, 8" />
                          
                          {/* Самолетик на координатах */}
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