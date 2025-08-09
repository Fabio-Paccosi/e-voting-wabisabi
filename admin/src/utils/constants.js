export const API_ENDPOINTS = {
    STATS: '/api/admin/stats',
    SYSTEM_STATUS: '/api/admin/system-status',
    ELECTIONS: '/api/admin/elections',
    USERS: '/api/admin/users',
    WHITELIST: '/api/admin/whitelist',
    LOGS: '/api/admin/logs',
    AUTH: '/api/admin/auth'
  };
  
  export const ELECTION_STATUSES = {
    DRAFT: 'draft',
    ACTIVE: 'active', 
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  };
  
  export const USER_STATUSES = {
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    INACTIVE: 'inactive'
  };
  
  export const LOG_LEVELS = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success'
  };
  
  export const REFRESH_INTERVALS = {
    DASHBOARD: 30000,  // 30 secondi
    ELECTIONS: 60000,  // 1 minuto
    USERS: 120000,     // 2 minuti
    LOGS: 15000        // 15 secondi
  };