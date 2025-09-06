import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Download, 
  Printer,
  Copy, 
  ExternalLink,
  Bitcoin,
  Hash,
  Calendar,
  Shield,
  Key,
  Lock,
  Wallet,
  Users,
  Clock,
  AlertCircle,
  Info,
  Loader,
  XCircle
} from 'lucide-react';
import api from '../services/api';

const VoteReceipt = ({ voteId, electionId, userId, onClose }) => {
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    loadReceiptData();
  }, [voteId, electionId, userId]);

  const loadReceiptData = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      
      // Usa l'endpoint appropriato in base ai parametri disponibili
      if (voteId) {
        response = await api.get(`/voting/receipt/${voteId}/detailed`);
      } else if (electionId && userId) {
        response = await api.get(`/voting/receipt/${electionId}/user/${userId}/detailed`);
      } else {
        throw new Error('Parametri insufficienti per caricare la ricevuta');
      }

      setReceiptData(response.data.receipt);

    } catch (err) {
      console.error('Errore caricamento ricevuta:', err);
      setError(err.response?.data?.message || 'Impossibile caricare i dettagli della ricevuta');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Errore copia:', err);
    }
  };

  const downloadReceipt = () => {
    if (!receiptData) return;

    const receiptContent = `
RICEVUTA VOTO ELETTRONICO - SISTEMA WABISABI
============================================

DETTAGLI VOTO:
ID Voto: ${receiptData.voteData.voteId}
Serial Number: ${receiptData.voteData.serialNumber}
Stato: ${receiptData.voteData.status}
Data Invio: ${new Date(receiptData.voteData.submittedAt).toLocaleString('it-IT')}
Data Elaborazione: ${new Date(receiptData.voteData.processedAt).toLocaleString('it-IT')}

ELEZIONE:
${receiptData.election.title}
${receiptData.election.description}

DATI WALLET AUTORIZZATO:
Indirizzo Bitcoin: ${receiptData.whitelistData.bitcoinAddress}
Chiave Pubblica: ${receiptData.whitelistData.bitcoinPublicKey}

UTXO UTILIZZATO:
Transaction ID: ${receiptData.whitelistData.utxo_txid}
Output Index: ${receiptData.whitelistData.utxo_vout}
Importo: 0.001 BTC

${receiptData.transaction ? `
TRANSAZIONE COINJOIN:
Hash Transazione: ${receiptData.transaction.txid}
Block Height: ${receiptData.transaction.blockHeight || 'In attesa'}
Conferme: ${receiptData.transaction.confirmations}
Partecipanti: ${receiptData.transaction.voterCount}
Input/Output: ${receiptData.transaction.inputCount}/${receiptData.transaction.outputCount}
` : 'TRANSAZIONE COINJOIN: In elaborazione'}

VERIFICA BLOCKCHAIN:
Network: ${receiptData.election.network}
${receiptData.transaction?.blockHash ? `Block Hash: ${receiptData.transaction.blockHash}` : ''}
${receiptData.transaction?.confirmedAt ? `Data Conferma: ${new Date(receiptData.transaction.confirmedAt).toLocaleString('it-IT')}` : ''}

Questa ricevuta dimostra che il tuo voto è stato registrato
anonimamente sulla blockchain Bitcoin tramite protocollo WabiSabi.

Hash di Verifica: ${receiptData.metadata.verificationHash}
Ricevuta Generata: ${new Date(receiptData.metadata.receiptGeneratedAt).toLocaleString('it-IT')}
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ricevuta-voto-${receiptData.voteData.voteId.substring(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printReceipt = () => {
    window.print();
  };

  const openBlockchainExplorer = () => {
    if (!receiptData?.transaction?.txid) return;
    
    const network = receiptData.election.network === 'mainnet' ? '' : 'testnet.';
    const url = `https://blockstream.info/${network}tx/${receiptData.transaction.txid}`;
    window.open(url, '_blank');
  };

  const formatTimestamp = (date) => {
    return new Date(date).toLocaleString('it-IT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      confirmed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', text: 'Confermato' },
      pending: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', text: 'In Attesa' },
      failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', text: 'Fallito' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const IconComponent = config.icon;

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
        <IconComponent size={16} className="mr-1" />
        {config.text}
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Loader className="animate-spin text-blue-600 mx-auto mb-4" size={32} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Caricamento Ricevuta</h2>
          <p className="text-gray-600">Recupero dei dettagli del voto in corso...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <AlertCircle className="text-red-600 mx-auto mb-4" size={32} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore di Caricamento</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={loadReceiptData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Riprova
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Chiudi
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!receiptData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <Info className="text-gray-600 mx-auto mb-4" size={32} />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ricevuta Non Disponibile</h2>
          <p className="text-gray-600">I dati della ricevuta non sono ancora disponibili.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header con successo */}
        <div className="bg-white rounded-t-xl shadow-lg p-6 border-b border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="text-green-600" size={32} />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Voto Anonimo Registrato!</h1>
                <p className="text-gray-600 mb-4">
                  Il tuo voto anonimo è stato processato con il protocollo WabiSabi
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            )}
          </div>
          
          <div className="text-center">
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-700 font-mono">
                <strong>ID Voto/Transazione:</strong><br />
                <span className="text-blue-600">{receiptData.voteData.voteId}</span>
              </p>
            </div>
            <StatusBadge status={receiptData.voteData.status} />
          </div>
        </div>

        {/* Contenuto principale */}
        <div className="bg-white shadow-lg">
          {/* Riepilogo voto */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="text-blue-600 mr-2" size={24} />
              Riepilogo Voto Anonimo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Info className="text-blue-600 mr-2" size={16} />
                  <span className="font-semibold text-blue-900">Voto completamente anonimo con WabiSabi</span>
                </div>
                <p className="text-sm text-blue-700">
                  {receiptData.transaction ? 
                    `Il tuo voto è stato mixato con altri ${receiptData.transaction.voterCount - 1} voti rendendo impossibile risalire alla tua identità.` :
                    'Il tuo voto è in elaborazione per essere aggregato con altri voti.'
                  }
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Bitcoin className="text-green-600 mr-2" size={16} />
                  <span className="font-semibold text-green-900">
                    {receiptData.transaction?.blockHeight ? 
                      'Confermato su blockchain Bitcoin' : 
                      'In attesa di conferma blockchain'
                    }
                  </span>
                </div>
                <p className="text-sm text-green-700">
                  {receiptData.transaction?.blockHeight ? 
                    `Registrato nel blocco ${receiptData.transaction.blockHeight} con ${receiptData.transaction.confirmations} conferme` :
                    'La transazione CoinJoin è in fase di elaborazione'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Dettagli wallet whitelist */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Wallet className="text-purple-600 mr-2" size={20} />
              Wallet Autorizzato (Election Whitelist)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">Indirizzo Bitcoin:</span>
                  <div className="flex items-center">
                    <code className="text-sm bg-white px-2 py-1 rounded mr-2">
                      {receiptData.whitelistData.bitcoinAddress ? 
                        `${receiptData.whitelistData.bitcoinAddress.substring(0, 20)}...` :
                        'N/A'
                      }
                    </code>
                    {receiptData.whitelistData.bitcoinAddress && (
                      <button
                        onClick={() => copyToClipboard(receiptData.whitelistData.bitcoinAddress)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">Chiave Pubblica:</span>
                  <code className="text-sm bg-white px-2 py-1 rounded">
                    {receiptData.whitelistData.bitcoinPublicKey}
                  </code>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium text-gray-700">Data Autorizzazione:</span>
                  <span className="text-sm">
                    {receiptData.whitelistData.votedAt ? 
                      formatTimestamp(receiptData.whitelistData.votedAt) : 'N/A'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                  <span className="font-medium text-gray-700">Status Whitelist:</span>
                  <span className="text-sm text-green-600 font-semibold">
                    {receiptData.whitelistData.hasVoted ? '✓ Autorizzato e Votato' : '? In Verifica'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dettagli UTXO */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Hash className="text-orange-600 mr-2" size={20} />
              UTXO Utilizzato per il Voto
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg mb-3">
                  <span className="font-medium text-gray-700">UTXO Transaction ID:</span>
                  <div className="flex items-center">
                    <code className="text-sm bg-white px-2 py-1 rounded mr-2">
                      {receiptData.whitelistData.utxo_txid !== 'N/A' ? 
                        `${receiptData.whitelistData.utxo_txid.substring(0, 20)}...` :
                        'N/A'
                      }
                    </code>
                    {receiptData.whitelistData.utxo_txid !== 'N/A' && (
                      <button
                        onClick={() => copyToClipboard(receiptData.whitelistData.utxo_txid)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Copy size={16} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                  <span className="font-medium text-gray-700">Output Index:</span>
                  <span className="font-mono text-sm">{receiptData.whitelistData.utxo_vout}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <span className="text-sm text-gray-600 block">Importo UTXO </span>
                  <span className="text-lg font-bold text-orange-600">
                    0.001 BTC
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <span className="text-sm text-gray-600 block">Status</span>
                  <span className="text-sm font-semibold text-red-600">
                    {receiptData.whitelistData.hasVoted ? 'SPESO' : 'RISERVATO'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dettagli transazione CoinJoin */}
          {receiptData.transaction && (
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Bitcoin className="text-blue-600 mr-2" size={20} />
                Transazione CoinJoin su Blockchain
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium text-gray-700">Transaction Hash:</span>
                    <div className="flex items-center">
                      <code className="text-sm bg-white px-2 py-1 rounded mr-2">
                        {receiptData.transaction.txid.substring(0, 16)}...
                      </code>
                      <button
                        onClick={() => copyToClipboard(receiptData.transaction.txid)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-medium text-gray-700">Conferme:</span>
                    <span className="font-semibold text-green-600">
                      {receiptData.transaction.confirmations}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Partecipanti CoinJoin:</span>
                    <div className="flex items-center">
                      <Users className="text-green-600 mr-1" size={16} />
                      <span className="font-semibold">{receiptData.transaction.voterCount} elettori</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Input/Output:</span>
                    <span className="font-mono text-sm">
                      {receiptData.transaction.inputCount}/{receiptData.transaction.outputCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="font-medium text-gray-700">Network:</span>
                    <span className="font-semibold text-orange-600 uppercase">
                      {receiptData.election.network}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dati crittografici */}
          {showTechnicalDetails && (
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Lock className="text-red-600 mr-2" size={20} />
                Dettagli Crittografici
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg">
                  <span className="font-medium text-gray-700 block mb-1">Serial Number (Anti-Double Spending):</span>
                  <code className="text-sm text-red-600 break-all">{receiptData.voteData.serialNumber}</code>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <span className="font-medium text-gray-700 block mb-1">Vote Commitment Hash:</span>
                  <code className="text-sm text-blue-600 break-all">{receiptData.voteData.commitment}</code>
                </div>
                {receiptData.transaction?.blockHash && (
                  <div className="p-3 bg-white rounded-lg">
                    <span className="font-medium text-gray-700 block mb-1">Block Hash:</span>
                    <code className="text-sm text-green-600 break-all">{receiptData.transaction.blockHash}</code>
                  </div>
                )}
                <div className="p-3 bg-white rounded-lg">
                  <span className="font-medium text-gray-700 block mb-1">Hash di Verifica Ricevuta:</span>
                  <code className="text-sm text-purple-600 break-all">{receiptData.metadata.verificationHash}</code>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="text-purple-600 mr-2" size={20} />
              Timeline del Processo
            </h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-4"></div>
                <div className="flex-1">
                  <span className="font-medium">Voto Inviato</span>
                  <span className="text-sm text-gray-500 ml-2">
                    {formatTimestamp(receiptData.voteData.submittedAt)}
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-4"></div>
                <div className="flex-1">
                  <span className="font-medium">Processato e Aggregato</span>
                  <span className="text-sm text-gray-500 ml-2">
                    {formatTimestamp(receiptData.voteData.processedAt)}
                  </span>
                </div>
              </div>
              {receiptData.transaction?.broadcastedAt && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-4"></div>
                  <div className="flex-1">
                    <span className="font-medium">Transazione Broadcasted</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {formatTimestamp(receiptData.transaction.broadcastedAt)}
                    </span>
                  </div>
                </div>
              )}
              {receiptData.transaction?.confirmedAt && (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
                  <div className="flex-1">
                    <span className="font-medium">Confermato su Blockchain</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {formatTimestamp(receiptData.transaction.confirmedAt)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="p-6 border-b border-gray-200 bg-amber-50">
            <div className="flex items-start">
              <Shield className="text-amber-600 mr-3 mt-1" size={20} />
              <div>
                <h4 className="font-semibold text-amber-900 mb-2">Garanzie di Privacy</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Il Transaction ID identifica la sessione di voto aggregata, non il contenuto specifico del tuo voto</li>
                  <li>• {receiptData.transaction ? 
                      `Il tuo voto è stato mixato con altri ${receiptData.transaction.voterCount - 1} voti rendendo impossibile risalire alla tua identità` :
                      'Il tuo voto sarà aggregato con altri voti per garantire l\'anonimato'
                    }</li>
                  <li>• Solo tu conosci il candidato per cui hai votato, questa ricevuta non lo rivela</li>
                  <li>• Le informazioni crittografiche mostrate garantiscono integrità senza compromettere l'anonimato</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer con azioni */}
        <div className="bg-white rounded-b-xl shadow-lg p-6">
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <button
              onClick={downloadReceipt}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download size={18} className="mr-2" />
              Scarica Ricevuta
            </button>
            
            <button
              onClick={printReceipt}
              className="flex items-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Printer size={18} className="mr-2" />
              Stampa
            </button>

            {receiptData.transaction?.txid && (
              <button
                onClick={openBlockchainExplorer}
                className="flex items-center px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <ExternalLink size={18} className="mr-2" />
                Verifica su Blockchain
              </button>
            )}

            <button
              onClick={() => copyToClipboard(receiptData.transaction?.txid || receiptData.voteData.voteId)}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              {copied ? <CheckCircle size={18} className="mr-2" /> : <Copy size={18} className="mr-2" />}
              {copied ? 'Copiato!' : 'Copia ID'}
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showTechnicalDetails ? 'Nascondi' : 'Mostra'} Dettagli Tecnici
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>Sistema E-Voting WabiSabi • Protocollo {receiptData.session.protocolVersion}</p>
            <p>Ricevuta generata il {formatTimestamp(receiptData.metadata.receiptGeneratedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoteReceipt;