
# Setup certificati SSL con Let's Encrypt

set -e

DOMAIN=${1:-evoting.example.com}
EMAIL=${2:-admin@example.com}

echo "=== Setup SSL per $DOMAIN ==="

# Installa certbot se necessario
if ! command -v certbot &> /dev/null; then
    echo "Installazione certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Ottieni certificato
sudo certbot certonly \
    --nginx \
    --non-interactive \
    --agree-tos \
    --email $EMAIL \
    --domains $DOMAIN,www.$DOMAIN

# Crea directory per nginx
sudo mkdir -p /etc/nginx/ssl

# Link certificati
sudo ln -sf /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/nginx/ssl/cert.pem
sudo ln -sf /etc/letsencrypt/live/$DOMAIN/privkey.pem /etc/nginx/ssl/key.pem

# Setup auto-renewal
echo "0 0,12 * * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-renew

echo "✓ SSL configurato con successo"

---
#!/bin/bash
# scripts/security-hardening.sh
# Script per hardening di sicurezza del sistema

set -e

echo "=== Security Hardening Script ==="

# 1. Configurazione Firewall
echo "Configurazione firewall..."
sudo ufw --force enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Porte necessarie
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3001/tcp  # API Gateway (solo da IP interni)
sudo ufw allow 9090/tcp  # Prometheus (solo da IP interni)
sudo ufw allow 3000/tcp  # Grafana (solo da IP interni)

# 2. Fail2ban per protezione brute force
echo "Installazione fail2ban..."
sudo apt-get install -y fail2ban

# Configurazione fail2ban per E-Voting
cat << 'EOF' | sudo tee /etc/fail2ban/jail.d/evoting.conf
[evoting-api]
enabled = true
port = 3001
filter = evoting-api
logpath = /opt/evoting/logs/api-gateway-combined.log
maxretry = 5
bantime = 3600

[evoting-auth]
enabled = true
port = 3002
filter = evoting-auth
logpath = /opt/evoting/logs/auth-service-combined.log
maxretry = 3
bantime = 7200
EOF

# 3. Limiti di sistema
echo "Configurazione limiti di sistema..."
cat << 'EOF' | sudo tee -a /etc/security/limits.conf
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF

# 4. Sysctl tuning
echo "Ottimizzazione kernel..."
cat << 'EOF' | sudo tee /etc/sysctl.d/99-evoting.conf
# Protezione SYN flood
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Protezione IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disabilita ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Disabilita source packet routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Log Martians
net.ipv4.conf.all.log_martians = 1

# Ignora ICMP ping
net.ipv4.icmp_echo_ignore_all = 1

# Aumenta connessioni
net.core.somaxconn = 65535
net.ipv4.ip_local_port_range = 1024 65535
EOF

sudo sysctl -p /etc/sysctl.d/99-evoting.conf

# 5. Audit logging
echo "Configurazione audit logging..."
sudo apt-get install -y auditd

cat << 'EOF' | sudo tee -a /etc/audit/rules.d/evoting.rules
# Monitor voting system files
-w /opt/evoting/ -p wa -k evoting_changes

# Monitor authentication
-w /var/log/auth.log -p wa -k auth_log

# Monitor network connections
-a exit,always -F arch=b64 -S connect -k network_connect
EOF

sudo systemctl restart auditd

# 6. Hardening Docker
echo "Hardening Docker..."
cat << 'EOF' | sudo tee /etc/docker/daemon.json
{
  "icc": false,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "userland-proxy": false,
  "no-new-privileges": true,
  "selinux-enabled": true,
  "live-restore": true
}
EOF

sudo systemctl restart docker

# 7. Setup backup automatico
echo "Configurazione backup automatico..."
cat << 'EOF' | sudo tee /opt/evoting/scripts/auto-backup.sh
#!/bin/bash
BACKUP_DIR="/backups/evoting/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup database
docker exec evoting-postgres pg_dump -U postgres evoting_wabisabi | gzip > $BACKUP_DIR/database.sql.gz

# Backup Docker volumes
docker run --rm -v evoting_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .

# Elimina backup più vecchi di 30 giorni
find /backups/evoting -type d -mtime +30 -exec rm -rf {} \;
EOF

sudo chmod +x /opt/evoting/scripts/auto-backup.sh

# Cron per backup giornaliero
echo "0 2 * * * root /opt/evoting/scripts/auto-backup.sh" | sudo tee /etc/cron.d/evoting-backup

echo "✓ Security hardening completato"

---
#!/bin/bash
# scripts/monitoring-setup.sh
# Setup sistema di monitoring e alerting

set -e

echo "=== Setup Monitoring e Alerting ==="

# 1. Configurazione Prometheus
cat << 'EOF' > prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - "alerts/*.yml"

