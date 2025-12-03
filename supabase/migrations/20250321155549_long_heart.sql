/*
  # Fix duplicate foreign key constraints

  1. Changes
    - Drop duplicate foreign key constraint between leads and user_profiles
    - Keep only one constraint with a clear name
    - Update queries to use the correct relationship name

  2. Security
    - No changes to RLS policies
*/

-- Drop the duplicate foreign key constraint
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS new_leads_assigned_to_fkey;

-- Update the queries to use the correct relationship name
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