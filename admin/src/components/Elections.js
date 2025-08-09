import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  Square, 
  Eye, 
  Edit2, 
  BarChart3,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCcw
} from 'lucide-react';
import { electionsAPI } from '../services/api';
import { formatDate, formatNumber, getStatusColor } from '../utils/formatters';
import { ELECTION_STATUSES } from '../utils/constants';

const Elections = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  // Form per nuova elezione
  const [newElection, setNewElection] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    options: [
      { name: '', party: '' },
      { name: '', party: '' }
    ],
    settings: {
      allowMultipleVotes: false,
      requireVerification: true,
      anonymityLevel: 'high'
    }
  });

  // Carica elezioni all'avvio
  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      setLoading(true);
      const response = await electionsAPI.getElections(statusFilter);
      setElections(response.elections || []);
    } catch (error) {
      console.error('Errore caricamento elezioni:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateElection = async (e) => {
    e.preventDefault();
    
    try {
      const response = await electionsAPI.createElection(newElection);
      setElections([response.election, ...elections]);
      setShowCreateForm(false);
      
      // Reset form
      setNewElection({
        title: '',
        description: '',
        startDate: '',
        endDate: '',
        options: [
          { name: '', party: '' },
          { name: '', party: '' }
        ],
        settings: {
          allowMultipleVotes: false,
          requireVerification: true,
          anonymityLevel: 'high'
        }
      });
    } catch (error) {
      alert('Errore creazione elezione: ' + error.message);
    }
  };

  const handleStartElection = async (electionId) => {
    if (!window.confirm('Sei sicuro di voler avviare questa elezione?')) {
      return;
    }

    try {
      await electionsAPI.startElection(electionId);
      await loadElections(); // Ricarica lista
    } catch (error) {
      alert('Errore avvio elezione: ' + error.message);
    }
  };

  const handleEndElection = async (electionId) => {
    if (!window.confirm('Sei sicuro di voler terminare questa elezione? Questa azione è irreversibile.')) {
      return;
    }

    try {
      await electionsAPI.endElection(electionId);
      await loadElections(); // Ricarica lista
    } catch (error) {
      alert('Errore termine elezione: ' + error.message);
    }
  };

  const addOption = () => {
    setNewElection(prev => ({
      ...prev,
      options: [...prev.options, { name: '', party: '' }]
    }));
  };

  const removeOption = (index) => {
    if (newElection.options.length <= 2) return; // Minimo 2 opzioni
    
    setNewElection(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index, field, value) => {
    setNewElection(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <Play className="text-green-500" size={16} />;
      case 'completed':
        return <CheckCircle className="text-blue-500" size={16} />;
      case 'draft':
        return <Edit2 className="text-yellow-500" size={16} />;
      case 'cancelled':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <AlertCircle className="text-gray-500" size={16} />;
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Gestione Elezioni</h2>
          <div className="animate-pulse bg-gray-200 h-10 w-40 rounded"></div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-200 h-32 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestione Elezioni</h2>
          <p className="text-gray-600">{elections.length} elezioni totali</p>
        </div>
        
        <div className="flex space-x-3">
          {/* Filtro Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutte</option>
            <option value="draft">Bozze</option>
            <option value="active">Attive</option>
            <option value="completed">Completate</option>
          </select>
          
          {/* Pulsante Refresh */}
          <button
            onClick={loadElections}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCcw size={16} />
            <span>Aggiorna</span>
          </button>
          
          {/* Pulsante Crea */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            <span>Nuova Elezione</span>
          </button>
        </div>
      </div>

      {/* Lista Elezioni */}
      <div className="grid gap-4">
        {elections.map(election => (
          <div key={election.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  {getStatusIcon(election.status)}
                  <h3 className="text-lg font-semibold text-gray-800">{election.title}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(election.status)}`}>
                    {election.status.toUpperCase()}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4">{election.description}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock size={14} className="text-gray-400" />
                    <div>
                      <div className="text-gray-500">Inizio</div>
                      <div className="font-medium">{formatDate(election.startDate)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Clock size={14} className="text-gray-400" />
                    <div>
                      <div className="text-gray-500">Fine</div>
                      <div className="font-medium">{formatDate(election.endDate)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <BarChart3 size={14} className="text-gray-400" />
                    <div>
                      <div className="text-gray-500">Voti</div>
                      <div className="font-medium text-green-600">{formatNumber(election.voteCount || 0)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Users size={14} className="text-gray-400" />
                    <div>
                      <div className="text-gray-500">Candidati</div>
                      <div className="font-medium">{election.options?.length || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Azioni */}
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => setSelectedElection(election)}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Visualizza dettagli"
                >
                  <Eye size={16} />
                </button>
                
                {election.status === 'draft' && (
                  <button
                    onClick={() => handleStartElection(election.id)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Avvia elezione"
                  >
                    <Play size={16} />
                  </button>
                )}
                
                {election.status === 'active' && (
                  <button
                    onClick={() => handleEndElection(election.id)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Termina elezione"
                  >
                    <Square size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {elections.length === 0 && (
        <div className="text-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna elezione trovata</h3>
          <p className="text-gray-600 mb-4">Inizia creando la tua prima elezione.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Crea Elezione
          </button>
        </div>
      )}

      {/* Modal Creazione Elezione */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Crea Nuova Elezione</h3>
              
              <form onSubmit={handleCreateElection} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Titolo</label>
                  <input
                    type="text"
                    value={newElection.title}
                    onChange={(e) => setNewElection(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                  <textarea
                    value={newElection.description}
                    onChange={(e) => setNewElection(prev => ({ ...prev, description: e.target.value }))}
                    rows="3"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio</label>
                    <input
                      type="datetime-local"
                      value={newElection.startDate}
                      onChange={(e) => setNewElection(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
                    <input
                      type="datetime-local"
                      value={newElection.endDate}
                      onChange={(e) => setNewElection(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                {/* Candidati/Opzioni */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-medium text-gray-700">Candidati/Opzioni</label>
                    <button
                      type="button"
                      onClick={addOption}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      + Aggiungi Opzione
                    </button>
                  </div>
                  
                  {newElection.options.map((option, index) => (
                    <div key={index} className="flex space-x-3 mb-3">
                      <input
                        type="text"
                        placeholder="Nome candidato"
                        value={option.name}
                        onChange={(e) => updateOption(index, 'name', e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Partito/Lista"
                        value={option.party}
                        onChange={(e) => updateOption(index, 'party', e.target.value)}
                        className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {newElection.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Impostazioni */}
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Impostazioni</label>
                  
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newElection.settings.requireVerification}
                        onChange={(e) => setNewElection(prev => ({
                          ...prev,
                          settings: { ...prev.settings, requireVerification: e.target.checked }
                        }))}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm">Richiedi verifica identità</span>
                    </label>
                    
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Livello di anonimato</label>
                      <select
                        value={newElection.settings.anonymityLevel}
                        onChange={(e) => setNewElection(prev => ({
                          ...prev,
                          settings: { ...prev.settings, anonymityLevel: e.target.value }
                        }))}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="high">Alto</option>
                        <option value="medium">Medio</option>
                        <option value="low">Basso</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Crea Elezione
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli Elezione */}
      {selectedElection && (
        <ElectionDetailsModal 
          election={selectedElection} 
          onClose={() => setSelectedElection(null)} 
        />
      )}
    </div>
  );
};

// Componente modale per dettagli elezione
const ElectionDetailsModal = ({ election, onClose }) => {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [election.id]);

  const loadResults = async () => {
    try {
      const response = await electionsAPI.getResults(election.id);
      setResults(response.results);
    } catch (error) {
      console.error('Errore caricamento risultati:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">{election.title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Info Elezione */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">Informazioni Elezione</h4>
              
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${getStatusColor(election.status)}`}>
                    {election.status.toUpperCase()}
                  </span>
                </div>
                <div><span className="font-medium">Inizio:</span> {formatDate(election.startDate)}</div>
                <div><span className="font-medium">Fine:</span> {formatDate(election.endDate)}</div>
                <div><span className="font-medium">Voti totali:</span> {formatNumber(election.voteCount || 0)}</div>
              </div>
              
              <div>
                <h5 className="font-medium mb-2">Candidati</h5>
                <div className="space-y-1">
                  {election.options?.map(option => (
                    <div key={option.id} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="font-medium">{option.name}</div>
                      {option.party && <div className="text-gray-600">{option.party}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Risultati */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800">Risultati</h4>
              
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse bg-gray-200 h-16 rounded"></div>
                  ))}
                </div>
              ) : results ? (
                <div className="space-y-3">
                  {results.results?.map(result => (
                    <div key={result.candidateId} className="p-3 border border-gray-200 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">{result.candidateName}</div>
                        <div className="text-lg font-bold text-blue-600">
                          {formatNumber(result.votes)} ({result.percentage}%)
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${result.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Nessun risultato disponibile</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Elections;