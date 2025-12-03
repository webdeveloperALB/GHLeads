/*
  # Fix User Visibility RLS Policy

  This migration updates the Row Level Security (RLS) policy on the user_profiles table
  to allow users to see their hierarchy properly.

  ## Changes Made

  1. **Drop Existing Restrictive Policy**
     - Removes the current policy that only allows users to see their own profile

  2. **Create New Hierarchical Policy**
     - Users can see their own profile
     - Admins can see all profiles
     - Managers and desk users can see their subordinates through the user_hierarchy view

  ## Security

  - Maintains data security by only allowing access to relevant users
  - Uses the existing user_hierarchy view for proper subordinate relationships
  - Preserves admin access to all users
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.user_profiles;

-- Create a new policy that allows proper hierarchy access
CREATE POLICY "Allow hierarchical user profile access"
ON public.user_profiles FOR SELECT
TO authenticated
USING (
  -- Users can always see their own profile
  (uid() = id) 
  OR
  -- Admins can see all profiles
  (EXISTS (
    SELECT 1 
    FROM public.user_profiles AS current_user_profile 
    WHERE current_user_profile.id = uid() 
    AND current_user_profile.role = 'admin'
  )) 
  OR
  -- Users can see their subordinates through the hierarchy
  (EXISTS (
    SELECT 1
    FROM public.user_hierarchy uh_subordinate
    JOIN public.user_hierarchy uh_current ON uh_current.id = uid()
    WHERE
      uh_subordinate.id = user_profiles.id 
      AND uh_subordinate.path @> uh_current.path 
      AND uh_subordinate.level > uh_current.level
  ))
);