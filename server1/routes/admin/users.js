// server1/routes/admin/users.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { User, ElectionWhitelist } = require('../../../database/models');
const { Op } = require('sequelize');

// GET /api/admin/users - Lista tutti gli utenti
router.get('/users', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, status } = req.query;

        const where = {};
        
        if (search) {
            where[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { taxCode: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (status) {
            where.status = status;
        }

        const users = await User.findAndCountAll({
            where,
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            order: [['createdAt', 'DESC']],
            attributes: { exclude: ['password'] }
        });

        res.json({
            success: true,
            users: users.rows,
            total: users.count,
            page: parseInt(page),
            totalPages: Math.ceil(users.count / parseInt(limit))
        });
    } catch (error) {
        console.error('Errore recupero utenti:', error);
        res.status(500).json({ error: 'Errore nel recupero degli utenti' });
    }
});

// POST /api/admin/users - Crea nuovo utente
router.post('/users', adminAuth, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            taxCode,
            dateOfBirth,
            phoneNumber,
            address,
            documentType,
            documentNumber,
            password
        } = req.body;

        // Validazione codice fiscale
        const taxCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i;
        if (!taxCodeRegex.test(taxCode)) {
            return res.status(400).json({ 
                error: 'Codice fiscale non valido' 
            });
        }

        // Verifica unicità
        const existingUser = await User.findOne({
            where: {
                [Op.or]: [
                    { email },
                    { taxCode }
                ]
            }
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: 'Email o codice fiscale già registrati' 
            });
        }

        // Hash password se fornita, altrimenti genera una temporanea
        const hashedPassword = password 
            ? await bcrypt.hash(password, 10)
            : await bcrypt.hash(crypto.randomBytes(8).toString('hex'), 10);

        // Crea utente
        const user = await User.create({
            firstName,
            lastName,
            email,
            taxCode,
            dateOfBirth,
            phoneNumber,
            address,
            documentType,
            documentNumber,
            password: hashedPassword,
            status: 'active',
            isVerified: false
        });

        // Se password non fornita, invia email con password temporanea
        if (!password) {
            // Implementa invio email
            await sendWelcomeEmail(user.email, tempPassword);
        }

        res.status(201).json({
            success: true,
            user: {
                ...user.toJSON(),
                password: undefined
            },
            message: 'Utente creato con successo'
        });
    } catch (error) {
        console.error('Errore creazione utente:', error);
        res.status(500).json({ error: 'Errore nella creazione dell\'utente' });
    }
});

// PUT /api/admin/users/:id - Modifica utente
router.put('/users/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // Non permettere modifica di email e codice fiscale se utente ha votato
        const hasVoted = await ElectionWhitelist.findOne({
            where: { userId: id, hasVoted: true }
        });

        if (hasVoted && (updates.email || updates.taxCode)) {
            return res.status(400).json({ 
                error: 'Non è possibile modificare email o codice fiscale di un utente che ha votato' 
            });
        }

        // Se viene modificata la password, hash
        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        await user.update(updates);

        res.json({
            success: true,
            user: {
                ...user.toJSON(),
                password: undefined
            },
            message: 'Utente aggiornato con successo'
        });
    } catch (error) {
        console.error('Errore aggiornamento utente:', error);
        res.status(500).json({ error: 'Errore nell\'aggiornamento dell\'utente' });
    }
});

// POST /api/admin/users/:id/verify - Verifica identità utente
router.post('/users/:id/verify', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { documentVerified, notes } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        await user.update({
            isVerified: documentVerified,
            verifiedAt: documentVerified ? new Date() : null
        });

        // Log verifica
        await VerificationLog.create({
            userId: id,
            verifiedBy: req.admin.id,
            documentVerified,
            notes,
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: documentVerified 
                ? 'Utente verificato con successo'
                : 'Verifica utente annullata',
            user
        });
    } catch (error) {
        console.error('Errore verifica utente:', error);
        res.status(500).json({ error: 'Errore nella verifica dell\'utente' });
    }
});

// DELETE /api/admin/users/:id - Elimina utente
router.delete('/users/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        // Verifica se l'utente ha votato in qualche elezione
        const hasVoted = await ElectionWhitelist.findOne({
            where: { userId: id, hasVoted: true }
        });

        if (hasVoted) {
            return res.status(400).json({ 
                error: 'Non è possibile eliminare un utente che ha partecipato a votazioni' 
            });
        }

        // Soft delete - marca come inactive invece di eliminare
        await user.update({ status: 'inactive' });

        res.json({
            success: true,
            message: 'Utente disattivato con successo'
        });
    } catch (error) {
        console.error('Errore eliminazione utente:', error);
        res.status(500).json({ error: 'Errore nell\'eliminazione dell\'utente' });
    }
});