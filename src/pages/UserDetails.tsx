import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Key, Mail, Lock } from 'lucide-react';
import { supabase, getUserById, updateUserPassword, getUserPermissions, type UserProfile, type UserPermissions } from '../lib/supabase';
import toast from 'react-hot-toast';

const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<(UserProfile & { email?: string }) | null>(null);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [permissions, setPermissions] = useState<UserPermissions>({
    clients: {
      view: false,
      register: false,
      remove: false,
      download: false,
      promote: false,
      demote: false,
      edit: false,
      phone: false,
      email: false,
      password: false,
      info: false,
      assign: false,
      whatsapp: false,
      loginLog: false
    },
    leads: {
      upload: false
    },
    support: {
      chat: false,
      deleteChat: false
    },
    comments: {
      edit: false,
      delete: false
    }
  });

  const fetchUser = async () => {
    if (!id) return;

    try {
      const userData = await getUserById(id);
      setUser(userData);

      // Fetch user permissions
      const userPermissions = await getUserPermissions(id);
      if (userPermissions) {
        setPermissions(userPermissions);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Failed to fetch user details');
      navigate('/users');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .in('role', ['admin', 'desk', 'manager'])
        .order('full_name');

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error('Error fetching managers:', error);
      toast.error('Failed to fetch managers');
    }
  };

  useEffect(() => {
    fetchUser();
    fetchManagers();
  }, [id]);

  const handleRoleChange = async (newRole: 'admin' | 'manager' | 'agent') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Role updated successfully');
      fetchUser();
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleManagerChange = async (managerId: string | null) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ manager_id: managerId })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Manager updated successfully');
      fetchUser();
    } catch (error) {
      console.error('Error updating manager:', error);
      toast.error('Failed to update manager');
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !newPassword) return;

    try {
      await updateUserPassword(user.id, newPassword);
      toast.success('Password updated successfully');
      setNewPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    }
  };

  const handleSavePermissions = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          user_id: user.id,
          permissions: permissions
        });

      if (error) throw error;
      
      toast.success('Permissions updated successfully');
    } catch (error) {
      console.error('Error updating permissions:', error);
      toast.error('Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!user) {
    return <div className="p-6">User not found</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/users')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold">{user.full_name}</h1>
        </div>
        <button
          onClick={handleSavePermissions}
          disabled={saving}
          className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500 disabled:opacity-50"
        >
          <Save size={16} />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Mail className="mr-2" size={20} />
              Account Details
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={user.email || ''}
                  readOnly
                  className="w-full bg-gray-700 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">New Password</label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="flex-1 bg-gray-700 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={handlePasswordChange}
                    disabled={!newPassword}
                    className="px-4 py-2 bg-blue-600 rounded-lg flex items-center space-x-2 hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Lock size={16} />
                    <span>Update</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Key className="mr-2" size={20} />
              Role & Manager
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select
                  value={user.role}
                  onChange={(e) => handleRoleChange(e.target.value as 'admin' | 'manager' | 'agent')}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2"
                >
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="desk">Desk</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {user.role === 'agent' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Manager</label>
                  <select
                    value={user.manager_id || ''}
                    onChange={(e) => handleManagerChange(e.target.value || null)}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2"
                  >
                    <option value="">No Manager</option>
                    {managers
                      .filter(manager => ['manager', 'desk'].includes(manager.role))
                      .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.full_name} ({manager.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {user.role === 'manager' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Desk Manager</label>
                  <select
                    value={user.manager_id || ''}
                    onChange={(e) => handleManagerChange(e.target.value || null)}
                    className="w-full bg-gray-700 rounded-lg px-3 py-2"
                  >
                    <option value="">No Desk Manager</option>
                    {managers
                      .filter(manager => manager.role === 'desk')
                      .map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name} ({manager.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Permissions</h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Client Management</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.view}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, view: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>View Clients</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.register}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, register: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>Register Clients</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.phone}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, phone: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>View Phone</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.email}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, email: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>View Email</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.password}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, password: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>Change Password</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.clients.whatsapp}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      clients: { ...permissions.clients, whatsapp: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>WhatsApp Access</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Lead Management</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.leads.upload}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      leads: { ...permissions.leads, upload: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>Upload Leads</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Support</h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.support.chat}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      support: { ...permissions.support, chat: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>Chat Access</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={permissions.support.deleteChat}
                    onChange={(e) => setPermissions({
                      ...permissions,
                      support: { ...permissions.support, deleteChat: e.target.checked }
                    })}
                    className="rounded bg-gray-700 border-gray-600"
                  />
                  <span>Delete Chat</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetails;