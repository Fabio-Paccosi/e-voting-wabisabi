import React, { useState, useEffect } from 'react';
import { Calendar, Users, Vote, Settings, Plus, Edit2, Trash2, Eye, Download, Upload, Check, X, AlertCircle, Bitcoin, Key, UserPlus, Shield, Activity, RefreshCw, Search, Mail, Phone, FileText, UserCheck } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/admin';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('elections');
  const [elections, setElections] = useState([]);
  const [users, setUsers] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [whitelist, setWhitelist] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedElection, setSelectedElection] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);

  // Form states
  const [electionForm, setElectionForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    coinjoinTrigger: 10,
    coinjoinEnabled: true,
    maxVotersAllowed: '',
    votingMethod: 'single',
    blockchainNetwork: 'testnet'
  });

  const [candidateForm, setCandidateForm] = useState({
    nome: '',
    cognome: '',
    party: '',
    biography: ''
  });

  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    taxCode: '',
    dateOfBirth: '',
    phoneNumber: '',
    address: {
      street: '',
      city: '',
      zip: '',
      province: ''
    }
  });

  const [resultsData, setResultsData] = useState({
    results: [],
    election: null,
    statistics: null,
    loading: false,
    error: null
  });

  // API Calls
  const fetchElections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/elections`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Errore nel caricamento delle elezioni');
      
      const data = await response.json();
      setElections(data.elections || []);
      
      // Carica candidati e whitelist per ogni elezione
      for (const election of data.elections || []) {
        await fetchCandidates(election.id);
        await fetchWhitelist(election.id);
      }
    } catch (err) {
      setError(err.message);
      console.error('Errore fetch elezioni:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async (electionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Errore nel caricamento dei candidati');
      
      const data = await response.json();
      console.log(data)
      setCandidates(prev => ({
        ...prev,
        [electionId]: data.election.candidates || []
      }));
    } catch (err) {
      console.error('Errore fetch candidati:', err);
    }
  };

  const fetchWhitelist = async (electionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}/whitelist`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Errore nel caricamento della whitelist');
      
      const data = await response.json();
      setWhitelist(prev => ({
        ...prev,
        [electionId]: data.whitelist || []
      }));
    } catch (err) {
      console.error('Errore fetch whitelist:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users?limit=100`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Errore nel caricamento degli utenti');
      
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
      console.error('Errore fetch utenti:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
    fetchUsers();
  }, []);

  const handleCreateElection = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/elections`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(electionForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella creazione dell\'elezione');
      }
      
      const data = await response.json();
      setSuccess('Elezione creata con successo!');
      await fetchElections();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCandidate = async () => {
    if (!selectedElection) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/elections/${selectedElection.id}/candidates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(candidateForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'aggiunta del candidato');
      }
      
      const data = await response.json();
      setSuccess(`Candidato aggiunto con indirizzo Bitcoin: ${data.candidate.bitcoinAddress}`);
      await fetchCandidates(selectedElection.id);
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWhitelist = async () => {
    if (!selectedElection || selectedUsers.length === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/elections/${selectedElection.id}/whitelist/add`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: selectedUsers
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'aggiunta alla whitelist');
      }
      
      const data = await response.json();
      setSuccess(data.message);
      await fetchWhitelist(selectedElection.id);
      setSelectedUsers([]);
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFromWhitelist = async (electionId, userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}/whitelist/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) throw new Error('Errore nella rimozione dalla whitelist');
      
      setSuccess('Utente rimosso dalla whitelist');
      await fetchWhitelist(electionId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userForm)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nella creazione dell\'utente');
      }
      
      setSuccess('Utente creato con successo!');
      await fetchUsers();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activateElection = async (electionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'attivazione');
      }
      
      setSuccess('Elezione attivata con successo!');
      await fetchElections();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deactivateElection = async (electionId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}/deactivate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'attivazione');
      }
      
      setSuccess('Elezione terminata con successo!');
      await fetchElections();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showResults = async (electionId) => {
    try {
      // Apri il modal e imposta lo stato di loading
      setModalType('showResults');
      setShowModal(true);
      setResultsData(prev => ({
        ...prev,
        loading: true,
        error: null,
        results: [],
        election: null,
        statistics: null
      }));
  
      // Carica i risultati dell'elezione
      const response = await fetch(`${API_BASE_URL}/elections/${electionId}/results`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel caricamento dei risultati');
      }
  
      const data = await response.json();
      
      setResultsData({
        results: data.results || [],
        election: data.election || null,
        statistics: data.statistics || null,
        loading: false,
        error: null
      });
  
    } catch (err) {
      console.error('Errore caricamento risultati:', err);
      setResultsData(prev => ({
        ...prev,
        loading: false,
        error: err.message
      }));
    }
  };
  
  // Funzioni helper per i calcoli dei risultati
  const getTotalVotes = (results) => {
    return results.reduce((total, candidate) => {
      const votes = candidate.totalVotesReceived || candidate.votes || 0;
      return total + votes;
    }, 0);
  };
  
  const getWinner = (results) => {
    if (results.length === 0) return null;
    return results.reduce((winner, candidate) => {
      const candidateVotes = candidate.totalVotesReceived || candidate.votes || 0;
      const winnerVotes = winner.totalVotesReceived || winner.votes || 0;
      return candidateVotes > winnerVotes ? candidate : winner;
    });
  };
  
  const formatPercentage = (votes, total) => {
    if (total === 0) return '0%';
    return `${((votes / total) * 100).toFixed(1)}%`;
  };
  
  // Aggiungi questo componente per il modal dei risultati all'interno del render
  const renderResultsModal = () => {
    if (modalType !== 'showResults') return null;
  
    const { results, election, statistics, loading, error } = resultsData;
    const totalVotes = getTotalVotes(results);
    const winner = getWinner(results);
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800">
                {election ? `Risultati: ${election.title}` : 'Risultati Elezione'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
  
            {loading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3">Caricamento risultati...</span>
              </div>
            )}
  
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                <div className="flex items-center">
                  <AlertCircle className="mr-2" size={20} />
                  {error}
                </div>
              </div>
            )}
  
            {!loading && !error && election && (
              <>
                {/* Info Elezione e Statistiche */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {/* Info Elezione */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Informazioni Elezione</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID Elezione:</span>
                        <span className="font-medium">{election.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Stato:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          election.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          election.status === 'active' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {election.status === 'completed' ? 'Completata' :
                           election.status === 'active' ? 'Attiva' : election.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Inizio:</span>
                        <span className="font-medium">
                          {new Date(election.startDate).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fine:</span>
                        <span className="font-medium">
                          {new Date(election.endDate).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>
                  </div>
  
                  {/* Statistiche */}
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Statistiche Generali</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 flex items-center">
                          <Vote className="mr-2" size={16} />
                          Voti Totali:
                        </span>
                        <span className="text-2xl font-bold text-blue-600">{totalVotes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 flex items-center">
                          <Users className="mr-2" size={16} />
                          Candidati:
                        </span>
                        <span className="font-medium">{results.length}</span>
                      </div>
                      {winner && (
                        <div className="pt-3 border-t border-blue-200">
                          <div className="text-gray-600 mb-2">🏆 Vincitore:</div>
                          <div className="font-bold text-green-600">
                            {winner.firstName} {winner.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            {(winner.totalVotesReceived || winner.votes || 0)} voti 
                            ({formatPercentage(winner.totalVotesReceived || winner.votes || 0, totalVotes)})
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  
                {/* Risultati Dettagliati */}
                {results.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                      <h4 className="text-lg font-semibold text-gray-800">Risultati Dettagliati</h4>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Posizione
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Candidato
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Partito
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Voti
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Percentuale
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Indirizzo Bitcoin
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {results
                            .sort((a, b) => {
                              const aVotes = a.totalVotesReceived || a.votes || 0;
                              const bVotes = b.totalVotesReceived || b.votes || 0;
                              return bVotes - aVotes;
                            })
                            .map((candidate, index) => {
                              const votes = candidate.totalVotesReceived || candidate.votes || 0;
                              const isWinner = index === 0 && votes > 0;
                              
                              return (
                                <tr key={candidate.id || index} className={isWinner ? 'bg-green-50' : ''}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      {isWinner && <span className="text-yellow-500 mr-2">🏆</span>}
                                      <span className={`text-sm font-medium ${isWinner ? 'text-green-600' : 'text-gray-900'}`}>
                                        #{index + 1}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                      {candidate.firstName} {candidate.lastName}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                      {candidate.party || 'Indipendente'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900">{votes}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="text-sm font-medium text-gray-900 mr-2">
                                        {formatPercentage(votes, totalVotes)}
                                      </div>
                                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-20">
                                        <div 
                                          className={`h-2 rounded-full ${isWinner ? 'bg-green-500' : 'bg-blue-500'}`}
                                          style={{ width: `${totalVotes > 0 ? (votes / totalVotes) * 100 : 0}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-xs font-mono text-gray-500 max-w-32 truncate" title={candidate.bitcoinAddress}>
                                      {candidate.bitcoinAddress || 'N/A'}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
  
                {/* Azioni */}
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Chiudi
                  </button>
                </div>
              </>
            )}
  
            {!loading && !error && !election && (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-2">Nessun dato disponibile</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openModal = (type, data = null) => {
    setModalType(type);
    setShowModal(true);
    setError(null);
    setSuccess(null);
    
    if (data) {
      if (type === 'editElection') {
        setElectionForm(data);
        setSelectedElection(data);
      } else if (type === 'manageWhitelist' || type === 'addCandidate') {
        setSelectedElection(data);
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedElection(null);
    setSelectedUsers([]);
    setSearchTerm('');
    
    // Reset forms
    setElectionForm({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      coinjoinTrigger: 10,
      coinjoinEnabled: true,
      maxVotersAllowed: '',
      votingMethod: 'single',
      blockchainNetwork: 'testnet'
    });
    
    setCandidateForm({
      nome: '',
      cognome: '',
      party: '',
      biography: ''
    });
    
    setUserForm({
      firstName: '',
      lastName: '',
      email: '',
      taxCode: '',
      dateOfBirth: '',
      phoneNumber: '',
      address: {
        street: '',
        city: '',
        zip: '',
        province: ''
      }
    });
  };

  const validateTaxCode = (code) => {
    const regex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i;
    return regex.test(code);
  };

  const filteredUsers = users.filter(user => 
    user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.taxCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderElectionsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestione Elezioni</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchElections()}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="mr-2" size={20} />
            Aggiorna
          </button>
          <button
            onClick={() => openModal('createElection')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="mr-2" size={20} />
            Nuova Elezione
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="mr-2" size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
          <Check className="mr-2" size={20} />
          {success}
        </div>
      )}

      {loading && !elections.length ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid gap-6">
          {elections.map(election => (
            <div key={election.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">{election.title}</h3>
                  <h4 className="text-xs font-normal text-gray-400">ID elezione: {election.id}</h4>
                  <p className="text-gray-600 mt-1">{election.description}</p>
                  <div className="flex items-center mt-2 space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <Calendar size={16} className="mr-1" />
                      {new Date(election.startDate).toLocaleDateString()} - {new Date(election.endDate).toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      election.status === 'active' ? 'bg-green-100 text-green-800' :
                      election.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      election.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {
                        election.status === 'active' ? 'In corso...' :
                        election.status === 'draft' ? 'Bozza' :
                        election.status === 'completed' ? 'Terminata' :
                        'Sconosciuto'
                      }
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {election.status === 'draft' && (
                    <button
                      onClick={() => activateElection(election.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      disabled={loading}
                    >
                      Attiva
                    </button>
                  )}
                  {
                    election.status === 'active' && (
                      <button
                        onClick={() => deactivateElection(election.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        disabled={loading}
                      >
                        Termina
                      </button>
                  )}
                  {
                    election.status === 'completed' && (
                      <button
                        onClick={() => showResults(election.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                        disabled={loading}
                      >
                        Vedi risultati
                      </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">Candidati</span>
                    {election.status === 'draft' && (
                      <button
                        onClick={() => openModal('addCandidate', election)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {candidates[election.id]?.length || 0}
                  </p>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm">Whitelist</span>
                    {election.status === 'draft' && (
                      <button
                        onClick={() => openModal('manageWhitelist', election)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <UserPlus size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {whitelist[election.id]?.length || 0}
                  </p>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Bitcoin size={16} className="text-orange-500 mr-2" />
                    <span className="text-gray-600 text-sm">Trigger</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {election.coinjoinTrigger}
                  </p>
                </div>
                
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center">
                    <Shield size={16} className="text-green-500 mr-2" />
                    <span className="text-gray-600 text-sm">Network</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 mt-1">
                    {election.blockchainNetwork}
                  </p>
                </div>
              </div>

              {candidates[election.id]?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Candidati:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {candidates[election.id].map(candidate => (
                      <div key={candidate.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">
                          {candidate.name} 
                          {candidate.party && ` (${candidate.party})`}
                        </span>
                        <div className="flex items-center">
                          <Key size={14} className="text-gray-400 mr-1" />
                          <span className="text-xs text-gray-500 font-mono">
                            {candidate.bitcoinAddress?.substring(0, 10)}...
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {whitelist[election.id]?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Whitelist ({whitelist[election.id].length} utenti autorizzati):
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {whitelist[election.id].slice(0, 5).map(entry => (
                      <span key={entry.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {entry.user?.firstName} {entry.user?.lastName}
                        {entry.hasVoted && <Check className="ml-1" size={12} />}
                      </span>
                    ))}
                    {whitelist[election.id].length > 5 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        +{whitelist[election.id].length - 5} altri
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUsersTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Gestione Utenti</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => openModal('createUser')}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="mr-2" size={20} />
            Nuovo Utente
          </button>
        </div>
      </div>

      {loading && !users.length ? (
        <div className="flex justify-center items-center py-12">
          <RefreshCw className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Codice Fiscale
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verificato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 font-mono">{user.taxCode}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' : 
                      user.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.isVerified ? (
                      <Check className="text-green-600" size={20} />
                    ) : (
                      <X className="text-gray-400" size={20} />
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-2">
                      <Edit2 size={16} />
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const footerStyle = {
    backgroundColor: "#1e293b",
    color: "#94a3b8",
    textAlign: "center",
    padding: "1.5rem 0"
  };
  
  const footer = () => (
      <footer style={footerStyle}>
        <div className="container">
          <h1>🗳️ E-Voting WabiSabi</h1>
          <p>Progetto di Tesi Magistrale di Fabio Paccosi</p>
        </div>
      </footer>
  )

  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {modalType === 'manageWhitelist' && selectedElection && (
              <>
                <h3 className="text-xl font-bold mb-4">
                  Gestione Whitelist - {selectedElection.title}
                </h3>
                
                <div className="space-y-6">
                  {/* Utenti già nella whitelist */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">
                      Utenti Autorizzati ({whitelist[selectedElection.id]?.length || 0})
                    </h4>
                    {whitelist[selectedElection.id]?.length > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                        <div className="grid gap-2">
                          {whitelist[selectedElection.id].map(entry => (
                            <div key={entry.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                              <div className="flex items-center">
                                <UserCheck className="text-green-500 mr-3" size={20} />
                                <div>
                                  <div className="font-medium text-sm">
                                    {entry.user?.firstName} {entry.user?.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {entry.user?.email} • {entry.user?.taxCode}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {entry.hasVoted && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                    Ha votato
                                  </span>
                                )}
                                {!entry.hasVoted && (
                                  <button
                                    onClick={() => handleRemoveFromWhitelist(selectedElection.id, entry.userId)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <X size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
                        Nessun utente autorizzato per questa elezione
                      </div>
                    )}
                  </div>

                  {/* Aggiungi nuovi utenti */}
                  <div>
                    <h4 className="text-lg font-semibold mb-3">Aggiungi Utenti alla Whitelist</h4>
                    
                    {/* Barra di ricerca */}
                    <div className="mb-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Cerca per nome, email o codice fiscale..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Lista utenti disponibili */}
                    <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto">
                      <div className="grid gap-2">
                        {filteredUsers
                          .filter(user => {
                            // Escludi utenti già nella whitelist
                            const alreadyInWhitelist = whitelist[selectedElection.id]?.some(
                              entry => entry.userId === user.id
                            );
                            return !alreadyInWhitelist;
                          })
                          .map(user => (
                            <div key={user.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(user.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUsers([...selectedUsers, user.id]);
                                    } else {
                                      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                    }
                                  }}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                                />
                                <div>
                                  <div className="font-medium text-sm">
                                    {user.firstName} {user.lastName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 font-mono">
                                  {user.taxCode}
                                </span>
                                {user.isVerified && (
                                  <Check className="text-green-500" size={16} />
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                      {filteredUsers.filter(user => 
                        !whitelist[selectedElection.id]?.some(entry => entry.userId === user.id)
                      ).length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          {searchTerm ? 'Nessun utente trovato' : 'Tutti gli utenti sono già autorizzati'}
                        </div>
                      )}
                    </div>

                    {/* Selezione multipla info */}
                    {selectedUsers.length > 0 && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-blue-800">
                            {selectedUsers.length} utenti selezionati
                          </span>
                          <button
                            onClick={() => setSelectedUsers([])}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Deseleziona tutti
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {modalType === 'createElection' && (
              <>
                <h3 className="text-xl font-bold mb-4">Crea Nuova Elezione</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Titolo *
                    </label>
                    <input
                      type="text"
                      value={electionForm.title}
                      onChange={(e) => setElectionForm({...electionForm, title: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Es. Elezione Comunale 2025"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descrizione
                    </label>
                    <textarea
                      value={electionForm.description}
                      onChange={(e) => setElectionForm({...electionForm, description: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="3"
                      placeholder="Descrizione dell'elezione..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data Inizio *
                      </label>
                      <input
                        type="datetime-local"
                        value={electionForm.startDate}
                        onChange={(e) => setElectionForm({...electionForm, startDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data Fine *
                      </label>
                      <input
                        type="datetime-local"
                        value={electionForm.endDate}
                        onChange={(e) => setElectionForm({...electionForm, endDate: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trigger CoinJoin
                      </label>
                      <input
                        type="number"
                        value={electionForm.coinjoinTrigger}
                        onChange={(e) => setElectionForm({...electionForm, coinjoinTrigger: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Votanti
                      </label>
                      <input
                        type="number"
                        value={electionForm.maxVotersAllowed}
                        onChange={(e) => setElectionForm({...electionForm, maxVotersAllowed: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Lascia vuoto per illimitato"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Metodo di Voto
                      </label>
                      <select
                        disabled
                        value={electionForm.votingMethod}
                        onChange={(e) => setElectionForm({...electionForm, votingMethod: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="single">Voto Singolo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rete Blockchain
                      </label>
                      <select
                        value={electionForm.blockchainNetwork}
                        onChange={(e) => setElectionForm({...electionForm, blockchainNetwork: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="testnet">Testnet</option>
                        <option value="mainnet">Mainnet</option>
                        <option value="regtest">Regtest</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="coinjoinEnabled"
                      checked={electionForm.coinjoinEnabled}
                      onChange={(e) => setElectionForm({...electionForm, coinjoinEnabled: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="coinjoinEnabled" className="ml-2 block text-sm text-gray-900">
                      Abilita CoinJoin automatico
                    </label>
                  </div>
                </div>
              </>
            )}

            {modalType === 'addCandidate' && (
              <>
                <h3 className="text-xl font-bold mb-4">
                  Aggiungi Candidato - {selectedElection?.title}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={candidateForm.nome}
                        onChange={(e) => setCandidateForm({...candidateForm, nome: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cognome *
                      </label>
                      <input
                        type="text"
                        value={candidateForm.cognome}
                        onChange={(e) => setCandidateForm({...candidateForm, cognome: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Partito/Lista
                    </label>
                    <input
                      type="text"
                      value={candidateForm.party}
                      onChange={(e) => setCandidateForm({...candidateForm, party: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Biografia
                    </label>
                    <textarea
                      value={candidateForm.biography}
                      onChange={(e) => setCandidateForm({...candidateForm, biography: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows="4"
                    />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Bitcoin className="text-orange-500 mr-2" size={20} />
                      <span className="text-sm font-medium text-gray-700">
                        L'indirizzo Bitcoin sarà generato automaticamente per questo candidato
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {modalType === 'createUser' && (
              <>
                <h3 className="text-xl font-bold mb-4">Crea Nuovo Utente</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={userForm.firstName}
                        onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cognome *
                      </label>
                      <input
                        type="text"
                        value={userForm.lastName}
                        onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Codice Fiscale *
                    </label>
                    <input
                      type="text"
                      value={userForm.taxCode}
                      onChange={(e) => setUserForm({...userForm, taxCode: e.target.value.toUpperCase()})}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        userForm.taxCode && !validateTaxCode(userForm.taxCode) 
                          ? 'border-red-300' 
                          : 'border-gray-300'
                      }`}
                      maxLength="16"
                      placeholder="RSSMRA85M01H501Z"
                    />
                    {userForm.taxCode && !validateTaxCode(userForm.taxCode) && (
                      <p className="mt-1 text-sm text-red-600">
                        Formato codice fiscale non valido
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data di Nascita
                      </label>
                      <input
                        type="date"
                        value={userForm.dateOfBirth}
                        onChange={(e) => setUserForm({...userForm, dateOfBirth: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Telefono
                      </label>
                      <input
                        type="tel"
                        value={userForm.phoneNumber}
                        onChange={(e) => setUserForm({...userForm, phoneNumber: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (modalType === 'createElection') handleCreateElection();
                  else if (modalType === 'addCandidate') handleAddCandidate();
                  else if (modalType === 'createUser') handleCreateUser();
                  else if (modalType === 'manageWhitelist') handleAddToWhitelist();
                }}
                disabled={loading || (modalType === 'manageWhitelist' && selectedUsers.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Elaborazione...' : 
                 modalType === 'manageWhitelist' ? `Aggiungi ${selectedUsers.length} utenti` : 
                 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Vote className="text-blue-600 mr-3" size={32} />
              <h1 className="text-2xl font-bold text-gray-900">
                E-Voting WabiSabi Admin
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('elections')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'elections'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Vote className="mr-2" size={18} />
                  Elezioni
                </div>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Users className="mr-2" size={18} />
                  Utenti
                </div>
              </button>
              <button
                onClick={() => setActiveTab('monitoring')}
                hidden={true}
                className={`py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'monitoring'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <Activity className="mr-2" size={18} />
                  Monitoraggio
                </div>
              </button>
            </nav>
          </div>
          <div className="p-6">
            {activeTab === 'elections' && renderElectionsTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'monitoring' && (
              <div className="text-center py-12">
                <Activity className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">Sistema di monitoraggio blockchain in tempo reale</p>
                <p className="text-sm text-gray-400 mt-2">CoinJoin Trigger Service attivo</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {footer()}

      {renderModal()}
      {showModal && modalType === 'showResults' && renderResultsModal()}

    </div>
  );
};

export default AdminDashboard;