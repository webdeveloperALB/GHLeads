/*
  # Add user roles and lead assignments

  1. New Tables
    - `roles` enum type for user roles
    - `user_profiles` for additional user information
      - `id` (uuid, references auth.users)
      - `role` (role_type)
      - `full_name` (text)
      - `created_at` (timestamp)

  2. Changes
    - Add `assigned_to` column to leads table
    - Add RLS policies for role-based access
    - Add policies for lead assignments

  3. Security
    - Enable RLS on all tables
    - Add role-based policies
    - Restrict admin functions to admin role
*/

-- Create roles enum
CREATE TYPE role_type AS ENUM ('admin', 'agent');

-- Create user profiles table
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role role_type NOT NULL DEFAULT 'agent',
  full_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add assigned_to to leads
ALTER TABLE leads ADD COLUMN assigned_to uuid REFERENCES auth.users(id);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Update leads policies
DROP POLICY IF EXISTS "Allow authenticated users to read leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated users to insert leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated users to update leads" ON leads;

CREATE POLICY "Users can read assigned leads or all leads if admin"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their assigned leads or all leads if admin"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create initial admin user function
CREATE OR REPLACE FUNCTION create_initial_admin()
RETURNS void AS $$
DECLARE
  admin_email TEXT := 'admin@example.com';
  admin_password TEXT := 'admin123';
  user_id UUID;
BEGIN
  -- Create admin user in auth.users
  user_id := (
    SELECT id FROM auth.users 
    WHERE email = admin_email
    LIMIT 1
  );
  
  IF user_id IS NULL THEN
    user_id := (
      SELECT id FROM auth.users
      WHERE email = admin_email
      LIMIT 1
    );
    
    IF user_id IS NULL THEN
      RAISE NOTICE 'Please create the admin user through the application';
      RETURN;
    END IF;
  END IF;

  -- Create admin profile
  INSERT INTO user_profiles (id, role, full_name)
  VALUES (user_id, 'admin', 'System Admin')
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT create_initial_admin();