/*
  # Add persistent lead notifications system

  1. New Tables
    - `lead_notifications`
      - `id` (uuid, primary key)
      - `lead_id` (bigint, references leads)
      - `user_id` (uuid, references user_profiles)
      - `notification_type` (text) - 'new_lead', 'assignment', 'deposit'
      - `message` (text) - notification message
      - `is_read` (boolean) - whether user has seen this notification
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Users can only see their own notifications
    - System can create notifications for any user

  3. Functions
    - Function to create notifications based on hierarchy
    - Triggers for new leads and assignments
*/

-- Create lead notifications table
CREATE TABLE IF NOT EXISTS lead_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id bigint REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'new_lead',
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lead_notifications_user_id ON lead_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_is_read ON lead_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_created_at ON lead_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_user_unread ON lead_notifications(user_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE lead_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON lead_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update their own notifications"
  ON lead_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can create notifications (via service role)
CREATE POLICY "System can create notifications"
  ON lead_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create notifications for hierarchy
CREATE OR REPLACE FUNCTION create_lead_notifications(lead_record leads)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record user_profiles;
  notification_message text;
BEGIN
  notification_message := 'New lead: ' || lead_record.first_name || ' ' || lead_record.last_name || ' (' || lead_record.email || ')';
  
  -- Create notifications for all users who should see this lead
  FOR user_record IN 
    SELECT * FROM user_profiles 
    WHERE role IN ('admin', 'desk', 'manager', 'agent')
  LOOP
    -- Check if user should be notified based on hierarchy
    IF user_record.role = 'admin' THEN
      -- Admins get notified about all leads
      INSERT INTO lead_notifications (lead_id, user_id, notification_type, message)
      VALUES (lead_record.id, user_record.id, 'new_lead', notification_message);
      
    ELSIF user_record.role = 'desk' THEN
      -- Desk users get notified if lead is unassigned or assigned to their team
      IF lead_record.assigned_to IS NULL OR 
         lead_record.desk = user_record.full_name OR
         lead_record.assigned_to = user_record.id OR
         EXISTS (
           SELECT 1 FROM user_profiles subordinate
           WHERE subordinate.manager_id = user_record.id
           AND subordinate.id = lead_record.assigned_to
         ) OR
         EXISTS (
           SELECT 1 FROM user_profiles manager
           JOIN user_profiles agent ON agent.manager_id = manager.id
           WHERE manager.manager_id = user_record.id
           AND agent.id = lead_record.assigned_to
         ) THEN
        INSERT INTO lead_notifications (lead_id, user_id, notification_type, message)
        VALUES (lead_record.id, user_record.id, 'new_lead', notification_message);
      END IF;
      
    ELSIF user_record.role = 'manager' THEN
      -- Managers get notified if lead is assigned to them or their agents
      IF lead_record.assigned_to = user_record.id OR
         EXISTS (
           SELECT 1 FROM user_profiles agent
           WHERE agent.manager_id = user_record.id
           AND agent.id = lead_record.assigned_to
         ) THEN
        INSERT INTO lead_notifications (lead_id, user_id, notification_type, message)
        VALUES (lead_record.id, user_record.id, 'new_lead', notification_message);
      END IF;
      
    ELSIF user_record.role = 'agent' THEN
      -- Agents get notified only if lead is assigned to them
      IF lead_record.assigned_to = user_record.id THEN
        INSERT INTO lead_notifications (lead_id, user_id, notification_type, message)
        VALUES (lead_record.id, user_record.id, 'new_lead', notification_message);
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Trigger function to create notifications when new leads are inserted
CREATE OR REPLACE FUNCTION trigger_lead_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create notifications for new leads (not converted)
  IF NEW.is_converted = false THEN
    PERFORM create_lead_notifications(NEW);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for new leads
DROP TRIGGER IF EXISTS on_lead_insert_notification ON leads;
CREATE TRIGGER on_lead_insert_notification
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_lead_notifications();

-- Function to create notifications when leads are assigned
CREATE OR REPLACE FUNCTION trigger_assignment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_message text;
BEGIN
  -- Check if assignment changed and new assignment is not null
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    notification_message := 'Lead assigned to you: ' || NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.email || ')';
    
    INSERT INTO lead_notifications (lead_id, user_id, notification_type, message)
    VALUES (NEW.id, NEW.assigned_to, 'assignment', notification_message);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create assignment trigger
DROP TRIGGER IF EXISTS on_lead_assignment_notification ON leads;
CREATE TRIGGER on_lead_assignment_notification
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_assignment_notifications();