import React, { useState, useEffect } from 'react';
import { 
  Users as UsersIcon,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  RefreshCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { usersAPI } from '../services/api';
import { formatDate, formatNumber, getStatusColor } from '../utils/formatters';
import { USER_STATUSES } from '../utils/constants';

const Users = () => {
  // Stati principali
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'whitelist'
  const [users, setUsers] = useState([]);
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Stati modali
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form stati
  const [newWhitelistUser, setNewWhitelistUser] = useState({
    email: '',
    taxCode: '',
    firstName: '',
    lastName: ''
  });

  // Carica dati all'avvio
  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else {
      loadWhitelist();
    }
  }, [activeTab, currentPage, statusFilter]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (activeTab === 'users') {
        loadUsers();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // ==========================================
  // API CALLS
  // ==========================================
  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getUsers(currentPage, 20, statusFilter, searchTerm);
      setUsers(response.users || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (error) {
      console.error('Errore caricamento utenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWhitelist = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getWhitelist();
      setWhitelist(response.whitelist || []);
    } catch (error) {
      console.error('Errore caricamento whitelist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Sei sicuro di voler cambiare lo status a ${newStatus}?`)) {
      return;
    }

    try {
      await usersAPI.updateUserStatus(userId, newStatus);
      await loadUsers(); // Ricarica lista
    } catch (error) {
      alert('Errore aggiornamento status: ' + error.message);
    }
  };

  const handleAddToWhitelist = async (e) => {
    e.preventDefault();
    
    try {
      await usersAPI.addToWhitelist(newWhitelistUser);
      setShowAddUser(false);
      setNewWhitelistUser({
        email: '',
        taxCode: '',
        firstName: '',
        lastName: ''
      });
      if (activeTab === 'whitelist') {
        await loadWhitelist();
      }
    } catch (error) {
      alert('Errore aggiunta whitelist: ' + error.message);
    }
  };

  const handleRemoveFromWhitelist = async (email) => {
    if (!window.confirm(`Sei sicuro di voler rimuovere ${email} dalla whitelist?`)) {
      return;
    }

    try {
      await usersAPI.removeFromWhitelist(email);
      await loadWhitelist();
    } catch (error) {
      alert('Errore rimozione whitelist: ' + error.message);
    }
  };

  // ==========================================
  // COMPONENTI UI
  // ==========================================
  const StatusBadge = ({ status }) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {status.toUpperCase()}
    </span>
  );

  const UserCard = ({ user, onStatusChange, onViewDetails }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-gray-900">{user.firstName} {user.lastName}</h3>
            <StatusBadge status={user.status} />
          </div>
          <p className="text-gray-600 text-sm">{user.email}</p>
          {user.taxCode && (
            <p className="text-gray-500 text-xs">CF: {user.taxCode}</p>
          )}
        </div>
        
        <div className="flex space-x-1">
          <button
            onClick={() => onViewDetails(user)}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Visualizza dettagli"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-3">
        <div>
          <div>Registrato</div>
          <div className="font-medium">{formatDate(user.registeredAt)}</div>
        </div>
        <div>
          <div>Ultimo accesso</div>
          <div className="font-medium">{formatDate(user.lastLogin)}</div>
        </div>
      </div>
      
      {user.status === 'active' && (
        <div className="flex space-x-2">
          <button
            onClick={() => onStatusChange(user.id, 'suspended')}
            className="flex-1 px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
          >
            Sospendi
          </button>
          <button
            onClick={() => onStatusChange(user.id, 'inactive')}
            className="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Disattiva
          </button>
        </div>
      )}
      
      {user.status === 'suspended' && (
        <button
          onClick={() => onStatusChange(user.id, 'active')}
          className="w-full px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
        >
          Riattiva
        </button>
      )}
    </div>
  );

  const WhitelistCard = ({ entry, onRemove }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-semibold text-gray-900">{entry.firstName} {entry.lastName}</h3>
            {entry.isAuthorized ? (
              <CheckCircle className="text-green-500" size={16} />
            ) : (
              <XCircle className="text-red-500" size={16} />
            )}
          </div>
          <p className="text-gray-600 text-sm">{entry.email}</p>
          <p className="text-gray-500 text-xs">CF: {entry.taxCode}</p>
        </div>
        
        <button
          onClick={() => onRemove(entry.email)}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Rimuovi da whitelist"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="text-xs text-gray-500">
        <div>Aggiunto il {formatDate(entry.addedAt)}</div>
        {entry.addedBy && <div>da {entry.addedBy}</div>}
      </div>
    </div>
  );

  // Loading state
  if (loading && users.length === 0 && whitelist.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestione Utenti</h2>
          <p className="text-gray-600">
            {activeTab === 'users' 
              ? `${users.length} utenti registrati`
              : `${whitelist.length} utenti in whitelist`
            }
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => activeTab === 'users' ? loadUsers() : loadWhitelist()}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Aggiorna</span>
          </button>
          
          {activeTab === 'whitelist' && (
            <button
              onClick={() => setShowAddUser(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'users'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <UsersIcon size={16} />
          <span>Utenti Registrati</span>
        </button>
        
        <button
          onClick={() => setActiveTab('whitelist')}
          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
            activeTab === 'whitelist'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <UserCheck size={16} />
          <span>Whitelist Elettori</span>
        </button>
      </div>

      {/* Filtri e Ricerca */}
      <div className="flex flex-wrap gap-4">
        {activeTab === 'users' && (
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cerca per email, nome, codice fiscale..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        
        {activeTab === 'users' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tutti gli status</option>
            <option value="active">Attivi</option>
            <option value="suspended">Sospesi</option>
            <option value="inactive">Inattivi</option>
          </select>
        )}
      </div>

      {/* Contenuto principale */}
      {activeTab === 'users' ? (
        <div className="space-y-4">
          {/* Lista Utenti */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {users.map(user => (
              <UserCard
                key={user.id}
                user={user}
                onStatusChange={handleUserStatusChange}
                onViewDetails={setSelectedUser}
              />
            ))}
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-6">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Precedente
              </button>
              
              <span className="px-3 py-2">
                Pagina {currentPage} di {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Successiva
              </button>
            </div>
          )}

          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <UsersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
              <p className="text-gray-600">Nessun utente corrisponde ai criteri di ricerca.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lista Whitelist */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {whitelist.map(entry => (
              <WhitelistCard
                key={entry.email}
                entry={entry}
                onRemove={handleRemoveFromWhitelist}
              />
            ))}
          </div>

          {whitelist.length === 0 && !loading && (
            <div className="text-center py-12">
              <UserCheck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Whitelist vuota</h3>
              <p className="text-gray-600 mb-4">Aggiungi elettori autorizzati alla whitelist.</p>
              <button
                onClick={() => setShowAddUser(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aggiungi Primo Utente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Aggiungi Utente Whitelist */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Aggiungi alla Whitelist</h3>
              
              <form onSubmit={handleAddToWhitelist} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newWhitelistUser.email}
                    onChange={(e) => setNewWhitelistUser(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                  <input
                    type="text"
                    value={newWhitelistUser.taxCode}
                    onChange={(e) => setNewWhitelistUser(prev => ({ ...prev, taxCode: e.target.value.toUpperCase() }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    maxLength="16"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                    <input
                      type="text"
                      value={newWhitelistUser.firstName}
                      onChange={(e) => setNewWhitelistUser(prev => ({ ...prev, firstName: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cognome</label>
                    <input
                      type="text"
                      value={newWhitelistUser.lastName}
                      onChange={(e) => setNewWhitelistUser(prev => ({ ...prev, lastName: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddUser(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Aggiungi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli Utente */}
      {selectedUser && (
        <UserDetailsModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
          onStatusChange={handleUserStatusChange}
        />
      )}
    </div>
  );
};

// Componente modale dettagli utente
const UserDetailsModal = ({ user, onClose, onStatusChange }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Dettagli Utente</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-6">
            {/* Info Personali */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Informazioni Personali</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Nome:</span>
                  <div>{user.firstName} {user.lastName}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Email:</span>
                  <div>{user.email}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Codice Fiscale:</span>
                  <div>{user.taxCode || 'N/A'}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Status:</span>
                  <div><StatusBadge status={user.status} /></div>
                </div>
              </div>
            </div>
            
            {/* Info Account */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Informazioni Account</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Registrato il:</span>
                  <div>{formatDate(user.registeredAt)}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Ultimo accesso:</span>
                  <div>{formatDate(user.lastLogin)}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Login totali:</span>
                  <div>{formatNumber(user.loginCount || 0)}</div>
                </div>
              </div>
            </div>
            
            {/* Azioni */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              {user.status === 'active' && (
                <>
                  <button
                    onClick={() => {
                      onStatusChange(user.id, 'suspended');
                      onClose();
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Sospendi
                  </button>
                  <button
                    onClick={() => {
                      onStatusChange(user.id, 'inactive');
                      onClose();
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Disattiva
                  </button>
                </>
              )}
              
              {user.status !== 'active' && (
                <button
                  onClick={() => {
                    onStatusChange(user.id, 'active');
                    onClose();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Riattiva
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
    {status.toUpperCase()}
  </span>
);

export default Users;