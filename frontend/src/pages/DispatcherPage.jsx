import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { 
  Plane, LayoutDashboard, LogOut, Sun, Moon, 
  AlertTriangle, Users, Heart, ShieldAlert, Map, 
  Clock, Navigation, Activity, CheckCircle
} from 'lucide-react';

// Фикс иконок для карты Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Координаты основных аэропортов для отрисовки траекторий
const AIRPORTS = {
  'SVO': [55.9726, 37.4146], 'AER': [43.4499, 39.9566], 'ABA':[53.7400, 91.3850],
  'LED':[59.8003, 30.2625], 'SVX':[56.7431, 60.8027], 'OVB':[55.0125, 82.6506],
  'VVO':[43.3989, 132.1480], 'KZN':[55.6061, 49.2787], 'KGD':[54.8900, 20.5926],
  'IST':[41.2752, 28.7519], 'DXB':[25.2532, 55.3657], 'CEK':[55.3053, 61.3936],
  'PEE':[57.9144, 56.0214], 'VOG': [48.7817, 44.3467], 'UFA': [54.5575, 55.8744],
  'IKT': [52.2680, 104.3890], 'KJA':[56.1722, 92.4933], 'OMS':[54.9581, 73.3108],
  'MRV':[44.2250, 43.0817], 'MCX':[42.8169, 47.6514], 'YKS':[62.0933, 129.7710],
  'UUS':[46.8886, 142.7170], 'BAX': [53.3636, 83.5383], 'KEJ':[55.2708, 86.1072],
  'ARH':[64.5961, 40.7164], 'ASF':[46.2833, 48.0064], 'EVN':[40.1473, 44.3959],
  'TAS':[41.2579, 69.2812], 'DYR': [64.7342, 177.7410], 'KVK': [67.5772, 33.5853]
};

