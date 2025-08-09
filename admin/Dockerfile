FROM node:18-alpine

WORKDIR /app

# Copia file di configurazione
COPY package*.json ./

# Installa dipendenze
RUN npm ci --only=production

# Copia codice sorgente
COPY . .

# Build per produzione
RUN npm run build

# Serve con nginx
FROM nginx:alpine
COPY --from=0 /app/build /usr/share/nginx/html

# Configurazione nginx per SPA
RUN echo 'server { listen 3000; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]