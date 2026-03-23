import React, { useState } from 'react';
import Login from './pages/Login';
import CrewPage from './pages/CrewPage';
import DispatcherPage from './pages/DispatcherPage';
import AdminPage from './pages/AdminPage';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  if (user.role === 'administrator') {
    return <AdminPage user={user} onLogout={() => setUser(null)} />;
  }

  if (user.role === 'dispatcher') {
    return <DispatcherPage user={user} onLogout={() => setUser(null)} />;
  }

  return <CrewPage user={user} onLogout={() => setUser(null)} />;
}

export default App;