import React, { useEffect, useState } from 'react';
import Login from './pages/Login';
import CrewPage from './pages/CrewPage';
import DispatcherPage from './pages/DispatcherPage';
import AdminPage from './pages/AdminPage';
import MedicPage from './pages/MedicPage';

function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('avia_user');

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('avia_user');
      }
    }

    setIsInitializing(false);
  }, []);

  const handleLogin = (userData) => {
    localStorage.setItem('avia_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('avia_user');
    localStorage.removeItem('token');
    setUser(null);
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-bold">
        ЗАГРУЗКА СИСТЕМЫ...
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  if (user.role === 'administrator') return <AdminPage user={user} onLogout={handleLogout} />;
  if (user.role === 'dispatcher') return <DispatcherPage user={user} onLogout={handleLogout} />;
  if (user.role === 'medical_worker') return <MedicPage user={user} onLogout={handleLogout} />;

  return <CrewPage user={user} onLogout={handleLogout} />;
}

export default App;
