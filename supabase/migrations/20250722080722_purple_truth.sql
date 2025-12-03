/*
  # Fix RLS policy for hierarchical user visibility

  1. Drop existing restrictive policies
  2. Recreate user_hierarchy view with proper structure
  3. Create comprehensive RLS policy that allows:
     - Users to see their own profile
     - Admins to see all profiles
     - Managers and Desk users to see their subordinates
     - Users to see their direct manager
*/

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user updates" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user creation" ON public.user_profiles;

-- Drop and recreate the user_hierarchy view to ensure it's correct
DROP VIEW IF EXISTS public.user_hierarchy;

CREATE VIEW public.user_hierarchy AS
WITH RECURSIVE hierarchy AS (
  -- Base case: users without managers (top level)
  SELECT 
    id,
    manager_id,
    role,
    full_name,
    ARRAY[id] as path,
    0 as level
  FROM public.user_profiles
  WHERE manager_id IS NULL
  
  UNION ALL
  
  -- Recursive case: users with managers
  SELECT 
    up.id,
    up.manager_id,
    up.role,
    up.full_name,
    h.path || up.id as path,
    h.level + 1 as level
  FROM public.user_profiles up
  JOIN hierarchy h ON up.manager_id = h.id
)
SELECT * FROM hierarchy;

-- Create a comprehensive RLS policy for SELECT operations
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  (auth.uid() = id) 
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles AS current_user_profile 
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'admin'
  )) 
  OR
  -- Desk users can see managers and agents under them
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'desk'
    AND (
      -- Can see managers that report to them
      (user_profiles.manager_id = auth.uid() AND user_profiles.role = 'manager')
      OR
      -- Can see agents that report to their managers
      (EXISTS (
        SELECT 1 
        FROM public.user_profiles AS manager
        WHERE manager.manager_id = auth.uid() 
        AND manager.role = 'manager'
        AND user_profiles.manager_id = manager.id
        AND user_profiles.role = 'agent'
      ))
    )
  ))
  OR
  -- Managers can see agents that report to them
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'manager'
    AND user_profiles.manager_id = auth.uid()
    AND user_profiles.role = 'agent'
  ))
  OR
  -- Users can see their direct manager
  (user_profiles.id = (
    SELECT manager_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  ))
);

-- Create INSERT policy
CREATE POLICY "Comprehensive user creation"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = id) 
  OR 
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
  OR 
  (NOT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE role = 'admin'
  ))
);

-- Create UPDATE policy
CREATE POLICY "Comprehensive user updates"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  (auth.uid() = id) 
  OR 
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
)
WITH CHECK (
  (auth.uid() = id) 
  OR 
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
);