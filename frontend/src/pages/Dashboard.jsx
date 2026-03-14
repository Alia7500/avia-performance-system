import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, Heart, Plane, Users, ShieldCheck, LogOut, LayoutDashboard, FileText } from 'lucide-react';


const Dashboard = ({ user, onLogout }) => {
  const [telemetry, setTelemetry] = useState([]);
  const [myFlight, setMyFlight] = useState(null);

  const fetchData = async () => {
    try {
      const res = await api.get('/crew/dashboard');
      setTelemetry(res.data.telemetry_history);
      setMyFlight(res.data.текущий_рейс);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const latestScore = telemetry.length > 0 ? Math.round(telemetry[0].performance_score) : 0;

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* СТИЛЬНЫЙ SIDEBAR */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl">
        <div className="p-8 flex items-center gap-4 border-b border-slate-800">
          <div className="p-2 bg-blue-600 rounded-lg">
             <Plane size={24} className="text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">Агент МС-21</span>
        </div>
        
        <nav className="flex-1 p-6 space-y-4">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Основное</div>
          <button className="w-full flex items-center gap-3 p-3 bg-blue-600 text-white rounded-xl shadow-lg transition-all">
            <LayoutDashboard size={20} /> Дашборд
          </button>
          <button className="w-full flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <FileText size={20} /> Мои рейсы
          </button>
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-6 mb-2">Администрирование</div>
          <button className="w-full flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-all">
            <Users size={20} /> Экипажи
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center gap-3 text-rose-400 hover:text-rose-300 transition-colors">
            <LogOut size={20} /> Выход из системы
          </button>
        </div>
      </aside>

      {/* КОНТЕНТ */}
      <main className="flex-1 overflow-y-auto p-10">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-800">Цифровой профиль</h2>
            <p className="text-slate-500 mt-1">Система динамического анализа работоспособности</p>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
            <div className="text-right">
              <p className="font-bold text-slate-800">{user.fio}</p>
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-tighter">Бортпроводник</p>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-inner">
              {user.fio[0]}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* КАРТОЧКА ИИ */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={80} /></div>
             <p className="text-slate-400 font-semibold uppercase text-xs tracking-widest mb-2">Индекс готовности</p>
             <div className={`text-7xl font-black ${latestScore > 70 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {latestScore}%
             </div>
             <div className="mt-4 px-4 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase">
                {latestScore > 70 ? "Допущен к вылету" : "Внимание"}
             </div>
          </div>

          {/* КАРТОЧКА РЕЙСА */}
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex justify-between items-center">
             <div>
                <p className="text-slate-400 font-semibold uppercase text-xs tracking-widest mb-4">Текущее полетное задание</p>
                <h3 className="text-4xl font-bold text-slate-800 mb-1">{myFlight ? myFlight.flight_number : 'Резерв'}</h3>
                <div className="flex items-center gap-2 text-blue-600 font-bold">
                   <span>{myFlight ? myFlight.departure_airport : '---'}</span>
                   <Plane size={16} />
                   <span>{myFlight ? myFlight.arrival_airport : '---'}</span>
                </div>
             </div>
             <div className="text-right">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl inline-block mb-2">
                   <ShieldCheck size={32} />
                </div>
                <p className="text-xs text-slate-400">ВС: МС-21-300</p>
             </div>
          </div>
        </div>

        {/* ГРАФИК */}
        <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
             <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <Heart className="text-rose-500" fill="#f43f5e" /> Динамика ЧСС (Samsung Watch 4)
             </h3>
             <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg">LIVE TELEMETRY</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...telemetry].reverse()}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="record_timestamp" hide />
                <YAxis domain={['dataMin - 10', 'dataMax + 10']} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="monotone" dataKey="heart_rate" stroke="#f43f5e" strokeWidth={5} 
                  dot={{ r: 6, fill: '#f43f5e', strokeWidth: 3, stroke: '#fff' }} 
                  activeDot={{ r: 10, shadow: '0 0 20px rgba(244,63,94,0.5)' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;