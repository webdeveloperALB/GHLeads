/*
  # Fix desk notification logic

  1. Changes
    - Update create_lead_notifications function to only notify desk users about leads belonging to their desk
    - Remove the condition that notifies all desk users about unassigned leads
    - Desk users should only receive notifications for leads where lead.desk matches their full_name

  2. Fixed Logic
    - Desk users now only get notified if:
      - The lead's desk field matches their full_name, OR
      - The lead is assigned directly to them, OR
      - The lead is assigned to one of their subordinates (managers/agents under them)
*/

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
      -- Desk users get notified ONLY if lead belongs to their desk
      -- Check if the lead's desk matches this desk user's full_name OR if lead is assigned to their team
      IF lead_record.desk = user_record.full_name OR
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
