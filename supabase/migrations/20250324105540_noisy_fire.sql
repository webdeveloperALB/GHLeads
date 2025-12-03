/*
  # Update user profiles table
  
  1. Changes
    - Add email and password fields to user_profiles table
    - Update policies for basic profile access
    - Add indexes for better performance
    
  2. Security
    - Maintain admin-only access control
    - Enable RLS
*/

-- Add email and password fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email text UNIQUE,
ADD COLUMN IF NOT EXISTS password text NOT NULL DEFAULT 'password123';

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow first admin creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON user_profiles;

-- Create new simplified policies
CREATE POLICY "Users can read basic profile info"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow first admin creation"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'admin'
    AND NOT EXISTS (
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON user_profiles(manager_id);