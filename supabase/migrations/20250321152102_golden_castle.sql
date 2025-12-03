/*
  # Add manager hierarchy support

  1. Changes
    - Add manager role type
    - Add manager_id to user_profiles table
    - Create hierarchy view
    - Update RLS policies

  2. Security
    - Enable managers to view their team's data
    - Maintain admin access to all data
*/

-- Begin transaction for enum update
BEGIN;

-- Update role type to include manager
ALTER TYPE role_type ADD VALUE 'manager';

-- Commit the enum change before using it
COMMIT;

-- Add manager_id to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES user_profiles(id);

-- Create view for hierarchy traversal
CREATE OR REPLACE VIEW user_hierarchy AS
WITH RECURSIVE hierarchy AS (
  -- Base case: users with their immediate manager
  SELECT 
    id,
    manager_id,
    ARRAY[id] as path,
    1 as level
  FROM user_profiles
  
  UNION ALL
  
  -- Recursive case: traverse up through managers
  SELECT
    h.id,
    up.manager_id,
    h.path || up.id,
    h.level + 1
  FROM hierarchy h
  JOIN user_profiles up ON h.manager_id = up.id
  WHERE NOT up.id = ANY(h.path) -- Prevent cycles
)
SELECT * FROM hierarchy;

-- Update leads policies for manager access
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can read assigned leads or all leads if admin" ON leads;
  EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can read assigned leads or all leads if admin/manager"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR (
          up.role = 'manager'
          AND EXISTS (
            SELECT 1 FROM user_hierarchy h
            WHERE h.id = leads.assigned_to
            AND h.manager_id = up.id
          )
        )
      )
    )
  );

-- Update user_profiles policies for manager access
CREATE POLICY "Managers can view their agents"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR (
          up.role = 'manager'
          AND EXISTS (
            SELECT 1 FROM user_hierarchy h
            WHERE h.id = user_profiles.id
            AND h.manager_id = up.id
          )
        )
      )
    )
  );