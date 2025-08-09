// admin/src/utils/index.js - Utilities e Helper Functions per Admin Dashboard

// ==========================================
// CONSTANTS
// ==========================================
export const ELECTION_STATUS = {
    DRAFT: 'draft',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  };
  
  export const USER_STATUS = {
    VERIFIED: 'verified',
    PENDING: 'pending',
    BLOCKED: 'blocked',
    INACTIVE: 'inactive'
  };
  
  export const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  };
  
  export const SYSTEM_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    OBSERVER: 'observer'
  };
  
  export const ACTIVITY_LEVELS = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    SUCCESS: 'success'
  };
  
  // ==========================================
  // DATE UTILITIES
  // ==========================================
  export const dateUtils = {
    // Formatta data in formato italiano
    formatDate(date, options = {}) {
      if (!date) return 'N/A';
      
      const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options
      };
      
      return new Date(date).toLocaleDateString('it-IT', defaultOptions);
    },
  
    // Formatta data e ora
    formatDateTime(date, options = {}) {
      if (!date) return 'N/A';
      
      const defaultOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options
      };
      
      return new Date(date).toLocaleString('it-IT', defaultOptions);
    },
  
    // Calcola tempo relativo (es: "2 ore fa")
    getRelativeTime(date) {
      if (!date) return 'N/A';
      
      const now = new Date();
      const then = new Date(date);
      const diffInSeconds = Math.floor((now - then) / 1000);
      
      const intervals = [
        { label: 'anno', seconds: 31536000 },
        { label: 'mese', seconds: 2592000 },
        { label: 'giorno', seconds: 86400 },
        { label: 'ora', seconds: 3600 },
        { label: 'minuto', seconds: 60 }
      ];
      
      for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count > 0) {
          return `${count} ${interval.label}${count > 1 ? (interval.label === 'mese' ? 'i' : 'i') : ''} fa`;
        }
      }
      
      return 'Adesso';
    },
  
    // Verifica se una data è scaduta
    isExpired(date) {
      if (!date) return false;
      return new Date(date) < new Date();
    },
  
    // Calcola durata tra due date
    getDuration(startDate, endDate) {
      if (!startDate || !endDate) return 'N/A';
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffInMs = end - start;
      
      const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) return `${days}g ${hours}h`;
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    }
  };
  
  // ==========================================
  // NUMBER UTILITIES
  // ==========================================
  export const numberUtils = {
    // Formatta numero con separatori delle migliaia
    formatNumber(number, locale = 'it-IT') {
      if (typeof number !== 'number') return 'N/A';
      return new Intl.NumberFormat(locale).format(number);
    },
  
    // Formatta percentuale
    formatPercentage(value, decimals = 1) {
      if (typeof value !== 'number') return 'N/A';
      return `${value.toFixed(decimals)}%`;
    },
  
    // Formatta valuta
    formatCurrency(amount, currency = 'EUR', locale = 'it-IT') {
      if (typeof amount !== 'number') return 'N/A';
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(amount);
    },
  
    // Abbrevia numeri grandi (es: 1.2K, 3.4M)
    abbreviateNumber(number) {
      if (typeof number !== 'number') return 'N/A';
      
      const abbreviations = [
        { value: 1e9, symbol: 'B' },
        { value: 1e6, symbol: 'M' },
        { value: 1e3, symbol: 'K' }
      ];
      
      for (const { value, symbol } of abbreviations) {
        if (number >= value) {
          return `${(number / value).toFixed(1)}${symbol}`;
        }
      }
      
      return number.toString();
    },
  
    // Calcola percentuale di crescita
    calculateGrowthPercentage(currentValue, previousValue) {
      if (!previousValue || previousValue === 0) return 0;
      return ((currentValue - previousValue) / previousValue) * 100;
    }
  };
  
  // ==========================================
  // STRING UTILITIES
  // ==========================================
  export const stringUtils = {
    // Capitalizza prima lettera
    capitalize(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
  
    // Tronca testo con ellipsis
    truncate(str, maxLength = 50) {
      if (!str) return '';
      if (str.length <= maxLength) return str;
      return str.slice(0, maxLength) + '...';
    },
  
    // Slug da stringa
    slugify(str) {
      if (!str) return '';
      return str
        .toLowerCase()
        .trim()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    },
  
    // Genera iniziali da nome completo
    getInitials(name) {
      if (!name) return '';
      return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
    },
  
    // Evidenzia testo nella ricerca
    highlightSearch(text, searchTerm) {
      if (!text || !searchTerm) return text;
      
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    }
  };
  
  // ==========================================
  // VALIDATION UTILITIES
  // ==========================================
  export const validationUtils = {
    // Valida email
    isValidEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    },
  
    // Valida codice fiscale italiano
    isValidTaxCode(taxCode) {
      if (!taxCode || taxCode.length !== 16) return false;
      
      const taxCodeRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
      return taxCodeRegex.test(taxCode.toUpperCase());
    },
  
    // Valida password
    isValidPassword(password, minLength = 8) {
      if (!password || password.length < minLength) return false;
      
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
      
      return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
    },
  
    // Valida URL
    isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
  
    // Valida numero di telefono italiano
    isValidPhoneNumber(phone) {
      const phoneRegex = /^(\+39)?[\s]?[0-9]{10}$/;
      return phoneRegex.test(phone.replace(/\s+/g, ''));
    }
  };
  
  // ==========================================
  // FILE UTILITIES
  // ==========================================
  export const fileUtils = {
    // Formatta dimensione file
    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
  
    // Ottieni estensione file
    getFileExtension(filename) {
      return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    },
  
    // Verifica tipo file per icona
    getFileIcon(filename) {
      const extension = this.getFileExtension(filename).toLowerCase();
      
      const icons = {
        pdf: '📄',
        doc: '📝', docx: '📝',
        xls: '📊', xlsx: '📊',
        ppt: '📽️', pptx: '📽️',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
        mp4: '🎥', avi: '🎥', mov: '🎥',
        mp3: '🎵', wav: '🎵',
        zip: '🗜️', rar: '🗜️',
        txt: '📄'
      };
      
      return icons[extension] || '📁';
    },
  
    // Download file da blob
    downloadBlob(blob, filename) {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  };
  
  // ==========================================
  // COLOR UTILITIES
  // ==========================================
  export const colorUtils = {
    // Genera colore da stringa (per avatar, categorie, etc.)
    stringToColor(str) {
      if (!str) return '#6B7280';
      
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      const hue = hash % 360;
      return `hsl(${hue}, 70%, 50%)`;
    },
  
    // Ottieni colore per stato
    getStatusColor(status) {
      const colors = {
        [USER_STATUS.VERIFIED]: '#10B981',
        [USER_STATUS.PENDING]: '#F59E0B',
        [USER_STATUS.BLOCKED]: '#EF4444',
        [USER_STATUS.INACTIVE]: '#6B7280',
        [ELECTION_STATUS.DRAFT]: '#6B7280',
        [ELECTION_STATUS.ACTIVE]: '#10B981',
        [ELECTION_STATUS.COMPLETED]: '#3B82F6',
        [ELECTION_STATUS.CANCELLED]: '#EF4444'
      };
      
      return colors[status] || '#6B7280';
    },
  
    // Converti hex a rgba
    hexToRgba(hex, alpha = 1) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  };
  
  // ==========================================
  // STORAGE UTILITIES
  // ==========================================
  export const storageUtils = {
    // Local Storage con fallback
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        console.error('Error setting localStorage:', error);
        return false;
      }
    },
  
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error('Error getting localStorage:', error);
        return defaultValue;
      }
    },
  
    remove(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('Error removing localStorage:', error);
        return false;
      }
    },
  
    clear() {
      try {
        localStorage.clear();
        return true;
      } catch (error) {
        console.error('Error clearing localStorage:', error);
        return false;
      }
    }
  };
  
  // ==========================================
  // ARRAY UTILITIES
  // ==========================================
  export const arrayUtils = {
    // Raggruppa array per chiave
    groupBy(array, key) {
      return array.reduce((groups, item) => {
        const group = item[key];
        groups[group] = groups[group] || [];
        groups[group].push(item);
        return groups;
      }, {});
    },
  
    // Rimuovi duplicati
    unique(array, key = null) {
      if (key) {
        return array.filter((item, index) => 
          array.findIndex(i => i[key] === item[key]) === index
        );
      }
      return [...new Set(array)];
    },
  
    // Ordina array per chiave
    sortBy(array, key, direction = 'asc') {
      return [...array].sort((a, b) => {
        const aValue = a[key];
        const bValue = b[key];
        
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    },
  
    // Filtra array per testo
    filterByText(array, searchTerm, fields = []) {
      if (!searchTerm) return array;
      
      const term = searchTerm.toLowerCase();
      
      return array.filter(item => {
        if (fields.length > 0) {
          return fields.some(field => 
            String(item[field]).toLowerCase().includes(term)
          );
        }
        
        return Object.values(item).some(value =>
          String(value).toLowerCase().includes(term)
        );
      });
    }
  };
  
  // ==========================================
  // ERROR HANDLING UTILITIES
  // ==========================================
  export const errorUtils = {
    // Formatta errore per UI
    formatError(error) {
      if (typeof error === 'string') return error;
      if (error?.response?.data?.message) return error.response.data.message;
      if (error?.message) return error.message;
      return 'Si è verificato un errore sconosciuto';
    },
  
    // Log errore in console (solo in development)
    logError(error, context = '') {
      if (process.env.NODE_ENV === 'development') {
        console.group(`🚨 Error ${context ? `in ${context}` : ''}`);
        console.error(error);
        console.trace();
        console.groupEnd();
      }
    },
  
    // Verifica se errore è di rete
    isNetworkError(error) {
      return !error.response && error.code === 'NETWORK_ERROR';
    },
  
    // Verifica se errore è di autenticazione
    isAuthError(error) {
      return error?.response?.status === 401;
    }
  };
  
  // ==========================================
  // NOTIFICATION UTILITIES
  // ==========================================
  export const notificationUtils = {
    // Mostra notifica successo
    success(message) {
      if (window.showToast) {
        window.showToast(message, NOTIFICATION_TYPES.SUCCESS);
      }
    },
  
    // Mostra notifica errore
    error(message) {
      if (window.showToast) {
        window.showToast(message, NOTIFICATION_TYPES.ERROR);
      }
    },
  
    // Mostra notifica warning
    warning(message) {
      if (window.showToast) {
        window.showToast(message, NOTIFICATION_TYPES.WARNING);
      }
    },
  
    // Mostra notifica info
    info(message) {
      if (window.showToast) {
        window.showToast(message, NOTIFICATION_TYPES.INFO);
      }
    }
  };
  
  // ==========================================
  // EXPORT ALL UTILITIES
  // ==========================================
  export default {
    ELECTION_STATUS,
    USER_STATUS,
    NOTIFICATION_TYPES,
    SYSTEM_ROLES,
    ACTIVITY_LEVELS,
    dateUtils,
    numberUtils,
    stringUtils,
    validationUtils,
    fileUtils,
    colorUtils,
    storageUtils,
    arrayUtils,
    errorUtils,
    notificationUtils
  };