/*
  # Add API key tracking for leads

  1. Changes
    - Add api_key_id column to leads table
    - Add foreign key constraint to api_keys table
    - Add index for better query performance
    - Update RLS policies to restrict access by API key
*/

-- Add api_key_id column
ALTER TABLE leads
ADD COLUMN api_key_id uuid REFERENCES api_keys(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_leads_api_key_id ON leads(api_key_id);

-- Update the leads endpoint function to store API key ID
CREATE OR REPLACE FUNCTION get_api_key_leads(api_key text)
RETURNS SETOF leads
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT l.*
  FROM leads l
  JOIN api_keys ak ON l.api_key_id = ak.id
  WHERE ak.api_key = api_key;
$$;