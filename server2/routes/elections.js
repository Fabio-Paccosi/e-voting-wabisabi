// Route per verificare accesso elezione con indirizzo Bitcoin

const BitcoinWalletService = require('../shared/services/BitcoinWalletService');

// POST /api/elections/verify-access - Verifica accesso elezione con indirizzo Bitcoin
router.post('/verify-access', authMiddleware, async (req, res) => {
    try {
        const { electionId, bitcoinAddress } = req.body;
        const userId = req.user.id;

        console.log(`[ELECTION-ACCESS] 🔍 Verifica accesso utente ${userId} con indirizzo ${bitcoinAddress} per elezione ${electionId}`);

        // Validazioni input
        if (!electionId || !bitcoinAddress) {
            return res.status(400).json({ 
                success: false,
                error: 'ElectionId e bitcoinAddress sono obbligatori' 
            });
        }

        // Verifica che l'elezione esista e sia attiva
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ 
                success: false,
                error: 'Elezione non trovata' 
            });
        }

        if (election.status !== 'active') {
            return res.status(400).json({ 
                success: false,
                error: 'Elezione non attiva' 
            });
        }

        // Valida l'indirizzo Bitcoin
        const walletService = new BitcoinWalletService();
        if (!walletService.isValidAddress(bitcoinAddress)) {
            return res.status(400).json({ 
                success: false,
                error: 'Indirizzo Bitcoin non valido' 
            });
        }

        // Cerca l'utente nella whitelist dell'elezione con l'indirizzo Bitcoin corrispondente
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: {
                electionId,
                userId,
                bitcoinAddress: bitcoinAddress.trim()
            },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'email', 'firstName', 'lastName']
            }]
        });

        if (!whitelistEntry) {
            console.log(`[ELECTION-ACCESS] ❌ Utente ${userId} non trovato nella whitelist o indirizzo Bitcoin non corrispondente`);
            return res.status(403).json({ 
                success: false,
                error: 'Non sei autorizzato per questa elezione con questo indirizzo Bitcoin' 
            });
        }

        // Verifica che l'utente non abbia già votato
        if (whitelistEntry.hasVoted) {
            console.log(`[ELECTION-ACCESS] ⚠️ Utente ${userId} ha già votato`);
            return res.status(400).json({ 
                success: false,
                error: 'Hai già espresso il tuo voto per questa elezione' 
            });
        }

        // Verifica che abbia un wallet Bitcoin valido
        if (!whitelistEntry.hasValidBitcoinWallet()) {
            console.log(`[ELECTION-ACCESS] ❌ Wallet Bitcoin non valido per utente ${userId}`);
            return res.status(500).json({ 
                success: false,
                error: 'Wallet Bitcoin non configurato correttamente' 
            });
        }

        console.log(`[ELECTION-ACCESS] ✅ Accesso autorizzato per ${whitelistEntry.user.email}`);

        res.json({
            success: true,
            message: 'Accesso autorizzato',
            user: {
                id: whitelistEntry.user.id,
                email: whitelistEntry.user.email,
                name: `${whitelistEntry.user.firstName} ${whitelistEntry.user.lastName}`
            },
            election: {
                id: election.id,
                title: election.title,
                status: election.status,
                network: election.blockchainNetwork
            },
            bitcoinWallet: {
                address: whitelistEntry.bitcoinAddress,
                hasUTXO: whitelistEntry.hasAvailableUTXO(),
                utxoAmount: whitelistEntry.utxoAmount
            }
        });

    } catch (error) {
        console.error('[ELECTION-ACCESS] ❌ Errore verifica accesso:', error);
        res.status(500).json({ 
            success: false,
            error: 'Errore interno durante la verifica dell\'accesso',
            details: error.message 
        });
    }
});

// GET /api/elections/:electionId/candidates - Lista candidati per un'elezione (aggiornato)
router.get('/:electionId/candidates', authMiddleware, async (req, res) => {
    try {
        const { electionId } = req.params;
        const userId = req.user.id;

        console.log(`[ELECTION-CANDIDATES] 👥 Caricamento candidati per elezione ${electionId}, utente ${userId}`);

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        // Verifica che l'utente sia autorizzato (opzionale, dipende dai requisiti)
        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { electionId, userId }
        });

        if (!whitelistEntry) {
            return res.status(403).json({ error: 'Non sei autorizzato per questa elezione' });
        }

        // Carica i candidati
        const candidates = await Candidate.findAll({
            where: { electionId },
            attributes: [
                'id', 'name', 'party', 
                'biography', 'voteEncoding', 'bitcoinAddress'
            ],
            order: [['voteEncoding', 'ASC']]
        });

        res.json({
            success: true,
            election: {
                id: election.id,
                title: election.title,
                status: election.status
            },
            candidates: candidates.map(candidate => ({
                id: candidate.id,
                name: candidate.name,
                //firstName: candidate.firstName,
                //lastName: candidate.lastName,
                party: candidate.party,
                biography: candidate.biography,
                voteEncoding: candidate.voteEncoding,
                bitcoinAddress: candidate.bitcoinAddress
            })),
            userAccess: {
                hasVoted: whitelistEntry.hasVoted,
                bitcoinAddress: whitelistEntry.bitcoinAddress
            }
        });

    } catch (error) {
        console.error('[ELECTION-CANDIDATES] ❌ Errore caricamento candidati:', error);
        res.status(500).json({ 
            error: 'Errore nel caricamento dei candidati',
            details: error.message 
        });
    }
});