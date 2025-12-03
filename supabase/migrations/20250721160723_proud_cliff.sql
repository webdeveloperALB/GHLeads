/*
  # Sync user roles with auth metadata

  1. Database Function
    - `update_auth_user_role()` - Updates auth.users metadata with role from user_profiles
    - Uses SECURITY DEFINER to allow access to auth schema
    - Updates raw_app_meta_data with current role

  2. Database Trigger
    - `on_user_profile_role_change` - Fires after INSERT or UPDATE of role on user_profiles
    - Automatically syncs role changes to auth.users table

  3. One-time Sync
    - Updates all existing users to sync their roles with auth metadata
    - Required for existing users to have proper JWT claims

  This ensures that JWT tokens contain the correct role claim for RLS policies.
*/

-- Create function to update auth user role
CREATE OR REPLACE FUNCTION update_auth_user_role()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the auth.users table with the role from user_profiles
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically sync role changes
DROP TRIGGER IF EXISTS on_user_profile_role_change ON user_profiles;
CREATE TRIGGER on_user_profile_role_change
  AFTER INSERT OR UPDATE OF role ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_auth_user_role();

-- One-time sync for existing users
-- This will trigger the function for all existing users
UPDATE user_profiles SET role = role WHERE role IS NOT NULL;