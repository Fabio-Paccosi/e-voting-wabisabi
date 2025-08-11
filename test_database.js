// test_database.js - Test connessione database
const { initializeDatabase, getQuickStats } = require('./database/config');

async function testDatabase() {
    console.log('🧪 Test connessione database...');
    
    try {
        const success = await initializeDatabase();
        
        if (success) {
            console.log('✅ Database connesso e inizializzato');
            
            const stats = await getQuickStats();
            console.log('📊 Statistiche rapide:', stats);
            
            console.log('🎉 Test database completato con successo!');
        } else {
            console.log('❌ Errore inizializzazione database');
        }
    } catch (error) {
        console.error('❌ Errore test database:', error.message);
    }
    
    process.exit(0);
}

testDatabase();
