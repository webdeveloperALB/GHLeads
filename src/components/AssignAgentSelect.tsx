import React, { useMemo } from 'react';
import { supabase, type UserProfile, getCurrentUser, getUserPermissions, getSubordinateIds } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface AssignAgentSelectProps {
  value: string | null;
  onChange: (agentId: string | null) => void;
  className?: string;
  allUsers?: UserProfile[];
  assignedUserName?: string;
}

interface DeskGroup {
  deskName: string;
  deskUser: UserProfile | null;
  members: UserProfile[];
}

const AssignAgentSelect: React.FC<AssignAgentSelectProps> = ({ value, onChange, className = '', allUsers = [], assignedUserName }) => {

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });

  const { data: permissions } = useQuery({
    queryKey: ['userPermissions', currentUser?.id],
    queryFn: () => getUserPermissions(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });


  const { data: deskGroups = [], isLoading, isFetching } = useQuery({
    queryKey: ['deskGroups', currentUser?.id, currentUser?.role, allUsers.length],
    queryFn: async () => {
      if (!currentUser) return [];

      try {
        let subordinateIds: string[] = [];
        if (['desk', 'manager'].includes(currentUser.role)) {
          subordinateIds = await getSubordinateIds();
        }

        console.log(`👤 [AssignAgentSelect] Current user: ${currentUser.full_name} (${currentUser.role})`);
        console.log(`👥 [AssignAgentSelect] Subordinate IDs:`, subordinateIds);
        console.log(`📋 [AssignAgentSelect] Total users before filter: ${allUsers.length}`);

        const assignableUsers = filterUsersByRole(currentUser, allUsers, subordinateIds);

        console.log(`✅ [AssignAgentSelect] Assignable users after filter: ${assignableUsers.length}`);
        console.log(`📝 [AssignAgentSelect] Assignable user names:`, assignableUsers.map(u => u.full_name));

        return groupUsersByDesk(assignableUsers, allUsers);
      } catch (error) {
        console.error('Error organizing desk groups:', error);
        return [];
      }
    },
    enabled: !!currentUser && allUsers.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const getTopLevelDesk = (user: UserProfile, allUsers: UserProfile[]): UserProfile | null => {
    if (user.role === 'desk') return user;
    if (user.role === 'admin') return null;

    if (user.manager_id) {
      const manager = allUsers.find(u => u.id === user.manager_id);
      if (manager) {
        return getTopLevelDesk(manager, allUsers);
      }
    }

    return null;
  };

  const groupUsersByDesk = (assignableUsers: UserProfile[], allUsers: UserProfile[]): DeskGroup[] => {
    const deskMap = new Map<string, DeskGroup>();
    const unassignedUsers: UserProfile[] = [];

    assignableUsers.forEach(user => {
      const topLevelDesk = getTopLevelDesk(user, allUsers);

      if (topLevelDesk) {
        const deskKey = topLevelDesk.id;
        if (!deskMap.has(deskKey)) {
          deskMap.set(deskKey, {
            deskName: topLevelDesk.full_name,
            deskUser: topLevelDesk,
            members: []
          });
        }
        deskMap.get(deskKey)!.members.push(user);
      } else {
        unassignedUsers.push(user);
      }
    });

    const deskGroups = Array.from(deskMap.values());

    deskGroups.sort((a, b) => a.deskName.localeCompare(b.deskName));

    const roleOrder = { desk: 0, manager: 1, agent: 2 };
    deskGroups.forEach(group => {
      group.members.sort((a, b) => {
        const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 999;
        const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.full_name.localeCompare(b.full_name);
      });
    });

    if (unassignedUsers.length > 0) {
      unassignedUsers.sort((a, b) => {
        const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 999;
        const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.full_name.localeCompare(b.full_name);
      });

      deskGroups.push({
        deskName: 'Unassigned',
        deskUser: null,
        members: unassignedUsers
      });
    }

    return deskGroups;
  };

  const filterUsersByRole = (currentUser: UserProfile, allUsers: UserProfile[], subordinateIds: string[] = []): UserProfile[] => {
    let assignableUsers: UserProfile[] = [];

    if (currentUser.role === 'admin') {
      assignableUsers = allUsers.filter(user =>
        ['agent', 'manager', 'desk', 'admin'].includes(user.role)
      );
    } else if (['desk', 'manager'].includes(currentUser.role)) {
      assignableUsers = allUsers.filter(user =>
        user.id === currentUser.id || subordinateIds.includes(user.id)
      );
    } else {
      assignableUsers = [currentUser];
    }

    const uniqueUsers = assignableUsers.filter((user, index, self) =>
      index === self.findIndex(u => u.id === user.id)
    );

    return uniqueUsers.sort((a, b) => a.full_name.localeCompare(b.full_name));
  };

  const canAssign = permissions?.clients?.assign || false;

  const renderedOptions = useMemo(() => {
    const assignedUserInList = value ? allUsers.find(u => u.id === value) : null;
    const hasAssignedUser = value && (assignedUserInList || assignedUserName);
    const hasGroups = deskGroups.length > 0 && deskGroups.some(g => g.members.length > 0);

    return {
      assignedUserInList,
      hasAssignedUser,
      hasGroups,
      options: hasGroups ? (
        <>
          {deskGroups.map((group) => (
            <optgroup key={group.deskName} label={`-- ${group.deskName}`}>
              {group.members.map((user) => (
                <option key={user.id} value={user.id}>
                  -- -- {user.full_name}
                </option>
              ))}
            </optgroup>
          ))}
        </>
      ) : allUsers.length > 0 ? (
        <>
          {allUsers.filter(u => ['agent', 'manager', 'desk'].includes(u.role)).map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </>
      ) : (
        <option value="" disabled>Loading users...</option>
      )
    };
  }, [deskGroups, allUsers, value, assignedUserName]);

  if (!currentUser || (currentUser.role === 'agent' && !canAssign)) {
    if (isLoading) {
      return (
        <div className={`bg-gray-700 rounded px-2 py-1 text-sm ${className}`}>
          Loading...
        </div>
      );
    }

    const assignedUser = value ?
      deskGroups.flatMap(group => group.members).find(u => u.id === value) :
      null;

    return (
      <div className={`bg-gray-700 rounded px-2 py-1 text-sm ${className}`}>
        {assignedUser?.full_name || (value ? 'Unknown' : 'Unassigned')}
      </div>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`bg-gray-700 rounded px-2 py-1 text-sm ${className}`}
    >
      <option value="">Unassigned</option>
      {renderedOptions.hasAssignedUser && !renderedOptions.assignedUserInList && (
        <option value={value!} disabled>
          {assignedUserName || 'Loading...'}
        </option>
      )}
      {renderedOptions.options}
    </select>
  );
};

export default AssignAgentSelect;
