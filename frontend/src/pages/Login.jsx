import React, { useState } from 'react';
import api from '../api/config';
import { Plane, AlertTriangle } from 'lucide-react';

// Функция генерации отпечатка устройства (Алгоритм А1)
const generateDeviceHash = () => {
  const str = navigator.userAgent + window.screen.width + window.screen.height + navigator.language;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return "DEV-" + Math.abs(hash).toString(16).toUpperCase();
};

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      // Собираем отпечаток устройства
      const deviceHash = generateDeviceHash();
      
      const res = await api.post('/auth/login', { 
        username: email, 
        password: password,
        device_hash: deviceHash // Отправляем хеш на бэкенд
      });
      
      localStorage.setItem('token', res.data.access_token);
      onLoginSuccess({ fio: res.data.fio, role: res.data.role, position: res.data.position });
    } catch (err) { 
      setError(err.response?.data?.detail || "Ошибка связи с сервером");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2rem] shadow-2xl w-full max-w-md text-center">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl mx-auto flex items-center justify-center mb-6">
           <Plane size={40} />
        </div>
        <h2 className="text-3xl font-black mb-2 uppercase tracking-tight text-slate-800">Агент МС-21</h2>
        <p className="text-sm font-bold text-slate-400 mb-8 uppercase tracking-widest">Авторизация персонала</p>
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl border border-rose-200 flex items-center gap-3 text-left">
            <AlertTriangle size={20} className="flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <input className="w-full p-4 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" type="email" placeholder="Служебный Email" onChange={e => setEmail(e.target.value)} required />
          <input className="w-full p-4 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} required />
        </div>
        
        <button disabled={loading} className="w-full mt-8 py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50">
          {loading ? 'ПРОВЕРКА...' : 'ВОЙТИ В СИСТЕМУ'}
        </button>
      </form>
    </div>
  );
};
export default Login;