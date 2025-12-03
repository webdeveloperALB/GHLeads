/*
  # Update test API key format
  
  1. Changes
    - Update existing test API key to use proper format starting with 'ey'
    - Keep same source prefix and settings
*/

-- Delete old test API key
DELETE FROM api_keys 
WHERE api_key = 'BHX04DS3K1J4AU1AH6B6F3H7GOM43RXP';

-- Insert new test API key with correct format
INSERT INTO api_keys (
  name,
  api_key,
  source_prefix,
  is_active
)
VALUES (
  'Test API Key',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwOTg0MTY0NSwiZXhwIjoxNzQxMzc3NjQ1fQ.c8XuZYIXRZJLRrEiO-FJ-h8qFrF4uad0qkxIoTCQV8Y',
  'TEST',
  true
);