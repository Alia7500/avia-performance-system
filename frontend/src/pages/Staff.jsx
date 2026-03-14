import React, { useEffect, useState } from 'react';
import api from '../api/config';
import { Users, Search, UserCheck } from 'lucide-react';

const Staff = () => {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Нам нужно будет добавить этот эндпоинт в бэкенд, пока просто заготовка
    api.get('/admin/staff').then(res => setStaff(res.data)).catch(e => console.log("Нужен эндпоинт /admin/staff"));
  }, []);

  return (
    <div className="p-10">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Users size={32} className="text-blue-600" /> Реестр персонала
        </h2>
        <div className="relative w-96">
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Поиск по фамилии или ID..." 
            className="w-full pl-12 p-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="p-4 font-bold text-slate-500 text-sm">Сотрудник</th>
              <th className="p-4 font-bold text-slate-500 text-sm">Должность</th>
              <th className="p-4 font-bold text-slate-500 text-sm">Базис HR</th>
              <th className="p-4 font-bold text-slate-500 text-sm">Статус</th>
            </tr>
          </thead>
          <tbody>
            {/* Тут будет цикл по сотрудникам. Пока для примера одна строка: */}
            <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="p-4 font-semibold text-slate-700">Жердяева Валентина</td>
              <td className="p-4 text-slate-500">Бортпроводник-инструктор</td>
              <td className="p-4 text-slate-500">75 уд/мин</td>
              <td className="p-4"><span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">АКТИВЕН</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Staff;