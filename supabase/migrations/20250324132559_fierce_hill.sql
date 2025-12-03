/*
  # Fix lead comments relationship

  1. Changes
    - Add foreign key relationship between lead_comments and user_profiles
    - Add index on created_by column
    - Enable RLS on lead_comments table
    - Add RLS policies for comments

  2. Security
    - Enable RLS
    - Add policies for:
      - Viewing comments
      - Adding comments
      - Deleting comments (admin only)
*/

-- Add foreign key constraint
ALTER TABLE lead_comments
ADD CONSTRAINT lead_comments_created_by_fkey
FOREIGN KEY (created_by) REFERENCES user_profiles(id)
ON DELETE SET NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_lead_comments_created_by
ON lead_comments(created_by);

-- Enable RLS
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view comments for leads they manage"
ON lead_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_comments.lead_id
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

CREATE POLICY "Users can add comments to leads they manage"
ON lead_comments
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

CREATE POLICY "Users can delete their own comments or if admin"
ON lead_comments
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);