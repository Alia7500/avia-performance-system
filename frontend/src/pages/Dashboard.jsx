import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { 
  Activity, Heart, Plane, Users, ShieldCheck, LogOut, 
  LayoutDashboard, FileText, Upload, Search, Bell, AlertCircle, CheckCircle
} from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [telemetry, setTelemetry] = useState([]);
  const [latestScore, setLatestScore] = useState(0);
  const [myFlight, setMyFlight] = useState(null);
  const [staff, setStaff] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Загрузка данных Дашборда (Телеметрия + Текущий рейс + Анализ ИИ)
  const fetchData = async () => {
    try {
      const res = await api.get('/crew/dashboard');
      setTelemetry(res.data.telemetry_history || []);
      setLatestScore(res.data.score || 0); // Берем индекс готовности напрямую
      setMyFlight(res.data.текущий_рейс);
    } catch (e) {
      console.error("Ошибка связи с сервером", e);
    }
  };

  // 2. Загрузка списка персонала (для вкладки Экипажи)
  const fetchStaff = async () => {
    try {
      const res = await api.get('/admin/staff');
      setStaff(res.data || []);
    } catch (e) {
      console.error("Ошибка загрузки персонала", e);
    }
  };

  useEffect(() => {
    fetchData();
    if (activeTab === 'staff') fetchStaff();
    const interval = setInterval(fetchData, 15000); 
    return () => clearInterval(interval);
  }, [activeTab]);

  // 3. Функция загрузки файла с Samsung Watch
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/crew/upload-health', formData);
      alert("✅ Агент ИИ: Данные проанализированы, статус обновлен!");
      fetchData(); // Сразу перегружаем цифры на экране
    } catch (err) {
      alert("❌ Ошибка: Не удалось распознать данные в файле.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden text-slate-900">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl z-10">
        <div className="p-8 flex items-center gap-4 border-b border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
             <Plane size={24} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight leading-none">Агент <br/> <span className="text-blue-400 text-sm">МС-21-300</span></span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-center">Меню управления</div>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} /> Мой статус
          </button>
          
          <button 
            onClick={() => setActiveTab('flights')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'flights' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <FileText size={20} /> Мои рейсы
          </button>

          <button 
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'staff' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Users size={20} /> Реестр штата
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800 text-center">
          <button onClick={onLogout} className="inline-flex items-center gap-2 text-rose-400 hover:text-rose-300 transition-colors font-bold text-sm">
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative bg-[#F8FAFC]">
        
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? 'Оперативный мониторинг' : 'Персонал авиакомпании'}
            </h2>
          </div>

          <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl border border-slate-200">
            <div className="text-right px-2">
              <p className="font-bold text-slate-800 text-sm">{user.fio}</p>
              <p className="text-[9px] text-blue-600 font-black uppercase">Бортпроводник-инструктор</p>
            </div>
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg">
              {user.fio[0]}
            </div>
          </div>
        </header>

        <div className="p-8">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* READINESS INDEX */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 text-slate-50"><Activity size={100} /></div>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2 relative z-10">Работоспособность</p>
                   <div className={`text-8xl font-black relative z-10 ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {latestScore}%
                   </div>
                   <div className={`mt-4 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border relative z-10 ${latestScore > 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {latestScore > 70 ? "Допуск подтвержден" : "Требуется отдых"}
                   </div>

                   {/* КНОПКА ЗАГРУЗКИ */}
                   <label className="mt-8 flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-bold hover:bg-blue-600 transition-all cursor-pointer active:scale-95 shadow-xl relative z-10">
                      <Upload size={16} /> 
                      {uploading ? "Анализирую..." : "Синхронизировать часы"}
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                   </label>
                </div>

                {/* CURRENT FLIGHT */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-white to-blue-50/30">
                   <div className="absolute right-0 bottom-0 opacity-[0.03] -mr-10 -mb-10"><Plane size={350} /></div>
                   <div className="relative z-10">
                      <div className="flex justify-between items-start">
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6">Текущее полетное задание</p>
                        <span className="flex items-center gap-1 text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 italic">
                          <CheckCircle size={10}/> ПРИКАЗ №139 СОБЛЮДЕН
                        </span>
                      </div>
                      <h3 className="text-6xl font-black text-slate-800 mb-2 tracking-tighter">
                        {myFlight ? myFlight.flight_number : 'РЕЗЕРВ'}
                      </h3>
                      <div className="flex items-center gap-6 text-blue-600 font-black text-2xl">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">ОТКУДА</span>
                            <span>{myFlight ? myFlight.departure_airport : 'SVO'}</span>
                         </div>
                         <div className="h-[2px] w-12 bg-slate-200 relative">
                            <Plane size={14} className="absolute -top-[6px] left-1/2 -translate-x-1/2 text-slate-300" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold">КУДА</span>
                            <span>{myFlight ? myFlight.arrival_airport : '---'}</span>
                         </div>
                      </div>
                   </div>
                   <div className="mt-8 flex gap-6 relative z-10 border-t border-slate-100 pt-6">
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold">Воздушное судно</p>
                         <p className="text-sm font-bold text-slate-700">МС-21-300 (RA-73051)</p>
                      </div>
                      <div>
                         <p className="text-[9px] text-slate-400 uppercase font-bold">Экипаж</p>
                         <p className="text-sm font-bold text-slate-700">8 человек</p>
                      </div>
                   </div>
                </div>
              </div>

              {/* BIO-CHART */}
              <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl">
                        <Heart size={24} fill="currentColor" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Биометрическая динамика</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Симуляция датчиков в реальном времени</p>
                      </div>
                   </div>
                   <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-2 tracking-widest">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> СИСТЕМА АКТИВНА
                   </span>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...telemetry].reverse()}>
                      <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="record_timestamp" hide />
                      <YAxis domain={['dataMin - 5', 'dataMax + 5']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px' }}
                      />
                      <Line 
                        type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={5} 
                        dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 8, fill: '#f43f5e', stroke: '#fff', strokeWidth: 4 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <Users className="text-blue-600" /> Реестр персонала (МС-21)
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Поиск по фамилии..." 
                      className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 w-80 transition-all font-medium text-sm"
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
               </div>
               <div className="overflow-x-auto p-4">
                 <table className="w-full text-left border-separate border-spacing-y-2">
                   <thead>
                     <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-8">
                       <th className="px-8 py-4">ФИО Сотрудника</th>
                       <th className="px-8 py-4">Должность</th>
                       <th className="px-8 py-4 text-center">Персональный Базис</th>
                       <th className="px-8 py-4 text-right">Статус</th>
                     </tr>
                   </thead>
                   <tbody>
                     {staff.filter(s => (s.last_name + s.first_name).toLowerCase().includes(searchTerm.toLowerCase())).map((member, i) => (
                       <tr key={i} className="bg-slate-50/50 hover:bg-blue-50 transition-all group rounded-2xl">
                         <td className="px-8 py-4 font-bold text-slate-700 rounded-l-2xl">
                            {member.last_name} {member.first_name}
                         </td>
                         <td className="px-8 py-4">
                            <span className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase">
                              {member.position}
                            </span>
                         </td>
                         <td className="px-8 py-4 text-center font-mono font-bold text-blue-600">
                            {member.baseline_hr} <small className="text-slate-400 uppercase text-[8px]">bpm</small>
                         </td>
                         <td className="px-8 py-4 text-right rounded-r-2xl">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase border border-emerald-100">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> В штате
                            </span>
                         </td>
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