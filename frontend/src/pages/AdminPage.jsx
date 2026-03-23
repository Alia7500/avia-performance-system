import React, { useState, useEffect } from 'react';
import api from '../api/config';
import { UserPlus, Users, Search, TrendingUp, Trash2, Edit2, Eye, BarChart3, Filter } from 'lucide-react';

const AdminPage = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('users'); // users, reports, trends, audit
  const [staff, setStaff] = useState([]);
  const [reports, setReports] = useState([]);
  const [trends, setTrends] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    patronymic: '',
    password: '',
    role_id: '2', // crew_member по умолчанию
    baseline_hr: 75
  });

  // Загрузка всех пользователей
  useEffect(() => {
    if (activeTab === 'users') {
      loadStaff();
    }
  }, [activeTab]);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/staff');
      setStaff(res.data);
    } catch (error) {
      console.error('Ошибка при загрузке персонала:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка расширенных отчетов
  useEffect(() => {
    if (activeTab === 'reports') {
      loadReports();
    }
  }, [activeTab, dateRange]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange.start) params.start_date = dateRange.start;
      if (dateRange.end) params.end_date = dateRange.end;
      const res = await api.get('/admin/extended-reports', { params });
      setReports(res.data);
    } catch (error) {
      console.error('Ошибка при загрузке отчетов:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка трендов работоспособности
  useEffect(() => {
    if (activeTab === 'trends') {
      loadTrends();
    }
  }, [activeTab]);

  const loadTrends = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/performance-trends');
      setTrends(res.data);
    } catch (error) {
      console.error('Ошибка при загрузке трендов:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка аудита медработников
  useEffect(() => {
    if (activeTab === 'audit') {
      loadAudit();
    }
  }, [activeTab]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/medical-audit');
      setAuditLogs(res.data);
    } catch (error) {
      console.error('Ошибка при загрузке аудита:', error);
    } finally {
      setLoading(false);
    }
  };

  // Создание нового пользователя
  const handleCreateUser = async () => {
    if (!formData.email || !formData.first_name || !formData.last_name) {
      alert('Заполните обязательные поля');
      return;
    }
    try {
      setLoading(true);
      await api.post('/admin/create_user', formData);
      alert('Сотрудник успешно добавлен');
      setFormData({ email: '', first_name: '', last_name: '', patronymic: '', password: '', role_id: '2', baseline_hr: 75 });
      setShowModal(false);
      loadStaff();
    } catch (error) {
      alert('Ошибка при создании сотрудника: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Редактирование пользователя
  const handleEditUser = async (userId) => {
    if (!editingUser) {
      // Выбрали пользователя для редактирования
      const user = staff.find(s => s.user_id === userId);
      setEditingUser(user);
      setFormData(user);
      setShowModal(true);
    } else {
      // Сохраняем изменения
      try {
        setLoading(true);
        await api.put(`/admin/update_user/${userId}`, formData);
        alert('Данные сотрудника обновлены');
        setShowModal(false);
        setEditingUser(null);
        loadStaff();
      } catch (error) {
        alert('Ошибка при обновлении: ' + (error.response?.data?.detail || error.message));
      } finally {
        setLoading(false);
      }
    }
  };

  // Удаление пользователя
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Вы уверены? Это действие необратимо.')) {
      try {
        setLoading(true);
        await api.delete(`/admin/delete_user/${userId}`);
        alert('Сотрудник удален');
        loadStaff();
      } catch (error) {
        alert('Ошибка при удалении: ' + (error.response?.data?.detail || error.message));
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || s.role_name === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-10 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-black text-slate-800 mb-8">⚙️ АДМИНИСТРИРОВАНИЕ СИСТЕМЫ</h1>

      {/* ВКЛАДКИ */}
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 rounded-lg font-bold transition ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300'}`}
        >
          <Users className="inline mr-2" size={20} /> Реестр пользователей
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 rounded-lg font-bold transition ${activeTab === 'reports' ? 'bg-green-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300'}`}
        >
          <BarChart3 className="inline mr-2" size={20} /> Отчеты
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          className={`px-6 py-3 rounded-lg font-bold transition ${activeTab === 'trends' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300'}`}
        >
          <TrendingUp className="inline mr-2" size={20} /> Тренды
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-6 py-3 rounded-lg font-bold transition ${activeTab === 'audit' ? 'bg-red-600 text-white shadow-lg' : 'bg-white text-slate-700 border border-slate-300'}`}
        >
          <Eye className="inline mr-2" size={20} /> Аудит
        </button>
      </div>

      {/* ВКЛАДКА: РЕЕСТР ПОЛЬЗОВАТЕЛЕЙ */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по ФИО..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все роли</option>
              <option value="administrator">Администратор</option>
              <option value="crew_member">Экипаж</option>
              <option value="dispatcher">Диспетчер</option>
              <option value="medical_worker">Медработник</option>
            </select>
            <button
              onClick={() => {
                setEditingUser(null);
                setFormData({ email: '', first_name: '', last_name: '', patronymic: '', password: '', role_id: '2', baseline_hr: 75 });
                setShowModal(true);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
            >
              <UserPlus className="inline mr-2" size={20} /> Добавить
            </button>
          </div>

          {/* ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <th className="p-4">ФИО</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Роль</th>
                  <th className="p-4">Базис ЧСС</th>
                  <th className="p-4 text-center">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50 transition">
                    <td className="p-4 font-bold">{s.last_name} {s.first_name} {s.patronymic}</td>
                    <td className="p-4 text-slate-600">{s.email}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        {s.role_name}
                      </span>
                    </td>
                    <td className="p-4 font-mono">{s.baseline_hr} bpm</td>
                    <td className="p-4 text-center space-x-2">
                      <button
                        onClick={() => handleEditUser(s.user_id)}
                        className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition inline-flex items-center"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(s.user_id)}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition inline-flex items-center"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ВКЛАДКА: ОТЧЕТЫ */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex gap-4 bg-white p-6 rounded-lg shadow">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Начальная дата</label>
              <input
                type="datetime-local"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2">Конечная дата</label>
              <input
                type="datetime-local"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={loadReports}
              className="self-end px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
            >
              Загрузить отчет
            </button>
          </div>

          {reports.summary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
                <div className="text-3xl font-bold">{reports.summary.total_crew}</div>
                <div className="text-sm opacity-90">Всего экипажа</div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-lg">
                <div className="text-3xl font-bold">{reports.summary.avg_performance}%</div>
                <div className="text-sm opacity-90">Средняя готовность</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-lg shadow-lg">
                <div className="text-3xl font-bold">{reports.summary.at_risk_count}</div>
                <div className="text-sm opacity-90">В зоне риска</div>
              </div>
              <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-6 rounded-lg shadow-lg">
                <div className="text-3xl font-bold">{reports.summary.critical_count}</div>
                <div className="text-sm opacity-90">Критический статус</div>
              </div>
            </div>
          )}

          {reports.crew_list && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-slate-900 text-white p-4 font-bold">ДЕТАЛЬНЫЙ ОТЧЕТ ПО ЭКИПАЖУ</div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="p-4">ФИО</th>
                    <th className="p-4">Роль</th>
                    <th className="p-4">Средняя готовность</th>
                    <th className="p-4">Статус</th>
                    <th className="p-4">Замечания</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.crew_list.map((crew, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="p-4 font-bold">{crew.fio}</td>
                      <td className="p-4">{crew.position}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded text-xs font-bold ${crew.performance >= 80 ? 'bg-green-100 text-green-800' : crew.performance >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                          {crew.performance}%
                        </span>
                      </td>
                      <td className="p-4">{crew.status}</td>
                      <td className="p-4 text-slate-600 text-xs">{crew.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reports.ai_comment && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded">
              <div className="font-bold text-slate-800 mb-2">💡 Аналитика ИИ:</div>
              <div className="text-slate-700">{reports.ai_comment}</div>
            </div>
          )}
        </div>
      )}

      {/* ВКЛАДКА: ТРЕНДЫ */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="font-bold text-slate-800 mb-4">📊 Тренд готовности за 30 дней</div>
              {trends.daily_average && (
                <div className="space-y-2">
                  {trends.daily_average.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{item.date}</span>
                      <div className="flex items-center gap-2 flex-1 ml-4">
                        <div className="h-2 bg-slate-200 rounded-full flex-1 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${item.avg_score}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{item.avg_score}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
              <div className="font-bold text-slate-800 mb-4">⚠️ Попадений в зоны риска</div>
              {trends.risk_events && (
                <div className="space-y-3">
                  {trends.risk_events.map((risk, i) => (
                    <div key={i} className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded">
                      <div className="font-bold text-orange-800">{risk.crew_fio}</div>
                      <div className="text-xs text-orange-700 mt-1">{risk.reason}</div>
                      <div className="text-xs text-slate-600 mt-1">{risk.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {trends.forecast && (
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-lg">
              <div className="font-bold mb-2">🔮 Прогноз ИИ на неделю:</div>
              <div className="text-sm opacity-90">{trends.forecast}</div>
            </div>
          )}
        </div>
      )}

      {/* ВКЛАДКА: АУДИТ */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-slate-900 text-white p-4 font-bold">АУДИТ ДЕЙСТВИЙ МЕДИЦИНСКИХ РАБОТНИКОВ</div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="p-4">Дата/Время</th>
                <th className="p-4">Медработник</th>
                <th className="p-4">Действие</th>
                <th className="p-4">Описание</th>
                <th className="p-4">Результат</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log, i) => (
                <tr key={i} className="border-b hover:bg-slate-50 transition">
                  <td className="p-4 font-mono text-xs">{log.timestamp}</td>
                  <td className="p-4 font-bold">{log.medical_worker_fio}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded text-xs font-bold ${log.action === 'upload' ? 'bg-blue-100 text-blue-800' : log.action === 'update' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                      {log.action_label}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 text-xs">{log.description}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded text-xs font-bold ${log.result === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {log.result === 'success' ? 'Успешно' : 'Ошибка'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ/РЕДАКТИРОВАНИЯ */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">{editingUser ? 'Редактирование' : 'Добавление сотрудника'}</h2>
            <div className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Имя"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Фамилия"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Отчество"
                value={formData.patronymic}
                onChange={(e) => setFormData({ ...formData, patronymic: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!editingUser && (
                <input
                  type="password"
                  placeholder="Пароль"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              <select
                value={formData.role_id}
                onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Администратор</option>
                <option value="2">Экипаж</option>
                <option value="3">Диспетчер</option>
                <option value="4">Медработник</option>
              </select>
              <input
                type="number"
                placeholder="Базис ЧСС (bpm)"
                value={formData.baseline_hr}
                onChange={(e) => setFormData({ ...formData, baseline_hr: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-4 mt-8">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-300 text-slate-800 rounded-lg font-bold hover:bg-slate-400 transition"
              >
                Отмена
              </button>
              <button
                onClick={() => editingUser ? handleEditUser(editingUser.user_id) : handleCreateUser()}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? 'Загрузка...' : editingUser ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPage;