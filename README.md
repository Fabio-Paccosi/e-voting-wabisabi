# 🗳️ E-Voting WabiSabi

Sistema di **Voto Elettronico Anonimo e Sicuro** basato sul protocollo WabiSabi e tecnologia blockchain Bitcoin.

## 🔧 Dashboard Amministratore

Il sistema include un dashboard amministratore completo per gestire elezioni, candidati e whitelist.

### Accesso Admin Dashboard
- **URL**: http://localhost:3006 (sviluppo) / http://localhost:8080 (produzione)
- **Username**: `admin`
- **Password**: `admin123`

### Avvio Dashboard
```bash
# Modalità sviluppo
./start-admin.sh dev

# Modalità produzione
./start-admin.sh
```

### Funzionalità
- ✅ Gestione Elezioni (CRUD completo)
- ✅ Gestione Candidati (associazione alle elezioni)
- ✅ Gestione Whitelist (controllo accessi)
- ✅ Statistiche Real-time
- ✅ Export/Backup dati
- ✅ Interfaccia responsive

### Risoluzione Problema Whitelist
Il dashboard admin permette di:
1. Aggiungere utenti alla whitelist direttamente
2. Sincronizzare automaticamente con il servizio auth
3. Gestire stati utenti (Attivo/Inattivo/Pending)

**IMPORTANTE**: Cambia le credenziali admin in produzione modificando `admin-config/admin.env`
