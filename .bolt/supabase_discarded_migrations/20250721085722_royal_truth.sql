/*
  # Update desk lead visibility permissions

  1. Security Updates
    - Update `can_user_see_lead` function to give desk users manager-level permissions
    - Desk users can now see leads assigned to their managers and all agents under those managers
    - Maintains strict hierarchy separation between different desk branches

  2. Changes
    - Desk users can see leads assigned to themselves
    - Desk users can see leads assigned to their direct reports (managers)
    - Desk users can see leads assigned to agents under their managers
    - Only admins can see unassigned leads
    - Agents still only see their own assigned leads
    - Managers see their own leads and their team's leads

  3. Hierarchy Structure
    - Admin (sees all)
    - Desk (sees their branch: self + managers + agents under managers)
    - Manager (sees self + direct reports)
    - Agent (sees only self)
*/

-- Drop and recreate the can_user_see_lead function with updated desk permissions
DROP FUNCTION IF EXISTS can_user_see_lead(leads);

CREATE OR REPLACE FUNCTION can_user_see_lead(lead leads)
RETURNS boolean AS $$
DECLARE
    current_user_id uuid;
    current_user_role role_type;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- If no user is authenticated, deny access
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get user role
    SELECT role INTO current_user_role
    FROM user_profiles 
    WHERE id = current_user_id;
    
    -- If user role not found, deny access
    IF current_user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- If lead is unassigned, only admins can see it
    IF lead.assigned_to IS NULL THEN
        RETURN current_user_role = 'admin';
    END IF;
    
    -- Admin can see all leads
    IF current_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- Agent can only see leads assigned to them
    IF current_user_role = 'agent' THEN
        RETURN lead.assigned_to = current_user_id;
    END IF;
    
    -- Manager can see leads assigned to them or their direct reports
    IF current_user_role = 'manager' THEN
        RETURN lead.assigned_to = current_user_id 
            OR EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE id = lead.assigned_to 
                AND manager_id = current_user_id
            );
    END IF;
    
    -- Desk can see leads assigned to them, their managers, or agents under their managers
    IF current_user_role = 'desk' THEN
        RETURN lead.assigned_to = current_user_id 
            OR EXISTS (
                -- Direct reports (managers who report to this desk)
                SELECT 1 FROM user_profiles 
                WHERE id = lead.assigned_to 
                AND manager_id = current_user_id
            )
            OR EXISTS (
                -- Agents under managers who report to this desk
                SELECT 1 FROM user_profiles agents
                JOIN user_profiles managers ON agents.manager_id = managers.id
                WHERE agents.id = lead.assigned_to 
                AND managers.manager_id = current_user_id
            );
    END IF;
    
    -- Default deny
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;