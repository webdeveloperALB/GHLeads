/*
  # Lead Assignment Rules System

  1. New Tables
    - `lead_assignment_rules`
      - `id` (uuid, primary key)
      - `source_name` (text) - Source identifier like "Candy", "Mars"
      - `country_code` (text) - Country code like "DE", "UK"
      - `assigned_agent_id` (uuid) - Agent to auto-assign to
      - `is_active` (boolean) - Whether rule is active
      - `priority` (integer) - For handling conflicts, higher = priority
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Only admins can view and manage assignment rules
    - System can query rules for automatic assignment

  3. Indexes
    - Composite index on source_name and country_code for fast lookups
    - Index on is_active for filtering active rules

  4. Constraints
    - Unique constraint on source_name + country_code combination
    - Foreign key to user_profiles for assigned_agent_id
*/

-- Create lead_assignment_rules table
CREATE TABLE IF NOT EXISTS lead_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  country_code text NOT NULL,
  assigned_agent_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_source_country 
  ON lead_assignment_rules(source_name, country_code);

CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_active 
  ON lead_assignment_rules(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_priority 
  ON lead_assignment_rules(priority DESC);

-- Add unique constraint to prevent duplicate rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignment_rules_unique 
  ON lead_assignment_rules(source_name, country_code, assigned_agent_id);

-- Enable RLS
ALTER TABLE lead_assignment_rules ENABLE ROW LEVEL SECURITY;

-- Admins can view all rules
CREATE POLICY "Admins can view assignment rules"
  ON lead_assignment_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can create rules
CREATE POLICY "Admins can create assignment rules"
  ON lead_assignment_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can update rules
CREATE POLICY "Admins can update assignment rules"
  ON lead_assignment_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Admins can delete rules
CREATE POLICY "Admins can delete assignment rules"
  ON lead_assignment_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_assignment_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS set_assignment_rules_updated_at ON lead_assignment_rules;
CREATE TRIGGER set_assignment_rules_updated_at
  BEFORE UPDATE ON lead_assignment_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_rules_updated_at();
