/*
  # Add source ID to leads table

  1. Changes
    - Add source_id column to leads table
    - Create sequence for source IDs starting at 10000
    - Add index for better performance
    - Update existing leads with sequential source IDs
*/

-- Create sequence for source IDs
CREATE SEQUENCE IF NOT EXISTS lead_source_id_seq START WITH 10000;

-- Add source_id column
ALTER TABLE leads
ADD COLUMN source_id BIGINT DEFAULT nextval('lead_source_id_seq');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id);

-- Update existing leads with sequential source IDs
WITH numbered_leads AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rnum
  FROM leads
)
UPDATE leads
SET source_id = nl.rnum + 9999
FROM numbered_leads nl
WHERE leads.id = nl.id;