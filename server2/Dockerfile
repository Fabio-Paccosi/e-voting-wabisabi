FROM node:18-alpine

# Installa dipendenze di sistema necessarie
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Crea directory di lavoro
WORKDIR /app

# Copia package.json e package-lock.json
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia il codice sorgente
COPY . .

# Esponi la porta
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node healthcheck.js || exit 1

# Comando di avvio
CMD ["node", "app.js"]