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
                  {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                </button>
              </div>
            </div>
            
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200"
            >
              Accedi
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 text-center">
              <strong>✅ Dashboard Pronto!</strong><br />
              Username: <code className="bg-green-100 px-1 rounded">admin</code><br />
              Password: <code className="bg-green-100 px-1 rounded">admin123</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Sistema E-Voting WabiSabi</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Benvenuto, <strong>admin</strong>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Vote className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Elezioni</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalElections}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Candidati</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCandidates}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Elettori</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVoters}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <Vote className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Voti Totali</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalVotes}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow">
          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { id: 'dashboard', name: 'Dashboard', icon: Settings },
                { id: 'elections', name: 'Elezioni', icon: Vote },
                { id: 'candidates', name: 'Candidati', icon: Users },
                { id: 'whitelist', name: 'Whitelist', icon: UserCheck }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                  >
                    <Icon className="h-5 w-5 mr-2" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="p-6">
            {activeTab === 'dashboard' && (
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">Panoramica Sistema</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-medium text-blue-900 mb-2">✅ Dashboard Attivo</h3>
                      <p className="text-sm text-blue-800">
                        Il dashboard amministratore è ora funzionante e accessibile.
                      </p>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h3 className="font-medium text-yellow-900 mb-2">⚠️ Servizi Base</h3>
                      <p className="text-sm text-yellow-800">
                        I servizi base (API Gateway, Auth, Vote) devono essere avviati per funzionalità complete.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2">🔧 Prossimi Passi</h3>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Avvia servizi base: <code className="bg-gray-100 px-1 rounded">docker compose up -d</code></li>
                        <li>• Testa registrazione: <code className="bg-gray-100 px-1 rounded">./quick-test.sh</code></li>
                        <li>• Gestisci whitelist tramite tab "Whitelist"</li>
                      </ul>
                    </div>
                    
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="font-medium text-green-900 mb-2">🎯 Whitelist Configurata</h3>
                      <p className="text-sm text-green-800">
                        Utenti autorizzati: alice@example.com, test@example.com, bob@example.com
                      </p>
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Funzionalità in Sviluppo</h3>
                <p className="text-gray-600 mb-4">
                  La sezione "{activeTab}" sarà disponibile dopo l'integrazione con le API backend.
                </p>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-blue-800">
                    Per ora il dashboard dimostra la corretta configurazione e funzionamento del sistema di autenticazione admin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
