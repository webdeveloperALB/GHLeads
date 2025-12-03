import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { Filter, ArrowDown, Copy, Check } from 'lucide-react';
import { supabase, type Lead, getCurrentUser } from '../lib/supabase';
import AssignAgentSelect from '../components/AssignAgentSelect';
import ExportMenu from '../components/ExportMenu';
import BulkActions from '../components/BulkActions';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { getLocalTime } from '../utils/time';
import { DateTime } from 'luxon';

interface LeadStatus {
  name: string;
  is_system: boolean;
}

const Retention = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [dataTableSelection, setDataTableSelection] = useState<RowSelectionState>({});
  const [canPerformAdminActions, setCanPerformAdminActions] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);


  useEffect(() => {
    checkUserRole();
    fetchStatuses();
    initializeComponent();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchLeads();
      const subscription = setupRealtimeSubscription();
      
      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [currentUser, refreshTrigger]);

  const initializeComponent = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const checkUserRole = async () => {
    const user = await getCurrentUser();
    setCanPerformAdminActions(user?.role === 'admin');
  };

  const getSubordinateIds = async () => {
    // Implementation for getting subordinate IDs
    return [];
  };

  const fetchLeads = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setLeads([]);

    try {
      // Fetch all converted leads in batches to avoid memory issues
      let allLeads: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      console.log('🔄 [Retention] Starting to fetch all converted leads...');

      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select(`
            *,
            assigned_to_user:user_profiles!leads_assigned_to_fkey(
              id,
              full_name,
              role
            )
          `)
          .eq('is_converted', true)
          .order('converted_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        
        if (data && data.length > 0) {
          allLeads = [...allLeads, ...data];
          console.log(`📦 [Retention] Loaded batch: ${data.length} leads (total: ${allLeads.length})`);
          
          if (data.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ [Retention] Finished loading all converted leads: ${allLeads.length}`);
      let subordinateIds: string[] = [];
      if (['desk', 'manager'].includes(currentUser.role)) {
        subordinateIds = await getSubordinateIds();
        console.log(`👥 [Retention] Subordinate IDs for ${currentUser.full_name} (${currentUser.role}):`, subordinateIds);
      }

      let filteredLeads = allLeads;

      if (currentUser.role === 'admin') {
        // Admins see all leads, no further filtering needed
        console.log(`👑 [Retention] Admin user - showing all ${allLeads.length} leads`);
      } else if (currentUser.role === 'desk') {
        filteredLeads = filteredLeads.filter(lead =>
          (lead.desk === currentUser.full_name) ||
          (lead.assigned_to === currentUser.id) ||
          (lead.assigned_to && subordinateIds.includes(lead.assigned_to))
        );
      } else if (currentUser.role === 'manager') {
        filteredLeads = filteredLeads.filter(lead =>
          (lead.assigned_to === currentUser.id) ||
          (lead.assigned_to && subordinateIds.includes(lead.assigned_to))
        );
      } else if (currentUser.role === 'agent') {
        // Agents can only see leads assigned to them (no unassigned leads)
        filteredLeads = filteredLeads.filter(lead => 
          lead.assigned_to === currentUser.id
        );
      }
      
      setLeads(filteredLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const setupRealtimeSubscription = useCallback(() => {
    if (!currentUser) return null;

    const channel = supabase
      .channel('retention-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: 'is_converted=eq.true'
        },
        (payload) => {
          setRefreshTrigger(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: 'is_converted=eq.true'
        },
        (payload) => {
          setRefreshTrigger(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to retention changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to retention changes');
        }
      });

    return channel;
  }, [currentUser]);

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*');

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  };

  const clearSelections = () => {
    setDataTableSelection({});
    setSelectedLeads([]);
  };

  const onActionComplete = () => {
    fetchLeads();
    clearSelections();
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'status_change',
        description: `Status changed to ${newStatus}`
      });

      toast.success('Status updated successfully');
      // Update the lead in the current state instead of triggering full refresh
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleAssignAgent = async (leadId: string, agentId: string | null) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: agentId })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'assignment',
        description: agentId ? 'Lead assigned' : 'Lead unassigned'
      });

      toast.success(agentId ? 'Lead assigned successfully' : 'Lead unassigned successfully');
      // Update the lead in the current state instead of triggering full refresh
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === leadId ? { ...lead, assigned_to: agentId } : lead
        )
      );
    } catch (error) {
      console.error('Error assigning agent:', error);
      toast.error('Failed to assign agent');
    }
  };

  const handleDemoteToLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          is_converted: false,
          converted_at: null,
          status: 'New'
        })
        .eq('id', leadId);

      if (error) throw error;

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        type: 'demotion',
        description: 'Client demoted to lead'
      });

      toast.success('Client demoted to lead successfully');
      // Update the lead in the current state instead of triggering full refresh
      setLeads(prevLeads => 
        prevLeads.filter(lead => lead.id !== leadId)
      );
    } catch (error) {
      console.error('Error demoting client:', error);
      toast.error('Failed to demote client');
    }
  };

  const copyToClipboard = async (text: string, type: string, leadId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      const copyId = `${type}-${leadId}`;
      setCopiedItem(copyId);
      toast.success(`${type} copied to clipboard`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const columns = [
    { 
      header: 'ID',
      accessorKey: 'id',
      cell: ({ row }) => ( // Changed from span to a tag
        <a
          href={`/lead/${row.original.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 cursor-pointer hover:underline"
        >
          {row.original.id}
        </a>
      ),
      enableColumnFilter: true,
    },
    { 
      header: 'Full Name',
      accessorFn: (row) => `${row.first_name} ${row.last_name}`,
      enableColumnFilter: true,
    },
    { 
      header: 'Email',
      accessorKey: 'email',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <span>{row.original.email}</span>
          <button
            onClick={() => copyToClipboard(row.original.email, 'Email', row.original.id)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
            title="Copy email"
          >
            {copiedItem === `Email-${row.original.id}` ? (
              <Check size={14} className="text-green-400" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        </div>
      ),
      enableColumnFilter: true,
    },
    { 
      header: 'Phone',
      accessorKey: 'phone',
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <span>{row.original.phone}</span>
          {row.original.phone && (
            <button
              onClick={() => copyToClipboard(row.original.phone, 'Phone', row.original.id)}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
              title="Copy phone"
            >
              {copiedItem === `Phone-${row.original.id}` ? (
                <Check size={14} className="text-green-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      ),
      enableColumnFilter: true,
    },
    { 
      header: 'Country',
      accessorKey: 'country',
      enableColumnFilter: true,
    },
    {
      header: 'Local Time',
      accessorFn: (row) => getLocalTime(row.country),
      cell: ({ getValue }) => getValue(),
      enableColumnFilter: false,
    },
    { 
      header: 'Source',
      accessorKey: 'source',
      enableColumnFilter: true,
    },
    { 
      header: 'Funnel',
      accessorKey: 'funnel',
      enableColumnFilter: true,
    },
    { 
      header: 'Desk',
      accessorKey: 'desk',
      enableColumnFilter: true,
    },
    { 
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <StatusBadge 
          status={row.original.status} 
          onChange={(newStatus) => handleStatusChange(row.original.id, newStatus)}
        />
      ),
      enableColumnFilter: true,
    },
    {
      header: 'Assigned To',
      id: 'assigned_to_name',
      accessorFn: (row) => row.assigned_to_user?.full_name || 'Unassigned',
      cell: ({ row }) => (
        <AssignAgentSelect
          value={row.original.assigned_to}
          onChange={(agentId) => handleAssignAgent(row.original.id, agentId)}
        />
      ),
      enableColumnFilter: true,
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
          return true;
        }
        
        const assignedToName = row.original.assigned_to_user?.full_name || 'Unassigned';
        return filterValue.includes(assignedToName);
      },
    },
    {
      header: 'Balance',
      accessorKey: 'balance',
      cell: ({ row }) => `€${row.original.balance || 0}`,
      enableColumnFilter: true,
    },
    {
      header: 'Actions',
      cell: ({ row }) => (
        <button
          onClick={() => handleDemoteToLead(row.original.id)}
          className="px-2 py-1 bg-yellow-600 rounded flex items-center space-x-1 hover:bg-yellow-500 text-sm"
          title="Demote to Lead"
        >
          <ArrowDown size={14} />
          <span>Demote</span>
        </button>
      ),
      enableColumnFilter: false,
    },
    { 
      header: 'Converted At',
      accessorKey: 'converted_at',
      cell: ({ row }) => {
        if (!row.original.converted_at) return '-';
        const date = DateTime.fromISO(row.original.converted_at);
        return (
          <div className="text-sm">
            <div>{date.toFormat('dd/MM/yyyy')}</div>
            <div className="text-gray-400">{date.toFormat('HH:mm')}</div>
          </div>
        );
      },
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue || !Array.isArray(filterValue)) return true;
        
        const cellValue = row.getValue(columnId);
        if (!cellValue) return false;
        
        const rowDate = DateTime.fromISO(cellValue);
        
        // Check if the row date falls within any of the provided date ranges
        return filterValue.some(([startDate, endDate]: [string, string]) => {
          const start = DateTime.fromISO(startDate).startOf('day');
          const end = DateTime.fromISO(endDate).endOf('day');
          return rowDate >= start && rowDate <= end;
        });
      },
      enableColumnFilter: true,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Retention</h1>
          {loading && (
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span>Loading all leads...</span>
            </div>
          )}
          <div className="flex space-x-3">
            <button className="px-4 py-2 bg-gray-700 rounded-lg flex items-center space-x-2 hover:bg-gray-600">
              <Filter size={16} />
              <span>Filter</span>
            </button>
            {canPerformAdminActions && <ExportMenu leadsToExport={selectedLeads.length > 0 ? selectedLeads : leads} />}
          </div>
        </div>

        <BulkActions
          selectedLeads={selectedLeads}
          statuses={statuses}
          onActionComplete={onActionComplete}
        />
        
        {leads.length > 0 && (
          <div className="text-sm text-gray-400">
            Showing {leads.length} leads (all loaded)
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="bg-gray-800 rounded-lg h-full overflow-hidden">
          <DataTable
            data={leads}
            columns={columns}
            rowSelection={dataTableSelection}
            onRowSelectionChange={setDataTableSelection}
            onSelectedRowsChange={setSelectedLeads}
          />
        </div>
      </div>
    </div>
  );
};

export default Retention;