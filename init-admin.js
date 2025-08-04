// Script di inizializzazione per il dashboard amministratore
const { adminDb } = require('./admin-routes');
const crypto = require('crypto');

function initializeAdminSystem() {
  console.log('🚀 Inizializzazione sistema amministratore...');

  // Crea utenti admin di default se non esistono
  if (adminDb.whitelist.size === 0) {
    console.log('📝 Creazione whitelist di default...');
    
    const defaultUsers = [
      {
        email: 'admin@evoting.local',
        taxCode: 'ADMINTEST001234',
        firstName: 'Admin',
        lastName: 'Sistema',
        status: 'active'
      },
      {
        email: 'test@example.com',
        taxCode: 'RSSMRA85M01H501Z',
        firstName: 'Test',
        lastName: 'User',
        status: 'active'
      }
    ];

    defaultUsers.forEach((user, index) => {
      const userData = {
        id: (index + 1).toString(),
        ...user,
        isAuthorized: true,
        authorizationProof: crypto.randomBytes(32).toString('hex'),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      adminDb.whitelist.set(user.email, userData);
    });

    console.log(`✅ ${defaultUsers.length} utenti aggiunti alla whitelist`);
  }

  // Crea elezione di test se non esiste
  if (adminDb.elections.size === 0) {
    console.log('🗳️ Creazione elezione di test...');
    
    const testElection = {
      id: '1',
      title: 'Elezione Test 2025',
      description: 'Elezione di test per validare il sistema',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      totalVotes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    adminDb.elections.set('1', testElection);
    console.log('✅ Elezione di test creata');
  }

  console.log('🎉 Inizializzazione completata!');
  console.log('');
  console.log('📊 Stato del sistema:');
  console.log(`   - Elezioni: ${adminDb.elections.size}`);
  console.log(`   - Candidati: ${adminDb.candidates.size}`);
  console.log(`   - Utenti whitelist: ${adminDb.whitelist.size}`);
  console.log('');
  console.log('🌐 Accesso admin dashboard:');
  console.log('   - URL: http://localhost:3006');
  console.log('   - Username: admin');
  console.log('   - Password: admin123');
}

// Esegui se chiamato direttamente
if (require.main === module) {
  initializeAdminSystem();
}

module.exports = { initializeAdminSystem };
