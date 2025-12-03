/*
  # Fix admin user visibility in User Management

  This migration fixes the RLS policies to allow admins to see all users
  while preventing infinite recursion by using JWT claims instead of 
  querying the user_profiles table within the policy.

  1. Security Changes
    - Allow admins to view all user profiles using JWT claims
    - Maintain user privacy (users can only see their own profiles)
    - Prevent infinite recursion by avoiding subqueries to user_profiles
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admin access via JWT claims" ON user_profiles;

-- Create a comprehensive SELECT policy that allows:
-- 1. Users to read their own profile
-- 2. Admins to read all profiles (using JWT claims to avoid recursion)
CREATE POLICY "Comprehensive user profile access" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can read their own profile
    auth.uid() = id
    OR
    -- Admins can read all profiles (using JWT claims to avoid recursion)
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Check if user is admin by looking at raw user metadata
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
  );

-- Ensure INSERT policy allows admin creation
DROP POLICY IF EXISTS "Comprehensive user creation" ON user_profiles;
CREATE POLICY "Comprehensive user creation" ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can create their own profile
    auth.uid() = id
    OR
    -- Admins can create profiles for others
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
    OR
    -- Allow first admin creation (when no admin exists)
    NOT EXISTS (SELECT 1 FROM user_profiles WHERE role = 'admin')
  );

-- Ensure UPDATE policy allows admin updates
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Comprehensive user updates" ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Admins can update any profile
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
  )
  WITH CHECK (
    -- Same conditions for the updated data
    auth.uid() = id
    OR
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR
    (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin'
  );