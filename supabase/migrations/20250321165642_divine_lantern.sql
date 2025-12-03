/*
  # Add user permissions table with safe policy creation

  1. New Tables
    - `user_permissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `permissions` (jsonb)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_permissions` table
    - Add policies for:
      - Admins to manage all permissions
      - Users to read their own permissions
      - Managers to read their team's permissions
*/

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can manage all permissions" ON user_permissions;
  DROP POLICY IF EXISTS "Users can read their own permissions" ON user_permissions;
  DROP POLICY IF EXISTS "Managers can read team permissions" ON user_permissions;
END $$;

-- Create policies
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