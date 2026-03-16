import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { Activity, Heart, Plane, ShieldCheck, LogOut, LayoutDashboard, Calendar, Upload, Moon, Sun, TrendingUp, History } from 'lucide-react';

const CrewPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [telemetry, setTelemetry] = useState([]);
  const [myFlight, setMyFlight] = useState(null);
  const [myFlightsList, setMyFlightsList] = useState([]);
  const [medicalLogs, setMedicalLogs] = useState([]);
  const [latestScore, setLatestScore] = useState(0);
  const [uploading, setUploading] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const fetchData = async () => {
    try {
      const resDash = await api.get('/crew/dashboard');
      setTelemetry(resDash.data.telemetry_history || []);
      setLatestScore(resDash.data.score || 0);
      setMyFlight(resDash.data.текущий_рейс);

      const resList = await api.get('/crew/my-flights');
      setMyFlightsList(resList.data || []);

      const resLogs = await api.get('/history');
      setMedicalLogs(resLogs.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/crew/upload-health', formData);
      alert("✅ Анализ ИИ завершен! Статистика обновлена.");
      fetchData();
    } catch (err) { alert("❌ Ошибка формата"); } finally { setUploading(false); }
  };

  // Расчет ИИ-тренда для статистики
  const getTrendAnalysis = () => {
    if (medicalLogs.length < 2) return "Недостаточно данных для формирования долгосрочного прогноза ИИ.";
    const recentAvg = medicalLogs.slice(0, 3).reduce((acc, l) => acc + l.performance_score, 0) / Math.min(3, medicalLogs.length);
    if (recentAvg > 85) return "Позитивный тренд: Ваша работоспособность стабильно высока. Организм отлично справляется с полетными нагрузками.";
    if (recentAvg > 70) return "Стабильный тренд: Показатели в норме, однако наблюдаются небольшие колебания ЧСС. Рекомендуется соблюдать режим сна.";
    return "ОТРИЦАТЕЛЬНЫЙ ТРЕНД: ИИ фиксирует систематическое снижение работоспособности. Обратитесь в медицинскую службу для внепланового осмотра.";
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg"><Plane size={24} className="text-white" /></div>
          <span className="font-black text-xl tracking-tighter uppercase leading-none">АГЕНТ <br/><span className="text-blue-500 text-sm">МС-21-300</span></span>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Мои данные</p>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Activity size={20} /> Оперативный статус
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Calendar size={20} /> Моё расписание
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <TrendingUp size={20} /> Статистика и Тренд
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-3 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"><LogOut size={20} /> Выход</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-tight">{activeTab === 'dashboard' ? 'ОПЕРАТИВНЫЙ СТАТУС' : activeTab === 'schedule' ? 'ПОЛЕТНОЕ ЗАДАНИЕ' : 'ПЕРСОНАЛЬНАЯ АНАЛИТИКА'}</h2>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl"><Sun size={20} /></button>
            <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1400px] mx-auto">
          
          {/* СТАТУС (Оставили как было, оно идеальное) */}
          {activeTab === 'dashboard' && (
             <div className="space-y-8 animate-in fade-in duration-500">
                {/* ... (здесь твой старый код вкладки dashboard с круглой цифрой и графиком) ... */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 text-slate-50 dark:text-slate-700"><Activity size={120}/></div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-2 relative z-10">Работоспособность</p>
                  <div className={`text-8xl font-black relative z-10 ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{latestScore}%</div>
                  <label className="mt-8 flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-xs font-bold cursor-pointer hover:scale-105 transition-all shadow-xl relative z-10">
                    <Upload size={16} /> {uploading ? "Анализ..." : "Синхронизировать часы"}
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-20 -mb-20"><Plane size={450} /></div>
                  <div className="relative z-10">
                     <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-4">Текущий рейс</p>
                     <h3 className="text-7xl font-black mb-4 tracking-tighter italic">{myFlight ? myFlight.flight_number : 'РЕЗЕРВ'}</h3>
                     <div className="flex items-center gap-8 text-3xl font-black text-blue-600 dark:text-blue-400 italic">
                        <span>{myFlight ? myFlight.departure_airport : 'SVO'}</span> <Plane size={24} className="rotate-90 text-slate-300"/> <span>{myFlight ? myFlight.arrival_airport : '---'}</span>
                     </div>
                  </div>
                </div>
              </div>
             </div>
          )}

          {/* МОЕ РАСПИСАНИЕ (Оставили как было) */}
          {activeTab === 'schedule' && (
             <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-right-10 duration-500 overflow-hidden">
                 {/* ... Твоя таблица myFlightsList ... */}
                 <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr><th className="px-8 py-6 text-blue-600">Номер рейса</th><th className="px-8 py-6">Маршрут</th><th className="px-8 py-6">Вылет</th><th className="px-8 py-6">Прилет</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {myFlightsList.map((f, i) => (
                      <tr key={i} className="hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-8 py-6 font-black text-xl italic">{f.number}</td>
                        <td className="px-8 py-6 font-bold">{f.from} ➔ {f.to}</td>
                        <td className="px-8 py-6 font-mono text-slate-500">{f.dep}</td>
                        <td className="px-8 py-6 font-mono text-slate-400">{f.arr}</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          )}

          {/* НОВАЯ ВЕРСИЯ: ПЕРСОНАЛЬНАЯ СТАТИСТИКА И ТРЕНДЫ */}
          {activeTab === 'history' && (
            <div className="space-y-8 animate-in slide-in-from-left-10 duration-500">
              
              {/* Вывод ИИ-анализа */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border-l-8 border-blue-500">
                 <h3 className="text-xl font-black uppercase mb-2">Общее заключение ИИ-Агента</h3>
                 <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                   {getTrendAnalysis()}
                 </p>
              </div>

              {/* График исторической динамики */}
              <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-xl">
                 <h3 className="text-xl font-black mb-8 flex items-center gap-3 uppercase"><History className="text-blue-500"/> Динамика готовности (за месяц)</h3>
                 <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...medicalLogs].reverse()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                        <XAxis dataKey="calculation_timestamp" tickFormatter={(v) => new Date(v).toLocaleDateString()} hide/>
                        <YAxis domain={[0, 100]} />
                        <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', borderRadius: '15px'}}/>
                        <Bar dataKey="performance_score" radius={[8, 8, 0, 0]}>
                          {medicalLogs.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.performance_score > 70 ? '#10b981' : '#f43f5e'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              {/* Таблица истории загрузок */}
              <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <tr><th className="px-8 py-5">Дата анализа</th><th className="px-8 py-5">Индекс</th><th className="px-8 py-5">Статус</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {medicalLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-8 py-5 font-bold">{new Date(log.calculation_timestamp).toLocaleString()}</td>
                          <td className={`px-8 py-5 font-black text-xl ${log.performance_score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.round(log.performance_score)}%</td>
                          <td className="px-8 py-5"><span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase border border-slate-200 dark:border-slate-700">{log.performance_level}</span></td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CrewPage;