import React, { useState, useEffect } from 'react';
import api from '../api/config';
import { UserPlus, Users, Search } from 'lucide-react';

const AdminPage = ({ user, onLogout }) => {
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    api.get('/admin/staff').then(res => setStaff(res.data));
  }, []);

  return (
    <div className="p-10 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-black text-slate-800 mb-8">АДМИНИСТРИРОВАНИЕ ПЕРСОНАЛА</h1>
      {/* Кнопка "Добавить сотрудника" и Таблица */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="p-6">Сотрудник</th>
              <th className="p-6">Роль</th>
              <th className="p-6">Базис ЧСС</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s, i) => (
              <tr key={i} className="border-b">
                <td className="p-6 font-bold">{s.last_name} {s.first_name}</td>
                <td className="p-6">{s.position}</td>
                <td className="p-6 font-mono">{s.baseline_hr}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default AdminPage;