import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUsers } from '../hooks/useUsers';

interface CreateRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRuleCreated: () => void;
  editingRule?: {
    id: string;
    source_name: string;
    country_code: string;
    assigned_agent_id: string;
    priority: number;
  } | null;
}

const COUNTRIES = [
  { code: 'DE', name: 'Germany' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'RO', name: 'Romania' },
  { code: 'HU', name: 'Hungary' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' },
];

const CreateRuleModal: React.FC<CreateRuleModalProps> = ({
  isOpen,
  onClose,
  onRuleCreated,
  editingRule,
}) => {
  const { users } = useUsers();
  const [formData, setFormData] = useState({
    source_name: '',
    country_code: '',
    assigned_agent_id: '',
    priority: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editingRule) {
      setFormData({
        source_name: editingRule.source_name,
        country_code: editingRule.country_code,
        assigned_agent_id: editingRule.assigned_agent_id,
        priority: editingRule.priority,
      });
    } else {
      setFormData({
        source_name: '',
        country_code: '',
        assigned_agent_id: '',
        priority: 0,
      });
    }
  }, [editingRule, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.source_name.trim()) {
      toast.error('Source name is required');
      return;
    }

    if (!formData.country_code) {
      toast.error('Country is required');
      return;
    }

    if (!formData.assigned_agent_id) {
      toast.error('Please select an agent');
      return;
    }

    setSubmitting(true);

    try {
      if (editingRule) {
        const { error } = await supabase
          .from('lead_assignment_rules')
          .update({
            source_name: formData.source_name.trim(),
            country_code: formData.country_code,
            assigned_agent_id: formData.assigned_agent_id,
            priority: formData.priority,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Assignment rule updated successfully');
      } else {
        const { error } = await supabase
          .from('lead_assignment_rules')
          .insert({
            source_name: formData.source_name.trim(),
            country_code: formData.country_code,
            assigned_agent_id: formData.assigned_agent_id,
            priority: formData.priority,
            is_active: true,
          });

        if (error) {
          if (error.code === '23505') {
            toast.error('A rule with this source, country, and agent already exists');
            return;
          }
          throw error;
        }
        toast.success('Assignment rule created successfully');
      }

      onRuleCreated();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save assignment rule');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const activeAgents = users.filter(u => ['agent', 'manager', 'desk'].includes(u.role));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold">
            {editingRule ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={submitting}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Source Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.source_name}
              onChange={(e) => setFormData({ ...formData, source_name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., test234243432"
              disabled={submitting}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              The API key prefix as shown in the Source column of leads
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Country <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.country_code}
              onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
              required
            >
              <option value="">Select a country</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Assign To <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.assigned_agent_id}
              onChange={(e) => setFormData({ ...formData, assigned_agent_id: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={submitting}
              required
            >
              <option value="">Select an agent</option>
              {activeAgents.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              disabled={submitting}
              min="0"
            />
            <p className="text-xs text-gray-400 mt-1">
              
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRuleModal;
