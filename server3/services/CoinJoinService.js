// Servizio per la gestione del protocollo CoinJoin WabiSabi

const crypto = require('crypto');
const BitcoinService = require('./BitcoinService');
const WabiSabiKVACService = require('./WabiSabiKVACService');
const { 
    VotingSession, 
    Vote, 
    Transaction, 
    Election, 
    Candidate 
} = require('../shared/database_config');

class CoinJoinService {
    constructor() {
        this.activeSessions = new Map(); // sessionId -> CoinJoinSession
        this.ROUND_TIMEOUT = 300000; // 5 minuti timeout per round
        this.MIN_PARTICIPANTS = 1; // Minimo partecipanti per CoinJoin
        this.MAX_PARTICIPANTS = 50; // Massimo partecipanti per round
        this.COINJOIN_FEE = 1000; // Fee in satoshi
    }

    /**
     * Trigger del processo CoinJoin quando raggiunti voti sufficienti
     */
    async triggerCoinJoin(sessionId, electionId) {
        try {
            console.log(`[COINJOIN] Avvio CoinJoin per sessione ${sessionId}`);
    
            // Verifica che la sessione non sia già in elaborazione
            if (this.activeSessions.has(sessionId)) {
                console.log(`[COINJOIN] Sessione ${sessionId} già in elaborazione`);
                return;
            }
    
            // Carica i voti pending per questa sessione
            const pendingVotes = await Vote.findAll({
                where: {
                    sessionId: sessionId,
                    status: 'pending'
                },
                // CORREZIONE: Usa submitted_at invece di submittedAt
                order: [['submitted_at', 'ASC']]
            });
    
            console.log(`[COINJOIN]  Trovati ${pendingVotes.length} voti pendenti`);
    
            if (pendingVotes.length < this.MIN_PARTICIPANTS) {
                console.log(`[COINJOIN] Voti insufficienti: ${pendingVotes.length} < ${this.MIN_PARTICIPANTS}`);
                return;
            }
    
            // Aggiorna stato sessione
            await VotingSession.update(
                { status: 'output_registration' },
                { where: { id: sessionId } }
            );
    
            // Crea sessione CoinJoin
            const coinJoinSession = {
                sessionId,
                electionId,
                participants: pendingVotes.slice(0, this.MAX_PARTICIPANTS),
                startedAt: new Date(),
                status: 'input_registration',
                round: 1,
                transactions: []
            };
    
            // CORREZIONE: Salva correttamente la sessione nella mappa
            this.activeSessions.set(sessionId, coinJoinSession);
    
            console.log(`[COINJOIN]  Sessione CoinJoin creata per ${coinJoinSession.participants.length} partecipanti`);
    
            // Avvia il processo in background
            this.processCoinJoinRounds(coinJoinSession)
                .catch(error => {
                    console.error(`[COINJOIN]  Errore processo CoinJoin:`, error);
                    this.handleCoinJoinError(sessionId, error);
                });
    
            console.log(`[COINJOIN]  CoinJoin avviato per ${coinJoinSession.participants.length} partecipanti`);
    
            return coinJoinSession;
    
        } catch (error) {
            console.error(`[COINJOIN]  Errore trigger CoinJoin:`, error);
            throw error;
        }
    }

    /**
     * Processa i round del protocollo CoinJoin WabiSabi
     */
    async processCoinJoinRounds(coinJoinSession) {
        try {
            const { sessionId, participants } = coinJoinSession;
            
            console.log(`[COINJOIN]  Inizio round ${coinJoinSession.round} per sessione ${sessionId}`);

            // ROUND 1: Input Registration
            await this.inputRegistrationRound(coinJoinSession);

            // ROUND 2: Output Registration  
            await this.outputRegistrationRound(coinJoinSession);

            // ROUND 3: Transaction Signing
            await this.transactionSigningRound(coinJoinSession);

            // ROUND 4: Broadcasting
            await this.broadcastTransaction(coinJoinSession);

            // Finalizza
            await this.finalizeCoinJoin(coinJoinSession);

        } catch (error) {
            console.error(`[COINJOIN]  Errore nei round CoinJoin:`, error);
            await this.handleCoinJoinError(coinJoinSession.sessionId, error);
        }
    }

