/*
  # Fix user profile policies and recursion issues
  
  1. Changes
    - Drop all existing user profile policies
    - Create new simplified policies without recursion
    - Add proper indexes for performance
    
  2. Security
    - Maintain existing security model
    - Fix policy recursion issues
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow first admin creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view their team" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view their agents" ON user_profiles;

-- Create new simplified policies
CREATE POLICY "Users can read basic profile info"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow first admin creation"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'admin' AND
    NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE role = 'admin'
    )
  );

CREATE POLICY "Allow admin to create users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON user_profiles(manager_id);

-- Update the user_hierarchy view to be more efficient
CREATE OR REPLACE VIEW user_hierarchy AS
WITH RECURSIVE hierarchy AS (
  -- Base case: users with their immediate manager
  SELECT 
    id,
    manager_id,
    ARRAY[id] as path,
    1 as level
  FROM user_profiles
  WHERE manager_id IS NOT NULL
  
  UNION ALL
  
  -- Recursive case: traverse up through managers
  SELECT
    h.id,
    up.manager_id,
    h.path || up.id,
    h.level + 1
  FROM hierarchy h
  JOIN user_profiles up ON h.manager_id = up.id
  WHERE up.manager_id IS NOT NULL
    AND NOT up.id = ANY(h.path) -- Prevent cycles
    AND h.level < 10 -- Prevent deep recursion
)
SELECT DISTINCT ON (id) * FROM hierarchy;