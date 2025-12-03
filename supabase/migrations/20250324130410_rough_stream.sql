/*
  # Add login tracking

  1. New Tables
    - `login_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `ip_address` (text)
      - `user_agent` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `login_logs` table
    - Add policies for admins and managers to view logs
*/

CREATE TABLE IF NOT EXISTS login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at);

-- Enable RLS
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
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