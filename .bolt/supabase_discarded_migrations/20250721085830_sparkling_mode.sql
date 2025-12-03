/*
  # Update desk lead visibility permissions

  1. Security Changes
    - Update `can_user_see_lead` function to give desk users manager-level permissions
    - Desk users can now see leads assigned to their managers and agents under those managers
    - Maintains proper hierarchy separation between different desk branches

  2. Permission Structure
    - Admin: sees all leads
    - Desk: sees leads in their organizational branch (themselves + their managers + agents under those managers)
    - Manager: sees leads assigned to themselves and their direct reports
    - Agent: sees only their own assigned leads
*/

-- Drop and recreate the can_user_see_lead function with updated desk permissions
DROP FUNCTION IF EXISTS can_user_see_lead(leads);

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
    
    -- Desk users can see leads in their organizational branch
    IF current_user_role = 'desk' THEN
        RETURN (
            -- Leads assigned to themselves
            lead_record.assigned_to = current_user_id
            OR
            -- Leads assigned to managers who report to this desk user
            lead_record.assigned_to IN (
                SELECT id FROM user_profiles 
                WHERE manager_id = current_user_id AND role = 'manager'
            )
            OR
            -- Leads assigned to agents under managers who report to this desk user
            lead_record.assigned_to IN (
                SELECT agent.id 
                FROM user_profiles agent
                JOIN user_profiles manager ON agent.manager_id = manager.id
                WHERE manager.manager_id = current_user_id AND manager.role = 'manager'
            )
        );
    END IF;
    
    -- Manager can see leads assigned to themselves and their direct reports
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