import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

interface LeadStatus {
  id: string;
  name: string;
  is_system: boolean;
  color: string;
  created_at: string;
}

const LeadStatuses = () => {
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [newStatus, setNewStatus] = useState({
    name: '',
    color: '#9CA3AF'
  });
  const [loading, setLoading] = useState(false);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editColor, setEditColor] = useState('#9CA3AF');
  const queryClient = useQueryClient();

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('name');

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
      toast.error('Failed to fetch statuses');
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus.name.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('lead_statuses')
        .insert({
          name: newStatus.name.trim(),
          color: newStatus.color
        });

      if (error) throw error;

      toast.success('Status added successfully');
      setNewStatus({ name: '', color: '#9CA3AF' });
      fetchStatuses();
    } catch (error) {
      console.error('Error adding status:', error);
      toast.error('Failed to add status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStatus = async (id: string) => {
    try {
      // First check if the status is in use
      const { count, error: countError } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error('Cannot delete status that is in use');
        return;
      }

      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', id)
        .eq('is_system', false);

      if (error) throw error;

      toast.success('Status deleted successfully');
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
      toast.error('Failed to delete status');
    }
  };

  const handleEditColor = async (status: LeadStatus) => {
    try {
      const { error } = await supabase
        .from('lead_statuses')
        .update({ color: editColor })
        .eq('id', status.id);

      if (error) throw error;

      // Invalidate the status color cache
      queryClient.invalidateQueries({ queryKey: ['status', status.name] });

      toast.success('Color updated successfully');
      setEditingStatus(null);
      fetchStatuses();
    } catch (error) {
      console.error('Error updating color:', error);
      toast.error('Failed to update color');
    }
  };

  const startEditing = (status: LeadStatus) => {
    setEditingStatus(status.id);
    setEditColor(status.color);
  };

  const handleKeyPress = (e: React.KeyboardEvent, status: LeadStatus) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditColor(status);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Lead Statuses</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Status</h2>
          <form onSubmit={handleAddStatus} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400">Status Name</label>
              <input
                type="text"
                required
                className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                value={newStatus.name}
                onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                placeholder="Enter status name"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400">Color</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="color"
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  className="h-8 w-16 rounded bg-gray-700 border-none"
                />
                <input
                  type="text"
                  value={newStatus.color}
                  onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2"
                  placeholder="#000000"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500 disabled:opacity-50"
            >
              <Plus size={16} />
              <span>{loading ? 'Adding...' : 'Add Status'}</span>
            </button>
          </form>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Statuses</h2>
          <div className="space-y-2">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-2"
              >
                <div className="flex items-center space-x-3">
                  {editingStatus === status.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-6 w-12 rounded border-none"
                      />
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, status)}
                        className="w-24 bg-gray-600 rounded px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => handleEditColor(status)}
                        className="text-green-500 hover:text-green-400"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(status)}
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: status.color }}
                      title="Click to change color"
                    />
                  )}
                  <span>{status.name}</span>
                </div>
                {!status.is_system && (
                  <button
                    onClick={() => handleDeleteStatus(status.id)}
                    className="text-red-500 hover:text-red-400 p-1 rounded-lg hover:bg-gray-600"
                    title="Delete status"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadStatuses;