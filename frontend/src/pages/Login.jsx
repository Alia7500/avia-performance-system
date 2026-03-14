import React, { useState } from 'react';
import api from '../api/config';
import { Plane } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { username: email, password });
      localStorage.setItem('token', res.data.access_token);
      onLoginSuccess({ fio: res.data.fio, role: res.data.role, position: res.data.position });
    } catch { alert("Ошибка входа!"); }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <form onSubmit={handleLogin} className="bg-white p-10 rounded-3xl shadow-2xl w-96 text-center">
        <Plane size={48} className="mx-auto text-blue-600 mb-6"/>
        <h2 className="text-2xl font-black mb-6">ВХОД В СИСТЕМУ</h2>
        <input className="w-full p-3 mb-4 border rounded-xl" type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input className="w-full p-3 mb-6 border rounded-xl" type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} />
        <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700">Войти</button>
      </form>
    </div>
  );
};
export default Login;