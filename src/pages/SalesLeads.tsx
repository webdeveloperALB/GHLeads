import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable";
import {
  Filter,
  Plus,
  Upload,
  Euro as EuroSign,
  Copy,
  Check,
} from "lucide-react";
import {
  supabase,
  getCurrentUser,
  getSubordinateIds,
  type Lead,
} from "../lib/supabase";
import CreateLeadModal from "../components/CreateLeadModal";
import ImportLeadsModal from "../components/ImportLeadsModal";
import AssignAgentSelect from "../components/AssignAgentSelect";
import BulkActions from "../components/BulkActions";
import ExportMenu from "../components/ExportMenu";
import AddDepositModal from "../components/AddDepositModal";
import StatusBadge from "../components/StatusBadge";
import toast from "react-hot-toast";
import { getLocalTime } from "../utils/time";
import { DateTime } from "luxon";
import { useUsers } from "../hooks/useUsers";

interface LeadStatus {
  name: string;
  is_system: boolean;
}

const SalesLeads = () => {
  const navigate = useNavigate();
  const { users } = useUsers();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [dataTableSelection, setDataTableSelection] =
    useState<RowSelectionState>({});
  const [canPerformAdminActions, setCanPerformAdminActions] = useState(false);
  const [isAddDepositModalOpen, setIsAddDepositModalOpen] = useState(false);
  const [selectedLeadForDeposit, setSelectedLeadForDeposit] = useState<
    string | null
  >(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [canAddDeposit, setCanAddDeposit] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const initializeComponent = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    setCanPerformAdminActions(user?.role === "admin");
    setCanAddDeposit(user?.role !== "agent");
  };

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("*")
        .order("name");

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error("Error fetching statuses:", error);
    }
  };

  const fetchLeads = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    setLeads([]);

    try {
      const batchSize = 1000;
      let offset = 0;
      let allLeads: Lead[] = [];
      let hasMore = true;

      console.log("🔄 [SalesLeads] Starting incremental lead fetch...");

      // Step 1️⃣: Fetch the first batch (fast initial render)
      const { data: firstBatch, error: firstError } = await supabase
        .from("leads")
        .select(
          `
        *,
        assigned_to_user:user_profiles!leads_assigned_to_fkey(
          id,
          full_name,
          role
        )
      `
        )
        .eq("is_converted", false)
        .order("created_at", { ascending: false })
        .range(0, batchSize - 1);

      if (firstError) throw firstError;
      allLeads = firstBatch || [];
      offset += batchSize;

      // Apply hierarchy filtering before showing first batch
      let subordinateIds: string[] = [];
      if (["desk", "manager"].includes(currentUser.role)) {
        subordinateIds = await getSubordinateIds();
      }

      let filteredFirstBatch = allLeads;

      if (currentUser.role === "admin") {
        // Admins see all leads
      } else if (currentUser.role === "desk") {
        filteredFirstBatch = allLeads.filter(
          (lead) =>
            lead.desk === currentUser.full_name ||
            lead.assigned_to === currentUser.id ||
            (lead.assigned_to && subordinateIds.includes(lead.assigned_to))
        );
      } else if (currentUser.role === "manager") {
        filteredFirstBatch = allLeads.filter(
          (lead) =>
            lead.assigned_to === currentUser.id ||
            (lead.assigned_to && subordinateIds.includes(lead.assigned_to))
        );
      } else if (currentUser.role === "agent") {
        filteredFirstBatch = allLeads.filter(
          (lead) => lead.assigned_to === currentUser.id
        );
      }

      // Show the first filtered batch immediately
      setLeads(filteredFirstBatch);
      console.log(`🚀 Rendered first ${filteredFirstBatch.length} leads`);

      // Step 2️⃣: Background load of remaining leads
      const loadRemaining = async () => {
        let iterations = 0;
        const maxIterations = 100;

        while (hasMore && iterations < maxIterations) {
          iterations++;
          console.log(
            `🔄 [SalesLeads] Fetching batch ${iterations}, offset: ${offset}`
          );

          const { data, error } = await supabase
            .from("leads")
            .select(
              `
            *,
            assigned_to_user:user_profiles!leads_assigned_to_fkey(
              id,
              full_name,
              role
            )
          `
            )
            .eq("is_converted", false)
            .order("created_at", { ascending: false })
            .range(offset, offset + batchSize - 1);

          if (error) {
            console.error("❌ Error loading next batch:", error);
            break;
          }

          if (data && data.length > 0) {
            console.log(
              `📊 Received ${data.length} leads from database in batch ${iterations}`
            );
            offset += batchSize;

            // Apply hierarchy filtering on new batch
            let filteredBatch = data;
            if (currentUser.role === "admin") {
              // all ok
            } else if (currentUser.role === "desk") {
              filteredBatch = data.filter(
                (lead) =>
                  lead.desk === currentUser.full_name ||
                  lead.assigned_to === currentUser.id ||
                  (lead.assigned_to &&
                    subordinateIds.includes(lead.assigned_to))
              );
            } else if (currentUser.role === "manager") {
              filteredBatch = data.filter(
                (lead) =>
                  lead.assigned_to === currentUser.id ||
                  (lead.assigned_to &&
                    subordinateIds.includes(lead.assigned_to))
              );
            } else if (currentUser.role === "agent") {
              filteredBatch = data.filter(
                (lead) => lead.assigned_to === currentUser.id
              );
            }

            // Append new filtered leads
            if (filteredBatch.length > 0) {
              setLeads((prev) => {
                const seen = new Set(prev.map((l) => l.id));
                const newOnes = filteredBatch.filter((l) => !seen.has(l.id));
                if (newOnes.length === 0) return prev;
                return [...prev, ...newOnes];
              });
              console.log(
                `📦 Added ${filteredBatch.length} more leads (total now visible)`
              );
            } else {
              console.log(
                `⏭️ Batch had 0 leads after filtering, continuing...`
              );
            }

            if (data.length < batchSize) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        if (iterations >= maxIterations) {
          console.warn("⚠️ Reached maximum iterations, stopping lead fetch");
        }
        console.log(
          `✅ Finished loading all leads. Total iterations: ${iterations}, Final offset: ${offset}`
        );
        setLoading(false);
      };

      // Fire background load (don’t block UI)
      loadRemaining();
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
      setLoading(false);
    }
  }, [currentUser]);

  const clearSelections = () => {
    setDataTableSelection({});
    setSelectedLeads([]);
  };

  const onActionComplete = () => {
    fetchLeads();
    clearSelections();
  };

  const setupRealtimeSubscription = useCallback(() => {
    if (!currentUser) return null;

    console.log(
      "🔄 Setting up realtime subscription for user:",
      currentUser.full_name,
      currentUser.role
    );

    const channel = supabase
      .channel("leads-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: "is_converted=eq.false",
        },
        (payload) => {
          console.log("🆕 New lead received:", payload);
          console.log("📊 Triggering data refresh for new lead");
          setRefreshTrigger((prev) => {
            console.log("🔄 Refresh trigger incremented:", prev + 1);
            return prev + 1;
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: "is_converted=eq.false",
        },
        (payload) => {
          console.log("✏️ Lead updated:", payload);
          console.log("📊 Triggering data refresh for lead update");
          setRefreshTrigger((prev) => {
            console.log("🔄 Refresh trigger incremented:", prev + 1);
            return prev + 1;
          });
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to leads changes");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to leads changes");
        } else if (status === "CLOSED") {
          console.warn("⚠️ Realtime subscription closed");
        }
      });

    return channel;
  }, [currentUser, setRefreshTrigger]);

  // Separate useEffect for fetching leads data
  useEffect(() => {
    if (currentUser) {
      fetchLeads();
    }
  }, [currentUser, refreshTrigger, fetchLeads]);

  // Separate useEffect for real-time subscription
  useEffect(() => {
    if (currentUser) {
      const subscription = setupRealtimeSubscription();

      return () => {
        subscription?.unsubscribe();
      };
    }
  }, [currentUser, setupRealtimeSubscription]);

  useEffect(() => {
    initializeComponent();
    fetchStatuses();
  }, []);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        type: "status_change",
        description: `Status changed to ${newStatus}`,
      });

      toast.success("Status updated successfully");
      // Update the lead in the current state instead of triggering full refresh
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleAssignAgent = useCallback(
    async (leadId: string, agentId: string | null) => {
      try {
        const { error } = await supabase
          .from("leads")
          .update({ assigned_to: agentId })
          .eq("id", leadId);

        if (error) throw error;

        await supabase.from("lead_activities").insert({
          lead_id: leadId,
          type: "assignment",
          description: agentId ? "Lead assigned" : "Lead unassigned",
        });

        toast.success(
          agentId
            ? "Lead assigned successfully"
            : "Lead unassigned successfully"
        );
        // Update the lead in the current state instead of triggering full refresh
        setLeads((prevLeads) =>
          prevLeads.map((lead) =>
            lead.id === leadId ? { ...lead, assigned_to: agentId } : lead
          )
        );
      } catch (error) {
        console.error("Error assigning agent:", error);
        toast.error("Failed to assign agent");
      }
    },
    []
  );

  const handleTeamChange = async (leadId: string, newTeam: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ team: newTeam })
        .eq("id", leadId);

      if (error) throw error;

      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        type: "team_change",
        description: `Team changed to ${newTeam}`,
      });

      toast.success("Team updated successfully");
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Error updating team:", error);
      toast.error("Failed to update team");
    }
  };

  const handleAddDeposit = (leadId: string) => {
    setSelectedLeadForDeposit(leadId);
    setIsAddDepositModalOpen(true);
  };

  const copyToClipboard = async (
    text: string,
    type: string,
    leadId: string
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      const copyId = `${type}-${leadId}`;
      setCopiedItem(copyId);
      toast.success(`${type} copied to clipboard`);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const columns = useMemo(
    () => [
      {
        header: "ID",
        accessorKey: "id",
        cell: (
          { row } // Changed from span to a tag
        ) => (
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
        header: "Source ID",
        accessorKey: "source_id",
        enableColumnFilter: true,
      },
      {
        header: "Full Name",
        accessorFn: (row) => `${row.first_name} ${row.last_name}`,
        enableColumnFilter: true,
      },
      {
        header: "Email",
        accessorKey: "email",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <span>{row.original.email}</span>
            <button
              onClick={() =>
                copyToClipboard(row.original.email, "Email", row.original.id)
              }
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
        header: "Phone",
        accessorKey: "phone",
        cell: ({ row }) => (
          <div className="flex items-center space-x-2">
            <span>{row.original.phone}</span>
            {row.original.phone && (
              <button
                onClick={() =>
                  copyToClipboard(row.original.phone, "Phone", row.original.id)
                }
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
        header: "Country",
        accessorKey: "country",
        enableColumnFilter: true,
      },
      {
        header: "Local Time",
        accessorFn: (row) => getLocalTime(row.country),
        cell: ({ getValue }) => getValue(),
        enableColumnFilter: false,
      },
      {
        header: "Source",
        accessorKey: "source",
        enableColumnFilter: true,
      },
      {
        header: "Funnel",
        accessorKey: "funnel",
        enableColumnFilter: true,
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            onChange={(newStatus) =>
              handleStatusChange(row.original.id, newStatus)
            }
          />
        ),
        enableColumnFilter: true,
      },
      {
        header: "Assigned To",
        id: "assigned_to_name",
        accessorFn: (row) => row.assigned_to_user?.full_name || "Unassigned",
        cell: ({ row }) => (
          <AssignAgentSelect
            value={row.original.assigned_to}
            onChange={(agentId) => handleAssignAgent(row.original.id, agentId)}
            allUsers={users}
            assignedUserName={row.original.assigned_to_user?.full_name}
          />
        ),
        enableColumnFilter: true,
        filterFn: (row, columnId, filterValue) => {
          if (
            !filterValue ||
            !Array.isArray(filterValue) ||
            filterValue.length === 0
          ) {
            return true;
          }

          const assignedToName =
            row.original.assigned_to_user?.full_name || "Unassigned";
          return filterValue.includes(assignedToName);
        },
      },
      {
        header: "Actions",
        cell: ({ row }) =>
          canAddDeposit ? (
            <button
              onClick={() => handleAddDeposit(row.original.id)}
              className="px-2 py-1 bg-green-600 rounded flex items-center space-x-1 hover:bg-green-500 text-sm"
            >
              <EuroSign size={14} />
              <span>Add Deposit</span>
            </button>
          ) : (
            <span className="text-gray-500 text-sm">No access</span>
          ),
        enableColumnFilter: false,
      },
      {
        header: "Created",
        accessorKey: "created_at",
        cell: ({ row }) => {
          const date = DateTime.fromISO(row.original.created_at);
          return (
            <div className="text-sm">
              <div>{date.toFormat("dd/MM/yyyy")}</div>
              <div className="text-gray-400">{date.toFormat("HH:mm")}</div>
            </div>
          );
        },
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || !Array.isArray(filterValue)) return true;

          const rowDate = DateTime.fromISO(row.getValue(columnId));

          // Check if the row date falls within any of the provided date ranges
          return filterValue.some(([startDate, endDate]: [string, string]) => {
            const start = DateTime.fromISO(startDate).startOf("day");
            const end = DateTime.fromISO(endDate).endOf("day");
            return rowDate >= start && rowDate <= end;
          });
        },
        enableColumnFilter: true,
      },
    ],
    [users, handleAssignAgent]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Sales Leads</h1>
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
            {canPerformAdminActions && (
              <>
                <ExportMenu
                  leadsToExport={
                    selectedLeads.length > 0 ? selectedLeads : leads
                  }
                />
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-4 py-2 bg-gray-700 rounded-lg flex items-center space-x-2 hover:bg-gray-600"
                >
                  <Upload size={16} />
                  <span>Import</span>
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500"
                >
                  <Plus size={16} />
                  <span>Add Lead</span>
                </button>
              </>
            )}
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
            getRowId={(row: Lead) => row.id.toString()}
          />
        </div>
      </div>

      {canPerformAdminActions && (
        <>
          <CreateLeadModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onLeadCreated={onActionComplete}
          />

          <ImportLeadsModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportComplete={onActionComplete}
          />
        </>
      )}

      {selectedLeadForDeposit && (
        <AddDepositModal
          isOpen={isAddDepositModalOpen}
          onClose={() => {
            setIsAddDepositModalOpen(false);
            setSelectedLeadForDeposit(null);
          }}
          leadId={selectedLeadForDeposit}
          onSuccess={onActionComplete}
        />
      )}
    </div>
  );
};

export default SalesLeads;
