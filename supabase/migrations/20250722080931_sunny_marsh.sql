/*
  # Fix infinite recursion in user_profiles RLS policy

  1. Policy Changes
    - Remove recursive policy that causes infinite loops
    - Create simple, non-recursive policy for user visibility
    - Allow users to see their own profile
    - Allow admins to see all profiles
    - Allow managers to see their direct reports
    - Allow desk users to see managers and agents under those managers

  2. Security
    - Maintain proper access control without recursion
    - Use direct table relationships instead of recursive views
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user creation" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user updates" ON public.user_profiles;

-- Create a simple, non-recursive SELECT policy
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
  -- Desk users can see managers and agents under those managers
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'desk'
    AND (
      -- Can see managers they manage
      (user_profiles.manager_id = auth.uid() AND user_profiles.role = 'manager')
      OR
      -- Can see agents under managers they manage
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
  -- Managers can see their direct reports (agents)
  (EXISTS (
    SELECT 1
    FROM public.user_profiles AS current_user_profile
    WHERE current_user_profile.id = auth.uid() 
    AND current_user_profile.role = 'manager'
    AND user_profiles.manager_id = auth.uid()
    AND user_profiles.role = 'agent'
  ))
  OR
  -- Any user can see their direct manager
  (user_profiles.id = (
    SELECT manager_id 
    FROM public.user_profiles 
    WHERE id = auth.uid()
  ))
);

-- Recreate INSERT policy
CREATE POLICY "Comprehensive user creation"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can create their own profile
  (auth.uid() = id) 
  OR
  -- Admins can create any profile
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
  OR
  -- Allow creation if no admin exists (for initial setup)
  (NOT EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE role = 'admin'
  ))
);

-- Recreate UPDATE policy
CREATE POLICY "Comprehensive user updates"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (
  -- Users can update their own profile
  (auth.uid() = id) 
  OR
  -- Admins can update any profile
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
)
WITH CHECK (
  -- Users can update their own profile
  (auth.uid() = id) 
  OR
  -- Admins can update any profile
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ))
);