#!/bin/bash
echo "🔍 Verifica setup dashboard amministratore..."

# Variabili per conteggi
missing_files=0
total_checks=0

# Funzione per verificare file
check_file() {
    local file=$1
    local description=$2
    total_checks=$((total_checks + 1))
    
    if [ -f "$file" ]; then
        echo "✅ $description: $file"
    else
        echo "❌ $description: $file (MANCANTE)"
        missing_files=$((missing_files + 1))
    fi
}

# Funzione per verificare directory
check_dir() {
    local dir=$1
    local description=$2
    total_checks=$((total_checks + 1))
    
    if [ -d "$dir" ]; then
        echo "✅ $description: $dir/"
    else
        echo "❌ $description: $dir/ (MANCANTE)"
        missing_files=$((missing_files + 1))
    fi
}

echo ""
echo "📁 Verifica struttura file..."

# Verifica directory principali
check_dir "admin-dashboard" "Directory dashboard"
check_dir "admin-dashboard/src" "Directory sorgenti React"
check_dir "admin-dashboard/public" "Directory file pubblici"
check_dir "admin-config" "Directory configurazione"

echo ""
echo "📄 Verifica file configurazione..."

# Verifica file di configurazione
check_file "admin-dashboard/package.json" "Package.json React"
check_file "admin-dashboard/tailwind.config.js" "Configurazione Tailwind"
check_file "admin-dashboard/Dockerfile" "Dockerfile"
check_file "admin-config/admin.env" "File ambiente admin"
check_file "admin-config/nginx.conf" "Configurazione Nginx"

echo ""
echo "⚛️ Verifica componenti React..."

# Verifica componenti React
check_file "admin-dashboard/src/index.js" "Entry point React"
check_file "admin-dashboard/src/App.js" "Componente App"
check_file "admin-dashboard/src/AdminDashboard.js" "Componente Dashboard"
check_file "admin-dashboard/src/index.css" "CSS principale"

echo ""
echo "🛠️ Verifica script..."

# Verifica script
check_file "start-admin.sh" "Script avvio dashboard"
check_file "install-admin-deps.sh" "Script installazione dipendenze"
check_file "sync-whitelist.sh" "Script sincronizzazione"
check_file "quick-test.sh" "Script test sistema"

echo ""
echo "🐳 Verifica configurazione Docker..."

# Verifica Docker
check_file "docker-compose.admin.yml" "Docker Compose admin"

echo ""
echo "📊 RIEPILOGO VERIFICA:"
if [ $missing_files -eq 0 ]; then
    echo "✅ Setup completo! Tutti i file sono presenti ($total_checks/$total_checks)"
    echo ""
    echo "🚀 Prossimi passi:"
    echo "   1. ./install-admin-deps.sh"
    echo "   2. ./sync-whitelist.sh"
    echo "   3. ./start-admin.sh dev"
else
    echo "⚠️ Setup incompleto: $missing_files/$total_checks file mancanti"
    echo ""
    echo "🔧 Per completare il setup:"
    echo "   ./setup-admin.sh  # Riesegui setup principale"
fi

# Verifica servizi Docker se disponibili
echo ""
echo "🐳 Verifica servizi Docker..."
if command -v docker &> /dev/null; then
    if docker compose ps &> /dev/null; then
        echo "✅ Docker Compose disponibile"
        docker compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}"
    else
        echo "⚠️ Docker Compose non configurato o servizi non avviati"
    fi
else
    echo "⚠️ Docker non installato"
fi

# Verifica porte
echo ""
echo "📡 Verifica porte..."
for port in 3001 3002 3003; do
    if nc -z localhost $port 2>/dev/null; then
        echo "✅ Porta $port: OCCUPATA (servizio attivo)"
    else
        echo "⚠️ Porta $port: LIBERA (servizio non attivo)"
    fi
done
