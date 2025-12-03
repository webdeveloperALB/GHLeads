import React, { useState, useEffect } from 'react';
import { Upload, X, FileSpreadsheet, FileText, AlertCircle, Download } from 'lucide-react';
import { utils, read } from 'xlsx';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { downloadExcelTemplate, downloadCSVTemplate } from '../utils/templates';
import { exportToCSV, exportToExcel } from '../utils/export';
import toast from 'react-hot-toast';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportedLead {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country?: string;
  brand?: string;
  source?: string;
  funnel?: string;
  desk?: string;
  source_id?: number;
  investment_experience?: string;
  risk_tolerance?: string;
  investment_goal?: string;
  investment_timeframe?: string;
  monthly_income?: string;
  heard_from?: string;
}

interface QuestionMap {
  [key: string]: string;
}

const QUESTION_MAPPING: QuestionMap = {
  investment_experience: 'What is your investment experience?',
  risk_tolerance: 'What is your risk tolerance?',
  investment_goal: 'What is your investment goal?',
  investment_timeframe: 'What is your preferred investment timeframe?',
  monthly_income: 'What is your monthly income?',
  heard_from: 'How did you hear about us?'
};

const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ImportedLead[]>([]);
  const [duplicates, setDuplicates] = useState<ImportedLead[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [leadsToImport, setLeadsToImport] = useState<ImportedLead[]>([]);
  const [questions, setQuestions] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
    }
  }, [isOpen]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_questions')
        .select('id, question')
        .eq('is_active', true);

      if (error) throw error;

      const questionMap: { [key: string]: string } = {};
      data?.forEach(q => {
        // Find matching question field
        const field = Object.entries(QUESTION_MAPPING).find(([_, text]) => text === q.question)?.[0];
        if (field) {
          questionMap[field] = q.id;
        }
      });

      setQuestions(questionMap);
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const validateLeads = (leads: ImportedLead[]): string[] => {
    const errors: string[] = [];
    const emailSet = new Set<string>();

    leads.forEach((lead, index) => {
      const rowNum = index + 2; // +2 because Excel starts at 1 and we have a header row
      
      if (!lead.first_name?.trim()) {
        errors.push(`Row ${rowNum}: First name is required`);
      }
      if (!lead.last_name?.trim()) {
        errors.push(`Row ${rowNum}: Last name is required`);
      }
      if (!lead.email?.trim()) {
        errors.push(`Row ${rowNum}: Email is required`);
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
        errors.push(`Row ${rowNum}: Invalid email format`);
      } else if (emailSet.has(lead.email.toLowerCase())) {
        errors.push(`Row ${rowNum}: Duplicate email address within file`);
      } else {
        emailSet.add(lead.email.toLowerCase());
      }

      if (lead.source_id !== undefined && isNaN(Number(lead.source_id))) {
        errors.push(`Row ${rowNum}: Source ID must be a number`);
      }
    });

    return errors;
  };

  const processFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = utils.sheet_to_json<ImportedLead>(worksheet, { header: 1 });

      // Remove header row and empty rows
      const leads = jsonData.slice(1).filter(row => Object.keys(row).length > 0) as ImportedLead[];
      
      // Validate the data
      const validationErrors = validateLeads(leads);
      setErrors(validationErrors);
      
      if (validationErrors.length === 0) {
        // Get existing leads from database
        const { data: existingLeads, error: existingLeadsError } = await supabase
          .from('leads')
          .select('email')
          .is('api_key_id', null); // Only check leads not from API

        if (existingLeadsError) throw existingLeadsError;

        const existingEmails = new Set(existingLeads.map(lead => lead.email.toLowerCase()));
        const duplicates: ImportedLead[] = [];
        const uniqueLeads: ImportedLead[] = [];

        // Check for duplicates
        leads.forEach(lead => {
          if (existingEmails.has(lead.email.toLowerCase())) {
            duplicates.push(lead);
          } else {
            uniqueLeads.push(lead);
          }
        });

        setDuplicates(duplicates);
        setLeadsToImport(uniqueLeads);
        setPreview(uniqueLeads.slice(0, 5)); // Show first 5 unique leads as preview
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Failed to process file');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
      toast.error('Please upload an Excel or CSV file');
      return;
    }

    processFile(file);
  };

  const handleImport = async () => {
    if (!leadsToImport.length) return;
    
    setImporting(true);
    try {
      // First insert the leads
      const { data: importedLeads, error: leadsError } = await supabase
        .from('leads')
        .insert(leadsToImport.map(lead => ({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          country: lead.country,
          brand: lead.brand,
          source: lead.source,
          funnel: lead.funnel,
          desk: lead.desk,
          status: 'New',
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          has_deposited: false
        })))
        .select('id');

      if (leadsError) throw leadsError;

      // Then insert answers for each lead
      for (let i = 0; i < importedLeads.length; i++) {
        const lead = leadsToImport[i];
        const leadId = importedLeads[i].id;

        const answers = Object.entries(questions).map(([field, questionId]) => ({
          lead_id: leadId,
          question_id: questionId,
          answer: lead[field as keyof ImportedLead] || ''
        })).filter(a => a.answer);

        if (answers.length > 0) {
          const { error: answersError } = await supabase
            .from('lead_answers')
            .insert(answers);

          if (answersError) throw answersError;
        }
      }

      toast.success(`Successfully imported ${leadsToImport.length} leads`);
      if (duplicates.length > 0) {
        toast.info(`${duplicates.length} duplicate leads were skipped`);
      }
      onImportComplete();
      onClose();
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  const exportDuplicates = (format: 'csv' | 'excel') => {
    if (format === 'csv') {
      exportToCSV(duplicates.map(lead => ({
        ...lead,
        id: '',
        status: 'Duplicate',
        created_at: new Date().toISOString(),
        is_converted: false
      })));
    } else {
      exportToExcel(duplicates.map(lead => ({
        ...lead,
        id: '',
        status: 'Duplicate',
        created_at: new Date().toISOString(),
        is_converted: false
      })));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Import Leads</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* File Upload Section */}
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload size={48} className="text-gray-400 mb-4" />
              <span className="text-gray-400">
                Click to upload Excel or CSV file
              </span>
              <span className="text-sm text-gray-500 mt-2">
                Supported formats: .xlsx, .xls, .csv
              </span>
            </label>
          </div>

          {/* Template Download Links */}
          <div className="flex justify-center space-x-4 text-sm">
            <button
              onClick={downloadExcelTemplate}
              className="flex items-center text-blue-400 hover:text-blue-300"
            >
              <FileSpreadsheet size={16} className="mr-2" />
              Download Excel Template
            </button>
            <button
              onClick={downloadCSVTemplate}
              className="flex items-center text-blue-400 hover:text-blue-300"
            >
              <FileText size={16} className="mr-2" />
              Download CSV Template
            </button>
          </div>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="bg-red-900/50 rounded-lg p-4">
              <div className="flex items-center text-red-400 mb-2">
                <AlertCircle size={16} className="mr-2" />
                <span className="font-medium">Validation Errors</span>
              </div>
              <ul className="text-sm space-y-1 text-red-300">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Duplicates Section */}
          {duplicates.length > 0 && (
            <div className="bg-yellow-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-yellow-400">
                  <AlertCircle size={16} className="mr-2" />
                  <span className="font-medium">
                    {duplicates.length} duplicate {duplicates.length === 1 ? 'lead' : 'leads'} found
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => exportDuplicates('csv')}
                    className="flex items-center px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                  >
                    <Download size={14} className="mr-1" />
                    CSV
                  </button>
                  <button
                    onClick={() => exportDuplicates('excel')}
                    className="flex items-center px-3 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                  >
                    <Download size={14} className="mr-1" />
                    Excel
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400">
                      <th className="py-2">Email</th>
                      <th className="py-2">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map((lead, index) => (
                      <tr key={index} className="border-t border-gray-700">
                        <td className="py-2">{lead.email}</td>
                        <td className="py-2">{`${lead.first_name} ${lead.last_name}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {preview.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Preview (First 5 Leads to Import)</h3>
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800">
                      <th className="px-4 py-2 text-left">First Name</th>
                      <th className="px-4 py-2 text-left">Last Name</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Phone</th>
                      <th className="px-4 py-2 text-left">Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((lead, index) => (
                      <tr key={index} className="border-t border-gray-800">
                        <td className="px-4 py-2">{lead.first_name}</td>
                        <td className="px-4 py-2">{lead.last_name}</td>
                        <td className="px-4 py-2">{lead.email}</td>
                        <td className="px-4 py-2">{lead.phone}</td>
                        <td className="px-4 py-2">{lead.country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || errors.length > 0 || leadsToImport.length === 0}
              className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : `Import ${leadsToImport.length} Leads`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportLeadsModal;