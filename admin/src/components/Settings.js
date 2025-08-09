import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Database,
  Server,
  Shield,
  Download,
  Upload,
  RefreshCcw,
  Save,
  AlertTriangle,
  CheckCircle,
  Info,
  Key,
  Globe
} from 'lucide-react';
import { systemAPI } from '../services/api';
import { formatDate, formatFileSize } from '../utils/formatters';

const Settings = () => {
  const [activeSection, setActiveSection] = useState('system');
  const [settings, setSettings] = useState({});
  const [systemInfo, setSystemInfo] = useState({});
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, systemData, backupsData] = await Promise.allSettled([
        systemAPI.getSettings(),
        systemAPI.getSystemInfo?.() || Promise.resolve({}),
        systemAPI.getBackups()
      ]);

      if (settingsData.status === 'fulfilled') {
        setSettings(settingsData.value || {});
      }
      if (systemData.status === 'fulfilled') {
        setSystemInfo(systemData.value || {});
      }
      if (backupsData.status === 'fulfilled') {
        setBackups(backupsData.value?.backups || []);
      }
    } catch (error) {
      console.error('Errore caricamento impostazioni:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await systemAPI.updateSettings(settings);
      alert('Impostazioni salvate con successo!');
    } catch (error) {
      alert('Errore salvataggio: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!window.confirm('Creare un backup del database?')) return;
    
    try {
      setSaving(true);
      await systemAPI.createBackup();
      await loadData();
      alert('Backup creato con successo!');
    } catch (error) {
      alert('Errore creazione backup: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'system', label: 'Sistema', icon: Server },
    { id: 'security', label: 'Sicurezza', icon: Shield },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'backup', label: 'Backup', icon: Download }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Impostazioni Sistema</h2>
        
        <div className="flex space-x-3">
          <button
            onClick={loadData}
            className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCcw size={16} />
            <span>Aggiorna</span>
          </button>
          
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            <span>{saving ? 'Salvando...' : 'Salva'}</span>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeSection === section.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeSection === 'system' && (
          <SystemSettings 
            settings={settings}
            systemInfo={systemInfo}
            onChange={setSettings}
          />
        )}
        
        {activeSection === 'security' && (
          <SecuritySettings 
            settings={settings}
            onChange={setSettings}
          />
        )}
        
        {activeSection === 'database' && (
          <DatabaseSettings 
            settings={settings}
            systemInfo={systemInfo}
            onChange={setSettings}
          />
        )}
        
        {activeSection === 'backup' && (
          <BackupSettings 
            backups={backups}
            onCreateBackup={handleCreateBackup}
            loading={saving}
          />
        )}
      </div>
    </div>
  );
};

// Componente Sistema
const SystemSettings = ({ settings, systemInfo, onChange }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-gray-800">Configurazione Sistema</h3>
    
    {/* Info Sistema */}
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-800 mb-3">Informazioni Sistema</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Node.js</div>
          <div className="font-medium">{systemInfo.system?.node_version || 'N/A'}</div>
        </div>
        <div>
          <div className="text-gray-600">Platform</div>
          <div className="font-medium">{systemInfo.system?.platform || 'N/A'}</div>
        </div>
        <div>
          <div className="text-gray-600">Uptime</div>
          <div className="font-medium">{Math.floor((systemInfo.system?.uptime || 0) / 3600)}h</div>
        </div>
        <div>
          <div className="text-gray-600">Memoria</div>
          <div className="font-medium">{systemInfo.system?.memory?.used || 'N/A'}</div>
        </div>
      </div>
    </div>
    
    {/* Configurazioni */}
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nome Applicazione
        </label>
        <input
          type="text"
          value={settings.appName || 'E-Voting WabiSabi'}
          onChange={(e) => onChange(prev => ({ ...prev, appName: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ambiente
        </label>
        <select
          value={settings.environment || 'development'}
          onChange={(e) => onChange(prev => ({ ...prev, environment: e.target.value }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="development">Sviluppo</option>
          <option value="staging">Staging</option>
          <option value="production">Produzione</option>
        </select>
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.debugMode || false}
            onChange={(e) => onChange(prev => ({ ...prev, debugMode: e.target.checked }))}
            className="rounded"
          />
          <span className="ml-2 text-sm">Modalità Debug</span>
        </label>
      </div>
    </div>
  </div>
);

// Componente Sicurezza
const SecuritySettings = ({ settings, onChange }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-gray-800">Impostazioni Sicurezza</h3>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Durata Token JWT (ore)
        </label>
        <input
          type="number"
          min="1"
          max="72"
          value={settings.jwtExpirationHours || 24}
          onChange={(e) => onChange(prev => ({ ...prev, jwtExpirationHours: parseInt(e.target.value) }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rate Limit (richieste/minuto)
        </label>
        <input
          type="number"
          min="10"
          max="1000"
          value={settings.rateLimit || 100}
          onChange={(e) => onChange(prev => ({ ...prev, rateLimit: parseInt(e.target.value) }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.require2FA || false}
            onChange={(e) => onChange(prev => ({ ...prev, require2FA: e.target.checked }))}
            className="rounded"
          />
          <span className="ml-2 text-sm">Richiedi autenticazione 2FA</span>
        </label>
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enableIPWhitelist || false}
            onChange={(e) => onChange(prev => ({ ...prev, enableIPWhitelist: e.target.checked }))}
            className="rounded"
          />
          <span className="ml-2 text-sm">Abilita whitelist IP</span>
        </label>
      </div>
    </div>
  </div>
);

// Componente Database
const DatabaseSettings = ({ settings, systemInfo, onChange }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold text-gray-800">Configurazione Database</h3>
    
    {/* Info Database */}
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-800 mb-3">Stato Database</h4>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Connessioni</div>
          <div className="font-medium">{systemInfo.database?.connections || 0}</div>
        </div>
        <div>
          <div className="text-gray-600">Tabelle</div>
          <div className="font-medium">{systemInfo.database?.tables?.length || 0}</div>
        </div>
      </div>
    </div>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pool Connessioni Max
        </label>
        <input
          type="number"
          min="5"
          max="100"
          value={settings.dbPoolMax || 20}
          onChange={(e) => onChange(prev => ({ ...prev, dbPoolMax: parseInt(e.target.value) }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Timeout Query (ms)
        </label>
        <input
          type="number"
          min="1000"
          max="60000"
          value={settings.dbQueryTimeout || 30000}
          onChange={(e) => onChange(prev => ({ ...prev, dbQueryTimeout: parseInt(e.target.value) }))}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={settings.enableQueryLogging || false}
            onChange={(e) => onChange(prev => ({ ...prev, enableQueryLogging: e.target.checked }))}
            className="rounded"
          />
          <span className="ml-2 text-sm">Log query SQL</span>
        </label>
      </div>
    </div>
  </div>
);

// Componente Backup
const BackupSettings = ({ backups, onCreateBackup, loading }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h3 className="text-lg font-semibold text-gray-800">Gestione Backup</h3>
      
      <button
        onClick={onCreateBackup}
        disabled={loading}
        className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        <Download size={16} />
        <span>{loading ? 'Creando...' : 'Crea Backup'}</span>
      </button>
    </div>
    
    {/* Lista Backup */}
    <div className="space-y-3">
      {backups.length > 0 ? (
        backups.map(backup => (
          <div key={backup.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div>
              <div className="font-medium">{backup.filename}</div>
              <div className="text-sm text-gray-600">
                {formatDate(backup.createdAt)} • {formatFileSize(backup.size)}
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => window.open(backup.downloadUrl)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Download"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-gray-500">
          <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nessun backup disponibile</p>
        </div>
      )}
    </div>
  </div>
);

export default Settings;