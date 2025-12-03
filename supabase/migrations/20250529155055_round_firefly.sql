/*
  # Add lead questions and answers functionality

  1. New Tables
    - `lead_questions`
      - `id` (uuid, primary key)
      - `question` (text)
      - `created_at` (timestamp)
      - `is_active` (boolean)
      - `order` (integer)
    
    - `lead_answers`
      - `id` (uuid, primary key)
      - `lead_id` (bigint, references leads)
      - `question_id` (uuid, references lead_questions)
      - `answer` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for admins and managers
*/

-- Create lead questions table
CREATE TABLE lead_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  "order" integer NOT NULL DEFAULT 0
);

-- Create lead answers table
CREATE TABLE lead_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint REFERENCES leads(id) ON DELETE CASCADE,
  question_id uuid REFERENCES lead_questions(id) ON DELETE CASCADE,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, question_id)
);

-- Create indexes
CREATE INDEX idx_lead_answers_lead_id ON lead_answers(lead_id);
CREATE INDEX idx_lead_answers_question_id ON lead_answers(question_id);
CREATE INDEX idx_lead_questions_order ON lead_questions("order");
CREATE INDEX idx_lead_questions_is_active ON lead_questions(is_active);

-- Enable RLS
ALTER TABLE lead_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for lead_questions
CREATE POLICY "Admins can manage questions"
  ON lead_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "All users can view questions"
  ON lead_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for lead_answers
CREATE POLICY "Users can view answers for leads they manage"
  ON lead_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_answers.lead_id
      AND (
        leads.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND (
            user_profiles.role = 'admin'
            OR (
              user_profiles.role = 'manager'
              AND EXISTS (
                SELECT 1 FROM user_profiles agent
                WHERE agent.id = leads.assigned_to
                AND agent.manager_id = user_profiles.id
              )
            )
          )
        )
      )
    )
  );

CREATE POLICY "Users can add answers to leads they manage"
  ON lead_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_id
      AND (
        leads.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND (
            user_profiles.role = 'admin'
            OR (
              user_profiles.role = 'manager'
              AND EXISTS (
                SELECT 1 FROM user_profiles agent
                WHERE agent.id = leads.assigned_to
                AND agent.manager_id = user_profiles.id
              )
            )
          )
        )
      )
    )
  );

-- Insert default questions
INSERT INTO lead_questions (question, "order") VALUES
  ('What is your investment experience?', 1),
  ('What is your risk tolerance?', 2),
  ('What is your investment goal?', 3),
  ('What is your preferred investment timeframe?', 4),
  ('What is your monthly income?', 5),
  ('How did you hear about us?', 6);