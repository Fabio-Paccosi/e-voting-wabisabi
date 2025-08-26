import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Share2, 
  Copy, 
  CheckCircle, 
  Clock,
  Bitcoin,
  Hash,
  Calendar,
  Shield,
  ExternalLink,
  Printer
} from 'lucide-react';
import api from '../services/api';

const VoteReceipt = ({ voteId, electionId, onClose }) => {
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (voteId) {
      loadReceiptData();
    }
  }, [voteId]);

  const loadReceiptData = async () => {
    try {
      setLoading(true);
      setError('');

      // Carica i dettagli del voto e della transazione
      const [voteResponse, transactionResponse] = await Promise.all([
        api.get(`/voting/status/${voteId}`),
        api.get(`/voting/session/${electionId}/stats`)
      ]);

      const voteData = voteResponse.data;
      const sessionData = transactionResponse.data;

      // Trova la transazione CoinJoin per questa sessione
      const coinJoinTx = sessionData.transactions?.find(tx => tx.type === 'coinjoin');

      setReceiptData({
        voteId: voteData.voteId,
        submittedAt: voteData.submittedAt,
        processedAt: voteData.processedAt,
        status: voteData.status,
        sessionId: voteData.sessionId,
        transactionId: coinJoinTx?.txId || voteData.transaction?.txId,
        confirmations: voteData.transaction?.confirmations || 0,
        blockHeight: voteData.transaction?.blockHeight,
        blockHash: voteData.transaction?.blockHash,
        participantsCount: coinJoinTx?.metadata?.participants || 'N/A',
        totalVotes: coinJoinTx?.metadata?.totalVotes || 'N/A'
      });

    } catch (err) {
      console.error('Errore caricamento ricevuta:', err);
      setError('Impossibile caricare i dettagli della ricevuta');
    } finally {
      setLoading(false);
    }
  };

  const copyTransactionId = async () => {
    if (receiptData?.transactionId) {
      try {
        await navigator.clipboard.writeText(receiptData.transactionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Errore copia:', err);
      }
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) return;

    const receiptContent = `
RICEVUTA DI VOTO - SISTEMA E-VOTING WABISABI
============================================

ID Voto: ${receiptData.voteId}
Data Invio: ${new Date(receiptData.submittedAt).toLocaleString('it-IT')}
Data Elaborazione: ${receiptData.processedAt ? new Date(receiptData.processedAt).toLocaleString('it-IT') : 'In elaborazione'}
Stato: ${getStatusText(receiptData.status)}

DETTAGLI TRANSAZIONE BLOCKCHAIN
===============================
Transaction ID: ${receiptData.transactionId || 'In attesa di conferma'}
Conferme: ${receiptData.confirmations || 0}
Altezza Blocco: ${receiptData.blockHeight || 'N/A'}
Hash Blocco: ${receiptData.blockHash || 'N/A'}

DETTAGLI SESSIONE
=================
ID Sessione: ${receiptData.sessionId}
Partecipanti CoinJoin: ${receiptData.participantsCount}
Voti Aggregati: ${receiptData.totalVotes}

NOTA SULLA PRIVACY
==================
Questo sistema garantisce l'anonimato completo del voto attraverso
il protocollo WabiSabi. Il Transaction ID identifica la sessione
di voto aggregata, non il contenuto specifico del tuo voto.

Il tuo voto è stato mixato con altri voti rendendo impossibile
risalire alla tua identità o al candidato scelto.

Generato il: ${new Date().toLocaleString('it-IT')}
Sistema: E-Voting WabiSabi - Tesi Magistrale Fabio Paccosi
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricevuta-voto-${receiptData.voteId}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const printReceipt = () => {
    window.print();
  };

  const openBlockchainExplorer = () => {
    if (receiptData?.transactionId) {
      // Apri il transaction ID nel block explorer (esempio per testnet)
      const explorerUrl = `https://blockstream.info/testnet/tx/${receiptData.transactionId}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'In attesa',
      'processed': 'Elaborato',
      'confirmed': 'Confermato',
      'failed': 'Fallito'
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'processed':
        return <Clock className="text-yellow-500" size={20} />;
      case 'pending':
        return <Clock className="text-blue-500" size={20} />;
      default:
        return <Clock className="text-gray-500" size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3">Caricamento ricevuta...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 mb-4">❌</div>
            <h3 className="text-lg font-semibold mb-2">Errore</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="text-blue-600" size={28} />
              <div className="ml-3">
                <h2 className="text-xl font-bold">Ricevuta di Voto</h2>
                <p className="text-gray-600">Sistema E-Voting WabiSabi</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-6" id="receipt-content">
          {/* Vote Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {getStatusIcon(receiptData.status)}
                <span className="ml-2 font-semibold">
                  Stato: {getStatusText(receiptData.status)}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                ID: {receiptData.voteId}
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Bitcoin className="text-orange-500 mr-2" size={20} />
              Dettagli Transazione Blockchain
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center">
                  <Hash className="text-blue-600 mr-2" size={16} />
                  <span className="font-medium">Transaction ID</span>
                </div>
                <div className="flex items-center">
                  <code className="bg-white px-2 py-1 rounded text-sm mr-2">
                    {receiptData.transactionId ? 
                      `${receiptData.transactionId.substring(0, 20)}...` : 
                      'In attesa di conferma'
                    }
                  </code>
                  {receiptData.transactionId && (
                    <button
                      onClick={copyTransactionId}
                      className="text-blue-600 hover:text-blue-800"
                      title="Copia Transaction ID"
                    >
                      {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Conferme</div>
                  <div className="font-semibold">{receiptData.confirmations || 0}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">Altezza Blocco</div>
                  <div className="font-semibold">{receiptData.blockHeight || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Shield className="text-green-500 mr-2" size={20} />
              Dettagli Sessione di Voto
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Partecipanti CoinJoin</div>
                <div className="font-semibold">{receiptData.participantsCount}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Voti Aggregati</div>
                <div className="font-semibold">{receiptData.totalVotes}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Data Invio</div>
                    <div className="font-semibold">
                      {new Date(receiptData.submittedAt).toLocaleString('it-IT')}
                    </div>
                  </div>
                  <Calendar className="text-gray-400" size={20} />
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
            <h4 className="font-semibold text-yellow-800 mb-2">
              🔒 Nota sulla Privacy
            </h4>
            <p className="text-sm text-yellow-700">
              Questo sistema garantisce l'anonimato completo attraverso il protocollo WabiSabi. 
              Il Transaction ID identifica la sessione di voto aggregata, non il contenuto specifico del tuo voto. 
              Il tuo voto è stato mixato con altri voti rendendo impossibile risalire alla tua identità 
              o al candidato scelto.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={downloadReceipt}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download size={16} className="mr-2" />
              Scarica Ricevuta
            </button>
            
            <button
              onClick={printReceipt}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Printer size={16} className="mr-2" />
              Stampa
            </button>

            {receiptData.transactionId && (
              <button
                onClick={openBlockchainExplorer}
                className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                <ExternalLink size={16} className="mr-2" />
                Verifica su Blockchain
              </button>
            )}

            <button
              onClick={copyTransactionId}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              disabled={!receiptData.transactionId}
            >
              {copied ? <CheckCircle size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
              {copied ? 'Copiato!' : 'Copia TX ID'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoteReceipt;