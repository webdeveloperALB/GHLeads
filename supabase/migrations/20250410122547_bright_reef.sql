/*
  # Add affiliate API management system

  1. Changes
    - Create API keys table if it doesn't exist
    - Add indexes for better performance
    - Enable RLS and set up admin-only policies
    - Add created_by tracking
    
  2. Security
    - Enable RLS
    - Only admins can manage API keys
*/

-- Create API keys table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_keys') THEN
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
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Only admins can manage API keys" ON api_keys;
END $$;

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

-- Create index if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'api_keys' 
    AND indexname = 'idx_api_keys_api_key'
  ) THEN
    CREATE INDEX idx_api_keys_api_key ON api_keys(api_key);
  END IF;
END $$;