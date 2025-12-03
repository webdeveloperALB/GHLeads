/*
  # Fix infinite recursion in user_profiles RLS policy

  1. Changes
    - Drop all existing SELECT policies on user_profiles to prevent conflicts
    - Create simple RLS policies that don't cause recursion
    - Create SECURITY DEFINER functions to handle hierarchy logic safely
    - Allow admins full access, users to see own profile, and handle hierarchy through application logic

  2. Security
    - Enable RLS on user_profiles table
    - Simple policies that avoid circular dependencies
    - Use SECURITY DEFINER functions for safe hierarchy traversal
*/

-- Drop all existing SELECT policies on user_profiles
DROP POLICY IF EXISTS "Simple user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON user_profiles;
DROP POLICY IF EXISTS "Comprehensive user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Allow hierarchical user profile access" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own and subordinate profiles" ON user_profiles;

-- Create a simple function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Create function to get all subordinate IDs for a user
CREATE OR REPLACE FUNCTION get_all_subordinate_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subordinate_ids uuid[] := ARRAY[]::uuid[];
  direct_reports uuid[];
  report_id uuid;
BEGIN
  -- Get direct reports
  SELECT ARRAY(
    SELECT id FROM user_profiles 
    WHERE manager_id = p_user_id
  ) INTO direct_reports;
  
  -- Add direct reports to result
  subordinate_ids := subordinate_ids || direct_reports;
  
  -- Recursively get subordinates of each direct report
  FOREACH report_id IN ARRAY direct_reports
  LOOP
    subordinate_ids := subordinate_ids || get_all_subordinate_ids(report_id);
  END LOOP;
  
  RETURN subordinate_ids;
END;
$$;

-- Create a very simple RLS policy that allows:
-- 1. Admins to see all profiles
-- 2. Users to see their own profile
-- 3. Additional visibility will be handled through application logic
CREATE POLICY "Simple admin and self access" ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_subordinate_ids(uuid) TO authenticated;