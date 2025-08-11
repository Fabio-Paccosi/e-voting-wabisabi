const express = require('express');
const router = express.Router();
const bitcoinjs = require('bitcoinjs-lib');
const { Election, Candidate, ElectionWhitelist } = require('../../../database/models');

// GET /api/admin/elections - Lista tutte le elezioni
router.get('/elections', adminAuth, async (req, res) => {
    try {
        const elections = await Election.findAll({
            include: [
                {
                    model: Candidate,
                    as: 'candidates'
                },
                {
                    model: ElectionWhitelist,
                    as: 'whitelist',
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['firstName', 'lastName', 'email']
                    }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, elections });
    } catch (error) {
        console.error('Errore recupero elezioni:', error);
        res.status(500).json({ error: 'Errore interno del server' });
    }
});

// POST /api/admin/elections - Crea nuova elezione
router.post('/elections', adminAuth, async (req, res) => {
    try {
        const {
            title,
            description,
            startDate,
            endDate,
            coinjoinTrigger,
            coinjoinEnabled,
            maxVotersAllowed,
            votingMethod,
            blockchainNetwork,
            candidates
        } = req.body;

        // Validazione date
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({ 
                error: 'La data di fine deve essere successiva alla data di inizio' 
            });
        }

        // Crea elezione
        const election = await Election.create({
            title,
            description,
            startDate,
            endDate,
            coinjoinTrigger: coinjoinTrigger || 10,
            coinjoinEnabled: coinjoinEnabled !== false,
            maxVotersAllowed,
            votingMethod: votingMethod || 'single',
            blockchainNetwork: blockchainNetwork || 'testnet',
            status: 'draft'
        });

        // Se ci sono candidati, creali
        if (candidates && candidates.length > 0) {
            for (let i = 0; i < candidates.length; i++) {
                const candidateData = candidates[i];
                
                // Genera indirizzo Bitcoin per il candidato
                const { address, publicKey } = await generateBitcoinAddress(
                    election.id, 
                    candidateData.firstName + candidateData.lastName,
                    blockchainNetwork
                );

                await Candidate.create({
                    electionId: election.id,
                    firstName: candidateData.firstName,
                    lastName: candidateData.lastName,
                    party: candidateData.party,
                    biography: candidateData.biography,
                    photo: candidateData.photo,
                    bitcoinAddress: address,
                    bitcoinPublicKey: publicKey,
                    valueEncoding: i // Assegna valore progressivo per codifica
                });
            }
        }

        const createdElection = await Election.findByPk(election.id, {
            include: [{ model: Candidate, as: 'candidates' }]
        });

        res.status(201).json({ 
            success: true, 
            election: createdElection,
            message: 'Elezione creata con successo'
        });
    } catch (error) {
        console.error('Errore creazione elezione:', error);
        res.status(500).json({ error: 'Errore nella creazione dell\'elezione' });
    }
});

// PUT /api/admin/elections/:id - Modifica elezione
router.put('/elections/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const election = await Election.findByPk(id);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Non permettere modifiche se l'elezione è attiva o completata
        if (['active', 'completed'].includes(election.status)) {
            return res.status(400).json({ 
                error: 'Non è possibile modificare un\'elezione attiva o completata' 
            });
        }

        await election.update(updates);

        res.json({ 
            success: true, 
            election,
            message: 'Elezione aggiornata con successo'
        });
    } catch (error) {
        console.error('Errore aggiornamento elezione:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'elezione' });
    }
});

// POST /api/admin/elections/:id/activate - Attiva elezione
router.post('/elections/:id/activate', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const election = await Election.findByPk(id, {
            include: [
                { model: Candidate, as: 'candidates' },
                { model: ElectionWhitelist, as: 'whitelist' }
            ]
        });

        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Validazioni
        if (election.candidates.length < 2) {
            return res.status(400).json({ 
                error: 'L\'elezione deve avere almeno 2 candidati' 
            });
        }

        if (election.whitelist.length === 0) {
            return res.status(400).json({ 
                error: 'L\'elezione deve avere almeno un utente nella whitelist' 
            });
        }

        const now = new Date();
        if (now < new Date(election.startDate)) {
            return res.status(400).json({ 
                error: 'L\'elezione non può essere attivata prima della data di inizio' 
            });
        }

        await election.update({ status: 'active' });

        // Notifica gli utenti nella whitelist (implementa sistema di notifiche)
        await notifyWhitelistUsers(election.id);

        res.json({ 
            success: true, 
            message: 'Elezione attivata con successo',
            election
        });
    } catch (error) {
        console.error('Errore attivazione elezione:', error);
        res.status(500).json({ error: 'Errore nell\'attivazione dell\'elezione' });
    }
});