scrape_configs:
  - job_name: 'evoting-services'
    static_configs:
      - targets: 
          - 'api-gateway:3001'
          - 'auth-service:3002'
          - 'vote-service:3003'
    metrics_path: '/monitoring/metrics'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
      
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
      
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
EOF

# 2. Alert rules
mkdir -p prometheus/alerts
cat << 'EOF' > prometheus/alerts/evoting-alerts.yml
groups:
  - name: evoting_alerts
    interval: 30s
    rules:
      # Service down
      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Servizio {{ $labels.job }} down"
          description: "{{ $labels.instance }} è down da più di 2 minuti"
      
      # High error rate
      - alert: HighErrorRate
        expr: rate(evoting_http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Alto tasso di errori su {{ $labels.instance }}"
          description: "Più del 5% di errori negli ultimi 5 minuti"
      
      # Vote processing slow
      - alert: SlowVoteProcessing
        expr: histogram_quantile(0.95, rate(evoting_vote_processing_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Elaborazione voti lenta"
          description: "Il 95° percentile del tempo di elaborazione voti supera 1 secondo"
      
      # Database connection issues
      - alert: DatabaseConnectionFailure
        expr: evoting_database_connected == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Connessione database fallita"
          description: "Impossibile connettersi al database"
      
      # High memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Utilizzo memoria elevato"
          description: "Utilizzo memoria sopra il 90% da 10 minuti"
      
      # Certificate expiring
      - alert: SSLCertificateExpiringSoon
        expr: probe_ssl_earliest_cert_expiry - time() < 7 * 24 * 60 * 60
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "Certificato SSL in scadenza"
          description: "Il certificato SSL scadrà tra meno di 7 giorni"
EOF

# 3. Grafana dashboards
mkdir -p grafana/dashboards
cat << 'EOF' > grafana/dashboards/evoting-dashboard.json
{
  "dashboard": {
    "title": "E-Voting System Dashboard",
    "panels": [
      {
        "title": "Total Votes Submitted",
        "targets": [
          {
            "expr": "sum(evoting_votes_submitted_total)"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Active Voting Sessions",
        "targets": [
          {
            "expr": "evoting_active_voting_sessions"
          }
        ],
        "type": "gauge"
      },
      {
        "title": "HTTP Request Rate",
        "targets": [
          {
            "expr": "sum(rate(evoting_http_requests_total[5m])) by (instance)"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Vote Processing Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(evoting_vote_processing_duration_seconds_bucket[5m])) by (le))"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
EOF

# 4. Alertmanager configuration
cat << 'EOF' > alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true

receivers:
  - name: 'default'
    email_configs:
      - to: 'alerts@evoting.example.com'
        from: 'alertmanager@evoting.example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alertmanager@evoting.example.com'
        auth_password: 'password'
        
  - name: 'critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
    email_configs:
      - to: 'oncall@evoting.example.com'
EOF

echo "✓ Monitoring setup completato"

---
#!/bin/bash
# scripts/performance-test.sh
# Test di performance del sistema

set -e

echo "=== Performance Test E-Voting System ==="

# Installa k6 se necessario
if ! command -v k6 &> /dev/null; then
    echo "Installazione k6..."
    sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 379CE192D401AB61
    echo "deb https://dl.k6.io/deb stable main" | sudo tee -a /etc/apt/sources.list.d/k6.list
    sudo apt-get update
    sudo apt-get install k6
fi

# Test script k6
cat << 'EOF' > test/performance/voting-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.1'],             // Error rate under 10%
  },
};

const BASE_URL = 'http://localhost:3001/api';

export default function () {
  // 1. Login
  let loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: `voter${Math.floor(Math.random() * 1000)}@test.com`,
    password: 'password123'
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginRes, {
    'login successful': (r) => r.status === 200,
  });
  
  errorRate.add(loginRes.status !== 200);
  
  if (loginRes.status !== 200) return;
  
  let token = loginRes.json('token');
  
  // 2. Request credentials
  let credRes = http.post(`${BASE_URL}/credentials/request`, null, {
    headers: { 
      'Authorization': `Bearer ${token}`,
    },
  });
  
  check(credRes, {
    'credentials received': (r) => r.status === 200,
  });
  
  // 3. Submit vote
  if (credRes.status === 200) {
    let credentials = credRes.json('credentials');
    
    let voteRes = http.post(`${BASE_URL}/vote/submit`, JSON.stringify({
      sessionId: 'test-session',
      credential: credentials,
      commitment: {
        value: '0'.repeat(64),
        blinding: '1'.repeat(64)
      },
      zkProof: {
        challenge: '2'.repeat(64),
        response: '3'.repeat(64)
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
    
    check(voteRes, {
      'vote submitted': (r) => r.status === 200,
    });
    
    errorRate.add(voteRes.status !== 200);
  }
  
  sleep(1);
}
EOF

# Esegui test
echo "Esecuzione test di carico..."
k6 run test/performance/voting-load-test.js

echo "✓ Performance test completato"