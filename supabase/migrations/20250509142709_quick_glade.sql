/*
  # Allow duplicate leads by removing email uniqueness constraint
  
  1. Changes
    - Remove unique constraint on leads.email column
    - Drop unique index on email column
    - Create non-unique index for email lookups
    
  2. Security
    - Maintain existing RLS policies
*/

-- Drop the unique constraint and index on email
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS new_leads_email_key;

DROP INDEX IF EXISTS new_leads_email_key;

-- Create a non-unique index for email lookups
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);