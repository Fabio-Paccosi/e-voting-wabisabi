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