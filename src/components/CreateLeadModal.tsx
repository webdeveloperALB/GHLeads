import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase, type UserProfile } from "../lib/supabase";
import toast from "react-hot-toast";

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
}

const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onLeadCreated,
}) => {
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    country: "",
    brand: "",
    source: "",
    funnel: "",
    desk: "",
    assigned_to: "",
  });

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("full_name");

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from("leads").insert([
        {
          ...formData,
          assigned_to: formData.assigned_to || null,
        },
      ]);

      if (error) throw error;

      toast.success("Lead created successfully");
      onLeadCreated();
      onClose();
    } catch (error) {
      toast.error("Failed to create lead");
      console.error("Error creating lead:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Create New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400">First Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Last Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400">Email</label>
            <input
              type="email"
              required
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Phone</label>
            <input
              type="tel"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Country</label>
            <input
              type="text"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.country}
              onChange={(e) =>
                setFormData({ ...formData, country: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Brand</label>
            <input
              type="text"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.brand}
              onChange={(e) =>
                setFormData({ ...formData, brand: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Source</label>
            <input
              type="text"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.source}
              onChange={(e) =>
                setFormData({ ...formData, source: e.target.value })
              }
              placeholder="e.g., Sourcelive123"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Funnel</label>
            <input
              type="text"
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.funnel}
              onChange={(e) =>
                setFormData({ ...formData, funnel: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400">Assign To</label>
            <select
              className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
              value={formData.assigned_to}
              onChange={(e) =>
                setFormData({ ...formData, assigned_to: e.target.value })
              }
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500"
            >
              Create Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLeadModal;
