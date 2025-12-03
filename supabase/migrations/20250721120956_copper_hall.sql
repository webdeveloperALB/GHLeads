/*
  # Add geolocation columns to login_logs table

  1. Changes
    - Add `city` column (text, nullable) to `login_logs` table
    - Add `country` column (text, nullable) to `login_logs` table
    - Add indexes for better query performance on geolocation data

  2. Security
    - No RLS changes needed as existing policies will apply to new columns
*/

-- Add city column to login_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_logs' AND column_name = 'city'
  ) THEN
    ALTER TABLE login_logs ADD COLUMN city text;
  END IF;
END $$;

-- Add country column to login_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'login_logs' AND column_name = 'country'
  ) THEN
    ALTER TABLE login_logs ADD COLUMN country text;
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_login_logs_city ON login_logs(city);
CREATE INDEX IF NOT EXISTS idx_login_logs_country ON login_logs(country);