import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plane, LayoutDashboard, LogOut, Sun, Moon, AlertTriangle, Users, Clock, ShieldAlert } from 'lucide-react';

// Фикс иконок для карты Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

// Координаты аэропортов для карты
const AIRPORTS = {
  'SVO': [55.9726, 37.4146], 'AER':[43.4499, 39.9566], 'ABA':[53.7400, 91.3850],
  'LED':[59.8003, 30.2625], 'SVX':[56.7431, 60.8027], 'OVB': [55.0125, 82.6506],
  'VVO': [43.3989, 132.1480], 'KZN':[55.6061, 49.2787], 'KGD':[54.8900, 20.5926],
  'IST':[41.2752, 28.7519], 'DXB':[25.2532, 55.3657]
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
        setMonitorData(res.data ||[]);
      } catch (e) { console.error(e); }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  },[]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* СИСТЕМНЫЙ САЙДБАР */}
      <aside className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4 border-b border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg"><Plane size={24} className="text-white" /></div>
          <span className="font-black text-xl tracking-tighter uppercase leading-none text-white">
            ЦУП <br/><span className="text-blue-500 text-sm">АЭРОФЛОТ</span>
          </span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'monitor' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Мониторинг МС-21
          </button>
          <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'map' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>
            <Plane size={20} /> Карта полетов
          </button>
        </nav>
        <div className="p-6 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-3 hover:bg-rose-950/30 rounded-xl transition-all"><LogOut size={20} /> Выход</button>
        </div>
      </aside>

      {/* ГЛАВНЫЙ ЭКРАН */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">ЦЕНТР УПРАВЛЕНИЯ ПОЛЕТАМИ</h2>
            <p className="text-slate-400 font-bold text-[10px] tracking-widest uppercase">Оперативный контроль флота</p>
          </div>
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
              
              {/* СВОДКА */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-l-4 border-emerald-500 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Бортов в небе</p>
                  <h4 className="text-4xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-l-4 border-blue-500 shadow-sm">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Сотрудников на смене</p>
                  <h4 className="text-4xl font-black text-slate-800 dark:text-white">
                    {monitorData.reduce((acc, f) => acc + (f.crew?.length || 0), 0)}
                  </h4>
                </div>
              </div>

              {/* КАРТОЧКИ РЕЙСОВ */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {monitorData.map((f, i) => {
                  // Считаем средний балл только по тем, у кого пульс > 0
                  const activeCrew = f.crew.filter(c => c.score > 0);
                  const avgScore = activeCrew.length > 0 ? Math.round(activeCrew.reduce((s, c) => s + c.score, 0) / activeCrew.length) : 0;
                  const alerts = f.crew.filter(c => c.score > 0 && c.score < 70).length;

                  return (
                    <div key={i} className={`bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border-2 transition-all duration-500 overflow-hidden ${alerts > 0 ? 'border-rose-500 shadow-rose-500/20' : 'border-slate-100 dark:border-slate-700'}`}>
                      {/* Шапка рейса */}
                      <div className="p-8 pb-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                        <div>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-[10px] font-black mb-3 inline-block uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                             БОРТ RA-{f.tail.replace('RA-', '')}
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
                            {avgScore > 0 ? `${avgScore}%` : '--'}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Индекс готовности</p>
                        </div>
                      </div>

                      {/* Список экипажа */}
                      <div className="p-6 bg-white dark:bg-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Users size={14}/> Состав экипажа ({f.crew.length} чел.)
                        </p>
                        <div className="space-y-2">
                          {f.crew.map((member, j) => (
                            <div key={j} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                              <div className="flex items-center gap-4">
                                {/* Статус: Серый (нет данных), Зеленый (Ок), Красный (Риск) */}
                                <div className={`w-2.5 h-2.5 rounded-full ${member.score === 0 ? 'bg-slate-300' : (member.score > 70 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]')}`} />
                                <div>
                                  <span className="font-bold text-sm block leading-none">{member.fio}</span>
                                  <span className="text-[9px] font-black text-slate-400 uppercase">{member.role}</span>
                                </div>
                              </div>
                              <div className="flex gap-6 items-center">
                                {member.hr > 0 ? (
                                  <>
                                    <span className="text-xs font-mono text-slate-500 flex items-center gap-1"><Heart size={12} className="text-rose-400"/> {member.hr} bpm</span>
                                    <span className={`text-sm font-black w-10 text-right ${member.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(member.score)}%</span>
                                  </>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 uppercase italic">Ожидание телеметрии</span>
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

          {/* ИНТЕРАКТИВНАЯ КАРТА LEAFLET */}
          {activeTab === 'map' && (
             <div className="bg-white dark:bg-slate-800 p-6 rounded-[3rem] shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in duration-500">
                <h3 className="text-2xl font-black mb-6 px-4 italic text-slate-800 dark:text-white">ИНТЕРАКТИВНАЯ КАРТА ПОЛЕТОВ</h3>
                <div className="w-full h-[600px] rounded-[2rem] overflow-hidden border-4 border-slate-100 dark:border-slate-900 relative z-0">
                  <MapContainer center={[55.7558, 37.6173]} zoom={4} style={{ height: '100%', width: '100%' }}>
                    {/* Используем темную тему карты */}
                    <TileLayer
                      url={isDarkMode 
                        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
                        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
                    />
                    
                    {/* Отрисовываем рейсы */}
                    {monitorData.map((f, i) => {
                      const depCoords = AIRPORTS[f.dep] || AIRPORTS['SVO'];
                      const arrCoords = AIRPORTS[f.arr] || AIRPORTS['SVO'];
                      
                      return (
                        <React.Fragment key={i}>
                          <Marker position={depCoords}>
                            <Popup><b className="text-slate-800">{f.dep}</b></Popup>
                          </Marker>
                          <Marker position={arrCoords}>
                            <Popup><b className="text-slate-800">{f.arr}</b></Popup>
                          </Marker>
                          <Polyline 
                            positions={[depCoords, arrCoords]} 
                            color="#3b82f6" 
                            weight={3} 
                            opacity={0.6} 
                            dashArray="10, 10" 
                          />
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