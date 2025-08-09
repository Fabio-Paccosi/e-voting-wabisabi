const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Rate limiting configurabile
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 15 * 60 * 1000, // 15 minuti
        max: 100, // Max 100 requests per window
        message: {
            error: 'Troppe richieste, riprova più tardi',
            retryAfter: '15 minuti'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Include user ID per utenti autenticati
            const userId = req.admin?.id || 'anonymous';
            return `${req.ip}-${userId}`;
        }
    };

    return rateLimit({ ...defaultOptions, ...options });
};

// Rate limiters specifici
const adminLoginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5, // Max 5 tentativi login in 15 minuti
    skipSuccessfulRequests: true,
    message: {
        error: 'Troppi tentativi di login, riprova più tardi',
        retryAfter: '15 minuti'
    }
});

const adminApiLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // 60 requests per minuto per admin
    message: {
        error: 'Limite API raggiunto',
        retryAfter: '1 minuto'
    }
});

const strictApiLimiter = createRateLimiter({
    windowMs: 1 * 60 * 1000,
    max: 10, // Operazioni critiche limitate
    message: {
        error: 'Operazione limitata, riprova più tardi'
    }
});

// Helmet configuration avanzata
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws://localhost:*", "http://localhost:*"]
        }
    },
    crossOriginEmbedderPolicy: false, // Per compatibilità
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Middleware IP Whitelist
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            return next(); // Se nessun IP configurato, permetti tutto
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const isAllowed = allowedIPs.some(allowedIP => {
            if (allowedIP.includes('/')) {
                // CIDR notation support
                return isInSubnet(clientIP, allowedIP);
            }
            return clientIP === allowedIP;
        });

        if (!isAllowed) {
            console.warn(`[Security] IP ${clientIP} bloccato - non in whitelist`);
            return res.status(403).json({
                error: 'Accesso negato',
                message: 'IP non autorizzato'
            });
        }

        next();
    };
};

// Helper per subnet check
function isInSubnet(ip, subnet) {
    // Implementazione semplificata - in produzione usare libreria dedicata
    const [subnetIP, subnetMask] = subnet.split('/');
    // Logic per controllare se IP è nella subnet
    return true; // Placeholder
}

// Middleware audit logging
const auditLogger = (action, resourceType = null) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function(data) {
            // Log dell'azione dopo risposta
            setImmediate(async () => {
                try {
                    await logAuditEvent({
                        adminId: req.admin?.id,
                        action,
                        resourceType,
                        resourceId: req.params?.id || req.params?.electionId || req.params?.userId,
                        oldValues: req.body?.oldValues,
                        newValues: req.body,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent'),
                        success: res.statusCode < 400,
                        errorMessage: res.statusCode >= 400 ? data : null
                    });
                } catch (error) {
                    console.error('[Audit] Errore logging:', error);
                }
            });
            
            originalSend.call(this, data);
        };
        
        next();
    };
};

// Funzione logging audit (da implementare con database)
async function logAuditEvent(eventData) {
    // In produzione: salvare in database admin_audit_log
    console.log(`[Audit] ${eventData.adminId || 'Anonymous'}: ${eventData.action}`, {
        resourceType: eventData.resourceType,
        resourceId: eventData.resourceId,
        success: eventData.success,
        ip: eventData.ipAddress
    });
}

// Middleware validazione JWT avanzata
const advancedJWTAuth = (options = {}) => {
    const {
        required = true,
        roles = ['admin'],
        checkSession = true
    } = options;

    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                if (!required) return next();
                return res.status(401).json({ error: 'Token di accesso richiesto' });
            }

            const token = authHeader.substring(7);
            
            // Verifica JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Controlla ruolo
            if (!roles.includes(decoded.role)) {
                return res.status(403).json({ error: 'Ruolo insufficiente' });
            }

            // Controlla scadenza token
            if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
                return res.status(401).json({ error: 'Token scaduto' });
            }

            // TODO: In produzione verificare se sessione ancora valida in database
            if (checkSession) {
                // const sessionValid = await verifyAdminSession(decoded.id, token);
                // if (!sessionValid) {
                //     return res.status(401).json({ error: 'Sessione non valida' });
                // }
            }

            req.admin = decoded;
            next();
            
        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Token non valido' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token scaduto' });
            }
            
            console.error('[Security] Errore JWT:', error);
            res.status(500).json({ error: 'Errore validazione token' });
        }
    };
};

// Middleware validazione input
const validateInput = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        
        if (error) {
            return res.status(400).json({
                error: 'Dati non validi',
                details: error.details.map(d => d.message)
            });
        }
        
        req.body = value; // Usa dati validati/sanitizzati
        next();
    };
};

// Export middleware
module.exports = {
    helmetConfig,
    adminLoginLimiter,
    adminApiLimiter,
    strictApiLimiter,
    ipWhitelist,
    auditLogger,
    advancedJWTAuth,
    validateInput,
    createRateLimiter
};