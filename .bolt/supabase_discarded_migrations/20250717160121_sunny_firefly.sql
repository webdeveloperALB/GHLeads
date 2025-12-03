/*
  # Add desk role and fix lead visibility

  1. Schema Changes
    - Add 'desk' to role_type enum
    - Update user hierarchy to support desk role
  
  2. Security Updates
    - Update RLS policies for proper lead visibility
    - Managers only see their assigned leads and their team's leads
    - Desks see all leads under their hierarchy
    - Admins see all leads

  3. Functions
    - Add helper functions for hierarchy management
*/

-- Add 'desk' to the role_type enum
ALTER TYPE role_type ADD VALUE IF NOT EXISTS 'desk';

-- Create a function to get all subordinates for a user (recursive)
CREATE OR REPLACE FUNCTION get_user_subordinates(user_id uuid)
RETURNS TABLE(subordinate_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinates AS (
    -- Base case: direct reports
    SELECT id as subordinate_id
    FROM user_profiles
    WHERE manager_id = user_id
    
    UNION ALL
    
    -- Recursive case: reports of reports
    SELECT up.id as subordinate_id
    FROM user_profiles up
    INNER JOIN subordinates s ON up.manager_id = s.subordinate_id
  )
  SELECT s.subordinate_id FROM subordinates s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a user can see a lead
CREATE OR REPLACE FUNCTION can_user_see_lead(user_id uuid, lead_assigned_to uuid)
RETURNS boolean AS $$
DECLARE
  user_role role_type;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM user_profiles WHERE id = user_id;
  
  -- Admins can see all leads
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- If lead is unassigned, only admins and desks can see it
  IF lead_assigned_to IS NULL THEN
    RETURN user_role = 'desk';
  END IF;
  
  -- If lead is assigned to the user themselves
  IF lead_assigned_to = user_id THEN
    RETURN true;
  END IF;
  
  -- For managers and desks, check if the assigned user is their subordinate
  IF user_role IN ('manager', 'desk') THEN
    RETURN EXISTS (
      SELECT 1 FROM get_user_subordinates(user_id) 
      WHERE subordinate_id = lead_assigned_to
    );
  END IF;
  
  -- Agents can only see their own leads
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing lead visibility policy
DROP POLICY IF EXISTS "Lead visibility based on role" ON leads;

-- Create new lead visibility policy
CREATE POLICY "Lead visibility based on hierarchy"
  ON leads
  FOR SELECT
  TO authenticated
  USING (can_user_see_lead(auth.uid(), assigned_to));

-- Update the lead update policies to use the same hierarchy logic
DROP POLICY IF EXISTS "Managers can update their team's leads" ON leads;
DROP POLICY IF EXISTS "Agents can update their assigned leads" ON leads;

-- Create unified update policy
CREATE POLICY "Users can update leads they can see"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (can_user_see_lead(auth.uid(), assigned_to))
  WITH CHECK (can_user_see_lead(auth.uid(), assigned_to));

-- Update user profiles policies to handle desk role
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;
CREATE POLICY "Allow admin and desk to create users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles user_profiles_1
      WHERE user_profiles_1.id = auth.uid() 
      AND user_profiles_1.role IN ('admin', 'desk')
    )
  );

-- Update user profiles select policy
DROP POLICY IF EXISTS "Users can read basic profile info" ON user_profiles;
CREATE POLICY "Users can read profile info based on hierarchy"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own profile
    id = auth.uid()
    OR
    -- Admins can see all profiles
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
    OR
    -- Desks and managers can see their subordinates
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() 
      AND up.role IN ('desk', 'manager')
      AND user_profiles.id IN (
        SELECT subordinate_id FROM get_user_subordinates(auth.uid())
      )
    )
  );

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_user_subordinates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_see_lead(uuid, uuid) TO authenticated;