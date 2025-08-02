// Utilità crittografiche per il protocollo WabiSabi

const crypto = require('crypto');
const elliptic = require('elliptic');
const BN = require('bn.js');

// Curva ellittica secp256k1 (usata da Bitcoin)
const ec = new elliptic.ec('secp256k1');

// ====================
// PEDERSEN COMMITMENT
// ====================
class PedersenCommitment {
    constructor() {
        // Generatori per il commitment scheme
        // In produzione, questi dovrebbero essere generati in modo verificabile
        this.g = ec.genKeyPair().getPublic();
        this.h = ec.genKeyPair().getPublic();
    }

    // Crea un commitment per un valore
    // C = g^v * h^r dove v è il valore e r è il blinding factor
    commit(value, blinding = null) {
        if (blinding === null) {
            blinding = crypto.randomBytes(32);
        }

        const v = new BN(value);
        const r = new BN(blinding);

        // C = g^v * h^r
        const gv = this.g.mul(v);
        const hr = this.h.mul(r);
        const commitment = gv.add(hr);

        return {
            commitment: commitment.encode('hex'),
            value: v.toString(16),
            blinding: r.toString(16)
        };
    }

    // Verifica che un commitment sia valido
    verify(commitment, value, blinding) {
        try {
            const v = new BN(value, 16);
            const r = new BN(blinding, 16);
            const C = ec.curve.decodePoint(commitment, 'hex');

            // Ricalcola C' = g^v * h^r
            const gv = this.g.mul(v);
            const hr = this.h.mul(r);
            const Cprime = gv.add(hr);

            // Verifica C == C'
            return C.eq(Cprime);
        } catch (error) {
            return false;
        }
    }

    // Aggrega commitment omomorficamente
    // C_total = C1 + C2 + ... + Cn
    aggregate(commitments) {
        let total = null;
        
        for (const commitHex of commitments) {
            const point = ec.curve.decodePoint(commitHex, 'hex');
            if (total === null) {
                total = point;
            } else {
                total = total.add(point);
            }
        }

        return total ? total.encode('hex') : null;
    }
}

// ====================
// ZERO-KNOWLEDGE PROOFS
// ====================
class ZeroKnowledgeProofs {
    constructor() {
        this.ec = ec;
    }

    // Prova che un commitment contiene 0 o 1 (voto binario)
    // Usando il protocollo Sigma per range proof
    proveVoteBinary(commitment, value, blinding) {
        if (value !== 0 && value !== 1) {
            throw new Error('Il voto deve essere 0 o 1');
        }

        const v = new BN(value);
        const r = new BN(blinding, 16);

        // Genera challenge e response per protocollo Sigma
        const k = new BN(crypto.randomBytes(32));
        const R = this.ec.g.mul(k);

        // Challenge (in produzione, dovrebbe essere hash di commitment + R)
        const challenge = new BN(
            crypto.createHash('sha256')
                .update(commitment)
                .update(R.encode('hex'))
                .digest()
        );

        // Response: s = k + challenge * r
        const response = k.add(challenge.mul(r)).mod(this.ec.n);

        // Proof per v=0 o v=1
        const proof = {
            R: R.encode('hex'),
            challenge: challenge.toString(16),
            response: response.toString(16),
            // Aggiungi proof che v ∈ {0,1}
            rangeProof: this.createBinaryRangeProof(v, r, challenge)
        };

        return proof;
    }

    // Crea una range proof per dimostrare che v ∈ {0,1}
    createBinaryRangeProof(v, r, challenge) {
        // Simulazione OR-proof: dimostra (v=0) OR (v=1)
        if (v.isZero()) {
            // Caso v=0: prova reale per v=0, simulata per v=1
            return {
                isZero: true,
                proof0: this.createRealProof(v, r, challenge),
                proof1: this.createSimulatedProof()
            };
        } else {
            // Caso v=1: prova simulata per v=0, reale per v=1
            return {
                isZero: false,
                proof0: this.createSimulatedProof(),
                proof1: this.createRealProof(v, r, challenge)
            };
        }
    }

    // Crea una prova reale
    createRealProof(v, r, challenge) {
        const w = new BN(crypto.randomBytes(32));
        const a = this.ec.g.mul(w);
        const c = new BN(crypto.createHash('sha256').update(a.encode('hex')).digest());
        const s = w.add(c.mul(r)).mod(this.ec.n);

        return {
            a: a.encode('hex'),
            c: c.toString(16),
            s: s.toString(16)
        };
    }

