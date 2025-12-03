/*
  # Add color field to lead statuses

  1. Changes
    - Add color field to lead_statuses table
    - Update existing statuses with default colors
*/

ALTER TABLE lead_statuses 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#9CA3AF';

-- Set some default colors for common statuses
DO $$
BEGIN
  UPDATE lead_statuses SET color = '#22C55E' WHERE name = 'Deposited';
  UPDATE lead_statuses SET color = '#3B82F6' WHERE name = 'New';
  UPDATE lead_statuses SET color = '#EAB308' WHERE name = 'In Progress';
  UPDATE lead_statuses SET color = '#EF4444' WHERE name = 'Lost';
  UPDATE lead_statuses SET color = '#8B5CF6' WHERE name = 'Converted';
END $$;