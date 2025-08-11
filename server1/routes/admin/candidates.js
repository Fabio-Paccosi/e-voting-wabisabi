// server1/routes/admin/candidates.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bitcoinjs = require('bitcoinjs-lib');
const ecc = require('tiny-secp256k1');

// Inizializza bitcoinjs-lib con secp256k1
bitcoinjs.initEccLib(ecc);

// Funzione per generare indirizzo Bitcoin deterministico
async function generateBitcoinAddress(electionId, candidateName, network = 'testnet') {
    try {
        // Usa testnet o mainnet
        const btcNetwork = network === 'mainnet' 
            ? bitcoinjs.networks.bitcoin 
            : bitcoinjs.networks.testnet;

        // Genera seed deterministico basato su elezione e candidato
        const seed = crypto.createHash('sha256')
            .update(`${electionId}-${candidateName}-${Date.now()}`)
            .digest();

        // Genera coppia di chiavi
        const keyPair = bitcoinjs.ECPair.fromPrivateKey(seed, { network: btcNetwork });

        // Genera indirizzo P2WPKH (SegWit nativo)
        const { address } = bitcoinjs.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: btcNetwork
        });

        // Salva la chiave privata in modo sicuro (in produzione usa HSM o key vault)
        // Per ora la salviamo encrypted nel database
        const encryptedPrivateKey = encryptPrivateKey(keyPair.privateKey.toString('hex'));

        return {
            address,
            publicKey: keyPair.publicKey.toString('hex'),
            encryptedPrivateKey // Da salvare in modo sicuro
        };
    } catch (error) {
        console.error('Errore generazione indirizzo Bitcoin:', error);
        throw new Error('Impossibile generare indirizzo Bitcoin');
    }
}

// Funzione per criptare la chiave privata
function encryptPrivateKey(privateKey) {
    const algorithm = 'aes-256-gcm';
    const password = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key';
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

// POST /api/admin/elections/:electionId/candidates - Aggiungi candidato
router.post('/elections/:electionId/candidates', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;
        const { firstName, lastName, party, biography, photo } = req.body;

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere aggiunta candidati se elezione è attiva
        if (election.status === 'active' || election.status === 'completed') {
            return res.status(400).json({ 
                error: 'Non è possibile aggiungere candidati a un\'elezione attiva o completata' 
            });
        }

        // Conta candidati esistenti per assegnare valueEncoding
        const candidateCount = await Candidate.count({ where: { electionId } });

        // Genera indirizzo Bitcoin univoco per il candidato
        const bitcoinData = await generateBitcoinAddress(
            electionId,
            `${firstName}-${lastName}`,
            election.blockchainNetwork
        );

        // Crea il candidato
        const candidate = await Candidate.create({
            electionId,
            firstName,
            lastName,
            party,
            biography,
            photo,
            bitcoinAddress: bitcoinData.address,
            bitcoinPublicKey: bitcoinData.publicKey,
            valueEncoding: candidateCount
        });

        // Salva la chiave privata criptata in una tabella sicura separata
        await CandidateKeys.create({
            candidateId: candidate.id,
            encryptedPrivateKey: JSON.stringify(bitcoinData.encryptedPrivateKey),
            createdBy: req.admin.id
        });

        res.status(201).json({
            success: true,
            candidate: {
                ...candidate.toJSON(),
                bitcoinAddress: bitcoinData.address
            },
            message: 'Candidato creato con successo'
        });
    } catch (error) {
        console.error('Errore creazione candidato:', error);
        res.status(500).json({ error: 'Errore nella creazione del candidato' });
    }
});

// PUT /api/admin/candidates/:id - Modifica candidato
router.put('/candidates/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const candidate = await Candidate.findByPk(id, {
            include: [{
                model: Election,
                as: 'election'
            }]
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato non trovato' });
        }

        // Non permettere modifiche se l'elezione è attiva
        if (['active', 'completed'].includes(candidate.election.status)) {
            return res.status(400).json({ 
                error: 'Non è possibile modificare candidati di un\'elezione attiva' 
            });
        }

        // Non permettere modifica dell'indirizzo Bitcoin
        delete updates.bitcoinAddress;
        delete updates.bitcoinPublicKey;
        delete updates.valueEncoding;

        await candidate.update(updates);

        res.json({
            success: true,
            candidate,
            message: 'Candidato aggiornato con successo'
        });
    } catch (error) {
        console.error('Errore aggiornamento candidato:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento del candidato' });
    }
});

// DELETE /api/admin/candidates/:id - Elimina candidato
router.delete('/candidates/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await Candidate.findByPk(id, {
            include: [{
                model: Election,
                as: 'election'
            }]
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato non trovato' });
        }

        if (['active', 'completed'].includes(candidate.election.status)) {
            return res.status(400).json({ 
                error: 'Non è possibile eliminare candidati di un\'elezione attiva' 
            });
        }

        await candidate.destroy();

        // Riassegna valueEncoding ai candidati rimanenti
        const remainingCandidates = await Candidate.findAll({
            where: { electionId: candidate.electionId },
            order: [['createdAt', 'ASC']]
        });

        for (let i = 0; i < remainingCandidates.length; i++) {
            await remainingCandidates[i].update({ valueEncoding: i });
        }

        res.json({
            success: true,
            message: 'Candidato eliminato con successo'
        });
    } catch (error) {
        console.error('Errore eliminazione candidato:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione del candidato' });
    }
});