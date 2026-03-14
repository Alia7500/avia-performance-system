import React, { useState } from 'react';
import axios from './api/config'; // наш настроенный axios
import Dashboard from './pages/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/auth/login', { username: email, password });
      localStorage.setItem('token', res.data.access_token);
      setUser({ fio: res.data.fio, role: 'crew_member' });
    } catch (err) {
      alert("Ошибка входа!");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md p-10 rounded-3xl shadow-2xl">
          <h1 className="text-2xl font-bold text-slate-800 text-center mb-2 text-balance">ПАО «АЭРОФЛОТ»</h1>
          <p className="text-slate-500 text-center mb-8 text-sm uppercase tracking-widest font-bold">Служебный вход</p>
          <form onSubmit={handleLogin} className="space-y-6">
            <input 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} 
            />
            <input 
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} 
            />
            <button className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
              Войти в систему
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

export default App;