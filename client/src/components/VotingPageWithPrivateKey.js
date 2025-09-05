// Componente di voto che richiede la chiave privata per completare il voto

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';

const VotingPageWithPrivateKey = () => {
    const { electionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [election, setElection] = useState(null);
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [showPrivateKeyModal, setShowPrivateKeyModal] = useState(false);
    const [privateKey, setPrivateKey] = useState('');
    const [bitcoinAddress, setBitcoinAddress] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [voteSuccess, setVoteSuccess] = useState(false);
    const [transactionId, setTransactionId] = useState('');

    useEffect(() => {
        initializeVoting();
    }, [electionId]);

    // Inizializza il processo di voto
    const initializeVoting = async () => {
        try {
            setLoading(true);
            
            // Recupera l'indirizzo Bitcoin dalla sessione o dallo state
            let address = sessionStorage.getItem(`bitcoinAddress_${electionId}`);
            if (!address && location.state?.bitcoinAddress) {
                address = location.state.bitcoinAddress;
                sessionStorage.setItem(`bitcoinAddress_${electionId}`, address);
            }
            
            if (!address) {
                setError('Indirizzo Bitcoin non trovato. Riaccedi all\'elezione.');
                setTimeout(() => navigate(`/election/${electionId}`), 3000);
                return;
            }
            
            setBitcoinAddress(address);
            
            // Carica elezione e candidati
            await Promise.all([
                loadElection(),
                loadCandidates()
            ]);

        } catch (error) {
            console.error('[VOTING] Errore inizializzazione:', error);
            setError('Errore durante l\'inizializzazione del voto');
        } finally {
            setLoading(false);
        }
    };

    // Carica informazioni elezione
    const loadElection = async () => {
        try {
            const response = await api.get(`/elections/${electionId}`);
            setElection(response.data.election || response.data);
        } catch (error) {
            console.error('[VOTING] Errore caricamento elezione:', error);
            throw error;
        }
    };

    // Carica lista candidati
    const loadCandidates = async () => {
        try {
            const response = await api.get(`/elections/${electionId}/candidates`);
            setCandidates(response.data.candidates || []);
            
            // Verifica se l'utente ha già votato
            if (response.data.userAccess?.hasVoted) {
                setVoteSuccess(true);
                setError('Hai già votato per questa elezione');
            }
        } catch (error) {
            console.error('[VOTING] Errore caricamento candidati:', error);
            throw error;
        }
    };

    // Gestisce la selezione del candidato
    const handleCandidateSelect = (candidate) => {
        setSelectedCandidate(candidate);
        setError('');
        console.log('[VOTING] Candidato selezionato:', candidate.name);
    };

    // Mostra il modal per inserire la chiave privata
    const handleVoteClick = () => {
        if (!selectedCandidate) {
            setError('Seleziona un candidato prima di procedere');
            return;
        }
        
        setShowPrivateKeyModal(true);
        setPrivateKey('');
        setError('');
    };

    // Valida la chiave privata Bitcoin
    const validatePrivateKey = (key) => {
        if (!key) return false;
        
        // Regex base per chiavi private WIF (migliorabile)
        const wifRegex = /^[KL5][1-9A-HJ-NP-Za-km-z]{50,51}$|^c[1-9A-HJ-NP-Za-km-z]{50,51}$/;
        return wifRegex.test(key);
    };

    // Conferma e invia il voto
    const confirmVote = async () => {
        if (!privateKey.trim()) {
            setError('Inserisci la chiave privata per completare il voto');
            return;
        }

        if (!validatePrivateKey(privateKey.trim())) {
            setError('Chiave privata non valida');
            return;
        }

        try {
            setSubmitting(true);
            setError('');
            
            console.log('[VOTING] 🗳️ Inviando voto per candidato:', selectedCandidate.name);

            // Invia il voto al server con la chiave privata per la firma
            const voteResponse = await api.post('/voting/submit-vote', {
                electionId,
                candidateId: selectedCandidate.id,
                bitcoinAddress,
                privateKey: privateKey.trim(),
                voteCommitment: generateVoteCommitment(selectedCandidate),
                timestamp: new Date().toISOString()
            });

            if (voteResponse.data.success) {
                console.log('[VOTING] ✅ Voto inviato con successo');
                
                setTransactionId(voteResponse.data.transactionId);
                setVoteSuccess(true);
                setShowPrivateKeyModal(false);
                
                // Pulisci la chiave privata dalla memoria
                setPrivateKey('');
                
                // Rimuovi l'indirizzo dalla sessione
                sessionStorage.removeItem(`bitcoinAddress_${electionId}`);
                
            } else {
                setError(voteResponse.data.error || 'Errore durante l\'invio del voto');
            }

        } catch (error) {
            console.error('[VOTING] ❌ Errore invio voto:', error);
            
            if (error.response?.status === 403) {
                setError('Chiave privata non corrisponde all\'indirizzo Bitcoin autorizzato');
            } else if (error.response?.status === 400) {
                setError(error.response.data.error || 'Dati del voto non validi');
            } else {
                setError('Errore durante l\'invio del voto. Riprova più tardi.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Genera commitment del voto (placeholder - implementazione semplificata)
    const generateVoteCommitment = (candidate) => {
        const crypto = require('crypto');
        const voteData = {
            candidateId: candidate.id,
            voteEncoding: candidate.voteEncoding,
            timestamp: Date.now(),
            nonce: Math.random().toString(36)
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(voteData))
            .digest('hex');
    };

    // Modal chiave privata
    const PrivateKeyModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Conferma Voto</h3>
                    <button 
                        onClick={() => setShowPrivateKeyModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <span className="sr-only">Chiudi</span>
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Stai votando per:</p>
                    <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium text-blue-900">{selectedCandidate?.name}</p>
                        {selectedCandidate?.party && (
                            <p className="text-sm text-blue-700">{selectedCandidate.party}</p>
                        )}
                    </div>
                </div>

                <div className="mb-4">
                    <label htmlFor="privateKey" className="block text-sm font-medium text-gray-700 mb-2">
                        Chiave Privata Bitcoin
                    </label>
                    <textarea
                        id="privateKey"
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows="3"
                        placeholder="Inserisci la tua chiave privata WIF..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        La chiave privata è necessaria per firmare la transazione di voto
                    </p>
                </div>

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <div className="flex space-x-3">
                    <button
                        onClick={() => setShowPrivateKeyModal(false)}
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                        disabled={submitting}
                    >
                        Annulla
                    </button>
                    <button
                        onClick={confirmVote}
                        disabled={submitting || !privateKey.trim()}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-400"
                    >
                        {submitting ? 'Invio...' : 'Conferma Voto'}
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Caricamento elezione...</p>
                </div>
            </div>
        );
    }

    if (voteSuccess) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Voto Registrato!</h2>
                    <p className="text-gray-600 mb-4">Il tuo voto è stato inviato con successo alla blockchain</p>
                    {transactionId && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                            <p className="text-xs text-gray-500 mb-1">ID Transazione:</p>
                            <p className="text-sm font-mono text-gray-800 break-all">{transactionId}</p>
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
                    >
                        Torna alla Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header elezione */}
                {election && (
                    <div className="bg-white rounded-lg shadow p-6 mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">{election.title}</h1>
                        {election.description && (
                            <p className="text-gray-600 mb-4">{election.description}</p>
                        )}
                        <div className="flex items-center justify-between text-sm text-gray-500">
                            <span>Il tuo indirizzo: <code className="bg-gray-100 px-2 py-1 rounded">{bitcoinAddress}</code></span>
                            <span>Rete: {election.blockchainNetwork || 'testnet'}</span>
                        </div>
                    </div>
                )}

                {/* Lista candidati */}
                <div className="bg-white rounded-lg shadow">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900">Seleziona il tuo candidato</h2>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {candidates.map((candidate) => (
                            <div
                                key={candidate.id}
                                onClick={() => handleCandidateSelect(candidate)}
                                className={`p-6 cursor-pointer hover:bg-gray-50 transition-colors ${
                                    selectedCandidate?.id === candidate.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900">{candidate.name}</h3>
                                        {candidate.party && (
                                            <p className="text-sm text-gray-600">{candidate.party}</p>
                                        )}
                                        {candidate.biography && (
                                            <p className="text-sm text-gray-500 mt-2">{candidate.biography}</p>
                                        )}
                                    </div>
                                    <div className="ml-4">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                            selectedCandidate?.id === candidate.id 
                                                ? 'border-blue-500 bg-blue-500' 
                                                : 'border-gray-300'
                                        }`}>
                                            {selectedCandidate?.id === candidate.id && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pulsante voto */}
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={handleVoteClick}
                        disabled={!selectedCandidate}
                        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Vota per {selectedCandidate?.name || 'Candidato Selezionato'}
                    </button>
                </div>

                {/* Errori globali */}
                {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}
            </div>

            {/* Modal chiave privata */}
            {showPrivateKeyModal && <PrivateKeyModal />}
        </div>
    );
};

export default VotingPageWithPrivateKey;