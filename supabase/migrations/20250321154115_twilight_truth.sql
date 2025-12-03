/*
  # Add lead statuses management

  1. New Tables
    - `lead_statuses`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `created_at` (timestamp)
      - `is_system` (boolean) - to protect default statuses
  
  2. Security
    - Enable RLS on `lead_statuses` table
    - Add policies for admin access
*/

-- Create lead statuses table
CREATE TABLE lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_system BOOLEAN DEFAULT false
);

ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;

-- Only admins can modify statuses
CREATE POLICY "Admins can manage lead statuses"
  ON lead_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Everyone can read statuses
CREATE POLICY "All users can view lead statuses"
  ON lead_statuses
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert default statuses including "Converted"
INSERT INTO lead_statuses (name, is_system) VALUES
  ('New', true),
  ('Hot', true),
  ('Burned', true),
  ('Call Back', true),
  ('Deposited', true),
  ('Duplicate', true),
  ('Existed Client', true),
  ('Failed Deposit', true),
  ('Fake FTD', true),
  ('Invalid Number', true),
  ('Low Potential', true),
  ('Never Answer', true),
  ('No Answer', true),
  ('No Language', true),
  ('No Registration', true),
  ('No time, call later', true),
  ('Not Interested', true),
  ('Not out Target', true),
  ('Not Reachable', true),
  ('Reassign', true),
  ('TEST FTD', true),
  ('Transfer', true),
  ('Under Age', true),
  ('Voice Mail', true),
  ('Wire waiting', true),
  ('Wrong Number', true),
  ('Wrong Person', true),
  ('Converted', true);

-- Create temporary table for leads that need status update
CREATE TEMP TABLE leads_to_update AS
SELECT id, status
FROM leads
WHERE status NOT IN (SELECT name FROM lead_statuses);

-- Update any invalid statuses to 'New'
UPDATE leads
SET status = 'New'
WHERE id IN (SELECT id FROM leads_to_update);

-- Now safe to add the foreign key constraint
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_fkey,
  ALTER COLUMN status SET DEFAULT 'New',
  ADD CONSTRAINT leads_status_fkey 
    FOREIGN KEY (status) 
    REFERENCES lead_statuses(name)
    ON UPDATE CASCADE;

-- Clean up
DROP TABLE leads_to_update;