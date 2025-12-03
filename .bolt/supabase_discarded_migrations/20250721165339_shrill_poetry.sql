/*
  # Fix User Hierarchy and RLS Policies

  This migration addresses the issue where desk users can only see themselves
  by fixing the user_hierarchy view and updating RLS policies.

  ## Changes Made

  1. **Recreate user_hierarchy view**
     - Uses recursive CTE to properly build hierarchical paths
     - Starts from top-level users (no manager) and builds down
     - Creates proper path arrays for hierarchy traversal

  2. **Update RLS policies**
     - Drop existing restrictive policies
     - Create comprehensive policy that allows:
       - Users to see their own profile
       - Admins to see all profiles
       - Users to see their subordinates via hierarchy view

  3. **Add debugging support**
     - Include helper function to debug hierarchy issues
     - Add indexes for better performance

  ## Expected Results
  - Desk users should see their manager reports and agents under those managers
  - Managers should see their direct agent reports
  - Admins should see all users
  - Agents should see only themselves (unless given specific permissions)
*/

-- Step 1: Drop and recreate the user_hierarchy view with proper recursive logic
DROP VIEW IF EXISTS public.user_hierarchy CASCADE;

CREATE VIEW public.user_hierarchy AS
WITH RECURSIVE user_tree AS (
  -- Anchor: Start with users who have no manager (top-level users like admins)
  SELECT
    id,
    manager_id,
    ARRAY[id] AS path,
    0 AS level,
    role,
    full_name
  FROM
    public.user_profiles
  WHERE
    manager_id IS NULL

  UNION ALL

  -- Recursive: Find all users who report to someone in the current tree
  SELECT
    up.id,
    up.manager_id,
    ut.path || up.id AS path,
    ut.level + 1 AS level,
    up.role,
    up.full_name
  FROM
    public.user_profiles up
  INNER JOIN user_tree ut ON up.manager_id = ut.id
)
SELECT
  id,
  manager_id,
  path,
  level
FROM user_tree;

-- Step 2: Add indexes for better performance on hierarchy queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON public.user_profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- Step 3: Drop all existing restrictive RLS policies
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view their own profile and their hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user creation" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user updates" ON public.user_profiles;

-- Step 4: Create a comprehensive RLS policy for SELECT operations
CREATE POLICY "Enhanced user profile visibility"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  (uid() = id)
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles current_user 
    WHERE current_user.id = uid() 
    AND current_user.role = 'admin'
  ))
  OR
  -- Users can see their subordinates through the hierarchy
  (EXISTS (
    SELECT 1
    FROM public.user_hierarchy uh_current
    JOIN public.user_hierarchy uh_target ON uh_target.id = user_profiles.id
    WHERE 
      uh_current.id = uid()
      AND uh_target.path @> uh_current.path  -- Target's path contains current user's path (target is subordinate)
      AND uh_target.level > uh_current.level -- Target is at a lower level (subordinate)
  ))
);

-- Step 5: Create policies for INSERT operations
CREATE POLICY "Allow user creation by admins and self-registration"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can create their own profile during registration
  (uid() = id)
  OR
  -- Admins can create any profile
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles current_user 
    WHERE current_user.id = uid() 
    AND current_user.role = 'admin'
  ))
  OR
  -- Allow creation if no admin exists yet (initial setup)
  (NOT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE role = 'admin'
  ))
);

-- Step 6: Create policies for UPDATE operations
CREATE POLICY "Allow user updates by admins and self-updates"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  (uid() = id)
  OR
  -- Admins can update any profile
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles current_user 
    WHERE current_user.id = uid() 
    AND current_user.role = 'admin'
  ))
)
WITH CHECK (
  -- Same conditions for the updated data
  (uid() = id)
  OR
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles current_user 
    WHERE current_user.id = uid() 
    AND current_user.role = 'admin'
  ))
);

-- Step 7: Create a helper function to debug hierarchy issues (optional)
CREATE OR REPLACE FUNCTION debug_user_hierarchy(target_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_role text,
  manager_id uuid,
  manager_name text,
  path_ids uuid[],
  hierarchy_level int
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    up.id as user_id,
    up.full_name as user_name,
    up.role::text as user_role,
    up.manager_id,
    manager.full_name as manager_name,
    uh.path as path_ids,
    uh.level as hierarchy_level
  FROM public.user_profiles up
  JOIN public.user_hierarchy uh ON up.id = uh.id
  LEFT JOIN public.user_profiles manager ON up.manager_id = manager.id
  WHERE (target_user_id IS NULL OR up.id = target_user_id)
  ORDER BY uh.level, up.full_name;
$$;

-- Step 8: Grant necessary permissions
GRANT SELECT ON public.user_hierarchy TO authenticated;
GRANT EXECUTE ON FUNCTION debug_user_hierarchy TO authenticated;

-- Step 9: Refresh the view to ensure it's properly created
REFRESH MATERIALIZED VIEW IF EXISTS public.user_hierarchy;