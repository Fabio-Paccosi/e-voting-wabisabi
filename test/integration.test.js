// Test di integrazione end-to-end

const axios = require('axios');

describe('Test Integrazione E2E', () => {
    const API_GATEWAY = 'http://localhost:3001';
    let authToken;
    let credentials;

    // Test flusso completo di voto
    describe('Flusso completo di voto', () => {
        it('1. Registrazione utente', async () => {
            const response = await axios.post(`${API_GATEWAY}/api/auth/register`, {
                email: 'voter@test.com',
                password: 'VoterPass123!',
                firstName: 'Test',
                lastName: 'Voter',
                taxCode: 'RSSMRA85M01H501Z'
            });

            expect(response.data.success).toBe(true);
        });

        it('2. Login e ottenimento token', async () => {
            const response = await axios.post(`${API_GATEWAY}/api/auth/login`, {
                email: 'voter@test.com',
                password: 'VoterPass123!'
            });

            expect(response.data.success).toBe(true);
            expect(response.data.token).toBeDefined();
            authToken = response.data.token;
        });

        it('3. Richiesta credenziali KVAC', async () => {
            const response = await axios.post(
                `${API_GATEWAY}/api/credentials/request`,
                {},
                {
                    headers: { Authorization: `Bearer ${authToken}` }
                }
            );

            expect(response.data.success).toBe(true);
            expect(response.data.credentials).toBeDefined();
            credentials = response.data.credentials;
        });

        it('4. Creazione sessione di voto', async () => {
            const response = await axios.post(`${API_GATEWAY}/api/voting/session/create`, {
                electionId: 'test-election-id'
            });

            expect(response.data.success).toBe(true);
            expect(response.data.session.status).toBe('active');
        });

        it('5. Invio voto anonimo', async () => {
            const response = await axios.post(`${API_GATEWAY}/api/vote/submit`, {
                sessionId: 'test-session-id',
                credential: credentials,
                commitment: {
                    value: '0'.repeat(64),
                    blinding: '1'.repeat(64)
                },
                zkProof: {
                    challenge: '2'.repeat(64),
                    response: '3'.repeat(64)
                }
            });

            expect(response.data.success).toBe(true);
            expect(response.data.voteId).toBeDefined();
        });
    });
});