// Функция создания иконки самолета (поворачивается по курсу)
const createPlaneIcon = (heading, isRisk) => {
  const color = isRisk ? '#f43f5e' : '#3b82f6';
  const html = renderToStaticMarkup(
    <div style={{ transform: `rotate(${heading || 90}deg)`, color: color, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>
      <Plane size={28} fill="currentColor" />
    </div>
  );
  return L.divIcon({ html, className: 'custom-plane-icon', iconSize: [28, 28], iconAnchor: [14, 14] });
};

// Функция математического расчета позиции самолета
const calcFlightProgress = (timeDep, timeArr) => {
  const now = new Date();
  const currentMins = now.getUTCHours() * 60 + now.getUTCMinutes() + 180; // UTC+3 (MSK)
  
  let[dh, dm] = timeDep.split(':').map(Number);
  let [ah, am] = timeArr.split(':').map(Number);
  let depMins = dh * 60 + dm;
  let arrMins = ah * 60 + am;
  
  if (arrMins < depMins) arrMins += 24 * 60; // Переход через полночь
  let curr = currentMins;
  if (curr < depMins && arrMins >= 24 * 60) curr += 24 * 60;

  let progress = (curr - depMins) / (arrMins - depMins);
  return Math.max(0, Math.min(1, progress)); // Возвращаем % от 0 до 1
};

const DispatcherPage = ({ user, onLogout }) => {
  const[activeTab, setActiveTab] = useState('monitor');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [monitorData, setMonitorData] = useState([]);
  const [lastSync, setLastSync] = useState(new Date());

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dispatcher/monitor');
        setMonitorData(Array.isArray(res.data) ? res.data :[]);
        setLastSync(new Date());
      } catch (e) { console.error(e); }
    };
    load();
    const interval = setInterval(load, 10000); // Синхронизация каждые 10 сек
    return () => clearInterval(interval);
  },[]);

  const riskFlightsCount = monitorData.filter(f => (f.crew ||[]).some(c => c.score > 0 && c.score < 70)).length;

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* SIDEBAR ДИСПЕТЧЕРА */}
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

      {/* ОСНОВНОЙ ЭКРАН ЦУП */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tight">Центр управления полетами</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Связь с сервером активна
              </span>
              <span className="text-[10px] text-slate-400">|</span>
              <span className="text-[10px] text-slate-400 font-mono">Синхр: {lastSync.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400 hover:scale-105 transition-all">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{user.fio}</p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-[1600px] mx-auto">
          {/* ВКЛАДКА МОНИТОРИНГА */}
          {activeTab === 'monitor' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              
              {/* СВОДКА ДИСПЕТЧЕРА */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Бортов в небе</p>
                    <h4 className="text-5xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                  </div>
                  <div className="w-16 h-16 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-blue-600"><Plane size={32} /></div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Экипажи на смене</p>
                    <h4 className="text-5xl font-black text-slate-800 dark:text-white">
                      {monitorData.reduce((acc, f) => acc + (f.crew?.length || 0), 0)}
                    </h4>
                  </div>
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-emerald-600"><Users size={32} /></div>
                </div>

                <div className={`p-6 rounded-3xl border-2 shadow-sm flex justify-between items-center transition-colors ${riskFlightsCount > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${riskFlightsCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      <AlertTriangle size={14}/> Зона риска
                    </p>
                    <h4 className={`text-5xl font-black ${riskFlightsCount > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{riskFlightsCount}</h4>
                  </div>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${riskFlightsCount > 0 ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-400'}`}><ShieldAlert size={32} /></div>
                </div>
              </div>

              {/* СПИСОК РЕЙСОВ */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {monitorData.map((f, i) => {
                  const safeCrew = f.crew ||[];
                  const activeCrew = safeCrew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = safeCrew.filter(c => c.score > 0 && c.score < 70).length;
                  const progress = calcFlightProgress(f.time_dep, f.time_arr);

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 overflow-hidden ${alerts > 0 ? 'border-rose-500 shadow-rose-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                      
                      {/* ШАПКА КАРТОЧКИ */}
                      <div className="p-8 pb-6 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black mb-3 inline-block uppercase tracking-widest">
                               БОРТ: RA-{f.tail.replace('RA-', '')}
                            </span>
                            <h4 className="text-5xl font-black tracking-tighter italic text-blue-600 dark:text-blue-400">{f.number || f.flight}</h4>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Сводный индекс экипажа</p>
                            <div className={`text-5xl font-black ${avgScore === 0 ? 'text-slate-300' : (avgScore > 70 ? 'text-emerald-500' : 'text-rose-500')}`}>
                              {avgScore > 0 ? `${avgScore}%` : '--'}
                            </div>
                          </div>
                        </div>

                        {/* ПРОГРЕСС ПОЛЕТА (ТРАЕКТОРИЯ) */}
                        <div className="mt-4">
                          <div className="flex justify-between items-end mb-2 font-bold">
                            <div className="text-left">
                               <p className="text-[10px] text-slate-400 uppercase">Вылет</p>
                               <p className="text-2xl text-slate-800 dark:text-white">{f.dep} <span className="text-sm text-slate-500">{f.time_dep}</span></p>
                            </div>
                            <div className="text-center pb-1">
                               <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[9px] rounded font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                                 В полете ({Math.round(progress * 100)}%)
                               </span>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] text-slate-400 uppercase">Прибытие (План)</p>
                               <p className="text-2xl text-slate-800 dark:text-white"><span className="text-sm text-slate-500">{f.time_arr}</span> {f.arr}</p>
                            </div>
                          </div>
                          {/* Полоска прогресса с летящим самолетиком */}
                          <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-4">
                             <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full" style={{ width: `${progress * 100}%` }}></div>
                             <Plane size={20} className="absolute -top-2.5 text-blue-600 dark:text-blue-400 transition-all duration-1000" style={{ left: `calc(${progress * 100}% - 10px)` }} />
                          </div>
                        </div>
                      </div>

                      {/* ТАБЛИЦА ЭКИПАЖА */}
                      <div className="p-6 bg-white dark:bg-slate-800">
                        <div className="flex justify-between items-center mb-4 px-2">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Users size={14}/> Состав на борту
                           </p>
                           {alerts > 0 && <span className="text-[10px] font-black text-rose-500 uppercase bg-rose-50 dark:bg-rose-950/50 px-2 py-1 rounded border border-rose-100 dark:border-rose-900">Аномалии: {alerts} чел.</span>}
                        </div>
                        
                        <div className="space-y-2">
                          {safeCrew.map((member, j) => (
                            <div key={j} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors border border-transparent hover:border-blue-100 dark:hover:border-slate-600">
                              <div className="flex items-center gap-4">
                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')}`} />
                                <div>
                                  <span className="font-bold text-sm block text-slate-800 dark:text-slate-200">{member.fio}</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{member.role}</span>
                                </div>
                              </div>
                              <div className="flex gap-6 items-center">
                                {member.hr > 0 ? (
                                  <>
                                    <div className="text-right">
                                       <span className="text-[9px] text-slate-400 uppercase font-bold block leading-none">Текущая ЧСС</span>
                                       <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 justify-end"><Heart size={10} className={member.score > 70 ? "text-slate-400" : "text-rose-500 animate-pulse"}/> {member.hr}</span>
                                    </div>
                                    <div className="text-right w-12">
                                       <span className="text-[9px] text-slate-400 uppercase font-bold block leading-none">Индекс</span>
                                       <span className={`text-lg font-black leading-none ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(member.score)}%</span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase italic bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">Сбор данных</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ИНТЕРАКТИВНАЯ КАРТА */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl animate-in fade-in duration-500 border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6 px-4">
                  <h3 className="text-2xl font-black italic text-slate-800 dark:text-white flex items-center gap-3">
                     <Navigation className="text-blue-500"/> РАДАР И ГЕО-ТРЕКИНГ МС-21
                  </h3>
                  <div className="flex gap-4">
                     <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Экипаж в норме</span>
                     <span className="flex items-center gap-2 text-xs font-bold text-slate-500"><div className="w-3 h-3 bg-rose-500 rounded-sm"></div> Зафиксирован стресс</span>
                  </div>
                </div>
                
                <div className="w-full h-[650px] rounded-[2rem] overflow-hidden border-4 border-slate-100 dark:border-slate-900 shadow-inner z-0">
                  <MapContainer center={[55.7558, 37.6173]} zoom={4} style={{ height: '100%', width: '100%' }} attributionControl={false}>
                    <TileLayer url={isDarkMode ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'} />
                    
                    {monitorData.map((f, i) => {
                      // Логика карты: берем координаты из словаря AIRPORTS
                      const depCoords = AIRPORTS[f.dep] || AIRPORTS['SVO'];
                      const arrCoords = AIRPORTS[f.arr] || AIRPORTS['SVO'];
                      
                      // Рассчитываем текущее положение самолета математически!
                      const progress = calcFlightProgress(f.time_dep, f.time_arr);
                      const currentLat = depCoords[0] + (arrCoords[0] - depCoords[0]) * progress;
                      const currentLon = depCoords[1] + (arrCoords[1] - depCoords[1]) * progress;
                      
                      // Расчет угла поворота самолетика
                      const heading = Math.atan2(arrCoords[1] - depCoords[1], arrCoords[0] - depCoords[0]) * (180 / Math.PI);
                      
                      const hasRisk = (f.crew ||[]).some(c => c.score > 0 && c.score < 70);

                      return (
                        <React.Fragment key={i}>
                          {/* Маркер вылета */}
                          <Marker position={depCoords}><Popup><b className="text-slate-800">{f.dep}</b></Popup></Marker>
                          {/* Маркер прилета */}
                          <Marker position={arrCoords}><Popup><b className="text-slate-800">{f.arr}</b></Popup></Marker>
                          
                          {/* Линия пройденного пути (сплошная) */}
                          <Polyline positions={[depCoords, [currentLat, currentLon]]} color={hasRisk ? "#f43f5e" : "#3b82f6"} weight={4} opacity={0.8} />
                          {/* Линия оставшегося пути (пунктир) */}
                          <Polyline positions={[[currentLat, currentLon], arrCoords]} color="#94a3b8" weight={2} opacity={0.5} dashArray="5, 8" />
                          
                          {/* Сам летящий самолетик */}
                          <Marker position={[currentLat, currentLon]} icon={createPlaneIcon(heading, hasRisk)}>
                            <Popup>
                              <div className="text-center p-1">
                                <b className="text-slate-800 text-lg block">{f.number || f.flight}</b>
                                <span className="text-slate-500 text-xs font-bold">{f.dep} ➔ {f.arr}</span>
                                <div className="mt-2 text-xs">Прогресс: {Math.round(progress * 100)}%</div>
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