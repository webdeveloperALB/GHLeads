/*
  # Fix admin signup policies

  1. Changes
    - Update user_profiles RLS policies to allow first admin creation
    - Add policy for first admin signup when no admin exists
    - Add policy for subsequent admin-only user creation

  2. Security
    - Maintains security by only allowing admin creation when no admin exists
    - Preserves admin-only user management after initial setup
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can create profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;

-- Create new policies for user creation
CREATE POLICY "Allow first admin creation"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'admin' AND
    NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE role = 'admin'
    )
  );

CREATE POLICY "Allow admin to create users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Update policy for profile updates
CREATE POLICY "Only admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );