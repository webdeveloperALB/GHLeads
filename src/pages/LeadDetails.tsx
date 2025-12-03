import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  Phone,
  Mail,
  LogIn,
  Send,
  Plus,
  Euro as EuroSign,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  supabase,
  type Lead,
  type LeadActivity,
  type LeadComment,
  getUserPermissions,
  getCurrentUser,
  getSubordinateIds,
} from "../lib/supabase";
import toast from "react-hot-toast";
import AddDepositModal from "../components/AddDepositModal";
import DepositHistory from "../components/DepositHistory";
import StatusBadge from "../components/StatusBadge";
import LeadQuestionsSection from "../components/LeadQuestionsSection";

interface LeadStatus {
  name: string;
  is_system: boolean;
}

const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [isAddDepositModalOpen, setIsAddDepositModalOpen] = useState(false);
  const [canDeleteComments, setCanDeleteComments] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prevLeadId, setPrevLeadId] = useState<number | null>(null);
  const [nextLeadId, setNextLeadId] = useState<number | null>(null);
  const [allAccessibleLeads, setAllAccessibleLeads] = useState<Lead[]>([]);

  useEffect(() => {
    checkPermissions();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (id && currentUser) {
      setLoading(true);
      Promise.all([
        fetchLeadData(),
        fetchActivities(),
        fetchComments(),
        fetchStatuses(),
      ]).finally(() => setLoading(false));
    }
  }, [id, currentUser]);

  // Fetch all accessible leads when lead data is available
  useEffect(() => {
    if (lead && currentUser) {
      fetchAllAccessibleLeads(lead.is_converted);
    }
  }, [lead, currentUser]);

  // Update adjacent lead IDs when allAccessibleLeads changes
  useEffect(() => {
    if (lead && allAccessibleLeads.length > 0) {
      const currentIndex = allAccessibleLeads.findIndex(
        (l) => l.id === lead.id
      );

      setPrevLeadId(
        currentIndex > 0 ? allAccessibleLeads[currentIndex - 1].id : null
      );
      setNextLeadId(
        currentIndex < allAccessibleLeads.length - 1
          ? allAccessibleLeads[currentIndex + 1].id
          : null
      );
    }
  }, [lead, allAccessibleLeads]);

  const checkPermissions = async () => {
    const permissions = await getUserPermissions();
    setCanDeleteComments(permissions?.comments?.delete || false);
  };

  const fetchCurrentUser = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const fetchAllAccessibleLeads = async (isConverted: boolean) => {
    if (!currentUser) return;

    try {
      // Fetch all leads of the same type (sales or retention) using pagination
      let allLeads: any[] = [];
      let hasMore = true;
      let offset = 0;
      const batchSize = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from("leads")
          .select("*")
          .eq("is_converted", isConverted)
          .order("created_at", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLeads = [...allLeads, ...data];

          if (data.length < batchSize) {
            hasMore = false;
          } else {
            offset += batchSize;
          }
        } else {
          hasMore = false;
        }
      }

      let subordinateIds: string[] = [];
      if (["desk", "manager"].includes(currentUser.role)) {
        subordinateIds = await getSubordinateIds();
      }

      let filteredLeads = allLeads;

      // Apply role-based filtering
      if (currentUser.role === "admin") {
        // Admins see all leads, no further filtering needed
      } else if (currentUser.role === "desk") {
        filteredLeads = filteredLeads.filter(
          (lead) =>
            lead.desk === currentUser.full_name ||
            lead.assigned_to === currentUser.id ||
            (lead.assigned_to && subordinateIds.includes(lead.assigned_to)) ||
            lead.assigned_to === null // Desk users can see unassigned leads
        );
      } else if (currentUser.role === "manager") {
        filteredLeads = filteredLeads.filter(
          (lead) =>
            lead.assigned_to === currentUser.id ||
            (lead.assigned_to && subordinateIds.includes(lead.assigned_to))
        );
      } else if (currentUser.role === "agent") {
        filteredLeads = filteredLeads.filter(
          (lead) => lead.assigned_to === currentUser.id
        );
      }

      setAllAccessibleLeads(filteredLeads);
    } catch (error) {
      console.error("Error fetching accessible leads:", error);
    }
  };

  const handleNavigation = (leadId: number | null) => {
    if (leadId) {
      navigate(`/lead/${leadId}`);
    }
  };

  const verifyLeadAccess = async (lead: Lead): Promise<boolean> => {
    if (!currentUser) return false;

    // Admin can access all leads
    if (currentUser.role === "admin") {
      return true;
    }

    // Agent can only access leads assigned to them
    if (currentUser.role === "agent") {
      return lead.assigned_to === currentUser.id;
    }

    // Manager can access leads assigned to them or their agents
    if (currentUser.role === "manager") {
      if (lead.assigned_to === currentUser.id) {
        return true;
      }

      // Check if lead is assigned to one of their agents
      const subordinateIds = await getSubordinateIds();
      return lead.assigned_to
        ? subordinateIds.includes(lead.assigned_to)
        : false;
    }

    // Desk can access:
    // 1. Leads assigned to them
    // 2. Leads in their desk
    // 3. Unassigned leads
    // 4. Leads assigned to their subordinates (managers and agents)
    if (currentUser.role === "desk") {
      if (lead.assigned_to === currentUser.id) {
        return true;
      }

      if (lead.desk === currentUser.full_name) {
        return true;
      }

      if (lead.assigned_to === null) {
        return true;
      }

      // Check if lead is assigned to one of their subordinates
      const subordinateIds = await getSubordinateIds();
      return lead.assigned_to
        ? subordinateIds.includes(lead.assigned_to)
        : false;
    }

    // Default: no access
    return false;
  };

  const fetchLeadData = async () => {
    if (!id || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Verify hierarchy access
      const hasAccess = await verifyLeadAccess(data);

      if (!hasAccess) {
        toast.error("You do not have permission to view this lead");
        navigate(location.pathname.includes("retention") ? "/retention" : "/");
        return;
      }

      setLead(data);
    } catch (error) {
      console.error("Error fetching lead:", error);
      toast.error("Failed to fetch lead details");
      // Navigate back to the appropriate section
      navigate(location.pathname.includes("retention") ? "/retention" : "/");
    }
  };

  const fetchActivities = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activities:", error);
    }
  };

  const fetchComments = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("lead_comments")
        .select(
          `
          *,
          created_by_user:user_profiles!lead_comments_created_by_fkey(
            id,
            full_name
          )
        `
        )
        .eq("lead_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
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

  const handleStatusChange = async (newStatus: string) => {
    if (!id || !lead) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("lead_activities").insert({
        lead_id: id,
        type: "status_change",
        description: `Status changed to ${newStatus}`,
      });

      toast.success("Status updated successfully");
      fetchLeadData();
      fetchActivities();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;

    try {
      const { error } = await supabase.from("lead_comments").insert({
        lead_id: id,
        content: newComment.trim(),
      });

      if (error) throw error;

      setNewComment("");
      fetchComments();
      toast.success("Comment added successfully");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!canDeleteComments) {
      toast.error("You do not have permission to delete comments");
      return;
    }

    try {
      const { error } = await supabase
        .from("lead_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Comment deleted successfully");
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  const handlePromoteToClient = async () => {
    if (!id || !lead) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          is_converted: true,
          converted_at: new Date().toISOString(),
          status: "Converted",
        })
        .eq("id", id);

      if (error) throw error;

      await supabase.from("lead_activities").insert({
        lead_id: id,
        type: "conversion",
        description: "Lead promoted to client",
      });

      toast.success("Lead promoted to client successfully");
      navigate("/retention");
    } catch (error) {
      console.error("Error promoting lead:", error);
      toast.error("Failed to promote lead");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => handleNavigation(prevLeadId)}
            disabled={!prevLeadId}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50"
            title="Previous Lead"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold">
            {lead.first_name} {lead.last_name} #{lead.id}
          </h1>
          <button
            onClick={() => handleNavigation(nextLeadId)}
            disabled={!nextLeadId}
            className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 disabled:opacity-50"
            title="Next Lead"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500">
                <MessageSquare size={16} />
                <span>WhatsApp</span>
              </button>
              <button className="px-4 py-2 bg-blue-600 rounded-lg flex items-center space-x-2 hover:bg-blue-500">
                <Phone size={16} />
                <span>Call</span>
              </button>
              <button className="px-4 py-2 bg-purple-600 rounded-lg flex items-center space-x-2 hover:bg-purple-500">
                <Mail size={16} />
                <span>Email</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400">
                  First Name
                </label>
                <input
                  type="text"
                  value={lead.first_name}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Last Name</label>
                <input
                  type="text"
                  value={lead.last_name}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Email</label>
                <input
                  type="email"
                  value={lead.email}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Phone</label>
                <input
                  type="tel"
                  value={lead.phone}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Country</label>
                <input
                  type="text"
                  value={lead.country}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Sales Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400">Brand</label>
              <input
                type="text"
                value={lead.brand}
                className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Status</label>
              <StatusBadge status={lead.status} onChange={handleStatusChange} />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Questions & Answers</h2>
          <LeadQuestionsSection leadId={id} />
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Comments</h2>
          <div className="space-y-4">
            <textarea
              className="w-full h-32 bg-gray-700 rounded-lg px-3 py-2"
              placeholder="Add new comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              onClick={handleAddComment}
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500"
            >
              Add Comment
            </button>
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-400">
                        {comment.created_by_user?.full_name} •{" "}
                        {new Date(comment.created_at).toLocaleString()}
                      </p>
                      <p className="mt-1">{comment.content}</p>
                    </div>
                    {canDeleteComments && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-red-500 hover:text-red-400 p-1"
                        title="Delete comment"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Activity History</h2>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center space-x-3 text-sm"
              >
                <LogIn className="text-green-500" size={16} />
                <span className="text-gray-400">
                  {new Date(activity.created_at).toLocaleString()}
                </span>
                <span>{activity.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AddDepositModal
        isOpen={isAddDepositModalOpen}
        onClose={() => setIsAddDepositModalOpen(false)}
        leadId={id}
        onSuccess={fetchLeadData}
      />
    </div>
  );
};

export default LeadDetails;
