/*
  # Add deposit tracking field

  1. Changes
    - Add has_deposited boolean field to leads table
    - Create trigger to update has_deposited when deposits are made
    - Update existing leads based on deposit history

  2. Security
    - Maintain existing RLS policies
*/

-- Add has_deposited column with default false
ALTER TABLE leads
ADD COLUMN has_deposited boolean NOT NULL DEFAULT false;

-- Create function to handle deposit updates
CREATE OR REPLACE FUNCTION update_lead_deposit_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET has_deposited = true
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update has_deposited when a deposit is added
DROP TRIGGER IF EXISTS update_lead_deposit_status ON deposits;
CREATE TRIGGER update_lead_deposit_status
  AFTER INSERT ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_deposit_status();

-- Update existing leads based on deposit history
UPDATE leads
SET has_deposited = true
WHERE id IN (
  SELECT DISTINCT lead_id
  FROM deposits
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_has_deposited ON leads(has_deposited);

-- Add comment explaining the column
COMMENT ON COLUMN leads.has_deposited IS 
'Indicates whether the lead has made at least one deposit';