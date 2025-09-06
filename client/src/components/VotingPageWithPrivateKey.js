import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import CoinJoinWaiting from './CoinJoinWaiting';

const VotingPageWithPrivateKey = () => {
    const { electionId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Stati esistenti
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
    
    // NUOVI stati per CoinJoin
    const [showCoinJoinWaiting, setShowCoinJoinWaiting] = useState(false);
    const [voteId, setVoteId] = useState(null);

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
                setLoading(false);
                return;
            }
            
            setBitcoinAddress(address);
            
            // Carica i dati dell'elezione
            await loadElectionData();
            
        } catch (error) {
            console.error('[VOTING] ❌ Errore inizializzazione:', error);
            setError('Errore durante l\'inizializzazione del voto');
        } finally {
            setLoading(false);
        }
    };

    // Carica i dati dell'elezione e candidati
    const loadElectionData = async () => {
        try {
            console.log('[VOTING] 📂 Caricamento elezione:', electionId);
            
            const electionResponse = await api.get(`/elections/${electionId}`);
            const electionData = electionResponse.data;
            
            if (!electionData) {
                throw new Error('Elezione non trovata');
            }
            
            setElection(electionData);
            setCandidates(electionData.candidates || []);
            
            console.log('[VOTING] ✅ Elezione caricata:', electionData.title);
            console.log('[VOTING] 👥 Candidati:', electionData.candidates?.length || 0);
            
        } catch (error) {
            console.error('[VOTING] ❌ Errore caricamento elezione:', error);
            setError('Impossibile caricare i dati dell\'elezione');
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

    // MODIFICATA: Funzione per inviare il voto con integrazione CoinJoinWaiting
    const submitVote = async () => {
        if (!selectedCandidate || !privateKey.trim()) {
            setError('Seleziona un candidato e inserisci la chiave privata');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
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
                
                // MODIFICATO: Invece di mostrare success statico, avvia l'attesa CoinJoin
                setVoteId(voteResponse.data.voteId || `vote_${Date.now()}`);
                setTransactionId(voteResponse.data.transactionId);
                setShowPrivateKeyModal(false);
                setShowCoinJoinWaiting(true); // Mostra il componente di attesa
                
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

    // NUOVA: Funzione per gestire la chiusura del componente di attesa
    const handleCoinJoinWaitingClose = () => {
        setShowCoinJoinWaiting(false);
        setVoteSuccess(true); // Mostra il messaggio di successo finale
    };

    // Conferma e invia il voto (chiamata dal modal)
    const confirmVote = async () => {
        if (!privateKey.trim()) {
            setError('Inserisci la chiave privata per completare il voto');
            return;
        }

        if (!validatePrivateKey(privateKey.trim())) {
            setError('Chiave privata non valida');
            return;
        }

        await submitVote();
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

    // LOADING STATE
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

    // NUOVO: Mostra il componente di attesa CoinJoin
    if (showCoinJoinWaiting && voteId) {
        return (
            <CoinJoinWaiting 
                voteId={voteId}
                electionId={electionId}
                onClose={handleCoinJoinWaitingClose}
            />
        );
    }

    // MODIFICATO: Messaggio di successo finale (dopo che l'utente chiude la ricevuta)
    if (voteSuccess) {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Processo Completato!</h2>
                    <p className="text-gray-600 mb-4">
                        Il tuo voto è stato processato con successo tramite CoinJoin e registrato sulla blockchain Bitcoin.
                    </p>
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                        <p className="text-sm text-blue-800">
                            🔒 <strong>Privacy Garantita:</strong> Il tuo voto è stato mixato anonimamente con altri voti. 
                            Nessuno può risalire alla tua identità o al candidato scelto.
                        </p>
                    </div>
                    {transactionId && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                            <p className="text-xs text-gray-500 mb-1">ID Transazione CoinJoin:</p>
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

    // MAIN VOTING INTERFACE
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
                        <div className="flex items-center text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Attiva
                            </span>
                            <span className="ml-4">Indirizzo Bitcoin: {bitcoinAddress}</span>
                        </div>
                    </div>
                )}

                {/* Lista candidati */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Scegli il tuo candidato</h2>
                    
                    <div className="space-y-4">
                        {candidates.map((candidate) => (
                            <div
                                key={candidate.id}
                                onClick={() => handleCandidateSelect(candidate)}
                                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                    selectedCandidate?.id === candidate.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            {candidate.name}
                                        </h3>
                                        {candidate.party && (
                                            <p className="text-sm text-gray-600">{candidate.party}</p>
                                        )}
                                        {candidate.description && (
                                            <p className="text-sm text-gray-500 mt-1">{candidate.description}</p>
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