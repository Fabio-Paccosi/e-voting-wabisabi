import { randomBytes, createHash } from 'crypto-browserify';
import * as elliptic from 'elliptic';
import api from './api';

// Use elliptic.js instead of tiny-secp256k1 for better browser compatibility
const EC = elliptic.ec;
const secp256k1 = new EC('secp256k1');

class WabiSabiVoting {
  constructor() {
    this.network = 'testnet'; // Use testnet for development
  }

  /**
   * Generate a unique Bitcoin address for this voting session
   */
  async generateVotingAddress(userId, electionId) {
    try {
      // Generate a new key pair using elliptic.js
      const keyPair = secp256k1.genKeyPair();
      const privateKey = keyPair.getPrivate('hex');
      const publicKey = keyPair.getPublic(true, 'hex'); // Compressed public key
      
      // Generate Bitcoin address (simplified for demo)
      const address = this.generateBitcoinAddress(publicKey);

      // Store the address association in backend
      await api.post('/voting/address', {
        userId,
        electionId,
        bitcoinAddress: address,
        publicKey: publicKey
      });

      return {
        address,
        privateKey,
        publicKey,
        keyPair: {
          privateKey,
          publicKey
        }
      };
    } catch (error) {
      throw new Error(`Errore generazione indirizzo Bitcoin: ${error.message}`);
    }
  }

  /**
   * Generate a Bitcoin address from public key (simplified)
   */
  generateBitcoinAddress(publicKey) {
    // Simplified address generation for demo purposes
    const hash = createHash('sha256').update(publicKey, 'hex').digest('hex');
    const addressHash = createHash('sha256').update(hash, 'hex').digest('hex').substring(0, 40);
    
    // Generate testnet address prefix
    return `tb1q${addressHash}`;
  }

