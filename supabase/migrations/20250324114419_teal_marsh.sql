/*
  # Add color support for lead statuses
  
  1. Changes
    - Add color column to lead_statuses table
    - Set default colors for common statuses
    - Add NOT NULL constraint to ensure color is always set
  
  2. Default Colors
    - Deposited: Green (#22C55E)
    - New: Blue (#3B82F6)
    - In Progress: Yellow (#EAB308)
    - Lost: Red (#EF4444)
    - Converted: Purple (#8B5CF6)
*/

-- Add color column with NOT NULL constraint
ALTER TABLE lead_statuses 
ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#9CA3AF';

-- Set default colors for common statuses
UPDATE lead_statuses SET color = '#22C55E' WHERE name = 'Deposited';
UPDATE lead_statuses SET color = '#3B82F6' WHERE name = 'New';
UPDATE lead_statuses SET color = '#EAB308' WHERE name = 'In Progress';
UPDATE lead_statuses SET color = '#EF4444' WHERE name = 'Lost';
UPDATE lead_statuses SET color = '#8B5CF6' WHERE name = 'Converted';