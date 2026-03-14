import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { Activity, Heart, Plane, ShieldCheck, LogOut, LayoutDashboard, Calendar, Upload, Moon, Sun } from 'lucide-react';

const CrewPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const[telemetry, setTelemetry] = useState([]);
  const [myFlight, setMyFlight] = useState(null);
  const [myFlightsList, setMyFlightsList] = useState([]);
  const [latestScore, setLatestScore] = useState(0);
  const [uploading, setUploading] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const fetchData = async () => {
    try {
      const res = await api.get('/crew/dashboard');
      setTelemetry(res.data.telemetry_history ||[]);
      setLatestScore(res.data.score || 0);
      setMyFlight(res.data.текущий_рейс);

      const resList = await api.get('/crew/my-flights');
      setMyFlightsList(resList.data ||[]);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  },[]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/crew/upload-health', formData);
      alert("✅ Анализ завершен!");
      fetchData();
    } catch (err) { alert("❌ Ошибка формата"); } finally { setUploading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30"><Plane size={24} className="text-white" /></div>
          <span className="font-black text-xl tracking-tighter uppercase leading-none">АГЕНТ <br/><span className="text-blue-500 text-sm">МС-21-300</span></span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Мои данные</p>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Activity size={20} /> Мой статус
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Calendar size={20} /> Моё расписание
          </button>
        </nav>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold w-full p-3 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"><LogOut size={20} /> Выход</button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black uppercase tracking-tight">{activeTab === 'dashboard' ? 'ЛИЧНЫЙ СТАТУС' : 'ПОЛЕТНОЕ ЗАДАНИЕ'}</h2>
          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm text-slate-500 dark:text-yellow-400"><Sun size={20} /></button>
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">{user.fio[0]}</div>
               <div className="text-left leading-tight">
                  <p className="text-blue-500 font-bold uppercase text-[10px] tracking-widest mt-1">
   {user.position}: {user.fio}
</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Индекс */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 text-slate-50 dark:text-slate-700"><Activity size={120}/></div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-2 relative z-10">Работоспособность</p>
                  <div className={`text-8xl font-black relative z-10 ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{latestScore}%</div>
                  
                  <label className="mt-8 flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-xs font-bold cursor-pointer shadow-xl relative z-10 active:scale-95">
                    <Upload size={16} /> {uploading ? "Анализ..." : "Синхронизировать часы"}
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                {/* Рейс */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-20 -mb-20"><Plane size={450} /></div>
                  <div className="relative z-10">
                     <div className="flex justify-between items-center mb-6">
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Текущее полетное задание</p>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-900/50"><ShieldCheck size={12}/> ПРИКАЗ №139 СОБЛЮДЕН</span>
                     </div>
                     <h3 className="text-7xl font-black mb-4 tracking-tighter italic">{myFlight ? myFlight.flight_number : 'РЕЗЕРВ'}</h3>
                     <div className="flex items-center gap-8 text-3xl font-black text-blue-600 dark:text-blue-400 italic">
                        <div className="flex flex-col"><span className="text-[10px] text-slate-400 not-italic uppercase font-bold mb-1">Вылет</span>{myFlight ? myFlight.departure_airport : 'SVO'}</div>
                        <div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-700 relative"><Plane size={20} className="absolute -top-2.5 left-1/2 -translate-x-1/2 rotate-90 text-slate-300"/></div>
                        <div className="flex flex-col text-right"><span className="text-[10px] text-slate-400 not-italic uppercase font-bold mb-1">Прилет</span>{myFlight ? myFlight.arrival_airport : '---'}</div>
                     </div>
                  </div>
                </div>
              </div>

              {/* График */}
              <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-700">
                 <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-black flex items-center gap-3 tracking-tight"><Heart fill="#f43f5e" className="text-rose-500" /> Биометрическая динамика</h3>
                 </div>
                 <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...telemetry].reverse()}>
                        <defs><linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#f1f5f9"} />
                        <XAxis dataKey="record_timestamp" hide />
                        <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }} />
                        <Area type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={5} fill="url(#colorHr)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <tr><th className="px-8 py-6 text-blue-600">Номер рейса</th><th className="px-8 py-6">Маршрут</th><th className="px-8 py-6">Вылет (MSK)</th><th className="px-8 py-6">Прилет (План)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {myFlightsList.map((f, i) => (
                      <tr key={i} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
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
        </div>
      </main>
    </div>
  );
};

export default CrewPage;