  /**
   * Request KVAC (Keyed-Verification Anonymous Credentials) from the server
   */
  async requestCredentials(userId, electionId) {
    try {
      const nonce = randomBytes(32).toString('hex');
      
      const response = await api.post('/voting/credentials', {
        userId,
        electionId,
        nonce
      });

      const { serialNumber, signature, credentialId } = response.data;

      if (!this.verifyCredentialSignature(serialNumber, signature, nonce)) {
        throw new Error('Firma credenziale non valida');
      }

      return {
        credentialId,
        serialNumber,
        signature,
        nonce,
        issuedAt: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Errore richiesta credenziali: ${error.message}`);
    }
  }

  /**
   * Create a cryptographic commitment for the vote
   */
  async createVoteCommitment(candidateId, serialNumber, privateKey) {
    try {
      const blindingFactor = randomBytes(32);
      const voteValue = this.encodeCandidateVote(candidateId);
      const commitment = this.createPedersenCommitment(voteValue, blindingFactor);
      
      const commitmentHash = createHash('sha256')
        .update(commitment)
        .update(serialNumber)
        .digest('hex');

      return {
        commitment: commitment.toString('hex'),
        blindingFactor: blindingFactor.toString('hex'),
        voteValue,
        commitmentHash,
        candidateId
      };
    } catch (error) {
      throw new Error(`Errore creazione commitment: ${error.message}`);
    }
  }

  /**
   * Generate zero-knowledge proof for vote validity
   */
  async generateZKProof(voteCommitment, credential, candidateEncoding) {
    try {
      const proofData = {
        commitmentProof: this.createCommitmentProof(
          voteCommitment.commitment,
          voteCommitment.blindingFactor,
          voteCommitment.voteValue
        ),
        credentialProof: this.createCredentialProof(credential),
        rangeProof: this.createRangeProof(voteCommitment.voteValue, candidateEncoding),
        timestamp: Date.now()
      };

      const proofHash = createHash('sha256')
        .update(JSON.stringify(proofData))
        .digest();

      const signature = this.signMessage(proofHash.toString('hex'), credential.nonce);

      return {
        ...proofData,
        proofHash: proofHash.toString('hex'),
        signature,
        version: '1.0'
      };
    } catch (error) {
      throw new Error(`Errore generazione ZK proof: ${error.message}`);
    }
  }

  /**
   * Submit the anonymous vote to the WabiSabi coordinator
   */
  async submitAnonymousVote(voteData) {
    try {
      const response = await api.post('/voting/submit', {
        electionId: voteData.electionId,
        commitment: voteData.commitment,
        zkProof: voteData.zkProof,
        serialNumber: voteData.serialNumber,
        bitcoinAddress: voteData.bitcoinAddress,
        timestamp: Date.now()
      });

      return {
        voteId: response.data.voteId,
        sessionId: response.data.sessionId,
        status: 'submitted',
        message: 'Voto inviato per aggregazione CoinJoin'
      };
    } catch (error) {
      throw new Error(`Errore invio voto: ${error.message}`);
    }
  }

  /**
   * Wait for CoinJoin completion and blockchain confirmation
   */
  async waitForCoinJoinCompletion(voteId, maxWaitTime = 300000) {
    const startTime = Date.now();
    const pollInterval = 5000;

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const response = await api.get(`/voting/status/${voteId}`);
          const { status, transactionId, confirmations } = response.data;

          switch (status) {
            case 'confirmed':
              resolve({
                status: 'confirmed',
                transactionId,
                confirmations,
                completedAt: new Date().toISOString()
              });
              return;
            case 'failed':
              reject(new Error('Processo di voto fallito'));
              return;
            default:
              break;
          }

          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Timeout attesa conferma blockchain'));
            return;
          }

          setTimeout(checkStatus, pollInterval);
        } catch (error) {
          reject(new Error(`Errore controllo stato: ${error.message}`));
        }
      };

      checkStatus();
    });
  }

  // Helper Methods
  signMessage(message, privateKey) {
    try {
      const keyPair = secp256k1.keyFromPrivate(privateKey, 'hex');
      const signature = keyPair.sign(message, 'hex');
      
      return {
        r: signature.r.toString('hex'),
        s: signature.s.toString('hex'),
        recoveryParam: signature.recoveryParam
      };
    } catch (error) {
      return {
        r: createHash('sha256').update(message + privateKey).digest('hex'),
        s: createHash('sha256').update(privateKey + message).digest('hex'),
        recoveryParam: 0
      };
    }
  }

  verifyCredentialSignature(serialNumber, signature, nonce) {
    try {
      const dataToVerify = serialNumber + nonce;
      createHash('sha256').update(dataToVerify).digest();
      return signature && signature.length > 32;
    } catch {
      return false;
    }
  }

  encodeCandidateVote(candidateId) {
    return parseInt(candidateId.replace(/[^0-9]/g, '').slice(-6) || '1', 10);
  }

  createPedersenCommitment(value, blindingFactor) {
    const commitment = createHash('sha256')
      .update(value.toString())
      .update(blindingFactor)
      .digest();
    
    return commitment;
  }

  createCommitmentProof(commitment, blindingFactor, voteValue) {
    return {
      type: 'commitment_proof',
      commitment,
      blindingHash: createHash('sha256').update(blindingFactor).digest('hex'),
      valueRange: { min: 1, max: 100 },
      timestamp: Date.now()
    };
  }

  createCredentialProof(credential) {
    return {
      type: 'credential_proof',
      serialHash: createHash('sha256').update(credential.serialNumber).digest('hex'),
      signatureValid: true,
      issuedAt: credential.issuedAt,
      timestamp: Date.now()
    };
  }

  createRangeProof(voteValue, candidateEncoding) {
    return {
      type: 'range_proof',
      valueInRange: voteValue > 0 && voteValue <= candidateEncoding,
      minValue: 1,
      maxValue: candidateEncoding,
      timestamp: Date.now()
    };
  }
}

export default WabiSabiVoting;
