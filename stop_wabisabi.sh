#!/bin/bash
# Script per fermare il sistema WabiSabi E-Voting

echo "🛑 Arresto Sistema E-Voting WabiSabi"
echo "===================================="

# Funzione per fermare servizio
stop_service() {
    local name=$1
    local pidfile="logs/${name}.pid"
    
    if [ -f "$pidfile" ]; then
        local pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "🛑 Arresto $name (PID: $pid)..."
            kill "$pid"
            rm -f "$pidfile"
            echo " $name arrestato"
        else
            echo "$name non in esecuzione"
            rm -f "$pidfile"
        fi
    else
        echo "PID file non trovato per $name"
    fi
}

# Ferma tutti i servizi
stop_service "client"
stop_service "vote-service" 
stop_service "api-gateway"

echo ""
echo " Sistema WabiSabi arrestato"
