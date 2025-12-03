/*
  # Fix Manager Lead Visibility

  This migration fixes the RLS policy to ensure managers can see:
  1. Leads assigned to themselves
  2. Leads assigned to their direct reports (agents)
  
  The issue was in the can_user_see_lead function where the manager logic
  was not properly checking for leads assigned to their subordinates.
*/

-- Drop and recreate the can_user_see_lead function with fixed logic
DROP FUNCTION IF EXISTS public.can_user_see_lead(leads);

CREATE OR REPLACE FUNCTION public.can_user_see_lead(lead_row leads)
RETURNS boolean AS $$
DECLARE
  user_profile user_profiles;
BEGIN
  -- Get current user profile
  SELECT * INTO user_profile 
  FROM user_profiles 
  WHERE id = auth.uid();
  
  -- If no user profile found, deny access
  IF user_profile IS NULL THEN
    RETURN false;
  END IF;
  
  -- Admin can see all leads
  IF user_profile.role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Desk users can see leads from their desk and their team
  IF user_profile.role = 'desk' THEN
    RETURN (
      -- Leads from their desk
      lead_row.desk = user_profile.full_name
      OR
      -- Leads assigned to themselves
      lead_row.assigned_to = user_profile.id
      OR
      -- Leads assigned to managers under them
      lead_row.assigned_to IN (
        SELECT id FROM user_profiles 
        WHERE manager_id = user_profile.id AND role = 'manager'
      )
      OR
      -- Leads assigned to agents under their managers
      lead_row.assigned_to IN (
        SELECT agent.id FROM user_profiles agent
        JOIN user_profiles manager ON agent.manager_id = manager.id
        WHERE manager.manager_id = user_profile.id AND agent.role = 'agent'
      )
      OR
      -- Leads assigned to agents directly under them
      lead_row.assigned_to IN (
        SELECT id FROM user_profiles 
        WHERE manager_id = user_profile.id AND role = 'agent'
      )
      OR
      -- Unassigned leads from their desk
      (lead_row.assigned_to IS NULL AND lead_row.desk = user_profile.full_name)
    );
  END IF;
  
  -- Manager users can see leads assigned to themselves and their agents
  IF user_profile.role = 'manager' THEN
    RETURN (
      -- Leads assigned to themselves
      lead_row.assigned_to = user_profile.id
      OR
      -- Leads assigned to their agents (direct reports)
      lead_row.assigned_to IN (
        SELECT id FROM user_profiles 
        WHERE manager_id = user_profile.id AND role = 'agent'
      )
    );
  END IF;
  
  -- Agent users can only see leads assigned to them
  IF user_profile.role = 'agent' THEN
    RETURN lead_row.assigned_to = user_profile.id;
  END IF;
  
  -- Default deny
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the RLS policy
DROP POLICY IF EXISTS "Team-based lead visibility" ON public.leads;

CREATE POLICY "Team-based lead visibility" ON public.leads
  FOR SELECT TO authenticated
  USING (can_user_see_lead(leads.*));