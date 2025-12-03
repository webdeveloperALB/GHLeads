/*
  # Update desk lead visibility permissions

  1. Security Changes
    - Update `can_user_see_lead` function to give desk users manager-level permissions
    - Desk users can now see leads assigned to:
      - Themselves
      - Their direct managers
      - All users in their hierarchy (managers and agents under them)
    - Maintains strict separation between different desk hierarchies

  2. Function Updates
    - Modified lead visibility logic for desk role
    - Improved hierarchy checking for desk users
    - Ensures desk users only see leads within their organizational branch
*/

-- Drop and recreate the can_user_see_lead function with updated desk permissions
DROP FUNCTION IF EXISTS can_user_see_lead(leads);

CREATE OR REPLACE FUNCTION can_user_see_lead(lead_record leads)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    current_user_role role_type;
    current_user_manager_id uuid;
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- If no user is authenticated, deny access
    IF current_user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Get user role and manager
    SELECT role, manager_id INTO current_user_role, current_user_manager_id
    FROM user_profiles 
    WHERE id = current_user_id;
    
    -- If user profile not found, deny access
    IF current_user_role IS NULL THEN
        RETURN false;
    END IF;
    
    -- Admin can see all leads
    IF current_user_role = 'admin' THEN
        RETURN true;
    END IF;
    
    -- If lead is unassigned, only admins can see it
    IF lead_record.assigned_to IS NULL THEN
        RETURN false;
    END IF;
    
    -- Agent can only see leads assigned to them
    IF current_user_role = 'agent' THEN
        RETURN lead_record.assigned_to = current_user_id;
    END IF;
    
    -- Manager can see leads assigned to them or their direct reports
    IF current_user_role = 'manager' THEN
        -- Can see own leads
        IF lead_record.assigned_to = current_user_id THEN
            RETURN true;
        END IF;
        
        -- Can see leads assigned to their direct reports
        RETURN EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = lead_record.assigned_to 
            AND manager_id = current_user_id
        );
    END IF;
    
    -- Desk has manager-level permissions within their hierarchy
    IF current_user_role = 'desk' THEN
        -- Can see own leads
        IF lead_record.assigned_to = current_user_id THEN
            RETURN true;
        END IF;
        
        -- Can see leads assigned to their direct reports (managers and agents)
        IF EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = lead_record.assigned_to 
            AND manager_id = current_user_id
        ) THEN
            RETURN true;
        END IF;
        
        -- Can see leads assigned to agents under their managers
        RETURN EXISTS (
            SELECT 1 FROM user_profiles manager
            JOIN user_profiles agent ON agent.manager_id = manager.id
            WHERE manager.manager_id = current_user_id  -- Manager reports to this desk
            AND agent.id = lead_record.assigned_to      -- Lead is assigned to the agent
        );
    END IF;
    
    -- Default deny
    RETURN false;
END;
$$;