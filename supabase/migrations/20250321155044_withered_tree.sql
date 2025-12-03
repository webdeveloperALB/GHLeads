/*
  # Add new lead fields

  1. New Fields
    - local_time: For storing the lead's local time based on country
    - source: For tracking lead source (e.g., Sourcelive123)
    - funnel: For tracking funnel name
    - desk: For tracking desk/IB information
    
  2. Changes
    - Add new columns to leads table
    - Add indexes for better query performance
*/

-- Add new columns to leads table
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS funnel TEXT,
  ADD COLUMN IF NOT EXISTS desk TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS leads_source_idx ON leads(source);
CREATE INDEX IF NOT EXISTS leads_funnel_idx ON leads(funnel);
CREATE INDEX IF NOT EXISTS leads_desk_idx ON leads(desk);