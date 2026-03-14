import React from 'react';
import { Plane, Activity, Calendar, History, LayoutDashboard, LogOut, Users } from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  return (
    <aside className="w-72 bg-slate-950 text-white flex flex-col shadow-2xl">
      <div className="p-8 flex items-center gap-4 border-b border-slate-800">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg"><Plane size={24} /></div>
        <span className="font-black text-lg uppercase tracking-widest leading-none">МС-21<br/><span className="text-blue-500 text-xs">AGENT</span></span>
      </div>
      
      <nav className="flex-1 p-6 space-y-2">
        {user.role === 'crew_member' ? (
          <>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl ${activeTab === 'dashboard' ? 'bg-blue-600' : 'text-slate-500'}`}>
              <Activity size={20} /> Мой статус
            </button>
            <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 p-3 rounded-xl ${activeTab === 'schedule' ? 'bg-blue-600' : 'text-slate-500'}`}>
              <Calendar size={20} /> Моё расписание
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('monitor')} className={`w-full flex items-center gap-3 p-3 rounded-xl ${activeTab === 'monitor' ? 'bg-blue-600' : 'text-slate-500'}`}>
              <LayoutDashboard size={20} /> Мониторинг флота
            </button>
          </>
        )}
      </nav>
      <button onClick={onLogout} className="p-6 text-rose-500 font-bold flex items-center gap-2"><LogOut size={18}/> Выйти</button>
    </aside>
  );
};
export default Sidebar;