/*
  # Fix infinite recursion in user_profiles RLS policy

  1. Changes
    - Drop all existing SELECT policies on user_profiles
    - Create minimal RLS policy that only allows users to see their own profile
    - Remove any functions that could cause recursion
    - Keep policy extremely simple to avoid circular dependencies

  2. Security
    - Enable RLS on user_profiles table
    - Users can only see their own profile (id = auth.uid())
    - No complex hierarchy checks in RLS to avoid recursion
*/

-- Drop all existing SELECT policies on user_profiles
DROP POLICY IF EXISTS "Admin full access to profiles" ON user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Simple user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Users can see own profile and admins see all" ON user_profiles;

-- Drop any functions that might cause recursion
DROP FUNCTION IF EXISTS is_admin();
DROP FUNCTION IF EXISTS get_all_subordinate_ids(uuid);

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create the most minimal policy possible - only allow users to see their own profile
CREATE POLICY "Users can only see own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());