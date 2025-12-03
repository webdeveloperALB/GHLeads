/*
  # Fix Manager Lead Visibility

  This migration fixes the issue where managers can see unassigned leads.
  
  ## Changes
  1. Drop existing lead visibility policy
  2. Update can_user_see_lead function with correct logic
  3. Create new strict visibility policy
  
  ## Rules After Fix
  - Agents: Only leads assigned to them
  - Managers: Only leads assigned to them OR assigned to their direct reports
  - Desks: Only leads assigned to them OR assigned to users in their hierarchy
  - Admins: All leads
  - NO ONE sees unassigned leads unless they are admin
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Lead visibility based on role" ON leads;

-- Create or replace the can_user_see_lead function with correct logic
CREATE OR REPLACE FUNCTION can_user_see_lead(lead_record leads)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    current_user_role role_type;
    subordinate_ids uuid[];
BEGIN
    -- Get current user info
    current_user_id := auth.uid();
    
    -- Get user role
    SELECT role INTO current_user_role
    FROM user_profiles
    WHERE id = current_user_id;
    
    -- If no role found, deny access
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
        -- Check if lead is assigned to the manager
        IF lead_record.assigned_to = current_user_id THEN
            RETURN true;
        END IF;
        
        -- Check if lead is assigned to one of their direct reports
        SELECT ARRAY(
            SELECT id 
            FROM user_profiles 
            WHERE manager_id = current_user_id
        ) INTO subordinate_ids;
        
        RETURN lead_record.assigned_to = ANY(subordinate_ids);
    END IF;
    
    -- Desk can see leads assigned to them or anyone in their hierarchy
    IF current_user_role = 'desk' THEN
        -- Check if lead is assigned to the desk user
        IF lead_record.assigned_to = current_user_id THEN
            RETURN true;
        END IF;
        
        -- Get all subordinates in hierarchy
        SELECT ARRAY(
            SELECT subordinate_id 
            FROM get_user_subordinates(current_user_id)
        ) INTO subordinate_ids;
        
        RETURN lead_record.assigned_to = ANY(subordinate_ids);
    END IF;
    
    -- Default deny
    RETURN false;
END;
$$;

-- Create new strict visibility policy
CREATE POLICY "Strict lead visibility based on role and assignment"
ON leads
FOR SELECT
TO authenticated
USING (can_user_see_lead(leads));

-- Also update the UPDATE policy to use the same logic
DROP POLICY IF EXISTS "Managers can update their team's leads" ON leads;
DROP POLICY IF EXISTS "Agents can update their assigned leads" ON leads;
DROP POLICY IF EXISTS "Admins can update any lead" ON leads;

-- Create unified UPDATE policy
CREATE POLICY "Users can update leads they can see"
ON leads
FOR UPDATE
TO authenticated
USING (can_user_see_lead(leads))
WITH CHECK (can_user_see_lead(leads));