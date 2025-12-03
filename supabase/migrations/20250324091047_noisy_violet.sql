/*
  # Fix user management permissions and policies

  1. Changes
    - Update RLS policies for user_profiles table
    - Add missing indexes
    - Fix cascade behavior for user deletion
    - Add proper constraints
    
  2. Security
    - Ensure proper access control for admin operations
    - Fix permissions for user management
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow first admin creation" ON user_profiles;
DROP POLICY IF EXISTS "Allow admin to create users" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Managers can view their agents" ON user_profiles;

-- Enable RLS if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper checks
CREATE POLICY "Users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY "Managers can view their agents"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR (
          up.role = 'manager'
          AND EXISTS (
            SELECT 1 FROM user_hierarchy h
            WHERE h.id = user_profiles.id
            AND h.manager_id = up.id
          )
        )
      )
    )
  );

-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_id ON user_profiles(manager_id);

-- Ensure proper cascade behavior
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_manager_id_fkey,
  ADD CONSTRAINT user_profiles_manager_id_fkey 
    FOREIGN KEY (manager_id) 
    REFERENCES user_profiles(id)
    ON DELETE SET NULL;

-- Add trigger to handle user deletion
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

DROP TRIGGER IF EXISTS on_user_delete ON user_profiles;
CREATE TRIGGER on_user_delete
  BEFORE DELETE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_deleted_user();

-- Ensure user_permissions table exists and has proper constraints
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Update user_permissions policies
DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Users can read their own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Managers can read team permissions" ON user_permissions;

CREATE POLICY "Admins can manage all permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can read their own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can read team permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'manager'
      AND EXISTS (
        SELECT 1 FROM user_profiles team
        WHERE team.manager_id = user_profiles.id
        AND team.id = user_permissions.user_id
      )
    )
  );

-- Add trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON user_permissions;
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON user_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();