#!/bin/bash
# Script per avviare il sistema WabiSabi E-Voting

echo "🚀 Avvio Sistema E-Voting WabiSabi"
echo "================================="

# Funzione per avviare servizio in background
start_service() {
    local name=$1
    local dir=$2
    local script=$3
    
    echo "🔧 Avvio $name..."
    cd "$dir"
    npm run $script > "../logs/${name}.log" 2>&1 &
    local pid=$!
    echo $pid > "../logs/${name}.pid"
    echo "✅ $name avviato (PID: $pid)"
    cd ..
}

# Crea directory logs
mkdir -p logs

# Avvia servizi
start_service "api-gateway" "server1" "start"
sleep 3
start_service "vote-service" "server3" "start"
sleep 3

# Se esiste, avvia client
if [ -d "client" ]; then
    start_service "client" "client" "start"
fi

echo ""
echo "🎉 Sistema WabiSabi avviato!"
echo "📊 API Gateway: http://localhost:3001"
echo "🗳️ Vote Service: http://localhost:3003"
if [ -d "client" ]; then
    echo "🖥️ Client: http://localhost:3000"
fi
echo ""
echo "📋 Log files in: logs/"
echo "🛑 Per fermare: ./stop_wabisabi.sh"
