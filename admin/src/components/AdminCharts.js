// admin/src/components/AdminCharts.js - Componenti Grafici per Admin Dashboard

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Users,
  Vote,
  Activity
} from 'lucide-react';

// ==========================================
// CHART STATISTICHE VOTI
// ==========================================
export const VotesChart = ({ data, loading, title = "Voti nel Tempo" }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Vote className="mr-2 text-blue-500" size={20} />
          {title}
        </h3>
        <div className="text-sm text-gray-500">
          Ultimo aggiornamento: {new Date().toLocaleTimeString('it-IT')}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
            tickFormatter={(value) => new Date(value).toLocaleDateString('it-IT', { 
              month: 'short', 
              day: 'numeric' 
            })}
          />
          <YAxis stroke="#666" fontSize={12} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString('it-IT')}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Area
            type="monotone"
            dataKey="votes"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================================
// CHART REGISTRAZIONI UTENTI
// ==========================================
export const RegistrationsChart = ({ data, loading, title = "Registrazioni nel Tempo" }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Users className="mr-2 text-green-500" size={20} />
          {title}
        </h3>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            stroke="#666"
            fontSize={12}
            tickFormatter={(value) => new Date(value).toLocaleDateString('it-IT', { 
              month: 'short', 
              day: 'numeric' 
            })}
          />
          <YAxis stroke="#666" fontSize={12} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleDateString('it-IT')}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Bar 
            dataKey="registrations" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================================
// CHART DISTRIBUZIONE STATI UTENTI
// ==========================================
export const UserStatusChart = ({ data, loading, title = "Distribuzione Stati Utenti" }) => {
  const COLORS = {
    verified: '#10b981',
    pending: '#f59e0b',
    blocked: '#ef4444',
    inactive: '#6b7280'
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Activity className="mr-2 text-purple-500" size={20} />
          {title}
        </h3>
      </div>
      
      <div className="flex items-center">
        <ResponsiveContainer width="60%" height={250}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.status] || '#6b7280'} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value, name) => [value, name]}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        <div className="flex-1 ml-6">
          <div className="space-y-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[item.status] || '#6b7280' }}
                  ></div>
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {item.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {item.count} ({((item.count / data.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CHART PERFORMANCE SISTEMA
// ==========================================
export const SystemPerformanceChart = ({ data, loading, title = "Performance Sistema" }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <TrendingUp className="mr-2 text-orange-500" size={20} />
          {title}
        </h3>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="time" 
            stroke="#666"
            fontSize={12}
            tickFormatter={(value) => new Date(value).toLocaleTimeString('it-IT', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          />
          <YAxis stroke="#666" fontSize={12} />
          <Tooltip 
            labelFormatter={(value) => new Date(value).toLocaleTimeString('it-IT')}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="cpu" 
            stroke="#ef4444" 
            strokeWidth={2}
            name="CPU (%)"
          />
          <Line 
            type="monotone" 
            dataKey="memory" 
            stroke="#3b82f6" 
            strokeWidth={2}
            name="Memoria (%)"
          />
          <Line 
            type="monotone" 
            dataKey="responseTime" 
            stroke="#10b981" 
            strokeWidth={2}
            name="Tempo Risposta (ms)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================================
// CHART ELEZIONI ATTIVE
// ==========================================
export const ActiveElectionsChart = ({ data, loading, title = "Elezioni Attive" }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center">
          <Vote className="mr-2 text-indigo-500" size={20} />
          {title}
        </h3>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" stroke="#666" fontSize={12} />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#666" 
            fontSize={12}
            width={100}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          />
          <Bar 
            dataKey="votes" 
            fill="#6366f1" 
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ==========================================
// METRICS CARDS
// ==========================================
export const MetricCard = ({ title, value, change, icon: Icon, color = "blue", loading = false }) => {
  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900' },
      green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-900' },
      red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-900' },
      yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-900' },
      purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-900' },
      orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-900' }
    };
    return colors[color] || colors.blue;
  };

  const colorClasses = getColorClasses(color);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="flex items-center">
            <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
            <div className="ml-4 flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses.bg}`}>
          <Icon className={`h-6 w-6 ${colorClasses.icon}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline">
            <p className={`text-2xl font-semibold ${colorClasses.text}`}>
              {typeof value === 'number' ? value.toLocaleString('it-IT') : value}
            </p>
            {change !== undefined && (
              <p className={`ml-2 text-sm flex items-center ${
                change > 0 ? 'text-green-600' : change < 0 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {change > 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : change < 0 ? (
                  <TrendingDown className="h-4 w-4 mr-1" />
                ) : null}
                {Math.abs(change)}%
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DASHBOARD ANALYTICS COMPLETO
// ==========================================
export const DashboardAnalytics = ({ 
  stats, 
  chartsData, 
  loading, 
  onRefresh 
}) => {
  const [timeRange, setTimeRange] = useState('7d');

  return (
    <div className="space-y-6">
      {/* Header con filtri */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
          <p className="text-gray-600">Panoramica completa delle metriche del sistema</p>
        </div>
        <div className="flex space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Ultime 24 ore</option>
            <option value="7d">Ultimi 7 giorni</option>
            <option value="30d">Ultimi 30 giorni</option>
            <option value="90d">Ultimi 90 giorni</option>
          </select>
          <button
            onClick={onRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Calendar size={16} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Utenti Totali"
          value={stats.totalUsers}
          change={stats.usersChange}
          icon={Users}
          color="blue"
          loading={loading}
        />
        <MetricCard
          title="Voti Totali"
          value={stats.totalVotes}
          change={stats.votesChange}
          icon={Vote}
          color="green"
          loading={loading}
        />
        <MetricCard
          title="Elezioni Attive"
          value={stats.activeElections}
          change={stats.electionsChange}
          icon={Activity}
          color="purple"
          loading={loading}
        />
        <MetricCard
          title="Tasso Partecipazione"
          value={`${stats.participationRate}%`}
          change={stats.participationChange}
          icon={TrendingUp}
          color="orange"
          loading={loading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VotesChart 
          data={chartsData.votesOverTime} 
          loading={loading}
        />
        <RegistrationsChart 
          data={chartsData.registrationsOverTime} 
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserStatusChart 
          data={chartsData.userStatusDistribution} 
          loading={loading}
        />
        <SystemPerformanceChart 
          data={chartsData.systemPerformance} 
          loading={loading}
        />
      </div>

      {/* Elezioni Attive */}
      <ActiveElectionsChart 
        data={chartsData.activeElections} 
        loading={loading}
      />
    </div>
  );
};

export default {
  VotesChart,
  RegistrationsChart,
  UserStatusChart,
  SystemPerformanceChart,
  ActiveElectionsChart,
  MetricCard,
  DashboardAnalytics
};