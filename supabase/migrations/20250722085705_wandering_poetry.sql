/*
  # Fix RLS policies for leads table

  1. Security Updates
    - Update RLS policies to allow managers and desk users to see their team's leads
    - Ensure admins can see all leads
    - Ensure agents can only see their assigned leads
    - Update policies to work with the user hierarchy (admin -> desk -> manager -> agent)

  2. Changes
    - Update SELECT policy to include team visibility for managers and desk users
    - Update INSERT and UPDATE policies accordingly
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Strict lead visibility based on role and assignment" ON leads;
DROP POLICY IF EXISTS "Users can insert leads" ON leads;
DROP POLICY IF EXISTS "Users can update leads they can see" ON leads;

-- Create new SELECT policy that handles team hierarchy
CREATE POLICY "Team-based lead visibility" ON leads
  FOR SELECT
  TO authenticated
  USING (
    -- Admins can see all leads
    (EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    ))
    OR
    -- Desk users can see all leads assigned to their team (managers and agents under them)
    (EXISTS (
      SELECT 1 FROM user_profiles desk_user
      WHERE desk_user.id = auth.uid() 
      AND desk_user.role = 'desk'
      AND (
        -- Leads assigned to the desk user themselves
        leads.assigned_to = desk_user.id
        OR
        -- Leads assigned to managers under this desk
        leads.assigned_to IN (
          SELECT manager.id FROM user_profiles manager 
          WHERE manager.manager_id = desk_user.id 
          AND manager.role = 'manager'
        )
        OR
        -- Leads assigned to agents under managers under this desk
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          JOIN user_profiles manager ON agent.manager_id = manager.id
          WHERE manager.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        -- Leads assigned to agents directly under this desk
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          WHERE agent.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        -- Unassigned leads (can be seen by desk users)
        leads.assigned_to IS NULL
      )
    ))
    OR
    -- Managers can see leads assigned to themselves and their agents
    (EXISTS (
      SELECT 1 FROM user_profiles manager_user
      WHERE manager_user.id = auth.uid() 
      AND manager_user.role = 'manager'
      AND (
        -- Leads assigned to the manager themselves
        leads.assigned_to = manager_user.id
        OR
        -- Leads assigned to agents under this manager
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent 
          WHERE agent.manager_id = manager_user.id 
          AND agent.role = 'agent'
        )
      )
    ))
    OR
    -- Agents can only see leads assigned to them
    (EXISTS (
      SELECT 1 FROM user_profiles agent_user
      WHERE agent_user.id = auth.uid() 
      AND agent_user.role = 'agent'
      AND leads.assigned_to = agent_user.id
    ))
  );

-- Create INSERT policy
CREATE POLICY "Users can insert leads" ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create UPDATE policy
CREATE POLICY "Users can update leads they can see" ON leads
  FOR UPDATE
  TO authenticated
  USING (
    -- Use the same logic as SELECT policy
    (EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles desk_user
      WHERE desk_user.id = auth.uid() 
      AND desk_user.role = 'desk'
      AND (
        leads.assigned_to = desk_user.id
        OR
        leads.assigned_to IN (
          SELECT manager.id FROM user_profiles manager 
          WHERE manager.manager_id = desk_user.id 
          AND manager.role = 'manager'
        )
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          JOIN user_profiles manager ON agent.manager_id = manager.id
          WHERE manager.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          WHERE agent.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        leads.assigned_to IS NULL
      )
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles manager_user
      WHERE manager_user.id = auth.uid() 
      AND manager_user.role = 'manager'
      AND (
        leads.assigned_to = manager_user.id
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent 
          WHERE agent.manager_id = manager_user.id 
          AND agent.role = 'agent'
        )
      )
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles agent_user
      WHERE agent_user.id = auth.uid() 
      AND agent_user.role = 'agent'
      AND leads.assigned_to = agent_user.id
    ))
  )
  WITH CHECK (
    -- Same logic for WITH CHECK
    (EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles desk_user
      WHERE desk_user.id = auth.uid() 
      AND desk_user.role = 'desk'
      AND (
        leads.assigned_to = desk_user.id
        OR
        leads.assigned_to IN (
          SELECT manager.id FROM user_profiles manager 
          WHERE manager.manager_id = desk_user.id 
          AND manager.role = 'manager'
        )
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          JOIN user_profiles manager ON agent.manager_id = manager.id
          WHERE manager.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent
          WHERE agent.manager_id = desk_user.id 
          AND agent.role = 'agent'
        )
        OR
        leads.assigned_to IS NULL
      )
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles manager_user
      WHERE manager_user.id = auth.uid() 
      AND manager_user.role = 'manager'
      AND (
        leads.assigned_to = manager_user.id
        OR
        leads.assigned_to IN (
          SELECT agent.id FROM user_profiles agent 
          WHERE agent.manager_id = manager_user.id 
          AND agent.role = 'agent'
        )
      )
    ))
    OR
    (EXISTS (
      SELECT 1 FROM user_profiles agent_user
      WHERE agent_user.id = auth.uid() 
      AND agent_user.role = 'agent'
      AND leads.assigned_to = agent_user.id
    ))
  );