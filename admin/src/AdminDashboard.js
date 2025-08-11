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
  WifiOff,
  UserPlus,
  Trash2,
  Download,
  Upload,
  Play,
  Pause,
  Edit,
  Save,
  X,
  Search,
  Filter,
  Clock,
  Shield,
  Key,
  FileText,
  HardDrive
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
  const [realTimeData, setRealTimeData] = useState({
    connectedUsers: 0,
    activeVotingSessions: 0,
    lastUpdate: null
  });

  // Stato per sezioni specifiche
  const [elections, setElections] = useState([]);
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [backups, setBackups] = useState([]);
  const [logs, setLogs] = useState([]);

  // Stati UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // ==========================================
  // FUNZIONI UTILITY
  // ==========================================
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Mai';
    return new Date(timestamp).toLocaleString('it-IT');
  };

  const formatNumber = (num) => {
    // ✅ CONTROLLO VALIDITÀ
    if (num === null || num === undefined || isNaN(num)) {
      return '0';
    }
    
    // ✅ CONVERTE A NUMERO SE È STRINGA
    const number = typeof num === 'string' ? parseInt(num, 10) : num;
    
    // ✅ CONTROLLO FINALE
    if (isNaN(number)) {
      return '0';
    }
    
    return new Intl.NumberFormat('it-IT').format(number);
  };

  const showMessage = (message, type = 'success') => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }
    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 5000);
  };

  // ==========================================
  // AUTENTICAZIONE
  // ==========================================
  const checkAuthenticationStatus = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const response = await authAPI.verifyToken();
      if (response.valid) {
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        localStorage.removeItem('adminToken');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Errore verifica auth:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.login(credentials);
      if (response.token) {
        setIsAuthenticated(true);
        loadDashboardData();
        showMessage('Accesso effettuato con successo');
      }
    } catch (error) {
      setError(error.message || 'Errore durante l\'accesso');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      setCredentials({ username: '', password: '' });
    } catch (error) {
      console.error('Errore logout:', error);
    }
  };

  // ==========================================
  // CARICAMENTO DATI
  // ==========================================
  const loadDashboardData = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true }));
      setSystemStatus(prev => ({ ...prev, loading: true }));

      const [
        statsData,
        statusData,
        activityData
      ] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getSystemStatus(),
        dashboardAPI.getRecentActivity()
      ]);
      setStats({ ...statsData, loading: false });
      setSystemStatus({ ...statusData, loading: false });
      setRecentActivity(activityData.activities || []);
      setRealTimeData({
        connectedUsers: statusData.connectedUsers || 0,
        activeVotingSessions: statsData.activeElections || 0,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Errore caricamento dashboard:', error);
      setError('Errore caricamento dati dashboard');
    }
  };

  const loadElections = async () => {
    setLoading(true);
    try {
      const data = await electionsAPI.getElections();
      setElections(data.elections || []);
    } catch (error) {
      showMessage('Errore caricamento elezioni', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await usersAPI.getUsers({ page: currentPage, limit: 20 });
      setUsers(data.users || []);
    } catch (error) {
      showMessage('Errore caricamento utenti', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWhitelist = async () => {
    setLoading(true);
    try {
      const data = await usersAPI.getWhitelist();
      setWhitelist(data.whitelist || []);
    } catch (error) {
      showMessage('Errore caricamento whitelist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    setLoading(true);
    try {
      const data = await systemAPI.getSettings();
      setSystemSettings(data);
    } catch (error) {
      showMessage('Errore caricamento impostazioni', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const data = await systemAPI.getBackups();
      setBackups(data.backups || []);
    } catch (error) {
      showMessage('Errore caricamento backup', 'error');
    }
  };

  const loadLogs = async () => {
    try {
      const data = await systemAPI.getSystemLogs('all', 100);
      setLogs(data.logs || []);
    } catch (error) {
      showMessage('Errore caricamento log', 'error');
    }
  };

  // ==========================================
  // AZIONI ELEZIONI
  // ==========================================
  const handleElectionAction = async (electionId, action) => {
    try {
      if (action === 'start') {
        await electionsAPI.startElection(electionId);
        showMessage('Elezione avviata con successo');
      } else if (action === 'stop') {
        await electionsAPI.stopElection(electionId);
        showMessage('Elezione fermata con successo');
      }
      loadElections();
    } catch (error) {
      showMessage(`Errore ${action} elezione`, 'error');
    }
  };

  // ==========================================
  // AZIONI UTENTI
  // ==========================================
  const handleAddToWhitelist = async (userData) => {
    try {
      await usersAPI.addToWhitelist(userData);
      showMessage('Utente aggiunto alla whitelist');
      loadWhitelist();
    } catch (error) {
      showMessage('Errore aggiunta utente', 'error');
    }
  };

  const handleRemoveFromWhitelist = async (email) => {
    if (window.confirm('Rimuovere questo utente dalla whitelist?')) {
      try {
        await usersAPI.removeFromWhitelist(email);
        showMessage('Utente rimosso dalla whitelist');
        loadWhitelist();
      } catch (error) {
        showMessage('Errore rimozione utente', 'error');
      }
    }
  };

  // ==========================================
  // AZIONI SISTEMA
  // ==========================================
  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      await systemAPI.createBackup();
      showMessage('Backup creato con successo');
      loadBackups();
    } catch (error) {
      showMessage('Errore creazione backup', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    if (window.confirm('Ripristinare questo backup? L\'operazione non può essere annullata.')) {
      try {
        setLoading(true);
        await systemAPI.restoreBackup(backupId);
        showMessage('Backup ripristinato con successo');
      } catch (error) {
        showMessage('Errore ripristino backup', 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleUpdateSettings = async (newSettings) => {
    try {
      await systemAPI.updateSettings(newSettings);
      showMessage('Impostazioni aggiornate con successo');
      setSystemSettings(newSettings);
    } catch (error) {
      showMessage('Errore aggiornamento impostazioni', 'error');
    }
  };

  // ==========================================
  // EFFETTI
  // ==========================================
  useEffect(() => {
    checkAuthenticationStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated && activeTab !== 'dashboard') {
      if (activeTab === 'elections') loadElections();
      else if (activeTab === 'users') { loadUsers(); loadWhitelist(); }
      else if (activeTab === 'settings') { loadSystemSettings(); loadBackups(); loadLogs(); }
    }
  }, [activeTab, isAuthenticated]);

  // Auto-refresh per dashboard
  useEffect(() => {
    if (isAuthenticated && activeTab === 'dashboard') {
      const interval = setInterval(loadDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab]);

  // ==========================================
  // COMPONENTI UI
  // ==========================================
  const StatCard = ({ title, value, loading, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '...' : formatNumber(value)}
          </p>
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const StatusIndicator = ({ status, label }) => {
    const statusColor = status === 'online' ? 'green' : status === 'offline' ? 'red' : 'yellow';
    return (
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full bg-${statusColor}-500`}></div>
        <span className="text-sm text-gray-700">{label}</span>
        <span className={`text-xs font-medium text-${statusColor}-600`}>
          {status.toUpperCase()}
        </span>
      </div>
    );
  };

  // ==========================================
  // LOGIN FORM
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6">🗳️ Admin Login</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

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
                required
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
              onClick={loadDashboardData}
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

      {/* Messages */}
      {(success || error) && (
        <div className="container mx-auto mt-4 px-4">
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
        </div>
      )}

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

        {/* DASHBOARD */}
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

            {/* Stato Sistema e Attività */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stato Servizi */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Server className="mr-2" size={20} />
                  Stato Servizi
                </h3>
                <div className="space-y-3">
                  <StatusIndicator 
                    status={systemStatus.database?.status || 'unknown'} 
                    label="Database" 
                  />
                  <StatusIndicator 
                    status={systemStatus.redis?.status || 'unknown'} 
                    label="Redis" 
                  />
                  <StatusIndicator 
                    status={systemStatus.blockchain?.status || 'unknown'} 
                    label="Blockchain" 
                  />
                </div>
              </div>

              {/* Attività Recenti */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Activity className="mr-2" size={20} />
                  Attività Recenti
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
              </div>
            </div>
          </div>
        )}

        {/* SEZIONE ELEZIONI */}
        {activeTab === 'elections' && (
          <ElectionsSection 
            elections={elections}
            loading={loading}
            onElectionAction={handleElectionAction}
            onRefresh={loadElections}
          />
        )}

        {/* SEZIONE UTENTI */}
        {activeTab === 'users' && (
          <UsersSection 
            users={users}
            whitelist={whitelist}
            loading={loading}
            onAddToWhitelist={handleAddToWhitelist}
            onRemoveFromWhitelist={handleRemoveFromWhitelist}
            onRefreshUsers={loadUsers}
            onRefreshWhitelist={loadWhitelist}
          />
        )}

        {/* SEZIONE IMPOSTAZIONI */}
        {activeTab === 'settings' && (
          <SettingsSection 
            settings={systemSettings}
            backups={backups}
            logs={logs}
            loading={loading}
            onUpdateSettings={handleUpdateSettings}
            onCreateBackup={handleCreateBackup}
            onRestoreBackup={handleRestoreBackup}
            onRefreshSettings={loadSystemSettings}
            onRefreshBackups={loadBackups}
            onRefreshLogs={loadLogs}
          />
        )}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENTI SEZIONI
// ==========================================

const ElectionsSection = ({ elections, loading, onElectionAction, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredElections = elections.filter(election => {
    const matchesSearch = election.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || election.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestione Elezioni</h2>
          <p className="text-gray-600">{elections.length} elezioni totali</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          disabled={loading}
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Aggiorna</span>
        </button>
      </div>

      {/* Filtri */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Cerca elezioni..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tutti gli stati</option>
          <option value="draft">Bozza</option>
          <option value="active">Attiva</option>
          <option value="completed">Completata</option>
          <option value="cancelled">Cancellata</option>
        </select>
      </div>

      {/* Lista Elezioni */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCcw className="animate-spin mx-auto mb-4" size={32} />
            <p>Caricamento elezioni...</p>
          </div>
        ) : filteredElections.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Vote size={48} className="mx-auto mb-4 text-gray-300" />
            <p>Nessuna elezione trovata</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredElections.map(election => (
              <div key={election.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{election.title}</h3>
                    <p className="text-gray-600 mt-1">{election.description}</p>
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                      <span>📅 {election.startDate} - {election.endDate}</span>
                      <span>🗳️ {election.totalVotes || 0} voti</span>
                      <span>👥 {election.candidates?.length || 0} candidati</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      election.status === 'active' ? 'bg-green-100 text-green-800' :
                      election.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      election.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {election.status}
                    </span>
                    {election.status === 'draft' && (
                      <button
                        onClick={() => onElectionAction(election.id, 'start')}
                        className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        <Play size={14} />
                        <span>Avvia</span>
                      </button>
                    )}
                    {election.status === 'active' && (
                      <button
                        onClick={() => onElectionAction(election.id, 'stop')}
                        className="flex items-center space-x-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        <Pause size={14} />
                        <span>Ferma</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const UsersSection = ({ users, whitelist, loading, onAddToWhitelist, onRemoveFromWhitelist, onRefreshUsers, onRefreshWhitelist }) => {
  const [activeUserTab, setActiveUserTab] = useState('users');
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', firstName: '', lastName: '', taxCode: '' });

  const handleAddUser = async (e) => {
    e.preventDefault();
    await onAddToWhitelist(newUser);
    setNewUser({ email: '', firstName: '', lastName: '', taxCode: '' });
    setShowAddUser(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestione Utenti</h2>
          <p className="text-gray-600">
            {activeUserTab === 'users' 
              ? `${users.length} utenti registrati`
              : `${whitelist.length} utenti in whitelist`
            }
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => activeUserTab === 'users' ? onRefreshUsers() : onRefreshWhitelist()}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Aggiorna</span>
          </button>
          
          {activeUserTab === 'whitelist' && (
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <UserPlus size={16} />
              <span>Aggiungi</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveUserTab('users')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeUserTab === 'users'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Users size={16} />
          <span>Utenti Registrati</span>
        </button>
        <button
          onClick={() => setActiveUserTab('whitelist')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeUserTab === 'whitelist'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <Shield size={16} />
          <span>Whitelist</span>
        </button>
      </div>

      {/* Contenuto Tab */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCcw className="animate-spin mx-auto mb-4" size={32} />
            <p>Caricamento...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {(activeUserTab === 'users' ? users : whitelist).map((user, index) => (
              <div key={user.id || user.email || index} className="p-4 hover:bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{user.email}</p>
                        {user.firstName && user.lastName && (
                          <p className="text-sm text-gray-600">{user.firstName} {user.lastName}</p>
                        )}
                        {user.taxCode && (
                          <p className="text-xs text-gray-500">CF: {user.taxCode}</p>
                        )}
                      </div>
                      {activeUserTab === 'users' && (
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'verified' ? 'bg-green-100 text-green-800' :
                            user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                          {user.hasVoted && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              Ha votato
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      <span>Registrato: {new Date(user.createdAt || user.addedAt).toLocaleDateString('it-IT')}</span>
                      {user.lastActivity && (
                        <span className="ml-4">Ultima attività: {new Date(user.lastActivity).toLocaleDateString('it-IT')}</span>
                      )}
                    </div>
                  </div>
                  
                  {activeUserTab === 'whitelist' && (
                    <button
                      onClick={() => onRemoveFromWhitelist(user.email)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Rimuovi da whitelist"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Aggiungi Utente */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Aggiungi Utente alla Whitelist</h3>
              <button onClick={() => setShowAddUser(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  value={newUser.taxCode}
                  onChange={(e) => setNewUser({...newUser, taxCode: e.target.value.toUpperCase()})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SettingsSection = ({ 
  settings, 
  backups, 
  logs, 
  loading, 
  onUpdateSettings, 
  onCreateBackup, 
  onRestoreBackup,
  onRefreshSettings,
  onRefreshBackups,
  onRefreshLogs 
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState('system');
  const [editingSettings, setEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState(settings);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
    await onUpdateSettings(tempSettings);
    setEditingSettings(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Impostazioni Sistema</h2>
          <p className="text-gray-600">Configurazione e manutenzione del sistema</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'system', label: 'Sistema', icon: Settings },
          { id: 'backup', label: 'Backup', icon: HardDrive },
          { id: 'logs', label: 'Log', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSettingsTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeSettingsTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SISTEMA */}
      {activeSettingsTab === 'system' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Configurazione Sistema</h3>
            <div className="flex space-x-2">
              {editingSettings ? (
                <>
                  <button
                    onClick={() => setEditingSettings(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Save size={16} />
                    <span>Salva</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingSettings(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  <Edit size={16} />
                  <span>Modifica</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Sistema
              </label>
              <input
                type="text"
                value={tempSettings.systemName || ''}
                onChange={(e) => setTempSettings({...tempSettings, systemName: e.target.value})}
                disabled={!editingSettings}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout Sessione (minuti)
              </label>
              <input
                type="number"
                value={tempSettings.sessionTimeout || 30}
                onChange={(e) => setTempSettings({...tempSettings, sessionTimeout: parseInt(e.target.value)})}
                disabled={!editingSettings}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Utenti Connessi
              </label>
              <input
                type="number"
                value={tempSettings.maxConnectedUsers || 1000}
                onChange={(e) => setTempSettings({...tempSettings, maxConnectedUsers: parseInt(e.target.value)})}
                disabled={!editingSettings}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={tempSettings.maintenanceMode || false}
                onChange={(e) => setTempSettings({...tempSettings, maintenanceMode: e.target.checked})}
                disabled={!editingSettings}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
              />
              <label className="ml-2 block text-sm text-gray-700">
                Modalità Manutenzione
              </label>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP */}
      {activeSettingsTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Gestione Backup</h3>
              <div className="flex space-x-2">
                <button
                  onClick={onRefreshBackups}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  <RefreshCcw size={16} />
                  <span>Aggiorna</span>
                </button>
                <button
                  onClick={onCreateBackup}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download size={16} />
                  <span>Crea Backup</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {backups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <HardDrive size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Nessun backup disponibile</p>
                </div>
              ) : (
                backups.map(backup => (
                  <div key={backup.id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg">
                    <div>
                      <p className="font-medium">{backup.filename}</p>
                      <p className="text-sm text-gray-600">
                        Creato il {new Date(backup.createdAt).toLocaleString('it-IT')}
                      </p>
                      <p className="text-xs text-gray-500">
                        Dimensione: {(backup.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => onRestoreBackup(backup.id)}
                      className="flex items-center space-x-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      <Upload size={14} />
                      <span>Ripristina</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOG */}
      {activeSettingsTab === 'logs' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Log di Sistema</h3>
            <button
              onClick={onRefreshLogs}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              <RefreshCcw size={16} />
              <span>Aggiorna</span>
            </button>
          </div>

          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">Nessun log disponibile</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-gray-500">[{new Date(log.timestamp).toLocaleString('it-IT')}]</span>
                  <span className={`ml-2 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warning' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="ml-2 text-white">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;