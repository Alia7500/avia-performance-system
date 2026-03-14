import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { 
  Activity, Heart, Plane, Users, ShieldCheck, LogOut, 
  LayoutDashboard, FileText, Upload, Search, Bell, AlertCircle
} from 'lucide-react';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [telemetry, setTelemetry] = useState([]);
  const [myFlight, setMyFlight] = useState(null);
  const [staff, setStaff] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Загрузка данных Дашборда (Телеметрия + Текущий рейс)
  const fetchData = async () => {
    try {
      const res = await api.get('/crew/dashboard');
      setTelemetry(res.data.telemetry_history || []);
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
    const interval = setInterval(fetchData, 15000); // Обновлять раз в 15 сек
    return () => clearInterval(interval);
  }, [activeTab]);

  // 3. Обработка загрузки файла с Samsung Watch
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/crew/upload-health', formData);
      alert("✅ Данные Samsung Health успешно проанализированы Агентом ИИ!");
      fetchData();
    } catch (err) {
      alert("❌ Ошибка анализа файла. Проверьте формат CSV.");
    } finally {
      setUploading(false);
    }
  };

  const latestScore = telemetry.length > 0 ? Math.round(telemetry[0].performance_score) : 0;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* --- SIDEBAR --- */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl z-10">
        <div className="p-8 flex items-center gap-4 border-b border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
             <Plane size={24} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Агент МС-21</span>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Навигация</div>
          
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <LayoutDashboard size={20} /> Дашборд
          </button>
          
          <button 
            onClick={() => setActiveTab('flights')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'flights' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <FileText size={20} /> Мои рейсы
          </button>

          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-8 mb-4">Управление</div>
          
          <button 
            onClick={() => setActiveTab('staff')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'staff' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Users size={20} /> Экипажи
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-400 hover:text-rose-300 transition-colors font-medium">
            <LogOut size={20} /> Выход из системы
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 overflow-y-auto relative">
        
        {/* HEADER */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? 'Мониторинг состояния' : 'Реестр сотрудников'}
            </h2>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100 uppercase">Live System</span>
          </div>

          <div className="flex items-center gap-6">
            <Bell className="text-slate-400 hover:text-blue-600 cursor-pointer transition-colors" size={20} />
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="text-right">
                <p className="font-bold text-slate-800 text-sm leading-tight">{user.fio}</p>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">Старший бортпроводник</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/30">
                {user.fio[0]}
              </div>
            </div>
          </div>
        </header>

        <div className="p-8">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* READINESS */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center relative group">
                   <div className="absolute top-6 right-6 text-slate-100 group-hover:text-blue-50 transition-colors"><Activity size={60} /></div>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-2">Индекс готовности</p>
                   <div className={`text-7xl font-black transition-colors ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {latestScore}%
                   </div>
                   <div className={`mt-4 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${latestScore > 70 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                      {latestScore > 70 ? "К полёту допущен" : "Требуется отдых"}
                   </div>

                   {/* КНОПКА ЗАГРУЗКИ */}
                   <label className="mt-8 flex items-center gap-2 px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all cursor-pointer active:scale-95 shadow-xl shadow-slate-900/20">
                      <Upload size={14} /> 
                      {uploading ? "Анализ данных..." : "Синхронизировать часы"}
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                   </label>
                </div>

                {/* FLIGHT INFO */}
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 lg:col-span-2 flex flex-col justify-between relative overflow-hidden">
                   <div className="absolute -right-10 -bottom-10 text-slate-50 rotate-12"><Plane size={240} /></div>
                   <div className="relative z-10">
                      <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-6">Текущая задача</p>
                      <h3 className="text-5xl font-black text-slate-800 mb-2 tracking-tighter">
                        {myFlight ? myFlight.flight_number : 'РЕЗЕРВ'}
                      </h3>
                      <div className="flex items-center gap-4 text-blue-600 font-black text-xl italic">
                         <span>{myFlight ? myFlight.departure_airport : 'SVO'}</span>
                         <Plane size={24} className="rotate-90 text-slate-300" />
                         <span>{myFlight ? myFlight.arrival_airport : '---'}</span>
                      </div>
                   </div>
                   <div className="flex gap-4 mt-6 relative z-10">
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                         <p className="text-[9px] text-slate-400 uppercase font-bold">Тип ВС</p>
                         <p className="text-xs font-bold text-slate-700">МС-21-300</p>
                      </div>
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                         <p className="text-[9px] text-slate-400 uppercase font-bold">Статус</p>
                         <p className="text-xs font-bold text-emerald-600">ПОДТВЕРЖДЕН</p>
                      </div>
                   </div>
                </div>
              </div>

              {/* CHART */}
              <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-10">
                   <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
                      <Heart className="text-rose-500" fill="#f43f5e" /> Динамика биометрии
                   </h3>
                   <div className="flex gap-2">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                         <AlertCircle size={12} /> ДАННЫЕ SAMSUNG GALAXY WATCH 4
                      </span>
                   </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...telemetry].reverse()}>
                      <CartesianGrid strokeDasharray="10 10" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="record_timestamp" hide />
                      <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', padding: '20px' }}
                        itemStyle={{ fontWeight: 'bold', fontSize: '14px' }}
                      />
                      <Line 
                        type="stepAfter" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={6} 
                        dot={{ r: 0 }} 
                        activeDot={{ r: 8, fill: '#f43f5e', stroke: '#fff', strokeWidth: 4 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
               <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <Users className="text-blue-600" /> Реестр авиакомпании
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
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="text-slate-400 text-[11px] font-black uppercase tracking-widest bg-slate-50/50">
                       <th className="px-8 py-5">Сотрудник</th>
                       <th className="px-8 py-5">Должность</th>
                       <th className="px-8 py-5 text-center">Норма HR</th>
                       <th className="px-8 py-5 text-right">Статус</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {staff.filter(s => s.last_name.toLowerCase().includes(searchTerm.toLowerCase())).map((member, i) => (
                       <tr key={i} className="hover:bg-blue-50/30 transition-colors group cursor-default">
                         <td className="px-8 py-5 font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                            {member.last_name} {member.first_name}
                         </td>
                         <td className="px-8 py-5">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">
                              {member.position}
                            </span>
                         </td>
                         <td className="px-8 py-5 text-center font-mono font-bold text-slate-500">
                            {member.baseline_hr} <small>bpm</small>
                         </td>
                         <td className="px-8 py-5 text-right">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase border border-emerald-100">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Активен
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