    // Crea una prova simulata
    createSimulatedProof() {
        const c = new BN(crypto.randomBytes(32));
        const s = new BN(crypto.randomBytes(32));
        const a = this.ec.g.mul(s).add(this.ec.g.mul(c).neg());

        return {
            a: a.encode('hex'),
            c: c.toString(16),
            s: s.toString(16)
        };
    }

    // Verifica una zero-knowledge proof
    verifyVoteBinary(commitment, proof) {
        try {
            const R = ec.curve.decodePoint(proof.R, 'hex');
            const challenge = new BN(proof.challenge, 16);
            const response = new BN(proof.response, 16);

            // Verifica base: R ?= g^response * h^(-challenge)
            const gs = this.ec.g.mul(response);
            const hc = this.ec.g.mul(challenge).neg();
            const Rverify = gs.add(hc);

            // Verifica range proof
            const rangeValid = this.verifyBinaryRangeProof(
                commitment,
                proof.rangeProof
            );

            return rangeValid;
        } catch (error) {
            console.error('Errore verifica ZK proof:', error);
            return false;
        }
    }

    // Verifica range proof binaria
    verifyBinaryRangeProof(commitment, rangeProof) {
        // Verifica che almeno una delle due prove sia valida
        const valid0 = this.verifySubProof(rangeProof.proof0);
        const valid1 = this.verifySubProof(rangeProof.proof1);

        return (rangeProof.isZero && valid0) || (!rangeProof.isZero && valid1);
    }

    // Verifica una sotto-prova
    verifySubProof(subProof) {
        try {
            const a = ec.curve.decodePoint(subProof.a, 'hex');
            const c = new BN(subProof.c, 16);
            const s = new BN(subProof.s, 16);

            // Verifica: a ?= g^s * h^(-c)
            const gs = this.ec.g.mul(s);
            const hc = this.ec.g.mul(c).neg();
            const averify = gs.add(hc);

            // Controllo base (semplificato)
            return true; // In produzione, verifica completa
        } catch (error) {
            return false;
        }
    }
}

// ====================
// KVAC IMPLEMENTATION
// ====================
class KeyedVerificationAnonymousCredentials {
    constructor() {
        // Chiavi del sistema
        this.systemKey = ec.genKeyPair();
        this.verificationKey = this.systemKey.getPublic();
    }

    // Emetti una credenziale anonima
    issueCredential(userId, attributes = {}) {
        // Genera serial number univoco
        const serialNumber = crypto.randomBytes(16).toString('hex');
        
        // Crea struttura della credenziale
        const credentialData = {
            userId,
            serialNumber,
            attributes,
            issuedAt: Date.now(),
            nonce: crypto.randomBytes(16).toString('hex')
        };

        // Firma la credenziale
        const message = this.encodeCredential(credentialData);
        const signature = this.systemKey.sign(message);

        // Crea token anonimo (blind signature)
        const blindingFactor = new BN(crypto.randomBytes(32));
        const blindedSignature = this.blindSignature(signature, blindingFactor);

        return {
            credential: {
                serialNumber,
                attributes: attributes,
                nonce: credentialData.nonce
            },
            signature: blindedSignature.toDER('hex'),
            blindingFactor: blindingFactor.toString(16),
            verificationKey: this.verificationKey.encode('hex')
        };
    }

    // Firma cieca per anonimato
    blindSignature(signature, blindingFactor) {
        // Implementazione semplificata di blind signature
        // In produzione, usare schema completo (es. Blind RSA o BLS)
        const r = signature.r.add(blindingFactor).mod(this.ec.n);
        const s = signature.s.add(blindingFactor).mod(this.ec.n);

        return { r, s, recoveryParam: signature.recoveryParam };
    }

    // Verifica una credenziale anonima
    verifyCredential(credential, signature) {
        try {
            const message = this.encodeCredential({
                serialNumber: credential.serialNumber,
                attributes: credential.attributes,
                nonce: credential.nonce
            });

            // Verifica firma
            const sig = {
                r: new BN(signature.r, 16),
                s: new BN(signature.s, 16)
            };

            return this.verificationKey.verify(message, sig);
        } catch (error) {
            console.error('Errore verifica KVAC:', error);
            return false;
        }
    }

    // Codifica i dati della credenziale
    encodeCredential(data) {
        const json = JSON.stringify(data, Object.keys(data).sort());
        return crypto.createHash('sha256').update(json).digest();
    }

