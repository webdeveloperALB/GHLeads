import pg from 'pg';
const { Client } = pg;

// Connection string from environment
const connectionString = 'postgresql://postgres.kwiuzntxxsmezjgswact:dh2h3CIJFoP5NKYJ@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const migrationSql = `
-- Create lead_assignment_rules table
CREATE TABLE IF NOT EXISTS lead_assignment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  country_code text NOT NULL,
  assigned_agent_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_source_country
  ON lead_assignment_rules(source_name, country_code);

CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_active
  ON lead_assignment_rules(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_priority
  ON lead_assignment_rules(priority DESC);

-- Add unique constraint to prevent duplicate rules
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignment_rules_unique
  ON lead_assignment_rules(source_name, country_code, assigned_agent_id);

-- Enable RLS
ALTER TABLE lead_assignment_rules ENABLE ROW LEVEL SECURITY;

-- Admins can view all rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_assignment_rules'
    AND policyname = 'Admins can view assignment rules'
  ) THEN
    CREATE POLICY "Admins can view assignment rules"
      ON lead_assignment_rules
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Admins can create rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_assignment_rules'
    AND policyname = 'Admins can create assignment rules'
  ) THEN
    CREATE POLICY "Admins can create assignment rules"
      ON lead_assignment_rules
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Admins can update rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_assignment_rules'
    AND policyname = 'Admins can update assignment rules'
  ) THEN
    CREATE POLICY "Admins can update assignment rules"
      ON lead_assignment_rules
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Admins can delete rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_assignment_rules'
    AND policyname = 'Admins can delete assignment rules'
  ) THEN
    CREATE POLICY "Admins can delete assignment rules"
      ON lead_assignment_rules
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
      );
  END IF;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_assignment_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS set_assignment_rules_updated_at ON lead_assignment_rules;
CREATE TRIGGER set_assignment_rules_updated_at
  BEFORE UPDATE ON lead_assignment_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_rules_updated_at();
`;

async function applyMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    console.log('Applying migration...\n');
    await client.query(migrationSql);

    console.log('✓ Migration applied successfully!');
    console.log('\nVerifying table creation...');

    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'lead_assignment_rules'
      ORDER BY ordinal_position
    `);

    console.log('\nTable structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error('Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
