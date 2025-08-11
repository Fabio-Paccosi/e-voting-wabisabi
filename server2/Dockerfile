FROM node:18-alpine

# Installa dipendenze per compilazione bcrypt
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    libc6-compat

WORKDIR /app

# Copia package.json
COPY package.json ./

# Pulisci cache npm e installa dipendenze
RUN npm cache clean --force
RUN npm install --only=production --no-package-lock

# Rebuild bcrypt per architettura corretta
RUN npm rebuild bcrypt --build-from-source

# Copia codice applicazione
COPY . .

# Esponi porta
EXPOSE 3002

# Comando di avvio
CMD ["node", "app.js"]
