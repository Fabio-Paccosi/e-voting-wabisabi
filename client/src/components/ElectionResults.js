// Componente per visualizzare i risultati delle elezioni e le transazioni CoinJoin

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const ElectionResults = () => {
    const { electionId } = useParams();
    
    const [election, setElection] = useState(null);
    const [results, setResults] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [selectedTx, setSelectedTx] = useState(null);

    useEffect(() => {
        loadElectionResults();
        
        // Auto-refresh ogni 30 secondi per monitorare nuove conferme
        const interval = setInterval(loadElectionResults, 30000);
        return () => clearInterval(interval);
    }, [electionId]);

    // Carica i risultati dell'elezione
    const loadElectionResults = async () => {
        try {
            setRefreshing(true);
            
            const [electionRes, resultsRes, transactionsRes] = await Promise.all([
                api.get(`/elections/${electionId}`),
                api.get(`/elections/${electionId}/results`),
                api.get(`/elections/${electionId}/transactions`)
            ]);

            setElection(electionRes.data.election || electionRes.data);
            setResults(resultsRes.data);
            setTransactions(transactionsRes.data.transactions || []);
            setError('');

        } catch (error) {
            console.error('[RESULTS] Errore caricamento risultati:', error);
            setError('Errore nel caricamento dei risultati');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Apre il dettaglio di una transazione
    const openTransactionDetail = async (txid) => {
        try {
            const response = await api.get(`/transactions/${txid}/details`);
            setSelectedTx(response.data);
        } catch (error) {
            console.error('[RESULTS] Errore caricamento dettagli transazione:', error);
        }
    };

    // Componente per la card dei risultati
    const ResultsCard = () => (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Risultati Elezione</h2>
            
            {results?.candidates?.map((candidate, index) => (
                <div key={candidate.id} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                index === 0 ? 'bg-yellow-500' : 
                                index === 1 ? 'bg-gray-400' : 
                                index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                            }`}>
                                {index + 1}
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                                {candidate.party && (
                                    <p className="text-sm text-gray-600">{candidate.party}</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xl font-bold text-gray-900">{candidate.votes}</p>
                            <p className="text-sm text-gray-500">{candidate.percentage}%</p>
                        </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                            className={`h-2 rounded-full ${
                                index === 0 ? 'bg-yellow-500' : 
                                index === 1 ? 'bg-gray-400' : 
                                index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                            }`}
                            style={{ width: `${candidate.percentage}%` }}
                        ></div>
                    </div>
                    
                    {/* Indirizzo Bitcoin del candidato */}
                    <div className="mt-2 text-xs text-gray-500">
                        <span className="font-medium">Bitcoin:</span>{' '}
                        <code className="bg-gray-100 px-1 rounded">
                            {candidate.bitcoinAddress}
                        </code>
                    </div>
                </div>
            ))}

            {/* Statistiche totali */}
            <div className="border-t pt-4 mt-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold text-blue-600">{results?.totalVotes || 0}</p>
                        <p className="text-sm text-gray-600">Voti Totali</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-green-600">{results?.voterTurnout || 0}%</p>
                        <p className="text-sm text-gray-600">Affluenza</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-purple-600">{transactions.length}</p>
                        <p className="text-sm text-gray-600">Transazioni</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-600">
                            {transactions.filter(tx => tx.confirmations > 0).length}
                        </p>
                        <p className="text-sm text-gray-600">Confermate</p>
                    </div>
                </div>
            </div>
        </div>
    );

    // Componente per le transazioni CoinJoin
    const TransactionsCard = () => (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Transazioni CoinJoin</h2>
                <button
                    onClick={loadElectionResults}
                    disabled={refreshing}
                    className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 disabled:opacity-50"
                >
                    <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Aggiorna</span>
                </button>
            </div>

            {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p>Nessuna transazione CoinJoin trovata</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {transactions.map((tx) => (
                        <div 
                            key={tx.txid} 
                            className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                            onClick={() => openTransactionDetail(tx.txid)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-medium text-gray-900">
                                            CoinJoin #{tx.txid.substring(0, 8)}...
                                        </h3>
                                        <span className={`px-2 py-1 text-xs rounded-full ${
                                            tx.confirmations >= 6 ? 'bg-green-100 text-green-800' :
                                            tx.confirmations >= 1 ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {tx.confirmations >= 6 ? 'Confermato' :
                                             tx.confirmations >= 1 ? `${tx.confirmations} conf.` :
                                             'Non confermato'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {tx.inputCount} input → {tx.outputCount} output
                                        {tx.fee && ` • Fee: ${tx.fee} sat`}
                                    </p>
                                </div>
                                <div className="text-right text-sm text-gray-500">
                                    <p>{new Date(tx.timestamp).toLocaleDateString()}</p>
                                    <p>{new Date(tx.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            {/* TXID completo (nascosto di default) */}
                            <div className="text-xs text-gray-400 font-mono break-all mt-2">
                                {tx.txid}
                            </div>

                            {/* Link explorer */}
                            {tx.explorerUrl && (
                                <div className="mt-2">
                                    <a
                                        href={tx.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        Visualizza su Block Explorer ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    // Modal per i dettagli della transazione
    const TransactionDetailModal = () => (
        selectedTx && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-screen overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-gray-900">Dettagli Transazione</h3>
                        <button 
                            onClick={() => setSelectedTx(null)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Info generali */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2">Informazioni Generali</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="font-medium">TXID:</span>
                                    <p className="font-mono break-all mt-1">{selectedTx.txid}</p>
                                </div>
                                <div>
                                    <span className="font-medium">Stato:</span>
                                    <p className={`mt-1 ${selectedTx.confirmed ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {selectedTx.confirmed ? 'Confermato' : 'In attesa'}
                                        {selectedTx.confirmations > 0 && ` (${selectedTx.confirmations} conferme)`}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium">Dimensione:</span>
                                    <p className="mt-1">{selectedTx.size} bytes</p>
                                </div>
                                <div>
                                    <span className="font-medium">Fee Rate:</span>
                                    <p className="mt-1">{selectedTx.feeRate?.toFixed(1)} sat/vB</p>
                                </div>
                            </div>
                        </div>

                        {/* Input (indirizzi dei votanti) */}
                        {selectedTx.inputs && (
                            <div>
                                <h4 className="font-semibold mb-3">Input (Indirizzi Votanti)</h4>
                                <div className="space-y-2">
                                    {selectedTx.inputs.map((input, index) => (
                                        <div key={index} className="bg-blue-50 p-3 rounded border-l-4 border-blue-500">
                                            <div className="text-sm">
                                                <span className="font-medium">Indirizzo:</span>
                                                <code className="ml-2 bg-white px-2 py-1 rounded">{input.address}</code>
                                            </div>
                                            <div className="text-sm mt-1 text-gray-600">
                                                Importo: {input.amount} sat • UTXO: {input.txid}:{input.vout}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Output (candidati) */}
                        {selectedTx.outputs && (
                            <div>
                                <h4 className="font-semibold mb-3">Output (Candidati)</h4>
                                <div className="space-y-2">
                                    {selectedTx.outputs.map((output, index) => (
                                        <div key={index} className="bg-green-50 p-3 rounded border-l-4 border-green-500">
                                            <div className="text-sm">
                                                <span className="font-medium">Candidato:</span>
                                                <span className="ml-2 font-semibold">{output.candidateName}</span>
                                                <span className="ml-2 text-gray-600">({output.voteCount} voti)</span>
                                            </div>
                                            <div className="text-sm mt-1">
                                                <span className="font-medium">Indirizzo:</span>
                                                <code className="ml-2 bg-white px-2 py-1 rounded">{output.address}</code>
                                            </div>
                                            <div className="text-sm mt-1 text-gray-600">
                                                Importo: {output.amount} sat
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center mt-6">
                        <button
                            onClick={() => setSelectedTx(null)}
                            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                        >
                            Chiudi
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Caricamento risultati...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {election?.title || 'Risultati Elezione'}
                    </h1>
                    <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                        <span>Stato: <span className="font-medium">{election?.status}</span></span>
                        <span>•</span>
                        <span>Rete: <span className="font-medium">{election?.blockchainNetwork || 'testnet'}</span></span>
                        <span>•</span>
                        <span>Ultimo aggiornamento: {new Date().toLocaleTimeString()}</span>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* Componenti principali */}
                <ResultsCard />
                <TransactionsCard />
            </div>

            {/* Modal dettagli transazione */}
            <TransactionDetailModal />
        </div>
    );
};

export default ElectionResults;