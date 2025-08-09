import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart3, 
  Users, 
  Vote, 
  Settings, 
  Activity, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  RefreshCcw,
  TrendingUp,
  Database,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';

// Importa i servizi API
import { 
  dashboardAPI, 
  electionsAPI, 
  usersAPI, 
  systemAPI, 
  authAPI,
  adminWS 
} from './services/api';

const AdminDashboard = () => {
  // ==========================================
  // STATO COMPONENTE
  // ==========================================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  // Dati dinamici dal backend
  const [stats, setStats] = useState({
    totalElections: 0,
    totalVotes: 0,
    activeUsers: 0,
    whitelistUsers: 0,
    loading: true
  });
  
  const [systemStatus, setSystemStatus] = useState({
    services: [],
    database: { status: 'unknown', responseTime: 0 },
    redis: { status: 'unknown', responseTime: 0 },
    blockchain: { status: 'unknown', blockHeight: 0 },
    loading: true
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [chartsData, setChartsData] = useState({
    votesOverTime: [],
    registrationsOverTime: [],
    loading: true
  });

  const [realTimeData, setRealTimeData] = useState({
    connectedUsers: 0,
    activeVotingSessions: 0,
    lastUpdate: null
  });

  // ==========================================
  // EFFETTI E LIFECYCLE
  // ==========================================
  useEffect(() => {
    checkAuthenticationStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
      setupRealTimeUpdates();
      
      // Refresh automatico ogni 30 secondi
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // ==========================================
  // FUNZIONI AUTENTICAZIONE
  // ==========================================
  const checkAuthenticationStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (token) {
        await authAPI.verifyToken();
        setIsAuthenticated(true);
      }
    } catch (error) {
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await authAPI.login(credentials);
      setIsAuthenticated(true);
      setCredentials({ username: '', password: '' });
    } catch (error) {
      alert('Credenziali non valide');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      adminWS.disconnect();
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  // ==========================================
  // CARICAMENTO DATI DASHBOARD
  // ==========================================
  const loadDashboardData = async () => {
    try {
      // Carica statistiche principali
      await loadStats();
      
      // Carica stato sistema
      await loadSystemStatus();
      
      // Carica attività recente
      await loadRecentActivity();
      
      // Carica dati grafici
      await loadChartsData();
      
    } catch (error) {
      console.error('Errore caricamento dashboard:', error);
    }
  };

  const loadStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      const statsData = await dashboardAPI.getStats();
      setStats({
        ...statsData,
        loading: false
      });
    } catch (error) {
      console.error('Errore caricamento statistiche:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  const loadSystemStatus = async () => {
    try {
      setSystemStatus(prev => ({ ...prev, loading: true }));
      const statusData = await dashboardAPI.getSystemStatus();
      setSystemStatus({
        ...statusData,
        loading: false
      });
    } catch (error) {
      console.error('Errore caricamento stato sistema:', error);
      setSystemStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activityData = await dashboardAPI.getRecentLogs(10);
      setRecentActivity(activityData.logs || []);
    } catch (error) {
      console.error('Errore caricamento attività:', error);
    }
  };

  const loadChartsData = async () => {
    try {
      setChartsData(prev => ({ ...prev, loading: true }));
      const charts = await dashboardAPI.getChartsData('7d');
      setChartsData({
        ...charts,
        loading: false
      });
    } catch (error) {
      console.error('Errore caricamento grafici:', error);
      setChartsData(prev => ({ ...prev, loading: false }));
    }
  };

  // ==========================================
  // REAL-TIME UPDATES
  // ==========================================
  const setupRealTimeUpdates = () => {
    adminWS.connect();

    // Listener per aggiornamenti statistiche
    adminWS.on('stats-update', (newStats) => {
      setStats(prev => ({
        ...prev,
        ...newStats
      }));
    });

    // Listener per nuovi voti
    adminWS.on('new-vote', (voteData) => {
      setRealTimeData(prev => ({
        ...prev,
        activeVotingSessions: voteData.activeSessions,
        lastUpdate: new Date().toISOString()
      }));
    });

    // Listener per nuove registrazioni
    adminWS.on('user-registered', (userData) => {
      setStats(prev => ({
        ...prev,
        activeUsers: prev.activeUsers + 1
      }));
      
      // Aggiungi alla attività recente
      setRecentActivity(prev => [
        {
          id: Date.now(),
          type: 'user_registration',
          message: `Nuovo utente registrato: ${userData.email}`,
          timestamp: new Date().toISOString(),
          level: 'info'
        },
        ...prev.slice(0, 9)
      ]);
    });
  };

  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================
  const refreshData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      await Promise.all([
        loadStats(),
        loadSystemStatus(),
        loadRecentActivity()
      ]);
      
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Errore refresh dati:', error);
    }
  }, [isAuthenticated]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online':
      case 'connected':
      case 'healthy':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'warning':
        return <AlertCircle className="text-yellow-500" size={16} />;
      case 'offline':
      case 'error':
      case 'unhealthy':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <Activity className="text-gray-500" size={16} />;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Mai';
    return new Date(timestamp).toLocaleString('it-IT');
  };

  // ==========================================
  // COMPONENTI UI
  // ==========================================
  const StatCard = ({ title, value, loading, icon: Icon, color = 'blue', trend }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700">{title}</h3>
          {loading ? (
            <div className="animate-pulse bg-gray-200 h-8 w-16 rounded mt-2"></div>
          ) : (
            <div className="flex items-center mt-2">
              <p className={`text-3xl font-bold text-${color}-600`}>{value}</p>
              {trend && (
                <div className={`flex items-center ml-2 text-sm ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  <TrendingUp size={16} className={trend < 0 ? 'rotate-180' : ''} />
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
        <Icon className={`text-${color}-500`} size={24} />
      </div>
    </div>
  );

  // ==========================================
  // RENDER LOGIN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold mb-6 text-center">🗳️ Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={isLoading}
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCcw className="animate-spin" size={20} />
              ) : (
                'Accedi'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER DASHBOARD PRINCIPALE
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation */}
      <nav className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">🗳️ E-Voting Admin Dashboard</h1>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="opacity-75">Ultimo aggiornamento: </span>
              <span>{formatTimestamp(realTimeData.lastUpdate)}</span>
            </div>
            <button
              onClick={refreshData}
              className="text-sm bg-blue-700 px-3 py-1 rounded hover:bg-blue-800 flex items-center space-x-1"
              title="Aggiorna dati"
            >
              <RefreshCcw size={16} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={handleLogout}
              className="text-sm bg-red-600 px-3 py-1 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto mt-8 px-4">
        {/* Tab Navigation */}
        <div className="flex flex-wrap mb-6 border-b">
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
                className={`flex items-center space-x-2 px-6 py-3 mr-2 mb-2 rounded-t-lg transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Statistiche Principali */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <StatCard
                title="Elezioni Totali"
                value={stats.totalElections}
                loading={stats.loading}
                icon={Vote}
                color="blue"
              />
              <StatCard
                title="Voti Totali"
                value={stats.totalVotes}
                loading={stats.loading}
                icon={BarChart3}
                color="green"
              />
              <StatCard
                title="Utenti Attivi"
                value={stats.activeUsers}
                loading={stats.loading}
                icon={Users}
                color="purple"
              />
              <StatCard
                title="Whitelist"
                value={stats.whitelistUsers}
                loading={stats.loading}
                icon={CheckCircle}
                color="orange"
              />
            </div>

            {/* Stato Sistema */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Server className="mr-2" size={20} />
                  Stato Servizi
                </h3>
                {systemStatus.loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse bg-gray-200 h-12 rounded"></div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {systemStatus.services?.map(service => (
                      <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(service.status)}
                          <span className="font-medium">{service.name}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {service.responseTime}ms
                        </div>
                      </div>
                    ))}
                    
                    {/* Database Status */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(systemStatus.database?.status)}
                        <span className="font-medium">Database</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {systemStatus.database?.responseTime}ms
                      </div>
                    </div>

                    {/* Redis Status */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(systemStatus.redis?.status)}
                        <span className="font-medium">Redis Cache</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {systemStatus.redis?.responseTime}ms
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Attività Recente */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Activity className="mr-2" size={20} />
                  Attività Recente
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentActivity.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">Nessuna attività recente</p>
                  ) : (
                    recentActivity.map((activity, index) => (
                      <div key={activity.id || index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          activity.level === 'error' ? 'bg-red-500' :
                          activity.level === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800">{activity.message}</p>
                          <p className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Status Real-time */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                    <Wifi className="mr-2 text-green-500" size={20} />
                    Sistema Real-time Attivo
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Sessioni Voto Attive:</span>
                      <span className="ml-2 font-semibold text-green-600">{realTimeData.activeVotingSessions}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Utenti Connessi:</span>
                      <span className="ml-2 font-semibold text-blue-600">{realTimeData.connectedUsers}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Ultimo aggiornamento</div>
                  <div className="text-sm font-medium">{formatTimestamp(realTimeData.lastUpdate)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder per altre sezioni */}
        {activeTab !== 'dashboard' && (
          <div className="text-center py-16">
            <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
              <Settings className="h-16 w-16" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              Sezione "{activeTab}" in Sviluppo
            </h3>
            <p className="text-gray-600 mb-4">
              Questa sezione sarà implementata nella prossima versione con funzionalità complete.
            </p>
            <div className="text-sm text-gray-500">
              <p>✅ Dashboard dinamico implementato</p>
              <p>🔄 {activeTab} - in fase di sviluppo</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;