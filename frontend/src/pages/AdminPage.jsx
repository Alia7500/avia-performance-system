import React, { useState, useEffect } from 'react';
import api from '../api/config';
import { 
  UserPlus, Users, Search, TrendingUp, Trash2, Edit2, Eye, BarChart3, 
  LogOut, ServerCrash, Loader2, CalendarRange, HeartPulse, BrainCircuit, ShieldAlert
} from 'lucide-react';

// Заглушка для пустых данных
const EmptyState = ({ message }) => (
  <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700">
    <ServerCrash size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
    <p className="font-bold text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);

const AdminPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [staff, setStaff] = useState([]);
  const [reports, setReports] = useState({});
  const [trends, setTrends] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    email: '', first_name: '', last_name: '', patronymic: '',
    password: '', role_id: '2', baseline_hr: 75
  });

  // Загрузка данных при переключении вкладок
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'users') {
          const res = await api.get('/admin/staff');
          setStaff(res.data);
        } else if (activeTab === 'trends') {
          const res = await api.get('/admin/performance-trends');
          setTrends(res.data);
        } else if (activeTab === 'audit') {
          const res = await api.get('/admin/medical-audit');
          setAuditLogs(res.data);
        }
      } catch (error) {
        console.error('Ошибка загрузки:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  // Отдельная загрузка отчетов по кнопке
  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/extended-reports?start_date=${dateRange.start}&end_date=${dateRange.end}`);
      setReports(res.data); // Сохраняем весь объект
    } catch (error) {
      alert("Ошибка отчета: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Инициализация отчетов при первом заходе на вкладку
  useEffect(() => {
    if (activeTab === 'reports' && !reports.summary) {
      loadReports();
    }
  }, [activeTab]);

  const handleSaveUser = async () => {
    try {
      setLoading(true);
      if (editingUser) {
        await api.put(`/admin/update_user/${editingUser.user_id}`, formData);
      } else {
        await api.post('/admin/create_user', formData);
      }
      setShowModal(false);
      setEditingUser(null);
      const res = await api.get('/admin/staff');
      setStaff(res.data);
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Удалить сотрудника из системы?')) {
      try {
        await api.delete(`/admin/delete_user/${userId}`);
        setStaff(staff.filter(s => s.user_id !== userId));
      } catch (error) {
        alert('Ошибка: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || s.role_name === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 px-10 flex justify-between items-center shadow-sm">
        <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white"><Users size={24} /></div>
          Администрирование <span className="text-blue-600">МС-21</span>
        </h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-slate-100 dark:bg-slate-800 p-2 pr-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <div className="w-12 h-12 bg-slate-800 dark:bg-slate-700 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner">{user.fio[0]}</div>
             <div className="text-left leading-tight">
                <p className="font-bold text-sm text-slate-800 dark:text-white">{user.fio}</p>
                <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{user.position}</p>
             </div>
          </div>
          <button onClick={onLogout} className="p-4 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white dark:bg-rose-950/30 dark:text-rose-500 dark:hover:bg-rose-600 dark:hover:text-white rounded-2xl font-bold transition-all shadow-sm flex items-center gap-2">
            <LogOut size={20} /> <span className="uppercase text-xs tracking-widest hidden md:block">Выход</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-10 max-w-[1600px] mx-auto w-full space-y-8">
        
        {/* --- TABS --- */}
        <div className="flex gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-max shadow-sm">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Users size={18}/> Реестр</button>
          <button onClick={() => setActiveTab('reports')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><BarChart3 size={18}/> Сводные отчеты</button>
          <button onClick={() => setActiveTab('trends')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'trends' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><TrendingUp size={18}/> ИИ Тренды</button>
          <button onClick={() => setActiveTab('audit')} className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Eye size={18}/> Аудит действий</button>
        </div>

        {/* --- Вкладка: РЕЕСТР ПОЛЬЗОВАТЕЛЕЙ --- */}
        {activeTab === 'users' && (
          <div className="animate-in fade-in duration-300">
            <div className="flex gap-4 mb-6 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input type="text" placeholder="Поиск сотрудника..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
              <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-6 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 outline-none">
                <option value="all">Все должности</option>
                <option value="administrator">Администраторы</option>
                <option value="crew_member">Летный экипаж</option>
                <option value="dispatcher">Диспетчеры ЦУП</option>
              </select>
              <button onClick={() => { setEditingUser(null); setFormData({ email: '', first_name: '', last_name: '', patronymic: '', password: '', role_id: '2', baseline_hr: 75 }); setShowModal(true); }} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg transition-all">
                <UserPlus size={20}/> Добавить
              </button>
            </div>

            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline-block text-blue-500" size={48}/></div> : filteredStaff.length > 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr><th className="px-8 py-6">ФИО</th><th className="px-8 py-6">Email</th><th className="px-8 py-6">Должность</th><th className="px-8 py-6 text-center">Норма ЧСС</th><th className="px-8 py-6 text-right">Управление</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredStaff.map((s, i) => (
                      <tr key={i} className="hover:bg-blue-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-800 dark:text-slate-200">{s.last_name} {s.first_name}</td>
                        <td className="px-8 py-5 text-sm text-slate-500">{s.email}</td>
                        <td className="px-8 py-5"><span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-black uppercase tracking-widest">{s.position || s.role_name}</span></td>
                        <td className="px-8 py-5 text-center font-mono font-bold text-rose-500 flex items-center justify-center gap-2"><HeartPulse size={16}/> {s.baseline_hr}</td>
                        <td className="px-8 py-5 text-right space-x-3">
                          <button onClick={() => { setEditingUser(s); setFormData(s); setShowModal(true); }} className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteUser(s.user_id)} className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="Сотрудники не найдены. Измените параметры поиска." />}
          </div>
        )}

        {/* --- Вкладка: ОТЧЕТЫ --- */}
        {activeTab === 'reports' && (
          <div className="animate-in fade-in duration-300 space-y-8">
            <div className="flex items-end gap-4 bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Начало периода</label>
                <input type="datetime-local" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none"/>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Конец периода</label>
                <input type="datetime-local" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none"/>
              </div>
              <button onClick={loadReports} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition flex items-center gap-2 shadow-lg"><CalendarRange size={18}/> Запросить отчет</button>
            </div>

            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline-block text-emerald-500" size={48}/></div> : reports.summary ? (
              <>
                <div className="grid grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-b-4 border-blue-500 shadow-sm"><p className="text-slate-400 text-xs font-black uppercase mb-1">Всего экипажа</p><h4 className="text-5xl font-black">{reports.summary.total_crew}</h4></div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-b-4 border-emerald-500 shadow-sm"><p className="text-slate-400 text-xs font-black uppercase mb-1">Готовность флота</p><h4 className="text-5xl font-black text-emerald-500">{reports.summary.avg_performance}%</h4></div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-b-4 border-amber-500 shadow-sm"><p className="text-slate-400 text-xs font-black uppercase mb-1">В зоне риска</p><h4 className="text-5xl font-black text-amber-500">{reports.summary.at_risk_count}</h4></div>
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-b-4 border-rose-500 shadow-sm"><p className="text-slate-400 text-xs font-black uppercase mb-1">Критический статус</p><h4 className="text-5xl font-black text-rose-500">{reports.summary.critical_count}</h4></div>
                </div>

                {reports.ai_comment && (
                  <div className="bg-blue-50 dark:bg-slate-800 border-l-8 border-blue-500 p-8 rounded-[2rem] shadow-sm">
                    <h3 className="text-xl font-black uppercase mb-2 flex items-center gap-3"><BrainCircuit className="text-blue-500"/> Резюме ИИ-Агента</h3>
                    <p className="text-lg text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{reports.ai_comment}</p>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <tr><th className="px-8 py-6">Сотрудник</th><th className="px-8 py-6">Должность</th><th className="px-8 py-6 text-center">Индекс ИИ</th><th className="px-8 py-6">Замечания системы</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {reports.crew_list.map((c, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-8 py-5 font-bold">{c.fio}</td>
                          <td className="px-8 py-5 text-sm text-slate-500">{c.position}</td>
                          <td className="px-8 py-5 text-center"><span className={`px-4 py-1.5 rounded-xl text-xs font-black ${c.performance > 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{c.performance}%</span></td>
                          <td className="px-8 py-5 text-sm font-medium text-slate-600 dark:text-slate-400">{c.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <EmptyState message="Укажите период и нажмите «Запросить отчет»" />}
          </div>
        )}

        {/* --- Вкладка: ТРЕНДЫ ИИ --- */}
        {activeTab === 'trends' && (
          <div className="animate-in fade-in duration-300 space-y-8">
            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline-block text-amber-500" size={48}/></div> : trends.daily_average ? (
              <>
                {trends.forecast && (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-8 rounded-[2.5rem] shadow-xl">
                    <h3 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 mb-2"><BrainCircuit size={28}/> Прогноз ИИ на неделю</h3>
                    <p className="text-lg font-medium opacity-90">{trends.forecast}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-black uppercase mb-8 text-slate-800 dark:text-white">Динамика флота (30 дней)</h3>
                    <div className="space-y-4">
                      {trends.daily_average.map((item, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className="w-12 text-xs font-bold text-slate-400">{item.date}</span>
                          <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.avg_score > 75 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${item.avg_score}%` }}></div>
                          </div>
                          <span className="w-10 text-right font-black text-sm">{item.avg_score}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-black uppercase mb-8 text-slate-800 dark:text-white flex items-center gap-3"><ShieldAlert className="text-rose-500"/> Инциденты (Зона риска)</h3>
                    <div className="space-y-4">
                      {trends.risk_events && trends.risk_events.length > 0 ? trends.risk_events.map((risk, i) => (
                        <div key={i} className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-rose-700 dark:text-rose-400">{risk.crew_fio}</span>
                            <span className="text-xs font-mono text-rose-400">{risk.date}</span>
                          </div>
                          <p className="text-sm text-rose-600 dark:text-rose-300">{risk.reason}</p>
                        </div>
                      )) : <p className="text-emerald-500 font-bold">Инцидентов не зафиксировано.</p>}
                    </div>
                  </div>
                </div>
              </>
            ) : <EmptyState message="Тренд ИИ пока недоступен" />}
          </div>
        )}

        {/* --- Вкладка: АУДИТ --- */}
        {activeTab === 'audit' && (
          <div className="animate-in fade-in duration-300">
            {loading ? <div className="text-center py-20"><Loader2 className="animate-spin inline-block text-purple-500" size={48}/></div> : auditLogs.length > 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <tr><th className="px-8 py-6">Дата и Время</th><th className="px-8 py-6">Сотрудник / Система</th><th className="px-8 py-6">Действие</th><th className="px-8 py-6">Событие</th><th className="px-8 py-6">Статус</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {auditLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-8 py-5 font-mono text-xs text-slate-500">{log.timestamp}</td>
                        <td className="px-8 py-5 font-bold text-slate-700 dark:text-slate-300">{log.medical_worker_fio}</td>
                        <td className="px-8 py-5"><span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-purple-100 text-purple-700">{log.action_label}</span></td>
                        <td className="px-8 py-5 text-sm text-slate-600 dark:text-slate-400">{log.description}</td>
                        <td className="px-8 py-5"><span className="text-emerald-500 font-bold text-sm">✓ {log.result}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState message="В журнале аудита пока нет записей" />}
          </div>
        )}
      </main>

      {/* --- МОДАЛКА --- */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 max-w-md w-full border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-black mb-6 uppercase tracking-tight">{editingUser ? 'Редактировать' : 'Новый сотрудник'}</h2>
            <div className="space-y-4">
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label><input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Имя</label><input type="text" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Фамилия</label><input type="text" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>
              </div>
              <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Отчество</label><input type="text" value={formData.patronymic} onChange={e => setFormData({...formData, patronymic: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>
              {!editingUser && <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Пароль</label><input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Роль в системе</label>
                  <select value={formData.role_id} onChange={e => setFormData({...formData, role_id: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700">
                    <option value="1">Администратор</option>
                    <option value="2">Летный экипаж</option>
                    <option value="3">Диспетчер ЦУП</option>
                    <option value="4">Медработник</option>
                  </select>
                </div>
                <div><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Базис ЧСС</label><input type="number" value={formData.baseline_hr} onChange={e => setFormData({...formData, baseline_hr: parseInt(e.target.value)})} className="w-full p-3 mt-1 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 border border-slate-200 dark:border-slate-700"/></div>
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setShowModal(false)} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition">Отмена</button>
              <button onClick={handleSaveUser} disabled={loading} className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;