const request = require('supertest');
const { app, voteProcessor, transactionManager } = require('../server3/app');
const bitcoin = require('bitcoinjs-lib');

describe('Server 3 - Vote Processing & Blockchain', () => {
    // Test processamento voto
    describe('Vote Processor', () => {
        it('dovrebbe accettare un voto valido', async () => {
            const voteData = {
                commitment: {
                    value: '0'.repeat(64), // Hex string di 32 bytes
                    blinding: '1'.repeat(64)
                },
                zkProof: {
                    challenge: '2'.repeat(64),
                    response: '3'.repeat(64)
                },
                serialNumber: 'SN-' + '4'.repeat(32)
            };

            const voteId = await voteProcessor.processVote(voteData);
            expect(voteId).toBeDefined();
            expect(typeof voteId).toBe('string');
        });

        it('dovrebbe rifiutare voti con serial number duplicato', async () => {
            const voteData = {
                commitment: {
                    value: '0'.repeat(64),
                    blinding: '1'.repeat(64)
                },
                zkProof: {
                    challenge: '2'.repeat(64),
                    response: '3'.repeat(64)
                },
                serialNumber: 'SN-duplicate-test'
            };

            // Primo voto
            await voteProcessor.processVote(voteData);

            // Tentativo di doppio voto
            await expect(
                voteProcessor.processVote(voteData)
            ).rejects.toThrow('doppio voto rilevato');
        });

        it('dovrebbe validare commitment omomorfico', () => {
            const validCommitment = {
                value: 'a'.repeat(64),
                blinding: 'b'.repeat(64)
            };

            const invalidCommitment = {
                value: 'invalid',
                blinding: 'short'
            };

            expect(voteProcessor.verifyCommitment(validCommitment)).toBe(true);
            expect(voteProcessor.verifyCommitment(invalidCommitment)).toBe(false);
        });
    });

    // Test transazioni Bitcoin
    describe('Transaction Manager', () => {
        it('dovrebbe creare una transazione CoinJoin', async () => {
            const votes = [
                {
                    id: 'vote1',
                    commitment: { value: 'a'.repeat(64), blinding: 'b'.repeat(64) }
                },
                {
                    id: 'vote2',
                    commitment: { value: 'c'.repeat(64), blinding: 'd'.repeat(64) }
                }
            ];

            const result = await transactionManager.createCoinJoinTransaction(votes);

            expect(result).toHaveProperty('psbt');
            expect(result).toHaveProperty('fee');
            expect(result.inputCount).toBe(2);
            expect(result.outputCount).toBe(2);
        });

        it('dovrebbe calcolare le fee correttamente', () => {
            const mockPsbt = {
                inputCount: 3,
                outputCount: 2
            };

            const fee = transactionManager.calculateFee(mockPsbt);
            const expectedSize = (148 * 3) + (34 * 2) + 10; // 522 bytes
            const expectedFee = expectedSize * 10; // 10 sat/byte

            expect(fee).toBe(expectedFee);
        });

        it('dovrebbe generare indirizzi Bitcoin validi', () => {
            const address = transactionManager.generateChangeAddress();
            
            // Verifica formato bech32 (native segwit)
            expect(address).toMatch(/^(bc1|tb1)[a-z0-9]{39,}$/);
        });
    });

    // Test API endpoints
    describe('API Endpoints', () => {
        it('GET /api/health dovrebbe ritornare info network', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body.status).toBe('ok');
            expect(response.body.service).toBe('vote-blockchain');
            expect(response.body.network).toMatch(/^(mainnet|testnet)$/);
        });

        it('POST /api/vote/process dovrebbe processare un voto', async () => {
            const response = await request(app)
                .post('/api/vote/process')
                .send({
                    commitment: {
                        value: 'e'.repeat(64),
                        blinding: 'f'.repeat(64)
                    },
                    zkProof: {
                        challenge: '0'.repeat(64),
                        response: '1'.repeat(64)
                    },
                    serialNumber: 'SN-test-vote-123'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.voteId).toBeDefined();
        });
    });
});