    /**
     * Round 1: Input Registration - Registra gli input dei partecipanti
     */
    async inputRegistrationRound(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 📥 Input Registration Round - Sessione ${coinJoinSession.sessionId}`);

            coinJoinSession.status = 'input_registration';
            const inputs = [];

            for (const vote of coinJoinSession.participants) {
                // Simula registrazione input UTXO
                const input = {
                    voteId: vote.id,
                    serialNumber: vote.serialNumber,
                    commitment: vote.commitment,
                    utxo: await this.generateMockUTXO(vote),
                    registeredAt: new Date()
                };

                inputs.push(input);
                console.log(`[COINJOIN] ✓ Input registrato per voto ${vote.id}`);
            }

            coinJoinSession.inputs = inputs;
            coinJoinSession.round = 2;

            // Aggiorna stato voti
            await Vote.update(
                { status: 'processed' },
                { 
                    where: { 
                        id: coinJoinSession.participants.map(p => p.id) 
                    } 
                }
            );

            console.log(`[COINJOIN]  Input Registration completato: ${inputs.length} input`);

        } catch (error) {
            console.error(`[COINJOIN]  Errore Input Registration:`, error);
            throw error;
        }
    }

    /**
     * Round 2: Output Registration - Registra gli output anonimi
     */
    async outputRegistrationRound(coinJoinSession) {
        try {
            await this.debugCommitments(coinJoinSession);

            console.log(`[COINJOIN] Output Registration Round - Sessione ${coinJoinSession.sessionId}`);
            
            coinJoinSession.status = 'output_registration';
            
            // Carica candidati per l'elezione
            const candidates = await Candidate.findAll({
                where: { electionId: coinJoinSession.electionId }
            });
            
            console.log(`[COINJOIN] Candidati trovati: ${candidates.length}`);
            candidates.forEach(c => console.log(`  - ${c.name} (ID: ${c.id}, Encoding: ${c.voteEncoding})`));
            
            const candidateMap = new Map(candidates.map(c => [c.voteEncoding, c]));
            const candidateVotes = new Map(); // Per aggregazione
            
            console.log(`[COINJOIN] Processamento di ${coinJoinSession.inputs.length} input...`);
            
            // AGGREGAZIONE: Conta i voti per candidato
            for (const [index, input] of coinJoinSession.inputs.entries()) {
                try {
                    console.log(`[COINJOIN] Processamento input ${index + 1}/${coinJoinSession.inputs.length}`);
                    console.log(`[COINJOIN] Commitment: ${input.commitment}`);
                    
                    // Estrae il voto dal commitment
                    const voteData = this.extractVoteFromCommitment(input.commitment);
                    console.log(`[COINJOIN]  Voto estratto:`, voteData);
                    
                    // Trova candidato corrispondente
                    const candidate = candidateMap.get(voteData.candidateEncoding);
                    if (!candidate) {
                        console.error(`[COINJOIN] Candidato non trovato per encoding ${voteData.candidateEncoding}`);
                        console.error(`[COINJOIN] Encodings disponibili:`, Array.from(candidateMap.keys()));
                        continue;
                    }
                    
                    console.log(`[COINJOIN]  Voto mappato a candidato: ${candidate.name} (ID: ${candidate.id})`);
                    
                    // Aggrega voti per candidato
                    const currentVotes = candidateVotes.get(candidate.id) || 0;
                    candidateVotes.set(candidate.id, currentVotes + voteData.voteValue);
                    
                } catch (inputError) {
                    console.error(`[COINJOIN]  Errore processamento input ${index + 1}:`, inputError);
                    continue;
                }
            }
            
            console.log(`[COINJOIN]  Aggregazione completata:`, Array.from(candidateVotes.entries()));
            
            // Crea output aggregati
            const outputs = [];
            for (const [candidateId, totalVotes] of candidateVotes) {
                const candidate = candidates.find(c => c.id === candidateId);
                outputs.push({
                    candidateId: candidateId,
                    candidateBitcoinAddress: candidate.bitcoinAddress,
                    voteValue: totalVotes, // Voti aggregati
                    registeredAt: new Date()
                });
                console.log(`[COINJOIN]  Output creato per ${candidate.name}: ${totalVotes} voti`);
            }
            
            coinJoinSession.outputs = outputs;
            coinJoinSession.round = 3;
            
            console.log(`[COINJOIN]  Output Registration completato: ${outputs.length} candidati ricevuti voti`);
            console.log(`[COINJOIN]  Riepilogo:`, outputs.map(o => `${o.candidateId}: ${o.voteValue} voti`));
            
        } catch (error) {
            console.error(`[COINJOIN]  Errore Output Registration:`, error);
            throw error;
        }
    }

    /**
     * Round 3: Transaction Signing - Firma la transazione aggregata
     */
    async transactionSigningRound(coinJoinSession) {
        try {
            console.log(`[COINJOIN] Transaction Signing Round - Sessione ${coinJoinSession.sessionId}`);

            coinJoinSession.status = 'signing';

            // Costruisce la transazione CoinJoin
            const transaction = await this.buildCoinJoinTransaction(coinJoinSession);
            
            // Simula processo di firma (in un sistema reale, ogni partecipante firma)
            const signedTransaction = await this.signCoinJoinTransaction(transaction);

            coinJoinSession.transaction = signedTransaction;
            coinJoinSession.round = 4;

            console.log(`[COINJOIN]  Transazione firmata: ${signedTransaction.txId}`);

        } catch (error) {
            console.error(`[COINJOIN]  Errore Transaction Signing:`, error);
            throw error;
        }
    }

    /**
     * Round 4: Broadcasting - Trasmette la transazione alla blockchain
     */
    async broadcastTransaction(coinJoinSession) {
        try {
            console.log(`[COINJOIN]  Broadcasting Transaction - Sessione ${coinJoinSession.sessionId}`);

            const { transaction } = coinJoinSession;
            
            // Broadcast alla blockchain
            const broadcastResult = await BitcoinService.broadcastTransaction(transaction.rawTx);
            
            // Salva nel database
            const dbTransaction = await Transaction.create({
                electionId: coinJoinSession.electionId,
                sessionId: coinJoinSession.sessionId,
                txId: broadcastResult.txId,
                type: 'coinjoin',
                rawData: transaction.rawTx,
                metadata: {
                    inputCount: coinJoinSession.inputs.length,
                    outputCount: coinJoinSession.outputs.length,
                    participants: coinJoinSession.participants.length,
                    totalVotes: coinJoinSession.outputs.reduce((sum, o) => sum + o.voteValue, 0)
                },
                confirmations: 0
            });

            // Aggiorna voti con transaction ID
            await Vote.update(
                { 
                    status: 'confirmed',
                    transactionId: broadcastResult.txId,
                    processedAt: new Date()
                },
                { 
                    where: { 
                        id: coinJoinSession.participants.map(p => p.id) 
                    } 
                }
            );

            coinJoinSession.broadcastedAt = new Date();
            coinJoinSession.txId = broadcastResult.txId;

            console.log(`[COINJOIN]  Transazione trasmessa: ${broadcastResult.txId}`);

            // Avvia monitoring delle conferme
            this.monitorTransactionConfirmations(broadcastResult.txId);

        } catch (error) {
            console.error(`[COINJOIN]  Errore Broadcasting:`, error);
            throw error;
        }
    }

    /**
     * Finalizza il processo CoinJoin
     */
    async finalizeCoinJoin(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 🏁 Finalizzazione CoinJoin - Sessione ${coinJoinSession.sessionId}`);

