// client/src/components/ElectionSelectionWithWallet.js
// Versione CSS-compatibile senza Tailwind

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Users, 
  Shield, 
  Bitcoin, 
  Lock, 
  AlertTriangle, 
  CheckCircle,
  LogOut,
  List,
  Wallet,
  Key,
  Vote
} from 'lucide-react';
import api from '../services/api';

const ElectionSelectionWithWallet = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [verifyingWallet, setVerifyingWallet] = useState(false);
  const [walletError, setWalletError] = useState('');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadElections();
  }, []);

  const loadElections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/elections/available');
      setElections(response.data.elections || []);
    } catch (err) {
      console.error('Error loading elections:', err);
      setError('Errore nel caricamento delle elezioni disponibili');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleElectionSelect = (election) => {
    setSelectedElection(election);
    setWalletAddress('');
    setWalletError('');
    setShowWalletModal(true);
  };

  const verifyWalletAndProceed = async () => {
    if (!walletAddress.trim()) {
      setWalletError('Inserisci un indirizzo wallet valido');
      return;
    }

    try {
      setVerifyingWallet(true);
      setWalletError('');

      const response = await api.post(`/elections/${selectedElection.id}/verify-wallet`, {
        walletAddress: walletAddress.trim()
      });

      if (response.data.success) {
        setShowWalletModal(false);
        navigate(`/vote/${selectedElection.id}`, {
          state: { 
            bitcoinAddress: walletAddress.trim(),
            election: selectedElection 
          }
        });
      } else {
        setWalletError(response.data.error || 'Indirizzo wallet non autorizzato per questa elezione');
      }
    } catch (err) {
      console.error('Error verifying wallet:', err);
      if (err.response?.status === 403) {
        setWalletError('Indirizzo wallet non corrispondente a quello autorizzato nella whitelist');
      } else if (err.response?.status === 404) {
        setWalletError('Non sei autorizzato per questa elezione');
      } else {
        setWalletError('Errore durante la verifica del wallet. Riprova.');
      }
    } finally {
      setVerifyingWallet(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const WalletModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '1.5rem',
        width: '100%',
        maxWidth: '28rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: 0
          }}>
            <Wallet size={20} />
            Verifica Wallet Bitcoin
          </h3>
          <button 
            onClick={() => setShowWalletModal(false)}
            disabled={verifyingWallet}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: verifyingWallet ? 'not-allowed' : 'pointer',
              padding: '0.25rem',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem'
        }}>
          <h4 style={{
            fontWeight: '600',
            color: '#1e40af',
            marginBottom: '0.25rem',
            margin: '0 0 0.25rem 0'
          }}>{selectedElection?.title}</h4>
          <p style={{
            fontSize: '0.875rem',
            color: '#3730a3',
            margin: 0
          }}>
            Periodo: {formatDate(selectedElection?.startDate)} - {formatDate(selectedElection?.endDate)}
          </p>
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginBottom: '1rem'
        }}>
          Inserisci l'indirizzo del wallet Bitcoin associato alla tua autorizzazione per questa elezione.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Indirizzo Wallet Bitcoin
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="bc1q... o tb1q... (testnet)"
            disabled={verifyingWallet}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '2px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '1rem',
              outline: 'none',
              backgroundColor: verifyingWallet ? '#f9fafb' : 'white',
              cursor: verifyingWallet ? 'not-allowed' : 'text'
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          <p style={{
            fontSize: '0.75rem',
            color: '#6b7280',
            marginTop: '0.25rem',
            margin: '0.25rem 0 0 0'
          }}>
            L'indirizzo deve corrispondere a quello autorizzato nella whitelist dell'elezione
          </p>
        </div>

        {walletError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.875rem 1rem',
            borderRadius: '8px',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626'
          }}>
            <AlertTriangle size={16} />
            <p style={{ margin: 0 }}>{walletError}</p>
          </div>
        )}

        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem'
        }}>
          <button
            onClick={() => setShowWalletModal(false)}
            disabled={verifyingWallet}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: verifyingWallet ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              opacity: verifyingWallet ? 0.6 : 1
            }}
            onMouseOver={(e) => !verifyingWallet && (e.target.style.backgroundColor = '#e5e7eb')}
            onMouseOut={(e) => !verifyingWallet && (e.target.style.backgroundColor = '#f3f4f6')}
          >
            Annulla
          </button>
          <button
            onClick={verifyWalletAndProceed}
            disabled={verifyingWallet || !walletAddress.trim()}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: (verifyingWallet || !walletAddress.trim()) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              background: (verifyingWallet || !walletAddress.trim()) ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {verifyingWallet ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  border: '2px solid transparent',
                  borderTop: '2px solid currentColor',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                Verificando...
              </>
            ) : (
              <>
                <Shield size={16} />
                Verifica e Procedi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 2rem',
        textAlign: 'center',
        minHeight: '60vh'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderLeft: '4px solid #3B82F6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }}></div>
        <p>Caricamento elezioni...</p>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem 1rem'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #e5e7eb',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '0.25rem',
            margin: '0 0 0.25rem 0'
          }}>
            Benvenuto/a, {user?.firstName} {user?.lastName}
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1rem',
            margin: 0
          }}>
            Seleziona un'elezione per esprimere il tuo voto anonimo
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => navigate('/results')} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0d875e'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            <List size={20} />
            Risultati
          </button>
          <button 
            onClick={handleLogout} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
          >
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          marginBottom: '1rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626'
        }}>
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {/* Lista Elezioni */}
      {elections.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem'
        }}>
          <Calendar size={48} style={{ color: '#9ca3af', marginBottom: '1rem' }} />
          <h3 style={{
            fontSize: '1.2rem',
            fontWeight: '600',
            color: '#374151',
            marginBottom: '0.5rem'
          }}>
            Nessuna elezione disponibile
          </h3>
          <p style={{ color: '#6b7280' }}>
            Non ci sono elezioni attive per cui sei autorizzato al momento.
          </p>
        </div>
      ) : (
        <div>
          <h3 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '1.4rem',
            fontWeight: '600',
            color: '#1e293b',
            marginBottom: '1.5rem'
          }}>
            <Vote size={24} />
            Elezioni Disponibili
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1.5rem'
          }}>
            {elections.map((election) => (
              <div
                key={election.id}
                onClick={() => handleElectionSelect(election)}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  border: '2px solid transparent',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}>
                  <h4 style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#1e293b',
                    lineHeight: '1.4',
                    margin: 0,
                    flex: 1
                  }}>
                    {election.title}
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginLeft: '1rem'
                  }}>
                    <div style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      backgroundColor: '#22c55e',
                      borderRadius: '50%'
                    }}></div>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#16a34a',
                      fontWeight: '500'
                    }}>
                      Attiva
                    </span>
                  </div>
                </div>

                {election.description && (
                  <p style={{
                    color: '#64748b',
                    fontSize: '0.95rem',
                    lineHeight: '1.5',
                    marginBottom: '1rem',
                    margin: '0 0 1rem 0'
                  }}>
                    {election.description}
                  </p>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    color: '#6b7280'
                  }}>
                    <Calendar size={16} />
                    <span>Inizio: {formatDate(election.startDate)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    color: '#6b7280'
                  }}>
                    <Calendar size={16} />
                    <span>Fine: {formatDate(election.endDate)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    color: '#6b7280'
                  }}>
                    <Users size={16} />
                    <span>{election.candidates?.length || 0} candidati</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e5e7eb',
                  marginTop: '1rem'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Bitcoin size={16} style={{ color: '#f59e0b' }} />
                    <span style={{
                      fontSize: '0.8rem',
                      color: '#6b7280'
                    }}>
                      {election.blockchainNetwork || 'testnet'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Shield size={16} style={{ color: '#22c55e' }} />
                    <Lock size={16} style={{ color: '#3b82f6' }} />
                    <Key size={16} style={{ color: '#8b5cf6' }} />
                  </div>
                </div>

                <button 
                  style={{
                    width: '100%',
                    marginTop: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    e.stopPropagation();
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                    e.stopPropagation();
                  }}
                >
                  <Wallet size={16} />
                  Accedi con Wallet
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Wallet */}
      {showWalletModal && <WalletModal />}

      {/* CSS per le animazioni */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ElectionSelectionWithWallet;