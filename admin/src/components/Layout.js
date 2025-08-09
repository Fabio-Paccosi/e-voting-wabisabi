// admin/src/components/Layout.js - Componenti Layout per Admin Dashboard

import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Menu, 
  X, 
  User, 
  Settings, 
  LogOut,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle
} from 'lucide-react';

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
export const Toast = ({ message, type = 'info', onClose, duration = 5000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  const getToastStyles = () => {
    const baseStyles = "fixed top-4 right-4 max-w-sm bg-white border-l-4 rounded-lg shadow-lg p-4 transition-all duration-300 ease-in-out z-50";
    const typeStyles = {
      success: "border-green-500",
      error: "border-red-500", 
      warning: "border-yellow-500",
      info: "border-blue-500"
    };
    return `${baseStyles} ${typeStyles[type]}`;
  };

  const getIcon = () => {
    const iconProps = { size: 20, className: "flex-shrink-0" };
    switch (type) {
      case 'success': return <CheckCircle {...iconProps} className="text-green-500 flex-shrink-0" />;
      case 'error': return <XCircle {...iconProps} className="text-red-500 flex-shrink-0" />;
      case 'warning': return <AlertTriangle {...iconProps} className="text-yellow-500 flex-shrink-0" />;
      default: return <Info {...iconProps} className="text-blue-500 flex-shrink-0" />;
    }
  };

  return (
    <div className={getToastStyles()}>
      <div className="flex items-start space-x-3">
        {getIcon()}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// TOAST PROVIDER
// ==========================================
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Esponi le funzioni globalmente
  useEffect(() => {
    window.showToast = addToast;
  }, []);

  return (
    <>
      {children}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </>
  );
};

// ==========================================
// ADMIN HEADER
// ==========================================
export const AdminHeader = ({ 
  user, 
  onLogout, 
  notifications = [], 
  onToggleSidebar,
  showSidebarToggle = false 
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          {showSidebarToggle && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
          )}
          
          <div className="hidden md:block">
            <h1 className="text-xl font-bold text-gray-800">🗳️ E-Voting Admin</h1>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cerca..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell size={20} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Notifiche</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                      <p>Nessuna notifica</p>
                    </div>
                  ) : (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                          !notification.read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-800">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.createdAt).toLocaleString('it-IT')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-2 border-t border-gray-200">
                    <button className="w-full text-sm text-blue-600 hover:text-blue-800 py-2">
                      Segna tutte come lette
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800">
                  {user?.name || 'Amministratore'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role || 'Admin'}
                </p>
              </div>
              <ChevronDown size={16} className="text-gray-600" />
            </button>

            {/* User dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-2">
                  <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                    <User size={16} />
                    <span>Profilo</span>
                  </button>
                  <button className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Settings size={16} />
                    <span>Impostazioni</span>
                  </button>
                  <hr className="my-2" />
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut size={16} />
                    <span>Disconnetti</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close dropdowns when clicking outside */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
};

// ==========================================
// LOADING SPINNER
// ==========================================
export const LoadingSpinner = ({ size = 'md', text = 'Caricamento...' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClasses[size]} border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin`}></div>
      {text && (
        <p className="mt-4 text-gray-600 text-sm">{text}</p>
      )}
    </div>
  );
};

// ==========================================
// ERROR BOUNDARY
// ==========================================
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center">
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Ops! Qualcosa è andato storto
              </h2>
              <p className="text-gray-600 mb-6">
                Si è verificato un errore imprevisto. Riprova ricaricando la pagina.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Ricarica Pagina
                </button>
                <button
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Riprova
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Dettagli errore (solo in sviluppo)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==========================================
// EMPTY STATE
// ==========================================
export const EmptyState = ({ 
  icon: Icon = Info, 
  title = "Nessun dato disponibile", 
  description = "Non ci sono elementi da visualizzare al momento.",
  action = null,
  actionText = "Aggiungi elemento",
  onAction = null
}) => {
  return (
    <div className="text-center py-12">
      <Icon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">{description}</p>
      {(action || onAction) && (
        <div>
          {action || (
            <button
              onClick={onAction}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// CONFIRMATION MODAL
// ==========================================
export const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Conferma azione",
  message = "Sei sicuro di voler procedere?",
  confirmText = "Conferma",
  cancelText = "Annulla",
  type = "default" // default, danger, warning
}) => {
  if (!isOpen) return null;

  const getButtonStyles = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white';
      case 'warning':
        return 'bg-yellow-600 hover:bg-yellow-700 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-700 text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <XCircle className="h-6 w-6 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
      default:
        return <Info className="h-6 w-6 text-blue-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center mb-4">
          {getIcon()}
          <h3 className="text-lg font-semibold text-gray-800 ml-2">{title}</h3>
        </div>
        
        <p className="text-gray-600 mb-6">{message}</p>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${getButtonStyles()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DATA TABLE
// ==========================================
export const DataTable = ({ 
  columns, 
  data, 
  loading = false,
  pagination = null,
  onSort = null,
  sortColumn = null,
  sortDirection = 'asc',
  emptyMessage = "Nessun dato disponibile"
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <LoadingSpinner text="Caricamento dati..." />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <EmptyState title={emptyMessage} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable && onSort && onSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && sortColumn === column.key && (
                      <span className="text-blue-500">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.render ? column.render(row[column.key], row, rowIndex) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {pagination && (
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} di {pagination.total} risultati
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-300 text-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Precedente
              </button>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 border border-gray-300 text-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Successivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default {
  Toast,
  ToastProvider,
  AdminHeader,
  LoadingSpinner,
  ErrorBoundary,
  EmptyState,
  ConfirmationModal,
  DataTable
};