/*
  # Fix login and user profile access
  
  1. Changes
    - Drop and recreate user profile policies with proper access
    - Add policy for initial admin creation
    - Fix profile access during login
    
  2. Security
    - Maintain secure access control
    - Allow proper profile creation and access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read basic profile info" ON user_profiles;
DROP POLICY IF EXISTS "Allow first admin creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON user_profiles;

-- Create new policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can read other profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles self
      WHERE self.id = auth.uid()
      AND (
        self.role = 'admin'
        OR self.role = 'manager'
        OR id = auth.uid()
      )
    )
  );

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

CREATE POLICY "Only admins can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Add function to handle user deletion
CREATE OR REPLACE FUNCTION handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Set manager_id to null for any users managed by the deleted user
  UPDATE user_profiles
  SET manager_id = NULL
  WHERE manager_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for user deletion
DROP TRIGGER IF EXISTS on_user_delete ON user_profiles;
CREATE TRIGGER on_user_delete
  BEFORE DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_deleted_user();