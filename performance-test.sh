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