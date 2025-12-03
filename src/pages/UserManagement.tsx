import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase, createUser, deleteUser, getCurrentUser, getSubordinateIds, type Role } from '../lib/supabase';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
  manager?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  subordinates?: UserProfile[];
}

interface UserNodeProps {
  user: UserProfile;
  level: number;
  managers: UserProfile[];
  onDeleteUser: (userId: string) => void;
  onManagerChange: (userId: string, managerId: string | null) => void;
  onNavigate: (userId: string) => void;
  currentUser: UserProfile | null;
}

const UserNode: React.FC<UserNodeProps> = ({ 
  user, 
  level, 
  managers, 
  onDeleteUser, 
  onManagerChange, 
  onNavigate,
  currentUser
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const getIndentStyle = (level: number) => ({
    marginLeft: `${level * 24}px`
  });

  const getRoleColor = (role: Role) => {
    switch (role) {
      case 'admin': return 'text-red-400 bg-red-500/20';
      case 'desk': return 'text-purple-400 bg-purple-500/20';
      case 'manager': return 'text-blue-400 bg-blue-500/20';
      case 'agent': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getAvailableManagers = (userRole: Role) => {
    switch (userRole) {
      case 'agent':
        return managers.filter(m => ['manager', 'desk'].includes(m.role));
      case 'manager':
        return managers.filter(m => m.role === 'desk');
      case 'desk':
        return managers.filter(m => m.role === 'admin');
      default:
        return [];
    }
  };

  const getManagerLabel = (userRole: Role) => {
    switch (userRole) {
      case 'agent': return 'Manager';
      case 'manager': return 'Desk Manager';
      case 'desk': return 'Admin';
      default: return 'Manager';
    }
  };

  const availableManagers = getAvailableManagers(user.role);
  const managerLabel = getManagerLabel(user.role);

  return (
    <div>
      <div 
        className="bg-gray-800 rounded-lg p-4 mb-2"
        style={getIndentStyle(level)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {user.subordinates && user.subordinates.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-gray-400 hover:text-white"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-medium">{user.full_name}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                  {user.role}
                </span>
              </div>
              <p className="text-sm text-gray-400">{user.email}</p>
              {user.manager && (
                <p className="text-xs text-gray-500">
                  Reports to: {user.manager.full_name} ({user.manager.role})
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate(user.id)}
              className="text-blue-500 hover:text-blue-400 p-2 rounded-lg hover:bg-gray-700"
              title="Edit user"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => onDeleteUser(user.id)}
              className="text-red-500 hover:text-red-400 p-2 rounded-lg hover:bg-gray-700"
              title="Delete user"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {currentUser?.role === 'admin' && user.role !== 'admin' && availableManagers.length > 0 && (
          <div className="mt-2">
            <label className="block text-sm text-gray-400 mb-1">
              <Users size={14} className="inline mr-1" />
              {managerLabel}
            </label>
            <select
              className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm"
              value={user.manager_id || ''}
              onChange={(e) => onManagerChange(user.id, e.target.value || null)}
            >
              <option value="">No {managerLabel}</option>
              {availableManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name} ({manager.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {user.subordinates && user.subordinates.length > 0 && (
          <div className="mt-2 text-sm text-gray-400">
            {user.subordinates.length} direct report{user.subordinates.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {isExpanded && user.subordinates && user.subordinates.map((subordinate) => (
        <UserNode
          key={subordinate.id}
          user={subordinate}
          level={level + 1}
          managers={managers}
          onDeleteUser={onDeleteUser}
          onManagerChange={onManagerChange}
          onNavigate={onNavigate}
          currentUser={currentUser}
        />
      ))}
    </div>
  );
};

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [hierarchyUsers, setHierarchyUsers] = useState<UserProfile[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'agent' as Role,
    manager_id: '' as string | null
  });

  const buildHierarchy = (users: UserProfile[]): UserProfile[] => {
    const userMap = new Map<string, UserProfile>();
    const rootUsers: UserProfile[] = [];

    // Create a map of all users and initialize subordinates array
    users.forEach(user => {
      userMap.set(user.id, { ...user, subordinates: [] });
    });

    // Build the hierarchy
    users.forEach(user => {
      const userWithSubordinates = userMap.get(user.id)!;
      
      if (user.manager_id && userMap.has(user.manager_id)) {
        const manager = userMap.get(user.manager_id)!;
        manager.subordinates!.push(userWithSubordinates);
      } else {
        rootUsers.push(userWithSubordinates);
      }
    });

    // Sort root users by role hierarchy (admin -> desk -> manager -> agent)
    const roleOrder = { admin: 0, desk: 1, manager: 2, agent: 3 };
    rootUsers.sort((a, b) => {
      const aOrder = roleOrder[a.role] ?? 999;
      const bOrder = roleOrder[b.role] ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.full_name.localeCompare(b.full_name);
    });

    // Sort subordinates recursively
    const sortSubordinates = (user: UserProfile) => {
      if (user.subordinates) {
        user.subordinates.sort((a, b) => {
          const aOrder = roleOrder[a.role] ?? 999;
          const bOrder = roleOrder[b.role] ?? 999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.full_name.localeCompare(b.full_name);
        });
        user.subordinates.forEach(sortSubordinates);
      }
    };

    rootUsers.forEach(sortSubordinates);
    return rootUsers;
  };

  const fetchUsers = async () => {
    try {
      // Get current user to determine what users they can see
      const user = await getCurrentUser();
      setCurrentUser(user);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          email,
          full_name,
          role,
          manager_id,
          manager:user_profiles!manager_id (
            id,
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      let usersData = data || [];
      
      // Filter users based on role if not admin
      if (user?.role !== 'admin') {
        const subordinateIds = await getSubordinateIds();
        console.log('Subordinate IDs for', user?.full_name, ':', subordinateIds);
        
        // Include current user + subordinates
        const allowedIds = [user?.id, ...subordinateIds];
        usersData = usersData.filter(u => allowedIds.includes(u.id));
      }
      
      setUsers(usersData);
      setHierarchyUsers(buildHierarchy(usersData));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
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
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchManagers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await createUser(
        newUser.email,
        newUser.password,
        newUser.full_name,
        newUser.role,
        newUser.manager_id || null
      );

      toast.success('User created successfully');
      setIsCreating(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'agent',
        manager_id: null
      });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await deleteUser(userId);
      toast.success('User deleted successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleManagerChange = async (userId: string, managerId: string | null) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ manager_id: managerId || null })
        .eq('id', userId);

      if (error) throw error;
      toast.success('Manager updated successfully');
      fetchUsers();
    } catch (error) {
      console.error('Error updating manager:', error);
      toast.error('Failed to update manager');
    }
  };

  const getAvailableManagersForNewUser = (role: Role) => {
    switch (role) {
      case 'agent':
        return managers.filter(m => ['manager', 'desk'].includes(m.role));
      case 'manager':
        return managers.filter(m => m.role === 'desk');
      case 'desk':
        return managers.filter(m => m.role === 'admin');
      default:
        return [];
    }
  };

  const getManagerLabelForNewUser = (role: Role) => {
    switch (role) {
      case 'agent': return 'Manager';
      case 'manager': return 'Desk Manager';
      case 'desk': return 'Admin';
      default: return 'Manager';
    }
  };

  const availableManagersForNewUser = getAvailableManagersForNewUser(newUser.role);
  const managerLabelForNewUser = getManagerLabelForNewUser(newUser.role);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage users and their hierarchy. Users are organized by reporting structure.
          </p>
        </div>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-green-600 rounded-lg flex items-center space-x-2 hover:bg-green-500"
          >
            <Plus size={16} />
            <span>Create User</span>
          </button>
        )}
      </div>

      {isCreating && currentUser?.role === 'admin' && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400">Email</label>
                <input
                  type="email"
                  required
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400">Role</label>
                <select
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  value={newUser.role}
                  onChange={(e) => {
                    const role = e.target.value as Role;
                    setNewUser({ ...newUser, role, manager_id: null });
                  }}
                >
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="desk">Desk</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {newUser.role !== 'admin' && availableManagersForNewUser.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400">{managerLabelForNewUser}</label>
                <select
                  className="w-full bg-gray-700 rounded-lg px-3 py-2 mt-1"
                  value={newUser.manager_id || ''}
                  onChange={(e) => setNewUser({ ...newUser, manager_id: e.target.value || null })}
                >
                  <option value="">No {managerLabelForNewUser}</option>
                  {availableManagersForNewUser.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name} ({manager.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {hierarchyUsers.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No users found
          </div>
        ) : (
          hierarchyUsers.map((user) => (
            <UserNode
              key={user.id}
              user={user}
              level={0}
              managers={managers}
              onDeleteUser={handleDeleteUser}
              onManagerChange={handleManagerChange}
              onNavigate={(userId) => navigate(`/user/${userId}`)}
              currentUser={currentUser}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default UserManagement;