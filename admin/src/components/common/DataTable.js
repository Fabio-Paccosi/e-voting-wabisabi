import React from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

const DataTable = ({ 
  columns, 
  data, 
  loading, 
  searchable = true,
  searchPlaceholder = "Cerca...",
  onSearch,
  sortable = true,
  onSort,
  sortBy,
  sortDirection = 'asc',
  emptyMessage = "Nessun dato disponibile",
  className = ''
}) => {
  const handleSort = (columnKey) => {
    if (!sortable || !onSort) return;
    
    const newDirection = sortBy === columnKey && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newDirection);
  };

  const getSortIcon = (columnKey) => {
    if (!sortable || sortBy !== columnKey) return null;
    
    return sortDirection === 'asc' ? 
      <ChevronUp size={16} className="text-gray-400" /> : 
      <ChevronDown size={16} className="text-gray-400" />;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        {/* Header skeleton */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
        </div>
        
        {/* Rows skeleton */}
        <div className="divide-y divide-gray-200">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex space-x-4">
                {columns.map((_, colIndex) => (
                  <div key={colIndex} className="animate-pulse bg-gray-200 h-4 flex-1 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Search */}
      {searchable && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              onChange={(e) => onSearch && onSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    sortable && column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length > 0 ? (
              data.map((row, index) => (
                <tr key={row.id || index} className="hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {column.render ? column.render(row[column.key], row, index) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;