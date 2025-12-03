import { utils, writeFile } from 'xlsx';

// Template columns with descriptions
const templateColumns = [
  { key: 'first_name', label: 'First Name', description: 'Required' },
  { key: 'last_name', label: 'Last Name', description: 'Required' },
  { key: 'email', label: 'Email', description: 'Required, must be unique' },
  { key: 'phone', label: 'Phone', description: 'Optional' },
  { key: 'country', label: 'Country', description: 'Optional' },
  { key: 'brand', label: 'Brand', description: 'Optional' },
  { key: 'source', label: 'Source', description: 'Optional' },
  { key: 'funnel', label: 'Funnel', description: 'Optional' },
  { key: 'desk', label: 'Desk', description: 'Optional' },
  { key: 'source_id', label: 'Source ID', description: 'Optional' },
  { key: 'investment_experience', label: 'Investment Experience', description: 'Optional - Answer to question' },
  { key: 'risk_tolerance', label: 'Risk Tolerance', description: 'Optional - Answer to question' },
  { key: 'investment_goal', label: 'Investment Goal', description: 'Optional - Answer to question' },
  { key: 'investment_timeframe', label: 'Investment Timeframe', description: 'Optional - Answer to question' },
  { key: 'monthly_income', label: 'Monthly Income', description: 'Optional - Answer to question' },
  { key: 'heard_from', label: 'How did you hear about us?', description: 'Optional - Answer to question' }
];

// Sample data for template
const sampleData = [
  {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    country: 'United States',
    brand: 'Brand Name',
    source: 'Sourcelive123',
    funnel: 'Main Funnel',
    desk: 'Desk 1',
    source_id: '',
    investment_experience: '5 years in forex trading',
    risk_tolerance: 'Medium to High',
    investment_goal: 'Long-term wealth building',
    investment_timeframe: '3-5 years',
    monthly_income: '$5,000-$10,000',
    heard_from: 'Online advertisement'
  }
];

export function downloadExcelTemplate() {
  // Create worksheet with headers and sample data
  const ws = utils.json_to_sheet([]);
  
  // Add headers with descriptions
  const headers = templateColumns.map(col => `${col.label} (${col.description})`);
  utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });
  
  // Add sample data
  utils.sheet_add_json(ws, sampleData, { origin: 'A2', skipHeader: true });

  // Create workbook
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Lead Import Template');

  // Save file
  writeFile(wb, 'lead_import_template.xlsx');
}

export function downloadCSVTemplate() {
  // Create CSV content with headers and sample data
  const headers = templateColumns.map(col => `"${col.label} (${col.description})"`).join(',');
  const sampleRow = templateColumns
    .map(col => `"${sampleData[0][col.key as keyof typeof sampleData[0]] || ''}"`)
    .join(',');
  
  const csvContent = `${headers}\n${sampleRow}`;
  
  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'lead_import_template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}