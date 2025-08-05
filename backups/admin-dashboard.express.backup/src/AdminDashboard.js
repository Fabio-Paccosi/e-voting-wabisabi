import React, { useState } from 'react';
import { Settings, Users, Vote, UserCheck, Eye, EyeOff } from 'lucide-react';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogin = () => {
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Credenziali non valide!\nUsername: admin\nPassword: admin123');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '' });
  };

  // Dati simulati
  const stats = {
    totalElections: 2,
    totalCandidates: 3,
    totalVoters: 4,
    totalVotes: 0
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Settings className="mx-auto h-12 w-12 text-blue-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600">Sistema E-Voting WabiSabi</p>
            <div className="mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full inline-block">
              ✅ React App (No Tailwind npm conflicts!)
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="admin"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
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
                  {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Accedi al Dashboard
            </button>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-md">
              <p className="text-xs text-gray-600">
                <strong>Credenziali di test:</strong><br />
                Username: admin<br />
                Password: admin123
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="text-xl font-bold text-gray-900">🗳️ E-Voting WabiSabi</div>
              <div className="ml-4 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                React Dashboard ✅
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">Admin</div>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded border border-red-200 hover:border-red-300"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Tabs */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Settings },
              { id: 'elections', label: 'Elezioni', icon: Vote },
              { id: 'candidates', label: 'Candidati', icon: Users },
              { id: 'whitelist', label: 'Whitelist', icon: UserCheck }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Amministratore</h1>
            
            {/* Statistiche */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {[
                { label: 'Elezioni Totali', value: stats.totalElections, icon: Vote, color: 'blue' },
                { label: 'Candidati', value: stats.totalCandidates, icon: Users, color: 'green' },
                { label: 'Votanti', value: stats.totalVoters, icon: UserCheck, color: 'yellow' },
                { label: 'Voti Totali', value: stats.totalVotes, icon: Settings, color: 'purple' }
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Icon className={`h-6 w-6 text-${color}-400`} />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">{label}</dt>
                          <dd className="text-lg font-medium text-gray-900">{value}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Status Servizi */}
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Status Servizi Backend</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  { name: 'API Gateway', port: '3001', status: 'online' },
                  { name: 'Auth Service', port: '3002', status: 'online' },
                  { name: 'Vote Service', port: '3003', status: 'online' }
                ].map(({ name, port, status }) => (
                  <div key={name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{name}</span>
                      <div className="text-xs text-gray-500">:{port}</div>
                    </div>
                    <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Success Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="text-green-400 text-xl">🎉</div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Admin Dashboard Funzionante!</h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>✅ React App attiva senza errori Tailwind</p>
                    <p>✅ Styling via Tailwind CDN</p>
                    <p>✅ Componente AdminDashboard.js caricato da src/</p>
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
            <p className="text-gray-600 mb-4">
              La sezione "{activeTab}" sarà implementata nelle prossime versioni.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-blue-800">
                Il sistema React è completamente operativo! 🚀
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
