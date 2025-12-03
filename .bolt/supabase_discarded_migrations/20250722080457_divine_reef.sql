```sql
-- Drop any existing restrictive policies to ensure a clean slate
DROP POLICY IF EXISTS "Allow authenticated users to view their own profile and their hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;

-- Recreate user_hierarchy view to ensure it correctly builds hierarchical paths
-- This view is crucial for the RLS policy to understand subordinate relationships.
CREATE OR REPLACE VIEW public.user_hierarchy AS
WITH RECURSIVE user_tree AS (
  -- Anchor member: Select all users who do not have a manager (top-level users)
  SELECT
    id,
    manager_id,
    ARRAY[id] AS path, -- Start the path with their own ID
    0 AS level
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
    ut.level + 1
  FROM
    public.user_profiles up
  JOIN
    user_tree ut ON up.manager_id = ut.id
)
SELECT
  id,
  manager_id,
  path,
  level
FROM
  user_tree;

-- Create a new RLS policy for SELECT operations on user_profiles
-- This policy defines who can see which user profiles based on their role and hierarchy.
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  -- 1. A user can always see their own profile
  (auth.uid() = id)

  OR

  -- 2. Users with the 'admin' role can see all profiles
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE
      current_user_profile.id = auth.uid()
      AND current_user_profile.role = 'admin'
  ))

  OR

  -- 3. Users with 'manager' or 'desk' roles can see their direct and indirect subordinates
  -- This is achieved by checking if the current user's hierarchy path is an ancestor
  -- of the target user's hierarchy path.
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    JOIN public.user_hierarchy AS current_user_hierarchy ON current_user_profile.id = current_user_hierarchy.id
    JOIN public.user_hierarchy AS target_user_hierarchy ON user_profiles.id = target_user_hierarchy.id
    WHERE
      current_user_profile.id = auth.uid()
      AND current_user_profile.role IN ('manager', 'desk')
      AND target_user_hierarchy.path @> current_user_hierarchy.path -- Current user's path is an ancestor of target's path
      AND target_user_hierarchy.id != current_user_profile.id -- Exclude self (already covered by auth.uid() = id)
  ))

  OR

  -- 4. Any user can see their direct manager (if they have one)
  (user_profiles.id = (SELECT manager_id FROM public.user_profiles WHERE id = auth.uid()))
);

-- Add indexes for performance on manager_id and role if not already present
-- These indexes help speed up queries involving manager-subordinate relationships and role-based filtering.
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON public.user_profiles (manager_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);

-- Optional: Add a function to help debug hierarchy (can be removed after debugging)
-- This function allows you to query the hierarchy from the perspective of a specific user,
-- which can be very useful for verifying the RLS policy's behavior.
CREATE OR REPLACE FUNCTION public.get_user_hierarchy_debug(user_id uuid)
RETURNS TABLE(id uuid, full_name text, role public.role_type, manager_id uuid, path uuid[], level integer)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id,
    up.full_name,
    up.role,
    up.manager_id,
    uh.path,
    uh.level
  FROM
    public.user_profiles up
  JOIN
    public.user_hierarchy uh ON up.id = uh.id
  WHERE
    uh.path @> (SELECT path FROM public.user_hierarchy WHERE id = user_id)
  ORDER BY
    uh.level, up.full_name;
END;
$$;
```