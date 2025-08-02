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

