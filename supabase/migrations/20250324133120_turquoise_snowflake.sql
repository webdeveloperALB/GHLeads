/*
  # Update lead visibility and assignment permissions

  1. Changes
    - Update RLS policies for leads table to enforce role-based access:
      - Admins can see all leads and assign to anyone
      - Managers can see their team's leads and unassigned leads
      - Managers can only assign leads to themselves or their team
      - Agents can only see their assigned leads
      - Agents cannot assign leads

  2. Security
    - Enable RLS on leads table
    - Add policies for SELECT and UPDATE operations
    - Ensure proper role checks in all policies
*/

-- First, drop existing policies if any
DROP POLICY IF EXISTS "Users can read assigned leads or all leads if admin/manager" ON leads;
DROP POLICY IF EXISTS "Users can update their assigned leads or all leads if admin" ON leads;

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy for lead visibility
CREATE POLICY "Lead visibility based on role"
ON leads
FOR SELECT
TO authenticated
USING (
  -- Admins can see all leads
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
  OR
  -- Managers can see their team's leads and unassigned leads
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'manager'
    AND (
      assigned_to IS NULL OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles agent
        WHERE agent.id = leads.assigned_to
        AND agent.manager_id = user_profiles.id
      )
    )
  )
  OR
  -- Agents can only see their assigned leads
  (
    assigned_to = auth.uid() AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'agent'
    )
  )
);

-- Policy for lead updates by admins
CREATE POLICY "Admins can update any lead"
ON leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Policy for lead updates by managers
CREATE POLICY "Managers can update their team's leads"
ON leads
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'manager'
    AND (
      assigned_to IS NULL OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM user_profiles agent
        WHERE agent.id = leads.assigned_to
        AND agent.manager_id = user_profiles.id
      )
    )
  )
)
WITH CHECK (
  -- Managers can only assign to themselves or their team
  assigned_to IS NULL OR
  assigned_to = auth.uid() OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'manager'
    AND EXISTS (
      SELECT 1 FROM user_profiles agent
      WHERE agent.id = assigned_to
      AND agent.manager_id = user_profiles.id
    )
  )
);

-- Policy for lead updates by agents
CREATE POLICY "Agents can update their assigned leads"
ON leads
FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid() AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'agent'
  )
)
WITH CHECK (
  -- Agents cannot change assignment
  assigned_to = auth.uid()
);