import { Lead } from '../lib/supabase';
import { utils, writeFile } from 'xlsx';
import { DateTime } from 'luxon';

// Helper to format dates
const formatDate = (date: string | null) => {
  if (!date) return '';
  return DateTime.fromISO(date).toFormat('yyyy-MM-dd HH:mm:ss');
};

// Define the columns for export
const exportColumns = [
  { key: 'id', label: 'ID' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'country', label: 'Country' },
  { key: 'status', label: 'Status' },
  { key: 'brand', label: 'Brand' },
  { key: 'source', label: 'Source' },
  { key: 'funnel', label: 'Funnel' },
  { key: 'desk', label: 'Desk' },
  { key: 'balance', label: 'Balance' },
  { key: 'total_deposits', label: 'Total Deposits' },
  { key: 'created_at', label: 'Created At' },
  { key: 'last_activity', label: 'Last Activity' },
  { key: 'is_converted', label: 'Converted' },
  { key: 'converted_at', label: 'Converted At' }
];

// Transform lead data for export
const transformLeadData = (leads: Lead[]) => {
  return leads.map(lead => ({
    ...lead,
    created_at: formatDate(lead.created_at),
    last_activity: formatDate(lead.last_activity),
    converted_at: formatDate(lead.converted_at),
    is_converted: lead.is_converted ? 'Yes' : 'No',
    balance: lead.balance?.toString() || '0',
    total_deposits: lead.total_deposits?.toString() || '0'
  }));
};

// Export to CSV
export function exportToCSV(leads: Lead[]) {
  const data = transformLeadData(leads);
  const csvContent = [
    // Header row
    exportColumns.map(col => col.label).join(','),
    // Data rows
    ...data.map(lead => 
      exportColumns.map(col => {
        const value = lead[col.key as keyof typeof lead];
        // Escape commas and quotes in values
        return `"${String(value || '').replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `leads_export_${DateTime.now().toFormat('yyyyMMdd_HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Export to Excel
export function exportToExcel(leads: Lead[]) {
  const data = transformLeadData(leads);
  
  // Create worksheet
  const ws = utils.json_to_sheet(data, {
    header: exportColumns.map(col => col.key)
  });

  // Set column headers
  utils.sheet_add_aoa(ws, [exportColumns.map(col => col.label)], { origin: 'A1' });

  // Create workbook
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Leads');

  // Generate Excel file
  writeFile(wb, `leads_export_${DateTime.now().toFormat('yyyyMMdd_HHmmss')}.xlsx`);
}