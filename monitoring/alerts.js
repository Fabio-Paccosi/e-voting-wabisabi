// Sistema di alerting

class AlertManager {
    constructor(config = {}) {
        this.alertHandlers = [];
        this.alertHistory = [];
        this.config = {
            maxHistorySize: 1000,
            deduplicationWindow: 300000, // 5 minuti
            ...config
        };
    }

    // Registra un handler per gli alert
    addHandler(handler) {
        this.alertHandlers.push(handler);
    }

    // Invia un alert
    async sendAlert(alert) {
        const enrichedAlert = {
            ...alert,
            timestamp: new Date().toISOString(),
            id: require('uuid').v4()
        };

        // Controlla duplicati
        if (this.isDuplicate(enrichedAlert)) {
            return;
        }

        // Aggiungi alla cronologia
        this.alertHistory.unshift(enrichedAlert);
        if (this.alertHistory.length > this.config.maxHistorySize) {
            this.alertHistory.pop();
        }

        // Invia a tutti gli handler
        for (const handler of this.alertHandlers) {
            try {
                await handler(enrichedAlert);
            } catch (error) {
                console.error('Errore invio alert:', error);
            }
        }
    }

    // Controlla se è un duplicato
    isDuplicate(alert) {
        const windowStart = Date.now() - this.config.deduplicationWindow;
        
        return this.alertHistory.some(historical => 
            historical.type === alert.type &&
            historical.severity === alert.severity &&
            historical.message === alert.message &&
            new Date(historical.timestamp).getTime() > windowStart
        );
    }

    // Alert predefiniti
    async criticalError(message, details = {}) {
        await this.sendAlert({
            type: 'error',
            severity: 'critical',
            message,
            details
        });
    }

    async securityAlert(message, details = {}) {
        await this.sendAlert({
            type: 'security',
            severity: 'high',
            message,
            details
        });
    }

    async performanceAlert(message, details = {}) {
        await this.sendAlert({
            type: 'performance',
            severity: 'medium',
            message,
            details
        });
    }
}

// Handler di esempio per gli alert
const consoleAlertHandler = (alert) => {
    const colors = {
        critical: '\x1b[31m', // Rosso
        high: '\x1b[33m',     // Giallo
        medium: '\x1b[36m',   // Ciano
        low: '\x1b[37m'       // Bianco
    };
    
    const color = colors[alert.severity] || colors.low;
    console.log(`${color}[ALERT] ${alert.timestamp} - ${alert.type.toUpperCase()}: ${alert.message}\x1b[0m`);
    if (alert.details && Object.keys(alert.details).length > 0) {
        console.log('Details:', alert.details);
    }
};