import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { 
  Activity, Heart, Plane, ShieldCheck, LogOut, 
  LayoutDashboard, Calendar, History, Upload, Moon, Sun, ClipboardList
} from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [telemetry, setTelemetry] = useState([]); // Живая телеметрия
  const [medicalLogs, setMedicalLogs] = useState([]); // Прошлые отчеты ИИ
  const [myFlights, setMyFlights] = useState([]); // Личное расписание
  const [latestScore, setLatestScore] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Переключение темы
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const fetchData = async () => {
    try {
      // 1. Текущий статус и живой график
      const resDash = await api.get('/crew/dashboard');
      setTelemetry(resDash.data.telemetry_history || []);
      setLatestScore(resDash.data.score || 0);

      // 2. Личное расписание (вызываем наш новый эндпоинт)
      const resFlights = await api.get('/crew/my-flights');
      setMyFlights(resFlights.data || []);

      // 3. История медицинских заключений ИИ
      const resLogs = await api.get('/history'); // Мы делали этот эндпоинт в main.py
      setMedicalLogs(resLogs.data.filter(log => log.crew_member_id === user.user_id) || []);

    } catch (e) { console.error("Ошибка загрузки данных", e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
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
      alert("✅ Данные проанализированы. История обновлена.");
      fetchData();
    } catch (err) { alert("❌ Ошибка файла"); } finally { setUploading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-lg z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-lg shadow-blue-500/40 shadow-lg">
             <Plane size={24} className="text-white" />
          </div>
          <span className="font-bold text-xl uppercase tracking-tighter leading-none">
            Агент МС-21
          </span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Activity size={20} /> Мой статус
          </button>
          
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Calendar size={20} /> Моё расписание
          </button>

          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <History size={20} /> История здоровья
          </button>
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold hover:opacity-80 transition-opacity">
            <LogOut size={20} /> Выход
          </button>
        </div>
      </aside>

      {/* --- MAIN --- */}
      <main className="flex-1 overflow-y-auto p-8">
        
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {activeTab === 'dashboard' && 'Оперативный статус'}
              {activeTab === 'schedule' && 'Полетное задание на месяц'}
              {activeTab === 'history' && 'Архив медицинских данных'}
            </h2>
            <p className="text-slate-400 font-medium font-mono text-sm">AIRLINE DIGITAL TWIN v1.2</p>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-yellow-400 shadow-sm">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">{user.fio[0]}</div>
              <div className="text-left leading-tight">
                <p className="font-bold text-sm">{user.fio}</p>
                <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
              </div>
            </div>
          </div>
        </header>

        {/* --- ВКЛАДКА: МОЙ СТАТУС --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden">
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Работоспособность</p>
                <div className={`text-8xl font-black ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{latestScore}%</div>
                <label className="mt-8 flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-xl">
                  <Upload size={16} /> {uploading ? "Анализ..." : "Синхронизировать часы"}
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-10 -mb-10"><Plane size={350} /></div>
                <div className="relative z-10">
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-4">Текущий рейс МС-21</p>
                   <h3 className="text-6xl font-black tracking-tighter">
                     {myFlights.length > 0 ? myFlights[0].number : 'РЕЗЕРВ'}
                   </h3>
                   <div className="flex items-center gap-6 text-blue-600 font-black text-2xl mt-4">
                      <span>{myFlights.length > 0 ? myFlights[0].from : 'SVO'}</span>
                      <div className="h-[2px] w-12 bg-slate-200 dark:bg-slate-700" />
                      <span>{myFlights.length > 0 ? myFlights[0].to : '---'}</span>
                   </div>
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-emerald-600 text-[10px] font-bold flex items-center gap-2">
                   <ShieldCheck size={14}/> ПРИКАЗ №139 СОБЛЮДЕН
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700">
               <h3 className="text-xl font-bold mb-8 flex items-center gap-3"><Heart fill="#f43f5e" className="text-rose-500" /> Биометрический мониторинг</h3>
               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[...telemetry].reverse()}>
                      <defs><linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#f1f5f9"} />
                      <XAxis dataKey="record_timestamp" hide />
                      <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: isDarkMode ? '#0f172a' : '#fff' }} />
                      <Area type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={5} fill="url(#colorHr)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}

        {/* --- ВКЛАДКА: МОЁ РАСПИСАНИЕ --- */}
        {activeTab === 'schedule' && (
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
             <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5 text-blue-600">Рейс</th>
                    <th className="px-8 py-5">Направление</th>
                    <th className="px-8 py-5">Время вылета</th>
                    <th className="px-8 py-5">Прилет (план)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {myFlights.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                      <td className="px-8 py-5 font-black text-lg group-hover:text-blue-500">{f.number}</td>
                      <td className="px-8 py-5 font-bold tracking-tighter text-slate-700 dark:text-slate-300">{f.from} ➔ {f.to}</td>
                      <td className="px-8 py-5 text-sm font-mono">{f.dep}</td>
                      <td className="px-8 py-5 text-sm font-mono">{f.arr}</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

        {/* --- ВКЛАДКА: ИСТОРИЯ ЗДОРОВЬЯ --- */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl">
             <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-5">Дата анализа</th>
                    <th className="px-8 py-5">Индекс готовности</th>
                    <th className="px-8 py-5">Вердикт ИИ</th>
                    <th className="px-8 py-5 text-right">Детализация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {medicalLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-8 py-5 font-medium">{new Date(log.calculation_timestamp).toLocaleString()}</td>
                      <td className={`px-8 py-5 font-black text-xl ${log.performance_score > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(log.performance_score)}%</td>
                      <td className="px-8 py-5"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${log.performance_level === 'Optimal' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{log.performance_level}</span></td>
                      <td className="px-8 py-5 text-right text-slate-400 italic text-xs">Данные Samsung Watch 4</td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        )}

      </main>
    </div>
  );
};

export default Dashboard;