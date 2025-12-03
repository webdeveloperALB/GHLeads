import React, { useState } from 'react';
import { X, Users, Shuffle } from 'lucide-react';
import { supabase, type Lead, type UserProfile } from '../lib/supabase';
import toast from 'react-hot-toast';

interface RandomAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeads: Lead[];
  availableAgents: UserProfile[];
  onAssignmentComplete: () => void;
}

const RandomAssignModal: React.FC<RandomAssignModalProps> = ({
  isOpen,
  onClose,
  selectedLeads,
  availableAgents,
  onAssignmentComplete
}) => {
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleDistribute = async () => {
    if (selectedAgents.length === 0) {
      toast.error('Please select at least one agent');
      return;
    }

    setLoading(true);
    try {
      // Shuffle the leads for random distribution
      const shuffledLeads = shuffleArray(selectedLeads);
      
      // Distribute leads evenly among selected agents
      const assignments: { leadId: string; agentId: string }[] = [];
      
      shuffledLeads.forEach((lead, index) => {
        const agentIndex = index % selectedAgents.length;
        assignments.push({
          leadId: lead.id.toString(),
          agentId: selectedAgents[agentIndex]
        });
      });

      // Update leads in batches
      for (const assignment of assignments) {
        const { error } = await supabase
          .from('leads')
          .update({ assigned_to: assignment.agentId })
          .eq('id', assignment.leadId);

        if (error) throw error;

        // Add activity log
        await supabase.from('lead_activities').insert({
          lead_id: assignment.leadId,
          type: 'assignment',
          description: 'Lead randomly assigned via bulk action'
        });
      }

      // Show success message with distribution summary
      const agentNames = availableAgents
        .filter(agent => selectedAgents.includes(agent.id))
        .map(agent => agent.full_name);
      
      const leadsPerAgent = Math.floor(selectedLeads.length / selectedAgents.length);
      const remainder = selectedLeads.length % selectedAgents.length;
      
      let summaryMessage = `${selectedLeads.length} leads randomly distributed among ${selectedAgents.length} agents:\n`;
      agentNames.forEach((name, index) => {
        const count = leadsPerAgent + (index < remainder ? 1 : 0);
        summaryMessage += `• ${name}: ${count} leads\n`;
      });

      toast.success(summaryMessage, { duration: 5000 });
      onAssignmentComplete();
      onClose();
    } catch (error) {
      console.error('Error distributing leads:', error);
      toast.error('Failed to distribute leads');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const leadsPerAgent = selectedAgents.length > 0 
    ? Math.floor(selectedLeads.length / selectedAgents.length)
    : 0;
  const remainder = selectedAgents.length > 0 
    ? selectedLeads.length % selectedAgents.length 
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Shuffle className="text-blue-400" size={24} />
            <h2 className="text-xl font-semibold">Random Lead Assignment</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="text-blue-400" size={16} />
              <span className="font-medium text-blue-400">Distribution Summary</span>
            </div>
            <p className="text-sm text-gray-300">
              {selectedLeads.length} leads will be randomly distributed among {selectedAgents.length} selected agents
            </p>
            {selectedAgents.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                <p>Each agent will receive: {leadsPerAgent} leads</p>
                {remainder > 0 && (
                  <p>{remainder} agent{remainder > 1 ? 's' : ''} will receive 1 additional lead</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-medium mb-4">Select Agents ({selectedAgents.length} selected)</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableAgents.map((agent) => (
              <label
                key={agent.id}
                className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-600 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedAgents.includes(agent.id)}
                  onChange={() => handleAgentToggle(agent.id)}
                  className="rounded bg-gray-600 border-gray-500"
                />
                <div className="flex-1">
                  <div className="font-medium">{agent.full_name}</div>
                  <div className="text-sm text-gray-400 capitalize">{agent.role}</div>
                </div>
                {selectedAgents.includes(agent.id) && (
                  <div className="text-xs text-blue-400">
                    ~{leadsPerAgent + (selectedAgents.indexOf(agent.id) < remainder ? 1 : 0)} leads
                  </div>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleDistribute}
            disabled={loading || selectedAgents.length === 0}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center space-x-2"
          >
            <Shuffle size={16} />
            <span>{loading ? 'Distributing...' : 'Distribute Randomly'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RandomAssignModal;