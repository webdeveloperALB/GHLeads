/*
  # Add function permissions and indexes

  1. Changes
    - Add indexes for better API performance
    - Grant necessary permissions to service role
    - Add rate limiting configuration
*/

-- Add indexes for better API performance
CREATE INDEX IF NOT EXISTS idx_api_keys_api_key ON api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Grant necessary permissions to service role
GRANT USAGE ON SEQUENCE lead_source_id_seq TO service_role;
GRANT USAGE ON SEQUENCE lead_id_seq TO service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE api_keys TO service_role;
GRANT SELECT, INSERT ON TABLE leads TO service_role;
GRANT SELECT, INSERT ON TABLE lead_activities TO service_role;

-- Add rate limiting metadata
COMMENT ON TABLE api_keys IS 'API keys for lead submission with rate limiting of 100 requests per minute';