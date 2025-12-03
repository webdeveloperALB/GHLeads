/*
  # Update desk lead visibility permissions

  1. Database Changes
    - Update `can_user_see_lead` function to give desk users manager-level permissions
    - Desk users can now see leads assigned to themselves, their managers, and agents under those managers
    - Maintains security boundaries between different desk branches

  2. Permission Structure
    - Desk users get expanded visibility within their organizational hierarchy
    - Cannot see leads from other desk branches
    - Cannot see unassigned leads (admin only)
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS can_user_see_lead(leads);

-- Recreate the function with updated desk permissions
CREATE OR REPLACE FUNCTION can_user_see_lead(lead_record leads)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid;
    current_user_role role_type;
    current_user_manager_id uuid;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    SELECT role, manager_id INTO current_user_role, current_user_manager_id
    FROM user_profiles 
    WHERE id = current_user_id;
    
    -- Admin can see all leads
    IF current_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Desk users can see leads assigned to:
    -- 1. Themselves
    -- 2. Managers who report to them
    -- 3. Agents under those managers
    IF current_user_role = 'desk' THEN
        RETURN (
            -- Lead assigned to desk user themselves
            lead_record.assigned_to = current_user_id
            OR
            -- Lead assigned to managers who report to this desk
            lead_record.assigned_to IN (
                SELECT id FROM user_profiles 
                WHERE manager_id = current_user_id AND role = 'manager'
            )
            OR
            -- Lead assigned to agents under managers who report to this desk
            lead_record.assigned_to IN (
                SELECT agent.id 
                FROM user_profiles agent
                JOIN user_profiles manager ON agent.manager_id = manager.id
                WHERE manager.manager_id = current_user_id AND manager.role = 'manager'
            )
        );
    END IF;
    
    -- Manager can see leads assigned to:
    -- 1. Themselves
    -- 2. Their direct reports (agents)
    IF current_user_role = 'manager' THEN
        RETURN (
            lead_record.assigned_to = current_user_id
            OR 
            lead_record.assigned_to IN (
                SELECT id FROM user_profiles 
                WHERE manager_id = current_user_id
            )
        );
    END IF;
    
    -- Agent can only see leads assigned to themselves
    IF current_user_role = 'agent' THEN
        RETURN lead_record.assigned_to = current_user_id;
    END IF;
    
    -- Default: no access
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;