/*
  # Fix login logs table and policies

  1. Changes
    - Drop existing policies to fix permissions
    - Create new policies with correct access rules
    - Add indexes for better query performance

  2. Security
    - Enable RLS
    - Add policies for admins, managers, and users
*/

-- First drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all login logs" ON login_logs;
DROP POLICY IF EXISTS "Managers can view their team's login logs" ON login_logs;
DROP POLICY IF EXISTS "Users can view their own login logs" ON login_logs;

-- Recreate policies with correct permissions
CREATE POLICY "Admins can view all login logs"
  ON login_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Managers can view their team's login logs"
  ON login_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles manager
      WHERE manager.id = auth.uid()
      AND manager.role = 'manager'
      AND EXISTS (
        SELECT 1 FROM user_profiles team
        WHERE team.manager_id = manager.id
        AND team.id = login_logs.user_id
      )
    )
  );

CREATE POLICY "Users can view their own login logs"
  ON login_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add policy for inserting login logs
CREATE POLICY "Allow authenticated users to log their own logins"
  ON login_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Make sure RLS is enabled
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);