import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { Lead } from '../lib/supabase';
import { exportToCSV, exportToExcel } from '../utils/export';

interface ExportMenuProps {
  leadsToExport: Lead[];
}

const ExportMenu: React.FC<ExportMenuProps> = ({ leadsToExport }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = (type: 'csv' | 'excel') => {
    if (type === 'csv') {
      exportToCSV(leadsToExport);
    } else {
      exportToExcel(leadsToExport);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-gray-700 rounded-lg flex items-center space-x-2 hover:bg-gray-600"
      >
        <Download size={16} />
        <span>Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg overflow-hidden z-50">
          <div className="flex justify-between items-center p-2 border-b border-gray-700">
            <span className="text-sm font-medium">Export Options</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="p-1">
            <button
              onClick={() => handleExport('csv')}
              className="w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-gray-700 rounded"
            >
              <FileText size={16} />
              <span>Export as CSV</span>
            </button>
            
            <button
              onClick={() => handleExport('excel')}
              className="w-full px-3 py-2 text-left flex items-center space-x-2 hover:bg-gray-700 rounded"
            >
              <FileSpreadsheet size={16} />
              <span>Export as Excel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;