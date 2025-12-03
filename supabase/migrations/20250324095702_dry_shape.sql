/*
  # Add affiliate API management system

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `name` (text) - Affiliate name
      - `api_key` (text) - Unique API key
      - `is_active` (boolean) - Whether the key is active
      - `created_at` (timestamp)
      - `last_used` (timestamp)
      - `source_prefix` (text) - Unique prefix for source identification
      - `allowed_ips` (text[]) - Array of allowed IP addresses

  2. Security
    - Enable RLS
    - Only admins can manage API keys
*/

-- Create API keys table
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used timestamptz,
  source_prefix text UNIQUE NOT NULL,
  allowed_ips text[] DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES user_profiles(id)
);

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Only admins can manage API keys"
  ON api_keys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Create function to generate random API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS text AS $$
DECLARE
  chars text[] := ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9'];
  result text := '';
  i integer := 0;
BEGIN
  FOR i IN 1..32 LOOP
    result := result || chars[1 + floor(random() * array_length(chars, 1))];
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;