/*
  # Separate RLS policies for user_profiles

  This migration separates the SELECT policies for user_profiles into two distinct policies:
  1. Admin policy - allows admins to see all user profiles
  2. User policy - allows users to see only their own profile

  ## Changes
  1. Drop existing combined SELECT policy
  2. Create dedicated admin SELECT policy
  3. Create dedicated user SELECT policy

  ## Security
  - Admins can view all profiles via JWT claims check
  - Regular users can only view their own profile
  - No infinite recursion as we avoid querying user_profiles within policies
*/

-- Drop the existing combined SELECT policy
DROP POLICY IF EXISTS "Comprehensive user profile access" ON public.user_profiles;

-- Create admin-specific SELECT policy
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    ((jwt() ->> 'user_metadata'::text))::jsonb ->> 'role'::text = 'admin'::text
    OR
    ((jwt() ->> 'app_metadata'::text))::jsonb ->> 'role'::text = 'admin'::text
  );

-- Create user-specific SELECT policy  
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);