FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    libc6-compat

# Crea directory di lavoro  
WORKDIR /app

# Prima copia shared/ (ora funziona perché build context è dalla root)
COPY shared/ ./shared/

# Copia package.json del server2
COPY server2/package.json ./

# Pulisci cache npm e installa dipendenze
RUN npm cache clean --force
RUN npm install --only=production --no-package-lock

# Copia tutto il codice del server2
COPY server2/ ./

# Esponi la porta
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]