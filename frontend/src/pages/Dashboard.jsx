import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area 
} from 'recharts';
import { 
  Activity, Heart, Plane, Users, ShieldCheck, LogOut, 
  Calendar, History, Upload, Moon, Sun, Search, 
  AlertTriangle, Bell, ShieldAlert, Stethoscope, LayoutDashboard
} from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  // Состояния интерфейса
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Данные из БД
  const [telemetry, setTelemetry] = useState([]);      // Личный пульс
  const [medicalLogs, setMedicalLogs] = useState([]);  // История анализов ИИ
  const [myFlights, setMyFlights] = useState([]);      // Личное расписание
  const [latestScore, setLatestScore] = useState(0);   // Текущий % готовности
  const [staff, setStaff] = useState([]);              // Реестр (для админа)
  const [monitorData, setMonitorData] = useState([]);  // Табло рейсов (для диспетчера)

  // 1. Переключение темы (Light/Dark)
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  // 2. Глобальная загрузка данных в зависимости от роли и вкладки
  const loadData = async () => {
    try {
      // Данные для экипажа (Личный статус)
      if (activeTab === 'dashboard' || activeTab === 'schedule' || activeTab === 'history') {
        const resDash = await api.get('/crew/dashboard');
        setTelemetry(resDash.data.telemetry_history || []);
        setLatestScore(resDash.data.score || 0);
        
        const resFlights = await api.get('/crew/my-flights');
        setMyFlights(resFlights.data || []);

        const resLogs = await api.get('/history');
        setMedicalLogs(resLogs.data.filter(log => log.crew_member_id === user.user_id) || []);
      }

      // Данные для диспетчера (Мониторинг флота)
      if (activeTab === 'flights') {
        const resMon = await api.get('/dispatcher/monitor');
        setMonitorData(resMon.data || []);
      }

      // Данные для админа (Реестр персонала)
      if (activeTab === 'staff') {
        const resStaff = await api.get('/admin/staff');
        setStaff(resStaff.data || []);
      }
    } catch (e) {
      console.error("Ошибка синхронизации данных", e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000); // Автообновление каждые 20 сек
    return () => clearInterval(interval);
  }, [activeTab]);

  // 3. Загрузка данных с часов Samsung
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/crew/upload-health', formData);
      alert("✅ Агент ИИ: Данные проанализированы успешно!");
      loadData();
    } catch (err) {
      alert("❌ Ошибка: Неверный формат данных");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-500 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      
      {/* --- SIDEBAR (БОКОВОЕ МЕНЮ) --- */}
      <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-30">
        <div className="p-8 flex items-center gap-4">
          <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30">
             <Plane size={24} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tighter uppercase leading-none">МС-21<br/><span className="text-blue-500 text-sm">AGENT</span></span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          {/* Вкладки для экипажа */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-3">Личное пространство</p>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Activity size={20} /> Мой статус
          </button>
          <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Calendar size={20} /> Моё расписание
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <History size={20} /> История здоровья
          </button>

          {/* Вкладки для управления (условный рендеринг) */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-8 mb-4 px-3">Управление</p>
          <button onClick={() => setActiveTab('flights')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'flights' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} /> Мониторинг флота
          </button>
          {user.role === 'administrator' && (
            <button onClick={() => setActiveTab('staff')} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'staff' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <Users size={20} /> Реестр персонала
            </button>
          )}
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-500 font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 p-3 w-full rounded-xl transition-all">
            <LogOut size={20} /> Выход из системы
          </button>
        </div>
      </aside>

      {/* --- MAIN SECTION --- */}
      <main className="flex-1 overflow-y-auto relative">
        
        {/* TOP NAVBAR */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
            {activeTab === 'dashboard' && 'Оперативный статус'}
            {activeTab === 'schedule' && 'Полетный план'}
            {activeTab === 'history' && 'Архив ИИ-анализа'}
            {activeTab === 'flights' && 'Центр управления (ЦУП)'}
            {activeTab === 'staff' && 'Отдел кадров'}
          </h2>

          <div className="flex items-center gap-4">
            <button onClick={toggleTheme} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-yellow-400 shadow-sm hover:scale-105 transition-transform">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-2 pr-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-black text-lg">
                  {user.fio[0]}
               </div>
               <div className="text-left leading-tight">
                  <p className="font-bold text-sm">{user.fio}</p>
                  <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
               </div>
            </div>
          </div>
        </header>

        <div className="p-8">

          {/* --- ВКЛАДКА: МОЙ СТАТУС --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Индекс готовности */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 text-slate-50 dark:text-slate-700 group-hover:scale-110 transition-transform"><Activity size={120}/></div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-2 relative z-10">Работоспособность</p>
                  <div className={`text-8xl font-black relative z-10 drop-shadow-2xl ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{latestScore}%</div>
                  
                  <label className="mt-8 flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-xl relative z-10 active:scale-95">
                    <Upload size={16} /> {uploading ? "Анализ..." : "Синхронизировать часы"}
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>

                {/* Текущий рейс */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-700 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-20 -mb-20"><Plane size={450} /></div>
                  <div className="relative z-10">
                     <div className="flex justify-between items-center mb-6">
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Текущее полетное задание</p>
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                           <ShieldCheck size={12}/> ПРИКАЗ №139 СОБЛЮДЕН
                        </span>
                     </div>
                     <h3 className="text-7xl font-black text-slate-800 dark:text-white mb-4 tracking-tighter italic">
                       {myFlights.length > 0 ? myFlights[0].number : 'РЕЗЕРВ'}
                     </h3>
                     <div className="flex items-center gap-8 text-3xl font-black text-blue-600 dark:text-blue-400 italic">
                        <div className="flex flex-col"><span className="text-[10px] text-slate-400 not-italic uppercase font-bold mb-1">Вылет</span>{myFlights.length > 0 ? myFlights[0].from : 'SVO'}</div>
                        <div className="h-[2px] flex-1 bg-slate-100 dark:bg-slate-700 relative"><Plane size={20} className="absolute -top-2.5 left-1/2 -translate-x-1/2 rotate-90 text-slate-300"/></div>
                        <div className="flex flex-col text-right"><span className="text-[10px] text-slate-400 not-italic uppercase font-bold mb-1">Прилет</span>{myFlights.length > 0 ? myFlights[0].to : '---'}</div>
                     </div>
                  </div>
                  <div className="mt-8 flex gap-8 border-t border-slate-50 dark:border-slate-700 pt-6 relative z-10">
                     <div><p className="text-[10px] text-slate-400 font-bold uppercase">Тип ВС</p><p className="font-bold text-slate-700 dark:text-slate-300 uppercase">МС-21-300</p></div>
                     <div><p className="text-[10px] text-slate-400 font-bold uppercase">Экипаж</p><p className="font-bold text-slate-700 dark:text-slate-300">8 человек</p></div>
                  </div>
                </div>
              </div>

              {/* График биометрии */}
              <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-700">
                 <div className="flex justify-between items-center mb-10">
                    <h3 className="text-xl font-black flex items-center gap-3 tracking-tight">
                       <Heart fill="#f43f5e" className="text-rose-500" /> Биометрический мониторинг (SVO LIVE)
                    </h3>
                    <div className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2">
                       <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> СИСТЕМА АКТИВНА
                    </div>
                 </div>
                 <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[...telemetry].reverse()}>
                        <defs><linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#f1f5f9"} />
                        <XAxis dataKey="record_timestamp" hide />
                        <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold'}} />
                        <Tooltip contentStyle={{backgroundColor: isDarkMode ? '#0f172a' : '#fff', border: 'none', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'}} />
                        <Area type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={5} fill="url(#colorHr)" />
                      </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            </div>
          )}

          {/* --- ВКЛАДКА: РАСПИСАНИЕ (ЭКИПАЖ) --- */}
          {activeTab === 'schedule' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-right-10 duration-500">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-8 py-6 text-blue-600">Номер рейса</th>
                      <th className="px-8 py-6">Маршрут</th>
                      <th className="px-8 py-6">Вылет (MSK)</th>
                      <th className="px-8 py-6">Прилет (План)</th>
                      <th className="px-8 py-6 text-right">Роль на борту</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {myFlights.map((f, i) => (
                      <tr key={i} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group">
                        <td className="px-8 py-6 font-black text-xl group-hover:text-blue-500 transition-colors tracking-tighter italic">{f.number}</td>
                        <td className="px-8 py-6 font-bold text-slate-700 dark:text-slate-300">{f.from} ➔ {f.to}</td>
                        <td className="px-8 py-6 text-sm font-mono font-bold text-slate-500">{f.dep}</td>
                        <td className="px-8 py-6 text-sm font-mono text-slate-400">{f.arr}</td>
                        <td className="px-8 py-6 text-right"><span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-tighter border border-slate-200 dark:border-slate-600">{f.role}</span></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}

          {/* --- ВКЛАДКА: ИСТОРИЯ ЗДОРОВЬЯ (ЭКИПАЖ) --- */}
          {activeTab === 'history' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-left-10 duration-500">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-8 py-6">Дата и время анализа</th>
                      <th className="px-8 py-6">Показатель ИИ</th>
                      <th className="px-8 py-6">Статус допуска</th>
                      <th className="px-8 py-6 text-right">Источник данных</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {medicalLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-8 py-6 font-bold text-slate-600 dark:text-slate-400">{new Date(log.calculation_timestamp).toLocaleString()}</td>
                        <td className={`px-8 py-6 font-black text-2xl ${log.performance_score > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(log.performance_score)}%</td>
                        <td className="px-8 py-6"><span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${log.performance_level === 'Optimal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{log.performance_level === 'Optimal' ? 'ДОПУЩЕН' : 'ВНИМАНИЕ'}</span></td>
                        <td className="px-8 py-6 text-right text-slate-400 italic text-xs">SAMSUNG GALAXY WATCH 4</td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          )}

          {/* --- ВКЛАДКА: МОНИТОРИНГ ФЛОТА (ДИСПЕТЧЕР) --- */}
          {activeTab === 'flights' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-l-4 border-emerald-500 shadow-lg">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Бортов в небе</p>
                    <h4 className="text-4xl font-black text-slate-800 dark:text-white">{monitorData.length}</h4>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-l-4 border-rose-500 shadow-lg animate-pulse">
                    <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><AlertTriangle size={14}/> Зона риска</p>
                    <h4 className="text-4xl font-black text-rose-600">{monitorData.filter(f => f.alerts > 0).length} БОРТА</h4>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {monitorData.map((f, i) => (
                    <div key={i} className={`bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 transition-all duration-500 shadow-xl ${f.score < 60 ? 'border-rose-500' : 'border-transparent'}`}>
                       <div className="flex justify-between items-start mb-6">
                          <div>
                            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-black mb-3 inline-block border border-blue-100 dark:border-blue-800 uppercase tracking-widest">МС-21 | {f.tail}</span>
                            <h4 className="text-5xl font-black tracking-tighter italic">{f.flight}</h4>
                            <p className="text-slate-500 font-bold mt-1 uppercase text-sm tracking-tighter">{f.route}</p>
                          </div>
                          <div className="text-right">
                             <div className={`text-6xl font-black ${f.score > 70 ? 'text-emerald-500' : 'text-rose-500'}`}>{f.score}%</div>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Готовность экипажа</p>
                          </div>
                       </div>
                       <div className="mt-6 flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3"><Heart className="text-rose-500" size={20}/><div className="leading-none"><p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Макс. ЧСС</p><p className="font-black text-sm">{f.peak_hr} <small>BPM</small></p></div></div>
                          <div className="flex items-center gap-3 text-rose-500 font-bold text-xs">{f.alerts > 0 ? <><ShieldAlert size={18}/> {f.alerts} СОТРУДНИКА В КРИТИЧЕСКОМ СОСТОЯНИИ</> : <p className="text-emerald-500">ЭКИПАЖ СТАБИЛЕН</p>}</div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* --- ВКЛАДКА: РЕЕСТР (АДМИН) --- */}
          {activeTab === 'staff' && (
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
               <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3 uppercase"><Users className="text-blue-600" /> Управление персоналом авиакомпании</h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Поиск по фамилии..." className="pl-12 pr-6 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 w-96 transition-all font-medium text-sm dark:text-white" onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
               </div>
               <div className="overflow-x-auto p-4">
                 <table className="w-full text-left border-separate border-spacing-y-2">
                   <thead>
                     <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-8">
                       <th className="px-8 py-4">Сотрудник ПАО «Аэрофлот»</th>
                       <th className="px-8 py-4">Должность</th>
                       <th className="px-8 py-4 text-center">Норма ЧСС (Базис)</th>
                       <th className="px-8 py-4 text-right">Статус в системе</th>
                     </tr>
                   </thead>
                   <tbody>
                     {staff.filter(s => (s.last_name + s.first_name).toLowerCase().includes(searchTerm.toLowerCase())).map((m, i) => (
                       <tr key={i} className="bg-slate-50/50 dark:bg-slate-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all rounded-2xl group">
                         <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-200 rounded-l-2xl group-hover:text-blue-600 transition-colors">{m.last_name} {m.first_name}</td>
                         <td className="px-8 py-5"><span className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-tighter">{m.position}</span></td>
                         <td className="px-8 py-5 text-center font-mono font-bold text-blue-600 dark:text-blue-400 italic text-lg">{m.baseline_hr}</td>
                         <td className="px-8 py-5 text-right rounded-r-2xl"><span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase border border-emerald-100 dark:border-emerald-900/50 italic"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> В ШТАТЕ</span></td>
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

export default Dashboard;