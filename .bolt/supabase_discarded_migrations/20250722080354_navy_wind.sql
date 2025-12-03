```sql
-- Drop any existing restrictive policies to ensure a clean slate
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to view their own profile and their hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;

-- Drop existing user_hierarchy view if it exists to ensure it's recreated correctly
DROP VIEW IF EXISTS public.user_hierarchy;

-- Create or replace the user_hierarchy view
-- This view recursively builds the hierarchical path for each user,
-- including their role, which is essential for the RLS policy.
CREATE OR REPLACE VIEW public.user_hierarchy AS
WITH RECURSIVE user_tree AS (
  -- Anchor member: Select all users who do not have a manager (top-level users)
  SELECT
    id,
    manager_id,
    ARRAY[id] AS path, -- Start the path with their own ID
    0 AS level,
    role
  FROM
    public.user_profiles
  WHERE
    manager_id IS NULL

  UNION ALL

  -- Recursive member: Join with user_profiles to find direct reports
  SELECT
    up.id,
    up.manager_id,
    ut.path || up.id, -- Append current user's ID to the path
    ut.level + 1,
    up.role
  FROM
    public.user_profiles up
  JOIN
    user_tree ut ON up.manager_id = ut.id
)
SELECT
  id,
  manager_id,
  path,
  level,
  role -- IMPORTANT: Include role here for RLS policy to use
FROM
  user_tree;

-- Create a new policy that allows proper hierarchical access for SELECT operations
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  (auth.uid() = id) -- User can see their own profile
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
    AND current_user_profile.role = 'admin'
  ))
  OR
  -- Managers/Desk can see their subordinates (using user_hierarchy view)
  (EXISTS (
    SELECT 1
    FROM public.user_hierarchy AS current_user_hierarchy
    WHERE current_user_hierarchy.id = auth.uid()
    AND (current_user_hierarchy.role = 'manager' OR current_user_hierarchy.role = 'desk')
  ) AND EXISTS (
    SELECT 1
    FROM public.user_hierarchy AS subordinate_hierarchy
    WHERE
      subordinate_hierarchy.id = user_profiles.id
      AND subordinate_hierarchy.path @> ARRAY[auth.uid()] -- Subordinate's path contains current user's ID
      AND subordinate_hierarchy.level > (SELECT level FROM public.user_hierarchy WHERE id = auth.uid()) -- Subordinate is below current user
  ))
  OR
  -- Users can see their direct manager (if they have one)
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid()
    AND user_profiles.id = current_user_profile.manager_id
  ))
);
```