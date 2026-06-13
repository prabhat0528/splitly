import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import GroupDetails from './components/GroupDetails.jsx';
import api from './utils/api.js';

function App() {
  const [user, setUser] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // Verify token and fetch user info
          const userData = await api.get('/auth/me');
          setUser(userData);
        } catch (err) {
          console.error('Auth verification failed:', err);
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveGroupId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar user={user} onLogout={handleLogout} />
      
      <main className="flex-1">
        {!user ? (
          <Login onLoginSuccess={handleLoginSuccess} />
        ) : activeGroupId ? (
          <GroupDetails
            groupId={activeGroupId}
            currentUser={user}
            onBack={() => setActiveGroupId(null)}
          />
        ) : (
          <Dashboard
            user={user}
            onSelectGroup={(id) => setActiveGroupId(id)}
          />
        )}
      </main>

      <footer className="border-t border-slate-900/60 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} Splitly. Built by Prabhat and his pair programmer.</p>
      </footer>
    </div>
  );
}

export default App;
