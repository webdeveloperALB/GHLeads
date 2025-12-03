/*
  # Add default permissions for existing users

  1. Changes
    - Insert default permissions for all existing users in user_profiles table
    - Only insert if no permissions record exists (to avoid duplicates)
    - Set basic permissions based on role
*/

-- Insert default permissions for existing users who don't have permissions yet
INSERT INTO user_permissions (user_id, permissions)
SELECT 
  up.id,
  CASE
    WHEN up.role = 'admin' THEN
      '{
        "clients": {
          "view": true,
          "register": true,
          "remove": true,
          "download": true,
          "promote": true,
          "demote": true,
          "edit": true,
          "phone": true,
          "email": true,
          "password": true,
          "info": true,
          "assign": true,
          "whatsapp": true,
          "loginLog": true
        },
        "leads": {
          "upload": true
        },
        "support": {
          "chat": true,
          "deleteChat": true
        },
        "comments": {
          "edit": true,
          "delete": true
        }
      }'::jsonb
    WHEN up.role = 'manager' THEN
      '{
        "clients": {
          "view": true,
          "register": true,
          "remove": false,
          "download": true,
          "promote": true,
          "demote": true,
          "edit": true,
          "phone": true,
          "email": true,
          "password": false,
          "info": true,
          "assign": true,
          "whatsapp": true,
          "loginLog": true
        },
        "leads": {
          "upload": true
        },
        "support": {
          "chat": true,
          "deleteChat": false
        },
        "comments": {
          "edit": true,
          "delete": false
        }
      }'::jsonb
    ELSE
      '{
        "clients": {
          "view": true,
          "register": false,
          "remove": false,
          "download": false,
          "promote": false,
          "demote": false,
          "edit": false,
          "phone": true,
          "email": true,
          "password": false,
          "info": true,
          "assign": false,
          "whatsapp": true,
          "loginLog": false
        },
        "leads": {
          "upload": false
        },
        "support": {
          "chat": true,
          "deleteChat": false
        },
        "comments": {
          "edit": false,
          "delete": false
        }
      }'::jsonb
  END
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM user_permissions
  WHERE user_permissions.user_id = up.id
);