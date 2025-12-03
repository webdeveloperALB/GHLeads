import React from 'react';
import { Users, Trash2, Shuffle } from 'lucide-react';
import { supabase, type Lead, getCurrentUser, getSubordinateIds } from '../lib/supabase';
import AssignAgentSelect from './AssignAgentSelect';
import RandomAssignModal from './RandomAssignModal';
import toast from 'react-hot-toast';

interface BulkActionsProps {
  selectedLeads: Lead[];
  statuses: { name: string }[];
  onActionComplete: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({ selectedLeads, statuses, onActionComplete }) => {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isRandomAssignModalOpen, setIsRandomAssignModalOpen] = React.useState(false);
  const [availableAgents, setAvailableAgents] = React.useState<any[]>([]);
  const [currentUser, setCurrentUser] = React.useState<any>(null);

  React.useEffect(() => {
    checkUserRole();
    fetchAvailableAgents();
  }, []);

  const checkUserRole = async () => {
    const user = await getCurrentUser();
    setIsAdmin(user?.role === 'admin' || user?.role === 'desk');
  };

  const fetchAvailableAgents = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
      
      if (!user) return;
      
      const { data: allUsers, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, manager_id')
        .order('full_name');

      if (error) throw error;

      // Get subordinate IDs for filtering
      let subordinateIds: string[] = [];
      if (['desk', 'manager'].includes(user.role)) {
        subordinateIds = await getSubordinateIds();
      }

      // Apply the same filtering logic as AssignAgentSelect
      let assignableUsers: any[] = [];
      
      if (user.role === 'admin') {
        // Admins can assign to all users (agents, managers, desk)
        assignableUsers = (allUsers || []).filter(u => 
          ['agent', 'manager', 'desk'].includes(u.role)
        );
      } else if (['desk', 'manager'].includes(user.role)) {
        // Desk and Manager users can assign to themselves + their subordinates
        assignableUsers = (allUsers || []).filter(u => 
          u.id === user.id || subordinateIds.includes(u.id)
        );
      } else {
        // Agents can only assign to themselves
        assignableUsers = [user];
      }
      
      // Remove duplicates and sort alphabetically
      const uniqueUsers = assignableUsers.filter((user, index, self) => 
        index === self.findIndex(u => u.id === user.id)
      );
      
      setAvailableAgents(uniqueUsers.sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } catch (error) {
      console.error('Error fetching available agents:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .in('id', selectedLeads.map(lead => lead.id));

      if (error) throw error;

      await Promise.all(
        selectedLeads.map(lead =>
          supabase.from('lead_activities').insert({
            lead_id: lead.id,
            type: 'status_change',
            description: `Status changed to ${newStatus} (bulk update)`
          })
        )
      );

      toast.success('Status updated for selected leads');
      onActionComplete();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleAssignAgent = async (agentId: string | null) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: agentId })
        .in('id', selectedLeads.map(lead => lead.id));

      if (error) throw error;

      await Promise.all(
        selectedLeads.map(lead =>
          supabase.from('lead_activities').insert({
            lead_id: lead.id,
            type: 'assignment',
            description: agentId ? 'Lead assigned (bulk update)' : 'Lead unassigned (bulk update)'
          })
        )
      );

      toast.success(agentId ? 'Leads assigned successfully' : 'Leads unassigned successfully');
      onActionComplete();
    } catch (error) {
      console.error('Error assigning agent:', error);
      toast.error('Failed to assign agent');
    }
  };

  const handleDeleteLeads = async () => {
    if (!isAdmin) {
      toast.error('Only admins can delete leads');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} leads? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', selectedLeads.map(lead => lead.id));

      if (error) throw error;

      toast.success('Leads deleted successfully');
      onActionComplete();
    } catch (error) {
      console.error('Error deleting leads:', error);
      toast.error('Failed to delete leads');
    }
  };

  if (selectedLeads.length === 0) return null;

  return (
    <>
    <div className="bg-gray-800 p-4 rounded-lg mb-4 flex items-center space-x-4">
      <div className="flex items-center text-sm text-gray-400">
        <Users size={16} className="mr-2" />
        <span>{selectedLeads.length} leads selected</span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center space-x-4">
        <select
          onChange={(e) => handleStatusChange(e.target.value)}
          className="bg-gray-700 rounded px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>Change Status</option>
          {statuses.map((status) => (
            <option key={status.name} value={status.name}>
              {status.name}
            </option>
          ))}
        </select>

        <AssignAgentSelect
          value={null}
          onChange={handleAssignAgent}
          className="min-w-[200px]"
          allUsers={availableAgents}
        />
        
        <button
          onClick={() => setIsRandomAssignModalOpen(true)}
          className="px-3 py-2 bg-purple-600 rounded flex items-center space-x-2 hover:bg-purple-500 text-sm"
        >
          <Shuffle size={14} />
          <span>Randomly Assign</span>
        </button>

        {isAdmin && (
          <button
            onClick={handleDeleteLeads}
            className="px-3 py-2 bg-red-600 rounded flex items-center space-x-2 hover:bg-red-500 text-sm"
          >
            <Trash2 size={14} />
            <span>Delete Selected</span>
          </button>
        )}
      </div>
    </div>

    <RandomAssignModal
      isOpen={isRandomAssignModalOpen}
      onClose={() => setIsRandomAssignModalOpen(false)}
      selectedLeads={selectedLeads}
      availableAgents={availableAgents}
      onAssignmentComplete={onActionComplete}
    />
    </>
  );
};

export default BulkActions;