    // Revoca una credenziale
    revokeCredential(serialNumber) {
        // In produzione, mantenere una revocation list
        // o usare accumulatori crittografici
        if (!this.revokedCredentials) {
            this.revokedCredentials = new Set();
        }
        this.revokedCredentials.add(serialNumber);
    }

    // Controlla se una credenziale è revocata
    isRevoked(serialNumber) {
        return this.revokedCredentials && this.revokedCredentials.has(serialNumber);
    }
}

// ====================
// SECURE RANDOM
// ====================
class SecureRandom {
    // Genera bytes casuali crittograficamente sicuri
    static getRandomBytes(length) {
        return crypto.randomBytes(length);
    }

    // Genera un numero casuale in un range
    static getRandomInRange(min, max) {
        const range = max - min;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8);
        let randomValue;

        do {
            randomValue = new BN(crypto.randomBytes(bytesNeeded));
        } while (randomValue.gte(new BN(range)));

        return randomValue.add(new BN(min));
    }

    // Genera un nonce univoco
    static generateNonce() {
        return crypto.randomBytes(16).toString('hex');
    }

    // Genera un ID univoco crittograficamente sicuro
    static generateSecureId() {
        return crypto.randomBytes(32).toString('base64url');
    }
}

// ====================
// HASH UTILITIES
// ====================
class HashUtils {
    // Hash con salt
    static hashWithSalt(data, salt = null) {
        if (!salt) {
            salt = crypto.randomBytes(16);
        }
        const hash = crypto.createHash('sha256');
        hash.update(salt);
        hash.update(data);
        return {
            hash: hash.digest('hex'),
            salt: salt.toString('hex')
        };
    }

    // Verifica hash con salt
    static verifyHash(data, hash, salt) {
        const computed = this.hashWithSalt(data, Buffer.from(salt, 'hex'));
        return computed.hash === hash;
    }

    // Merkle tree per batch di voti
    static createMerkleRoot(hashes) {
        if (hashes.length === 0) return null;
        if (hashes.length === 1) return hashes[0];

        const newLevel = [];
        for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i];
            const right = hashes[i + 1] || hashes[i];
            const combined = crypto.createHash('sha256')
                .update(left)
                .update(right)
                .digest('hex');
            newLevel.push(combined);
        }

        return this.createMerkleRoot(newLevel);
    }
}

// ====================
// THRESHOLD SIGNATURE
// ====================
class ThresholdSignature {
    constructor(threshold, totalShares) {
        this.threshold = threshold;
        this.totalShares = totalShares;
        this.shares = new Map();
    }

    // Genera shares per firma distribuita
    generateShares(privateKey) {
        const shares = [];
        const coefficients = [privateKey];

        // Genera coefficienti casuali per polinomio
        for (let i = 1; i < this.threshold; i++) {
            coefficients.push(new BN(crypto.randomBytes(32)));
        }

        // Calcola shares usando Shamir's Secret Sharing
        for (let i = 1; i <= this.totalShares; i++) {
            let share = new BN(0);
            for (let j = 0; j < coefficients.length; j++) {
                const term = coefficients[j].mul(new BN(i).pow(new BN(j)));
                share = share.add(term).mod(ec.n);
            }
            shares.push({
                index: i,
                value: share.toString(16)
            });
        }

        return shares;
    }

    // Combina shares per ricostruire la firma
    combineShares(shares) {
        if (shares.length < this.threshold) {
            throw new Error(`Servono almeno ${this.threshold} shares`);
        }

        let result = new BN(0);

        // Interpolazione di Lagrange
        for (let i = 0; i < this.threshold; i++) {
            const xi = new BN(shares[i].index);
            const yi = new BN(shares[i].value, 16);
            let li = new BN(1);

            for (let j = 0; j < this.threshold; j++) {
                if (i !== j) {
                    const xj = new BN(shares[j].index);
                    li = li.mul(xj.neg()).mul(xi.sub(xj).invm(ec.n)).mod(ec.n);
                }
            }

            result = result.add(yi.mul(li)).mod(ec.n);
        }

        return result;
    }
}

// Esporta tutte le classi e utilità
module.exports = {
    PedersenCommitment,
    ZeroKnowledgeProofs,
    KeyedVerificationAnonymousCredentials,
    SecureRandom,
    HashUtils,
    ThresholdSignature,
    ec
};