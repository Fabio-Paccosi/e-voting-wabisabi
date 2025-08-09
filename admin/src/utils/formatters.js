export const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  export const formatNumber = (num) => {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString('it-IT');
  };
  
  export const formatPercentage = (num, decimals = 1) => {
    if (typeof num !== 'number') return '0%';
    return `${num.toFixed(decimals)}%`;
  };
  
  export const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };
  
  export const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };
  
  export const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };
  
  export const getStatusColor = (status) => {
    const colors = {
      active: 'text-green-600 bg-green-100',
      inactive: 'text-gray-600 bg-gray-100',
      suspended: 'text-red-600 bg-red-100',
      completed: 'text-blue-600 bg-blue-100',
      draft: 'text-yellow-600 bg-yellow-100',
      error: 'text-red-600 bg-red-100',
      warning: 'text-orange-600 bg-orange-100',
      success: 'text-green-600 bg-green-100',
      info: 'text-blue-600 bg-blue-100'
    };
    
    return colors[status] || 'text-gray-600 bg-gray-100';
  };