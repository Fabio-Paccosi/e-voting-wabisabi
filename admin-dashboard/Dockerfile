# Multi-stage build per admin dashboard
FROM node:18-alpine AS builder

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia codice sorgente
COPY . .

# Build dell'applicazione
RUN npm run build

# Stage di produzione
FROM nginx:alpine

# Copia build files
COPY --from=builder /app/build /usr/share/nginx/html

# Configurazione nginx personalizzata
COPY nginx.conf /etc/nginx/nginx.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
