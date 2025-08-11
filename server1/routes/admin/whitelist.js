const express = require('express');
const router = express.Router();
const { User, ElectionWhitelist, Election } = require('../../../database/models');
const { Op } = require('sequelize');

// GET /api/admin/elections/:electionId/whitelist - Ottieni whitelist elezione
router.get('/elections/:electionId/whitelist', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;

        const whitelist = await ElectionWhitelist.findAll({
            where: { electionId },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'email', 'taxCode', 'status']
            }],
            order: [['authorizedAt', 'DESC']]
        });

        res.json({
            success: true,
            whitelist,
            total: whitelist.length
        });
    } catch (error) {
        console.error('Errore recupero whitelist:', error);
        res.status(500).json({ error: 'Errore nel recupero della whitelist' });
    }
});

// POST /api/admin/elections/:electionId/whitelist/add - Aggiungi utenti alla whitelist
router.post('/elections/:electionId/whitelist/add', adminAuth, async (req, res) => {
    try {
        const { electionId } = req.params;
        const { userIds, emails, taxCodes } = req.body;

        // Verifica che l'elezione esista
        const election = await Election.findByPk(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Elezione non trovata' });
        }

        let usersToAdd = [];

        // Trova utenti per ID
        if (userIds && userIds.length > 0) {
            const usersByIds = await User.findAll({
                where: { id: { [Op.in]: userIds } }
            });
            usersToAdd = [...usersToAdd, ...usersByIds];
        }

        // Trova utenti per email
        if (emails && emails.length > 0) {
            const usersByEmails = await User.findAll({
                where: { email: { [Op.in]: emails } }
            });
            usersToAdd = [...usersToAdd, ...usersByEmails];
        }

        // Trova utenti per codice fiscale
        if (taxCodes && taxCodes.length > 0) {
            const usersByTaxCodes = await User.findAll({
                where: { taxCode: { [Op.in]: taxCodes } }
            });
            usersToAdd = [...usersToAdd, ...usersByTaxCodes];
        }

        // Rimuovi duplicati
        const uniqueUsers = Array.from(new Map(usersToAdd.map(u => [u.id, u])).values());

        // Aggiungi alla whitelist
        const addedUsers = [];
        const alreadyInWhitelist = [];

        for (const user of uniqueUsers) {
            // Verifica se già nella whitelist
            const existing = await ElectionWhitelist.findOne({
                where: { electionId, userId: user.id }
            });

            if (existing) {
                alreadyInWhitelist.push(user.email);
            } else {
                await ElectionWhitelist.create({
                    electionId,
                    userId: user.id,
                    authorizedBy: req.admin.id
                });
                addedUsers.push(user.email);
            }
        }

        res.json({
            success: true,
            message: `${addedUsers.length} utenti aggiunti alla whitelist`,
            addedUsers,
            alreadyInWhitelist
        });
    } catch (error) {
        console.error('Errore aggiunta whitelist:', error);
        res.status(500).json({ error: 'Errore nell\'aggiunta alla whitelist' });
    }
});

// POST /api/admin/elections/:electionId/whitelist/import - Importa whitelist da CSV
router.post('/elections/:electionId/whitelist/import', adminAuth, uploadCSV, async (req, res) => {
    try {
        const { electionId } = req.params;
        const csvFile = req.file;

        if (!csvFile) {
            return res.status(400).json({ error: 'File CSV non fornito' });
        }

        // Parse CSV
        const csvData = await parseCSV(csvFile.buffer);
        
        const results = {
            created: 0,
            existing: 0,
            errors: []
        };

        for (const row of csvData) {
            try {
                // Cerca o crea utente
                let user = await User.findOne({
                    where: { 
                        [Op.or]: [
                            { email: row.email },
                            { taxCode: row.taxCode }
                        ]
                    }
                });

                if (!user) {
                    user = await User.create({
                        firstName: row.firstName,
                        lastName: row.lastName,
                        email: row.email,
                        taxCode: row.taxCode,
                        status: 'active'
                    });
                }

                // Aggiungi alla whitelist
                const [whitelistEntry, created] = await ElectionWhitelist.findOrCreate({
                    where: { electionId, userId: user.id },
                    defaults: { authorizedBy: req.admin.id }
                });

                if (created) {
                    results.created++;
                } else {
                    results.existing++;
                }
            } catch (error) {
                results.errors.push({
                    row: row.email || row.taxCode,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: 'Importazione completata',
            results
        });
    } catch (error) {
        console.error('Errore importazione whitelist:', error);
        res.status(500).json({ error: 'Errore nell\'importazione della whitelist' });
    }
});

// DELETE /api/admin/elections/:electionId/whitelist/:userId - Rimuovi da whitelist
router.delete('/elections/:electionId/whitelist/:userId', adminAuth, async (req, res) => {
    try {
        const { electionId, userId } = req.params;

        const whitelistEntry = await ElectionWhitelist.findOne({
            where: { electionId, userId }
        });

        if (!whitelistEntry) {
            return res.status(404).json({ error: 'Utente non trovato nella whitelist' });
        }

        if (whitelistEntry.hasVoted) {
            return res.status(400).json({ 
                error: 'Non è possibile rimuovere un utente che ha già votato' 
            });
        }

        await whitelistEntry.destroy();

        res.json({
            success: true,
            message: 'Utente rimosso dalla whitelist'
        });
    } catch (error) {
        console.error('Errore rimozione da whitelist:', error);
        res.status(500).json({ error: 'Errore nella rimozione dalla whitelist' });
    }
});