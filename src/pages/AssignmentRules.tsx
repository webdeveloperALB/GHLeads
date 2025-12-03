import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { DateTime } from 'luxon';
import CreateRuleModal from '../components/CreateRuleModal';

interface AssignmentRule {
  id: string;
  source_name: string;
  country_code: string;
  assigned_agent_id: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  assigned_agent: {
    id: string;
    full_name: string;
    role: string;
  };
}

const AssignmentRules = () => {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lead_assignment_rules')
        .select(`
          *,
          assigned_agent:user_profiles!lead_assignment_rules_assigned_agent_id_fkey(
            id,
            full_name,
            role
          )
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to fetch assignment rules');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .update({ is_active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success(`Rule ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule status:', error);
      toast.error('Failed to update rule status');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this assignment rule?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lead_assignment_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('Rule deleted successfully');
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleEditRule = (rule: AssignmentRule) => {
    setEditingRule(rule);
    setIsCreateModalOpen(true);
  };

  const handleModalClose = () => {
    setIsCreateModalOpen(false);
    setEditingRule(null);
  };

  const handleRuleCreated = () => {
    fetchRules();
    handleModalClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading assignment rules...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lead Assignment Rules</h1>
          <p className="text-gray-400 mt-1">
            Automatically assign leads from API based on full source and country code
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500"
        >
          <Plus size={16} />
          <span>Create Rule</span>
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <div className="text-gray-400 mb-4">
            No assignment rules configured yet
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Create a rule to automatically assign leads from specific sources and countries to agents
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3 bg-green-600 rounded-lg hover:bg-green-500 inline-flex items-center space-x-2"
          >
            <Plus size={16} />
            <span>Create Your First Rule</span>
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Country
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Assigned Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {rules.map((rule) => (
                <tr key={rule.id} className={!rule.is_active ? 'opacity-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(rule.id, rule.is_active)}
                      className={`p-2 rounded ${
                        rule.is_active
                          ? 'bg-green-600 hover:bg-green-500'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      title={rule.is_active ? 'Active - Click to deactivate' : 'Inactive - Click to activate'}
                    >
                      {rule.is_active ? <Power size={16} /> : <PowerOff size={16} />}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-blue-600 rounded-full text-sm">
                      {rule.source_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-purple-600 rounded-full text-sm">
                      {rule.country_code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium">{rule.assigned_agent.full_name}</span>
                      <span className="text-xs text-gray-400">{rule.assigned_agent.role}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-300">{rule.priority}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {DateTime.fromISO(rule.created_at).toFormat('dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="p-2 bg-blue-600 rounded hover:bg-blue-500"
                        title="Edit rule"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 bg-red-600 rounded hover:bg-red-500"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateRuleModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onRuleCreated={handleRuleCreated}
        editingRule={editingRule}
      />
    </div>
  );
};

export default AssignmentRules;
