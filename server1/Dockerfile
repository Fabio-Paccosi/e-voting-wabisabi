FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Crea directory di lavoro
WORKDIR /app

# Prima copia shared/ (ora funziona perché build context è dalla root)
COPY shared/ ./shared/

# Copia package.json del server1
COPY server1/package.json ./

# Pulisci cache npm e installa dipendenze  
RUN npm cache clean --force
RUN npm install --only=production --no-package-lock

# Copia tutto il codice del server1
COPY server1/ ./

# Debug: verifica struttura
RUN ls -la /app/
RUN ls -la /app/routes/ || echo "Directory routes non trovata"
RUN ls -la /app/shared/ || echo "Directory shared non trovata"

# Esponi la porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]