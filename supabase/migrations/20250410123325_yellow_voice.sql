/*
  # Add test API key for development

  1. Changes
    - Insert a test API key for development
    - Set source prefix for lead tracking
    - Enable the API key by default
*/

-- Insert test API key if it doesn't exist
INSERT INTO api_keys (
  name,
  api_key,
  source_prefix,
  is_active
)
SELECT 
  'Test API Key',
  'BHX04DS3K1J4AU1AH6B6F3H7GOM43RXP',
  'TEST',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM api_keys 
  WHERE api_key = 'BHX04DS3K1J4AU1AH6B6F3H7GOM43RXP'
);