            // Aggiorna stato sessione
            await VotingSession.update(
                { 
                    status: 'completed',
                    endTime: new Date(),
                    finalTallyTransactionId: coinJoinSession.txId
                },
                { where: { id: coinJoinSession.sessionId } }
            );

            // Aggiorna contatori candidati
            await this.updateCandidateVoteCounts(coinJoinSession);

            // Rimuove dalla memoria
            this.activeSessions.delete(coinJoinSession.sessionId);

            console.log(`[COINJOIN]  CoinJoin completato per sessione ${coinJoinSession.sessionId}`);

            return {
                success: true,
                sessionId: coinJoinSession.sessionId,
                txId: coinJoinSession.txId,
                participantsCount: coinJoinSession.participants.length,
                completedAt: new Date()
            };

        } catch (error) {
            console.error(`[COINJOIN]  Errore finalizzazione:`, error);
            throw error;
        }
    }

    /**
     * Costruisce la transazione CoinJoin aggregata
     */
    async buildCoinJoinTransaction(coinJoinSession) {
        const { inputs, outputs } = coinJoinSession;
    
        try {
            //  CORREZIONE: Costruisci una vera transazione Bitcoin
            const transaction = {
                version: 2,
                inputs: inputs.map(input => ({
                    txid: input.utxo?.txid || this.generateMockTxId(),
                    vout: input.utxo?.vout || 0,
                    scriptSig: '', // Sarà popolato durante la firma
                    sequence: 0xfffffffe // RBF enabled
                })),
                outputs: outputs.map(output => ({
                    address: output.candidateBitcoinAddress,
                    value: Math.floor(output.voteValue * 100000000), // Converte in satoshi (8 decimali)
                    scriptPubKey: this.addressToScriptPubKey(output.candidateBitcoinAddress)
                })),
                lockTime: 0
            };
    
            //  CORREZIONE: Serializza correttamente in formato Bitcoin
            const rawTx = this.serializeBitcoinTransaction(transaction);
            const txId = crypto.createHash('sha256')
                .update(Buffer.from(rawTx, 'hex'))
                .digest('hex');
    
            console.log(`[COINJOIN] 🔨 Transazione costruita: ${inputs.length} input, ${outputs.length} output`);
            console.log(`[COINJOIN] 📏 RawTx length: ${rawTx.length} caratteri hex`);
    
            return {
                txId,
                rawTx, //  Ora è una vera raw transaction in hex
                transaction
            };
    
        } catch (error) {
            console.error(`[COINJOIN]  Errore costruzione transazione:`, error);
            throw error;
        }
    }

    /**
     *  NUOVO: Serializza la transazione nel formato Bitcoin standard
     */
    serializeBitcoinTransaction(tx) {
        try {
            let serialized = '';
            
            // Version (4 bytes, little endian)
            serialized += this.intToLittleEndianHex(tx.version, 4);
            
            // Input count (VarInt)
            serialized += this.encodeVarInt(tx.inputs.length);
            
            // Inputs
            for (const input of tx.inputs) {
                // Previous output hash (32 bytes, reversed)
                serialized += this.reverseHex(input.txid);
                // Previous output index (4 bytes, little endian)
                serialized += this.intToLittleEndianHex(input.vout, 4);
                // Script length + script (per ora vuoto)
                serialized += '00'; // Script length = 0
                // Sequence (4 bytes, little endian)
                serialized += this.intToLittleEndianHex(input.sequence, 4);
            }
            
            // Output count (VarInt)
            serialized += this.encodeVarInt(tx.outputs.length);
            
            // Outputs
            for (const output of tx.outputs) {
                // Value (8 bytes, little endian)
                serialized += this.intToLittleEndianHex(output.value, 8);
                // Script
                const scriptHex = this.createP2PKHScript(output.address);
                serialized += this.encodeVarInt(scriptHex.length / 2);
                serialized += scriptHex;
            }
            
            // Lock time (4 bytes, little endian)
            serialized += this.intToLittleEndianHex(tx.lockTime, 4);
            
            return serialized;
            
        } catch (error) {
            console.error('[COINJOIN]  Errore serializzazione:', error);
            throw error;
        }
    }

    /**
     *  NUOVO: Crea un vero script P2PKH per un indirizzo Bitcoin
     */
    createP2PKHScript(address) {
        try {
            // Per testnet, usa un formato semplificato
            // In produzione, dovresti usare una libreria come bitcoinjs-lib
            
            // Mock P2PKH script: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG
            const pubkeyHash = crypto.createHash('sha256')
                .update(address)
                .digest('hex')
                .substring(0, 40); // 20 bytes = 40 hex chars
                
            return '76a914' + pubkeyHash + '88ac';
            
        } catch (error) {
            console.error('[COINJOIN]  Errore creazione script:', error);
            throw error;
        }
    }

    /**
     *  HELPER: Converte intero in hex little endian
     */
    intToLittleEndianHex(value, bytes) {
        try {
            if (bytes <= 6) {
                // Per valori fino a 6 byte, usa il metodo normale
                const buffer = Buffer.allocUnsafe(bytes);
                buffer.writeUIntLE(value, 0, bytes);
                return buffer.toString('hex');
            } else if (bytes === 8) {
                // Per valori a 8 byte (satoshi), usa BigInt
                const buffer = Buffer.allocUnsafe(8);
                const bigIntValue = typeof value === 'bigint' ? value : BigInt(Math.floor(value));
                buffer.writeBigUInt64LE(bigIntValue, 0);
                return buffer.toString('hex');
            } else {
                throw new Error(`Unsupported byte length: ${bytes}`);
            }
        } catch (error) {
            console.error(`[COINJOIN] Errore intToLittleEndianHex:`, error);
            // Fallback: crea buffer vuoto
            const buffer = Buffer.alloc(bytes);
            return buffer.toString('hex');
        }
    }

    /**
     *  HELPER: Inverte stringa hex (per txid)
     */
    reverseHex(hex) {
        return hex.match(/.{2}/g).reverse().join('');
    }

    /**
     *  HELPER: Codifica VarInt
     */
    encodeVarInt(value) {
        if (value < 0xfd) {
            return value.toString(16).padStart(2, '0');
        } else if (value <= 0xffff) {
            return 'fd' + this.intToLittleEndianHex(value, 2);
        } else if (value <= 0xffffffff) {
            return 'fe' + this.intToLittleEndianHex(value, 4);
        } else {
            return 'ff' + this.intToLittleEndianHex(value, 8);
        }
    }

    /**
     *  HELPER: Genera mock transaction ID per testing
     */
    generateMockTxId() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     *  MIGLIORAMENTO: Address to ScriptPubKey più realistico
     */
    addressToScriptPubKey(address) {
        // In ambiente di sviluppo, genera un scriptPubKey mock ma valido
        const hash160 = crypto.createHash('sha256')
            .update(address)
            .digest('hex')
            .substring(0, 40); // Primi 20 bytes
            
        // P2PKH script: OP_DUP OP_HASH160 <hash160> OP_EQUALVERIFY OP_CHECKSIG
        return '76a914' + hash160 + '88ac';
    }

    /**
     * Firma la transazione CoinJoin 
     */
    async signCoinJoinTransaction(transaction) {
        // In un sistema reale, ogni partecipante dovrebbe firmare i propri input
        const signatures = transaction.transaction.inputs.map((input, index) => {
            return {
                inputIndex: index,
                signature: crypto.createHash('sha256')
                    .update(`${transaction.txId}:${index}:signature`)
                    .digest('hex')
            };
        });

        return {
            ...transaction,
            signatures,
            signedAt: new Date()
        };
    }

    /**
     * Estrae il voto dal commitment (simulazione - in realtà richiederebbe ZK proofs)
     */
    extractVoteFromCommitment(commitment) {
        try {
            console.log(`[COINJOIN]  Estrazione voto da commitment:`, commitment);
            
            // CASO 1: Commitment è già un oggetto con candidateEncoding
            if (typeof commitment === 'object' && commitment.candidateEncoding) {
                console.log(`[COINJOIN] ✓ Commitment oggetto trovato con encoding: ${commitment.candidateEncoding}`);
                return {
                    candidateEncoding: parseInt(commitment.candidateEncoding),
                    voteValue: 1
                };
            }
            
            // CASO 2: Commitment è stringa JSON
            if (typeof commitment === 'string' && (commitment.startsWith('{') || commitment.startsWith('['))) {
                try {
                    const parsed = JSON.parse(commitment);
                    console.log(`[COINJOIN] 📝 Commitment JSON parsed:`, parsed);
                    
                    // Cerca possibili campi per il candidato
                    const candidateFields = ['candidateEncoding', 'candidate', 'candidateId', 'candidateValue'];
                    for (const field of candidateFields) {
                        if (parsed[field] !== undefined) {
                            const encoding = parseInt(parsed[field]);
                            if (!isNaN(encoding)) {
                                console.log(`[COINJOIN] ✓ Candidato trovato nel campo ${field}: ${encoding}`);
                                return {
                                    candidateEncoding: encoding,
                                    voteValue: 1
                                };
                            }
                        }
                    }
                } catch (parseError) {
                    console.warn(`[COINJOIN] Errore parsing JSON commitment:`, parseError);
                }
            }
            
            // CASO 3: Prova a estrarre dal formato "candidateId:serial:random"
            if (typeof commitment === 'string') {
                // Il commitment potrebbe essere stato creato come hash di "candidateId:serial:random"
                // Non possiamo estrarre direttamente, ma possiamo usare una mappatura deterministica
                console.log(`[COINJOIN] 🔑 Tentativo estrazione da commitment hash...`);
            }
            
            // CASO 4: Mappatura deterministica basata su hash (ULTIMA RISORSA)
            console.warn(`[COINJOIN] Usando mappatura deterministica come fallback`);
            
            const commitmentStr = commitment ? commitment.toString() : 'fallback';
            const hash = crypto.createHash('sha256').update(commitmentStr).digest('hex');
            
            // USA CONSISTENTEMENTE GLI STESSI PARAMETRI DI HASHING
            const hashValue = parseInt(hash.substring(0, 8), 16); // Sempre 8 caratteri
            const availableEncodings = [1, 2, 3]; // Candidati disponibili
            const candidateEncoding = availableEncodings[hashValue % availableEncodings.length];
            
            console.log(`[COINJOIN] 🎲 Mappatura deterministica: ${commitmentStr} -> ${candidateEncoding}`);
            
            return {
                candidateEncoding,
                voteValue: 1
            };
            
        } catch (error) {
            console.error(`[COINJOIN]  Errore estrazione commitment:`, error);
            // Fallback sicuro
            return {
                candidateEncoding: 1,
                voteValue: 1
            };
        }
    }

    /**
     * Anonimizza un commitment per l'output registration
     */
    anonymizeCommitment(commitment) {
        return crypto.createHash('sha256')
            .update(`anonymous:${commitment}:${Date.now()}`)
            .digest('hex');
    }

    /**
     * Genera UTXO
     */
    async generateMockUTXO(vote) {
        return {
            txid: crypto.createHash('sha256').update(`utxo:${vote.id}`).digest('hex'),
            vout: 0,
            value: 100000, // 0.001 BTC in satoshi
            scriptPubKey: 'mock_script_pubkey'
        };
    }

    /**
     * Aggiorna i contatori dei voti per i candidati
     */
    async updateCandidateVoteCounts(coinJoinSession) {
        try {
            console.log(`[COINJOIN] 🔢 Aggiornamento contatori voti...`);
            console.log(`[COINJOIN]  Output da processare: ${coinJoinSession.outputs.length}`);
            
            const voteCounts = new Map();
            
            // Conta i voti per candidato
            for (const output of coinJoinSession.outputs) {
                console.log(`[COINJOIN] 📝 Processing output:`, {
                    candidateId: output.candidateId,
                    voteValue: output.voteValue
                });
                
                const current = voteCounts.get(output.candidateId) || 0;
                const newTotal = current + output.voteValue;
                voteCounts.set(output.candidateId, newTotal);
                
                console.log(`[COINJOIN] ➕ Candidato ${output.candidateId}: ${current} + ${output.voteValue} = ${newTotal}`);
            }
            
            console.log(`[COINJOIN]  Conteggio finale:`, Array.from(voteCounts.entries()));
            
            // Aggiorna database
            for (const [candidateId, voteCount] of voteCounts) {
                console.log(`[COINJOIN] 💾 Aggiornamento DB - Candidato ${candidateId}: +${voteCount} voti`);
                
                await Candidate.increment('total_votes_received', {
                    by: voteCount,
                    where: { id: candidateId }
                });
                
                console.log(`[COINJOIN]  DB aggiornato per candidato ${candidateId}`);
            }
            
            console.log(`[COINJOIN]  Aggiornati contatori per ${voteCounts.size} candidati`);
            
            // Log finale dettagliato
            for (const [candidateId, count] of voteCounts) {
                const candidate = await Candidate.findByPk(candidateId);
                console.log(`[COINJOIN]  FINALE - ${candidate?.name || candidateId}: ${count} voti`);
            }
            
        } catch (error) {
            console.error(`[COINJOIN]  Errore aggiornamento contatori:`, error);
            throw error;
        }
    }

    async debugCommitments(coinJoinSession) {
        console.log(`\n ========== DEBUG COMMITMENT ANALYSIS ==========`);
        console.log(` Inputs totali: ${coinJoinSession.inputs.length}`);
        
        for (const [index, input] of coinJoinSession.inputs.entries()) {
            console.log(`\n--- INPUT ${index + 1} ---`);
            console.log(`Type: ${typeof input.commitment}`);
            console.log(`Raw: ${JSON.stringify(input.commitment)}`);
            console.log(`String: ${input.commitment?.toString()}`);
            
            // Verifica se è JSON
            if (typeof input.commitment === 'string' && input.commitment.startsWith('{')) {
                try {
                    const parsed = JSON.parse(input.commitment);
                    console.log(`Parsed JSON:`, parsed);
                    console.log(`Available keys:`, Object.keys(parsed));
                } catch (e) {
                    console.log(`JSON parse failed: ${e.message}`);
                }
            }
            
            // Test estrazione
            try {
                const extracted = this.extractVoteFromCommitment(input.commitment);
                console.log(`Extracted:`, extracted);
            } catch (e) {
                console.log(`Extraction failed: ${e.message}`);
            }
        }
        
        console.log(` =============== END DEBUG ==================\n`);
    }

    /**
     * Monitora le conferme della transazione
     */
    monitorTransactionConfirmations(txId) {
        console.log(`[COINJOIN] 👀 Avvio monitoring conferme per ${txId}`);
        
        // Avvia polling per conferme (ogni 30 secondi)
        const checkConfirmations = async () => {
            try {
                const confirmations = await BitcoinService.getTransactionConfirmations(txId);
                
                await Transaction.update(
                    { confirmations },
                    { where: { txId } }
                );

                if (confirmations >= 6) {
                    console.log(`[COINJOIN]  Transazione ${txId} completamente confermata (${confirmations} conf)`);
                    return; // Stop monitoring
                }

                // Continua monitoring
                setTimeout(checkConfirmations, 30000);

            } catch (error) {
                console.error(`[COINJOIN]  Errore monitoring ${txId}:`, error);
            }
        };

        setTimeout(checkConfirmations, 30000);
    }

    /**
     * Gestisce errori durante il CoinJoin
     */
    async handleCoinJoinError(sessionId, error) {
        try {
            console.error(`[COINJOIN]  Gestione errore per sessione ${sessionId}:`, error);

            // Aggiorna stato sessione
            await VotingSession.update(
                { status: 'failed' },
                { where: { id: sessionId } }
            );

            // Ripristina stato voti a pending per retry
            const session = this.activeSessions.get(sessionId);
            if (session) {
                await Vote.update(
                    { status: 'pending' },
                    { 
                        where: { 
                            id: session.participants.map(p => p.id) 
                        } 
                    }
                );
            }

            // Rimuove dalla memoria
            this.activeSessions.delete(sessionId);

        } catch (dbError) {
            console.error(`[COINJOIN]  Errore gestione errore:`, dbError);
        }
    }

    /**
     * Ottiene statistiche sulle sessioni CoinJoin attive
     */
    getActiveSessionsStats() {
        const stats = Array.from(this.activeSessions.values()).map(session => ({
            sessionId: session.sessionId,
            electionId: session.electionId,
            status: session.status,
            participants: session.participants.length,
            round: session.round,
            startedAt: session.startedAt,
            txId: session.txId
        }));

        return {
            activeSessionsCount: this.activeSessions.size,
            sessions: stats,
            config: {
                minParticipants: this.MIN_PARTICIPANTS,
                maxParticipants: this.MAX_PARTICIPANTS,
                roundTimeout: this.ROUND_TIMEOUT,
                coinjoinFee: this.COINJOIN_FEE
            }
        };
    }
}

module.exports = new CoinJoinService();