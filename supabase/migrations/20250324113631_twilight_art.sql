/*
  # Add deposits tracking

  1. New Tables
    - `deposits`
      - `id` (uuid, primary key)
      - `lead_id` (bigint, foreign key to leads)
      - `amount` (numeric, not null)
      - `created_at` (timestamp with time zone)
      - `created_by` (uuid, foreign key to user_profiles)

  2. Security
    - Enable RLS on deposits table
    - Add policies for authenticated users
*/

-- Create deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint REFERENCES leads(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES user_profiles(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deposits_lead_id ON deposits(lead_id);
CREATE INDEX IF NOT EXISTS idx_deposits_created_by ON deposits(created_by);

-- Enable RLS
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view deposits they created or for leads they manage"
  ON deposits
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = deposits.lead_id
      AND (
        leads.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND (
            user_profiles.role = 'admin' OR
            (user_profiles.role = 'manager' AND EXISTS (
              SELECT 1 FROM user_profiles agent
              WHERE agent.id = leads.assigned_to
              AND agent.manager_id = user_profiles.id
            ))
          )
        )
      )
    )
  );

CREATE POLICY "Users can insert deposits for leads they manage"
  ON deposits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_id
      AND (
        leads.assigned_to = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND (
            user_profiles.role = 'admin' OR
            (user_profiles.role = 'manager' AND EXISTS (
              SELECT 1 FROM user_profiles agent
              WHERE agent.id = leads.assigned_to
              AND agent.manager_id = user_profiles.id
            ))
          )
        )
      )
    )
  );