/*
  # Add notification control to API keys

  1. Changes
    - Add `enable_notifications` column to `api_keys` table
    - Default to true for backward compatibility
    - Update notification trigger to check API key settings

  2. Purpose
    - Allow selective notifications per API key
    - Admins can control which API sources trigger notifications
*/

-- Add enable_notifications column to api_keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'enable_notifications'
  ) THEN
    ALTER TABLE api_keys ADD COLUMN enable_notifications boolean DEFAULT true;
  END IF;
END $$;

-- Update the notification trigger to check API key settings
CREATE OR REPLACE FUNCTION trigger_lead_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  should_notify boolean;
BEGIN
  -- Only create notifications for new leads (not converted)
  IF NEW.is_converted = false THEN
    -- Check if this lead came from an API key
    IF NEW.api_key_id IS NOT NULL THEN
      -- Check if notifications are enabled for this API key
      SELECT COALESCE(enable_notifications, true) INTO should_notify
      FROM api_keys
      WHERE id = NEW.api_key_id;
      
      -- Only create notifications if enabled for this API key
      IF should_notify THEN
        PERFORM create_lead_notifications(NEW);
      END IF;
    ELSE
      -- Lead created manually (not from API), always notify
      PERFORM create_lead_notifications(NEW);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;