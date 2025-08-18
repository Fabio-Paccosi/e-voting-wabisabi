// Test suite per Server 2 - Authentication & Credentials

const request = require('supertest');
const { app, authService, credentialManager } = require('../server2/app');
const bcrypt = require('bcryptjs');

describe('Server 2 - Authentication & Credentials', () => {
    // Setup prima dei test
    beforeEach(() => {
        // Pulisci database simulato
        const db = require('../server2/app').db;
        db.users.clear();
        db.credentials.clear();
        db.whitelist.clear();

        // Reinizializza whitelist
        authService.initializeWhitelist();
    });

    // Test registrazione
    describe('POST /api/register', () => {
        it('dovrebbe registrare un utente valido', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    email: 'alice@example.com',
                    password: 'SecurePass123!',
                    firstName: 'Alice',
                    lastName: 'Test',
                    taxCode: 'RSSMRA85M01H501Z'
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe('alice@example.com');
            expect(response.body.user).not.toHaveProperty('password');
        });

        it('dovrebbe rifiutare utenti non in whitelist', async () => {
            const response = await request(app)
                .post('/api/register')
                .send({
                    email: 'unauthorized@example.com',
                    password: 'password123',
                    firstName: 'Unauthorized',
                    lastName: 'User',
                    taxCode: 'UNAUTH90A01H501X'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Non sei autorizzato');
        });

        it('dovrebbe prevenire registrazioni duplicate', async () => {
            // Prima registrazione
            await request(app)
                .post('/api/register')
                .send({
                    email: 'alice@example.com',
                    password: 'password123',
                    firstName: 'Alice',
                    lastName: 'Test',
                    taxCode: 'RSSMRA85M01H501Z'
                })
                .expect(201);

            // Tentativo di duplicazione
            const response = await request(app)
                .post('/api/register')
                .send({
                    email: 'alice@example.com',
                    password: 'password456',
                    firstName: 'Alice',
                    lastName: 'Duplicate',
                    taxCode: 'RSSMRA85M01H501Z'
                })
                .expect(400);

            expect(response.body.error).toContain('già registrato');
        });
    });

    // Test login
    describe('POST /api/login', () => {
        beforeEach(async () => {
            // Registra un utente per i test
            await request(app)
                .post('/api/register')
                .send({
                    email: 'alice@example.com',
                    password: 'password123',
                    firstName: 'Alice',
                    lastName: 'Test',
                    taxCode: 'RSSMRA85M01H501Z'
                });
        });

        it('dovrebbe autenticare con credenziali valide', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    email: 'alice@example.com',
                    password: 'password123'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user.email).toBe('alice@example.com');
        });

        it('dovrebbe rifiutare password errata', async () => {
            const response = await request(app)
                .post('/api/login')
                .send({
                    email: 'alice@example.com',
                    password: 'wrongpassword'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('Credenziali non valide');
        });
    });

    // Test credenziali KVAC
    describe('Credential Manager', () => {
        it('dovrebbe generare credenziali valide', async () => {
            const userId = 'test-user-id';
            const credentials = await credentialManager.generateCredentials(userId);

            expect(credentials).toHaveProperty('credentialId');
            expect(credentials).toHaveProperty('serialNumber');
            expect(credentials).toHaveProperty('nonce');
            expect(credentials).toHaveProperty('signature');
            expect(credentials.serialNumber).toMatch(/^SN-[0-9a-f]{32}$/);
        });

        it('dovrebbe verificare credenziali valide', async () => {
            const userId = 'test-user-id';
            const credentials = await credentialManager.generateCredentials(userId);

            const result = await credentialManager.verifyCredential(
                credentials.serialNumber,
                credentials.signature
            );

            expect(result.valid).toBe(true);
            expect(result.userId).toBe(userId);
        });

        it('dovrebbe prevenire double-spending', async () => {
            const userId = 'test-user-id';
            const credentials = await credentialManager.generateCredentials(userId);

            // Prima utilizzo
            credentialManager.markCredentialAsUsed(credentials.serialNumber);

            // Tentativo di riutilizzo
            await expect(
                credentialManager.verifyCredential(
                    credentials.serialNumber,
                    credentials.signature
                )
            ).rejects.toThrow('Credenziale già utilizzata');
        });
    });
});