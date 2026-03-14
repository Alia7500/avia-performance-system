import React, { useState } from 'react';
import Login from './pages/Login';
import CrewPage from './pages/CrewPage';
import DispatcherPage from './pages/DispatcherPage';

function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  // Если диспетчер или админ - пускаем в ЦУП. Иначе - в личный кабинет.
  if (user.role === 'dispatcher' || user.role === 'administrator') {
    return <DispatcherPage user={user} onLogout={() => setUser(null)} />;
  }

  return <CrewPage user={user} onLogout={() => setUser(null)} />;
}

export default App;