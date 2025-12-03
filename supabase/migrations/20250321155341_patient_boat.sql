/*
  # Fix database relationships and lead status issues

  1. Changes
    - Add missing 'Converted' status
    - Update leads table constraints
    - Fix relationship between leads and user_profiles
    
  2. Security
    - Maintain existing RLS policies
*/

-- First ensure we have all required statuses
INSERT INTO lead_statuses (name, is_system)
VALUES ('Converted', true)
ON CONFLICT (name) DO NOTHING;

-- Create temporary table for leads that need status update
CREATE TEMP TABLE leads_to_update AS
SELECT id, status
FROM leads
WHERE status NOT IN (SELECT name FROM lead_statuses);

-- Update any invalid statuses to 'New'
UPDATE leads
SET status = 'New'
WHERE id IN (SELECT id FROM leads_to_update);

-- Drop and recreate the foreign key constraint
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_status_fkey,
  ALTER COLUMN status SET DEFAULT 'New',
  ADD CONSTRAINT leads_status_fkey 
    FOREIGN KEY (status) 
    REFERENCES lead_statuses(name)
    ON UPDATE CASCADE;

-- Clean up
DROP TABLE leads_to_update;

-- Fix the relationship between leads and user_profiles
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey,
  ADD CONSTRAINT leads_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES user_profiles(id);