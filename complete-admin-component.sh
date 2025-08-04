#!/bin/bash
# complete-admin-component.sh
# Script per creare il componente AdminDashboard completo

echo "⚛️ Creazione componente AdminDashboard completo..."

# Crea il componente completo copiando dall'artifact
cat > admin-dashboard/src/AdminDashboard.js << 'EOF'
import React, { useState, useEffect } from 'react';
import { Users, Vote, UserCheck, Settings, Plus, Edit, Trash2, Save, X, Eye, EyeOff } from 'lucide-react';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('elections');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // States per i dati
  const [elections, setElections] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [stats, setStats] = useState({});

  // States per i form
  const [editingElection, setEditingElection] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [editingWhitelistUser, setEditingWhitelistUser] = useState(null);

  // Simulazione dati iniziali
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated]);

  const loadInitialData = () => {
    // Simulazione caricamento dati
    setElections([
      {
        id: '1',
        title: 'Elezione Comunale 2025',
        description: 'Elezione del sindaco e consiglio comunale',
        startDate: '2025-03-01',
        endDate: '2025-03-15',
        status: 'scheduled',
        totalVotes: 0
      },
      {
        id: '2',
        title: 'Referendum Trasporti',
        description: 'Referendum sui mezzi pubblici',
        startDate: '2025-04-01',
        endDate: '2025-04-07',
        status: 'draft',
        totalVotes: 0
      }
    ]);

    setCandidates([
      { id: '1', electionId: '1', name: 'Mario Rossi', party: 'Lista Civica', votes: 0, bio: 'Sindaco uscente' },
      { id: '2', electionId: '1', name: 'Anna Verdi', party: 'Partito Verde', votes: 0, bio: 'Ambientalista' },
      { id: '3', electionId: '1', name: 'Luca Bianchi', party: 'Movimento Cittadini', votes: 0, bio: 'Imprenditore locale' }
    ]);

    setWhitelist([
      { id: '1', email: 'alice@example.com', taxCode: 'RSSMRA85M01H501Z', firstName: 'Alice', lastName: 'Rossi', status: 'active' },
      { id: '2', email: 'bob@example.com', taxCode: 'VRDGPP90L15H501A', firstName: 'Bob', lastName: 'Verdi', status: 'active' },
      { id: '3', email: 'charlie@example.com', taxCode: 'BNCLRA88S20H501B', firstName: 'Charlie', lastName: 'Bianchi', status: 'active' },
      { id: '4', email: 'test@example.com', taxCode: 'RSSMRA85M01H501Z', firstName: 'Test', lastName: 'User', status: 'active' }
    ]);

    setStats({
      totalElections: 2,
      totalCandidates: 3,
      totalVoters: 4,
      totalVotes: 0
    });
  };

  const handleLogin = () => {
    // Simulazione autenticazione (in produzione usare JWT)
    if (adminCredentials.username === 'admin' && adminCredentials.password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Credenziali non valide');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAdminCredentials({ username: '', password: '' });
  };

  // Gestione Elezioni
  const handleSaveElection = (electionData) => {
    if (editingElection?.id) {
      setElections(elections.map(e => e.id === editingElection.id ? { ...electionData, id: editingElection.id } : e));
    } else {
      setElections([...elections, { ...electionData, id: Date.now().toString(), totalVotes: 0 }]);
    }
    setEditingElection(null);
  };

  const handleDeleteElection = (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questa elezione?')) {
      setElections(elections.filter(e => e.id !== id));
      setCandidates(candidates.filter(c => c.electionId !== id));
    }
  };

  // Gestione Candidati
  const handleSaveCandidate = (candidateData) => {
    if (editingCandidate?.id) {
      setCandidates(candidates.map(c => c.id === editingCandidate.id ? { ...candidateData, id: editingCandidate.id } : c));
    } else {
      setCandidates([...candidates, { ...candidateData, id: Date.now().toString(), votes: 0 }]);
    }
    setEditingCandidate(null);
  };

  const handleDeleteCandidate = (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questo candidato?')) {
      setCandidates(candidates.filter(c => c.id !== id));
    }
  };

  // Gestione Whitelist
  const handleSaveWhitelistUser = (userData) => {
    if (editingWhitelistUser?.id) {
      setWhitelist(whitelist.map(u => u.id === editingWhitelistUser.id ? { ...userData, id: editingWhitelistUser.id } : u));
    } else {
      setWhitelist([...whitelist, { ...userData, id: Date.now().toString(), status: 'active' }]);
    }
    setEditingWhitelistUser(null);
    
    // Aggiorna stats
    setStats(prev => ({ ...prev, totalVoters: whitelist.length + 1 }));
  };

  const handleDeleteWhitelistUser = (id) => {
    if (window.confirm('Sei sicuro di voler rimuovere questo utente dalla whitelist?')) {
      setWhitelist(whitelist.filter(u => u.id !== id));
      setStats(prev => ({ ...prev, totalVoters: prev.totalVoters - 1 }));
    }
  };

  // Login Form
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
                value={adminCredentials.username}
                onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={adminCredentials.password}
                  onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
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
          
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600 text-center">
              <strong>Credenziali Demo:</strong><br />
              Username: admin<br />
              Password: admin123
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
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition duration-200"
            >
              Logout
            </button>
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

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
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
            {activeTab === 'elections' && (
              <ElectionsTab
                elections={elections}
                onEdit={setEditingElection}
                onDelete={handleDeleteElection}
                onSave={handleSaveElection}
                editingElection={editingElection}
                setEditingElection={setEditingElection}
              />
            )}
            
            {activeTab === 'candidates' && (
              <CandidatesTab
                candidates={candidates}
                elections={elections}
                onEdit={setEditingCandidate}
                onDelete={handleDeleteCandidate}
                onSave={handleSaveCandidate}
                editingCandidate={editingCandidate}
                setEditingCandidate={setEditingCandidate}
              />
            )}
            
            {activeTab === 'whitelist' && (
              <WhitelistTab
                whitelist={whitelist}
                onEdit={setEditingWhitelistUser}
                onDelete={handleDeleteWhitelistUser}
                onSave={handleSaveWhitelistUser}
                editingWhitelistUser={editingWhitelistUser}
                setEditingWhitelistUser={setEditingWhitelistUser}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Elections Tab Component
const ElectionsTab = ({ elections, onEdit, onDelete, onSave, editingElection, setEditingElection }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'draft'
  });

  useEffect(() => {
    if (editingElection) {
      setFormData(editingElection);
    } else {
      setFormData({ title: '', description: '', startDate: '', endDate: '', status: 'draft' });
    }
  }, [editingElection]);

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.startDate || !formData.endDate) {
      alert('Compila tutti i campi richiesti');
      return;
    }
    onSave(formData);
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Gestione Elezioni</h2>
        <button
          onClick={() => setEditingElection({})}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuova Elezione
        </button>
      </div>

      {editingElection !== null && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-4">
            {editingElection?.id ? 'Modifica Elezione' : 'Nuova Elezione'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Inizio</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fine</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Bozza</option>
                <option value="scheduled">Programmata</option>
                <option value="active">Attiva</option>
                <option value="completed">Completata</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingElection(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Elezione</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periodo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voti</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {elections.map((election) => (
              <tr key={election.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{election.title}</div>
                    <div className="text-sm text-gray-500">{election.description}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {new Date(election.startDate).toLocaleDateString('it-IT')} - {new Date(election.endDate).toLocaleDateString('it-IT')}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(election.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{election.totalVotes}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onEdit(election)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(election.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Candidates Tab Component
const CandidatesTab = ({ candidates, elections, onEdit, onDelete, onSave, editingCandidate, setEditingCandidate }) => {
  const [formData, setFormData] = useState({
    electionId: '',
    name: '',
    party: '',
    bio: ''
  });

  useEffect(() => {
    if (editingCandidate) {
      setFormData(editingCandidate);
    } else {
      setFormData({ electionId: '', name: '', party: '', bio: '' });
    }
  }, [editingCandidate]);

  const handleSubmit = () => {
    if (!formData.electionId || !formData.name || !formData.party) {
      alert('Compila tutti i campi richiesti');
      return;
    }
    onSave(formData);
  };

  const getElectionTitle = (electionId) => {
    const election = elections.find(e => e.id === electionId);
    return election ? election.title : 'Elezione non trovata';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Gestione Candidati</h2>
        <button
          onClick={() => setEditingCandidate({})}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Candidato
        </button>
      </div>

      {editingCandidate !== null && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-4">
            {editingCandidate?.id ? 'Modifica Candidato' : 'Nuovo Candidato'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Elezione</label>
              <select
                value={formData.electionId}
                onChange={(e) => setFormData({...formData, electionId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleziona elezione</option>
                {elections.map(election => (
                  <option key={election.id} value={election.id}>{election.title}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Candidato</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partito/Lista</label>
              <input
                type="text"
                value={formData.party}
                onChange={(e) => setFormData({...formData, party: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Biografia</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="md:col-span-2 flex justify-end space-x-2">
              <button
                onClick={() => setEditingCandidate(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Elezione</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partito</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voti</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                    <div className="text-sm text-gray-500">{candidate.bio}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getElectionTitle(candidate.electionId)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.party}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{candidate.votes}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onEdit(candidate)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(candidate.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Whitelist Tab Component
const WhitelistTab = ({ whitelist, onEdit, onDelete, onSave, editingWhitelistUser, setEditingWhitelistUser }) => {
  const [formData, setFormData] = useState({
    email: '',
    taxCode: '',
    firstName: '',
    lastName: '',
    status: 'active'
  });

  useEffect(() => {
    if (editingWhitelistUser) {
      setFormData(editingWhitelistUser);
    } else {
      setFormData({ email: '', taxCode: '', firstName: '', lastName: '', status: 'active' });
    }
  }, [editingWhitelistUser]);

  const handleSubmit = () => {
    if (!formData.email || !formData.taxCode || !formData.firstName || !formData.lastName) {
      alert('Compila tutti i campi richiesti');
      return;
    }
    onSave(formData);
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-900">Gestione Whitelist</h2>
        <button
          onClick={() => setEditingWhitelistUser({})}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition duration-200 flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuovo Utente
        </button>
      </div>

      {editingWhitelistUser !== null && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <h3 className="text-md font-medium text-gray-900 mb-4">
            {editingWhitelistUser?.id ? 'Modifica Utente' : 'Nuovo Utente Whitelist'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
              <input
                type="text"
                value={formData.taxCode}
                onChange={(e) => setFormData({...formData, taxCode: e.target.value.toUpperCase()})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Attivo</option>
                <option value="inactive">Inattivo</option>
                <option value="pending">In attesa</option>
              </select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setEditingWhitelistUser(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Annulla
              </button>
              <button
                onClick={handleSubmit}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Codice Fiscale</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {whitelist.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">{user.taxCode}</td>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user.status)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => onEdit(user)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(user.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
EOF

echo "✅ Componente AdminDashboard completo creato!"