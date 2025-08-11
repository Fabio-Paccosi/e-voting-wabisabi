FROM node:18-alpine

# Installa dipendenze sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    libtool \
    autoconf \
    automake

WORKDIR /app

# Copia e installa dipendenze
COPY package.json ./
RUN npm cache clean --force
RUN npm install --only=production --no-package-lock

# Copia codice applicazione
COPY . .

# Esponi porta
EXPOSE 3003

# Comando di avvio
CMD ["node", "app.js"]
