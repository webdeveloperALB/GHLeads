/*
  # Update lead IDs to numeric format
  
  1. Changes
    - Change leads.id to use BIGSERIAL instead of UUID
    - Update foreign key constraints in related tables
    - Add sequence for ID generation starting at 1000000
  
  2. Security
    - Maintain existing RLS policies
    - Update foreign key constraints to maintain data integrity
*/

-- Temporarily disable RLS
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_comments DISABLE ROW LEVEL SECURITY;

-- Create new leads table with desired ID format
CREATE TABLE new_leads (
  id BIGINT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  country TEXT,
  status TEXT DEFAULT 'New',
  brand TEXT,
  balance NUMERIC DEFAULT 0,
  total_deposits NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  converted_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT now(),
  is_converted BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES user_profiles(id)
);

-- Create sequence for lead IDs starting at 1000000
CREATE SEQUENCE IF NOT EXISTS lead_id_seq START WITH 1000000;
ALTER TABLE new_leads ALTER COLUMN id SET DEFAULT nextval('lead_id_seq');

-- Copy existing data with new IDs
INSERT INTO new_leads (
  id, first_name, last_name, email, phone, country, status,
  brand, balance, total_deposits, created_at, converted_at,
  last_activity, is_converted, assigned_to
)
SELECT 
  nextval('lead_id_seq'), first_name, last_name, email, phone, country, status,
  brand, balance, total_deposits, created_at, converted_at,
  last_activity, is_converted, assigned_to
FROM leads;

-- Create new activities table
CREATE TABLE new_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT REFERENCES new_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Copy activities data
INSERT INTO new_lead_activities (
  id, lead_id, type, description, created_at
)
SELECT 
  a.id,
  (SELECT nl.id FROM new_leads nl 
   JOIN leads l ON l.first_name = nl.first_name 
   AND l.last_name = nl.last_name 
   AND l.email = nl.email
   WHERE l.id = a.lead_id),
  a.type,
  a.description,
  a.created_at
FROM lead_activities a;

-- Create new comments table
CREATE TABLE new_lead_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT REFERENCES new_leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES user_profiles(id)
);

-- Copy comments data
INSERT INTO new_lead_comments (
  id, lead_id, content, created_at, created_by
)
SELECT 
  c.id,
  (SELECT nl.id FROM new_leads nl 
   JOIN leads l ON l.first_name = nl.first_name 
   AND l.last_name = nl.last_name 
   AND l.email = nl.email
   WHERE l.id = c.lead_id),
  c.content,
  c.created_at,
  c.created_by
FROM lead_comments c;

-- Drop old tables
DROP TABLE lead_comments;
DROP TABLE lead_activities;
DROP TABLE leads;

-- Rename new tables
ALTER TABLE new_leads RENAME TO leads;
ALTER TABLE new_lead_activities RENAME TO lead_activities;
ALTER TABLE new_lead_comments RENAME TO lead_comments;

-- Re-enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- Recreate policies
CREATE POLICY "Users can insert leads"
  ON leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can read assigned leads or all leads if admin/manager"
  ON leads
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        up.role = 'admin'
        OR (
          up.role = 'manager'
          AND EXISTS (
            SELECT 1 FROM user_hierarchy h
            WHERE h.id = leads.assigned_to
            AND h.manager_id = up.id
          )
        )
      )
    )
  );

CREATE POLICY "Users can update their assigned leads or all leads if admin"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow authenticated users to insert activities"
  ON lead_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read activities"
  ON lead_activities
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert comments"
  ON lead_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read comments"
  ON lead_comments
  FOR SELECT
  TO authenticated
  USING (true);