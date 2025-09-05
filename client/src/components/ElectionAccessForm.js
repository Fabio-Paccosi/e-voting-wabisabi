// Componente per richiedere l'indirizzo Bitcoin per accedere all'elezione

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';

const ElectionAccessForm = () => {
    const { electionId } = useParams();
    const navigate = useNavigate();
    
    const [election, setElection] = useState(null);
    const [bitcoinAddress, setBitcoinAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validatingAddress, setValidatingAddress] = useState(false);

    useEffect(() => {
        loadElectionInfo();
    }, [electionId]);

    // Carica informazioni sull'elezione
    const loadElectionInfo = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/elections/${electionId}`);
            setElection(response.data.election || response.data);
            setError('');
        } catch (error) {
            console.error('[ELECTION-ACCESS] Errore caricamento elezione:', error);
            setError('Elezione non trovata o non accessibile');
        } finally {
            setLoading(false);
        }
    };

    // Valida l'indirizzo Bitcoin inserito
    const validateBitcoinAddress = (address) => {
        if (!address) return false;
        
        // Regex per indirizzi Bitcoin (base, migliorabile)
        const bitcoinRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$|^tb1[a-z0-9]{39,59}$/;
        return bitcoinRegex.test(address);
    };

    // Gestisce l'accesso all'elezione con indirizzo Bitcoin
    const handleElectionAccess = async (e) => {
        e.preventDefault();
        
        if (!bitcoinAddress.trim()) {
            setError('Inserisci il tuo indirizzo Bitcoin per accedere');
            return;
        }

        if (!validateBitcoinAddress(bitcoinAddress.trim())) {
            setError('Indirizzo Bitcoin non valido');
            return;
        }

        try {
            setValidatingAddress(true);
            setError('');
            
            console.log('[ELECTION-ACCESS] 🔍 Verificando accesso con indirizzo:', bitcoinAddress);

            // Verifica che l'utente sia autorizzato per questa elezione con questo indirizzo
            const response = await api.post('/elections/verify-access', {
                electionId,
                bitcoinAddress: bitcoinAddress.trim()
            });

            if (response.data.success) {
                console.log('[ELECTION-ACCESS] ✅ Accesso autorizzato');
                
                // Salva l'indirizzo Bitcoin nella sessione per l'utilizzo durante il voto
                sessionStorage.setItem(`bitcoinAddress_${electionId}`, bitcoinAddress.trim());
                
                // Redirect alla pagina di voto
                navigate(`/vote/${electionId}`, {
                    state: {
                        election: election,
                        bitcoinAddress: bitcoinAddress.trim(),
                        authorized: true
                    }
                });
            } else {
                setError(response.data.message || 'Indirizzo Bitcoin non autorizzato per questa elezione');
            }
            
        } catch (error) {
            console.error('[ELECTION-ACCESS] ❌ Errore verifica accesso:', error);
            
            if (error.response?.status === 403) {
                setError('Indirizzo Bitcoin non autorizzato per questa elezione');
            } else if (error.response?.status === 404) {
                setError('Elezione non trovata');
            } else {
                setError('Errore durante la verifica. Riprova più tardi.');
            }
        } finally {
            setValidatingAddress(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Caricamento elezione...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-8">
                    <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-3xl font-bold text-gray-900">Accesso Sicuro</h2>
                    <p className="mt-2 text-gray-600">Inserisci il tuo indirizzo Bitcoin per accedere all'elezione</p>
                </div>

                {election && (
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{election.title}</h3>
                        {election.description && (
                            <p className="text-gray-600 mb-4">{election.description}</p>
                        )}
                        <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>Stato: <span className="font-medium text-green-600">{election.status}</span></span>
                            <span>Rete: <span className="font-medium">{election.blockchainNetwork || 'testnet'}</span></span>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-lg p-8">
                    <form onSubmit={handleElectionAccess} className="space-y-6">
                        <div>
                            <label htmlFor="bitcoinAddress" className="block text-sm font-medium text-gray-700 mb-2">
                                Indirizzo Bitcoin
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                    </svg>
                                </div>
                                <input
                                    id="bitcoinAddress"
                                    name="bitcoinAddress"
                                    type="text"
                                    required
                                    value={bitcoinAddress}
                                    onChange={(e) => setBitcoinAddress(e.target.value)}
                                    className="appearance-none relative block w-full px-10 py-3 border border-gray-300 rounded-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10"
                                    placeholder="bc1q... oppure tb1q... (per testnet)"
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Inserisci l'indirizzo Bitcoin che ti è stato assegnato dall'amministratore dell'elezione
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                                <div className="flex">
                                    <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={validatingAddress || !bitcoinAddress.trim()}
                                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {validatingAddress ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Verifica in corso...
                                    </>
                                ) : (
                                    'Accedi all\'Elezione'
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 border-t border-gray-200 pt-6">
                        <div className="text-center">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Sicurezza Blockchain</h4>
                            <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                                <div className="flex items-center">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                    Crittografia WabiSabi
                                </div>
                                <div className="flex items-center">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                    Blockchain Bitcoin
                                </div>
                                <div className="flex items-center">
                                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                                    Voto Anonimo
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-8">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                    >
                        ← Torna alla lista elezioni
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ElectionAccessForm;