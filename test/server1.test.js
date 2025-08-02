// Test suite per Server 1 - API Gateway

const request = require('supertest');
const app = require('../server1/app');
const axios = require('axios');

// Mock axios per evitare chiamate reali ai servizi
jest.mock('axios');

describe('Server 1 - API Gateway', () => {
    // Test health check
    describe('GET /api/health', () => {
        it('dovrebbe ritornare status ok', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('service', 'api-gateway');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    // Test registrazione proxy
    describe('POST /api/auth/register', () => {
        it('dovrebbe inoltrare la richiesta al servizio auth', async () => {
            const mockUser = {
                id: 'test-id',
                email: 'test@example.com',
                isAuthorized: true
            };

            axios.post.mockResolvedValueOnce({ 
                data: { success: true, user: mockUser } 
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    firstName: 'Test',
                    lastName: 'User',
                    taxCode: 'TSTUSR90A01H501X'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe('test@example.com');
        });

        it('dovrebbe gestire errori dal servizio auth', async () => {
            axios.post.mockRejectedValueOnce({
                response: {
                    status: 400,
                    data: { error: 'Utente già registrato' }
                }
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'duplicate@example.com',
                    password: 'password123'
                })
                .expect(400);

            expect(response.body.error).toBe('Utente già registrato');
        });
    });

    // Test creazione sessione
    describe('POST /api/voting/session/create', () => {
        it('dovrebbe creare una nuova sessione di voto', async () => {
            const response = await request(app)
                .post('/api/voting/session/create')
                .send({ electionId: 'test-election-id' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.session).toHaveProperty('id');
            expect(response.body.session.status).toBe('active');
        });
    });

    // Test rate limiting
    describe('Rate Limiting', () => {
        it('dovrebbe bloccare troppe richieste', async () => {
            // Simula 100+ richieste rapide
            const promises = [];
            for (let i = 0; i < 110; i++) {
                promises.push(
                    request(app).get('/api/health')
                );
            }

            const responses = await Promise.all(promises);
            const blockedRequests = responses.filter(r => r.status === 429);
            
            expect(blockedRequests.length).toBeGreaterThan(0);
        });
    });
});