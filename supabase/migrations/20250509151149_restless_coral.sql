/*
  # Fix duplicate leads handling

  1. Changes
    - Remove duplicates before adding constraint
    - Keep only the most recent entry for each email/api_key combination
    - Add unique constraint for email per API key
    
  2. Security
    - Maintain existing RLS policies
    - Preserve data integrity
*/

-- Create a temporary table to store the duplicates we want to keep
CREATE TEMP TABLE leads_to_keep AS
WITH ranked_leads AS (
  SELECT 
    id,
    email,
    api_key_id,
    ROW_NUMBER() OVER (
      PARTITION BY email, api_key_id
      ORDER BY created_at DESC
    ) as rn
  FROM leads
  WHERE api_key_id IS NOT NULL
)
SELECT id
FROM ranked_leads
WHERE rn = 1;

-- Delete duplicates, keeping only the most recent entry
DELETE FROM leads
WHERE api_key_id IS NOT NULL
AND id NOT IN (SELECT id FROM leads_to_keep);

-- Drop temporary table
DROP TABLE leads_to_keep;

-- Now safe to create the unique constraint
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_email_api_key_unique;

CREATE UNIQUE INDEX leads_email_api_key_unique 
ON leads(email, api_key_id) 
WHERE api_key_id IS NOT NULL;

-- Add comment explaining the constraint
COMMENT ON INDEX leads_email_api_key_unique IS 
'Ensures email uniqueness within each API key, but allows duplicates across different API keys';