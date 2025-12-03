/*
  # Fix infinite recursion in user_profiles RLS policies

  1. Problem
    - Current SELECT policy causes infinite recursion by querying user_profiles within the policy
    - This happens when checking manager hierarchies or admin roles within the same table

  2. Solution
    - Simplify SELECT policy to avoid self-referencing queries
    - Use direct auth.uid() comparisons instead of subqueries to user_profiles
    - Remove complex hierarchy checks that cause recursion

  3. Security
    - Maintain basic access control without recursive queries
    - Users can read their own profile
    - Simple role-based access without complex subqueries
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow profile access" ON user_profiles;
DROP POLICY IF EXISTS "Allow profile updates" ON user_profiles;
DROP POLICY IF EXISTS "Allow user profile creation" ON user_profiles;

-- Create simple, non-recursive SELECT policy
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create simple INSERT policy
CREATE POLICY "Users can create own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create simple UPDATE policy
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create a separate policy for admin access using auth.jwt() claims
-- This avoids querying user_profiles table within the policy
CREATE POLICY "Admin access via JWT claims"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR 
    auth.uid() = id
  )
  WITH CHECK (
    (auth.jwt() ->> 'user_metadata')::jsonb ->> 'role' = 'admin'
    OR 
    auth.uid() = id
  );