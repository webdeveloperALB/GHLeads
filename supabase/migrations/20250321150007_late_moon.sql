/*
  # Create leads and activity tables

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text, unique)
      - `phone` (text)
      - `country` (text)
      - `status` (text)
      - `brand` (text)
      - `balance` (decimal)
      - `total_deposits` (decimal)
      - `created_at` (timestamp)
      - `converted_at` (timestamp)
      - `last_activity` (timestamp)
      - `is_converted` (boolean)

    - `lead_activities`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key)
      - `type` (text)
      - `description` (text)
      - `created_at` (timestamp)

    - `lead_comments`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key)
      - `content` (text)
      - `created_at` (timestamp)
      - `created_by` (uuid, foreign key to auth.users)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read and write data
*/

-- Create leads table
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  country text,
  status text DEFAULT 'New',
  brand text,
  balance decimal DEFAULT 0,
  total_deposits decimal DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  converted_at timestamptz,
  last_activity timestamptz DEFAULT now(),
  is_converted boolean DEFAULT false
);

-- Create lead activities table
CREATE TABLE lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create lead comments table
CREATE TABLE lead_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read activities"
  ON lead_activities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert activities"
  ON lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read comments"
  ON lead_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert comments"
  ON lead_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);