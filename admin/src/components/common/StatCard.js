import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ 
  title, 
  value, 
  loading, 
  icon: Icon, 
  color = 'blue', 
  trend, 
  subtitle,
  onClick,
  className = ''
}) => {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50', 
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
    red: 'text-red-600 bg-red-50'
  };

  const handleClick = () => {
    if (onClick) onClick();
  };

  return (
    <div 
      className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer hover:border-gray-300' : ''
      } ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
              <Icon size={20} />
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium text-gray-700">{title}</h3>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        
        {trend !== undefined && (
          <div className={`flex items-center text-sm ${
            trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend > 0 ? (
              <TrendingUp size={16} />
            ) : trend < 0 ? (
              <TrendingDown size={16} />
            ) : null}
            {trend !== 0 && (
              <span className="ml-1">{Math.abs(trend)}%</span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-end justify-between">
        {loading ? (
          <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
        ) : (
          <p className={`text-2xl font-bold text-${color}-600`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        )}
      </div>
    </div>
  );
};

export default StatCard;