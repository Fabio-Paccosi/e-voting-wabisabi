#!/bin/bash
# Debug per capire cosa succede quando si usa start.sh

echo "🔍 DEBUG START.SH CON ADMIN DASHBOARD"
echo "===================================="

echo ""
echo "1️⃣ STATO PRIMA DI START.SH:"
echo "=============================="

# Verifica admin dashboard funzionante
echo "🌐 Test admin dashboard attuale:"
if curl -s --max-time 5 http://localhost:3006 >/dev/null; then
    echo "✅ Admin dashboard attualmente FUNZIONA"
    
    # Verifica che sia React
    if curl -s http://localhost:3006 | grep -q "React"; then
        echo "✅ È effettivamente React App"
    else
        echo "⚠️ Non sembra essere React App"
    fi
else
    echo "❌ Admin dashboard attualmente NON funziona"
fi

echo ""
echo "📦 Container admin attuale:"
docker compose ps | grep admin || echo "Nessun container admin trovato"

echo ""
echo "📋 Docker compose attuale (sezione admin):"
grep -A 15 "admin-dashboard:" docker-compose.yml || echo "Admin-dashboard non trovato nel compose"

echo ""
echo "2️⃣ BACKUP STATO FUNZIONANTE:"
echo "============================="

# Backup della configurazione funzionante
echo "💾 Backup configurazione funzionante..."
cp docker-compose.yml docker-compose.yml.working.backup
cp -r admin-dashboard admin-dashboard.working.backup
echo "✅ Backup salvato"

echo ""
echo "3️⃣ SIMULAZIONE START.SH:"
echo "========================="

echo "⚠️ ATTENZIONE: Il problema potrebbe essere che start.sh:"
echo "   - Sovrascrive docker-compose.yml"
echo "   - Ricostruisce admin-dashboard"
echo "   - Usa configurazione diversa"

echo ""
echo "🔍 Verifica cosa fa start.sh..."

# Controlla se start.sh esiste
if [ -f "start.sh" ]; then
    echo "📄 start.sh trovato"
    
    # Verifica se start.sh modifica docker-compose.yml
    if grep -q "docker-compose.yml" start.sh; then
        echo "⚠️ start.sh MODIFICA docker-compose.yml"
    fi
    
    # Verifica se start.sh modifica admin-dashboard
    if grep -q "admin-dashboard" start.sh; then
        echo "⚠️ start.sh tocca admin-dashboard"
    fi
else
    echo "❌ start.sh non trovato"
fi

echo ""
echo "4️⃣ CONFRONTO CONFIGURAZIONI:"
echo "============================="

echo "🔍 Analisi differenze configurazione..."

# Controlla se c'è differenza tra quello che funziona e quello che start.sh creerebbe
if [ -f "docker-compose.yml" ]; then
    echo "📋 Configurazione admin nel compose attuale:"
    sed -n '/admin-dashboard:/,/^[[:space:]]*$/p' docker-compose.yml | head -15
fi

echo ""
echo "5️⃣ SOLUZIONI PROPOSTE:"
echo "======================"

echo "💡 OPZIONE 1 - Modifica start.sh per NON toccare admin funzionante:"
echo "   - Impedire a start.sh di modificare admin-dashboard"
echo "   - Usare la configurazione esistente"

echo ""
echo "💡 OPZIONE 2 - Fix start.sh per usare configurazione corretta:"
echo "   - Correggere start.sh per usare la stessa config del reset"

echo ""
echo "💡 OPZIONE 3 - Script separato per sistema completo:"
echo "   - Creare start-full.sh che non interferisce"

echo ""
echo "🎯 RACCOMANDAZIONE:"
echo "=================="

echo "Proviamo OPZIONE 1 - Proteggiamo l'admin dashboard funzionante"

echo ""
echo "📋 COMANDI PER VERIFICARE:"
echo "=========================="
echo "1. Stato attuale:        docker compose ps | grep admin"
echo "2. Test funzionamento:   curl http://localhost:3006"
echo "3. Verifica React:       curl -s http://localhost:3006 | grep -i react"
echo "4. Logs admin:           docker compose logs admin-dashboard --tail=10"

echo ""
echo "=================================="