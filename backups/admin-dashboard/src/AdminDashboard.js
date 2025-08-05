import React, { useState, useEffect } from 'react';
import { Settings, Users, Vote, BarChart3, Eye, EyeOff } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [stats, setStats] = useState({
    totalElections: 0,
    totalVotes: 0,
    activeUsers: 0,
    whitelistUsers: 0
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Credenziali non valide');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      // Simula caricamento statistiche
      setStats({
        totalElections: 3,
        totalVotes: 156,
        activeUsers: 45,
        whitelistUsers: 12
      });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Username
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin"
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  placeholder="admin123"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Accedi
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">🗳️ E-Voting Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm">Porta: 3006</span>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto mt-8 px-4">
        <div className="flex flex-wrap mb-6">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'elections', label: 'Elezioni', icon: Vote },
            { id: 'users', label: 'Utenti', icon: Users },
            { id: 'settings', label: 'Impostazioni', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 mr-2 mb-2 rounded-lg ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'dashboard' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Elezioni Totali</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalElections}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Voti Totali</h3>
                <p className="text-3xl font-bold text-green-600">{stats.totalVotes}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Utenti Attivi</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.activeUsers}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700">Whitelist</h3>
                <p className="text-3xl font-bold text-orange-600">{stats.whitelistUsers}</p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex">
                <div className="text-green-400 text-xl mr-3">🎉</div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Admin Dashboard React Attivo!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>✅ React App funzionante</p>
                    <p>✅ Componente AdminDashboard.js caricato</p>
                    <p>✅ Styling via Tailwind CDN</p>
                    <p>✅ Porta 3006 operativa</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'dashboard' && (
          <div className="text-center py-12">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <Settings className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sezione in Sviluppo</h3>
            <p className="text-gray-600">
              La sezione "{activeTab}" sarà implementata nelle prossime versioni.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
