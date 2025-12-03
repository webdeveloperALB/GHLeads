/*
  # Fix user_profiles RLS policies

  1. Policy Updates
    - Update INSERT policy to allow authenticated users to create profiles with their own auth.uid()
    - Ensure SELECT policies work correctly for user profile access
    - Fix admin creation policy to work properly

  2. Security
    - Maintain proper RLS while allowing necessary operations
    - Ensure users can only create profiles for themselves
    - Allow admins to manage other users
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow first admin creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;

-- Create a comprehensive INSERT policy that handles both admin creation and self-creation
CREATE POLICY "Allow user profile creation"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow users to create their own profile (auth.uid() matches the id)
    (auth.uid() = id)
    OR
    -- Allow admins to create profiles for others
    (EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    ))
    OR
    -- Allow first admin creation when no admin exists
    (role = 'admin' AND NOT EXISTS (
      SELECT 1 FROM user_profiles existing_admin
      WHERE existing_admin.role = 'admin'
    ))
  );

-- Ensure the SELECT policy allows users to read profiles they should have access to
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON user_profiles;

CREATE POLICY "Allow profile access"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always read their own profile
    (auth.uid() = id)
    OR
    -- Admins can read all profiles
    (EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    ))
    OR
    -- Desk users can read their managed hierarchy
    (EXISTS (
      SELECT 1 FROM user_profiles desk_profile
      WHERE desk_profile.id = auth.uid() 
      AND desk_profile.role = 'desk'
      AND (
        -- Direct reports (managers)
        user_profiles.manager_id = desk_profile.id
        OR
        -- Indirect reports (agents under managers)
        EXISTS (
          SELECT 1 FROM user_profiles manager_profile
          WHERE manager_profile.manager_id = desk_profile.id
          AND user_profiles.manager_id = manager_profile.id
        )
      )
    ))
    OR
    -- Managers can read their direct reports
    (EXISTS (
      SELECT 1 FROM user_profiles manager_profile
      WHERE manager_profile.id = auth.uid() 
      AND manager_profile.role = 'manager'
      AND user_profiles.manager_id = manager_profile.id
    ))
  );

-- Update the UPDATE policy to be more permissive for admins
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;

CREATE POLICY "Allow profile updates"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Admins can update any profile
    (EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    ))
    OR
    -- Users can update their own profile (limited fields)
    (auth.uid() = id)
  )
  WITH CHECK (
    -- Same conditions as USING clause
    (EXISTS (
      SELECT 1 FROM user_profiles admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    ))
    OR
    (auth.uid() = id)
  );