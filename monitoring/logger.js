// Sistema di logging centralizzato

const winston = require('winston');
const path = require('path');

// Formato personalizzato per i log
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, service, ...metadata }) => {
        let msg = `${timestamp} [${service}] ${level}: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// Crea logger per ogni servizio
class LoggerFactory {
    static createLogger(serviceName) {
        const logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: customFormat,
            defaultMeta: { service: serviceName },
            transports: [
                // Log su file - errori
                new winston.transports.File({
                    filename: path.join('logs', `${serviceName}-error.log`),
                    level: 'error',
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                }),
                // Log su file - tutti i livelli
                new winston.transports.File({
                    filename: path.join('logs', `${serviceName}-combined.log`),
                    maxsize: 10485760,
                    maxFiles: 10
                }),
                // Log su console in sviluppo
                ...(process.env.NODE_ENV !== 'production' ? [
                    new winston.transports.Console({
                        format: winston.format.combine(
                            winston.format.colorize(),
                            winston.format.simple()
                        )
                    })
                ] : [])
            ]
        });

        // Aggiungi metodi di utilità
        logger.logRequest = (req, res, responseTime) => {
            logger.info('HTTP Request', {
                method: req.method,
                url: req.url,
                status: res.statusCode,
                responseTime: `${responseTime}ms`,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
        };

        logger.logError = (error, context = {}) => {
            logger.error(error.message, {
                stack: error.stack,
                code: error.code,
                ...context
            });
        };

        logger.logSecurity = (event, details = {}) => {
            logger.warn(`Security Event: ${event}`, {
                type: 'security',
                event,
                ...details
            });
        };

        logger.logVote = (action, details = {}) => {
            logger.info(`Vote Action: ${action}`, {
                type: 'vote',
                action,
                ...details
            });
        };

        return logger;
    }
}