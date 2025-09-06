import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Bitcoin, 
  Users, 
  CheckCircle, 
  Loader, 
  AlertCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import api from '../services/api';
import VoteReceipt from './VoteReceipt';

const CoinJoinWaiting = ({ voteId, electionId, onClose }) => {
  const [status, setStatus] = useState('waiting'); // waiting, processing, completed, error
  const [voteData, setVoteData] = useState(null);
  const [coinjoinData, setCoinjoinData] = useState(null);
  const [error, setError] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);
  const [timeWaited, setTimeWaited] = useState(0);

  useEffect(() => {
    if (voteId) {
      pollVoteStatus();
      
      // Timer per mostrare il tempo trascorso
      const timeInterval = setInterval(() => {
        setTimeWaited(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timeInterval);
    }
  }, [voteId]);

  const pollVoteStatus = async () => {
    try {
      setError('');
      
      // Controlla lo stato del voto
      const response = await api.get(`/voting/status/${voteId}`);
      const vote = response.data;
      setVoteData(vote);

      console.log('[COINJOIN-WAITING] Stato voto:', vote.status);

      switch (vote.status) {
        case 'pending':
          setStatus('waiting');
          // Continua il polling ogni 3 secondi
          setTimeout(pollVoteStatus, 3000);
          setPollingCount(prev => prev + 1);
          break;
          
        case 'processed':
          setStatus('processing');
          // Il voto è in elaborazione, continua il polling
          setTimeout(pollVoteStatus, 2000);
          setPollingCount(prev => prev + 1);
          break;
          
        case 'confirmed':
          setStatus('completed');
          // Carica i dettagli della transazione CoinJoin
          await loadCoinJoinDetails(vote);
          break;
          
        case 'failed':
          setStatus('error');
          setError('Il processo di votazione è fallito');
          break;
          
        default:
          // Continua il polling per stati sconosciuti
          setTimeout(pollVoteStatus, 3000);
          setPollingCount(prev => prev + 1);
      }

      // Safety: ferma il polling dopo 100 tentativi (5 minuti)
      if (pollingCount > 100) {
        setStatus('error');
        setError('Timeout: il processo sta richiedendo troppo tempo');
      }

    } catch (err) {
      console.error('[COINJOIN-WAITING] Errore polling:', err);
      setError('Errore nella verifica dello stato del voto');
      setStatus('error');
    }
  };

  const loadCoinJoinDetails = async (vote) => {
    try {
      if (vote.transactionId) {
        // Carica dettagli transazione dalla sessione
        const sessionResponse = await api.get(`/voting/session/${electionId}/stats`);
        const sessionData = sessionResponse.data;
        
        // Trova la transazione CoinJoin
        const coinJoinTx = sessionData.transactions?.find(tx => 
          tx.txId === vote.transactionId || tx.type === 'coinjoin'
        );

        if (coinJoinTx) {
          setCoinjoinData({
            transactionId: coinJoinTx.txId,
            participantsCount: coinJoinTx.metadata?.participants || 'N/A',
            totalVotes: coinJoinTx.metadata?.totalVotes || 'N/A',
            blockHeight: coinJoinTx.blockHeight,
            confirmations: coinJoinTx.confirmations || 0,
            fee: coinJoinTx.fee,
            size: coinJoinTx.size
          });
        }
      }
    } catch (err) {
      console.error('[COINJOIN-WAITING] Errore caricamento dettagli CoinJoin:', err);
      // Non bloccare il processo se non riusciamo a caricare i dettagli
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'waiting':
        return {
          icon: <Clock className="text-blue-500" size={24} />,
          title: 'In Attesa di Altri Voti',
          description: 'Il tuo voto è stato registrato. Stiamo aspettando che altri utenti votino per avviare il processo CoinJoin...',
          color: 'border-blue-200 bg-blue-50'
        };
      case 'processing':
        return {
          icon: <RefreshCw className="text-yellow-500 animate-spin" size={24} />,
          title: 'Elaborazione CoinJoin in Corso',
          description: 'I voti vengono aggregati anonimamente e la transazione Bitcoin viene costruita...',
          color: 'border-yellow-200 bg-yellow-50'
        };
      case 'completed':
        return {
          icon: <CheckCircle className="text-green-500" size={24} />,
          title: 'CoinJoin Completato!',
          description: 'Il tuo voto è stato processato con successo e registrato sulla blockchain.',
          color: 'border-green-200 bg-green-50'
        };
      case 'error':
        return {
          icon: <AlertCircle className="text-red-500" size={24} />,
          title: 'Errore nel Processo',
          description: error || 'Si è verificato un errore durante il processo di votazione.',
          color: 'border-red-200 bg-red-50'
        };
      default:
        return {
          icon: <Loader className="text-gray-500 animate-spin" size={24} />,
          title: 'Caricamento...',
          description: 'Verifica dello stato in corso...',
          color: 'border-gray-200 bg-gray-50'
        };
    }
  };

  const statusInfo = getStatusInfo();

  if (showReceipt && status === 'completed') {
    return (
      <VoteReceipt 
        voteId={voteId}
        electionId={electionId}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <Bitcoin className="text-orange-500 mr-2" size={24} />
              Processo CoinJoin
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={status === 'processing'} // Impedisce chiusura durante processing
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Content */}
        <div className="p-6">
          {/* Status Card */}
          <div className={`border rounded-lg p-4 mb-6 ${statusInfo.color}`}>
            <div className="flex items-start">
              <div className="mr-3 mt-1">
                {statusInfo.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {statusInfo.title}
                </h3>
                <p className="text-gray-700 text-sm">
                  {statusInfo.description}
                </p>
              </div>
            </div>
          </div>

          {/* Progress Info */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Tempo trascorso:</span>
              <span className="font-mono text-gray-900">{formatTime(timeWaited)}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">ID Voto:</span>
              <span className="font-mono text-gray-900">{voteId}</span>
            </div>

            {voteData && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Stato:</span>
                <span className="font-semibold text-gray-900">
                  {voteData.status}
                </span>
              </div>
            )}

            {pollingCount > 0 && status === 'waiting' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Controlli effettuati:</span>
                <span className="text-gray-900">{pollingCount}</span>
              </div>
            )}
          </div>

          {/* CoinJoin Details (se disponibili) */}
          {coinjoinData && status === 'completed' && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold mb-3 flex items-center">
                <Users className="text-blue-500 mr-2" size={16} />
                Dettagli CoinJoin
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Partecipanti:</span>
                  <span className="font-mono">{coinjoinData.participantsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Voti Totali:</span>
                  <span className="font-mono">{coinjoinData.totalVotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono text-xs">
                    {coinjoinData.transactionId?.substring(0, 12)}...
                  </span>
                </div>
                {coinjoinData.confirmations > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Conferme:</span>
                    <span className="font-mono">{coinjoinData.confirmations}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center space-x-3">
            {status === 'completed' && (
              <button
                onClick={() => setShowReceipt(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <FileText size={16} className="mr-2" />
                Visualizza Ricevuta
              </button>
            )}
            
            {status === 'error' && (
              <button
                onClick={pollVoteStatus}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <RefreshCw size={16} className="mr-2" />
                Riprova
              </button>
            )}
            
            {status !== 'processing' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Chiudi
              </button>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              🔒 <strong>Privacy garantita:</strong> Il tuo voto è stato mixato anonimamente con altri voti. 
              Nessuno può risalire alla tua identità o al candidato scelto dalla transazione blockchain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoinJoinWaiting;