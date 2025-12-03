/*
  # Fix RLS Policy with Direct Role-Based Approach

  This migration creates a simpler, more direct RLS policy that explicitly handles
  each role without relying on complex hierarchy view logic.

  ## Changes
  1. Drop existing restrictive policies
  2. Create direct role-based policies for each user type
  3. Add debugging queries to verify the policy works
*/

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "Allow authenticated users to view their own profile and their hierarchy" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user creation" ON public.user_profiles;
DROP POLICY IF EXISTS "Comprehensive user updates" ON public.user_profiles;

-- Create a comprehensive SELECT policy that handles all roles directly
CREATE POLICY "Role-based user visibility" ON public.user_profiles
FOR SELECT TO authenticated
USING (
  -- Users can always see their own profile
  (auth.uid() = id)
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'admin'
  ))
  OR
  -- Desk users can see managers that report to them
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'desk'
    AND user_profiles.manager_id = current_user.id
    AND user_profiles.role = 'manager'
  ))
  OR
  -- Desk users can see agents that report to their managers
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    JOIN public.user_profiles manager ON manager.manager_id = current_user.id
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'desk'
    AND manager.role = 'manager'
    AND user_profiles.manager_id = manager.id
    AND user_profiles.role = 'agent'
  ))
  OR
  -- Managers can see agents that report directly to them
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'manager'
    AND user_profiles.manager_id = current_user.id
    AND user_profiles.role = 'agent'
  ))
  OR
  -- Managers can see their desk manager (if they have one)
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'manager'
    AND user_profiles.id = current_user.manager_id
    AND user_profiles.role = 'desk'
  ))
);

-- Create INSERT policy
CREATE POLICY "User creation policy" ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (
  -- Users can create their own profile
  (auth.uid() = id)
  OR
  -- Admins can create any profile
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'admin'
  ))
  OR
  -- Allow creation if no admin exists yet (for initial setup)
  (NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE role = 'admin'
  ))
);

-- Create UPDATE policy
CREATE POLICY "User update policy" ON public.user_profiles
FOR UPDATE TO authenticated
USING (
  -- Users can update their own profile
  (auth.uid() = id)
  OR
  -- Admins can update any profile
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'admin'
  ))
)
WITH CHECK (
  -- Same conditions for the updated data
  (auth.uid() = id)
  OR
  (EXISTS (
    SELECT 1 FROM public.user_profiles current_user 
    WHERE current_user.id = auth.uid() 
    AND current_user.role = 'admin'
  ))
);

-- Add some debugging queries to test the policy
-- These will be commented out but can be run manually to test

/*
-- Test queries to run manually in Supabase SQL Editor:

-- 1. Check what users a desk user can see (replace the UUID with actual desk user ID)
SELECT 
  up.id,
  up.full_name,
  up.role,
  up.manager_id,
  'Can see this user' as visibility_reason
FROM public.user_profiles up
WHERE (
  -- Simulate being logged in as a desk user
  -- Replace 'YOUR_DESK_USER_ID' with actual desk user ID
  (up.id = 'YOUR_DESK_USER_ID') -- Own profile
  OR
  -- Managers reporting to desk user
  (up.manager_id = 'YOUR_DESK_USER_ID' AND up.role = 'manager')
  OR
  -- Agents reporting to those managers
  (EXISTS (
    SELECT 1 FROM public.user_profiles manager 
    WHERE manager.manager_id = 'YOUR_DESK_USER_ID'
    AND manager.role = 'manager'
    AND up.manager_id = manager.id
    AND up.role = 'agent'
  ))
);

-- 2. Check the hierarchy structure
SELECT 
  up.id,
  up.full_name,
  up.role,
  up.manager_id,
  manager.full_name as manager_name,
  manager.role as manager_role
FROM public.user_profiles up
LEFT JOIN public.user_profiles manager ON up.manager_id = manager.id
ORDER BY up.role, up.full_name;
*/