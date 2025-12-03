import pg from 'pg';
const { Client } = pg;

// Use direct connection (port 5432) instead of pooler (6543)
const connectionString = 'postgresql://postgres.kwiuzntxxsmezjgswact:dh2h3CIJFoP5NKYJ@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const statements = [
  {
    name: 'Create table',
    sql: `CREATE TABLE IF NOT EXISTS lead_assignment_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_name text NOT NULL,
      country_code text NOT NULL,
      assigned_agent_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      is_active boolean DEFAULT true,
      priority integer DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`
  },
  {
    name: 'Create source_country index',
    sql: `CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_source_country
      ON lead_assignment_rules(source_name, country_code)`
  },
  {
    name: 'Create active index',
    sql: `CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_active
      ON lead_assignment_rules(is_active) WHERE is_active = true`
  },
  {
    name: 'Create priority index',
    sql: `CREATE INDEX IF NOT EXISTS idx_lead_assignment_rules_priority
      ON lead_assignment_rules(priority DESC)`
  },
  {
    name: 'Create unique index',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_assignment_rules_unique
      ON lead_assignment_rules(source_name, country_code, assigned_agent_id)`
  },
  {
    name: 'Enable RLS',
    sql: `ALTER TABLE lead_assignment_rules ENABLE ROW LEVEL SECURITY`
  },
  {
    name: 'Create view policy',
    sql: `DO $$
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
    END $$`
  },
  {
    name: 'Create insert policy',
    sql: `DO $$
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
    END $$`
  },
  {
    name: 'Create update policy',
    sql: `DO $$
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
    END $$`
  },
  {
    name: 'Create delete policy',
    sql: `DO $$
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
    END $$`
  },
  {
    name: 'Create update function',
    sql: `CREATE OR REPLACE FUNCTION update_assignment_rules_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$`
  },
  {
    name: 'Drop existing trigger',
    sql: `DROP TRIGGER IF EXISTS set_assignment_rules_updated_at ON lead_assignment_rules`
  },
  {
    name: 'Create trigger',
    sql: `CREATE TRIGGER set_assignment_rules_updated_at
      BEFORE UPDATE ON lead_assignment_rules
      FOR EACH ROW
      EXECUTE FUNCTION update_assignment_rules_updated_at()`
  }
];

async function applyMigration() {
  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected successfully!\n');

    console.log('Applying migration statements:\n');

    for (const statement of statements) {
      try {
        await client.query(statement.sql);
        console.log(`✓ ${statement.name}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⊙ ${statement.name} (already exists)`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✓ Migration completed successfully!');

    console.log('\nVerifying table structure...');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'lead_assignment_rules'
      ORDER BY ordinal_position
    `);

    console.log('\nTable: lead_assignment_rules');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
    });

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
